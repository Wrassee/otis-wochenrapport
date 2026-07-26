/**
 * Geocoding service using OpenStreetMap Nominatim API.
 * Free to use, no API key required.
 * Usage policy: max 1 request per second, meaningful User-Agent required.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'OTISWochenrapport/1.0 (liftrapport@example.com)'

/** Rate limiter: ensure at most 1 request per second */
let lastRequestTime = 0

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed))
  }
  lastRequestTime = Date.now()
}

export interface GeocodeResult {
  lat: number
  lon: number
  displayName: string
}

/**
 * Geocode an address using OpenStreetMap Nominatim API.
 * Returns null if geocoding fails or no results found.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  if (!address || address.length < 5) {
    return null
  }

  try {
    await rateLimit()

    const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn(`Nominatim geocoding failed: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return null
    }

    const result = data[0]
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)

    if (isNaN(lat) || isNaN(lon)) {
      return null
    }

    return {
      lat,
      lon,
      displayName: result.display_name || address,
    }
  } catch (err) {
    console.warn('Geocoding error:', err)
    return null
  }
}


