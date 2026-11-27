import { deepFreeze } from "../scenario/utils.js";

export const NEST_MARKER_TOWN_TYPE = 8;

export const TOWN_TYPE_FILTERS = deepFreeze([
  { key: "1", typeId: 1, label: "Outpost" },
  { key: "2", typeId: 2, label: "Town" },
  { key: "3", typeId: 3, label: "Village" },
  { key: "4", typeId: 4, label: "Ruin" },
  { key: "5", typeId: 5, label: "Slave Camp" },
  { key: "6", typeId: 6, label: "Military Base" },
  { key: "7", typeId: 7, label: "Prison" },
  { key: "9", typeId: 9, label: "Point of Interest" },
  { key: "10", typeId: 10, label: "Location" },
  { key: "0", typeId: 0, label: "Nest" },
  { key: "unknown", typeId: null, label: "Unknown" }
]);

const FILTER_KEYS = new Set(TOWN_TYPE_FILTERS.map(({ key }) => key));

function normalizeInteger(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

export function isNestMarkerTownType(value) {
  return normalizeInteger(value) === NEST_MARKER_TOWN_TYPE;
}

/** Type 8 has separate Nests & Camps provenance and therefore has no Towns filter key. */
export function getTownTypeFilterKey(value) {
  const numeric = normalizeInteger(value);
  if (numeric === NEST_MARKER_TOWN_TYPE) return null;
  const key = numeric === null ? "unknown" : String(numeric);
  return FILTER_KEYS.has(key) ? key : "unknown";
}

export function createTownTypeFilterProjection({ occurrenceTypes = [], isEnabled } = {}) {
  if (!Array.isArray(occurrenceTypes)) {
    throw new TypeError("occurrenceTypes must be an array.");
  }
  if (typeof isEnabled !== "function") {
    throw new TypeError("Town type filters require a live enabled-state reader.");
  }

  const counts = new Map(TOWN_TYPE_FILTERS.map(({ key }) => [key, 0]));
  for (const value of occurrenceTypes) {
    const key = getTownTypeFilterKey(value);
    if (key !== null) counts.set(key, counts.get(key) + 1);
  }

  const rows = TOWN_TYPE_FILTERS.map(({ key, typeId, label }) => ({
    key,
    typeId,
    label,
    count: counts.get(key),
    enabled: Boolean(isEnabled(key))
  }));
  const enabledCount = rows.filter(({ enabled }) => enabled).length;
  const presentRows = rows.filter(({ count }) => count > 0);
  const enabledPresentCount = presentRows.filter(({ enabled }) => enabled).length;

  return deepFreeze({
    rows,
    presentRows,
    enabledCount,
    totalTypeCount: rows.length,
    allEnabled: enabledCount === rows.length,
    presentTypeCount: presentRows.length,
    enabledPresentCount,
    allPresentEnabled: enabledPresentCount === presentRows.length,
    occurrenceCount: rows.reduce((total, { count }) => total + count, 0)
  });
}
