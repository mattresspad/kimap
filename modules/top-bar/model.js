import { isGeographicArea } from "../selection/geographic-area-policy.js";

export const SEARCH_RESULT_LIMIT = 15;

function searchFilterGroup(id, label, kinds) {
  return Object.freeze({
    id,
    label,
    kinds: Object.freeze([...kinds])
  });
}

export const SEARCH_FILTER_GROUPS = Object.freeze([
  searchFilterGroup("towns", "Towns", ["town"]),
  searchFilterGroup("spawn-areas", "Spawn Areas", ["spawnArea"]),
  searchFilterGroup("characters-animals", "Characters & Animals", ["character"]),
  searchFilterGroup("squads", "Squads", ["squad"]),
  searchFilterGroup("factions", "Factions", ["faction"]),
  searchFilterGroup("nests", "Nests", ["nest"]),
  searchFilterGroup("items-equipment", "Items & Equipment", [
    "item",
    "weapon",
    "crossbow",
    "armour",
    "mapItem",
    "nestItem"
  ])
]);

export const THEATER_AVAILABILITY_POLICIES = Object.freeze({
  ALWAYS: "always",
  SCENARIO: "scenario"
});

export const THEATER_DESTINATION_GROUPS = freezeArray([
  { id: "simulation", label: "Simulation", order: 0 },
  { id: "reference", label: "Reference", order: 1 },
  { id: "workspace", label: "Workspace", order: 2 },
  { id: "utility", label: "Utility", order: 3 }
]);

export const THEATER_DESTINATIONS = freezeArray([
  destination("status", "simulation", "Global Status", 0, "global-status", "scenario"),
  destination("history", "simulation", "World History", 1, "world-history", "scenario"),
  destination("ranks", "simulation", "Faction Power Ranks", 2, "power-ranks", "scenario"),
  destination("infamy", "simulation", "Infamy Tracking", 3, "infamy", "scenario"),
  destination("overrides", "simulation", "Override Network", 4, "overrides", "scenario"),
  destination("environment", "reference", "Environment Info", 0, "environment"),
  destination("settings", "reference", "Global Constants", 1, "constants"),
  destination("browser", "reference", "Content Browser", 2, "content-browser"),
  destination("equipment", "reference", "Equipment Locker", 3, "equipment"),
  destination("research", "reference", "Research Tree", 4, "research"),
  destination("prefs", "workspace", "Scenario Documents", 0, "documents", "scenario"),
  destination("markers", "workspace", "Player Markers", 1, "markers"),
  destination("paint", "workspace", "Paint Manager", 2, "paint"),
  destination("help", "utility", "Help Guide", 0, "help")
]);

const DESTINATION_BY_ID = new Map(THEATER_DESTINATIONS.map((entry) => [entry.id, entry]));
const SEARCH_FILTER_GROUP_BY_ID = new Map(SEARCH_FILTER_GROUPS.map((entry) => [entry.id, entry]));

const AVAILABILITY_REASONS = Object.freeze({
  unknown: "Unknown theater destination.",
  scenario: "Simulation is unavailable because scenario normalization did not complete."
});

const GEOGRAPHIC_SEARCH_KINDS = new Set(["town", "spawnArea"]);
const REFERENCE_SEARCH_KINDS = new Set([
  "character",
  "squad",
  "faction",
  "nest",
  "item",
  "weapon",
  "crossbow",
  "armour",
  "mapItem",
  "nestItem"
]);

function freezeArray(values) {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })));
}

function destination(
  id,
  group,
  label,
  order,
  icon,
  availabilityPolicy = THEATER_AVAILABILITY_POLICIES.ALWAYS
) {
  return { id, group, label, order, icon, availabilityPolicy };
}

function compareText(left, right) {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareSearchRecords(left, right) {
  return (
    compareText(left.name, right.name) ||
    compareText(left.kind, right.kind) ||
    compareText(left.id, right.id)
  );
}

function databaseValues(database) {
  if (Array.isArray(database)) return database;
  if (database instanceof Map) return [...database.values()];
  if (database !== null && typeof database === "object") return Object.values(database);
  return [];
}

function recordString(record, ...keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function getMatchRank(record, query) {
  const name = record.name.toLowerCase();
  const id = record.id.toLowerCase();
  if (name === query || id === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (id.includes(query)) return 3;
  return null;
}

function normalizeResultLimit(limit) {
  if (!Number.isInteger(limit) || limit <= 0) return 0;
  return Math.min(limit, SEARCH_RESULT_LIMIT);
}

export function getTheaterDestination(id) {
  return typeof id === "string" ? (DESTINATION_BY_ID.get(id) ?? null) : null;
}

export function getTheaterDestinationAvailability(id, context = {}) {
  const destinationEntry = getTheaterDestination(id);
  if (destinationEntry === null) {
    return Object.freeze({ available: false, reason: AVAILABILITY_REASONS.unknown });
  }

  if (
    destinationEntry.availabilityPolicy === THEATER_AVAILABILITY_POLICIES.SCENARIO &&
    context.scenarioAvailable !== true
  ) {
    return Object.freeze({ available: false, reason: AVAILABILITY_REASONS.scenario });
  }

  return Object.freeze({ available: true, reason: null });
}

export function normalizeTheme(value) {
  return value === "light" ? "light" : "dark";
}

export function readAndMigrateTheme(storage, key = "kim-theme") {
  try {
    const stored = storage?.getItem?.(key);
    const normalized = normalizeTheme(stored);
    if (stored !== normalized) storage?.setItem?.(key, normalized);
    return normalized;
  } catch (_error) {
    return "dark";
  }
}

export function persistTheme(storage, theme, key = "kim-theme") {
  const normalized = normalizeTheme(theme);
  try {
    storage?.setItem?.(key, normalized);
  } catch (_error) {
    // The normalized in-memory theme remains usable when storage is unavailable.
  }
  return normalized;
}

export function getThemeTogglePresentation(theme) {
  const currentTheme = normalizeTheme(theme);
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  const actionLabel = `Switch to ${nextTheme} theme`;
  return Object.freeze({
    theme: currentTheme,
    nextTheme,
    icon: nextTheme === "light" ? "sun" : "moon",
    label: actionLabel,
    title: actionLabel,
    ariaLabel: actionLabel
  });
}

export function createSearchRecords(databases = {}) {
  if (databases === null || typeof databases !== "object" || Array.isArray(databases)) {
    return Object.freeze([]);
  }

  const candidates = [];
  for (const [rawKind, database] of Object.entries(databases)) {
    const kind = rawKind.trim();
    if (kind === "") continue;

    for (const source of databaseValues(database)) {
      const id = recordString(source, "StringId", "entityId", "id");
      const name = recordString(source, "Name", "name");
      if (id === null || name === null) continue;
      if (kind === "spawnArea" && !isGeographicArea(id)) continue;
      candidates.push(Object.freeze({ kind, id, name }));
    }
  }

  candidates.sort(compareSearchRecords);
  const byKey = new Map();
  for (const record of candidates) {
    const key = getSearchRecordKey(record);
    if (!byKey.has(key)) byKey.set(key, record);
  }
  return Object.freeze([...byKey.values()].sort(compareSearchRecords));
}

export function createSearchFilterSelection(groupIds) {
  const requestedIds =
    groupIds === undefined
      ? SEARCH_FILTER_GROUPS.map(({ id }) => id)
      : groupIds !== null &&
          typeof groupIds !== "string" &&
          typeof groupIds[Symbol.iterator] === "function"
        ? [...groupIds]
        : [];
  const requested = new Set(requestedIds);
  return Object.freeze(
    SEARCH_FILTER_GROUPS.filter(({ id }) => requested.has(id)).map(({ id }) => id)
  );
}

export function setSearchFilterGroupEnabled(selection, groupId, enabled) {
  const selected = new Set(createSearchFilterSelection(selection));
  if (!SEARCH_FILTER_GROUP_BY_ID.has(groupId)) return Object.freeze([...selected]);
  if (enabled) selected.add(groupId);
  else selected.delete(groupId);
  return createSearchFilterSelection(selected);
}

export function filterSearchRecords(records, enabledGroupIds) {
  if (!Array.isArray(records)) return Object.freeze([]);
  const enabledKinds = new Set();
  for (const groupId of createSearchFilterSelection(enabledGroupIds)) {
    for (const kind of SEARCH_FILTER_GROUP_BY_ID.get(groupId).kinds) enabledKinds.add(kind);
  }
  return Object.freeze(records.filter((record) => enabledKinds.has(record?.kind)));
}

export function searchRecords(records, query, limit = SEARCH_RESULT_LIMIT) {
  const normalizedQuery = typeof query === "string" ? query.trim().toLowerCase() : "";
  const resultLimit = normalizeResultLimit(limit);
  if (normalizedQuery === "" || resultLimit === 0 || !Array.isArray(records)) {
    return Object.freeze([]);
  }

  const matches = [];
  const seenKeys = new Set();
  for (const record of records) {
    if (
      record === null ||
      typeof record !== "object" ||
      typeof record.kind !== "string" ||
      typeof record.id !== "string" ||
      typeof record.name !== "string"
    ) {
      continue;
    }
    const key = getSearchRecordKey(record);
    if (seenKeys.has(key)) continue;
    const rank = getMatchRank(record, normalizedQuery);
    if (rank === null) continue;
    seenKeys.add(key);
    matches.push({ rank, record });
  }

  matches.sort(
    (left, right) => left.rank - right.rank || compareSearchRecords(left.record, right.record)
  );
  return Object.freeze(matches.slice(0, resultLimit).map(({ record }) => record));
}

export function getSearchRecordKey(record) {
  if (
    record === null ||
    typeof record !== "object" ||
    typeof record.kind !== "string" ||
    typeof record.id !== "string"
  ) {
    return null;
  }
  return `${record.kind}:${record.id}`;
}

export function createSearchActivationRoute(record) {
  if (
    record === null ||
    typeof record !== "object" ||
    typeof record.kind !== "string" ||
    typeof record.id !== "string" ||
    record.id.trim() === ""
  ) {
    return null;
  }
  if (GEOGRAPHIC_SEARCH_KINDS.has(record.kind)) {
    return Object.freeze({
      route: "geographic",
      entityType: record.kind,
      entityId: record.id,
      instanceId: null
    });
  }
  if (REFERENCE_SEARCH_KINDS.has(record.kind)) {
    return Object.freeze({
      route: "reference",
      entityType: record.kind,
      entityId: record.id
    });
  }
  return null;
}
