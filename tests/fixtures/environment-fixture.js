import { createEnvironmentInfoProjection } from "../../modules/environment-info-model.js";
import { createPoliticalAreaIndex } from "../../modules/political/area-index.js";
import { leafletToKenshi, MAP_HEIGHT, MAP_WIDTH } from "../../modules/selection/map-space.js";

const record = (StringId, Name, Values = {}, ReferenceCategories = {}) => ({
  StringId,
  Name,
  Values,
  ReferenceCategories
});
const ref = (StringId) => ({ StringId });

export function createEnvironmentFixture() {
  const projection = createEnvironmentInfoProjection({
    spawnArea: [
      record(
        "a",
        "Shared <b>name</b>",
        { index: 1, "acidic ground": 0, "acidic water": 1 },
        {
          resources: [ref("resources")],
          seasons: [ref("season")]
        }
      ),
      record(
        "b",
        "Shared <b>name</b>",
        { index: 1, "acidic water": 0 },
        {
          resources: [ref("missing"), ref("resources")],
          seasons: [ref("season"), ref("missing-season")]
        }
      ),
      record("empty", "No source", { index: 2 }),
      record(
        "18003-gamedata.base",
        "Excluded politically",
        { index: 3 },
        { resources: [ref("resources")] }
      )
    ],
    resource: [
      record("resources", "Resources", {
        arid: 0,
        green: 0.004,
        swamp: 0.3,
        "copper mult": 0.03,
        "iron mult": 1.25,
        "stone mult": -1,
        "water mult": 0
      })
    ],
    season: [record("season", "Season", {}, { weathers: [ref("weather"), ref("weather")] })],
    weather: [
      record(
        "weather",
        "Weather",
        { "affect type": 2 },
        {
          effects: [ref("dust"), ref("gas"), ref("burn"), ref("gas")]
        }
      )
    ],
    effect: [
      record("dust", "Dust", { "affect type": 1 }),
      record("gas", "Gas", { "affect type": 4 }),
      record("burn", "Burn", { "affect type": 3 })
    ]
  });
  const raster = {
    width: 2,
    height: 2,
    data: new Uint8Array([0, 0, 2, 255, 0, 0, 3, 255, 0, 0, 1, 255, 0, 0, 4, 255])
  };
  const areaIndex = createPoliticalAreaIndex({
    raster,
    spawnAreas: [
      record("a", "Shared <b>name</b>", { index: 1 }),
      record("b", "Shared <b>name</b>", { index: 1 }),
      record("empty", "No source", { index: 2 }),
      record("18003-gamedata.base", "Excluded politically", { index: 3 })
    ]
  });
  const point = (x, y) => leafletToKenshi({ lng: MAP_WIDTH * x, lat: MAP_HEIGHT * y });
  return {
    projection,
    areaIndex,
    points: {
      shared: point(0.25, 0.75),
      unmatched: point(0.75, 0.75),
      empty: point(0.25, 0.25),
      excluded: point(0.75, 0.25)
    }
  };
}
