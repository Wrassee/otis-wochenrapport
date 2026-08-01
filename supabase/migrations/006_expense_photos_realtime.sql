-- ============================================================
-- OTIS Wochenrapport - Expense Photos Realtime
-- Live cross-device sync: photos taken on another device appear
-- immediately (no manual sync / app restart needed).
--
-- NOTE: requires the expense_photos TABLE to exist first (migration
-- 004). This file is order-safe: if the table is missing it skips
-- silently instead of failing, so it can be run before or after 004.
-- ============================================================

-- Add the table to the realtime publication so postgres_changes
-- events are emitted for INSERT / UPDATE / DELETE. Idempotent: skips
-- silently if the table is already a member (safe to re-run). The
-- to_regclass guard prevents "relation does not exist" when 004 has
-- not been applied yet.
DO $$
BEGIN
  IF to_regclass('public.expense_photos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'expense_photos'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expense_photos;
  END IF;
END
$$;

-- REPLICA IDENTITY FULL: include all columns (esp. user_id) in DELETE
-- payloads, so the filtered channel can reliably attribute deletes to
-- the right user. Small table — negligible overhead. Guarded with
-- to_regclass for the same reason as above (must be EXECUTE'd inside
-- a DO block, since ALTER TABLE cannot run conditionally).
DO $$
BEGIN
  IF to_regclass('public.expense_photos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE expense_photos REPLICA IDENTITY FULL';
  END IF;
END
$$;
