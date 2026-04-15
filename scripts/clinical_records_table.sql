-- Create clinical_records table
CREATE TABLE clinical_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patientid UUID REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

-- Patients can manage their own clinical records
CREATE POLICY "Patients manage own clinical records" ON clinical_records
  FOR ALL USING (auth.uid() = patientid);

-- Doctors can view linked patients' clinical records
CREATE POLICY "Doctors view patient clinical records" ON clinical_records
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM doctor_patient_links
    WHERE doctor_id = auth.uid() AND patient_id = clinical_records.patientid
  ));
