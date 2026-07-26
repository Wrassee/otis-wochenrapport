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
