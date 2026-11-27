const FILTERED_COLOR = Object.freeze([89, 97, 106]);
const UNATTRIBUTED_COLOR = Object.freeze([139, 145, 151]);
const DISPUTED_NEUTRAL = Object.freeze([104, 111, 120]);
const INDETERMINATE_COLOR = Object.freeze([214, 165, 74]);

function colorKeyFromIndex(value) {
  return `${String((value >> 16) & 0xff)},${String((value >> 8) & 0xff)},${String(value & 0xff)}`;
}

function hexToRgb(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/iu.test(value)) return null;
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function writePixel(pixels, offset, color, alpha = 255) {
  if (!color || alpha <= 0) return;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = alpha;
}

function disputedColors(area, colorsByFactionId) {
  const colors = area.contributions.slice(0, 2).map((contribution) => {
    if (!contribution.participant || !contribution.factionId) return DISPUTED_NEUTRAL;
    return hexToRgb(colorsByFactionId[contribution.factionId]) ?? DISPUTED_NEUTRAL;
  });
  while (colors.length < 2) colors.push(DISPUTED_NEUTRAL);
  return colors;
}

function paintOutcome(pixels, offset, x, y, area, colorsByFactionId) {
  if (!area || area.status === "noEvidence" || area.status === "excluded") return;
  if (area.status === "dominant") {
    writePixel(pixels, offset, hexToRgb(colorsByFactionId[area.winnerId]) ?? INDETERMINATE_COLOR);
    return;
  }
  if (area.status === "disputed") {
    const colors = disputedColors(area, colorsByFactionId);
    writePixel(pixels, offset, colors[positiveModulo(x + y, 4) < 2 ? 0 : 1]);
    return;
  }
  if (area.status === "filtered") {
    if (positiveModulo(x - y, 4) < 2) writePixel(pixels, offset, FILTERED_COLOR, 224);
    return;
  }
  if (area.status === "unattributed") {
    if ((x & 1) === (y & 1)) writePixel(pixels, offset, UNATTRIBUTED_COLOR, 220);
    return;
  }
  if (positiveModulo(x + y, 4) === 0 || positiveModulo(x - y, 4) === 0) {
    writePixel(pixels, offset, INDETERMINATE_COLOR, 232);
  }
}

/** Creates a DOM-independent, caller-copyable RGBA political surface. */
export function createPoliticalRasterProjection({ areaIndex, influence, colorsByFactionId } = {}) {
  if (!areaIndex?.available || !influence?.available) {
    return Object.freeze({
      available: false,
      reason: !areaIndex?.available ? "raster-geography-unavailable" : influence?.reason,
      width: 0,
      height: 0,
      statusCounts: Object.freeze({}),
      copyRgba: () => new Uint8ClampedArray()
    });
  }
  if (!colorsByFactionId || typeof colorsByFactionId !== "object") {
    throw new TypeError("colorsByFactionId must be an object keyed by stable faction ID.");
  }

  const colorIndexes = areaIndex.copyColorIndexes();
  const areaByKey = new Map(influence.areas.map((area) => [area.geometryKey, area]));
  const pixels = new Uint8ClampedArray(areaIndex.width * areaIndex.height * 4);
  for (let y = 0; y < areaIndex.height; y += 1) {
    for (let x = 0; x < areaIndex.width; x += 1) {
      const flatIndex = y * areaIndex.width + x;
      const area = areaByKey.get(colorKeyFromIndex(colorIndexes[flatIndex]));
      paintOutcome(pixels, flatIndex * 4, x, y, area, colorsByFactionId);
    }
  }

  const statusCounts = {};
  for (const area of influence.areas) {
    statusCounts[area.status] = (statusCounts[area.status] ?? 0) + 1;
  }

  return Object.freeze({
    available: true,
    reason: null,
    width: areaIndex.width,
    height: areaIndex.height,
    statusCounts: Object.freeze(statusCounts),
    copyRgba: () => new Uint8ClampedArray(pixels)
  });
}

export const POLITICAL_OUTCOME_COLORS = Object.freeze({
  filtered: Object.freeze([...FILTERED_COLOR]),
  unattributed: Object.freeze([...UNATTRIBUTED_COLOR]),
  disputedNeutral: Object.freeze([...DISPUTED_NEUTRAL]),
  indeterminate: Object.freeze([...INDETERMINATE_COLOR])
});
