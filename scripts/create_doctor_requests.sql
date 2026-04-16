-- ==========================================
-- DOCTOR CONNECTION REQUESTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS doctor_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('connection', 'message')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by doctor
CREATE INDEX IF NOT EXISTS idx_doctor_requests_doctor_id ON doctor_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_requests_status ON doctor_requests(status);

-- Enable RLS
ALTER TABLE doctor_requests ENABLE ROW LEVEL SECURITY;

-- Patients can view their own requests
CREATE POLICY "Patients can view their own requests" 
ON doctor_requests FOR SELECT 
USING (auth.uid() = patient_id);

-- Patients can create requests
CREATE POLICY "Patients can create requests" 
ON doctor_requests FOR INSERT 
WITH CHECK (auth.uid() = patient_id);

-- Doctors can see requests sent to them
CREATE POLICY "Doctors can view requests sent to them" 
ON doctor_requests FOR SELECT 
USING (auth.uid() = doctor_id);

-- Doctors can update the status of requests sent to them
CREATE POLICY "Doctors can update request status" 
ON doctor_requests FOR UPDATE 
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_doctor_requests_updated_at
    BEFORE UPDATE ON doctor_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

COMMENT ON TABLE doctor_requests IS 'Handles formal requests from patients to doctors for clinical connection or messaging.';
