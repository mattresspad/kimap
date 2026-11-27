import assert from "node:assert/strict";
import test from "node:test";
import { sampleLandmarks } from "../preview/fixture.mjs";
import { createLandmarkCatalog, resolveLandmarkAreas } from "../modules/landmark-catalog.js";
import { createPoliticalAreaIndex } from "../modules/political/area-index.js";
import { coordinateForPixel, rasterFromRows } from "./fixtures/political-fixture.js";

test("fixture occurrences retain individual identity and authored descriptions", () => {
  const catalog = createLandmarkCatalog(sampleLandmarks);
  const { features } = sampleLandmarks;
  assert.equal(catalog.occurrences.length, 2);
  assert.equal(new Set(catalog.occurrences.map((row) => row.definitionId)).size, 1);
  assert.equal(new Set(catalog.occurrences.map((row) => row.id)).size, 2);
  assert.equal(catalog.occurrences[0].description, "A fixed point for surveyors.");
  assert.equal(catalog.occurrences[0].point.x, features[0].X);
  assert.ok(Object.isFrozen(catalog.get(catalog.occurrences[0].id).point));
  const reverse = createLandmarkCatalog({ ...sampleLandmarks, features: [...features].reverse() });
  assert.deepEqual(
    reverse.occurrences.map((row) => row.id).sort(),
    catalog.occurrences.map((row) => row.id).sort()
  );
});

test("whitelist matching retains strict 50-unit tolerance, first match, global and fog entries", () => {
  const features = [
    { TargetId: "bridge", X: 49.9, Z: -49.9 },
    { TargetId: "bridge", X: 50, Z: 0 },
    { TargetId: "global", X: 1.25, Z: 2.75 },
    { TargetId: "global", X: 400000, Z: 0 },
    { TargetId: "global", X: "1", Z: 0 },
    { TargetId: "global", X: NaN, Z: 0 },
    { TargetId: "missing", X: 0, Z: 0 }
  ];
  const whitelist = {
    bridge: [
      { title: "First", coords: [0, 0] },
      { title: "Second", coords: [0, 0] }
    ],
    global: { title: "Global", wiki: "javascript:untrusted", icon: "javascript:untrusted" },
    fog: { title: "Fog" }
  };
  const catalog = createLandmarkCatalog({
    features,
    fog: [{ ShortName: "fog", X: 0, Z: 0 }],
    whitelist
  });
  assert.deepEqual(
    catalog.occurrences.map((row) => row.name),
    ["First", "Global", "Fog"]
  );
  assert.equal(catalog.occurrences[1].icon, "icons/landmark.svg");
  assert.equal(catalog.occurrences[1].wiki, "javascript:untrusted");
  assert.equal(catalog.occurrences[2].source, "fog");
  assert.equal(catalog.get("absent"), null);
});

test("landmark area readings distinguish readiness and unmatched geography", () => {
  const point = { x: 0, z: 0 };
  assert.equal(resolveLandmarkAreas(point, null, "loading").status, "loading");
  assert.equal(resolveLandmarkAreas(point, null, "ready").status, "unavailable");
  const areaIndex = createPoliticalAreaIndex({
    raster: rasterFromRows([[0xff0000]]),
    spawnAreas: []
  });
  assert.equal(resolveLandmarkAreas(point, areaIndex).status, "unmatched");
});

test("landmarks retain all shared-color IDs and core void but omit only unused Rim Sands", () => {
  const point = coordinateForPixel(0, 0, 1, 1);
  const areas = [
    ["51405-Newwworld.mod", "Rim Sands"],
    ["55938-rebirth.mod", "Shem"],
    ["duplicate-name", "Shem"],
    ["18003-gamedata.base", "NONE"]
  ].map(([StringId, Name]) => ({ StringId, Name, Values: { index: 0xff0000 } }));
  for (const spawnAreas of [areas, [...areas].reverse()]) {
    const index = createPoliticalAreaIndex({ raster: rasterFromRows([[0xff0000]]), spawnAreas });
    const reading = resolveLandmarkAreas(point, index);
    assert.equal(reading.status, "ready");
    assert.deepEqual(reading.areas.map((row) => row.id).sort(), [
      "18003-gamedata.base",
      "55938-rebirth.mod",
      "duplicate-name"
    ]);
    assert.ok(Object.isFrozen(reading.areas));
  }
  assert.equal(areas.length, 4);
});
