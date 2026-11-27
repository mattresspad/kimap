import { createMapContractFixture } from "../tests/fixtures/map-contract-fixture.js";
import { createScenarioFixture } from "../tests/fixtures/scenario-fixture.js";
import { REQUIRED_DATASET_KEYS } from "../modules/map-contract.js";

export const sampleNamespace = "kimap-survey-v1";
export const sampleTown = "Survey Station";
export const sampleLandmarks = {
  features: [
    { TargetId: "beacon", X: 0, Z: 0 },
    { TargetId: "beacon", X: 900, Z: 660 }
  ],
  fog: [],
  whitelist: { beacon: { title: "Survey beacon", description: "A fixed point for surveyors." } }
};
export const north = 0x687e6c;
export const south = 0xc4a675;

// Uncompressed 24-bit TGA stores BGR samples starting in its bottom-left corner.
function areaRaster() {
  const size = 16;
  const bytes = Buffer.alloc(18 + 3 * size * size);
  bytes[2] = 2;
  bytes.writeUInt16LE(size, 12);
  bytes.writeUInt16LE(size, 14);
  bytes[16] = 24;
  for (let cell = 0; cell < size * size; cell++) {
    bytes.writeUIntLE(cell < (size * size) / 2 ? south : north, 18 + cell * 3, 3);
  }
  return bytes;
}

export function createPublication(artwork) {
  const { getmapdata: map } = createMapContractFixture();
  map.manifest.title = "Survey Station · contributor fixture";
  map.manifest.description = "An original miniature survey map for local development.";
  const prefix = "/data/vanilla/" + sampleNamespace + "/1/";
  const { datasets } = createScenarioFixture();
  datasets.townFcsData[0].Name = sampleTown;
  datasets.townFcsData[0].Values["town type"] = 2;
  datasets.mapData[0] = { ...datasets.mapData[0], Name: sampleTown, X: 0, Y: 0, Z: 0 };
  datasets.spawnAreas[0].Name = "North Shelf";
  datasets.spawnAreas[0].Values.index = north;
  datasets.spawnAreas.push({
    Name: "South Shelf",
    StringId: "area-south",
    Values: { index: south },
    ReferenceCategories: {}
  });
  const objects = new Map();
  const json = (path, value) =>
    objects.set(path, { body: JSON.stringify(value), type: "application/json" });
  for (const key of REQUIRED_DATASET_KEYS) {
    const path = prefix + key + ".json";
    map.datasets[key].url = path;
    json(path, datasets[key] ?? []);
  }
  map.assets.buildingLocations.url = prefix + "building_locations.json";
  json(map.assets.buildingLocations.url, []);
  map.assets.roadNetwork.url = artwork + "/data/overlays/Vanilla_RoadNetwork.svg";
  map.assets.areasMap = { required: false, source: "fixture", url: prefix + "areas.tga" };
  objects.set(map.assets.areasMap.url, { body: areaRaster(), type: "image/x-tga" });
  json("/map-data/vanilla.json", { getmapdata: map });
  return { map, objects };
}
