/**
 * Location zone / geocoding helpers shared by the Settings page (batch zone
 * recalculation, lift add/edit) and the TimeEntryForm background geocoding.
 *
 * Geocodes an address via Nominatim (OpenStreetMap), computes the OTIS zone
 * from the distance to the Dietlikon reference point and persists the result
 * locally + queues a Supabase sync — the single reliable path so coordinates
 * and zones actually reach the cloud for every lift.
 */

import { geocodeAddress } from './geocode'
import { zoneForCoordinates } from './zoneReference'
import * as localDb from '@/db/indexeddb'
import type { Location, FavoriteLocation } from './types'

export interface ZoneGeoResult {
  latitude: number
  longitude: number
  zone: number
}

/** Minimal shape of a location/favorite for manual_zone resolution. */
interface ZoneSource {
  manual_zone?: number
  zone?: number
}

/**
 * Geocode `address`, compute the zone and persist (IndexedDB + sync queue) for
 * the given lift (and its favorite counterpart).
 *
 * A manually set `manual_zone` is always kept as an override — only the
 * coordinates get added in that case. Returns the resulting coords/zone, or
 * null when geocoding produced no result.
 */
export async function geocodeAndApplyZone(
  anlagenummer: string,
  address: string,
  current: ZoneSource | undefined,
): Promise<ZoneGeoResult | null> {
  const result = await geocodeAddress(address)
  if (!result) return null

  const computed = zoneForCoordinates(result.lat, result.lon)
  const effectiveZone = current?.manual_zone ?? computed

  await localDb.updateLocationGeo(anlagenummer, {
    latitude: result.lat,
    longitude: result.lon,
    zone: effectiveZone,
    manual_zone: current?.manual_zone,
  })

  return { latitude: result.lat, longitude: result.lon, zone: effectiveZone }
}

/** Pre-resolved coordinates + zone (e.g. from an already-run geocode). */
export interface LiftGeo {
  latitude: number
  longitude: number
  zone: number
}

export interface EnsureLiftRowOptions {
  /** Persist these coordinates instead of a 0/0/0 placeholder row. */
  geo?: LiftGeo
  /** Background-geocode the address after the row exists (fire-and-forget). */
  geocode?: boolean
}

/**
 * Create or update a lift row (locations store + favorites), deduplicated by
 * Anlagenummer against IndexedDB — never the caller's render closure, which
 * can be stale and would otherwise create duplicate rows. Shared by the
 * TimeEntryForm manual-lift save, the ExportPage zone heal and the wizard's
 * per-lift persist, which all used to re-implement the same sequence:
 *
 *   1. find the lift in IndexedDB
 *   2. update (project/address) or create a `manual_` location row
 *   3. upsert the favorites row with the best available coords/zone
 *   4. optionally geocode the address in the background so coordinates reach
 *      the DB + cloud (a manual_zone override is always kept)
 *
 * Returns the persisted location (for store-mirror updates) and the geocoded
 * result when the `geocode` option ran successfully.
 */
export async function ensureLiftRow(
  anlagenummer: string,
  projectId: string,
  address: string,
  options: EnsureLiftRowOptions = {},
): Promise<{ location: Location | null; geocoded: ZoneGeoResult | null }> {
  const key = anlagenummer.trim().toUpperCase()
  const addr = address.trim()
  // A bare number with neither project nor address is a partial-save artifact
  // (e.g. the form's debounced auto-save catching a half-typed number) — never
  // create a useless location row for it. The wizard and export heal already
  // require an address before persisting.
  if (!key || (!addr && !projectId.trim())) return { location: null, geocoded: null }

  // Dedup against IndexedDB, not the caller's (potentially stale) store slice.
  const all = await localDb.getAllLocations()
  const existing = all.find((l) => l.anlagenummer.toUpperCase() === key)

  let location: Location
  if (existing) {
    // updateLocationDetails also mirrors the change into the favorites store.
    await localDb.updateLocationDetails(key, { project_id: projectId, full_address: addr })
    location = { ...existing, project_id: projectId, full_address: addr }
  } else {
    location = {
      id: `manual_${key}_${Date.now()}`,
      anlagenummer: key,
      project_id: projectId,
      full_address: addr,
      latitude: options.geo?.latitude ?? 0,
      longitude: options.geo?.longitude ?? 0,
      zone: options.geo?.zone ?? 0,
      created_at: new Date().toISOString(),
    }
    await localDb.cacheLocations([location])
  }

  // Upsert the favorite with the best available coords/zone. A manual zone
  // override always wins; otherwise prefer the caller's fresh geocode, then
  // the stored zone.
  await localDb.addFavoriteLocation({
    anlagenummer: key,
    project_id: projectId,
    full_address: addr,
    latitude: options.geo?.latitude ?? existing?.latitude ?? 0,
    longitude: options.geo?.longitude ?? existing?.longitude ?? 0,
    zone: existing?.manual_zone ?? options.geo?.zone ?? existing?.zone ?? 0,
    manual_zone: existing?.manual_zone,
  })

  // Background geocode (fire-and-forget): the caller never awaits the network;
  // coordinates land in the DB + sync queue (and the favorite, mirroring the
  // legacy TimeEntryForm background-geocode path).
  let geocoded: ZoneGeoResult | null = null
  if (options.geocode && addr && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      geocoded = await geocodeAndApplyZone(key, addr, location)
      if (geocoded) {
        await localDb.addFavoriteLocation({
          anlagenummer: key,
          project_id: projectId,
          full_address: addr,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          zone: geocoded.zone,
          manual_zone: existing?.manual_zone,
        })
      }
    } catch (err) {
      console.warn('Background lift geocode failed for', key, err)
      geocoded = null
    }
  }

  return { location, geocoded }
}

/**
 * Collect every lift whose zone is not trustworthy: no manual override and
 * (no geocoded coordinates OR the stored zone does not match the zone
 * recomputed from those coordinates). Lifts without coordinates can carry a
 * misleading defaulted zone (e.g. Z1) that was never actually computed from a
 * distance — and lifts WITH coordinates can carry a stale zone from the old
 * Z0→Z1 default. Both must be recalculated, otherwise a lift like H2957
 * (Hausen am Albis ≈ 20 km → Z2) would stay stuck on the wrong Z1 forever.
 */
export function locationsMissingZone(
  locations: (Location | FavoriteLocation)[],
): (Location | FavoriteLocation)[] {
  return locations.filter((l) => {
    if (l.manual_zone !== undefined) return false
    if (!Number(l.latitude) || !Number(l.longitude)) return true
    // Has coordinates → recompute and compare, never trust the stored zone.
    const computed = zoneForCoordinates(Number(l.latitude), Number(l.longitude))
    return Number(l.zone) !== computed
  })
}
