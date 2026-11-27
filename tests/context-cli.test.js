import assert from "node:assert/strict";
import test from "node:test";

import {
  auditContextBundle,
  parseContextAuditArguments,
  runContextAudit
} from "../scripts/audit-context-evidence.mjs";
import { createScenarioFixture } from "./fixtures/scenario-fixture.js";

function onePixelTga() {
  const header = Buffer.alloc(18);
  header[2] = 2;
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(1, 14);
  header[16] = 24;
  return Buffer.concat([header, Buffer.from([0, 0, 255])]);
}

test("Context audit CLI requires one explicit read-only source", async () => {
  assert.deepEqual(parseContextAuditArguments(["--manifest-id", "vanilla"]), {
    help: false,
    manifestId: "vanilla",
    bundlePath: null
  });
  assert.throws(() => parseContextAuditArguments([]), /exactly one/u);
  const help = await runContextAudit(["--help"]);
  assert.match(help.usage, /audit:context/u);
});

test("Context bundle audits are deterministic aggregate projections", () => {
  const fixture = createScenarioFixture({ manifestId: "vanilla" });
  const datasets = {
    ...fixture.datasets,
    animals: [],
    armours: [],
    crossbows: [],
    factionCampaigns: [],
    items: [],
    mapItems: [],
    nestItems: [],
    vendorLists: [],
    weapons: []
  };
  const rasterBuffer = onePixelTga();
  const first = auditContextBundle({ contract: fixture.contract, datasets, rasterBuffer });
  const second = auditContextBundle({ contract: fixture.contract, datasets, rasterBuffer });
  assert.deepEqual(first, second);
  assert.deepEqual(first.characters, {
    total: 2,
    usable: 0,
    unused: 2,
    worldStateCandidates: 2,
    bountyCandidates: 0
  });
  assert.equal(first.keyCharacters.total, 0);
  assert.equal(first.bountyTargets.total, 0);
  assert.deepEqual(first.animals, {
    total: 0,
    usable: 0,
    unused: 0,
    deadly: 0,
    qualifyingReasons: { strength: 0, deathItemValue: 0, both: 0 },
    unresolvedEligibility: 0,
    campaignOnly: 0,
    deadSquad: 0,
    placements: {}
  });
});
