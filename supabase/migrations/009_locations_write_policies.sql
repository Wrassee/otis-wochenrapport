-- ============================================================
-- OTIS Wochenrapport - Migration 009
-- locations INSERT / UPDATE policies
--
-- WHY: 001_init.sql only grants authenticated users SELECT on `locations`.
-- The app syncs manually added/edited lifts to the cloud via
-- `upsertLocation` (sync_queue type `location_upsert`), which needs INSERT
-- and UPDATE. Without these policies every lift sync fails with:
--   "new row violates row-level security policy for table locations"
-- and the push queue silently retries forever.
--
-- The write is scoped to the location being written (anlagenummer-based
-- upsert key), so any authenticated user may add/update lift master data —
-- matching the app's shared-lift-catalog model (same as the SELECT policy).
-- ============================================================

-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY, so re-running this
-- migration (or running it after a previous partial state) never fails with
-- 42710 "policy ... already exists". Safe to run any number of times.

DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
CREATE POLICY "Authenticated users can insert locations"
  ON locations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update locations" ON locations;
CREATE POLICY "Authenticated users can update locations"
  ON locations FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
