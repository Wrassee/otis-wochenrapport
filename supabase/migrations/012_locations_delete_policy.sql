-- ============================================================
-- OTIS Wochenrapport - Migration 012
-- locations DELETE policy
--
-- WHY: 009_locations_write_policies.sql only grants authenticated users
-- INSERT and UPDATE on `locations`. The app deletes a lift via
-- `deleteLocation` (sync_queue type `location_delete` →
-- `deleteLocationByAnlagenummer`), which needs DELETE. Without this policy
-- the cloud delete fails with an RLS error and the queue item retries
-- forever — the lift is gone locally for a moment, but the next app start
-- re-pulls the row from the cloud (`getLocations` in App.tsx init) and it
-- reappears in "Meine Lifte". Deleting is only possible after this policy
-- exists.
--
-- Scope: any authenticated user may delete lift master data — the same
-- shared-lift-catalog model as the SELECT/INSERT/UPDATE policies. Existing
-- time entries reference locations by FK with ON DELETE SET NULL (001), so
-- entries keep their denormalized anlagenummer/project/address for display.
-- ============================================================

-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY, so re-running this
-- migration (or running it after a previous partial state) never fails with
-- 42710 "policy ... already exists". Safe to run any number of times.

DROP POLICY IF EXISTS "Authenticated users can delete locations" ON locations;
CREATE POLICY "Authenticated users can delete locations"
  ON locations FOR DELETE
  USING (auth.role() = 'authenticated');

-- PostgREST schema cache reload so the new policy is effective immediately.
NOTIFY pgrst, 'reload schema';
