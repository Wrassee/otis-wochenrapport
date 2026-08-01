-- ============================================================
-- OTIS Wochenrapport - Daily Expenses Realtime
-- Live cross-device sync: expenses entered on another device
-- appear immediately (no manual sync / app restart needed).
-- ============================================================

-- Add the table to the realtime publication so postgres_changes
-- events are emitted for INSERT / UPDATE / DELETE. Idempotent: skips
-- silently if the table is already a member (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'daily_expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_expenses;
  END IF;
END
$$;

-- REPLICA IDENTITY FULL: include all columns (esp. user_id, date and
-- expense_type) in DELETE payloads, so the filtered channel can reliably
-- attribute deletes to the right user and apply them directly. Small
-- table — negligible overhead.
ALTER TABLE daily_expenses REPLICA IDENTITY FULL;
