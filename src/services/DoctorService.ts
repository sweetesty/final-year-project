import { supabase } from './SupabaseService';
import { NotificationService } from './NotificationService';

export interface DoctorRequest {
  id: string;
  patient_id: string;
  doctor_id: string;
  type: 'connection' | 'message';
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
    last_seen: string | null;
  };
}

export class DoctorService {
  /**
   * Sends a connection or message request to a doctor.
   */
  static async sendConnectionRequest(
    patientId: string,
    doctorId: string,
    type: 'connection' | 'message',
    message?: string
  ) {
    // 1. Check for existing request (pending OR accepted)
    const { data: existing } = await supabase
      .from('doctor_requests')
      .select('id, status')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .eq('type', type)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error(`You are already ${type === 'connection' ? 'connected with' : 'in a message thread with'} this doctor.`);
      }
      throw new Error(`You already have a pending ${type} request with this doctor.`);
    }

    // 2. Insert request
    const { error } = await supabase
      .from('doctor_requests')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        type,
        message,
        status: 'pending'
      });

    if (error) throw error;

    // 3. Notify doctor
    try {
      const [{ data: patient }, { data: doctor }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', patientId).single(),
        supabase.from('profiles').select('push_token').eq('id', doctorId).single()
      ]);

      if (doctor?.push_token && patient?.full_name) {
        const title = type === 'connection' ? '🤝 New Connection Request' : '💬 New Message Request';
        const body = `${patient.full_name} wants to ${type === 'connection' ? 'link with you' : 'chat with you'}.`;
        
        await NotificationService.sendPushToToken(doctor.push_token, title, body, {
          type: 'clinical_request',
          requestId: type
        });
      }
    } catch (e) {
      console.warn('[DoctorService] Failed to send push notification for request:', e);
    }
  }

  /**
   * Fetches all pending requests for a doctor.
   */
  static async getPendingRequests(doctorId: string): Promise<DoctorRequest[]> {
    const { data, error } = await supabase
      .from('doctor_requests')
      .select('*, profiles:patient_id(full_name, avatar_url, bio, last_seen)')
      .eq('doctor_id', doctorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as any;
  }

  /**
   * Updates the status of a request.
   */
  static async updateRequestStatus(requestId: string, status: 'accepted' | 'rejected') {
    const { error } = await supabase
      .from('doctor_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw error;
  }

  /**
   * Fetches the medical profile summary for a patient (used during request review).
   */
  static async getPatientMedicalSnapshot(patientId: string) {
    const { data, error } = await supabase
      .from('medical_details')
      .select('bloodtype, allergies, chronicconditions, currentmedications')
      .eq('patientid', patientId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  /**
   * Checks for an existing request or connection between a patient and doctor.
   * Returns 'none', 'pending', or 'accepted'.
   */
  static async getRequestStatus(patientId: string, doctorId: string) {
    // 1. Check for any non-rejected connection request
    const { data: connRequest } = await supabase
      .from('doctor_requests')
      .select('status')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .eq('type', 'connection')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Check for any non-rejected message request
    const { data: msgRequest } = await supabase
      .from('doctor_requests')
      .select('status')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .eq('type', 'message')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Check for clinical link
    const { data: link } = await supabase
      .from('doctor_patient_links')
      .select('id')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .maybeSingle();

    return {
      connection: link ? 'accepted' : (connRequest?.status || 'none'),
      message: msgRequest?.status || 'none'
    };
  }

  /**
   * Generates a unique 6-digit patient code if it doesn't exist.
   */
  static async ensurePatientCode(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('patientcode')
      .eq('id', userId)
      .single();

    if (profile?.patientcode) return profile.patientcode;

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase
      .from('profiles')
      .update({ patientcode: newCode })
      .eq('id', userId);
    
    return newCode;
  }

  /**
   * Links a doctor to a patient using the 6-digit code.
   */
  static async linkPatientWithCode(doctorId: string, patientCode: string) {
    const sanitizedCode = patientCode.replace(/\s/g, '').replace(/-/g, '');
    const { data: patient, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('patientcode', sanitizedCode)
      .single();

    if (findError || !patient) throw new Error("Invalid Patient Code. Please check and try again.");

    // 2. Create link
    const { error: linkError } = await supabase
      .from('doctor_patient_links')
      .insert({
        doctor_id: doctorId,
        patient_id: patient.id
      });

    if (linkError) throw new Error("Already linked to this patient.");
    
    // 3. Clear existing requests between this pair (Cleanup)
    try {
      await supabase
        .from('doctor_requests')
        .delete()
        .eq('patient_id', patient.id)
        .eq('doctor_id', doctorId);
    } catch (e) {
      console.warn('[DoctorService] Failed to clear connection requests after link:', e);
    }

    return patient.id;
  }

  /**
   * Fetches all patients linked to the current doctor.
   */
  static async getLinkedPatients(doctorId: string) {
    // 1. Fetch the raw links
    const { data: links, error: linkError } = await supabase
      .from('doctor_patient_links')
      .select('patient_id, doctor_id')
      .eq('doctor_id', doctorId);

    if (linkError) {
      console.error('[DoctorService] Link fetch error:', linkError);
      return [];
    }
    
    console.log(`[DoctorService] Found ${links?.length || 0} links for doctor:`, doctorId);
    if (!links || links.length === 0) return [];

    // 2. Extract patient IDs
    const patientIds = links.map(l => l.patient_id);

    // 3. Fetch the profiles for these patients (Manual Join)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, push_token, phone')
      .in('id', patientIds);

    if (profileError) {
      console.error('[DoctorService] Profile fetch error (Check RLS on "profiles" table?):', profileError);
      throw new Error(`Failed to read patient profiles: ${profileError.message}`);
    }

    console.log(`[DoctorService] Successfully fetched ${profiles?.length || 0} profiles for ${patientIds.length} links.`);
    
    if (patientIds.length > 0 && (!profiles || profiles.length === 0)) {
       console.warn('[DoctorService] SECURITY ALERT: Found linked patient IDs but profiles are empty. This usually means the "profiles" table RLS policy is blocking doctors from reading patient data.');
    }

    return profiles || [];
  }

  /**
   * Fetches the assigned doctor for a patient.
   */
  static async getLinkedDoctor(patientId: string) {
    console.log('[DoctorService] Checking clinical link for patient:', patientId);
    
    try {
      // 1. Get the link records
      const { data: links, error: linkError } = await supabase
        .from('doctor_patient_links')
        .select('doctor_id, patient_id')
        .eq('patient_id', patientId);

      if (linkError) {
        console.error('[DoctorService] Link fetch error:', linkError);
        return null;
      }

      if (!links || links.length === 0) {
        console.log('[DoctorService] No clinical link record found for this patient.');
        return null;
      }

      // We return the first doctor found for single-doctor UI compatibility
      const link = links[0];

      // 2. Fetch the doctor's profile (Manual Join)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, phone, push_token')
        .eq('id', link.doctor_id)
        .single();
      
      if (profileError) {
        console.error('[DoctorService] Doctor profile fetch error:', profileError);
        return null;
      }

      console.log('[DoctorService] Clinical connection verified:', profile?.full_name);
      return profile;
    } catch (e) {
      console.error('[DoctorService] Global fetch error for linked doctor:', e);
      return null;
    }
  }

  /**
   * Fetches ALL doctors linked to a patient.
   */
  static async getLinkedDoctors(patientId: string) {
    console.log('[DoctorService] Checking ALL clinical links for patient:', patientId);
    
    try {
      const { data: links, error: linkError } = await supabase
        .from('doctor_patient_links')
        .select('doctor_id')
        .eq('patient_id', patientId);

      if (linkError || !links || links.length === 0) return [];

      const doctorIds = links.map(l => l.doctor_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, phone, push_token, specialization')
        .in('id', doctorIds);

      if (profileError) throw profileError;
      return profiles || [];
    } catch (e) {
      console.error('[DoctorService] Global fetch error for linked doctors:', e);
      return [];
    }
  }

  /**
   * Fetches latest vitals and calculates clinical risk.
   */
  static async getPatientClinicalContext(patientId: string) {
    try {
      // 1. Get latest vitals
      const { data: vitals } = await supabase
        .from('vitals')
        .select('heartrate, spo2, steps, timestamp, patientid')
        .eq('patientid', patientId)
        .order('timestamp', { ascending: false })
        .limit(1);

      const latestVital = vitals?.[0];
      
      // 2. Determine Risk Level
      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (latestVital) {
        if (latestVital.heartrate > 120 || latestVital.heartrate < 50 || latestVital.spo2 < 90) {
          riskLevel = 'High';
        } else if (latestVital.heartrate > 100 || latestVital.spo2 < 94) {
          riskLevel = 'Medium';
        }
      }

      // 3. Last online status (if vital is > 5 mins old, consider offline)
      const lastOnline = latestVital?.timestamp ? new Date(latestVital.timestamp) : null;
      const isOnline = lastOnline ? (Date.now() - lastOnline.getTime() < 5 * 60 * 1000) : false;

      return {
        latestVital,
        riskLevel,
        isOnline,
        lastOnline
      };
    } catch (e) {
      console.error('[DoctorService] Context error:', e);
      return null;
    }
  }

  /**
   * Fetches active (unresolved) fall alerts for doctor's patients.
   */
  static async getUnresolvedAlerts(doctorId: string) {
    try {
      // 1. Get linked patient IDs
      const patients = await this.getLinkedPatients(doctorId);
      const patientids = patients.map(p => p.id);
      
      if (patientids.length === 0) return [];

      // 2. Fetch Unresolved Falls
      const { data: alerts, error } = await supabase
        .from('fall_events')
        .select('*')
        .in('patientid', patientids)
        .neq('status', 'resolved')
        .eq('resolved', false)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // 3. Enhance with profiles manually to avoid join failures
      const enhancedAlerts = await Promise.all(alerts.map(async (alert) => {
        const patient = patients.find(p => p && p.id === alert.patientid);
        if (patient) return { ...alert, profiles: patient };
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', alert.patientid)
          .single();
        
        return { ...alert, profiles: profile };
      }));

      return enhancedAlerts;
    } catch (e) {
      console.error('[DoctorService] Alert fetch error:', e);
      return [];
    }
  }

  /**
   * Assigns a doctor to an alert and updates its status.
   */
  static async acceptAlert(alertId: string, doctorId: string) {
    const { error } = await supabase
      .from('fall_events')
      .update({ 
        status: 'in-progress',
        assigned_doctor_id: doctorId 
      })
      .eq('id', alertId);

    if (error) throw error;
  }

  /**
   * Fetches full alert history for a specific patient.
   */
  static async getPatientAlertHistory(patientid: string) {
    try {
      const { data: alerts, error } = await supabase
        .from('fall_events')
        .select('*')
        .eq('patientid', patientid)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return alerts;
    } catch (e) {
      console.error('[DoctorService] History error:', e);
      return [];
    }
  }

  /**
   * Returns doctors within radiusKm of a given coordinate.
   * Uses the Haversine formula in SQL (no PostGIS required).
   */
  static async getNearbyDoctors(latitude: number, longitude: number, radiusKm = 20) {
    try {
      // Fetch all doctors with location and filter client-side using Haversine
      const { data: doctors, error: err } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, specialization, latitude, longitude, last_seen')
        .or('role.eq.doctor,role.eq.Doctor')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (err) throw err;

      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      return (doctors || [])
        .map(d => ({
          ...d,
          distanceKm: haversine(latitude, longitude, d.latitude!, d.longitude!),
        }))
        .filter(d => d.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (e) {
      console.error('[DoctorService] Nearby doctors error:', e);
      return [];
    }
  }

  /**
   * Broadcasts a HELP SIGNAL (bolt) — inserts a fall_event with source='help_signal'
   * that all nearby/linked doctors will see in their alerts.
   */
  static async sendHelpSignal(
    patientId: string,
    latitude: number,
    longitude: number,
  ) {
    const { error } = await supabase.from('fall_events').insert({
      patientid: patientId,
      latitude,
      longitude,
      confirmed: true,
      source: 'help_signal',
      status: 'unresolved',
      timestamp: new Date().toISOString(),
    });
    if (error) throw error;
  }

  /**
   * Fetches all registered doctors in the system.
   */
  static async getAllDoctors() {
    console.log('[DoctorService] Fetching all registered doctors...');
    try {
      // Fetching without a case-sensitive filter first to see what's there,
      // or using .ilike if your Supabase supports it, but .eq is standard.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, phone')
        .or('role.eq.doctor,role.eq.Doctor'); 

      if (error) {
        console.error('[DoctorService] Error query for all doctors:', error);
        throw error;
      }
      
      console.log(`[DoctorService] Found ${data?.length || 0} potential doctor profiles.`);
      return data || [];
    } catch (e) {
      console.error('[DoctorService] Fatal error fetching all doctors:', e);
      return [];
    }
  }
}
