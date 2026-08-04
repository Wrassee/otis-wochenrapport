/**
 * Driving-distance service using the free OSRM public demo server.
 * No API key required. Returns the REAL driven distance between two
 * coordinates (road route), which the Z4/Z5 km allowance is based on —
 * the zone trigger itself stays straight-line (>60 km), but the
 * reimbursement is per actually-driven km (e.g. 68 km straight-line →
 * ~114 km driven one way → 228 km round trip → 22.80 CHF).
 *
 * Falls back to null when offline / route unavailable, so callers can
 * degrade to a straight-line estimate.
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Real driven (road) distance between two points via OSRM. Returns null when
 * the request fails or no route is found (e.g. offline) — never throws.
 */
export async function getDrivingDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): Promise<number | null> {
  if (
    !isFinite(lat1) ||
    !isFinite(lon1) ||
    !isFinite(lat2) ||
    !isFinite(lon2) ||
    (lat1 === 0 && lon1 === 0) ||
    (lat2 === 0 && lon2 === 0)
  ) {
    return null
  }

  try {
    // OSRM expects lon,lat pairs.
    const coords = `${lon1},${lat1};${lon2},${lat2}`
    const url = `${OSRM_BASE}/${coords}?overview=false&steps=false`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      console.warn(`OSRM routing failed: ${response.status} ${response.statusText}`)
      return null
    }
    const data = await response.json()
    if (data?.code !== 'Ok' || !data.routes?.length) return null
    const route = data.routes[0]
    const meters = Number(route.distance)
    if (!isFinite(meters) || meters <= 0) return null
    return meters / 1000
  } catch (err) {
    // Offline or timeout → caller falls back to straight-line estimate.
    console.warn('Driving distance unavailable:', err)
    return null
  }
}
