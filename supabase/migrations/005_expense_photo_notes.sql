-- ============================================================
-- OTIS Wochenrapport - Expense Photo Notes
-- Adds the optional note column (hotel name, km reading, ...)
-- to the expense_photos table. Safe for databases that already
-- ran migration 004 (ADD COLUMN IF NOT EXISTS is idempotent).
-- ============================================================

ALTER TABLE expense_photos ADD COLUMN IF NOT EXISTS note TEXT;
