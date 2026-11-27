import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_TYPES,
  ScenarioSession,
  createScenarioCommand,
  createScenarioLensProjection,
  normalizeScenarioBaseline,
  serializeScenarioEnvelope
} from "../modules/scenario/index.js";
import { createScenarioFixture, reference, town, worldState } from "./fixtures/scenario-fixture.js";

const VANILLA_HASH = "56b5eb802ac4d395b67ae10da0a79c4781853aaca11fc8b76a3ec9215f809411";
const ACKNOWLEDGED_STATE_IDS = [
  "63144-rebirth.mod",
  "1533834-rebirth.mod",
  "63881-Dialogue.mod",
  "59123-Dialogue.mod",
  "62347-Dialogue.mod",
  "65302-Dialogue.mod",
  "97160-Dialogue.mod",
  "1534045-rebirth.mod"
];

function campaign(StringId, ReferenceCategories = {}, Name = StringId) {
  return {
    Name,
    StringId,
    Values: { "display name": Name },
    ReferenceCategories,
    Referrers: []
  };
}

function bountyCharacter(
  StringId,
  {
    Name = StringId,
    amount = 1000,
    chance = 100,
    unique = false,
    factions = [reference("faction-a", 0, "Faction A")]
  } = {}
) {
  return {
    Name,
    StringId,
    Values: {
      "bounty amount": amount,
      "bounty chance": chance,
      unique
    },
    ReferenceCategories: { "bounty factions": factions },
    Referrers: []
  };
}

function command(type, payload, id = "lens-command") {
  return createScenarioCommand(type, payload, {
    id,
    occurredAt: "2026-08-25T12:00:00.000Z"
  });
}

function createProjection(baseline, session, references = {}) {
  return createScenarioLensProjection({
    baseline,
    snapshot: session.getSnapshot(),
    journal: session.getJournal(),
    timeline: session.getTimeline(),
    campaigns: references.campaigns ?? [],
    characters: references.characters ?? []
  });
}

test("relations, global status, history, and territorial ranks share one immutable projection", () => {
  const fixture = createScenarioFixture();
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  session.dispatch(
    command(COMMAND_TYPES.SET_FACTION_RELATION, {
      factionId: "faction-a",
      value: 60,
      playerInvolved: true
    })
  );
  const projection = createProjection(baseline, session);

  assert.equal(projection.relations.byFactionId["faction-a"].classification, "ally");
  assert.equal(
    projection.globalStatus.relations.find((entry) => entry.id === "faction-a").classification,
    "ally"
  );
  assert.equal(projection.worldHistory.length, 2);
  assert.equal(projection.worldHistory[0].commandId, "lens-command");
  assert.ok(projection.powerRanks.every((entry) => !("activeSpawns" in entry)));
  assert.throws(() => projection.relations.factions.push({}), TypeError);
});

test("territorial ranks count losses to unowned towns and break ties by name then ID", () => {
  const fixture = createScenarioFixture({
    worldStates: [worldState("alpha-dead", { "NPC is": [reference("alpha", 0)] })],
    towns: [
      town("alpha-base", {
        Name: "Alpha Base",
        owner: "Zulu",
        ownerId: "zulu",
        overrides: ["alpha-fallen"]
      }),
      town("alpha-fallen", {
        Name: "Alpha Fallen",
        owner: "Unknown",
        ownerId: "",
        conditions: [{ id: "alpha-dead", value: 1 }]
      }),
      town("bravo-base", { Name: "Bravo Base", owner: "Alpha", ownerId: "alpha-faction" }),
      town("charlie-base", { Name: "Charlie Base", owner: "Alpha", ownerId: "alpha-faction-2" })
    ],
    squads: [],
    spawnAreas: [],
    mapData: [
      { Name: "Alpha", InstanceId: "alpha-marker", TargetId: "alpha-base" },
      { Name: "Bravo", InstanceId: "bravo-marker", TargetId: "bravo-base" },
      { Name: "Charlie", InstanceId: "charlie-marker", TargetId: "charlie-base" }
    ]
  });
  fixture.datasets.factions.push(
    {
      Name: "Zulu",
      StringId: "zulu",
      Values: { "enemy classification": -10 },
      ReferenceCategories: {},
      Referrers: []
    },
    {
      Name: "Alpha",
      StringId: "alpha-faction",
      Values: { "enemy classification": -10 },
      ReferenceCategories: {},
      Referrers: []
    },
    {
      Name: "Alpha",
      StringId: "alpha-faction-2",
      Values: { "enemy classification": -10 },
      ReferenceCategories: {},
      Referrers: []
    }
  );
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  session.dispatch(
    command(COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "alpha",
      status: 0,
      playerInvolved: true
    })
  );
  const ranks = createProjection(baseline, session).powerRanks;

  assert.deepEqual(
    ranks.map((entry) => entry.id),
    ["alpha-faction", "alpha-faction-2", "zulu"]
  );
  assert.deepEqual(
    ranks.map((entry) => entry.townsOwned),
    [1, 1, 0]
  );
  assert.equal(ranks.find((entry) => entry.id === "zulu").change, -1);
});

test("campaign eligibility resolves inheritance and reports incomplete graphs without predicting scheduling", () => {
  const fixture = createScenarioFixture();
  const factionA = fixture.datasets.factions.find((entry) => entry.StringId === "faction-a");
  factionA.ReferenceCategories.campaigns = [
    reference("campaign-alive", 0, "Alive Campaign"),
    reference("campaign-child", 0, "Child Campaign"),
    reference("campaign-open", 0, "Open Campaign"),
    reference("campaign-missing", 0, "Missing Campaign"),
    reference("campaign-cycle-a", 0, "Cyclic Campaign")
  ];
  const campaigns = [
    campaign(
      "campaign-alive",
      { "world state": [reference("state-alive", 1, "Alpha is alive")] },
      "Alive Campaign"
    ),
    campaign(
      "campaign-child",
      {
        "inherits from": [reference("campaign-alive", 0, "Alive Campaign")],
        "world state": [reference("state-dead", 1, "Alpha is dead")]
      },
      "Child Campaign"
    ),
    campaign("campaign-open", {}, "Open Campaign"),
    campaign("campaign-cycle-a", {
      "inherits from": [reference("campaign-cycle-b", 0)]
    }),
    campaign("campaign-cycle-b", {
      "inherits from": [reference("campaign-cycle-a", 0)]
    })
  ];
  const baseline = normalizeScenarioBaseline(fixture);
  const projection = createProjection(baseline, new ScenarioSession(baseline), { campaigns });
  const faction = projection.relations.byFactionId["faction-a"];
  const byId = Object.fromEntries(faction.campaigns.map((entry) => [entry.id, entry]));

  assert.equal(byId["campaign-alive"].status, "eligible");
  assert.equal(byId["campaign-child"].status, "blocked");
  assert.equal(byId["campaign-child"].requiredCount, 2);
  assert.equal(byId["campaign-open"].status, "no-prerequisites");
  assert.equal(byId["campaign-missing"].status, "indeterminate");
  assert.equal(byId["campaign-cycle-a"].status, "indeterminate");
  assert.match(byId["campaign-alive"].schedulingNote, /does not predict/u);
  assert.ok(
    projection.relations.diagnostics.some((entry) => entry.code === "campaign_missing_reference")
  );
  assert.ok(
    projection.relations.diagnostics.some((entry) => entry.code === "campaign_inheritance_cycle")
  );
});

test("bounties use unique-or-world-state identity and preserve non-guaranteed chance", () => {
  const fixture = createScenarioFixture();
  const tracked = bountyCharacter("alpha", { Name: "Alpha", unique: false });
  const referenceOnly = bountyCharacter("blue-eyes", {
    Name: "Blue Eyes",
    chance: 5,
    unique: true
  });
  const generic = bountyCharacter("escaped-servant", {
    Name: "Escaped Servant",
    unique: false
  });
  fixture.datasets.characters = [
    tracked,
    bountyCharacter("bravo", { amount: 0 }),
    referenceOnly,
    generic
  ];
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  const projection = createProjection(baseline, session, {
    characters: fixture.datasets.characters
  });

  assert.deepEqual(
    projection.infamy.bounties.map((entry) => entry.id),
    ["alpha", "blue-eyes"]
  );
  assert.equal(projection.infamy.bounties[0].statusLabel, "Alive");
  assert.equal(projection.infamy.bounties[1].statusLabel, "Reference only");
  assert.equal(projection.infamy.bounties[1].chanceLabel, "5%");
});

test("town override projection separates active history from current eligibility and death locks", () => {
  const fixture = createScenarioFixture({
    worldStates: [worldState("alpha-alive", { "NPC is": [reference("alpha", 1, "Alpha")] })],
    towns: [
      town("base", { Name: "Base", overrides: ["alive-branch", "dead-branch"] }),
      town("alive-branch", {
        Name: "Alive Branch",
        owner: "Faction A",
        ownerId: "faction-a",
        conditions: [{ id: "alpha-alive", value: 1 }]
      }),
      town("dead-branch", {
        Name: "Dead Branch",
        conditions: [{ id: "alpha-alive", value: 0 }]
      })
    ],
    squads: [],
    spawnAreas: [],
    mapData: [{ Name: "Base marker", InstanceId: "base-marker", TargetId: "base" }]
  });
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  const before = createProjection(baseline, session).townOverrides.byBaseTownId.base;
  assert.deepEqual(
    before.edges.map((edge) => edge.targetId),
    ["alive-branch", "dead-branch"]
  );
  assert.equal(before.activeTownId, "alive-branch");
  assert.equal(before.edges[0].status, "active");
  assert.equal(before.edges[0].historicallyTraversed, true);
  assert.equal(before.edges[0].traversalCount, 1);
  assert.equal(before.transitionHistory.length, 1);

  session.dispatch(
    command(COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "alpha",
      status: 0,
      playerInvolved: true
    })
  );
  const after = createProjection(baseline, session).townOverrides.byBaseTownId.base;
  assert.equal(after.activeTownId, "alive-branch");
  assert.equal(after.edges[0].status, "active");
  assert.equal(after.edges[0].eligible, false);
  assert.match(after.edges[0].implausibilityReason, /Alpha/u);
  assert.equal(after.edges[1].eligible, true);
  assert.equal(after.edges[1].availableFromActiveNode, false);
});

test("spawn activity and narrative return across Undo, Redo, and document replacement", () => {
  const baseline = normalizeScenarioBaseline(createScenarioFixture());
  const session = new ScenarioSession(baseline);
  session.dispatch(
    command(COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "alpha",
      status: 0,
      playerInvolved: true
    })
  );
  const afterDispatch = createProjection(baseline, session);
  assert.deepEqual(
    afterDispatch.infamy.spawns[0].entries.map((entry) => entry.occurrenceId),
    ["area-one:Nest:nest-one", "area-one:Squad:squad-one", "area-one:Squad:squad-one:2"]
  );
  assert.ok(afterDispatch.worldHistory.some((entry) => entry.message.includes("lost control")));

  session.undo();
  assert.equal(createProjection(baseline, session).worldHistory.length, 0);
  session.redo();
  assert.deepEqual(createProjection(baseline, session), afterDispatch);

  const envelope = serializeScenarioEnvelope(session);
  const replacement = new ScenarioSession(baseline);
  replacement.replaceDocument(envelope);
  assert.deepEqual(createProjection(baseline, replacement), afterDispatch);
});

test("known conditionless diagnostics are acknowledged only for the exact vanilla baseline", () => {
  function diagnosticFixture(manifestId) {
    const fixture = createScenarioFixture({
      manifestId,
      worldStates: ACKNOWLEDGED_STATE_IDS.map((id) => worldState(id, {})),
      towns: [town("base")],
      squads: [],
      spawnAreas: []
    });
    if (manifestId === "vanilla") {
      for (const metadata of Object.values(fixture.contract.datasets)) {
        metadata.url = metadata.url.replace("fixture-hash", VANILLA_HASH);
      }
    }
    return fixture;
  }

  const vanilla = normalizeScenarioBaseline(diagnosticFixture("vanilla"));
  const vanillaProjection = createProjection(vanilla, new ScenarioSession(vanilla));
  assert.equal(vanillaProjection.diagnostics.acknowledged.length, 8);
  assert.equal(vanillaProjection.diagnostics.visible.length, 0);

  const custom = normalizeScenarioBaseline(diagnosticFixture("test-manifest"));
  const customProjection = createProjection(custom, new ScenarioSession(custom));
  assert.equal(customProjection.diagnostics.acknowledged.length, 0);
  assert.equal(customProjection.diagnostics.visible.length, 8);

  const changedVanillaFixture = diagnosticFixture("vanilla");
  for (const metadata of Object.values(changedVanillaFixture.contract.datasets)) {
    metadata.url = metadata.url.replace(VANILLA_HASH, "different-vanilla-hash");
  }
  const changedVanilla = normalizeScenarioBaseline(changedVanillaFixture);
  const changedProjection = createProjection(changedVanilla, new ScenarioSession(changedVanilla));
  assert.equal(changedProjection.diagnostics.acknowledged.length, 0);
  assert.equal(changedProjection.diagnostics.visible.length, 8);
});
