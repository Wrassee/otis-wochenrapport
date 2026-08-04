-- 010_profile_home_location.sql
-- Per-user Spesen-zone reference point: the origin for zone calculation.
-- Some technicians do not start from Dietlikon, so each profile can store
-- its own home base; the app falls back to the Dietlikon defaults when these
-- are NULL. Idempotent — safe to run on any environment.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_latitude double precision,
  ADD COLUMN IF NOT EXISTS home_longitude double precision;
