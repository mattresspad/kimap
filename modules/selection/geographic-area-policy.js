/** Owner-confirmed unused records. Applies to exact identities in every manifest, never names. */
export const UNUSED_GEOGRAPHIC_AREA_IDS = Object.freeze(["51405-Newwworld.mod"]);

export function isGeographicArea(id) {
  return !UNUSED_GEOGRAPHIC_AREA_IDS.includes(id);
}

/** Legacy single-area readers retain their existing policy for other shared colors. */
export function createGeographicColorMap(spawnAreas = []) {
  const result = new Map();
  for (const area of spawnAreas) {
    if (!isGeographicArea(area.StringId) || area.Values?.index === undefined) continue;
    const index = area.Values.index;
    result.set(`${(index >> 16) & 255},${(index >> 8) & 255},${index & 255}`, area);
  }
  return result;
}
