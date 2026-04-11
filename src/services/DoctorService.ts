import { supabase } from './SupabaseService';

export class DoctorService {
  /**
   * Generates a unique 6-digit patient code if it doesn't exist.
   */
  static async ensurePatientCode(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('patient_code')
      .eq('id', userId)
      .single();

    if (profile?.patient_code) return profile.patient_code;

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase
      .from('profiles')
      .update({ patient_code: newCode })
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
      .eq('patient_code', sanitizedCode)
      .single();

    if (findError || !patient) throw new Error("Invalid Patient Code. Please check and try again.");

    // 2. Create link
    const { error: linkError } = await supabase
      .from('doctor_patient_links')
      .insert({
        doctor_id: doctorId,
        patientid: patient.id
      });

    if (linkError) throw new Error("Already linked to this patient.");
    
    return patient.id;
  }

  /**
   * Fetches all patients linked to the current doctor.
   */
  static async getLinkedPatients(doctorId: string) {
    const { data, error } = await supabase
      .from('doctor_patient_links')
      .select(`
        patientid,
        patient:profiles!patientid(id, full_name, avatar_url)
      `)
      .eq('doctor_id', doctorId);

    if (error) throw error;
    return data.map(d => d.patient);
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
        .select(`
          doctor_id,
          doctor:profiles!doctor_id(id, full_name, avatar_url, role)
        `)
        .eq('patientid', patientId)
        .maybeSingle();

      if (linkError) {
        console.error('[DoctorService] Link fetch error:', linkError);
        return null;
      }

      if (!link) {
        console.log('[DoctorService] No clinical link record found for this patient.');
        return null;
      }

      // 2. If we have the link but the join failed (sometimes due to RLS), try fetching profile directly
      if (link.doctor_id && !link.doctor) {
        console.log('[DoctorService] Link exists but doctor details missing. Retrying direct profile fetch...');
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .eq('id', link.doctor_id)
          .single();
        
        if (profile) return profile;
      }

    console.log('[DoctorService] Clinical connection verified:', link.doctor?.full_name || 'Generic Provider');
    return link.doctor;
    } catch (e) {
      console.error('[DoctorService] Global fetch error:', e);
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
        .select('*')
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
      const patientIds = patients.map(p => p.id);
      
      if (patientIds.length === 0) return [];

      // 2. Fetch Unresolved Falls
      const { data: alerts, error } = await supabase
        .from('fall_events')
        .select('*, profiles!patientid(id, full_name)')
        .in('patientid', patientIds)
        .eq('status', 'unresolved')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return alerts;
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
  static async getPatientAlertHistory(patientId: string) {
    try {
      const { data: alerts, error } = await supabase
        .from('fall_events')
        .select('*')
        .eq('patientid', patientId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return alerts;
    } catch (e) {
      console.error('[DoctorService] History error:', e);
      return [];
    }
  }
}
