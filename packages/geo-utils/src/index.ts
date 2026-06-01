/**
 * @radius/geo-utils
 * Shared geospatial utility functions used by backend, web, and mobile.
 */

const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Haversine great-circle distance in meters between two points.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);

  const hav =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

/**
 * Returns distance in kilometers.
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  return distanceMeters(a, b) / 1000;
}

/**
 * Returns true if `point` is within `radiusKm` of `center`.
 */
export function isWithinRadius(center: LatLng, point: LatLng, radiusKm: number): boolean {
  return distanceKm(center, point) <= radiusKm;
}

/**
 * Compute a bounding box (min/max lat/lng) for a center + radius.
 * Useful for approximate pre-filtering before precise haversine checks.
 */
export function boundingBox(
  center: LatLng,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = (radiusKm / (EARTH_RADIUS_M / 1000)) * (180 / Math.PI);
  const lngDelta = latDelta / Math.cos(toRad(center.lat));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/**
 * Format distance for display, auto-selecting m or km.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Convert GeoJSON [lng, lat] coordinates to LatLng.
 */
export function fromGeoJSON(coordinates: [number, number]): LatLng {
  return { lat: coordinates[1], lng: coordinates[0] };
}

/**
 * Convert LatLng to GeoJSON [lng, lat] coordinates.
 */
export function toGeoJSON(point: LatLng): [number, number] {
  return [point.lng, point.lat];
}

/**
 * Compute approximate signal strength (0–4 bars) based on distance vs radius.
 */
export function signalStrength(distanceKmVal: number, radiusKm: number): 0 | 1 | 2 | 3 | 4 {
  const ratio = distanceKmVal / radiusKm;
  if (ratio > 1) return 0;
  if (ratio > 0.75) return 1;
  if (ratio > 0.5) return 2;
  if (ratio > 0.25) return 3;
  return 4;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
