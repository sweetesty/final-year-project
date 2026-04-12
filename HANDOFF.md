# Vitals Fusion — Handoff Document

## Division of Responsibilities

| Area | Owner |
|---|---|
| Fall Detection & TensorFlow AI model | **Your teammate** |
| Supabase backend, auth, all DB connections | **You (this doc)** |
| OpenAI / Gemini AI chat | **You** |
| SMS (Termii) | **You** |

---

## 1. Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Copy your **Project URL** and **anon/public key** from:
   - Settings → API → Project URL
   - Settings → API → Project API keys → `anon public`
3. Update `.env` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 2. Run These SQL Migrations in Supabase SQL Editor

Go to **SQL Editor** in your Supabase dashboard and run each block:

### Profiles Table (extends Supabase auth.users)
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('patient', 'doctor')) NOT NULL DEFAULT 'patient',
  patient_code TEXT UNIQUE,
  push_token TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Doctor-Patient Links
```sql
CREATE TABLE doctor_patient_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id, patient_id)
);
```

### Emergency Contacts
```sql
CREATE TABLE emergency_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  "isPrimary" BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Medications
```sql
CREATE TABLE medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT DEFAULT 'daily',
  times TEXT[] DEFAULT '{}',
  instructions TEXT,
  "isCritical" BOOLEAN DEFAULT FALSE,
  "specificDays" INTEGER[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Medication Logs
```sql
CREATE TABLE medication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "medicationId" UUID REFERENCES medications(id) ON DELETE CASCADE,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('taken', 'skipped', 'missed')) NOT NULL,
  "scheduledTime" TEXT,
  "takenAt" TIMESTAMPTZ DEFAULT NOW()
);
```

### Vitals
```sql
CREATE TABLE vitals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE,
  "heartRate" INTEGER,
  spo2 INTEGER,
  steps INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### Patient Locations
```sql
CREATE TABLE patient_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### Fall Events
```sql
CREATE TABLE fall_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  confirmed BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'foreground',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### Direct Messages (Chat)
```sql
CREATE TABLE direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_direct_messages_chat_id ON direct_messages(chat_id);
```

### Medical Details
```sql
CREATE TABLE medical_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "patientId" UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  "bloodType" TEXT,
  allergies TEXT,
  "chronicConditions" TEXT,
  "currentMedications" TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Enable Row Level Security (RLS)

Run this for each table to lock down access:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patient_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fall_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_details ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Doctors can view linked patients' profiles
CREATE POLICY "Doctors can view linked patients" ON profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM doctor_patient_links
    WHERE doctor_id = auth.uid() AND patient_id = profiles.id
  ));

-- Patients manage their own data
CREATE POLICY "Patients manage own medications" ON medications FOR ALL USING (auth.uid() = "patientId");
CREATE POLICY "Patients manage own logs" ON medication_logs FOR ALL USING (auth.uid() = "patientId");
CREATE POLICY "Patients manage own contacts" ON emergency_contacts FOR ALL USING (auth.uid() = "patientId");
CREATE POLICY "Patients manage own vitals" ON vitals FOR ALL USING (auth.uid() = "patientId");
CREATE POLICY "Patients manage own locations" ON patient_locations FOR ALL USING (auth.uid() = "patientId");
CREATE POLICY "Patients manage own fall events" ON fall_events FOR ALL USING (auth.uid() = "patientId");
CREATE POLICY "Patients manage own medical details" ON medical_details FOR ALL USING (auth.uid() = "patientId");

-- Doctors can view their linked patients' data
CREATE POLICY "Doctors view patient vitals" ON vitals FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = vitals."patientId"));
CREATE POLICY "Doctors view patient locations" ON patient_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = patient_locations."patientId"));
CREATE POLICY "Doctors view patient medications" ON medications FOR SELECT
  USING (EXISTS (SELECT 1 FROM doctor_patient_links WHERE doctor_id = auth.uid() AND patient_id = medications."patientId"));

-- Doctor-patient links
CREATE POLICY "Doctors manage own links" ON doctor_patient_links FOR ALL USING (auth.uid() = doctor_id);

-- Chat: sender or receiver can access
CREATE POLICY "Chat participants can access messages" ON direct_messages FOR ALL
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
```

---

## 4. Enable Realtime

In Supabase dashboard → **Database → Replication**, enable realtime for:
- `direct_messages`
- `patient_locations`
- `fall_events`

---

## 5. Configure AI Keys

### OpenAI (AI Chat Companion)
1. Get key from [platform.openai.com](https://platform.openai.com)
2. Add to `.env`: `EXPO_PUBLIC_OPENAI_API_KEY=sk-...`

### Google Gemini (fallback AI)
1. Get key from [aistudio.google.com](https://aistudio.google.com)
2. Add to `.env`: `EXPO_PUBLIC_GEMINI_API_KEY=...`

---

## 6. Configure SMS (Termii)

1. Register at [termii.com](https://termii.com)
2. Get your API key and sender ID
3. Add to `.env`:
   ```env
   EXPO_PUBLIC_TERMII_API_KEY=your-key
   EXPO_PUBLIC_TERMII_SENDER_ID=VitalsFusion
   ```

---

## 7. Fix the medical-details.tsx Save Function

The save button in [app/medical-details.tsx](app/medical-details.tsx) currently just shows an alert. Wire it to Supabase:

```typescript
import { supabase } from '@/src/services/SupabaseService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

// Inside the component:
const { session } = useAuthViewModel();

const handleSave = async () => {
  const { error } = await supabase
    .from('medical_details')
    .upsert({
      patientId: session?.user?.id,
      bloodType: details.bloodType,
      allergies: details.allergies,
      chronicConditions: details.chronicConditions,
      currentMedications: details.currentMedications,
    });
  if (error) alert(error.message);
  else { alert('Saved!'); router.replace('/(tabs)'); }
};
```

---

## 8. Development Build (for Voice Input)

`@react-native-voice/voice` does not work in Expo Go. To test voice features, create a development build:

```bash
npx expo install expo-dev-client
npx eas build --profile development --platform ios
```

---

## 9. Running the App

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start the server (use Node 20.19.4+)
. ~/.nvm/nvm.sh && nvm use 20.19.4
node_modules/.bin/expo start --lan
```

Scan the QR code with **Expo Go** on your phone (same WiFi as your Mac).
