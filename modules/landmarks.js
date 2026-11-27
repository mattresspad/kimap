import { kenshiAssetUrl } from "./asset-url.js";
import { createLandmarkCatalog } from "./landmark-catalog.js";
import { enableMarkerKeyboardActivation } from "./viewport/marker-keyboard.js";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  KENSHI_MIN_COORD,
  KENSHI_MAX_COORD
} from "./selection/map-space.js";

/** Leaflet adapter only. The catalog and Inspector session own identity and navigation. */
export function initLandmarksModule({ features, fog, whitelist, layer, onInspect }) {
  const catalog = createLandmarkCatalog({ features, fog, whitelist });
  const worldSize = KENSHI_MAX_COORD - KENSHI_MIN_COORD;
  layer.clearLayers();
  for (const occurrence of catalog.occurrences) {
    const { x, z } = occurrence.point;
    const coords = L.latLng(
      MAP_HEIGHT * (1 - (z - KENSHI_MIN_COORD) / worldSize),
      MAP_WIDTH * ((x - KENSHI_MIN_COORD) / worldSize)
    );
    const icon = L.icon({
      iconUrl: kenshiAssetUrl(occurrence.icon),
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      className: "landmark-icon"
    });
    const marker = L.marker(coords, {
      icon,
      keyboard: true,
      title: occurrence.name,
      alt: `Inspect ${occurrence.name}`,
      bubblingMouseEvents: false
    });
    marker.on("click", (event) => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      onInspect(occurrence.id, marker.getElement());
    });
    enableMarkerKeyboardActivation(marker);
    marker.addTo(layer);
  }
  return catalog;
}
