import { supabase } from './SupabaseService';

export class CaregiverService {
  /**
   * Links a patient to the current caregiver using a 6-digit code.
   */
  static async linkPatientWithCode(caregiverId: string, patientCode: string) {
    const sanitizedCode = patientCode.replace(/\s/g, '').replace(/-/g, '').toUpperCase();
    if (sanitizedCode.length !== 6) throw new Error('Invalid code structure. Expected 6 digits.');

    const { data: patient, error: patientError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('patientcode', sanitizedCode)
      .single();

    if (patientError || !patient) {
      throw new Error('Patient not found with this code.');
    }

    const { error: linkError } = await supabase
      .from('caregiver_patient_links')
      .upsert({ caregiver_id: caregiverId, patient_id: patient.id });

    if (linkError) {
      if (linkError.code === '23505') throw new Error('Patient is already linked.');
      throw new Error('Failed to link patient: ' + linkError.message);
    }
  }

  /**
   * Fetches all patients linked to the current caregiver.
   */
  static async getLinkedPatients(caregiverId: string) {
    const { data: links, error: linkError } = await supabase
      .from('caregiver_patient_links')
      .select('patient_id')
      .eq('caregiver_id', caregiverId);

    if (linkError) {
      console.error('[CaregiverService] Link fetch error:', linkError);
      return [];
    }
    
    if (!links || links.length === 0) return [];
    const patientIds = links.map(l => l.patient_id);

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, phone, push_token')
      .in('id', patientIds);

    if (profileError) {
      console.error('[CaregiverService] Profile fetch error:', profileError);
      return [];
    }

    return profiles || [];
  }

  /**
   * Fetches the assigned caregivers for a patient (useful for notification routing).
   */
  static async getLinkedCaregivers(patientId: string) {
    try {
      const { data: links, error: linkError } = await supabase
        .from('caregiver_patient_links')
        .select('caregiver_id')
        .eq('patient_id', patientId);
      
      if (linkError) return [];
      if (!links || links.length === 0) return [];

      const caregiverIds = links.map(l => l.caregiver_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, phone, push_token')
        .in('id', caregiverIds);

      return profiles || [];
    } catch (e) {
      console.error('[CaregiverService] getLinkedCaregivers error:', e);
      return [];
    }
  }

  /**
   * Checks for unresolved fall events for a list of patient IDs.
   */
  static async getActiveAlerts(patientIds: string[]) {
    if (!patientIds || patientIds.length === 0) return [];
    
    const { data, error } = await supabase
      .from('fall_events')
      .select('patientid')
      .in('patientid', patientIds)
      .neq('status', 'resolved');

    if (error) {
      console.error('[CaregiverService] Alert check error:', error);
      return [];
    }
    
    return data || [];
  }
}
