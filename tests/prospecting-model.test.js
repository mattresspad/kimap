import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentInfoProjection } from "../modules/environment-info-model.js";
import { createPoliticalAreaIndex } from "../modules/political/area-index.js";
import {
  CONDITION_CRITERIA,
  NUMERIC_CRITERIA,
  createProspectingCatalog,
  createProspectingRaster,
  projectProspecting
} from "../modules/prospecting/model.js";

const ref = (StringId) => ({ StringId });
const record = (StringId, Name, Values = {}, ReferenceCategories = {}) => ({
  StringId,
  Name,
  Values,
  ReferenceCategories
});

function fixture() {
  const spawnArea = [
    record(
      "a",
      "Same name",
      { index: 1, "acidic ground": 1, "acidic water": 1 },
      { resources: [ref("rich")], seasons: [ref("season")] }
    ),
    record(
      "b",
      "Same name",
      { index: 1, "acidic ground": 0, "acidic water": 0 },
      { resources: [ref("thin")], seasons: [ref("season"), ref("missing-season")] }
    ),
    record(
      "d",
      "Mapped alone",
      { index: 2, "acidic ground": 0, "acidic water": 0 },
      { resources: [ref("rich")], seasons: [ref("season")] }
    ),
    record("unknown", "No resource", { index: 3 }),
    record(
      "unmapped",
      "No raster cells",
      { index: 4, "acidic ground": 1 },
      { resources: [ref("rich")] }
    ),
    record(
      "18003-gamedata.base",
      "Core Void",
      { index: 1 },
      { resources: [ref("fake")], seasons: [ref("season")] }
    )
  ];
  const projection = createEnvironmentInfoProjection({
    spawnArea,
    resource: [
      record("rich", "Rich", {
        arid: 0.25,
        green: 0.004,
        swamp: 0.6,
        "copper mult": 0.13,
        "iron mult": 0,
        "stone mult": 1.8,
        "water mult": 2
      }),
      record("thin", "Thin", {
        arid: 0,
        green: 0.003,
        swamp: -1,
        "copper mult": 0,
        "iron mult": -2,
        "stone mult": 0,
        "water mult": 0
      }),
      record("fake", "Fake", {
        arid: 100,
        green: 100,
        swamp: 100,
        "copper mult": 100,
        "iron mult": 100,
        "stone mult": 100,
        "water mult": 100
      })
    ],
    season: [record("season", "Season", {}, { weathers: [ref("weather")] })],
    weather: [
      record(
        "weather",
        "Weather",
        { "affect type": 2 },
        { effects: [ref("dust"), ref("gas"), ref("burn")] }
      )
    ],
    effect: [
      record("dust", "Dust", { "affect type": 1 }),
      record("gas", "Gas", { "affect type": 4 }),
      record("burn", "Burn", { "affect type": 3 })
    ]
  });
  const rasterColors = [1, 2, 3, 1, 2, 3, 1, 2, 3];
  const areaIndex = createPoliticalAreaIndex({
    spawnAreas: spawnArea,
    raster: {
      width: 3,
      height: 3,
      data: new Uint8Array(rasterColors.flatMap((color) => [0, 0, color, 255]))
    }
  });
  return { projection, areaIndex };
}

test("Prospecting catalog keeps exact authored areas, raw maxima, and map limitations", () => {
  const { projection, areaIndex } = fixture();
  const catalog = createProspectingCatalog({ projection, areaIndex });
  assert.equal(catalog.available, true);
  assert.equal(catalog.areas.length, 5);
  assert.equal(catalog.byId["18003-gamedata.base"], undefined);
  assert.deepEqual(
    NUMERIC_CRITERIA.map(({ id }) => id),
    ["arid", "green", "swamp", "copper", "iron", "stone", "water"]
  );
  assert.deepEqual(
    CONDITION_CRITERIA.map(({ id }) => id),
    ["acidGround", "acidWater", "gas", "acidRain", "duststorm", "burning"]
  );
  assert.equal(catalog.maxima.green, 0.004);
  assert.equal(catalog.maxima.copper, 0.13);
  assert.equal(catalog.maxima.iron, 0);
  assert.equal(catalog.byId.b.resources.multipliers.iron, null);
  assert.equal(catalog.byId.a.mapStatus, "shared");
  assert.equal(catalog.byId.d.mapStatus, "mapped");
  assert.equal(catalog.byId.unmapped.mapStatus, "unmapped");
  assert.equal(catalog.byId.unknown.resourceStatus, "missing-reference");
  assert.equal(createProspectingCatalog({ projection }).byId.a.mapStatus, "geography-unavailable");
  assert.throws(() => {
    catalog.byId.a.resources.fertility.green = 5;
  }, TypeError);
});

test("all selected types intersect with inclusive raw minimums and positive-only zero setting", () => {
  const catalog = createProspectingCatalog(fixture());
  const zero = projectProspecting({ catalog });
  assert.deepEqual(zero.matchingAreaIds, []);
  assert.equal(zero.criteriaCount, 0);

  const green = projectProspecting({ catalog, selectedNumeric: ["green"] });
  assert.deepEqual(green.matchingAreaIds, ["d", "unmapped", "a", "b"]);
  assert.equal(green.uncertainCount, 1);
  assert.equal(green.areas[0].matchingReadings[0].raw, 0.004);
  assert.equal(green.areas[0].matchingReadings[0].unit, "%");
  assert.deepEqual(
    projectProspecting({ catalog, selectedNumeric: ["green"], minimums: { green: 0.004 } })
      .matchingAreaIds,
    ["d", "unmapped", "a"]
  );
  assert.deepEqual(
    projectProspecting({ catalog, selectedNumeric: ["green"], minimums: { green: 0.0041 } })
      .matchingAreaIds,
    []
  );
  assert.deepEqual(projectProspecting({ catalog, selectedNumeric: ["iron"] }).matchingAreaIds, []);
  assert.equal(projectProspecting({ catalog, selectedNumeric: ["iron"] }).uncertainCount, 2);

  const intersection = projectProspecting({
    catalog,
    selectedNumeric: ["green", "copper", "green"],
    selectedConditions: ["acidRain", "acidGround"]
  });
  assert.deepEqual(intersection.matchingAreaIds, ["a"]);
  assert.equal(intersection.criteriaCount, 4);
  assert.equal(intersection.areas[0].matchingReadings.length, 4);
  assert.equal(intersection.areas[0].matchingReadings[3].state, "recorded");
});

test("recorded weather survives incomplete links but unresolved and unauthored states are uncertain", () => {
  const catalog = createProspectingCatalog(fixture());
  assert.deepEqual(
    projectProspecting({ catalog, selectedConditions: ["acidRain"] }).matchingAreaIds,
    ["d", "a", "b"]
  );
  assert.equal(catalog.byId.b.weatherSourceState, "incomplete");
  assert.equal(catalog.byId.b.conditions.find(({ id }) => id === "acidRain").state, "recorded");
  assert.equal(
    catalog.byId.unknown.conditions.find(({ id }) => id === "gas").state,
    "not-authored"
  );
  const gas = projectProspecting({ catalog, selectedConditions: ["gas"] });
  assert.deepEqual(gas.matchingAreaIds, ["d", "a", "b"]);
  assert.equal(gas.uncertainCount, 2);
  const ground = projectProspecting({ catalog, selectedConditions: ["acidGround"] });
  assert.deepEqual(ground.matchingAreaIds, ["unmapped", "a"]);
  assert.equal(ground.uncertainCount, 1);
  assert.deepEqual(
    projectProspecting({
      catalog,
      selectedConditions: CONDITION_CRITERIA.map(({ id }) => id)
    }).matchingAreaIds,
    ["a"]
  );
});

test("raster is solid for complete matching identities, hatches mixed colors, and returns copies", () => {
  const { projection, areaIndex } = fixture();
  const catalog = createProspectingCatalog({ projection, areaIndex });
  const matches = projectProspecting({ catalog, selectedNumeric: ["green"] });
  const raster = createProspectingRaster({ areaIndex, matches });
  assert.equal(raster.available, true);
  assert.deepEqual(raster.statusCounts, { solid: 1, caution: 1 });
  assert.deepEqual(raster.cautionAreaIds, ["a", "b"]);
  const first = raster.copyRgba();
  assert.equal(first.length, 3 * 3 * 4);
  assert.ok(first[3] > 0); // Color 1 is shared with excluded Void: caution.
  assert.ok(first[7] > 0); // Color 2 is fully matched: solid.
  assert.equal(first[11], 0); // Color 3 has no confirmed match.
  assert.equal(first[2 * 3 * 4 + 3], 0); // Caution hatching leaves gaps.
  first.fill(0);
  assert.ok(raster.copyRgba()[7] > 0);
  assert.equal(
    createProspectingRaster({ areaIndex: null, matches }).reason,
    "raster-geography-unavailable"
  );
});

test("a shared raster color is solid only when every linked area matches", () => {
  const areaIndex = createPoliticalAreaIndex({
    spawnAreas: [record("a", "First", { index: 1 }), record("b", "Second", { index: 1 })],
    raster: { width: 1, height: 1, data: new Uint8Array([0, 0, 1, 255]) }
  });
  const all = createProspectingRaster({
    areaIndex,
    matches: { available: true, matchingAreaIds: ["a", "b"] }
  });
  const one = createProspectingRaster({
    areaIndex,
    matches: { available: true, matchingAreaIds: ["a"] }
  });
  assert.deepEqual(all.statusCounts, { solid: 1, caution: 0 });
  assert.deepEqual(one.statusCounts, { solid: 0, caution: 1 });
  assert.deepEqual(one.cautionAreaIds, ["a"]);
});

test("environment unavailability does not fabricate areas or a raster", () => {
  const catalog = createProspectingCatalog({ projection: null });
  assert.equal(catalog.available, false);
  const matches = projectProspecting({ catalog, selectedNumeric: ["green"] });
  assert.equal(matches.available, false);
  assert.deepEqual(matches.matchingAreaIds, []);
  const raster = createProspectingRaster({ areaIndex: fixture().areaIndex, matches });
  assert.equal(raster.available, false);
  assert.equal(raster.copyRgba().length, 0);
});
