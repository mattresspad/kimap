import assert from "node:assert/strict";
import test from "node:test";

import {
  canTraverseDiscoveryPlacement,
  createDiscoveryCatalog,
  createDiscoveryContextCatalog,
  findDiscoveryPlacementPaths,
  projectDiscoveryContextSubject,
  projectDiscoveryEntity
} from "../modules/discovery/index.js";
import {
  COMMAND_TYPES,
  createScenarioCommand,
  normalizeScenarioBaseline,
  serializeScenarioEnvelope
} from "../modules/scenario/index.js";
import { DiscoveryPresentationSession } from "../stores/discovery-presentation-session.js";
import { ScenarioSession } from "../stores/scenario-session.js";
import { createScenarioLensProjection } from "../modules/scenario/lenses.js";
import { createScenarioFixture, reference } from "./fixtures/scenario-fixture.js";

function record(StringId, Name, ReferenceCategories = {}, Values = {}) {
  return { StringId, Name, ReferenceCategories, Values, Referrers: [] };
}

function contextFixture() {
  const fixture = createScenarioFixture({ manifestId: "context-fixture" });
  const { contract } = fixture;
  const datasets = {
    ...fixture.datasets,
    characters: fixture.datasets.characters,
    animals: [
      record("strength-animal", "Strength Animal", {}, { "animal strength": 50 }),
      record(
        "trophy-animal",
        "Trophy Animal",
        { "death items": [reference("trophy", 99)] },
        { "animal strength": 10 }
      ),
      record("dual-animal", "Dual Animal", {}, { "animal strength": 50 }),
      record(
        "sum-animal",
        "Sum Animal",
        {
          "death items": [reference("half-trophy-a", 99), reference("half-trophy-b", 100)]
        },
        { "animal strength": 49 }
      ),
      record(
        "strength-invalid",
        "Strength With Invalid Trophy",
        {
          "death items": [reference("missing-item", 1)]
        },
        { "animal strength": 50 }
      ),
      record("conditional-animal", "Conditional Animal", {}, { "animal strength": 50 }),
      record("cycle-animal", "Cycle Animal", {}, { "animal strength": 50 }),
      record("choose-animal", "Choose Animal", {}, { "animal strength": 50 }),
      record("nest-animal", "Nest Animal", {}, { "animal strength": 50 }),
      record(
        "campaign-geographic",
        "Campaign And Geographic Animal",
        {},
        { "animal strength": 50 }
      ),
      record("zero-capacity", "Zero Capacity Animal", {}, { "animal strength": 80 }),
      record("horse-dog", "Horse Dog", {}, { "animal strength": 80 }),
      record(
        "crimper",
        "Crimper",
        { "death items": [reference("trophy", 1)] },
        { "animal strength": 50 }
      ),
      record("campaign-animal", "Campaign Animal", {}, { "animal strength": 50 }),
      record(
        "invalid-animal",
        "Invalid Animal",
        { "death items": [reference("missing-item", 1)] },
        {}
      )
    ],
    squads: [
      record("town-squad", "Town Squad", {
        animals: [
          reference("strength-animal", 1),
          reference("sum-animal", 1),
          reference("strength-invalid", 1),
          reference("campaign-geographic", 1),
          reference("zero-capacity", 0)
        ]
      }),
      record("bar-squad", "Bar Squad", {
        animals2: [{ ...reference("trophy-animal", 0, "Trophy Animal"), Value1: 1 }]
      }),
      record("default-squad", "Default Squad", { housemates: [reference("nested-squad", 1)] }),
      record("nested-squad", "Nested Squad", { animal: [reference("dual-animal", 1)] }),
      record("spawn-squad", "Spawn Squad", { animal: [reference("dual-animal", 1)] }),
      record("conditional-squad", "Conditional Squad", {
        animal: [reference("conditional-animal", 1)],
        "world state": [reference("state-dead", 1)]
      }),
      record("cycle-a", "Cycle A", {
        housemates: [reference("cycle-b", 1)],
        slaves: [reference("slave-squad", 1)]
      }),
      record("cycle-b", "Cycle B", {
        prisoners: [reference("cycle-a", 1)],
        animals: [reference("cycle-animal", 1)]
      }),
      record("slave-squad", "Slave Squad", {
        "choosefrom list": [reference("choose-squad", 1)]
      }),
      record("choose-squad", "Choose Squad", { animal2: [reference("choose-animal", 1)] }),
      record("nest-squad", "Nest Squad", { animals2: [reference("nest-animal", 1)] }),
      record("dead-squad", "Dead Squad", { animals: [reference("crimper", 1)] }),
      record("campaign-squad", "Campaign Squad", {
        animals: [reference("campaign-animal", 1), reference("campaign-geographic", 1)]
      })
    ],
    townFcsData: [
      record(
        "town-base",
        "Base Town",
        {
          faction: [reference("neutral", 0)],
          residents: [reference("town-squad", 1)],
          "bar squads": [reference("bar-squad", 1)],
          "default resident": [reference("default-squad", 1)],
          "roaming squads": [reference("cycle-a", 1)]
        },
        { type: 2 }
      ),
      record(
        "nest-used",
        "Used Nest",
        {
          debris: [
            { ...reference("egg", 0, "Egg"), Value1: 1, Value2: 7 },
            reference("zero-capacity-egg", 0, "Zero Capacity Egg")
          ],
          residents: [reference("nest-squad", 1)],
          "roaming squads": [reference("spawn-squad", 1)]
        },
        { type: 0 }
      ),
      record("nest-unused", "Unused Nest", { debris: [reference("egg", 1, "Egg")] }, { type: 0 }),
      record(
        "ordinary-debris",
        "Ordinary Debris",
        { debris: [reference("egg", 1, "Egg")] },
        { type: 10 }
      )
    ],
    spawnAreas: [
      record("area", "Area", {
        "homeless spawns": [reference("spawn-squad", 1), reference("conditional-squad", 1)],
        nests: [reference("nest-used", 1)]
      })
    ],
    mapData: [
      { InstanceId: "town-marker", TargetId: "town-base", Name: "Town", X: 1, Z: 2 },
      { InstanceId: "nest-marker", TargetId: "nest-used", Name: "Mapped Nest", X: 3, Z: 4 }
    ],
    items: [
      record("trophy", "Trophy", {}, { value: 5000 }),
      record("half-trophy-a", "Half Trophy A", {}, { value: 2500 }),
      record("half-trophy-b", "Half Trophy B", {}, { value: 2500 })
    ],
    weapons: [],
    crossbows: [],
    armours: [],
    mapItems: [],
    nestItems: [
      record("egg", "Egg", {}, { value: 26 }),
      record("zero-capacity-egg", "Zero Capacity Egg", {}, { value: 100 }),
      record("dung", "Dung", {}, { value: 25 })
    ],
    vendorLists: [],
    factionCampaigns: [record("campaign", "Campaign", { squads: [reference("campaign-squad", 1)] })]
  };
  for (const key of Object.keys(datasets)) {
    if (!contract.datasets[key]) {
      contract.datasets[key] = {
        url: `https://map.kenshi.wiki/data/mod-manifests/context-fixture/${key}.json`,
        required: true
      };
    }
  }
  return { contract, datasets };
}

function setup() {
  const fixture = contextFixture();
  const baseline = normalizeScenarioBaseline(fixture);
  const discoveryCatalog = createDiscoveryCatalog({
    datasets: fixture.datasets,
    baseline
  });
  const contextCatalog = createDiscoveryContextCatalog({
    discoveryCatalog,
    datasets: fixture.datasets,
    baseline
  });
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
  return { ...fixture, baseline, discoveryCatalog, contextCatalog, snapshot, lenses };
}

function characterContextSetup() {
  const fixture = contextFixture();
  fixture.datasets.characters = [
    record(
      "alpha",
      "Alpha canonical",
      {
        faction: [reference("faction-a", 0, "Faction A")],
        "bounty factions": [reference("neutral", 0, "Neutral")]
      },
      { "bounty amount": 10000, "bounty chance": 100 }
    ),
    record("bravo", "Bravo canonical", {}, { "bounty amount": 5000, "bounty chance": 50 }),
    record(
      "squad-bounty",
      "Squad Bounty",
      {
        "bounty faction": [
          reference("neutral", 0, "Neutral"),
          reference("missing-faction", 0, "Missing Faction")
        ]
      },
      { "bounty amount": 12000, "bounty chance": 25 }
    ),
    record("zero-character", "Zero Character", {}, { "bounty amount": 9000, "bounty chance": 25 }),
    record(
      "campaign-character",
      "Campaign Character",
      {},
      { "bounty amount": 8000, "bounty chance": 25 }
    ),
    record(
      "progression-bounty",
      "Progression Bounty",
      {},
      { "bounty amount": 7000, "bounty chance": 25 }
    )
  ];
  const townSquad = fixture.datasets.squads.find(({ StringId }) => StringId === "town-squad");
  townSquad.ReferenceCategories.leader = [
    reference("alpha", 1, "Alpha canonical"),
    reference("zero-character", 0, "Zero Character")
  ];
  townSquad.ReferenceCategories.squad2 = [reference("bravo", 1, "Bravo canonical")];
  const barSquad = fixture.datasets.squads.find(({ StringId }) => StringId === "bar-squad");
  barSquad.ReferenceCategories.faction = [reference("faction-a", 0, "Faction A")];
  barSquad.ReferenceCategories.squad = [reference("squad-bounty", 1, "Squad Bounty")];
  const campaignSquad = fixture.datasets.squads.find(
    ({ StringId }) => StringId === "campaign-squad"
  );
  campaignSquad.ReferenceCategories.leader = [
    reference("campaign-character", 1, "Campaign Character")
  ];
  const conditionalSquad = fixture.datasets.squads.find(
    ({ StringId }) => StringId === "conditional-squad"
  );
  conditionalSquad.ReferenceCategories.leader = [
    reference("progression-bounty", 1, "Progression Bounty")
  ];

  const baseline = normalizeScenarioBaseline(fixture);
  const discoveryCatalog = createDiscoveryCatalog({ datasets: fixture.datasets, baseline });
  const contextCatalog = createDiscoveryContextCatalog({
    discoveryCatalog,
    datasets: fixture.datasets,
    baseline
  });
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
  return { ...fixture, baseline, discoveryCatalog, contextCatalog, session, snapshot, lenses };
}

function projectForSession({ baseline, datasets, contextCatalog, discoveryCatalog }, session) {
  const snapshot = session.getSnapshot();
  const lenses = createScenarioLensProjection({
    baseline,
    snapshot,
    journal: session.getJournal(),
    timeline: session.getTimeline(),
    campaigns: datasets.factionCampaigns,
    characters: datasets.characters
  });
  return projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "deadlyAnimals"
  });
}

function projectSubjectForSession(
  { baseline, datasets, contextCatalog, discoveryCatalog },
  session,
  subjectId
) {
  const snapshot = session.getSnapshot();
  const lenses = createScenarioLensProjection({
    baseline,
    snapshot,
    journal: session.getJournal(),
    timeline: session.getTimeline(),
    campaigns: datasets.factionCampaigns,
    characters: datasets.characters
  });
  return projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId
  });
}

test("Context catalog applies typed usedness, inclusive thresholds, summation, and campaign exclusion", () => {
  const { contextCatalog } = setup();
  assert.equal(contextCatalog.available, true);
  const deadlyIds = new Set(contextCatalog.deadlyAnimals.map(({ entityId }) => entityId));
  for (const entityId of [
    "campaign-geographic",
    "choose-animal",
    "conditional-animal",
    "cycle-animal",
    "dual-animal",
    "nest-animal",
    "strength-animal",
    "strength-invalid",
    "sum-animal",
    "trophy-animal"
  ])
    assert.ok(deadlyIds.has(entityId), entityId);
  assert.equal(contextCatalog.animals.find(({ entityId }) => entityId === "horse-dog").used, false);
  assert.equal(
    contextCatalog.animals.find(({ entityId }) => entityId === "zero-capacity").used,
    false
  );
  assert.equal(
    contextCatalog.animals.find(({ entityId }) => entityId === "crimper").deadSquad,
    true
  );
  assert.equal(
    contextCatalog.animals.find(({ entityId }) => entityId === "campaign-animal").campaignOnly,
    true
  );
  assert.equal(
    contextCatalog.animals.find(({ entityId }) => entityId === "campaign-geographic").campaignOnly,
    false
  );
  assert.equal(
    contextCatalog.animals.find(({ entityId }) => entityId === "trophy-animal").deathItemValue,
    5000
  );
  assert.equal(
    contextCatalog.animals.find(({ entityId }) => entityId === "sum-animal").deathItemValue,
    5000
  );
  assert.deepEqual(
    contextCatalog.animals.find(({ entityId }) => entityId === "strength-invalid").reasons,
    ["strength"]
  );
  assert.ok(
    contextCatalog.diagnostics.some(({ code }) => code === "context_animal_eligibility_unresolved")
  );
});

test("Nest Treasures use an exclusive value threshold and only reachable type-0 Nest debris", () => {
  const { contextCatalog } = setup();
  assert.deepEqual(
    contextCatalog.nestTreasures.map(({ entityId }) => entityId),
    ["egg"]
  );
  assert.deepEqual(
    contextCatalog.nestTreasures[0].sources.map(({ nestId }) => nestId),
    ["nest-used"]
  );
  assert.equal(contextCatalog.nestTreasures[0].sources[0].value0, 0);
  assert.equal(contextCatalog.nestTreasures[0].sources[0].value1, 1);
  assert.equal(contextCatalog.nestTreasures[0].sources[0].value2, 7);
  assert.equal(
    contextCatalog.nestTreasures.some(({ entityId }) => entityId === "zero-capacity-egg"),
    false
  );
  assert.equal(
    contextCatalog.nestTreasures.some(({ entityId }) => entityId === "dung"),
    false
  );
});

test("Key Characters and Bounty Targets require strict stable Character reachability", () => {
  const { contextCatalog } = characterContextSetup();
  assert.deepEqual(
    contextCatalog.keyCharacters.map(({ entityId }) => entityId),
    ["alpha", "bravo"]
  );
  assert.deepEqual(
    contextCatalog.bountyTargets.map(({ entityId }) => entityId),
    ["squad-bounty", "alpha", "progression-bounty", "bravo"]
  );
  assert.equal(
    contextCatalog.characters.find(({ entityId }) => entityId === "zero-character").used,
    false
  );
  assert.equal(
    contextCatalog.characters.find(({ entityId }) => entityId === "campaign-character").used,
    false
  );
  const alpha = contextCatalog.keyCharacters[0];
  assert.equal(alpha.affiliation.factionId, "faction-a");
  assert.equal(alpha.affiliation.source, "character");
  assert.ok(alpha.worldStates.every(({ stateId }) => typeof stateId === "string"));
  assert.deepEqual(
    alpha.issuers.map(({ factionId }) => factionId),
    ["neutral"]
  );
  const squadBounty = contextCatalog.bountyTargets[0];
  assert.equal(squadBounty.affiliation.factionId, "faction-a");
  assert.equal(squadBounty.affiliation.source, "squad");
  assert.deepEqual(
    squadBounty.issuers.map(({ factionId }) => factionId),
    ["missing-faction", "neutral"]
  );
  assert.ok(squadBounty.issuers.some(({ resolved }) => !resolved));
  assert.deepEqual(
    contextCatalog.bountyTargets.find(({ entityId }) => entityId === "bravo").issuers,
    []
  );
  assert.ok(
    contextCatalog.diagnostics.some(({ code }) => code === "context_bounty_issuer_unresolved")
  );
});

test("Character Context projection keeps life status separate from placement evidence", () => {
  const { contextCatalog, discoveryCatalog, snapshot, lenses } = characterContextSetup();
  const keys = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "keyCharacters"
  });
  const bounties = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "bountyTargets"
  });
  assert.equal(keys.rows[0].lifeStatusLabel, "Alive");
  assert.equal(keys.rows[0].scenarioTracked, true);
  assert.equal(keys.rows[0].currentLocationCount > 0, true);
  assert.equal(
    bounties.rows.find(({ entityId }) => entityId === "squad-bounty").lifeStatusLabel,
    "Reference only"
  );
  assert.equal(
    bounties.rows.find(({ entityId }) => entityId === "squad-bounty").scenarioTracked,
    false
  );
});

test("Character eligibility survives scenario progression, Undo, and document replacement", () => {
  const setupState = characterContextSetup();
  const session = setupState.session;
  const target = (subjectId, entityId) =>
    projectSubjectForSession(setupState, session, subjectId).rows.find(
      (row) => row.entityId === entityId
    );
  assert.equal(target("keyCharacters", "alpha").lifeStatusLabel, "Alive");
  assert.deepEqual(
    target("bountyTargets", "progression-bounty").placements.map(({ state }) => state),
    ["conditional"]
  );

  session.dispatch(
    createScenarioCommand(
      COMMAND_TYPES.SET_CHARACTER_STATUS,
      { characterId: "alpha", status: 0, playerInvolved: true },
      { id: "character-context-alpha-dead", occurredAt: "2026-09-15T12:00:00.000Z" }
    )
  );
  assert.equal(target("keyCharacters", "alpha").lifeStatusLabel, "Dead");
  assert.ok(setupState.contextCatalog.keyCharacters.some(({ entityId }) => entityId === "alpha"));
  const progressed = target("bountyTargets", "progression-bounty");
  assert.equal(progressed.lifeStatusLabel, "Reference only");
  assert.deepEqual(
    progressed.placements.map(({ state }) => state),
    ["current"]
  );
  const envelope = serializeScenarioEnvelope(session);

  session.undo();
  assert.deepEqual(
    target("bountyTargets", "progression-bounty").placements.map(({ state }) => state),
    ["conditional"]
  );
  session.redo();
  assert.deepEqual(
    target("bountyTargets", "progression-bounty").placements.map(({ state }) => state),
    ["current"]
  );

  const replacement = new ScenarioSession(setupState.baseline);
  replacement.replaceDocument(envelope);
  const replaced = projectSubjectForSession(setupState, replacement, "keyCharacters").rows.find(
    ({ entityId }) => entityId === "alpha"
  );
  assert.equal(replaced.lifeStatusLabel, "Dead");
  assert.ok(
    setupState.contextCatalog.keyCharacters.some(({ entityId }) => entityId === replaced.entityId)
  );
});

test("ordinary reference projections inherit corrected Animal and Nest Item appearance paths", () => {
  const { discoveryCatalog, snapshot, lenses } = setup();
  const animal = projectDiscoveryEntity({
    catalog: discoveryCatalog,
    snapshot,
    lenses,
    target: { entityType: "character", entityId: "trophy-animal" }
  });
  const egg = projectDiscoveryEntity({
    catalog: discoveryCatalog,
    snapshot,
    lenses,
    target: { entityType: "nestItem", entityId: "egg" }
  });
  assert.ok(
    animal.appearances.some(({ state, parentType }) => state === "current" && parentType === "town")
  );
  assert.ok(
    egg.appearances.some(
      ({ state, parentType }) => state === "current" && parentType === "spawnArea"
    )
  );
});

test("Context projection reclassifies placements while retaining immutable eligibility", () => {
  const { contextCatalog, discoveryCatalog, snapshot, lenses } = setup();
  const before = structuredClone(contextCatalog);
  const animals = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "deadlyAnimals"
  });
  const treasures = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "nestTreasures"
  });
  assert.ok(animals.rows.every(({ mapControlsAvailable }) => mapControlsAvailable));
  assert.equal(treasures.rows[0].sources[0].currentLocationCount, 2);
  assert.deepEqual(contextCatalog, before);
  assert.ok(Object.isFrozen(animals));
});

test("typed placement traversal admits required nested paths, enforces capacity, and bounds cycles", () => {
  const edge = (sourceKind, targetKind, category, targetKey, value0 = 1, value1 = 0) => ({
    sourceKind,
    targetKind,
    category,
    targetKey,
    value0,
    value1,
    resolution: "resolved"
  });
  for (const category of ["residents", "bar squads", "default resident", "roaming squads"]) {
    assert.equal(canTraverseDiscoveryPlacement(edge("town", "squad", category, "squad:a")), true);
  }
  for (const category of ["housemates", "slaves", "prisoners", "choosefrom list"]) {
    assert.equal(canTraverseDiscoveryPlacement(edge("squad", "squad", category, "squad:b")), true);
  }
  assert.equal(
    canTraverseDiscoveryPlacement(edge("squad", "character", "animals2", "character:a", 0, 1)),
    true
  );
  assert.equal(
    canTraverseDiscoveryPlacement(edge("squad", "character", "animals", "character:a", 0, 0)),
    false
  );
  assert.equal(
    canTraverseDiscoveryPlacement(edge("squad", "character", "leader", "character:a", 1, 0)),
    true
  );
  assert.equal(
    canTraverseDiscoveryPlacement(edge("squad", "character", "squad", "character:a", 0, 0)),
    false
  );
  assert.equal(
    canTraverseDiscoveryPlacement(edge("nest", "nestItem", "debris", "nestItem:egg", 0, 0)),
    false
  );
  assert.equal(
    canTraverseDiscoveryPlacement(edge("factionCampaign", "squad", "squads", "squad:a")),
    false
  );

  const forwardByKey = new Map([
    ["town:root", [edge("town", "squad", "residents", "squad:a")]],
    ["squad:a", [edge("squad", "squad", "housemates", "squad:b")]],
    [
      "squad:b",
      [
        edge("squad", "squad", "prisoners", "squad:a"),
        edge("squad", "character", "animals", "character:animal")
      ]
    ]
  ]);
  const paths = findDiscoveryPlacementPaths({ forwardByKey }, "town:root");
  assert.deepEqual(paths.get("character:animal"), [
    "town:root",
    "squad:a",
    "squad:b",
    "character:animal"
  ]);
  assert.equal(paths.size, 4);
});

test("scenario projection follows progression, Undo, Redo, and document replacement without clearing checks", () => {
  const setupState = setup();
  const session = new ScenarioSession(setupState.baseline);
  const presentation = new DiscoveryPresentationSession({
    animalIds: setupState.contextCatalog.deadlyAnimals.map(({ entityId }) => entityId),
    nestSources: []
  });
  presentation.toggleAnimal("conditional-animal", true);
  const stateOf = (projection) =>
    projection.rows
      .find(({ entityId }) => entityId === "conditional-animal")
      .placements.map(({ state }) => state);

  assert.deepEqual(stateOf(projectForSession(setupState, session)), ["conditional"]);
  session.dispatch(
    createScenarioCommand(
      COMMAND_TYPES.SET_CHARACTER_STATUS,
      { characterId: "alpha", status: 0, playerInvolved: true },
      { id: "context-alpha-dead", occurredAt: "2026-09-08T12:00:00.000Z" }
    )
  );
  assert.deepEqual(stateOf(projectForSession(setupState, session)), ["current"]);
  const envelope = serializeScenarioEnvelope(session);
  session.undo();
  assert.deepEqual(stateOf(projectForSession(setupState, session)), ["conditional"]);
  session.redo();
  assert.deepEqual(stateOf(projectForSession(setupState, session)), ["current"]);

  const replacement = new ScenarioSession(setupState.baseline);
  replacement.replaceDocument(envelope);
  assert.deepEqual(stateOf(projectForSession(setupState, replacement)), ["current"]);
  assert.deepEqual(presentation.getSnapshot().checkedAnimalIds, ["conditional-animal"]);
});

test("Discovery presentation snapshots validate identities, retain searches, and suppress no-ops", () => {
  const session = new DiscoveryPresentationSession({
    keyCharacterIds: ["key"],
    bountyTargetIds: ["bounty"],
    animalIds: ["animal"],
    nestSources: [{ nestItemId: "egg", nestId: "nest" }]
  });
  const changes = [];
  session.subscribe(({ type }) => changes.push(type));
  assert.equal(session.setSearch("deadlyAnimals", "beak").type, "setSearch");
  assert.equal(session.setSearch("deadlyAnimals", "beak"), false);
  session.setSearch("keyCharacters", "state");
  session.toggleCharacter("keyCharacters", "key", true);
  session.toggleCharacter("bountyTargets", "bounty", true);
  assert.equal(session.showMany("keyCharacters", ["key"]), false);
  session.toggleAnimal("animal", true);
  session.toggleNestSource({ nestItemId: "egg", nestId: "nest" }, true);
  assert.equal(session.showMany("deadlyAnimals", ["animal"]), false);
  const snapshot = session.getSnapshot();
  assert.deepEqual(snapshot.checkedKeyCharacterIds, ["key"]);
  assert.deepEqual(snapshot.checkedBountyTargetIds, ["bounty"]);
  assert.deepEqual(snapshot.checkedAnimalIds, ["animal"]);
  assert.deepEqual(snapshot.checkedNestSources, [{ nestItemId: "egg", nestId: "nest" }]);
  assert.throws(() => session.toggleAnimal("missing"), /Unknown Context Animal ID/u);
  assert.throws(
    () => session.toggleCharacter("keyCharacters", "missing"),
    /Unknown Context Character ID/u
  );
  assert.throws(() => snapshot.checkedAnimalIds.push("mutate"), TypeError);
  session.clearSubject("deadlyAnimals");
  assert.deepEqual(session.getSnapshot().checkedKeyCharacterIds, ["key"]);
  assert.deepEqual(session.getSnapshot().checkedBountyTargetIds, ["bounty"]);
  session.restoreDefaults();
  assert.deepEqual(session.getSnapshot().checkedKeyCharacterIds, []);
  assert.deepEqual(session.getSnapshot().checkedBountyTargetIds, []);
  assert.deepEqual(changes, [
    "setSearch",
    "setSearch",
    "toggleCharacter",
    "toggleCharacter",
    "toggleAnimal",
    "toggleNestSource",
    "clearSubject",
    "restoreDefaults"
  ]);
});

test("reachability failure preserves the complete Animal fallback and disables Context", () => {
  const fixture = contextFixture();
  const discoveryCatalog = createDiscoveryCatalog({ datasets: fixture.datasets });
  const catalog = createDiscoveryContextCatalog({
    discoveryCatalog,
    datasets: fixture.datasets,
    baseline: null
  });
  assert.equal(catalog.available, false);
  assert.equal(catalog.characters.length, fixture.datasets.characters.length);
  assert.equal(catalog.animals.length, fixture.datasets.animals.length);
  assert.equal(catalog.deadlyAnimals.length, 0);
});
