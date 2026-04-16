-- ==========================================
-- SUPABASE SCHEMA STANDARDIZATION (ULTRA-SAFE)
-- This version uses EXCEPTION blocks to ignore errors for already-standardized columns.
-- ==========================================

DO $$ 
BEGIN
    -- 1. Profiles Table
    BEGIN ALTER TABLE profiles RENAME COLUMN patient_code TO patientcode; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Emergency Contacts
    BEGIN ALTER TABLE emergency_contacts RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE emergency_contacts RENAME COLUMN "isPrimary" TO isprimary; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 3. Medications
    BEGIN ALTER TABLE medications RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medications RENAME COLUMN "isCritical" TO iscritical; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 4. Medication Logs
    BEGIN ALTER TABLE medication_logs RENAME COLUMN "medicationId" TO medicationid; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medication_logs RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medication_logs RENAME COLUMN "scheduledTime" TO scheduledtime; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medication_logs RENAME COLUMN "takenAt" TO takenat; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 5. Vitals
    BEGIN ALTER TABLE vitals RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE vitals RENAME COLUMN "heartRate" TO heartrate; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 6. Patient Locations
    BEGIN ALTER TABLE patient_locations RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 7. Fall Events
    BEGIN ALTER TABLE fall_events RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 8. Medical Details
    BEGIN ALTER TABLE medical_details RENAME COLUMN "patientId" TO patientid; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medical_details RENAME COLUMN "bloodType" TO bloodtype; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medical_details RENAME COLUMN "chronicConditions" TO chronicconditions; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE medical_details RENAME COLUMN "currentMedications" TO currentmedications; EXCEPTION WHEN OTHERS THEN NULL; END;

END $$;

-- 9. Add missing columns (Safe check included)
ALTER TABLE medications ADD COLUMN IF NOT EXISTS is_prescribed BOOLEAN DEFAULT FALSE;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS prescribed_by TEXT;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS end_date DATE;

-- 11. Add missing profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 10. Re-create Policies (Standardized)
-- We drop and re-create to ensure they point to the correct column names
DROP POLICY IF EXISTS "Patients manage own medications" ON medications;
DROP POLICY IF EXISTS "Patients manage own logs" ON medication_logs;
DROP POLICY IF EXISTS "Patients manage own contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "Patients manage own vitals" ON vitals;
DROP POLICY IF EXISTS "Patients manage own locations" ON patient_locations;
DROP POLICY IF EXISTS "Patients manage own fall events" ON fall_events;
DROP POLICY IF EXISTS "Patients manage own medical details" ON medical_details;
DROP POLICY IF EXISTS "Doctors view patient vitals" ON vitals;
DROP POLICY IF EXISTS "Doctors view patient locations" ON patient_locations;
DROP POLICY IF EXISTS "Doctors view patient medications" ON medications;

CREATE POLICY "Patients manage own medications" ON medications FOR ALL USING (auth.uid() = patientid);
CREATE POLICY "Patients manage own logs" ON medication_logs FOR ALL USING (auth.uid() = patientid);
CREATE POLICY "Patients manage own contacts" ON emergency_contacts FOR ALL USING (auth.uid() = patientid);
CREATE POLICY "Patients manage own vitals" ON vitals FOR ALL USING (auth.uid() = patientid);
CREATE POLICY "Patients manage own locations" ON patient_locations FOR ALL USING (auth.uid() = patientid);
CREATE POLICY "Patients manage own fall events" ON fall_events FOR ALL USING (auth.uid() = patientid);
CREATE POLICY "Patients manage own medical details" ON medical_details FOR ALL USING (auth.uid() = patientid);

CREATE POLICY "Doctors view patient vitals" ON vitals FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = vitals.patientid));
CREATE POLICY "Doctors view patient locations" ON patient_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = patient_locations.patientid));
CREATE POLICY "Doctors view patient medications" ON medications FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = medications.patientid));
