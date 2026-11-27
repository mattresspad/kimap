import { MAP_HEIGHT, MAP_WIDTH, kenshiToLeaflet } from "../selection/map-space.js";
import { deepFreeze, diagnostic } from "../scenario/utils.js";
import { isGeographicArea } from "../selection/geographic-area-policy.js";

export const CORE_VOID_AREA_ID = "18003-gamedata.base";

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return value;
}

function normalizeArea(area) {
  const id = area?.id ?? area?.StringId;
  if (typeof id !== "string" || id.trim() === "") return null;
  const raw = area?.raw ?? area;
  const colorIndex = Number(raw?.Values?.index);
  return {
    id,
    name:
      typeof area?.name === "string" ? area.name : typeof raw?.Name === "string" ? raw.Name : id,
    colorIndex
  };
}

function isColorIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

function colorKeyFromIndex(value) {
  return `${String((value >> 16) & 0xff)},${String((value >> 8) & 0xff)},${String(value & 0xff)}`;
}

function indexFromColor(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

function rasterColorAt(raster, x, y) {
  const offset = ((raster.height - 1 - y) * raster.width + x) * 4;
  return indexFromColor(raster.data[offset], raster.data[offset + 1], raster.data[offset + 2]);
}

function pixelForKenshi(point, raster) {
  const leaflet = kenshiToLeaflet(point);
  if (!leaflet) return null;
  const x = Math.floor((leaflet.lng / MAP_WIDTH) * raster.width);
  const y = Math.floor((1 - leaflet.lat / MAP_HEIGHT) * raster.height);
  if (x < 0 || x >= raster.width || y < 0 || y >= raster.height) return null;
  return { x, y, flatIndex: y * raster.width + x };
}

/**
 * Creates immutable, paint-complete spawn-area geometry without applying label thresholds.
 * Pixel lookup state stays private so callers cannot mutate the index through typed arrays.
 */
export function createPoliticalAreaIndex({ raster, spawnAreas } = {}) {
  const width = requirePositiveInteger(raster?.width, "raster.width");
  const height = requirePositiveInteger(raster?.height, "raster.height");
  if (!raster?.data || raster.data.length < width * height * 4) {
    throw new TypeError("raster.data must contain four channels for every pixel.");
  }
  if (!Array.isArray(spawnAreas)) {
    throw new TypeError("spawnAreas must be an array.");
  }

  const excluded = new Set([CORE_VOID_AREA_ID]);
  const diagnostics = [];
  const areasByColor = new Map();
  const areaIds = new Set();

  for (const [position, candidate] of spawnAreas.entries()) {
    const area = normalizeArea(candidate);
    if (!area) {
      diagnostics.push(
        diagnostic(
          "warning",
          "political_area_identity_missing",
          "A spawn-area record has no stable identity and cannot be indexed.",
          { position }
        )
      );
      continue;
    }
    if (areaIds.has(area.id)) {
      diagnostics.push(
        diagnostic(
          "warning",
          "political_area_identity_duplicate",
          `Spawn-area identity '${area.id}' occurs more than once.`,
          { areaId: area.id, position }
        )
      );
      continue;
    }
    areaIds.add(area.id);
    if (!isGeographicArea(area.id)) {
      diagnostics.push(
        diagnostic(
          "info",
          "geographic_area_unused",
          "Unused area retained in source data but omitted from geography.",
          { areaId: area.id }
        )
      );
      continue;
    }
    if (!isColorIndex(area.colorIndex)) {
      diagnostics.push(
        diagnostic(
          "warning",
          "political_area_color_invalid",
          `Spawn area '${area.id}' has no valid raster color index.`,
          { areaId: area.id, value: area.colorIndex }
        )
      );
      continue;
    }
    const matches = areasByColor.get(area.colorIndex) ?? [];
    matches.push(area);
    areasByColor.set(area.colorIndex, matches);
  }

  const colorByPixel = new Uint32Array(width * height);
  const cellsByColor = new Map();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const flatIndex = y * width + x;
      const colorIndex = rasterColorAt(raster, x, y);
      colorByPixel[flatIndex] = colorIndex;
      cellsByColor.set(colorIndex, (cellsByColor.get(colorIndex) ?? 0) + 1);
    }
  }

  const visited = new Uint8Array(width * height);
  const componentNumberByPixel = new Int32Array(width * height);
  componentNumberByPixel.fill(-1);
  const components = [];
  const componentsByColor = new Map();
  for (let start = 0; start < colorByPixel.length; start += 1) {
    if (visited[start]) continue;
    const colorIndex = colorByPixel[start];
    const queue = [start];
    visited[start] = 1;
    let cursor = 0;
    let cellCount = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (cursor < queue.length) {
      const flatIndex = queue[cursor];
      cursor += 1;
      componentNumberByPixel[flatIndex] = components.length;
      const x = flatIndex % width;
      const y = Math.floor(flatIndex / width);
      cellCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const neighbor of [
        x > 0 ? flatIndex - 1 : -1,
        x + 1 < width ? flatIndex + 1 : -1,
        y > 0 ? flatIndex - width : -1,
        y + 1 < height ? flatIndex + width : -1
      ]) {
        if (neighbor >= 0 && !visited[neighbor] && colorByPixel[neighbor] === colorIndex) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    const colorComponents = componentsByColor.get(colorIndex) ?? [];
    const component = deepFreeze({
      id: `${colorKeyFromIndex(colorIndex)}:${String(colorComponents.length + 1)}`,
      colorIndex,
      cellCount,
      bounds: { minX, minY, maxX, maxY }
    });
    components.push(component);
    colorComponents.push(component);
    componentsByColor.set(colorIndex, colorComponents);
  }

  const allColors = new Set([...areasByColor.keys(), ...cellsByColor.keys()]);
  const geometries = [...allColors]
    .sort((left, right) => left - right)
    .map((colorIndex) => {
      const areas = [...(areasByColor.get(colorIndex) ?? [])].sort((left, right) =>
        left.id.localeCompare(right.id)
      );
      const ids = areas.map(({ id }) => id);
      const excludedIds = ids.filter((id) => excluded.has(id));
      const includedIds = ids.filter((id) => !excluded.has(id));
      const mixedExclusion = excludedIds.length > 0 && includedIds.length > 0;
      const geometry = {
        key: colorKeyFromIndex(colorIndex),
        colorIndex,
        areaIds: ids,
        areaNames: areas.map(({ name }) => name),
        cellCount: cellsByColor.get(colorIndex) ?? 0,
        components: componentsByColor.get(colorIndex) ?? [],
        componentCount: componentsByColor.get(colorIndex)?.length ?? 0,
        ambiguous: ids.length > 1,
        excluded: ids.length > 0 && excludedIds.length === ids.length,
        indeterminate: ids.length === 0 || mixedExclusion,
        mixedExclusion
      };

      if (ids.length > 1) {
        diagnostics.push(
          diagnostic(
            mixedExclusion ? "error" : "warning",
            mixedExclusion ? "political_area_color_mixed_exclusion" : "political_area_color_shared",
            mixedExclusion
              ? `Raster color '${geometry.key}' mixes excluded and included spawn areas.`
              : `Raster color '${geometry.key}' is shared by multiple spawn areas.`,
            { colorKey: geometry.key, areaIds: ids }
          )
        );
      }
      if (ids.length === 0) {
        diagnostics.push(
          diagnostic(
            "warning",
            "political_raster_color_unknown",
            `Raster color '${geometry.key}' has no spawn-area record.`,
            { colorKey: geometry.key, cellCount: geometry.cellCount }
          )
        );
      }
      if (ids.length > 0 && geometry.cellCount === 0) {
        diagnostics.push(
          diagnostic(
            "warning",
            "political_area_raster_missing",
            `Spawn area raster color '${geometry.key}' has no pixels.`,
            { colorKey: geometry.key, areaIds: ids }
          )
        );
      }
      return deepFreeze(geometry);
    });

  const geometryByColor = new Map(geometries.map((geometry) => [geometry.colorIndex, geometry]));
  const geometryByAreaId = new Map();
  for (const geometry of geometries) {
    for (const areaId of geometry.areaIds) geometryByAreaId.set(areaId, geometry);
  }

  const getGeometryAtKenshi = (point) => {
    const pixel = pixelForKenshi(point, { width, height });
    if (!pixel) return null;
    return geometryByColor.get(colorByPixel[pixel.flatIndex]) ?? null;
  };

  const getComponentAtKenshi = (point) => {
    const pixel = pixelForKenshi(point, { width, height });
    if (!pixel) return null;
    const componentNumber = componentNumberByPixel[pixel.flatIndex];
    return componentNumber >= 0 ? components[componentNumber] : null;
  };

  return Object.freeze({
    available: true,
    width,
    height,
    totalCellCount: width * height,
    excludedAreaIds: deepFreeze([...excluded].sort()),
    geometries: deepFreeze(geometries),
    diagnostics: deepFreeze(diagnostics),
    getGeometryAtKenshi,
    getComponentAtKenshi,
    copyColorIndexes: () => new Uint32Array(colorByPixel),
    getGeometryByColorKey: (colorKey) =>
      geometries.find((geometry) => geometry.key === colorKey) ?? null,
    getGeometryForAreaId: (areaId) => geometryByAreaId.get(areaId) ?? null
  });
}
