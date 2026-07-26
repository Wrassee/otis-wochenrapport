"""
Zone Calculator: Calculate zone based on distance from reference point.
Reference point: Dietlikon Bahnhofstrasse 1 (47.4196, 8.6205)

Zone logic:
  <10 km  -> Zone 1
  <30 km  -> Zone 2
  <60 km  -> Zone 3
  >60 km  -> Zone 4
"""

import math

# Reference point: Dietlikon Bahnhofstrasse 1
REFERENCE_LAT = 47.4196
REFERENCE_LON = 8.6205

ZONE_THRESHOLDS = {
    1: 10,   # km
    2: 30,   # km
    3: 60,   # km
    # Zone 4: everything above 60 km
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points
    on the Earth using the Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def calculate_zone(latitude: float, longitude: float) -> int:
    """
    Calculate the zone for a given coordinate based on distance
    from the reference point (Dietlikon Bahnhofstrasse 1).

    Returns:
        1, 2, 3, or 4 depending on the distance.
    """
    distance = haversine_distance(
        REFERENCE_LAT, REFERENCE_LON,
        latitude, longitude
    )

    for zone, threshold in sorted(ZONE_THRESHOLDS.items()):
        if distance < threshold:
            return zone

    return 4  # Zone 4: >60 km


def get_zone_name(zone: int) -> str:
    """Get the human-readable zone name."""
    names = {
        1: "Zone 1",
        2: "Zone 2a",
        3: "Zone 3a",
        4: "Zone 4a",
    }
    return names.get(zone, f"Zone {zone}")


def format_distance(distance_km: float) -> str:
    """Format distance for display."""
    if distance_km < 1:
        return f"{distance_km * 1000:.0f} m"
    return f"{distance_km:.1f} km"
