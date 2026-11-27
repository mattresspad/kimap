import { deriveBaselineKey } from "../scenario/baseline.js";
import { cloneData, deepFreeze, isRecord, stableObject } from "../scenario/utils.js";
import { SelectionError } from "./errors.js";
import { isGeographicArea } from "./geographic-area-policy.js";
import { createOverrideConnectivity } from "./override-connectivity.js";

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SelectionError("invalid_selection_catalog", `${label} must be a non-empty string.`);
  }
  return value;
}

function createIndex(records, label, idField) {
  if (!Array.isArray(records)) {
    throw new SelectionError("invalid_selection_catalog", `${label} must be an array.`);
  }
  const index = new Map();
  for (const record of records) {
    if (!isRecord(record)) {
      throw new SelectionError("invalid_selection_catalog", `${label} entries must be objects.`);
    }
    const id = requireString(record[idField], `${label}.${idField}`);
    if (index.has(id)) {
      throw new SelectionError(
        "duplicate_selection_identity",
        `${label} contains duplicate identity '${id}'.`,
        { label, id }
      );
    }
    index.set(id, cloneData(record));
  }
  return index;
}

export function createSelectionOrigin(contract) {
  const manifestId = requireString(contract?.userData?.manifestId, "contract.userData.manifestId");
  return deepFreeze({ manifestId, baselineKey: deriveBaselineKey(contract) });
}

export function createSelectionCatalog({ origin, towns, spawnAreas, mapLocations }) {
  if (!isRecord(origin)) {
    throw new SelectionError("invalid_selection_catalog", "Selection origin is required.");
  }
  const normalizedOrigin = {
    manifestId: requireString(origin.manifestId, "origin.manifestId"),
    baselineKey: requireString(origin.baselineKey, "origin.baselineKey")
  };
  const townIndex = createIndex(towns, "towns", "StringId");
  const spawnIndex = createIndex(spawnAreas, "spawnAreas", "StringId");
  for (const id of spawnIndex.keys()) if (!isGeographicArea(id)) spawnIndex.delete(id);
  const locationIndex = createIndex(mapLocations, "mapLocations", "InstanceId");
  const locationsByTargetId = new Map();

  for (const location of locationIndex.values()) {
    if (typeof location.TargetId !== "string" || location.TargetId.trim() === "") continue;
    const matches = locationsByTargetId.get(location.TargetId) ?? [];
    matches.push(location);
    locationsByTargetId.set(location.TargetId, matches);
  }
  for (const matches of locationsByTargetId.values()) {
    matches.sort((left, right) => left.InstanceId.localeCompare(right.InstanceId));
  }

  return deepFreeze({
    origin: normalizedOrigin,
    townById: stableObject(townIndex.entries()),
    overrideConnectivityByTownId: createOverrideConnectivity(townIndex),
    spawnAreaById: stableObject(spawnIndex.entries()),
    locationById: stableObject(locationIndex.entries()),
    locationsByTargetId: stableObject(locationsByTargetId.entries())
  });
}
