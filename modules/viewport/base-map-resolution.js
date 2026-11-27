import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_WIDTH } from "../selection/map-space.js";

export const BASE_MAP_REVISION = "2026-09-12-base-map-pyramid-v1";
export const LEGACY_BASE_MAP = Object.freeze({ size: 8192, path: "data/overlays/Kenshi_Map.webp" });
export const BASE_MAP_IMAGES = Object.freeze(
  [512, 1024, 2048, 4096, 8192].map((size) =>
    Object.freeze({
      size,
      path: `data/overlays/base-map/${BASE_MAP_REVISION}/Kenshi_Map_${size}.webp`
    })
  )
);

export function selectBaseMapImage(zoom, pixelRatio = 1) {
  const validZoom = Number.isFinite(zoom) ? zoom : MAP_MIN_ZOOM;
  const boundedZoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, validZoom));
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const required = MAP_WIDTH * 2 ** boundedZoom * ratio;
  return BASE_MAP_IMAGES.find(({ size }) => size >= required) ?? BASE_MAP_IMAGES.at(-1);
}

export function isBaseMapLocalPreview(location) {
  return (
    ["localhost", "127.0.0.1", "[::1]"].includes(location?.hostname) &&
    new URLSearchParams(location?.search).get("baseMapPreview") === "local"
  );
}

export function baseMapPreviewPath(record) {
  return `/__dev/base-map/${BASE_MAP_REVISION}/${record.path.split("/").at(-1)}`;
}
