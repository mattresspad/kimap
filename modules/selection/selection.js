import { deepFreeze, isRecord } from "../scenario/utils.js";
import { SelectionError } from "./errors.js";
import { isKenshiPointInBounds } from "./map-space.js";

export const SELECTION_SOURCES = Object.freeze([
  "map",
  "manifest",
  "palette",
  "quickSearch",
  "favorite",
  "contentBrowser",
  "override",
  "context",
  "deepLink"
]);

function requireString(value, label, code = "invalid_selection") {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SelectionError(code, `${label} must be a non-empty string.`);
  }
  return value;
}

function normalizeOrigin(catalog, rawOrigin) {
  if (!isRecord(rawOrigin)) {
    throw new SelectionError("stale_selection_origin", "Selection origin is required.");
  }
  const origin = {
    manifestId: requireString(rawOrigin.manifestId, "selection.origin.manifestId"),
    baselineKey: requireString(rawOrigin.baselineKey, "selection.origin.baselineKey")
  };
  if (
    origin.manifestId !== catalog.origin.manifestId ||
    origin.baselineKey !== catalog.origin.baselineKey
  ) {
    throw new SelectionError(
      "stale_selection_origin",
      "The selection belongs to a different manifest baseline.",
      { expected: catalog.origin, actual: origin }
    );
  }
  return origin;
}

function normalizeSource(value) {
  const source = requireString(value, "selection.source");
  if (!SELECTION_SOURCES.includes(source)) {
    throw new SelectionError("invalid_selection", `Unknown selection source '${source}'.`);
  }
  return source;
}

function normalizeEntitySelection(catalog, rawSelection, origin, source) {
  const entityType = requireString(rawSelection.entityType, "selection.entityType");
  const entityId = requireString(rawSelection.entityId, "selection.entityId");
  let instanceId = rawSelection.instanceId ?? null;

  if (entityType === "town") {
    if (!catalog.townById[entityId]) {
      throw new SelectionError("unknown_selection_entity", `Unknown town '${entityId}'.`, {
        entityType,
        entityId
      });
    }
    if (instanceId !== null) {
      instanceId = requireString(instanceId, "selection.instanceId");
      const location = catalog.locationById[instanceId];
      if (!location || location.TargetId !== entityId) {
        throw new SelectionError(
          "selection_instance_mismatch",
          `Map instance '${instanceId}' does not belong to town '${entityId}'.`,
          { entityId, instanceId }
        );
      }
    } else {
      instanceId = catalog.locationsByTargetId[entityId]?.[0]?.InstanceId ?? null;
    }
  } else if (entityType === "spawnArea") {
    if (!catalog.spawnAreaById[entityId]) {
      throw new SelectionError("unknown_selection_entity", `Unknown spawn area '${entityId}'.`, {
        entityType,
        entityId
      });
    }
    if (instanceId !== null) {
      throw new SelectionError(
        "selection_instance_mismatch",
        "Spawn-area selections do not accept map occurrence IDs.",
        { entityId, instanceId }
      );
    }
  } else {
    throw new SelectionError(
      "unsupported_selection_entity",
      `Selection entity type '${entityType}' is not supported.`,
      { entityType }
    );
  }

  return deepFreeze({ kind: "entity", entityType, entityId, instanceId, source, origin });
}

function normalizePointSelection(rawSelection, origin, source) {
  if (!isRecord(rawSelection.point) || !isKenshiPointInBounds(rawSelection.point)) {
    throw new SelectionError(
      "invalid_selection_point",
      "Map point coordinates must be finite and inside the Kenshi world bounds."
    );
  }
  return deepFreeze({
    kind: "point",
    point: { x: rawSelection.point.x, z: rawSelection.point.z },
    source,
    origin
  });
}

export function normalizeSelection(catalog, rawSelection) {
  if (!isRecord(rawSelection)) {
    throw new SelectionError("invalid_selection", "Selection must be an object.");
  }
  const origin = normalizeOrigin(catalog, rawSelection.origin);
  const source = normalizeSource(rawSelection.source);
  if (rawSelection.kind === "entity") {
    return normalizeEntitySelection(catalog, rawSelection, origin, source);
  }
  if (rawSelection.kind === "point") {
    return normalizePointSelection(rawSelection, origin, source);
  }
  throw new SelectionError("invalid_selection", "Selection kind must be 'entity' or 'point'.");
}

export function sameSelection(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
