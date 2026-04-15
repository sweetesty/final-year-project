import { supabase } from './SupabaseService';

export class DoctorService {
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
      .select('id, full_name, avatar_url, push_token')
      .in('id', patientIds);

    if (profileError) {
      console.error('[DoctorService] Profile fetch error (RLS Check?):', profileError);
      return [];
    }

    console.log(`[DoctorService] Successfully fetched ${profiles?.length || 0} profiles for ${patientIds.length} links.`);
    if (profiles?.length < patientIds.length) {
      console.warn('[DoctorService] MISMATCH: Some linked patients were not found in the profiles table. This is almost certainly an RLS policy issue.');
    }

    return profiles || [];
  }

  /**
   * Fetches the assigned doctor for a patient.
   */
  static async getLinkedDoctor(patientId: string) {
    console.log('[DoctorService] Checking clinical link for patient:', patientId);
    
    try {
      // 1. Get the link record
      const { data: link, error: linkError } = await supabase
        .from('doctor_patient_links')
        .select('doctor_id, patient_id')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (linkError) {
        console.error('[DoctorService] Link fetch error:', linkError);
        return null;
      }

      if (!link) {
        console.log('[DoctorService] No clinical link record found for this patient.');
        return null;
      }

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
