import { deepFreeze } from "../scenario/utils.js";

function action(id, label, enabled, reason = null, details = {}) {
  return { id, label, enabled, reason: enabled ? null : reason, ...details };
}

export function createGeographicActions(context, viewport = {}) {
  if (!context) return Object.freeze([]);
  const isTown = context.kind === "town";
  const spawnArea = context.spawnArea ?? context.point?.spawnArea ?? null;
  const townAnchor = context.town?.location?.coordinates?.leaflet ?? null;
  const spawnAnchor = spawnArea?.anchor?.leafletAnchor ?? null;
  const zoomAnchor = townAnchor ?? spawnAnchor;
  const hasTownCoordinates = Boolean(context.town?.location?.coordinates);
  const hasOverrideNetwork = Boolean(context.town?.primaryNetwork);
  const hasContainingSpawn = Boolean(context.kind === "point" && spawnArea);
  const entityTarget =
    context.selection.kind === "entity"
      ? {
          entityType: context.selection.entityType,
          entityId: context.selection.entityId,
          name: context.title
        }
      : null;
  const containingSpawnTarget = hasContainingSpawn
    ? { entityType: "spawnArea", entityId: spawnArea.id, name: spawnArea.name }
    : null;
  const identityTarget = entityTarget ?? containingSpawnTarget;
  const currentZoom = viewport.currentZoom;
  const maxZoom = viewport.maxZoom;
  const canZoomCloser =
    context.kind === "point" &&
    Number.isFinite(currentZoom) &&
    Number.isFinite(maxZoom) &&
    currentZoom < maxZoom;

  return deepFreeze([
    action("inspect", "Open Context", true),
    action(
      "zoom",
      isTown ? "Zoom to Location" : "Zoom to Area",
      Boolean(zoomAnchor),
      isTown
        ? "This selection has no map occurrence."
        : "Spawn-area geometry is unavailable for this selection.",
      {
        target: zoomAnchor
          ? { kind: isTown ? "town" : "spawnArea", anchor: zoomAnchor, targetZoom: 0 }
          : null
      }
    ),
    action("copyView", "Copy View Link", true),
    action(
      "zoomCloser",
      "Zoom Closer",
      canZoomCloser,
      context.kind !== "point"
        ? "Zoom Closer is available for map points."
        : "The map is already at maximum zoom.",
      {
        target: context.point?.coordinates?.leaflet
          ? { kind: "point", anchor: context.point.coordinates.leaflet }
          : null
      }
    ),
    action(
      "togglePointContext",
      "Show or Hide Point Data",
      hasContainingSpawn,
      "Point presentation is available only inside a known spawn area."
    ),
    action(
      "favorite",
      "Toggle Favorite",
      Boolean(identityTarget),
      "This point is not inside a known spawn area.",
      { target: identityTarget }
    ),
    action(
      "layout",
      "View Layout",
      isTown && context.capabilities.hasLayout && hasTownCoordinates,
      "No town layout is available for this selection."
    ),
    action(
      "overrides",
      "Open Override Network",
      isTown && hasOverrideNetwork,
      "This town has no modeled override network."
    ),
    action("wiki", "Read Wiki Article", false, "Wiki context is planned for a later milestone.", {
      target: identityTarget
    }),
    action("clear", "Clear Selection", true)
  ]);
}
