import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createMapContractFixture } from "./fixtures/map-contract-fixture.js";
import {
  COLORS,
  coordinateForPixel,
  createPoliticalFixture,
  createReplacedFactionIdProjection,
  rasterFromRows
} from "./fixtures/political-fixture.js";
import { createScenarioFixture } from "./fixtures/scenario-fixture.js";
import {
  POLITICAL_CONFIDENCE_RULES,
  POLITICAL_SOURCE_MIXES,
  POLITICAL_TOWN_METRICS,
  createPoliticalAreaIndex,
  createPoliticalAudit,
  createPoliticalEvidenceCatalog,
  evaluatePoliticalInfluence,
  projectPoliticalEvidence
} from "../modules/political/index.js";
import {
  loadLocalPoliticalBundle,
  parseAuditArguments,
  restoreNpmForwardedArguments,
  runPoliticalAudit
} from "../scripts/audit-political-evidence.mjs";

function createIndex(fixture = createPoliticalFixture()) {
  return createPoliticalAreaIndex({
    raster: fixture.raster,
    spawnAreas: fixture.baseline.spawnAreas
  });
}

function createProjection(fixture = createPoliticalFixture()) {
  const areaIndex = createIndex(fixture);
  const catalog = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex });
  return {
    areaIndex,
    catalog,
    projection: projectPoliticalEvidence({ catalog, snapshot: fixture.snapshot })
  };
}

function simpleRecord({
  id,
  kind = "town",
  factionId = "faction-a",
  value = 1,
  valid = true,
  areaId = "area"
}) {
  return {
    id,
    occurrenceId: id,
    areaId: kind === "town" ? "" : areaId,
    geometryKey: "1,2,3",
    kind,
    state: "current",
    factionId,
    exclusionReason: null,
    metrics: {
      inhabitedOccurrences: { value, valid },
      residentReferences: { value, valid },
      residentPlacements: { value, valid }
    },
    relativeWeight: { value, valid },
    areaScalar: { value: 2, valid: true }
  };
}

function simpleProjection(records, geometry = {}) {
  return {
    available: true,
    reason: null,
    manifestId: "policy-fixture",
    factions: [
      { id: "faction-a", name: "Faction A", notReal: false, paletteIds: [] },
      { id: "faction-b", name: "Faction B", notReal: false, paletteIds: [] }
    ],
    geometries: [
      {
        key: "1,2,3",
        areaIds: ["area"],
        cellCount: 10,
        excluded: false,
        indeterminate: false,
        records,
        ...geometry
      }
    ],
    towns: [],
    homelessSpawns: [],
    nests: [],
    unattributed: [],
    conditional: [],
    excluded: [],
    diagnostics: []
  };
}

function evaluate(projection, overrides = {}) {
  return evaluatePoliticalInfluence({
    projection,
    participantIds: ["faction-a", "faction-b"],
    townMetric: "inhabitedOccurrences",
    sourceMix: "equal",
    confidenceRule: "plurality",
    ...overrides
  });
}

test("political area index keeps complete components, shared colors, exclusions, and tiny cells", () => {
  const fixture = createPoliticalFixture();
  const originalRaster = fixture.raster.data.slice();
  const index = createIndex(fixture);
  const shared = index.getGeometryByColorKey("255,0,0");
  const core = index.getGeometryForAreaId("18003-gamedata.base");
  const easternNone = index.getGeometryForAreaId("56123-rebirth.mod");
  const unknown = index.getGeometryByColorKey("0,0,255");

  assert.equal(index.totalCellCount, 8);
  assert.equal(shared.cellCount, 3);
  assert.equal(shared.componentCount, 2);
  assert.deepEqual(
    shared.components.map(({ cellCount }) => cellCount),
    [2, 1]
  );
  assert.deepEqual(shared.areaIds, ["area-a", "area-b"]);
  assert.equal(shared.ambiguous, true);
  assert.equal(shared.indeterminate, false);
  assert.equal(core.excluded, true);
  assert.equal(easternNone.excluded, false);
  assert.equal(unknown.cellCount, 1);
  assert.equal(unknown.componentCount, 1);
  assert.equal(unknown.indeterminate, true);
  assert.equal(index.getGeometryForAreaId("area-no-pixels").cellCount, 0);
  assert.equal(index.getGeometryAtKenshi(coordinateForPixel(2, 0)).key, "0,255,0");
  assert.equal(index.getComponentAtKenshi(coordinateForPixel(3, 0)).cellCount, 1);
  assert.deepEqual(fixture.raster.data, originalRaster);
  assert.ok(Object.isFrozen(index));
  assert.ok(Object.isFrozen(shared.components[0].bounds));
  assert.ok(index.diagnostics.some(({ code }) => code === "political_area_color_shared"));
  assert.ok(index.diagnostics.some(({ code }) => code === "political_raster_color_unknown"));
});

test("a raster color shared by excluded and included records is indeterminate", () => {
  const raster = rasterFromRows([[COLORS.core]]);
  const index = createPoliticalAreaIndex({
    raster,
    spawnAreas: [
      { StringId: "18003-gamedata.base", Name: "NONE", Values: { index: COLORS.core } },
      { StringId: "included", Name: "Included", Values: { index: COLORS.core } }
    ]
  });
  const geometry = index.getGeometryByColorKey("0,0,0");
  assert.equal(geometry.excluded, false);
  assert.equal(geometry.indeterminate, true);
  assert.equal(geometry.mixedExclusion, true);
  assert.ok(index.diagnostics.some(({ code }) => code === "political_area_color_mixed_exclusion"));
});

test("catalog joins residents, tenant factions, occurrences, and area pressure immutably", () => {
  const fixture = createPoliticalFixture();
  const baselineBefore = structuredClone(fixture.baseline);
  const index = createIndex(fixture);
  const first = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex: index });
  const second = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex: index });
  const base = first.residentByTownId["town-base"];

  assert.equal(base.residentReferenceCount, 2);
  assert.equal(base.qualifyingReferenceCount, 1);
  assert.equal(base.residentPlacementTotal, 2);
  assert.deepEqual(base.qualifying[0].tenantFactions.resolvedIds, ["tenant"]);
  assert.equal(base.qualifying[0].memberRanges[0].value1, 0);
  assert.equal(first.residentByTownId["town-ruin"].residentPlacementTotal, 1);
  assert.equal(first.townOccurrences.length, 5);
  assert.notEqual(first.townOccurrences[0].componentId, first.townOccurrences[1].componentId);
  const areaA = first.spawnAreas.find(({ id }) => id === "area-a");
  assert.equal(areaA.homelessSpawnAmount.value, 4);
  assert.equal(areaA.occurrences[0].relativeWeight.value, 3);
  assert.equal(areaA.occurrences[1].factions.ambiguous, true);
  assert.deepEqual(fixture.baseline, baselineBefore);
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.residentByTownId["town-base"].qualifying[0]));
});

test("resident qualification covers structural occupants while ignoring non-resident categories", () => {
  const fixture = createPoliticalFixture();
  const categories = [
    "leader",
    "squad",
    "squad2",
    "animals",
    "animals2",
    "housemates",
    "choosefrom list",
    "random character"
  ];
  const residentReferences = [];
  for (const [position, category] of categories.entries()) {
    const id = `structural-${String(position)}`;
    const member = {
      StringId: `member-${String(position)}`,
      Name: "Member",
      Value0: category === "leader" ? 0 : 1,
      Value1: category === "squad2" ? 3 : 0,
      Value2: 0
    };
    const squad = {
      id,
      name: id,
      raw: {
        StringId: id,
        Name: id,
        Values: {},
        ReferenceCategories: { [category]: [member] }
      }
    };
    fixture.baseline.squads.push(squad);
    fixture.baseline.squadById[id] = squad;
    residentReferences.push({ StringId: id, Name: id, Value0: 0, Value1: 99, Value2: 0 });
  }
  const ignored = {
    id: "ignored-squad",
    name: "Ignored",
    raw: {
      StringId: "ignored-squad",
      Name: "Ignored",
      Values: {},
      ReferenceCategories: {
        "bar squads": [{ StringId: "member", Value0: 5, Value1: 5 }],
        "roaming squads": [{ StringId: "member", Value0: 5, Value1: 5 }]
      }
    }
  };
  fixture.baseline.squads.push(ignored);
  fixture.baseline.squadById[ignored.id] = ignored;
  residentReferences.push({ StringId: ignored.id, Value0: 10, Value1: 0 });
  fixture.baseline.townById["town-base"].raw.ReferenceCategories.residents = residentReferences;

  const catalog = createPoliticalEvidenceCatalog({
    baseline: fixture.baseline,
    areaIndex: createIndex(fixture)
  });
  const profile = catalog.residentByTownId["town-base"];
  assert.equal(profile.qualifyingReferenceCount, categories.length);
  assert.equal(profile.residentPlacementTotal, categories.length);
  assert.deepEqual(
    profile.qualifying.map(({ memberRanges }) => memberRanges[0].category),
    categories
  );
  assert.equal(
    profile.qualifying.find(({ squadId }) => squadId === "structural-2").memberRanges[0].value1,
    3
  );
});

test("incomplete resident references invalidate only affected town metrics", () => {
  const fixture = createPoliticalFixture();
  fixture.baseline.townById["town-base"].raw.ReferenceCategories.residents.push({
    StringId: "missing-resident-squad",
    Value0: 1,
    Value1: 0
  });
  const { projection } = createProjection(fixture);
  const inhabited = evaluate(projection, { townMetric: "inhabitedOccurrences" });
  const references = evaluate(projection, { townMetric: "residentReferences" });
  const findShared = (result) => result.areas.find(({ geometryKey }) => geometryKey === "255,0,0");
  assert.notEqual(findShared(inhabited).status, "indeterminate");
  assert.equal(findShared(references).status, "indeterminate");
});

test("projection selects effective towns, preserves repeated nodes, and partitions spawn statuses", () => {
  const fixture = createPoliticalFixture();
  const { catalog, projection } = createProjection(fixture);

  assert.equal(projection.towns.length, 3);
  assert.equal(
    projection.towns.filter(({ activeTownId }) => activeTownId === "town-base").length,
    2
  );
  assert.ok(projection.towns.some(({ activeTownId }) => activeTownId === "town-ruin"));
  assert.ok(projection.towns.every(({ factionId }) => factionId === "faction-a"));
  assert.ok(projection.towns.every(({ tenantFactionIds }) => tenantFactionIds.includes("tenant")));
  assert.equal(projection.homelessSpawns.length, 1);
  assert.equal(projection.unattributed.length, 1);
  assert.equal(projection.conditional.length, 2);
  assert.equal(projection.excluded.length, 2);
  assert.ok(
    projection.excluded.some(({ exclusionReason }) => exclusionReason === "excluded-geography")
  );
  assert.ok(
    projection.excluded.some(({ exclusionReason }) => exclusionReason === "unmapped-occurrence")
  );
  assert.ok(Object.isFrozen(projection));

  const changed = structuredClone(fixture.snapshot);
  changed.world.towns["town-base"] = {
    activeTownId: "town-override",
    name: "Empty Override",
    ownerId: "faction-b",
    owner: "Faction B"
  };
  changed.world.spawns["area-a"].entries["area-a:Nest:nest-town"].status = "Active";
  changed.world.spawns["area-a"].entries["area-a:Squad:homeless"].status = "Eliminated";
  const updated = projectPoliticalEvidence({ catalog, snapshot: changed });
  const replaced = updated.towns.filter(({ activeTownId }) => activeTownId === "town-override");
  assert.equal(replaced.length, 2);
  assert.ok(replaced.every(({ factionId }) => factionId === "faction-b"));
  assert.ok(replaced.every(({ metrics }) => metrics.inhabitedOccurrences.value === 0));
  assert.equal(updated.nests.length, 1);
  assert.ok(updated.excluded.some(({ exclusionReason }) => exclusionReason === "eliminated"));
  assert.deepEqual(fixture.snapshot.world.spawns["area-a"].entries["area-a:Nest:nest-town"], {
    status: "Potential"
  });

  const incomplete = structuredClone(fixture.snapshot);
  delete incomplete.world.spawns["area-a"].entries["area-a:Squad:homeless"];
  const incompleteProjection = projectPoliticalEvidence({ catalog, snapshot: incomplete });
  const incompletePolicy = evaluate(incompleteProjection);
  assert.equal(
    incompletePolicy.areas.find(({ geometryKey }) => geometryKey === "255,0,0").status,
    "indeterminate"
  );
});

test("fixed and authored source mixes preserve denominators and expose sensitivity", () => {
  const { projection } = createProjection();
  const equal = evaluate(projection);
  const townHeavy = evaluate(projection, { sourceMix: "townHeavy" });
  const spawnHeavy = evaluate(projection, { sourceMix: "spawnHeavy" });
  const local = evaluate(projection, { sourceMix: "authoredLocal" });
  const total = evaluate(projection, { sourceMix: "authoredTotal" });
  const shared = (result) => result.areas.find(({ geometryKey }) => geometryKey === "255,0,0");

  assert.equal(shared(equal).status, "dominant");
  assert.equal(shared(equal).winnerId, "faction-a");
  assert.equal(shared(townHeavy).winnerId, "faction-a");
  assert.equal(shared(spawnHeavy).winnerId, "faction-b");
  assert.equal(shared(local).status, "disputed");
  assert.equal(shared(total).winnerId, "faction-b");
  assert.ok(shared(equal).contributions.some(({ factionId }) => factionId === null));
  assert.equal(
    shared(equal).contributions.reduce((sum, { share }) => sum + share, 0),
    1
  );
});

test("authored local and total pressure apply area density and nest scalars separately", () => {
  const projection = simpleProjection([
    simpleRecord({ id: "homeless-a", kind: "homelessSpawn", factionId: "faction-a", value: 3 }),
    simpleRecord({ id: "homeless-b", kind: "homelessSpawn", factionId: "faction-b", value: 1 }),
    {
      ...simpleRecord({ id: "nest-b", kind: "nest", factionId: "faction-b", value: 1 }),
      areaScalar: { value: 5, valid: true }
    }
  ]);
  const local = evaluate(projection, { sourceMix: "authoredLocal" }).areas[0];
  const total = evaluate(projection, { sourceMix: "authoredTotal" }).areas[0];
  assert.equal(local.winnerId, "faction-b");
  assert.equal(local.channelTotals.homelessSpawn, 2);
  assert.equal(local.channelTotals.nest, 5);
  assert.equal(total.winnerId, "faction-a");
  assert.equal(total.channelTotals.homelessSpawn, 20);
  assert.equal(total.channelTotals.nest, 5);

  const townOnly = evaluate(
    simpleProjection([simpleRecord({ id: "town-only", factionId: "faction-a" })])
  ).areas[0];
  assert.equal(townOnly.contributions[0].share, 1);
});

test("all town metrics, source mixes, and confidence rules are accepted", () => {
  const { projection } = createProjection();
  for (const townMetric of POLITICAL_TOWN_METRICS) {
    for (const sourceMix of POLITICAL_SOURCE_MIXES) {
      for (const confidenceRule of POLITICAL_CONFIDENCE_RULES) {
        const result = evaluate(projection, { townMetric, sourceMix, confidenceRule });
        assert.equal(result.available, true);
        assert.equal(result.areas.length, projection.geometries.length);
        assert.ok(Object.isFrozen(result));
      }
    }
  }
});

test("confidence, filtering, attribution, exclusions, ties, and invalid data remain explicit", () => {
  const dominant = simpleProjection([
    simpleRecord({ id: "a", factionId: "faction-a", value: 6 }),
    simpleRecord({ id: "b", factionId: "faction-b", value: 4 })
  ]);
  assert.equal(evaluate(dominant).areas[0].status, "dominant");
  assert.equal(
    evaluate(dominant, { confidenceRule: "share67Margin33" }).areas[0].status,
    "disputed"
  );
  assert.equal(evaluate(dominant, { participantIds: ["faction-b"] }).areas[0].status, "filtered");

  const tied = simpleProjection([
    simpleRecord({ id: "a", factionId: "faction-a" }),
    simpleRecord({ id: "b", factionId: "faction-b" })
  ]);
  assert.equal(evaluate(tied).areas[0].status, "disputed");

  const unattributed = simpleProjection([
    simpleRecord({ id: "unknown", factionId: null, value: 3 }),
    simpleRecord({ id: "known", factionId: "faction-a", value: 1 })
  ]);
  assert.equal(evaluate(unattributed).areas[0].status, "unattributed");
  assert.equal(evaluate(simpleProjection([])).areas[0].status, "noEvidence");
  assert.equal(evaluate(simpleProjection([], { excluded: true })).areas[0].status, "excluded");
  assert.equal(
    evaluate(simpleProjection([], { indeterminate: true })).areas[0].status,
    "indeterminate"
  );
  assert.equal(
    evaluate(simpleProjection([simpleRecord({ id: "bad", valid: false })])).areas[0].status,
    "indeterminate"
  );
  const invalidScalar = simpleProjection([
    {
      ...simpleRecord({ id: "bad-scalar", kind: "homelessSpawn" }),
      areaScalar: { value: null, valid: false }
    }
  ]);
  assert.equal(evaluate(invalidScalar).areas[0].status, "dominant");
  assert.equal(
    evaluate(invalidScalar, { sourceMix: "authoredLocal" }).areas[0].status,
    "indeterminate"
  );
});

test("participant reconciliation uses stable IDs and never display names", () => {
  const projection = createReplacedFactionIdProjection();
  const result = evaluatePoliticalInfluence({
    projection,
    participantIds: ["new-shell", "new-shell", "missing-shell"],
    townMetric: "inhabitedOccurrences",
    sourceMix: "equal",
    confidenceRule: "plurality"
  });
  assert.equal(result.areas[0].status, "filtered");
  assert.equal(result.areas[0].winnerId, "old-shell");
  assert.deepEqual(result.participantIds, ["new-shell"]);
  assert.ok(result.diagnostics.some(({ code }) => code === "political_participant_id_unknown"));
  assert.ok(result.diagnostics.some(({ code }) => code === "political_participant_id_duplicate"));
  assert.throws(
    () => evaluatePoliticalInfluence({ projection, participantIds: null }),
    /explicit array/
  );
});

test("scenario and raster unavailability produce truthful immutable results", () => {
  const fixture = createPoliticalFixture();
  const missingRaster = createPoliticalEvidenceCatalog({
    baseline: fixture.baseline,
    areaIndex: null
  });
  assert.equal(missingRaster.available, false);
  assert.equal(missingRaster.reason, "raster-geography-unavailable");
  const projection = projectPoliticalEvidence({
    catalog: createPoliticalEvidenceCatalog({
      baseline: fixture.baseline,
      areaIndex: createIndex(fixture)
    }),
    snapshot: null
  });
  assert.equal(projection.available, false);
  assert.equal(projection.reason, "scenario-snapshot-unavailable");
  const evaluated = evaluate(projection);
  assert.equal(evaluated.available, false);
  assert.deepEqual(evaluated.areas, []);
  assert.ok(Object.isFrozen(projection));
});

test("aggregate audit evaluates sixty policies without installing a roster", () => {
  const { projection } = createProjection();
  const audit = createPoliticalAudit({
    projection,
    manifest: { id: "political-fixture", title: "Political Fixture" }
  });
  assert.equal(audit.policyStability.evaluatedPolicyCount, 60);
  assert.deepEqual(audit.participantRecommendation.participantIds, ["faction-a", "faction-b"]);
  assert.deepEqual(audit.participantRecommendation.groups.manifestNotReal, []);
  assert.equal(audit.geography.sharedRasterColors.length, 1);
  assert.equal(audit.unattributedRecords.length, 1);
  assert.ok(Object.isFrozen(audit));

  const withNotRealPressure = structuredClone(projection);
  const hidden = withNotRealPressure.geometries
    .flatMap(({ records }) => records)
    .find(({ factionId }) => factionId === "hidden");
  hidden.state = "current";
  hidden.status = "Active";
  withNotRealPressure.homelessSpawns.push(hidden);
  const reviewed = createPoliticalAudit({ projection: withNotRealPressure });
  assert.deepEqual(
    reviewed.participantRecommendation.groups.manifestNotReal.map(({ id }) => id),
    ["hidden"]
  );
  assert.ok(!reviewed.participantRecommendation.participantIds.includes("hidden"));
});

test("CLI argument parsing is strict and remote manifest mismatches fail", async () => {
  assert.deepEqual(parseAuditArguments(["--manifest-id", "vanilla"]), {
    help: false,
    manifestId: "vanilla",
    bundlePath: null
  });
  assert.deepEqual(parseAuditArguments(["--bundle", "bundle"]), {
    help: false,
    manifestId: null,
    bundlePath: "bundle"
  });
  assert.deepEqual(restoreNpmForwardedArguments(["vanilla"], { npm_config_manifest_id: "true" }), [
    "--manifest-id",
    "vanilla"
  ]);
  assert.deepEqual(restoreNpmForwardedArguments([], { npm_config_bundle: "C:\\audit-bundle" }), [
    "--bundle",
    "C:\\audit-bundle"
  ]);
  assert.throws(() => parseAuditArguments([]), /exactly one/);
  assert.throws(
    () => parseAuditArguments(["--manifest-id", "vanilla", "--bundle", "bundle"]),
    /exactly one/
  );

  const contract = createMapContractFixture({ manifestId: "different" });
  const fetchImpl = async () => ({ ok: true, json: async () => contract });
  await assert.rejects(
    () => runPoliticalAudit(["--manifest-id", "requested"], { fetchImpl }),
    /instead of requested/
  );
});

function onePixelTga() {
  const header = Buffer.alloc(18);
  header[2] = 2;
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(1, 14);
  header[16] = 24;
  return Buffer.concat([header, Buffer.from([0, 0, 255])]);
}

test("local bundle audit is deterministic, read-only, and resolves referenced datasets", async () => {
  const root = await mkdtemp(join(tmpdir(), "kimap-political-"));
  try {
    const contract = createMapContractFixture({ manifestId: "vanilla" });
    contract.getmapdata.assets.areasMap = {
      url: "/areasmap.tga",
      required: false,
      source: "fixture"
    };
    const scenario = createScenarioFixture({ manifestId: "vanilla" });
    scenario.datasets.spawnAreas[0].Values = {
      index: COLORS.shared,
      "homeless spawn amount": 1,
      "num nests": 1
    };
    scenario.datasets.mapData[0].X = 0;
    scenario.datasets.mapData[0].Z = 0;
    const datasets = { ...scenario.datasets, colourSchemes: [] };
    await writeFile(join(root, "getmapdata.json"), JSON.stringify(contract), "utf8");
    for (const key of [
      "characters",
      "factions",
      "worldStates",
      "townFcsData",
      "spawnAreas",
      "squads",
      "mapData",
      "colourSchemes"
    ]) {
      await writeFile(join(root, `${key}.json`), JSON.stringify(datasets[key]), "utf8");
    }
    await writeFile(join(root, "areasmap.tga"), onePixelTga());
    const before = (await readdir(root)).sort();
    const loaded = await loadLocalPoliticalBundle(root);
    assert.equal(loaded.contract.userData.manifestId, "vanilla");
    const first = await runPoliticalAudit(["--bundle", root]);
    const second = await runPoliticalAudit(["--bundle", root]);
    assert.equal(JSON.stringify(first.audit), JSON.stringify(second.audit));
    assert.match(first.summary, /Political evidence audit/);
    assert.deepEqual((await readdir(root)).sort(), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI exits non-zero for invalid invocation", () => {
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/audit-political-evidence.mjs"), "--manifest-id"],
    { cwd: resolve("."), encoding: "utf8" }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Political audit failed/);
});
