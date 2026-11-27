import { deepFreeze } from "./scenario/utils.js";
import { isGeographicArea } from "./selection/geographic-area-policy.js";

export const LANDMARK_FALLBACK_ICON = "icons/landmark.svg";

function matchingConfig(id, point, whitelist) {
  const entry = Object.hasOwn(whitelist, id) ? whitelist[id] : null;
  const candidates = Array.isArray(entry) ? entry : [entry];
  return candidates.find(
    (config) =>
      config &&
      (!config.coords ||
        (Math.abs(point.x - config.coords[0]) < 50 && Math.abs(point.z - config.coords[1]) < 50))
  );
}

function iconPath(value) {
  return typeof value === "string" && /^icons\/[\w /-]+\.svg$/u.test(value) && !value.includes("..")
    ? value
    : LANDMARK_FALLBACK_ICON;
}

/** Static map-owned annotations, independent of manifest and scenario normalization. */
export function createLandmarkCatalog({ features = [], fog = [], whitelist = {} } = {}) {
  const byId = new Map();
  for (const [source, records, identityField] of [
    ["feature", features, "TargetId"],
    ["fog", fog, "ShortName"]
  ]) {
    for (const record of Array.isArray(records) ? records : []) {
      const definitionId = record?.[identityField];
      const point = { x: record?.X, z: record?.Z };
      if (
        typeof definitionId !== "string" ||
        !definitionId ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.z) ||
        Math.abs(point.x) >= 400000 ||
        Math.abs(point.z) >= 400000
      )
        continue;
      const config = matchingConfig(definitionId, point, whitelist ?? {});
      if (!config) continue;
      const id = JSON.stringify([source, definitionId, point.x, point.z]);
      if (byId.has(id)) continue;
      byId.set(
        id,
        deepFreeze({
          id,
          source,
          definitionId,
          point,
          name: typeof config.title === "string" ? config.title : definitionId,
          description: typeof config.description === "string" ? config.description : "",
          icon: iconPath(config.icon),
          wiki: typeof config.wiki === "string" ? config.wiki : null,
          image: typeof config.image === "string" ? config.image : null
        })
      );
    }
  }
  return Object.freeze({
    occurrences: Object.freeze([...byId.values()]),
    get: (id) => byId.get(id) ?? null
  });
}

/** Use all geographic identities, without political eligibility or roster filtering. */
export function resolveLandmarkAreas(point, areaIndex, status = "loading") {
  if (!areaIndex?.available) {
    return deepFreeze({ status: status === "loading" ? "loading" : "unavailable", areas: [] });
  }
  const geometry = areaIndex.getGeometryAtKenshi(point);
  const areas = (geometry?.areaIds ?? []).flatMap((id, index) =>
    isGeographicArea(id) ? [{ id, name: geometry.areaNames[index] ?? id }] : []
  );
  return deepFreeze({ status: areas.length ? "ready" : "unmatched", areas });
}
