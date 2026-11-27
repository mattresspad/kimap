import assert from "node:assert/strict";
import test from "node:test";
import {
  MapContractError,
  REQUIRED_DATASET_KEYS,
  buildMapDataApiUrl,
  commitRequiredDatasets,
  getKimapRuntimeConfig,
  loadRequiredDatasets,
  parseMapDataResponse
} from "../modules/map-contract.js";
import { createMapContractFixture } from "./fixtures/map-contract-fixture.js";

const runtimeOptions = { manifestDataOrigin: "https://map.kenshi.wiki" };

test("exact structured v3 is accepted with optional null assets", () => {
  const contract = parseMapDataResponse(createMapContractFixture(), runtimeOptions);

  assert.equal(contract.contractVersion, 3);
  assert.equal(contract.userData.isLoggedIn, false);
  assert.equal(Object.keys(contract.datasets).length, 36);
  assert.equal(
    contract.datasets.aiPackages.url,
    "https://map.kenshi.wiki/data/vanilla/test/aiPackages.json"
  );
  assert.equal(contract.assets.areasMap.url, null);
});

test("Caravan contract v2 and unknown versions are rejected", () => {
  for (const version of [2, 4]) {
    const fixture = createMapContractFixture();
    fixture.getmapdata.contractVersion = version;

    assert.throws(
      () => parseMapDataResponse(fixture, runtimeOptions),
      (error) => error instanceof MapContractError && error.code === "unsupported_contract"
    );
  }
});

test("a missing structured dataset is rejected even when removed legacy data exists", () => {
  const fixture = createMapContractFixture();
  delete fixture.getmapdata.datasets.factions;
  fixture.getmapdata.factionsUrl = "/legacy/factions.json";
  fixture.getmapdata.factions = [];

  assert.throws(
    () => parseMapDataResponse(fixture, runtimeOptions),
    (error) => error instanceof MapContractError && error.code === "invalid_metadata"
  );
});

test("manifest identity and asset source metadata must remain consistent", () => {
  const wrongManifest = createMapContractFixture();
  wrongManifest.getmapdata.manifest.id = "different";
  assert.throws(
    () => parseMapDataResponse(wrongManifest, runtimeOptions),
    (error) => error instanceof MapContractError && error.code === "invalid_metadata"
  );

  const missingSource = createMapContractFixture();
  delete missingSource.getmapdata.assets.buildingLocations.source;
  assert.throws(
    () => parseMapDataResponse(missingSource, runtimeOptions),
    (error) => error instanceof MapContractError && error.code === "invalid_metadata"
  );
});

test("runtime config reads the static Vanilla envelope from the map origin", () => {
  const config = getKimapRuntimeConfig({
    hostname: "127.0.0.1",
    origin: "http://127.0.0.1:8000"
  });
  const apiUrl = new URL(buildMapDataApiUrl(config));

  assert.equal(apiUrl.origin, "http://127.0.0.1:8000");
  assert.equal(apiUrl.pathname, "/map-data/vanilla.json");
  assert.equal(apiUrl.search, "");
  assert.equal(config.manifestDataOrigin, "http://127.0.0.1:8000");
});

test("all required datasets stage successfully before handlers commit", async () => {
  const contract = parseMapDataResponse(createMapContractFixture(), runtimeOptions);
  const loaded = await loadRequiredDatasets(contract, async (url) =>
    Response.json([{ url, StringId: "fixture" }])
  );
  const committed = [];
  const queue = REQUIRED_DATASET_KEYS.map((key) => ({
    key,
    handler: (data) => committed.push([key, data[0].StringId])
  }));

  assert.equal(Object.keys(loaded).length, 36);
  assert.equal(committed.length, 0);
  commitRequiredDatasets(queue, loaded, { contractVersion: 3, manifestId: "vanilla" });
  assert.equal(committed.length, 36);
});

test("required HTTP and JSON failures stop dataset staging", async () => {
  const contract = parseMapDataResponse(createMapContractFixture(), runtimeOptions);

  await assert.rejects(
    loadRequiredDatasets(contract, async (url) =>
      url.includes("/factions.json") ? new Response("missing", { status: 404 }) : Response.json([])
    ),
    (error) => error instanceof MapContractError && error.code === "dataset_http_error"
  );

  await assert.rejects(
    loadRequiredDatasets(contract, async (url) =>
      url.includes("/factions.json") ? new Response("not-json", { status: 200 }) : Response.json([])
    ),
    (error) => error instanceof MapContractError && error.code === "dataset_json_error"
  );
});

test("a throwing handler makes initialization fatal", async () => {
  const contract = parseMapDataResponse(createMapContractFixture(), runtimeOptions);
  const loaded = await loadRequiredDatasets(contract, async () => Response.json([]));
  const queue = REQUIRED_DATASET_KEYS.map((key) => ({
    key,
    handler: () => {
      if (key === "factions") throw new Error("fixture handler failure");
    }
  }));

  assert.throws(
    () => commitRequiredDatasets(queue, loaded, { contractVersion: 3, manifestId: "vanilla" }),
    (error) => error instanceof MapContractError && error.code === "dataset_handler_error"
  );
});

test("every required dataset must have exactly one commit handler", async () => {
  const contract = parseMapDataResponse(createMapContractFixture(), runtimeOptions);
  const loaded = await loadRequiredDatasets(contract, async () => Response.json([]));
  const queue = REQUIRED_DATASET_KEYS.slice(1).map((key) => ({ key, handler: () => {} }));

  assert.throws(
    () => commitRequiredDatasets(queue, loaded, { contractVersion: 3, manifestId: "vanilla" }),
    (error) => error instanceof MapContractError && error.code === "invalid_dataset_handler"
  );
});
