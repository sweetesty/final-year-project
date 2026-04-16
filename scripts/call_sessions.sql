-- ==========================================
-- CALL SIGNALING SYSTEM
-- ==========================================

-- 1. Create Call Status Type
DO $$ BEGIN
    CREATE TYPE call_status AS ENUM ('ringing', 'accepted', 'declined', 'ended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Call Sessions Table
CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('voice', 'video')) DEFAULT 'voice',
    status call_status DEFAULT 'ringing',
    meeting_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Users can see their own calls" ON call_sessions;
CREATE POLICY "Users can see their own calls" ON call_sessions
    FOR ALL USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE call_sessions;

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_call_sessions_updated_at
    BEFORE UPDATE ON call_sessions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
