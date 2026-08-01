-- ============================================================
-- OTIS Wochenrapport - Expense Photos (Spesen Belege)
-- Syncs photographed receipts across devices
-- ============================================================

-- 8. EXPENSE PHOTOS TABLE
CREATE TABLE IF NOT EXISTS expense_photos (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  filename TEXT NOT NULL,
  data_url TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expense_photos_user_week ON expense_photos(user_id, year, week);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE expense_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own photos"
  ON expense_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own photos"
  ON expense_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own photos"
  ON expense_photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos"
  ON expense_photos FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME (live cross-device photo sync)
-- The table is realtime-enabled HERE at creation time, so the
-- order of migrations 004 / 006 no longer matters: whichever runs
-- first, the end state is correct. Idempotent (safe to re-run).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'expense_photos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expense_photos;
  END IF;
END
$$;

-- REPLICA IDENTITY FULL: include all columns (esp. user_id, year,
-- week) in DELETE payloads, so the filtered realtime channel can
-- attribute deletes to the right user. Idempotent.
ALTER TABLE expense_photos REPLICA IDENTITY FULL;
