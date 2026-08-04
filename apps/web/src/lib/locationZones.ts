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
import { calculateZone, haversineDistance } from './utils'
import { getZoneReference } from './zoneReference'
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

  const ref = getZoneReference()
  const distance = haversineDistance(ref.lat, ref.lon, result.lat, result.lon)
  const computed = calculateZone(distance)
  const effectiveZone = current?.manual_zone ?? computed

  await localDb.updateLocationGeo(anlagenummer, {
    latitude: result.lat,
    longitude: result.lon,
    zone: effectiveZone,
    manual_zone: current?.manual_zone,
  })

  return { latitude: result.lat, longitude: result.lon, zone: effectiveZone }
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
  const ref = getZoneReference()
  return locations.filter((l) => {
    if (l.manual_zone !== undefined) return false
    if (!Number(l.latitude) || !Number(l.longitude)) return true
    // Has coordinates → recompute and compare, never trust the stored zone.
    const computed = calculateZone(
      haversineDistance(ref.lat, ref.lon, Number(l.latitude), Number(l.longitude)),
    )
    return Number(l.zone) !== computed
  })
}
