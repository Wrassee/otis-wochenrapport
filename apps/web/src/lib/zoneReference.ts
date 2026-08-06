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
