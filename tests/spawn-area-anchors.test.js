import assert from "node:assert/strict";
import test from "node:test";

import { createSpawnAreaAnchorIndex } from "../modules/selection/index.js";

const PALETTE = Object.freeze({
  ".": [0, 0, 0],
  A: [255, 0, 0],
  B: [0, 255, 0],
  C: [0, 0, 255],
  E: [255, 255, 0]
});

function rasterFromRows(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    assert.equal(rows[y].length, width);
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = PALETTE[rows[y][x]];
      const rawY = height - 1 - y;
      const index = (rawY * width + x) * 4;
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function pointForPixel(raster, x, y) {
  return { lng: x + 0.5, lat: raster.height - y - 0.5 };
}

function areaMap() {
  return new Map([
    ["255,0,0", { StringId: "area-a" }],
    ["0,255,0", { StringId: "area-b" }],
    ["0,0,255", { StringId: "area-c" }],
    ["255,255,0", { StringId: "18003-gamedata.base" }]
  ]);
}

test("spawn raster index preserves four-neighbor components, geometry, and thresholding", () => {
  const raster = rasterFromRows([
    "AA..BBE.",
    "AA..BBE.",
    "....B...",
    "A...CC..",
    "....CC.."
  ]);
  const index = createSpawnAreaAnchorIndex({
    raster,
    colorToAreaMap: areaMap(),
    mapWidth: raster.width,
    mapHeight: raster.height,
    minimumPixels: 2
  });

  assert.equal(index.components.length, 3);
  const [areaA, areaB, areaC] = index.components;
  assert.deepEqual(
    index.components.map((component) => [component.spawnAreaId, component.pixelCount]),
    [
      ["area-a", 4],
      ["area-b", 5],
      ["area-c", 4]
    ]
  );
  assert.deepEqual(areaA.bounds, { minX: 0, minY: 0, maxX: 1, maxY: 1 });
  assert.deepEqual(areaA.rasterCentroid, { x: 0.5, y: 0.5 });
  assert.deepEqual(areaA.leafletAnchor, { lat: 4.5, lng: 0.5 });
  assert.equal(areaB.scanIndex, 1);
  assert.equal(areaC.scanIndex, 3);
  assert.equal(index.getAreaIdAtLeaflet(pointForPixel(raster, 0, 0)), "area-a");
  assert.equal(index.getAreaIdAtLeaflet(pointForPixel(raster, 6, 0)), null);
  assert.strictEqual(index.getContainingAnchor(pointForPixel(raster, 1, 1), "area-a"), areaA);

  const filteredSpeckle = pointForPixel(raster, 0, 3);
  assert.equal(index.getAreaIdAtLeaflet(filteredSpeckle), "area-a");
  assert.equal(index.getContainingAnchor(filteredSpeckle, "area-a"), null);
  assert.strictEqual(
    index.getContainingAnchor(filteredSpeckle, "area-a") ?? index.getPrimaryAnchor("area-a"),
    areaA
  );
  assert.deepEqual(index.getComponents("missing-area"), []);
  assert.throws(() => (index.components[0].leafletAnchor.lat = 0), TypeError);
});

test("primary anchors choose the largest component and break ties by raster scan order", () => {
  const raster = rasterFromRows(["AA..AA", "AA..AA", "......", "...A.."]);
  const index = createSpawnAreaAnchorIndex({
    raster,
    colorToAreaMap: areaMap(),
    mapWidth: raster.width,
    mapHeight: raster.height,
    minimumPixels: 1
  });
  const components = index.getComponents("area-a");

  assert.equal(components.length, 3);
  assert.equal(components[0].pixelCount, 4);
  assert.equal(components[1].pixelCount, 4);
  assert.equal(components[2].pixelCount, 1);
  assert.strictEqual(index.getPrimaryAnchor("area-a"), components[0]);
  assert.strictEqual(
    index.getContainingAnchor(pointForPixel(raster, 5, 1), "area-a"),
    components[1]
  );
});

test("diagonal pixels remain separate and invalid raster inputs fail explicitly", () => {
  const raster = rasterFromRows(["A.", ".A"]);
  const index = createSpawnAreaAnchorIndex({
    raster,
    colorToAreaMap: areaMap(),
    mapWidth: raster.width,
    mapHeight: raster.height,
    minimumPixels: 1
  });
  assert.equal(index.getComponents("area-a").length, 2);
  assert.throws(
    () => createSpawnAreaAnchorIndex({ raster: null, colorToAreaMap: areaMap() }),
    /raster\.width/u
  );
  assert.throws(
    () =>
      createSpawnAreaAnchorIndex({
        raster: { width: 2, height: 2, data: new Uint8Array(3) },
        colorToAreaMap: areaMap()
      }),
    /four channels/u
  );
});
