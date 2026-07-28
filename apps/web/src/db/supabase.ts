import { createClient } from '@supabase/supabase-js'

// These will be replaced with actual values when Supabase is configured
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/**
 * Get current user session
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Get user profile
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

/**
 * Upsert user profile
 */
export async function upsertProfile(profile: {
  id: string
  email: string
  full_name: string
  personnel_number: string
  supervisor_email: string
  language?: string
}) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Get all locations (elevators) for autocomplete
 */
export async function getLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('anlagenummer')
  if (error) throw error
  return data || []
}

/**
 * Get time entries for a specific week
 */
export async function getWeekEntries(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      locations!inner(anlagenummer, project_id, full_address, zone)
    `)
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time')
  if (error) throw error
  return data || []
}

/**
 * Sync entries to Supabase (used by background sync)
 */
export async function syncEntries(entries: any[]) {
  const { data, error } = await supabase
    .from('time_entries')
    .upsert(entries, { onConflict: 'id' })
    .select()
  if (error) throw error
  return data
}

/**
 * Delete a time entry from server
 */
export async function deleteEntry(entryId: string) {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', entryId)
  if (error) throw error
}

/**
 * Upsert a location (elevator) — syncs manual additions/edits to the cloud.
 * Uses anlagenummer as the conflict key so the same lift keeps one row.
 */
export async function upsertLocation(location: {
  id: string
  anlagenummer: string
  project_id: string
  full_address: string
  latitude: number
  longitude: number
  zone: number
  manual_zone?: number
}) {
  const { data, error } = await supabase
    .from('locations')
    .upsert(location, { onConflict: 'anlagenummer' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a location from server by anlagenummer.
 */
export async function deleteLocationByAnlagenummer(anlagenummer: string) {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('anlagenummer', anlagenummer)
  if (error) throw error
}

/**
 * Upsert a favorite (recently used) location for the current user.
 * Uses anlagenummer as the conflict key so each lift keeps one row.
 */
export async function upsertFavorite(favorite: {
  user_id: string
  anlagenummer: string
  project_id: string
  full_address: string
  latitude: number
  longitude: number
  zone: number
  manual_zone?: number
  use_count: number
}) {
  const { data, error } = await supabase
    .from('user_favorites')
    .upsert(favorite, { onConflict: 'user_id,anlagenummer' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Get all favorites for a user.
 */
export async function getFavorites(userId: string) {
  const { data, error } = await supabase
    .from('user_favorites')
    .select('*')
    .eq('user_id', userId)
    .order('last_used', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Delete a favorite by user_id and anlagenummer.
 */
export async function deleteFavorite(userId: string, anlagenummer: string) {
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('anlagenummer', anlagenummer)
  if (error) throw error
}

/**
 * Sync daily expenses to Supabase: delete all for the user's tracked dates,
 * then insert fresh records. This is a full-replace strategy — simpler than
 * per-row upserts and avoids stale-data issues.
 */
export async function syncExpensesToSupabase(
  userId: string,
  expenses: Array<{ date: string; expense_type: string; value: number }>,
): Promise<void> {
  if (expenses.length === 0) return

  // Collect all distinct dates involved
  const dates = [...new Set(expenses.map((e) => e.date))]

  // Delete all existing rows for those dates
  await supabase
    .from('daily_expenses')
    .delete()
    .eq('user_id', userId)
    .in('date', dates)

  // Insert fresh rows
  const rows = expenses.map((e) => ({
    user_id: userId,
    date: e.date,
    expense_type: e.expense_type,
    value: e.value,
  }))

  const { error } = await supabase
    .from('daily_expenses')
    .insert(rows)
  if (error) throw error
}

/**
 * Get all expenses for a user, optionally filtered by date range.
 */
export async function getExpenses(
  userId: string,
  startDate?: string,
  endDate?: string,
): Promise<Array<{ date: string; expense_type: string; value: number }>> {
  let query = supabase
    .from('daily_expenses')
    .select('date, expense_type, value')
    .eq('user_id', userId)

  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query.order('date')
  if (error) throw error
  return data || []
}
