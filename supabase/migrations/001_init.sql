-- ============================================================
-- OTIS Wochenrapport - Supabase Schema Migration
-- Creates all tables, indexes, and Row Level Security policies
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  personnel_number TEXT NOT NULL,
  supervisor_email TEXT DEFAULT '',
  language TEXT DEFAULT 'de',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LOCATIONS TABLE (elevators with coordinates)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anlagenummer TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  full_address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  zone INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ACTIVITY CODES TABLE
CREATE TABLE IF NOT EXISTS activity_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('productive', 'non_productive', 'absence')),
  description_de TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  description_it TEXT NOT NULL,
  excel_column TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TIME ENTRIES TABLE
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time DOUBLE PRECISION NOT NULL,
  duration DOUBLE PRECISION NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  activity_code_id TEXT REFERENCES activity_codes(id) ON DELETE SET NULL,
  activity_code TEXT,
  is_lunch BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  default_start_time DOUBLE PRECISION DEFAULT 7.0,
  supervisor_email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_locations_anlagenummer ON locations(anlagenummer);
CREATE INDEX IF NOT EXISTS idx_profiles_personnel ON profiles(personnel_number);
CREATE INDEX IF NOT EXISTS idx_time_entries_synced ON time_entries(synced);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- LOCATIONS: All authenticated users can read (autocomplete)
CREATE POLICY "Authenticated users can view locations"
  ON locations FOR SELECT
  USING (auth.role() = 'authenticated');

-- ACTIVITY CODES: All authenticated users can read
CREATE POLICY "Authenticated users can view activity codes"
  ON activity_codes FOR SELECT
  USING (auth.role() = 'authenticated');

-- TIME ENTRIES: Users can only see/edit their own entries
CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own time entries"
  ON time_entries FOR DELETE
  USING (auth.uid() = user_id);

-- USER SETTINGS: Users can only see/edit their own settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SEED DATA: Activity Codes
-- ============================================================
INSERT INTO activity_codes (id, code, category, description_de, description_fr, description_it, excel_column, sort_order) VALUES
  ('NK', 'NK', 'productive', 'NK - Normalkosten', 'NK - Coûts normaux', 'NK - Costi normali', 'J', 1),
  ('S', 'S', 'productive', 'S - Service', 'S - Service', 'S - Servizio', 'J', 2),
  ('T', 'T', 'productive', 'T - Travaux', 'T - Travaux', 'T - Lavori', 'J', 3),
  ('T_CLOT', 'T Clot', 'productive', 'T Clot - Abschluss T', 'T Clot - Clôture T', 'T Clot - Chiudere T', 'K', 4),
  ('O', 'O', 'productive', 'O - Maintenance', 'O - Maintenance', 'O - Manutenzione', 'L', 5),
  ('QI', 'QI', 'productive', 'QI (≤ 515)', 'QI (≤ 515)', 'QI (≤ 515)', 'M', 6),
  ('VM', 'VM', 'productive', 'VM - Visite/Besuch', 'VM - Visite', 'VM - Visita', 'O', 7),
  ('VP', 'VP', 'productive', 'VP - Fangprobe/Essai parachute', 'VP - Essai parachute', 'VP - Prova paracaduta', 'P', 8),
  ('NM', 'NM', 'productive', 'NM - Maintenance', 'NM - Maintenance', 'NM - Manutenzione', 'Q', 9),
  ('NTC', 'NTC', 'productive', 'NTC - Maintenance', 'NTC - Maintenance', 'NTC - Manutenzione', 'Q', 10),
  ('NF', 'NF', 'productive', 'NF - Maintenance', 'NF - Maintenance', 'NF - Manutenzione', 'Q', 11),
  ('VC', 'VC', 'productive', 'VC - Maintenance', 'VC - Maintenance', 'VC - Manutenzione', 'Q', 12),
  ('QI_SCOTT', 'QI SCOTT', 'productive', 'QI SCOTT (≥ 516)', 'QI SCOTT (≥ 516)', 'QI SCOTT (≥ 516)', 'R', 13),
  ('I04', 'I04', 'non_productive', 'I04 - Administration', 'I04 - Administration', 'I04 - Amministrazione', 'N', 20),
  ('I5S', 'I5S', 'non_productive', 'I5S - Sicherheit', 'I5S - Sécurité', 'I5S - Sicurezza', 'N', 21),
  ('I5Q', 'I5Q', 'non_productive', 'I5Q - Qualität', 'I5Q - Qualité', 'I5Q - Qualità', 'N', 22),
  ('I5T', 'I5T', 'non_productive', 'I5T - Technik', 'I5T - Technique', 'I5T - Tecnica', 'N', 23),
  ('I5A', 'I5A', 'non_productive', 'I5A - Administration', 'I5A - Administration', 'I5A - Amministrazione', 'N', 24),
  ('A01', 'A01', 'absence', 'A01 - Ferien/Vacances', 'A01 - Vacances', 'A01 - Vacanze', 'N', 30),
  ('A02', 'A02', 'absence', 'A02 - Militärdienst', 'A02 - Service militaire', 'A02 - Servizio militare', 'N', 31),
  ('A03', 'A03', 'absence', 'A03 - Krankheit', 'A03 - Maladie', 'A03 - Malattia', 'N', 32),
  ('A04', 'A04', 'absence', 'A04 - Unfall', 'A04 - Accident', 'A04 - Incidente', 'N', 33),
  ('A05', 'A05', 'absence', 'A05 - Andere bewilligte Abwesenheit', 'A05 - Autre absence accordée', 'A05 - Altra assenza accordata', 'N', 34),
  ('A07', 'A07', 'absence', 'A07 - Kompensation', 'A07 - Compensation', 'A07 - Compensazione', 'N', 35)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
