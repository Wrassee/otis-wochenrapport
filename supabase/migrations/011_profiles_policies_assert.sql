-- 011_profiles_policies_assert.sql
-- Re-assert the profiles RLS policies idempotently.
--
-- Why: environments that were set up before the profiles INSERT/UPDATE
-- policies existed (schema drift — the same drift that dropped the
-- `language` column) fail the registration profile-upsert with
--
--   new row violates row level security policy for table "profiles"
--
-- The row either cannot be INSERTed (no INSERT policy) or, when a
-- handle_new_user trigger already created the row, cannot be UPDATEd
-- (no UPDATE policy). DROP + CREATE makes this safe to run on any
-- environment, any number of times.

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PostgREST schema-cache reload — the app queries via the REST layer, which
-- keeps its own cached schema. Without this, the new/updated policies (and
-- columns) may not take effect until the next automatic reload.
NOTIFY pgrst, 'reload schema';
