-- ==========================================
-- ADD PROFESSIONAL CLINICAL FIELDS
-- Run this in your Supabase SQL Editor to enable the Doctor Portfolio.
-- ==========================================

DO $$ 
BEGIN
    -- 1. Add facility column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'facility') THEN
        ALTER TABLE profiles ADD COLUMN facility TEXT;
    END IF;

    -- 2. Add medical_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'medical_id') THEN
        ALTER TABLE profiles ADD COLUMN medical_id TEXT;
    END IF;

    -- 3. Add bio column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE profiles ADD COLUMN bio TEXT;
    END IF;

    -- 4. Ensure specialization exists (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'specialization') THEN
        ALTER TABLE profiles ADD COLUMN specialization TEXT;
    END IF;

END $$;

COMMENT ON COLUMN profiles.facility IS 'Hospital or clinical facility name for doctors';
COMMENT ON COLUMN profiles.medical_id IS 'Professional registration or medical license number';
COMMENT ON COLUMN profiles.bio IS 'Professional medical background and clinical experience';
