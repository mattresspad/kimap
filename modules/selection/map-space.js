export const MAP_WIDTH = 8192;
export const MAP_HEIGHT = 8192;
export const KENSHI_MIN_COORD = -147456;
export const KENSHI_MAX_COORD = 147455;
export const MAP_MIN_ZOOM = -4;
export const MAP_MAX_ZOOM = 2;

export function isKenshiPointInBounds(point) {
  return (
    Number.isFinite(point?.x) &&
    Number.isFinite(point?.z) &&
    point.x >= KENSHI_MIN_COORD &&
    point.x <= KENSHI_MAX_COORD &&
    point.z >= KENSHI_MIN_COORD &&
    point.z <= KENSHI_MAX_COORD
  );
}

export function kenshiToLeaflet(point) {
  if (!isKenshiPointInBounds(point)) return null;
  const worldSize = KENSHI_MAX_COORD - KENSHI_MIN_COORD;
  const percentX = (point.x - KENSHI_MIN_COORD) / worldSize;
  const percentZ = (point.z - KENSHI_MIN_COORD) / worldSize;
  return Object.freeze({
    lat: MAP_HEIGHT * (1 - percentZ),
    lng: MAP_WIDTH * percentX
  });
}

export function leafletToKenshi(latLng) {
  if (!Number.isFinite(latLng?.lat) || !Number.isFinite(latLng?.lng)) return null;
  const worldSize = KENSHI_MAX_COORD - KENSHI_MIN_COORD;
  return Object.freeze({
    x: (latLng.lng / MAP_WIDTH) * worldSize + KENSHI_MIN_COORD,
    z: ((MAP_HEIGHT - latLng.lat) / MAP_HEIGHT) * worldSize + KENSHI_MIN_COORD
  });
}
