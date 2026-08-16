/**
 * Shared Spesen-zone reference point resolver.
 *
 * The zone calculation (calculateZone + haversineDistance) measures every lift
 * from a fixed origin. The default is Dietlikon (REFERENCE_LAT/LON), but each
 * technician can override it in the Settings (profile.home_latitude /
 * home_longitude) — e.g. someone whose base is not Dietlikon.
 *
 * Every caller (ExportPage auto-zone, background geocoding, favorites badges)
 * must go through getZoneReference() so a profile override applies everywhere.
 */

import { useAppStore } from '@/stores/appStore'
import { REFERENCE_LAT, REFERENCE_LON } from './constants'
import { calculateZone, haversineDistance } from './utils'

export function getZoneReference(): { lat: number; lon: number } {
  const profile = useAppStore.getState().profile
  const lat = profile?.home_latitude
  const lon = profile?.home_longitude
  if (typeof lat === 'number' && typeof lon === 'number' && (lat !== 0 || lon !== 0)) {
    return { lat, lon }
  }
  return { lat: REFERENCE_LAT, lon: REFERENCE_LON }
}

/**
 * Compute the OTIS Spesen zone for a coordinate pair against the current
 * reference point (profile override or Dietlikon default).
 *
 * Single shared zone-from-coordinates helper — every caller (Export page,
 * Settings lift list, background geocoding, favorites badges) must go through
 * this so the zone thresholds (10/30/60 km) and the reference point stay in
 * sync everywhere.
 */
export function zoneForCoordinates(latitude: number, longitude: number): number {
  const ref = getZoneReference()
  return calculateZone(haversineDistance(ref.lat, ref.lon, latitude, longitude))
}

/**
 * Resolve a lift's trustworthy zone from a location/favorite row using the
 * single shared rule used everywhere a zone is displayed or persisted:
 *
 *   1. a manual override always wins
 *   2. otherwise recompute from the geocoded coordinates + current reference
 *   3. otherwise the row's stored zone (may be 0 = unknown)
 *   4. when there is no row at all, the caller's `fallback` value
 *
 * A stale stored zone must never win over coordinates — callers pass their own
 * last-resort value (e.g. an entry's frozen location_zone) as `fallback`.
 */
export function resolveLiftZone(
  src?: {
    manual_zone?: number
    zone?: number
    latitude?: number
    longitude?: number
  } | null,
  fallback = 0,
): number {
  if (!src) return fallback
  if (src.manual_zone !== undefined && src.manual_zone > 0) return src.manual_zone
  if (Number(src.latitude) && Number(src.longitude)) {
    return zoneForCoordinates(Number(src.latitude), Number(src.longitude))
  }
  return src.zone ?? fallback
}
