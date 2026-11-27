import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  loadLocalDiscoveryBundle,
  parseDiscoveryAuditArguments,
  restoreDiscoveryNpmArguments,
  runDiscoveryAudit
} from "../scripts/audit-discovery-evidence.mjs";
import { createMapContractFixture } from "./fixtures/map-contract-fixture.js";
import { createScenarioFixture } from "./fixtures/scenario-fixture.js";

test("discovery CLI arguments require one explicit source", () => {
  assert.deepEqual(parseDiscoveryAuditArguments(["--manifest-id", "vanilla"]), {
    help: false,
    manifestId: "vanilla",
    bundlePath: null
  });
  assert.deepEqual(parseDiscoveryAuditArguments(["--bundle", "bundle"]), {
    help: false,
    manifestId: null,
    bundlePath: "bundle"
  });
  assert.deepEqual(restoreDiscoveryNpmArguments(["vanilla"], { npm_config_manifest_id: "true" }), [
    "--manifest-id",
    "vanilla"
  ]);
  assert.throws(() => parseDiscoveryAuditArguments([]), /exactly one/);
  assert.throws(
    () => parseDiscoveryAuditArguments(["--manifest-id", "vanilla", "--bundle", "bundle"]),
    /exactly one/
  );
});

test("discovery CLI rejects a remote manifest substitution", async () => {
  const contract = createMapContractFixture({ manifestId: "different" });
  const fetchImpl = async () => ({ ok: true, json: async () => contract });
  await assert.rejects(
    () => runDiscoveryAudit(["--manifest-id", "requested"], { fetchImpl }),
    /instead of requested/
  );
});

test("local discovery audit is deterministic and does not write its source bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "kimap-discovery-"));
  try {
    const contract = createMapContractFixture({ manifestId: "vanilla" });
    const scenario = createScenarioFixture({ manifestId: "vanilla" });
    const datasets = {
      ...scenario.datasets,
      animals: [],
      armours: [],
      crossbows: [],
      factionCampaigns: [],
      items: [],
      mapItems: [],
      nestItems: [],
      tradeCultures: [],
      vendorLists: [],
      weapons: []
    };
    await writeFile(join(root, "getmapdata.json"), JSON.stringify(contract), "utf8");
    for (const key of [
      "animals",
      "armours",
      "characters",
      "crossbows",
      "factionCampaigns",
      "factions",
      "items",
      "mapData",
      "mapItems",
      "nestItems",
      "spawnAreas",
      "squads",
      "townFcsData",
      "tradeCultures",
      "vendorLists",
      "weapons",
      "worldStates"
    ]) {
      await writeFile(join(root, `${key}.json`), JSON.stringify(datasets[key]), "utf8");
    }
    const before = (await readdir(root)).sort();
    assert.equal((await loadLocalDiscoveryBundle(root)).contract.userData.manifestId, "vanilla");
    const first = await runDiscoveryAudit(["--bundle", root]);
    const second = await runDiscoveryAudit(["--bundle", root]);
    assert.equal(JSON.stringify(first.audit), JSON.stringify(second.audit));
    assert.match(first.summary, /Discovery evidence audit/);
    assert.deepEqual((await readdir(root)).sort(), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discovery CLI exits non-zero for incomplete invocation", () => {
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/audit-discovery-evidence.mjs"), "--manifest-id"],
    { cwd: resolve("."), encoding: "utf8" }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Discovery audit failed/);
});
