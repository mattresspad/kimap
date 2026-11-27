import { deepFreeze } from "../scenario/utils.js";
import { MAP_HEIGHT, MAP_WIDTH } from "./map-space.js";
import { isGeographicArea } from "./geographic-area-policy.js";

const DEFAULT_EXCLUDED_AREA_IDS = Object.freeze(["18003-gamedata.base"]);

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return value;
}

function requirePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
  return value;
}

function colorKeyAt(raster, x, y) {
  const index = ((raster.height - 1 - y) * raster.width + x) * 4;
  return `${String(raster.data[index])},${String(raster.data[index + 1])},${String(raster.data[index + 2])}`;
}

function pixelForLeaflet(point, raster, mapWidth, mapHeight) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) return null;
  const x = Math.floor((point.lng / mapWidth) * raster.width);
  const y = Math.floor((1 - point.lat / mapHeight) * raster.height);
  if (x < 0 || x >= raster.width || y < 0 || y >= raster.height) return null;
  return { x, y, flatIndex: y * raster.width + x };
}

function areaIdForValue(value) {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value?.StringId === "string" && value.StringId !== "") return value.StringId;
  return null;
}

/**
 * Builds one immutable geographic index over the decoded spawn-area raster.
 * Internal typed arrays remain private so callers cannot mutate lookup state.
 */
export function createSpawnAreaAnchorIndex({
  raster,
  colorToAreaMap,
  mapWidth = MAP_WIDTH,
  mapHeight = MAP_HEIGHT,
  minimumPixels = 51,
  excludedAreaIds = DEFAULT_EXCLUDED_AREA_IDS
}) {
  const width = requirePositiveInteger(raster?.width, "raster.width");
  const height = requirePositiveInteger(raster?.height, "raster.height");
  if (!raster?.data || raster.data.length < width * height * 4) {
    throw new TypeError("raster.data must contain four channels for every pixel.");
  }
  if (!colorToAreaMap || typeof colorToAreaMap.entries !== "function") {
    throw new TypeError("colorToAreaMap must expose iterable entries.");
  }
  requirePositiveNumber(mapWidth, "mapWidth");
  requirePositiveNumber(mapHeight, "mapHeight");
  requirePositiveInteger(minimumPixels, "minimumPixels");

  const excluded = new Set(excludedAreaIds ?? DEFAULT_EXCLUDED_AREA_IDS);
  const areaIdByColor = new Map();
  for (const [colorKey, value] of colorToAreaMap.entries()) {
    const areaId = areaIdForValue(value);
    if (
      typeof colorKey === "string" &&
      areaId &&
      isGeographicArea(areaId) &&
      !excluded.has(areaId)
    ) {
      areaIdByColor.set(colorKey, areaId);
    }
  }

  const visited = new Uint8Array(width * height);
  const componentByPixel = new Int32Array(width * height);
  componentByPixel.fill(-1);
  const allComponents = [];
  const retainedComponents = [];
  const componentsByAreaId = new Map();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start]) continue;
      visited[start] = 1;

      const colorKey = colorKeyAt(raster, x, y);
      const spawnAreaId = areaIdByColor.get(colorKey);
      if (!spawnAreaId) continue;

      const componentIndex = allComponents.length;
      const queue = [start];
      componentByPixel[start] = componentIndex;
      let head = 0;
      let pixelCount = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (head < queue.length) {
        const current = queue[head];
        head += 1;
        const currentX = current % width;
        const currentY = Math.floor(current / width);
        pixelCount += 1;
        sumX += currentX;
        sumY += currentY;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        for (const [nextX, nextY] of [
          [currentX + 1, currentY],
          [currentX - 1, currentY],
          [currentX, currentY + 1],
          [currentX, currentY - 1]
        ]) {
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || colorKeyAt(raster, nextX, nextY) !== colorKey) continue;
          visited[next] = 1;
          componentByPixel[next] = componentIndex;
          queue.push(next);
        }
      }

      const rasterX = sumX / pixelCount;
      const rasterY = sumY / pixelCount;
      const component = deepFreeze({
        spawnAreaId,
        scanIndex: componentIndex,
        pixelCount,
        retained: pixelCount >= minimumPixels,
        bounds: { minX, minY, maxX, maxY },
        rasterCentroid: { x: rasterX, y: rasterY },
        leafletAnchor: {
          lat: ((height - rasterY) / height) * mapHeight,
          lng: (rasterX / width) * mapWidth
        }
      });
      allComponents.push(component);
      if (!component.retained) continue;
      retainedComponents.push(component);
      const areaComponents = componentsByAreaId.get(spawnAreaId) ?? [];
      areaComponents.push(component);
      componentsByAreaId.set(spawnAreaId, areaComponents);
    }
  }

  const frozenComponents = deepFreeze([...retainedComponents]);
  for (const [spawnAreaId, components] of componentsByAreaId.entries()) {
    componentsByAreaId.set(spawnAreaId, deepFreeze([...components]));
  }

  const getComponents = (spawnAreaId) => componentsByAreaId.get(spawnAreaId) ?? Object.freeze([]);
  const getPrimaryAnchor = (spawnAreaId) => {
    const components = getComponents(spawnAreaId);
    let primary = null;
    for (const component of components) {
      if (
        !primary ||
        component.pixelCount > primary.pixelCount ||
        (component.pixelCount === primary.pixelCount && component.scanIndex < primary.scanIndex)
      ) {
        primary = component;
      }
    }
    return primary;
  };
  const getAreaIdAtLeaflet = (point) => {
    const pixel = pixelForLeaflet(point, raster, mapWidth, mapHeight);
    return pixel ? (areaIdByColor.get(colorKeyAt(raster, pixel.x, pixel.y)) ?? null) : null;
  };
  const getContainingAnchor = (point, spawnAreaId) => {
    const pixel = pixelForLeaflet(point, raster, mapWidth, mapHeight);
    if (!pixel) return null;
    const componentIndex = componentByPixel[pixel.flatIndex];
    if (componentIndex < 0) return null;
    const component = allComponents[componentIndex] ?? null;
    if (!component?.retained || component.spawnAreaId !== spawnAreaId) return null;
    return component;
  };

  return Object.freeze({
    components: frozenComponents,
    getAreaIdAtLeaflet,
    getComponents,
    getPrimaryAnchor,
    getContainingAnchor
  });
}
