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
        patient_id: patient.id
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
        patient_id,
        patient:profiles!doctor_patient_links_patient_id_fkey(id, full_name, avatar_url)
      `)
      .eq('doctor_id', doctorId);

    if (error) throw error;
    return data.map(d => d.patient);
  }

  /**
   * Fetches the assigned doctor for a patient.
   */
  static async getLinkedDoctor(patientId: string) {
    const { data, error } = await supabase
      .from('doctor_patient_links')
      .select(`
        doctor_id,
        doctor:profiles!doctor_patient_links_doctor_id_fkey(id, full_name, avatar_url, role)
      `)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (error) throw error;
    return data?.doctor;
  }
}
