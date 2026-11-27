import assert from "node:assert/strict";
import test from "node:test";

import {
  createFactionOverviewCatalog,
  createFactionOverviewRaster,
  projectFactionOverview
} from "../modules/faction-overview/index.js";
import { createPoliticalAreaIndex } from "../modules/political/area-index.js";
import { createPowerRankReportProjection } from "../modules/scenario/power-report.js";
import {
  COMMAND_TYPES,
  ScenarioSession,
  createScenarioCommand,
  normalizeScenarioBaseline
} from "../modules/scenario/index.js";
import { rasterFromRows } from "./fixtures/political-fixture.js";
import { createScenarioFixture, faction, reference, town } from "./fixtures/scenario-fixture.js";

function squad(id, factionId, conditions = []) {
  return {
    Name: id,
    StringId: id,
    Values: {},
    ReferenceCategories: {
      faction: [reference(factionId, 0)],
      ...(conditions.length > 0 ? { "world state": conditions } : {})
    },
    Referrers: []
  };
}

function area(id, squadIds, color) {
  return {
    Name: id,
    StringId: id,
    Values: { index: color },
    ReferenceCategories: { "homeless spawns": squadIds.map((squadId) => reference(squadId, 1)) },
    Referrers: []
  };
}

function fixture() {
  return createScenarioFixture({
    factions: [
      faction("204-gamedata.base", "Nameless"),
      faction("faction-a", "Spawn Only"),
      faction("faction-b", "Future Owner"),
      faction("faction-c", "Unused Area"),
      faction("faction-d", "Former Owner"),
      faction("faction-e", "Unreferenced")
    ],
    towns: [
      town("base-town", {
        Name: "Base Town",
        owner: "Former Owner",
        ownerId: "faction-d",
        overrides: ["future-town"]
      }),
      town("future-town", {
        Name: "Future Town",
        owner: "Future Owner",
        ownerId: "faction-b",
        conditions: [{ id: "state-dead", value: 1 }]
      }),
      town("unmapped-town", { owner: "Unreferenced", ownerId: "faction-e" })
    ],
    squads: [
      squad("spawn-a", "faction-a"),
      squad("spawn-b", "faction-b", [reference("state-dead", 1)]),
      squad("spawn-c", "faction-c"),
      squad("unreferenced-squad", "faction-e")
    ],
    spawnAreas: [
      area("area-a", ["spawn-a", "spawn-a"], 0x010203),
      area("area-b", ["spawn-b"], 0x040506),
      area("51405-Newwworld.mod", ["spawn-c"], 0x070809)
    ],
    mapData: [
      { Name: "First", InstanceId: "first-occurrence", TargetId: "base-town", X: 10, Z: 20 },
      { Name: "Second", InstanceId: "second-occurrence", TargetId: "base-town", X: 30, Z: 40 }
    ]
  });
}

function establish() {
  const source = fixture();
  const baseline = normalizeScenarioBaseline(source);
  const session = new ScenarioSession(baseline);
  const catalog = createFactionOverviewCatalog({
    datasets: source.datasets,
    baseline,
    snapshot: session.getSnapshot()
  });
  return { source, baseline, session, catalog };
}

function entry(projection, id) {
  return projection.entries.find((candidate) => candidate.id === id);
}

test("roster keeps exact mapped spawn and reachable owner factions without unused or unreferenced identities", () => {
  const { source, baseline, session, catalog } = establish();
  assert.deepEqual(
    catalog.factions.map(({ id }) => id),
    ["faction-d", "faction-b", "faction-a"]
  );
  assert.equal(catalog.townOccurrences.length, 2);
  assert.deepEqual(catalog.townOccurrences[0].coordinate, { x: 10, z: 20 });
  assert.ok(catalog.spawnReferences.some((reference) => reference.factionId === "faction-b"));

  const withoutSimulation = createFactionOverviewCatalog({ datasets: source.datasets });
  assert.deepEqual(
    withoutSimulation.factions.map(({ id }) => id),
    catalog.factions.map(({ id }) => id)
  );
  const unavailable = projectFactionOverview({ catalog: withoutSimulation });
  assert.equal(unavailable.available, false);
  assert.deepEqual(
    unavailable.entries.map(({ status }) => status),
    ["unavailable", "unavailable", "unavailable"]
  );
  assert.equal(session.getSnapshot().powerStatistics.length, 1);
  assert.equal(baseline.factionById["faction-a"].name, "Spawn Only");
});

test("overview shares Power Ranks evidence rules for spawn-only, conditional, gained and lost towns", () => {
  const { baseline, session, catalog } = establish();
  const initial = projectFactionOverview({ catalog, baseline, snapshot: session.getSnapshot() });
  const spawnOnly = entry(initial, "faction-a");
  const future = entry(initial, "faction-b");
  const former = entry(initial, "faction-d");
  assert.equal(spawnOnly.status, "current");
  assert.equal(spawnOnly.report.rank, null);
  assert.equal(spawnOnly.report.spawnPresence.areaCount, 1);
  assert.equal(spawnOnly.report.spawnPresence.squadCount, 1);
  assert.equal(future.status, "conditional");
  assert.deepEqual(future.conditionalAreaIds, ["area-b"]);
  assert.equal(former.report.townsOwned, 1);
  assert.equal(former.townOccurrences.length, 2);
  assert.deepEqual(
    createPowerRankReportProjection(baseline, session.getSnapshot()).entries.map(({ id }) => id),
    ["faction-d"]
  );

  session.dispatch(
    createScenarioCommand(
      COMMAND_TYPES.SET_CHARACTER_STATUS,
      { characterId: "alpha", status: 0, playerInvolved: true },
      { id: "kill-alpha", occurredAt: "2026-10-03T12:00:00.000Z" }
    )
  );
  const changed = projectFactionOverview({ catalog, baseline, snapshot: session.getSnapshot() });
  assert.equal(entry(changed, "faction-b").status, "current");
  assert.equal(entry(changed, "faction-b").report.townsOwned, 1);
  assert.equal(entry(changed, "faction-b").report.townsGained, 1);
  assert.equal(entry(changed, "faction-b").report.spawnPresence.areaCount, 1);
  assert.equal(entry(changed, "faction-b").townOccurrences.length, 2);
  assert.equal(entry(changed, "faction-d").status, "none");
  assert.equal(entry(changed, "faction-d").report.townsLost, 1);

  session.undo();
  const restored = projectFactionOverview({ catalog, baseline, snapshot: session.getSnapshot() });
  assert.equal(entry(restored, "faction-d").status, "current");
  session.redo();
  assert.deepEqual(
    projectFactionOverview({ catalog, baseline, snapshot: session.getSnapshot() }),
    changed
  );
});

test("unresolved exact references are diagnosed and never joined by display name", () => {
  const source = fixture();
  source.datasets.squads[0].ReferenceCategories.faction = [
    reference("unknown-faction", 0, "Spawn Only")
  ];
  source.datasets.townFcsData[0].ReferenceCategories.faction = [
    reference("faction-d", 0),
    reference("faction-b", 0)
  ];
  const catalog = createFactionOverviewCatalog({ datasets: source.datasets });
  assert.ok(!catalog.factions.some(({ id }) => id === "faction-a"));
  assert.ok(!catalog.factions.some(({ id }) => id === "faction-d"));
  assert.ok(!catalog.factions.some(({ id }) => id === "faction-e"));
  assert.ok(catalog.diagnostics.some((item) => item.unresolvedIds?.includes("unknown-faction")));
  assert.ok(
    catalog.diagnostics.some(
      (item) => item.entityId === "base-town" && item.candidateFactionIds?.length === 2
    )
  );
});

test("an ambiguous mapped Town owner never acquires a precise overview count or ring", () => {
  const source = fixture();
  source.datasets.squads.push(squad("spawn-d", "faction-d"));
  source.datasets.spawnAreas.push(area("area-d", ["spawn-d"], 0x0a0b0c));
  source.datasets.townFcsData[0].ReferenceCategories.faction.push(reference("faction-b", 0));
  const baseline = normalizeScenarioBaseline(source);
  const session = new ScenarioSession(baseline);
  const catalog = createFactionOverviewCatalog({
    datasets: source.datasets,
    baseline,
    snapshot: session.getSnapshot()
  });
  const projected = projectFactionOverview({ catalog, baseline, snapshot: session.getSnapshot() });
  const former = entry(projected, "faction-d");
  assert.equal(
    createPowerRankReportProjection(baseline, session.getSnapshot()).entries[0].townsOwned,
    1
  );
  assert.equal(former.report.townsOwned, 0);
  assert.deepEqual(former.townOccurrences, []);
  assert.equal(former.report.spawnPresence.areaCount, 1);
  assert.ok(projected.diagnostics.some((item) => item.entityId === "base-town"));
});

test("out-of-bounds town occurrences remain inspectable without a map anchor", () => {
  const source = fixture();
  source.datasets.mapData[0].X = 147456;
  const catalog = createFactionOverviewCatalog({ datasets: source.datasets });
  assert.equal(catalog.townOccurrences[0].coordinate, null);
  assert.deepEqual(catalog.townOccurrences[1].coordinate, { x: 30, z: 40 });
  assert.ok(catalog.diagnostics.some((item) => item.entityId === "first-occurrence"));
});

test("raster uses solid gold for exact matches and a caution pattern for shared colors", () => {
  const areaIndex = createPoliticalAreaIndex({
    raster: rasterFromRows([[0x010203, 0x040506, 0x070809, 0x010203]]),
    spawnAreas: [
      area("selected-shared", [], 0x010203),
      area("other-shared", [], 0x010203),
      area("selected-solid", [], 0x040506),
      area("unselected", [], 0x070809)
    ]
  });
  const raster = createFactionOverviewRaster({
    areaIndex,
    areaIds: ["selected-shared", "selected-solid", "missing-area"]
  });
  const pixels = raster.copyRgba();
  assert.deepEqual(raster.statusCounts, { solid: 1, caution: 1 });
  assert.deepEqual(raster.unmappedAreaIds, ["missing-area"]);
  assert.equal(pixels[4 + 3], 143);
  assert.equal(pixels[8 + 3], 0);
  assert.notEqual(pixels[3] + pixels[15], 0);
  pixels[4 + 3] = 0;
  assert.equal(raster.copyRgba()[4 + 3], 143);

  const bothSharedAreasSelected = createFactionOverviewRaster({
    areaIndex,
    areaIds: ["selected-shared", "other-shared", "selected-solid"]
  });
  assert.deepEqual(bothSharedAreasSelected.statusCounts, { solid: 1, caution: 1 });
  assert.notEqual(bothSharedAreasSelected.copyRgba()[3], 143);
});
