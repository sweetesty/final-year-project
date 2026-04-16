-- Create symptom_logs table (Safely)
CREATE TABLE IF NOT EXISTS symptom_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patientid UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  notes TEXT,
  severity TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Patients manage own symptom logs" ON symptom_logs;
DROP POLICY IF EXISTS "Doctors view patient symptom logs" ON symptom_logs;

-- Patients can manage their own symptom logs
CREATE POLICY "Patients manage own symptom logs" ON symptom_logs
  FOR ALL USING (auth.uid() = patientid);

-- Doctors can view linked patients' symptom logs
CREATE POLICY "Doctors view patient symptom logs" ON symptom_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM doctor_patient_links
    WHERE doctor_id = auth.uid() AND patient_id = symptom_logs.patientid
  ));
