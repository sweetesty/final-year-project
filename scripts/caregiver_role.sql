-- ==========================================
-- CAREGIVER ROLE UPDATE MIGRATION
-- ==========================================

DO $$ 
BEGIN
    -- 1. Update Profile constraint (if it exists) to allow caregiver
    -- Some DB versions handle this differently, but safe drop/add constraint works best.
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'doctor', 'caregiver'));
END $$;

-- 1.5 Allow searching profiles by patientcode (Crucial for linking)
DROP POLICY IF EXISTS "Anyone can search profiles by code" ON profiles;
CREATE POLICY "Anyone can search profiles by code" ON profiles FOR SELECT 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Caregivers view linked patient profiles" ON profiles;
CREATE POLICY "Caregivers view linked patient profiles" ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = profiles.id));

-- 2. Create linkage table explicitly for caregiver-patient connections
CREATE TABLE IF NOT EXISTS caregiver_patient_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(caregiver_id, patient_id)
);

-- 3. Enable RLS on new table
ALTER TABLE caregiver_patient_links ENABLE ROW LEVEL SECURITY;

-- 4. RLS for Caregiver Links (caregivers manage their own links)
DROP POLICY IF EXISTS "Caregivers manage own links" ON caregiver_patient_links;
CREATE POLICY "Caregivers manage own links" ON caregiver_patient_links FOR ALL USING (auth.uid() = caregiver_id);

-- 5. Extend existing tables to allow Caregiver read access
-- Caregivers should monitor medications, medication_logs, vitals, fall_events, and symptom_logs.

DROP POLICY IF EXISTS "Caregivers view patient medications" ON medications;
CREATE POLICY "Caregivers view patient medications" ON medications FOR SELECT 
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = medications.patientid));

DROP POLICY IF EXISTS "Caregivers view patient medication logs" ON medication_logs;
CREATE POLICY "Caregivers view patient medication logs" ON medication_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = medication_logs.patientid));

DROP POLICY IF EXISTS "Caregivers view patient vitals" ON vitals;
CREATE POLICY "Caregivers view patient vitals" ON vitals FOR SELECT 
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = vitals.patientid));

DROP POLICY IF EXISTS "Caregivers view patient fall events" ON fall_events;
CREATE POLICY "Caregivers view patient fall events" ON fall_events FOR SELECT 
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = fall_events.patientid));

DROP POLICY IF EXISTS "Caregivers view patient symptom logs" ON symptom_logs;
CREATE POLICY "Caregivers view patient symptom logs" ON symptom_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = symptom_logs.patientid));

-- 6. Clinical Write Access (Doctors can prescribe/manage)
DROP POLICY IF EXISTS "Doctors manage patient medications" ON medications;
CREATE POLICY "Doctors manage patient medications" ON medications FOR ALL
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = medications.patientid));

DROP POLICY IF EXISTS "Doctors manage patient fall alerts" ON fall_events;
CREATE POLICY "Doctors manage patient fall alerts" ON fall_events FOR ALL
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = fall_events.patientid));

-- 7. Live Tracking (Caregivers watch)
DROP POLICY IF EXISTS "Caregivers view patient locations" ON patient_locations;
CREATE POLICY "Caregivers view patient locations" ON patient_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM caregiver_patient_links WHERE caregiver_id = auth.uid() AND patient_id = patient_locations.patientid));

