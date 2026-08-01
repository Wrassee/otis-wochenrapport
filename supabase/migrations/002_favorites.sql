-- ============================================================
-- OTIS Wochenrapport - User Favorites Table
-- Syncs favorite/recent elevators across devices
-- ============================================================

-- 6. USER FAVORITES TABLE
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  anlagenummer TEXT NOT NULL,
  project_id TEXT NOT NULL,
  full_address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  zone INTEGER NOT NULL DEFAULT 0,
  manual_zone INTEGER,
  use_count INTEGER NOT NULL DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, anlagenummer)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_last_used ON user_favorites(user_id, last_used DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
  ON user_favorites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME (live cross-device favorites sync)
-- The table is realtime-enabled HERE at creation time, so the
-- order of migrations 002 / 008 no longer matters: whichever runs
-- first, the end state is correct. Idempotent (safe to re-run).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_favorites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_favorites;
  END IF;
END
$$;

-- REPLICA IDENTITY FULL: include all columns (esp. user_id,
-- anlagenummer) in DELETE payloads, so the filtered realtime
-- channel can attribute deletes to the right user. Idempotent.
ALTER TABLE user_favorites REPLICA IDENTITY FULL;
