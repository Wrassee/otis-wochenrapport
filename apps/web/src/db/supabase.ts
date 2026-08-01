import { createClient } from '@supabase/supabase-js'
import { isValidUuid, uuidFromString } from '@/lib/utils'

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
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
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
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single()
  if (error) throw error
  return data
}

/**
 * Update the user's preferred language on their Supabase profile.
 * Used by setLanguage (immediate push when online) and the background sync
 * queue (language_sync — retried later when connectivity returns).
 */
export async function updateProfileLanguage(userId: string, language: string) {
  const { error } = await supabase.from('profiles').update({ language }).eq('id', userId)
  if (error) throw error
}

/**
 * Get all locations (elevators) for autocomplete
 */
export async function getLocations() {
  const { data, error } = await supabase.from('locations').select('*').order('anlagenummer')
  if (error) throw error
  return data || []
}

/**
 * Get time entries for a specific week
 */
export async function getWeekEntries(userId: string, startDate: string, endDate: string) {
  // Use LEFT join so entries without a location (manual entries, deleted locations)
  // are still returned — location fields will be null.
  const { data, error } = await supabase
    .from('time_entries')
    .select(
      `
      *,
      locations!left(anlagenummer, project_id, full_address, zone)
    `,
    )
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time')
  if (error) throw error
  return data || []
}

/**
 * The exact columns of the `time_entries` table. Local TimeEntry objects also
 * carry denormalized joined fields (location_anlagenummer, location_address,
 * …) used for display — sending those to PostgREST fails the whole upsert
 * with PGRST204 ("Could not find the 'location_anlagenummer' column of
 * 'time_entries'"), which silently killed the mobile→cloud push.
 */
const TIME_ENTRY_COLUMNS = [
  'id',
  'user_id',
  'date',
  'start_time',
  'duration',
  'location_id',
  'activity_code_id',
  'activity_code',
  'is_lunch',
  'notes',
  'synced',
  'created_at',
  'updated_at',
] as const

/**
 * Sync entries to Supabase (used by background sync). Only the table's own
 * columns are sent — denormalized display fields are stripped so the upsert
 * never fails with PGRST204.
 *
 * Rows are upserted one-by-one (not as a single batch) so one bad row
 * (e.g. an FK that references a location not yet on the server) can never
 * kill the whole week's sync — the remaining rows still reach the cloud and
 * the failed row is simply retried on the next sync.
 *
 * @param userId Optional — when given, only rows belonging to this user are
 *   sent. Local IndexedDB may hold rows from a previous account; sending
 *   those would fail the RLS check and abort the entire upsert.
 */
export async function syncEntries(entries: any[], userId?: string) {
  const scoped = userId ? entries.filter((e) => e.user_id === userId) : entries
  const synced: any[] = []
  for (const entry of scoped) {
    const row: Record<string, unknown> = {}
    for (const col of TIME_ENTRY_COLUMNS) {
      if (entry[col] !== undefined) row[col] = entry[col]
    }
    // Guard: the cloud column is `UUID NOT NULL REFERENCES locations(id)` — a
    // non-UUID id (manual_…, anlagenummer) would fail the whole upsert with
    // 22P02. The caller remaps to a real cloud UUID when the referenced lift
    // can be synced; otherwise fall back to null so the entry still reaches
    // the cloud.
    if (row.location_id !== null && !isValidUuid(row.location_id)) {
      row.location_id = null
    }
    // Try once with the real location reference; only on a genuine foreign-key
    // violation (23503 — the referenced lift is missing from the cloud
    // locations table) retry once with location_id nulled so the entry still
    // reaches the cloud. Transient errors are left to the next sync instead of
    // silently downgrading the entry to a lift-less row.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase
          .from('time_entries')
          .upsert(row, { onConflict: 'id' })
          .select()
        if (error) throw error
        if (data?.length) synced.push(data[0])
        break
      } catch (e) {
        const code = (e as any)?.code
        if (attempt === 0 && row.location_id != null && code === '23503') {
          row.location_id = null
          continue
        }
        console.warn('Entry sync skipped (will retry later):', row.id, e)
        break
      }
    }
  }
  return synced
}

/**
 * Delete a time entry from server
 */
export async function deleteEntry(entryId: string) {
  const { error } = await supabase.from('time_entries').delete().eq('id', entryId)
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
  // Manual/offline lifts have non-UUID ids (`manual_…`, anlagenummer) but the
  // cloud `locations.id` column is UUID. Derive a stable UUID from the
  // anlagenummer so the same lift always maps to the same cloud row across
  // devices (the upsert key is anlagenummer, so repeated syncs are idempotent).
  const id = isValidUuid(location.id) ? location.id : uuidFromString(location.anlagenummer)
  const { data, error } = await supabase
    .from('locations')
    .upsert({ ...location, id }, { onConflict: 'anlagenummer' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a location from server by anlagenummer.
 */
export async function deleteLocationByAnlagenummer(anlagenummer: string) {
  const { error } = await supabase.from('locations').delete().eq('anlagenummer', anlagenummer)
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
  await supabase.from('daily_expenses').delete().eq('user_id', userId).in('date', dates)

  // Insert fresh rows
  const rows = expenses.map((e) => ({
    user_id: userId,
    date: e.date,
    expense_type: e.expense_type,
    value: e.value,
  }))

  const { error } = await supabase.from('daily_expenses').insert(rows)
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

/**
 * Upsert an expense receipt photo (Spesen Beleg).
 * id is the local-generated id, so re-syncing the same photo overwrites it.
 */
export async function upsertExpensePhoto(photo: {
  id: string
  user_id: string
  year: number
  week: number
  filename: string
  data_url: string
  note?: string
  created_at?: string
}) {
  const { data, error } = await supabase
    .from('expense_photos')
    .upsert(photo, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Get all receipt photos for a user in a given week.
 */
export async function getExpensePhotosFromSupabase(userId: string, year: number, week: number) {
  const { data, error } = await supabase
    .from('expense_photos')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('week', week)
  if (error) throw error
  return data || []
}

/**
 * Delete a receipt photo from the server.
 */
export async function deleteExpensePhotoFromSupabase(id: string) {
  const { error } = await supabase.from('expense_photos').delete().eq('id', id)
  if (error) throw error
}

/**
 * Subscribe to realtime changes on the user's expense_photos rows.
 *
 * Requires the table to be in the `supabase_realtime` publication and
 * REPLICA IDENTITY FULL (see migration 006). The channel is filtered by
 * user_id, so only this user's photos trigger the callback.
 *
 * Returns an unsubscribe function.
 */
export function subscribeExpensePhotoChanges(
  userId: string,
  onPhotoChange: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new?: Record<string, any>
    old?: Record<string, any>
  }) => void,
): () => void {
  const channel = supabase
    .channel(`expense-photos-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'expense_photos',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onPhotoChange(payload),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to realtime changes on the user's daily_expenses rows.
 *
 * Requires the table to be in the `supabase_realtime` publication and
 * REPLICA IDENTITY FULL (see migration 007). The channel is filtered by
 * user_id, so only this user's expenses trigger the callback.
 *
 * Returns an unsubscribe function.
 */
export function subscribeDailyExpenseChanges(
  userId: string,
  onExpenseChange: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new?: Record<string, any>
    old?: Record<string, any>
  }) => void,
): () => void {
  const channel = supabase
    .channel(`daily-expenses-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_expenses',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onExpenseChange(payload),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to realtime changes on the user's user_favorites rows.
 *
 * Requires the table to be in the `supabase_realtime` publication and
 * REPLICA IDENTITY FULL (see migration 008). The channel is filtered by
 * user_id, so only this user's favorites trigger the callback.
 *
 * Returns an unsubscribe function.
 */
export function subscribeFavoriteChanges(
  userId: string,
  onFavoriteChange: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new?: Record<string, any>
    old?: Record<string, any>
  }) => void,
): () => void {
  const channel = supabase
    .channel(`favorites-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_favorites',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onFavoriteChange(payload),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
