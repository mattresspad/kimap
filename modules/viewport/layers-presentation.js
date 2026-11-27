import { deepFreeze } from "../scenario/utils.js";

export const LAYER_CONFIGURATION_TARGETS = Object.freeze(["roads", "borders", "debugGrid"]);
export const LAYER_PRESENTATION_FAMILIES = Object.freeze(["worldView", "mapContent", "reference"]);

/** Read live layer truth without retaining it or freezing the Leaflet layer objects. */
export function createLayerPresentationProjection({
  descriptors = null,
  configurationDescriptors = descriptors,
  townTypeProjection = null,
  hasLayer
} = {}) {
  for (const entries of [descriptors, configurationDescriptors]) {
    if (entries !== null && (!Array.isArray(entries) || typeof hasLayer !== "function")) {
      throw new TypeError("Layer descriptors require a live hasLayer reader.");
    }
  }

  const active = (descriptors ?? []).filter(
    (descriptor) => descriptor.layer && hasLayer(descriptor.layer)
  );
  const configurable =
    configurationDescriptors === descriptors
      ? active
      : (configurationDescriptors ?? []).filter(
          (descriptor) => descriptor.layer && hasLayer(descriptor.layer)
        );
  const describe = ({ id, name }) => ({
    id,
    name:
      id === "towns" && townTypeProjection && !townTypeProjection.allPresentEnabled
        ? `${name} (${townTypeProjection.enabledPresentCount} of ${townTypeProjection.presentTypeCount} types)`
        : name
  });
  return deepFreeze({
    available: descriptors !== null,
    configurationAvailable: configurationDescriptors !== null,
    worldViews: active.filter(({ family }) => family === "worldView").map(describe),
    mapContent: active.filter(({ family }) => family === "mapContent").map(describe),
    referenceLayers: active.filter(({ family }) => family === "reference").map(describe),
    roadEnabled: configurable.some(({ configurationTarget }) => configurationTarget === "roads"),
    borderEnabled: configurable.some(
      ({ configurationTarget }) => configurationTarget === "borders"
    ),
    gridEnabled: configurable.some(({ configurationTarget }) => configurationTarget === "debugGrid")
  });
}
