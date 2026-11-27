import assert from "node:assert/strict";
import test from "node:test";

import {
  EFFECT_LABELS,
  createEnvironmentInfoProjection
} from "../modules/environment-info-model.js";

function reference(StringId, Name = StringId) {
  return { StringId, Name, Value0: 1 };
}

function record(StringId, Name, Values = {}, ReferenceCategories = {}) {
  return { StringId, Name, Values, ReferenceCategories };
}

test("environment projection joins exact IDs, curates fields, and distinguishes zero from missing", () => {
  const projection = createEnvironmentInfoProjection({
    spawnArea: {
      second: record(
        "area-b",
        "Duplicate Name",
        {
          "acidic ground": 0,
          "acidic water": 1,
          "farm water usage": 0,
          "homeless spawn amount": 1.6,
          "num nests": 4,
          "nests at fixed markers only": false,
          "weather strength multiplier min": 0,
          "weather strength multiplier max": 1
        },
        {
          seasons: [reference("season-one"), reference("season-missing")],
          resources: [reference("resource-one")]
        }
      ),
      first: record("area-a", "Duplicate Name", {}, { resources: [reference("missing-resource")] })
    },
    season: {
      arbitraryKey: record(
        "season-one",
        "Dry Season",
        {},
        {
          weathers: [
            reference("weather-one"),
            reference("weather-one"),
            reference("weather-missing")
          ]
        }
      )
    },
    weather: {
      weather: record(
        "weather-one",
        "Ash Storm",
        { "affect type": 2 },
        {
          effects: [reference("effect-acid"), reference("effect-acid"), reference("effect-dust")]
        }
      )
    },
    effect: {
      acid: record("effect-acid", "Acid", { "affect type": 2 }),
      dust: record("effect-dust", "Dust", { "affect type": 1 })
    },
    resource: {
      resource: record("resource-one", "Bast Resources", {
        arid: 1,
        green: 0,
        swamp: 0.1,
        "copper mult": 0,
        "iron mult": 1,
        "water mult": 2
      })
    }
  });

  assert.deepEqual(
    projection.areas.map((area) => area.id),
    ["area-a", "area-b"]
  );
  const area = projection.byId["area-b"];
  assert.deepEqual(area.profile, {
    farmWaterUsage: 0,
    homelessSpawnAmount: 1.6,
    nestCount: 4,
    fixedMarkersOnly: false,
    weatherStrengthMinimum: 0,
    weatherStrengthMaximum: 1
  });
  assert.deepEqual(
    area.environment.seasons.map((entry) => entry.name),
    ["Dry Season"]
  );
  assert.deepEqual(
    area.environment.weathers.map((entry) => entry.name),
    ["Ash Storm"]
  );
  assert.deepEqual(
    area.environment.zoneEffects.map((entry) => entry.label),
    ["Acidic Water"]
  );
  assert.deepEqual(
    area.environment.weatherEffects.map((entry) => entry.label),
    ["Acid Rain", "Duststorm"]
  );
  assert.deepEqual(
    area.environment.unresolved.map((entry) => `${entry.kind}:${entry.id}`),
    ["Weather:weather-missing", "Season:season-missing"]
  );
  assert.equal(area.resources.fertility.green, 0);
  assert.equal(area.resources.multipliers.copper, 0);
  assert.equal(area.resources.multipliers.stone, null);
  assert.equal(projection.byId["area-a"].resources.status, "unresolved-reference");
  assert.deepEqual(EFFECT_LABELS, {
    1: "Duststorm",
    2: "Acid Rain",
    3: "Burning",
    4: "Gas"
  });
  assert.throws(() => {
    projection.byId["area-b"].profile.nestCount = 9;
  }, TypeError);
});

test("environment projection never falls back from an unresolved ID to a duplicate display name", () => {
  const projection = createEnvironmentInfoProjection({
    spawnArea: [
      record(
        "area",
        "Area",
        {},
        {
          seasons: [reference("missing-season", "Shared Name")],
          resources: [reference("missing-resource", "Shared Resources")]
        }
      )
    ],
    season: [record("real-season", "Shared Name")],
    resource: [record("real-resource", "Shared Resources")]
  });

  const area = projection.byId.area;
  assert.equal(area.environment.seasons.length, 0);
  assert.deepEqual(area.environment.unresolved, [{ kind: "Season", id: "missing-season" }]);
  assert.equal(area.resources.status, "unresolved-reference");
  assert.equal(area.resources.sourceId, "missing-resource");
});
