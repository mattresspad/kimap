import { deepFreeze } from "../scenario/utils.js";
import { normalizeSelection } from "./selection.js";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, isKenshiPointInBounds } from "./map-space.js";

export const MAP_VIEW_VERSION = 1;
export const MAX_MAP_VIEW_LENGTH = 2048;

function finiteNumber(value) {
  if (value === null || value === "" || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeViewport(viewport) {
  const center = { x: viewport?.center?.x, z: viewport?.center?.z };
  const zoom = viewport?.zoom;
  if (
    !isKenshiPointInBounds(center) ||
    !Number.isFinite(zoom) ||
    zoom < MAP_MIN_ZOOM ||
    zoom > MAP_MAX_ZOOM
  ) {
    throw new TypeError("Map view requires an in-bounds center and supported zoom.");
  }
  return { center, zoom };
}

function setSelectionParameters(params, selection) {
  if (!selection) return;
  if (selection.kind === "point") {
    params.set("type", "point");
    params.set("px", String(selection.point.x));
    params.set("pz", String(selection.point.z));
  } else {
    params.set("type", selection.entityType);
    params.set("id", selection.entityId);
    if (selection.instanceId) params.set("instance", selection.instanceId);
  }
}

export function serializeMapView({ origin, viewport, selection = null, catalog = null }) {
  const normalizedViewport = normalizeViewport(viewport);
  if (
    typeof origin?.manifestId !== "string" ||
    origin.manifestId === "" ||
    typeof origin?.baselineKey !== "string" ||
    origin.baselineKey === ""
  ) {
    throw new TypeError("Map view requires manifest and baseline identity.");
  }
  if (
    catalog &&
    (origin.manifestId !== catalog.origin.manifestId ||
      origin.baselineKey !== catalog.origin.baselineKey)
  ) {
    throw new TypeError("Map view origin does not match the selection catalog.");
  }
  if (selection && !catalog) {
    throw new TypeError("Map view selection validation requires a selection catalog.");
  }
  const normalizedSelection = selection ? normalizeSelection(catalog, selection) : null;
  const params = new URLSearchParams();
  params.set("view", String(MAP_VIEW_VERSION));
  params.set("cx", String(normalizedViewport.center.x));
  params.set("cz", String(normalizedViewport.center.z));
  params.set("zoom", String(normalizedViewport.zoom));
  params.set("manifest", origin.manifestId);
  params.set("baseline", origin.baselineKey);
  setSelectionParameters(params, normalizedSelection);
  const fragment = `#${params.toString()}`;
  if (fragment.length > MAX_MAP_VIEW_LENGTH) {
    throw new TypeError("The map view link exceeds the supported URL size.");
  }
  return fragment;
}

function parseMapViewHeader(fragment) {
  if (typeof fragment !== "string" || fragment === "" || fragment === "#") return null;
  if (fragment.length > MAX_MAP_VIEW_LENGTH) {
    return deepFreeze({
      viewport: null,
      selection: null,
      notice: "The shared map view is too large."
    });
  }
  const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  if (params.get("view") !== String(MAP_VIEW_VERSION)) return null;
  const center = { x: finiteNumber(params.get("cx")), z: finiteNumber(params.get("cz")) };
  const zoom = finiteNumber(params.get("zoom"));
  let viewport;
  try {
    viewport = normalizeViewport({ center, zoom });
  } catch (_error) {
    return deepFreeze({
      viewport: null,
      selection: null,
      notice: "The shared map view contains invalid coordinates or zoom."
    });
  }

  return { params, viewport };
}

// Asset selection may read the public viewport before the selection catalog exists.
export function parseMapViewport(fragment) {
  const header = parseMapViewHeader(fragment);
  return header?.viewport ? deepFreeze(header.viewport) : null;
}

export function parseMapView(fragment, catalog) {
  const header = parseMapViewHeader(fragment);
  if (!header?.viewport) return header;
  const { params, viewport } = header;
  const linkedOrigin = {
    manifestId: params.get("manifest") ?? "",
    baselineKey: params.get("baseline") ?? ""
  };
  if (
    linkedOrigin.manifestId !== catalog.origin.manifestId ||
    linkedOrigin.baselineKey !== catalog.origin.baselineKey
  ) {
    return deepFreeze({
      viewport,
      selection: null,
      notice:
        "The shared context belongs to a different manifest baseline. The viewport was restored without changing selection."
    });
  }

  const type = params.get("type");
  if (!type) return deepFreeze({ viewport, selection: null, notice: null });
  let rawSelection;
  if (type === "point") {
    rawSelection = {
      kind: "point",
      point: { x: finiteNumber(params.get("px")), z: finiteNumber(params.get("pz")) },
      source: "deepLink",
      origin: linkedOrigin
    };
  } else {
    rawSelection = {
      kind: "entity",
      entityType: type,
      entityId: params.get("id"),
      instanceId: params.get("instance"),
      source: "deepLink",
      origin: linkedOrigin
    };
  }
  try {
    return deepFreeze({
      viewport,
      selection: normalizeSelection(catalog, rawSelection),
      notice: null
    });
  } catch (error) {
    return deepFreeze({
      viewport,
      selection: null,
      notice: `The shared selection could not be restored: ${error.message}`
    });
  }
}
