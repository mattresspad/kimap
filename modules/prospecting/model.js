import { CORE_VOID_AREA_ID } from "../political/area-index.js";

export const NUMERIC_CRITERIA = Object.freeze(
  [
    ["arid", "Arid", "fertility", "%"],
    ["green", "Green", "fertility", "%"],
    ["swamp", "Swamp", "fertility", "%"],
    ["copper", "Copper", "resources", "×"],
    ["iron", "Iron", "resources", "×"],
    ["stone", "Stone", "resources", "×"],
    ["water", "Water multiplier", "resources", "×"]
  ].map(([id, label, group, unit]) => Object.freeze({ id, label, group, unit }))
);

export const CONDITION_CRITERIA = Object.freeze(
  [
    ["acidGround", "Acidic Ground"],
    ["acidWater", "Acidic Water"],
    ["gas", "Gas"],
    ["acidRain", "Acid Rain"],
    ["duststorm", "Duststorm"],
    ["burning", "Burning"]
  ].map(([id, label]) => Object.freeze({ id, label }))
);

const numericById = new Map(NUMERIC_CRITERIA.map((criterion) => [criterion.id, criterion]));
const conditionById = new Map(CONDITION_CRITERIA.map((criterion) => [criterion.id, criterion]));
const GOLD = Object.freeze([226, 174, 57]);
const CAUTION_GOLD = Object.freeze([241, 196, 83]);

function knownReading(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function resourceReading(area, criterion) {
  const group = criterion.group === "fertility" ? "fertility" : "multipliers";
  return area.resources[group][criterion.id];
}

function unavailableCatalog(reason) {
  return Object.freeze({
    available: false,
    reason,
    areas: Object.freeze([]),
    byId: Object.freeze({}),
    maxima: Object.freeze(Object.fromEntries(NUMERIC_CRITERIA.map(({ id }) => [id, 0])))
  });
}

/** Exact-area environmental facts. Raster geography is optional and never gates list eligibility. */
export function createProspectingCatalog({ projection, areaIndex } = {}) {
  if (!Array.isArray(projection?.areas)) return unavailableCatalog("environment-data-unavailable");

  const maxima = Object.fromEntries(NUMERIC_CRITERIA.map(({ id }) => [id, 0]));
  const areas = projection.areas
    .filter(({ id }) => typeof id === "string" && id !== CORE_VOID_AREA_ID)
    .map((area) => {
      const fertility = {};
      const multipliers = {};
      for (const criterion of NUMERIC_CRITERIA) {
        const reading = knownReading(
          area.resources?.[criterion.group === "fertility" ? "fertility" : "multipliers"]?.[
            criterion.id
          ]
        );
        const destination = criterion.group === "fertility" ? fertility : multipliers;
        destination[criterion.id] = reading;
        if (reading !== null) maxima[criterion.id] = Math.max(maxima[criterion.id], reading);
      }

      const statesByLabel = new Map(
        (area.environment?.conditions ?? []).map(({ label, state }) => [label, state])
      );
      const conditions = Object.freeze(
        CONDITION_CRITERIA.map(({ id, label }) =>
          Object.freeze({ id, label, state: statesByLabel.get(label) ?? "unavailable" })
        )
      );
      const geometry = areaIndex?.available ? areaIndex.getGeometryForAreaId(area.id) : null;
      const mapStatus = !areaIndex?.available
        ? "geography-unavailable"
        : !geometry || geometry.cellCount === 0
          ? "unmapped"
          : geometry.ambiguous
            ? "shared"
            : "mapped";

      return Object.freeze({
        id: area.id,
        name: area.name || area.id,
        resources: Object.freeze({
          fertility: Object.freeze(fertility),
          multipliers: Object.freeze(multipliers)
        }),
        conditions,
        resourceStatus: area.resources?.status ?? "unavailable",
        weatherSourceState: area.environment?.weatherSourceState ?? "unavailable",
        unresolvedWeather: (area.environment?.unresolved?.length ?? 0) > 0,
        geometryKey: geometry?.cellCount ? geometry.key : null,
        mapStatus
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  return Object.freeze({
    available: true,
    reason: null,
    areas: Object.freeze(areas),
    byId: Object.freeze(Object.fromEntries(areas.map((area) => [area.id, area]))),
    maxima: Object.freeze(maxima)
  });
}

function normalizeIds(input, index) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((id) => index.has(id)))];
}

function numericState(area, id, minimums) {
  const criterion = numericById.get(id);
  const value = resourceReading(area, criterion);
  if (value === null) return "unavailable";
  const minimum = Number.isFinite(minimums?.[id]) && minimums[id] > 0 ? minimums[id] : 0;
  return value > 0 && value >= minimum ? "match" : "mismatch";
}

function conditionState(area, id) {
  const state = area.conditions.find((condition) => condition.id === id)?.state;
  if (state === "recorded") return "match";
  if (state === "not-recorded") return "mismatch";
  return "unavailable";
}

/** AND matching against raw authored values; uncertain evidence remains out of confirmed results. */
export function projectProspecting({
  catalog,
  selectedNumeric = [],
  minimums = {},
  selectedConditions = []
} = {}) {
  if (!catalog?.available) {
    return Object.freeze({
      available: false,
      reason: catalog?.reason ?? "environment-data-unavailable",
      areas: Object.freeze([]),
      matchingAreaIds: Object.freeze([]),
      uncertainCount: 0,
      criteriaCount: 0
    });
  }

  const numerics = normalizeIds(selectedNumeric, numericById);
  const conditions = normalizeIds(selectedConditions, conditionById);
  const criteriaCount = numerics.length + conditions.length;
  const areas = [];
  let uncertainCount = 0;
  if (criteriaCount > 0) {
    for (const area of catalog.areas) {
      const states = [
        ...numerics.map((id) => numericState(area, id, minimums)),
        ...conditions.map((id) => conditionState(area, id))
      ];
      if (states.includes("mismatch")) continue;
      if (states.includes("unavailable")) {
        uncertainCount += 1;
        continue;
      }
      const matchingReadings = Object.freeze([
        ...numerics.map((id) => {
          const criterion = numericById.get(id);
          return Object.freeze({
            id,
            label: criterion.label,
            unit: criterion.unit,
            raw: resourceReading(area, criterion)
          });
        }),
        ...conditions.map((id) => {
          const criterion = conditionById.get(id);
          return Object.freeze({ id, label: criterion.label, state: "recorded" });
        })
      ]);
      areas.push(Object.freeze({ ...area, matchingReadings }));
    }
  }

  return Object.freeze({
    available: true,
    reason: null,
    areas: Object.freeze(areas),
    matchingAreaIds: Object.freeze(areas.map(({ id }) => id)),
    uncertainCount,
    criteriaCount
  });
}

function unavailableRaster(reason) {
  return Object.freeze({
    available: false,
    reason,
    width: 0,
    height: 0,
    statusCounts: Object.freeze({ solid: 0, caution: 0 }),
    cautionAreaIds: Object.freeze([]),
    copyRgba: () => new Uint8ClampedArray()
  });
}

/** Passive gold highlight. Mixed raster identities hatch instead of claiming an exact match. */
export function createProspectingRaster({ areaIndex, matches } = {}) {
  if (!areaIndex?.available) return unavailableRaster("raster-geography-unavailable");
  if (!matches?.available) return unavailableRaster(matches?.reason ?? "prospecting-unavailable");

  const selected = new Set(matches.matchingAreaIds);
  const statusesByColor = new Map();
  const statusCounts = { solid: 0, caution: 0 };
  const cautionAreaIds = new Set();
  for (const geometry of areaIndex.geometries) {
    if (!geometry.cellCount || !geometry.areaIds.some((id) => selected.has(id))) continue;
    const status = geometry.areaIds.every((id) => selected.has(id)) ? "solid" : "caution";
    statusesByColor.set(geometry.colorIndex, status);
    statusCounts[status] += 1;
    if (status === "caution") {
      for (const id of geometry.areaIds) if (selected.has(id)) cautionAreaIds.add(id);
    }
  }

  const width = areaIndex.width;
  const height = areaIndex.height;
  const pixels = new Uint8ClampedArray(width * height * 4);
  if (statusesByColor.size > 0) {
    const colors = areaIndex.copyColorIndexes();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const flatIndex = y * width + x;
        const status = statusesByColor.get(colors[flatIndex]);
        if (!status || (status === "caution" && (x + y) % 6 > 1)) continue;
        const offset = flatIndex * 4;
        const color = status === "solid" ? GOLD : CAUTION_GOLD;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = status === "solid" ? 174 : 229;
      }
    }
  }

  return Object.freeze({
    available: true,
    reason: null,
    width,
    height,
    statusCounts: Object.freeze(statusCounts),
    cautionAreaIds: Object.freeze([...cautionAreaIds].sort()),
    copyRgba: () => new Uint8ClampedArray(pixels)
  });
}
