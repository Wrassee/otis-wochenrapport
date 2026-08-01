-- ============================================================
-- OTIS Wochenrapport - User Favorites Realtime
-- Live cross-device sync: a lift used on another device appears
-- in "Letzte Anlagen" immediately (no manual sync / restart).
--
-- NOTE: requires the user_favorites TABLE to exist first (migration
-- 002). This file is order-safe: if the table is missing it skips
-- silently instead of failing, so it can be run before or after 002.
-- ============================================================

-- Add the table to the realtime publication so postgres_changes
-- events are emitted for INSERT / UPDATE / DELETE. Idempotent: skips
-- silently if the table is already a member (safe to re-run). The
-- to_regclass guard prevents "relation does not exist" when 002 has
-- not been applied yet.
DO $$
BEGIN
  IF to_regclass('public.user_favorites') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'user_favorites'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_favorites;
  END IF;
END
$$;

-- REPLICA IDENTITY FULL: include all columns (esp. user_id and
-- anlagenummer) in DELETE payloads, so the filtered channel can
-- reliably attribute deletes to the right user and apply them
-- directly. Guarded with to_regclass for the same reason as above
-- (must be EXECUTE'd inside a DO block, since ALTER TABLE cannot
-- run conditionally).
DO $$
BEGIN
  IF to_regclass('public.user_favorites') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE user_favorites REPLICA IDENTITY FULL';
  END IF;
END
$$;
