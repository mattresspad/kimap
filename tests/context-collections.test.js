import assert from "node:assert/strict";
import test from "node:test";

import {
  createDiscoveryCatalog,
  createDiscoveryContextCatalog,
  createNarcoticProhibitionRaster,
  projectDiscoveryContextSubject,
  projectNarcoticProhibition
} from "../modules/discovery/index.js";
import { createPoliticalAreaIndex } from "../modules/political/index.js";
import {
  COMMAND_TYPES,
  createScenarioCommand,
  createScenarioLensProjection,
  normalizeScenarioBaseline
} from "../modules/scenario/index.js";
import { DiscoveryPresentationSession } from "../stores/discovery-presentation-session.js";
import { ScenarioSession } from "../stores/scenario-session.js";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";
import {
  createScenarioFixture,
  faction,
  reference,
  town
} from "./fixtures/scenario-fixture.js";

function record(StringId, Name, ReferenceCategories = {}, Values = {}) {
  return { StringId, Name, ReferenceCategories, Values, Referrers: [] };
}

function collectionFixture() {
  const fixture = createScenarioFixture();
  const factionA = faction("faction-a", "Faction A");
  factionA.ReferenceCategories["trade culture"] = [reference("culture-a", 0, "Culture A")];
  const factionB = faction("faction-b", "Faction B");
  factionB.ReferenceCategories["trade culture"] = [reference("culture-b", 0, "Culture B")];
  fixture.datasets.factions = [
    faction("204-gamedata.base", "Nameless"),
    factionA,
    factionB,
    faction("neutral", "Neutral")
  ];
  const base = town("treasure-town", {
    Name: "Treasure Town",
    owner: "Faction A",
    ownerId: "faction-a",
    overrides: ["treasure-override"]
  });
  base.Values.type = 2;
  base.ReferenceCategories.residents = [
    reference("vendor-squad", 1),
    reference("death-squad", 1),
    reference("inventory-squad", 1)
  ];
  const override = town("treasure-override", {
    Name: "Treasure Town Override",
    owner: "Faction A",
    ownerId: "faction-a",
    conditions: [{ id: "state-dead", value: 1 }]
  });
  override.Values.type = 2;
  override.ReferenceCategories.residents = [reference("vendor-squad", 1)];
  const blocked = town("blocked-town", {
    Name: "Blocked Town",
    owner: "Faction B",
    ownerId: "faction-b"
  });
  blocked.Values.type = 2;
  blocked.ReferenceCategories.residents = [reference("blocked-squad", 1)];
  const uncertain = town("uncertain-town", {
    Name: "Uncertain Town",
    owner: "Neutral",
    ownerId: "neutral"
  });
  uncertain.Values.type = 2;
  uncertain.ReferenceCategories.residents = [reference("uncertain-squad", 1)];
  fixture.datasets.townFcsData = [base, override, blocked, uncertain];
  fixture.datasets.mapData = [
    {
      Name: "Treasure Town North",
      InstanceId: "treasure-north",
      TargetId: "treasure-town",
      X: 0,
      Z: 0
    },
    {
      Name: "Treasure Town South",
      InstanceId: "treasure-south",
      TargetId: "treasure-town",
      X: 100,
      Z: 100
    },
    {
      Name: "Blocked Town",
      InstanceId: "blocked-marker",
      TargetId: "blocked-town",
      X: 0,
      Z: 0
    },
    {
      Name: "Uncertain Town",
      InstanceId: "uncertain-marker",
      TargetId: "uncertain-town",
      X: 0,
      Z: 0
    }
  ];
  fixture.datasets.characters = [
    record("alpha", "Alpha"),
    record("bravo", "Bravo"),
    record("loot-character", "Loot Character", {
      "death items": [reference("death-prize", 99)]
    }),
    record("split-character", "Split Character", {
      "death items": [reference("split-a", 1), reference("split-b", 1)]
    })
  ];
  fixture.datasets.squads = [
    record("vendor-squad", "Vendor Squad", {
      "vendor list": [reference("valuable-vendor", 1), reference("narcotic-vendor", 1)]
    }),
    record("death-squad", "Death Squad", {
      leader: [reference("loot-character", 1), reference("split-character", 1)]
    }),
    record("inventory-squad", "Inventory Squad", {
      inventory: [reference("valuable-item", 1)]
    }),
    record("blocked-squad", "Blocked Squad", {
      faction: [reference("faction-b", 0, "Faction B")],
      "vendor list": [reference("blocked-vendor", 1)]
    }),
    record("uncertain-squad", "Uncertain Squad", {
      "vendor list": [reference("valuable-vendor", 1), reference("narcotic-vendor", 1)]
    }),
    record("spawn-squad", "Spawn Squad", {
      faction: [reference("faction-a", 0, "Faction A")],
      "vendor list": [reference("narcotic-vendor", 1)]
    }),
    record("campaign-squad", "Campaign Squad", {
      "vendor list": [reference("valuable-vendor", 1)]
    })
  ];
  fixture.datasets.spawnAreas = [
    record(
      "area-one",
      "Area One",
      { "homeless spawns": [reference("spawn-squad", 1)] },
      { index: 0x010203 }
    ),
    record("area-shared", "Area Shared", {}, { index: 0x010203 })
  ];
  fixture.datasets.items = [
    record("valuable-item", "Valuable Item", {}, { value: 5000 }),
    record("below-threshold", "Below Threshold", {}, { value: 4999 }),
    record("death-prize", "Death Prize", {}, { value: 5000 }),
    record("split-a", "Split A", {}, { value: 3000 }),
    record("split-b", "Split B", {}, { value: 3000 }),
    record("hashish", "Hashish", {}, { value: 100, "item function": 8 }),
    record("ordinary-item", "Ordinary Item", {}, { value: 100, "item function": 7 })
  ];
  fixture.datasets.weapons = [];
  fixture.datasets.crossbows = [];
  fixture.datasets.armours = [];
  fixture.datasets.mapItems = [];
  fixture.datasets.nestItems = [];
  fixture.datasets.animals = [];
  fixture.datasets.vendorLists = [
    record("valuable-vendor", "Valuable Vendor", {
      items: [reference("valuable-item", 1), reference("below-threshold", 1)]
    }),
    record("narcotic-vendor", "Narcotic Vendor", {
      items: [reference("hashish", 1)]
    }),
    record("blocked-vendor", "Blocked Vendor", {
      items: [reference("valuable-item", 1), reference("hashish", 1)]
    }),
    record("zero-vendor", "Zero Vendor", {
      items: [reference("valuable-item", 0)]
    })
  ];
  fixture.datasets.tradeCultures = [
    record("culture-a", "Culture A", { "illegal goods": [reference("hashish", 1)] }),
    record("culture-b", "Culture B", {
      "forbidden items": [reference("valuable-item", 1), reference("hashish", 1)]
    })
  ];
  fixture.datasets.factionCampaigns = [
    record("campaign", "Campaign", { squads: [reference("campaign-squad", 1)] })
  ];
  return fixture;
}

function setup(fixture = collectionFixture()) {
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  const snapshot = session.getSnapshot();
  const lenses = createScenarioLensProjection({
    baseline,
    snapshot,
    journal: session.getJournal(),
    timeline: session.getTimeline(),
    campaigns: fixture.datasets.factionCampaigns,
    characters: fixture.datasets.characters
  });
  const discoveryCatalog = createDiscoveryCatalog({ datasets: fixture.datasets, baseline });
  const contextCatalog = createDiscoveryContextCatalog({
    discoveryCatalog,
    datasets: fixture.datasets,
    baseline
  });
  return { ...fixture, baseline, session, snapshot, lenses, discoveryCatalog, contextCatalog };
}

function wieldersFixture() {
  const fixture = collectionFixture();
  fixture.datasets.weapons = [
    record("katana", "Katana"),
    record("sabre", "Sabre"),
    record("ambiguous-weapon", "First Ambiguous"),
    record("ambiguous-weapon", "Second Ambiguous")
  ];
  fixture.datasets.weaponManufacturers = [
    record("edge-maker", "Edgewalkers", {
      "weapon models": [
        reference("1068-gamedata.base", 0),
        reference("1071-gamedata.base", 0),
        reference("1069-gamedata.base", 0),
        reference("unrelated-model", 0)
      ]
    }),
    record("meitou-maker", "Cross", {
      "weapon models": [reference("52293-rebirth.mod", 0)]
    }),
    record("ordinary-maker", "Mixed", {
      "weapon models": [reference("unrelated-model", 0, "Meitou"), reference("1071-gamedata.base", 0)]
    }),
    record("ambiguous-maker", "First Maker", {
      "weapon models": [reference("52293-rebirth.mod", 0)]
    }),
    record("ambiguous-maker", "Second Maker", {
      "weapon models": [reference("52293-rebirth.mod", 0)]
    })
  ];
  fixture.datasets.characters.push(
    record("edge-keeper", "Edge Keeper", {
      weapons: [reference("katana", 1), reference("katana", 1), reference("sabre", 1)],
      "weapon level": [
        reference("edge-maker", 0),
        reference("meitou-maker", 0),
        reference("ambiguous-maker", 0)
      ]
    }),
    record("mixed-keeper", "Mixed Keeper", {
      weapons: [reference("sabre", 1)],
      "weapon level": [reference("ordinary-maker", 0)]
    }),
    record("conditional-keeper", "Conditional Keeper", {
      weapons: [reference("katana", 1)],
      "weapon level": [reference("meitou-maker", 0)]
    }),
    record("missing-weapon", "Missing Weapon", {
      weapons: [reference("absent-weapon", 1)],
      "weapon level": [reference("edge-maker", 0)]
    }),
    record("ambiguous-weapon-holder", "Ambiguous Weapon Holder", {
      weapons: [reference("ambiguous-weapon", 1)],
      "weapon level": [reference("edge-maker", 0)]
    }),
    record("missing-maker", "Missing Maker", {
      weapons: [reference("katana", 1)],
      "weapon level": [reference("absent-maker", 0)]
    }),
    record("ambiguous-maker-holder", "Ambiguous Maker Holder", {
      weapons: [reference("katana", 1)],
      "weapon level": [reference("ambiguous-maker", 0)]
    }),
    record("unreachable-keeper", "Unreachable Keeper", {
      weapons: [reference("katana", 1)],
      "weapon level": [reference("meitou-maker", 0)]
    })
  );
  const deathSquad = fixture.datasets.squads.find(({ StringId }) => StringId === "death-squad");
  deathSquad.ReferenceCategories.leader.push(
    ...[
      "edge-keeper",
      "mixed-keeper",
      "missing-weapon",
      "ambiguous-weapon-holder",
      "missing-maker",
      "ambiguous-maker-holder"
    ].map((id) => reference(id, 1))
  );
  fixture.datasets.squads.push(
    record("conditional-squad", "Conditional Squad", {
      leader: [reference("conditional-keeper", 1)]
    })
  );
  fixture.datasets.townFcsData.find(({ StringId }) => StringId === "treasure-override")
    .ReferenceCategories.residents.push(reference("conditional-squad", 1));
  return fixture;
}

test("Fancy Weapon Wielders resolve four exact grades and keep weapon types separate", () => {
  const { contextCatalog, discoveryCatalog, snapshot, lenses } = setup(wieldersFixture());
  assert.deepEqual(
    contextCatalog.fancyWeaponWielders.map(({ entityId }) => entityId).sort(),
    ["conditional-keeper", "edge-keeper", "mixed-keeper"]
  );
  const edge = contextCatalog.fancyWeaponWielders.find(({ entityId }) => entityId === "edge-keeper");
  assert.deepEqual(
    edge.candidateGrades.map(({ label }) => label),
    ["Meitou", "Edge Type 3", "Edge Type 2", "Edge Type 1"]
  );
  assert.deepEqual(edge.weaponTypes.map(({ name }) => name), ["Katana", "Katana", "Sabre"]);
  assert.equal(edge.candidateGrades.every(({ manufacturerValue0 }) => manufacturerValue0 === 0), true);
  assert.equal(edge.baselineAppearances.length >= 2, true);
  const mixed = contextCatalog.fancyWeaponWielders.find(({ entityId }) => entityId === "mixed-keeper");
  assert.deepEqual(mixed.candidateGrades.map(({ label }) => label), ["Edge Type 2"]);
  const projected = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "fancyWeaponWielders"
  });
  assert.equal(projected.rows.find(({ entityId }) => entityId === "conditional-keeper").conditionalLocationCount > 0, true);
  assert.equal(projected.rows.find(({ entityId }) => entityId === "edge-keeper").currentLocationCount >= 2, true);
  assert.equal("weaponGradePairings" in edge, false);
  assert.equal("guaranteedDrop" in edge, false);
  assert.ok(contextCatalog.diagnostics.some(({ code }) => code === "context_wielder_weapon_unresolved"));
  assert.ok(contextCatalog.diagnostics.some(({ code }) => code === "context_wielder_manufacturer_unresolved"));
});

test("Fancy Wielder eligibility stays stable while scenario placement is reprojected", () => {
  const setupState = setup(wieldersFixture());
  const { session, baseline, contextCatalog, discoveryCatalog, datasets } = setupState;
  const project = () => projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot: session.getSnapshot(),
    lenses: createScenarioLensProjection({
      baseline,
      snapshot: session.getSnapshot(),
      journal: session.getJournal(),
      timeline: session.getTimeline(),
      campaigns: datasets.factionCampaigns,
      characters: datasets.characters
    }),
    subjectId: "fancyWeaponWielders"
  });
  const conditional = () => project().rows.find(({ entityId }) => entityId === "conditional-keeper");
  assert.ok(conditional().conditionalLocationCount > 0);
  session.dispatch(createScenarioCommand(
    COMMAND_TYPES.SET_CHARACTER_STATUS,
    { characterId: "alpha", status: 0, playerInvolved: true },
    { id: "wielders-progress", occurredAt: "2026-09-27T12:00:00.000Z" }
  ));
  assert.ok(conditional().currentLocationCount > 0);
  session.undo();
  assert.ok(conditional().conditionalLocationCount > 0);
});

test("Treasure Spots enforce Town-only roots, individual thresholds, and trade filtering", () => {
  const { contextCatalog, discoveryCatalog, snapshot, lenses } = setup();
  assert.deepEqual(
    contextCatalog.treasureSpots.map(({ townId }) => townId),
    ["treasure-town", "uncertain-town"]
  );
  const treasure = contextCatalog.treasureSpots.find(({ townId }) => townId === "treasure-town");
  assert.deepEqual(treasure.qualificationKinds, ["valuableStock", "deathLoot"]);
  assert.equal(treasure.placements.length, 2);
  assert.equal(treasure.deathLootEvidence.some(({ itemId }) => itemId === "death-prize"), true);
  assert.equal(treasure.deathLootEvidence.some(({ itemId }) => itemId === "split-a"), false);
  assert.equal(
    contextCatalog.treasureSpots.some(({ townId }) => townId === "blocked-town"),
    false
  );
  assert.equal(
    contextCatalog.treasureSpots.some(({ townId }) => townId === "campaign-squad"),
    false
  );
  const projected = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "treasureSpots"
  });
  const uncertain = projected.rows.find(({ townId }) => townId === "uncertain-town");
  assert.equal(uncertain.uncertainLocationCount, 1);
  assert.throws(() => (projected.rows[0].placements[0].state = "conditional"), TypeError);
});

test("Narcotics keep confirmed, uncertain, and forbidden vendor evidence separate", () => {
  const { contextCatalog, discoveryCatalog, snapshot, lenses } = setup();
  assert.deepEqual(contextCatalog.narcotics.map(({ name }) => name), ["Hashish"]);
  const projected = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "narcotics"
  });
  const hashish = projected.rows[0];
  assert.equal(hashish.prohibitionAuthored, true);
  assert.equal(hashish.confirmedEvidence.length > 0, true);
  assert.equal(hashish.uncertainEvidence.length > 0, true);
  assert.equal(hashish.blockedEvidence.length > 0, true);
  assert.equal(hashish.placements.some(({ availability }) => availability === "confirmed"), true);
  assert.equal(hashish.placements.some(({ availability }) => availability === "uncertain"), true);
  assert.equal(
    hashish.blockedEvidence.every(({ root }) => root.parentId === "blocked-town"),
    true
  );
});

test("illegal goods project owner and direct spawn-Squad law with shared-color caution", () => {
  const { contextCatalog, discoveryCatalog, snapshot, lenses, baseline } = setup();
  const areaIndex = createPoliticalAreaIndex({
    raster: { width: 1, height: 1, data: new Uint8Array([1, 2, 3, 255]) },
    spawnAreas: baseline.spawnAreas
  });
  const projection = projectNarcoticProhibition({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    areaIndex,
    itemId: "hashish"
  });
  assert.equal(projection.available, true);
  assert.equal(projection.authored, true);
  assert.equal(projection.areas.length, 1);
  assert.equal(projection.areas[0].caution, true);
  assert.equal(
    projection.areas[0].evidence.some(({ source }) => source === "townOwner"),
    true
  );
  assert.equal(
    projection.areas[0].evidence.some(({ source }) => source === "spawnSquad"),
    true
  );
  const raster = createNarcoticProhibitionRaster({ areaIndex, projection });
  const first = raster.copyRgba();
  const second = raster.copyRgba();
  assert.notStrictEqual(first, second);
  first[0] = 0;
  assert.notEqual(first[0], second[0]);
  assert.equal(raster.statusCounts.caution, 1);
});

test("collection presentation state is immutable, independent, retained, and reset", () => {
  const session = new DiscoveryPresentationSession({
    treasureTownIds: ["town-a", "town-b"],
    narcoticItemIds: ["drug-a", "drug-b"],
    fancyWielderIds: ["wielder-a", "wielder-b"]
  });
  assert.equal(session.toggleTreasureTown("town-a", true).type, "toggleTreasureTown");
  assert.equal(session.toggleTreasureTown("town-a", true), false);
  session.toggleNarcotic("drug-a", true);
  session.setNarcoticProhibition("drug-b");
  session.setSearch("treasureSpots", "Town");
  session.setSearch("fancyWeaponWielders", "Meitou");
  session.toggleCharacter("fancyWeaponWielders", "wielder-a", true);
  const snapshot = session.getSnapshot();
  assert.deepEqual(snapshot.checkedTreasureTownIds, ["town-a"]);
  assert.deepEqual(snapshot.checkedNarcoticItemIds, ["drug-a"]);
  assert.deepEqual(snapshot.checkedFancyWielderIds, ["wielder-a"]);
  assert.equal(snapshot.searchBySubject.fancyWeaponWielders, "Meitou");
  assert.equal(snapshot.activeNarcoticProhibitionId, "drug-b");
  assert.throws(() => snapshot.checkedTreasureTownIds.push("town-b"), TypeError);
  session.clearSubject("narcotics");
  assert.equal(session.getSnapshot().activeNarcoticProhibitionId, null);
  assert.equal(session.getSnapshot().checkedTreasureTownIds.length, 1);
  session.showMany("fancyWeaponWielders", ["wielder-b"]);
  assert.deepEqual(session.getSnapshot().checkedFancyWielderIds, ["wielder-a", "wielder-b"]);
  session.clearSubject("fancyWeaponWielders");
  assert.deepEqual(session.getSnapshot().checkedFancyWielderIds, []);
  session.restoreDefaults();
  assert.deepEqual(session.getSnapshot().checkedTreasureTownIds, []);
  assert.equal(session.getSnapshot().searchBySubject.treasureSpots, "");
  assert.equal(session.getSnapshot().searchBySubject.fancyWeaponWielders, "");
});

test("nested Context routes back through their collection and retain across presentation changes", () => {
  const viewport = new ViewportCompositionSession({ layoutClass: "narrow" });
  viewport.openContextRoute("treasureHunting");
  viewport.openContextRoute("treasureSpots");
  assert.equal(viewport.getSnapshot().contextRoute, "treasureSpots");
  viewport.setBrowseMode("content");
  viewport.enterFocusMap();
  assert.equal(viewport.getSnapshot().contextRoute, "treasureSpots");
  viewport.exitFocusMap();
  viewport.backContextRoute();
  assert.equal(viewport.getSnapshot().contextRoute, "treasureHunting");
  viewport.backContextRoute();
  assert.equal(viewport.getSnapshot().contextRoute, "dashboard");
  viewport.openContextRoute("narcotics");
  viewport.backContextRoute();
  assert.equal(viewport.getSnapshot().contextRoute, "shoppingList");
  viewport.openContextRoute("fancyWeaponWielders");
  viewport.backContextRoute();
  assert.equal(viewport.getSnapshot().contextRoute, "treasureHunting");
  viewport.openContextRoute("prospecting");
  assert.equal(viewport.getSnapshot().contextRoute, "prospecting");
  viewport.enterFocusMap();
  viewport.exitFocusMap();
  assert.equal(viewport.getSnapshot().contextRoute, "prospecting");
  viewport.backContextRoute();
  assert.equal(viewport.getSnapshot().contextRoute, "dashboard");
  viewport.reset();
  assert.equal(viewport.getSnapshot().contextRoute, "dashboard");
});
