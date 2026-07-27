-- ============================================================
-- OTIS Wochenrapport - Daily Expenses Table
-- Syncs Spesen (expenses) across devices
-- ============================================================

-- 7. DAILY EXPENSES TABLE
CREATE TABLE IF NOT EXISTS daily_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'entschaedigung_10h', 'hotel', 'transport',
    'pikettdienst', 'entschaedigung_pikett',
    'material', 'privatfahrzeug'
  )),
  value DOUBLE PRECISION NOT NULL DEFAULT 1,
  synced BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, expense_type)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_expenses_user_date ON daily_expenses(user_id, date);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE daily_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON daily_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON daily_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON daily_expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON daily_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER set_daily_expenses_updated_at
  BEFORE UPDATE ON daily_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
