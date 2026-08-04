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
import { REFERENCE_LAT, REFERENCE_LON } from './constants'
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

  const distance = haversineDistance(REFERENCE_LAT, REFERENCE_LON, result.lat, result.lon)
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
 * Collect every lift that still needs a zone: no manual override and no
 * positive computed zone yet. These are the Z0 lifts the export's
 * Spesenrapport currently cannot fill.
 */
export function locationsMissingZone(
  locations: (Location | FavoriteLocation)[],
): (Location | FavoriteLocation)[] {
  return locations.filter(
    (l) => l.manual_zone === undefined && !(Number(l.zone) > 0),
  )
}
