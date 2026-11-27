import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_TYPES,
  ScenarioError,
  ScenarioSession,
  createScenarioAdapters,
  normalizeScenarioBaseline,
  replayScenario,
  serializeScenarioEnvelope
} from "../modules/scenario/index.js";
import {
  createScenarioFixture,
  faction,
  reference,
  town,
  worldState
} from "./fixtures/scenario-fixture.js";

function command(id, type, payload, occurredAt = "2026-08-23T12:00:00.000Z") {
  return { id, type, payload, occurredAt };
}

function characterCommand(
  id,
  status,
  playerInvolved = true,
  occurredAt = "2026-08-23T12:00:00.000Z"
) {
  return command(
    id,
    COMMAND_TYPES.SET_CHARACTER_STATUS,
    {
      characterId: "alpha",
      status,
      playerInvolved
    },
    occurredAt
  );
}

function relationCommand(id, value, playerInvolved = true) {
  return command(id, COMMAND_TYPES.SET_FACTION_RELATION, {
    factionId: "faction-a",
    value,
    playerInvolved
  });
}

function baseline(options) {
  return normalizeScenarioBaseline(createScenarioFixture(options));
}

test("normalization derives immutable vanilla and custom baseline identities", () => {
  const vanilla = baseline({ manifestId: "vanilla" });
  assert.equal(vanilla.key, "vanilla:fixture-hash");
  assert.equal(vanilla.contractVersion, 3);
  assert.throws(() => vanilla.characters.push({}), TypeError);

  const custom = baseline();
  assert.equal(custom.key, "manifest:test-manifest");
  assert.equal(custom.mapLocationById["marker-one"].targetId, "town-base");
  const altered = createScenarioFixture();
  altered.contract.datasets.squads.url =
    "https://map.kenshi.wiki/data/mod-manifests/different/squads.json";
  assert.throws(
    () => normalizeScenarioBaseline(altered),
    (error) => error instanceof ScenarioError && error.code === "manifest_namespace_mismatch"
  );
});

test("normalization includes every NPC condition reference and rejects duplicate identities", () => {
  const normalized = baseline({ characters: [] });
  assert.deepEqual(
    normalized.characters.map((character) => character.id),
    ["alpha", "bravo"]
  );
  assert.equal(normalized.characterById.alpha.name, "Alpha");

  const fixture = createScenarioFixture();
  fixture.datasets.factions.push({ ...fixture.datasets.factions[1] });
  assert.throws(
    () => normalizeScenarioBaseline(fixture),
    (error) => error instanceof ScenarioError && error.code === "duplicate_scenario_identity"
  );
});

test("normalization rejects missing supported references", () => {
  const fixture = createScenarioFixture({
    worldStates: [
      worldState("missing-faction", {
        "player ally": [reference("not-a-faction", 1)]
      })
    ],
    towns: [town("only-town")],
    squads: [],
    spawnAreas: []
  });
  assert.throws(
    () => normalizeScenarioBaseline(fixture),
    (error) => error instanceof ScenarioError && error.code === "missing_scenario_identity"
  );
});

test("normalization rejects player-faction relations to missing faction identities", () => {
  const fixture = createScenarioFixture({
    factions: [
      faction("204-gamedata.base", "Nameless", -10, [reference("missing", 0)]),
      faction("neutral", "Neutral")
    ],
    worldStates: [worldState("alive", { "NPC is": [reference("alpha", 1)] })],
    towns: [town("town-base")],
    squads: [],
    spawnAreas: []
  });
  assert.throws(
    () => normalizeScenarioBaseline(fixture),
    (error) =>
      error instanceof ScenarioError &&
      error.code === "missing_scenario_identity" &&
      error.context.factionId === "missing"
  );
});

test("deprecated town okay data is stripped or tombstoned and conditionless states warn", () => {
  const normalized = baseline({
    worldStates: [
      worldState("mixed", {
        "NPC is": [reference("alpha", 1)],
        "town okay": [reference("town-base", 1)]
      }),
      worldState("town-only", { "town okay": [reference("town-base", 1)] }),
      worldState("conditionless", {})
    ],
    towns: [town("town-base")],
    squads: [],
    spawnAreas: []
  });

  assert.equal(normalized.worldStateById.mixed.active, true);
  assert.deepEqual(
    normalized.worldStateById.mixed.conditions.map((condition) => condition.category),
    ["NPC is"]
  );
  assert.equal(normalized.worldStateById["town-only"].active, false);
  assert.equal(normalized.worldStateById.conditionless.active, false);
  assert.deepEqual(normalized.diagnostics.map((entry) => entry.code).sort(), [
    "conditionless_world_state",
    "deprecated_town_condition_removed",
    "deprecated_town_condition_tombstone"
  ]);
});

test("unknown condition categories make the scenario baseline unavailable", () => {
  const fixture = createScenarioFixture({
    worldStates: [worldState("unknown", { mysterious: [reference("alpha", 1)] })],
    towns: [town("town-base")],
    squads: [],
    spawnAreas: []
  });
  assert.throws(
    () => normalizeScenarioBaseline(fixture),
    (error) => error instanceof ScenarioError && error.code === "unsupported_condition_category"
  );
});

test("player involvement preserves baseline truth and gates command-caused activation", () => {
  const session = new ScenarioSession(baseline());
  assert.equal(session.getSnapshot().worldStates["state-alive"], 1);
  assert.equal(session.getSnapshot().worldStates["state-alive-player"], 1);
  assert.equal(session.getSnapshot().worldStates["state-dead-player"], 0);

  session.dispatch(characterCommand("non-player-death", 0, false));
  assert.equal(session.getSnapshot().characters.alpha, 0);
  assert.equal(session.getSnapshot().worldStates["state-alive-player"], 0);
  assert.equal(session.getSnapshot().worldStates["state-dead-player"], 0);

  session.dispatch(characterCommand("player-provenance", 0, true));
  assert.equal(session.getSnapshot().characterProvenance.alpha, true);
  assert.equal(session.getSnapshot().worldStates["state-dead-player"], 1);
  assert.equal(session.getJournal().length, 2);

  session.undo();
  assert.equal(session.getSnapshot().worldStates["state-dead-player"], 0);
  session.redo();
  assert.equal(session.getSnapshot().worldStates["state-dead-player"], 1);
});

test("fresh Stack-shaped towns do not activate an override from alive-state provenance", () => {
  const normalized = baseline({
    worldStates: [
      worldState(
        "seta-alive",
        { "NPC is": [reference("seta", 1, "High Inquisitor Seta")] },
        { playerInvolvement: true }
      ),
      worldState("esata-alive", {
        "NPC is": [reference("esata", 1, "Esata the Stone Golem")]
      })
    ],
    towns: [
      town("stack", { Name: "Stack", overrides: ["stack-shek"] }),
      town("stack-shek", {
        Name: "Stack (override) takeover",
        owner: "Shek Kingdom",
        ownerId: "faction-a",
        conditions: [
          { id: "seta-alive", value: 0 },
          { id: "esata-alive", value: 1 }
        ]
      })
    ],
    mapData: [
      {
        InstanceId: "stack-marker",
        TargetId: "stack",
        Name: "Stack",
        X: 10,
        Y: 0,
        Z: 20
      }
    ],
    squads: [],
    spawnAreas: []
  });
  const session = new ScenarioSession(normalized);

  assert.equal(session.getSnapshot().worldStates["seta-alive"], 1);
  assert.equal(session.getSnapshot().worldStates["esata-alive"], 1);
  assert.equal(session.getSnapshot().world.towns.stack.activeTownId, "stack");

  session.dispatch(
    command("seta-death", COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "seta",
      status: 0,
      playerInvolved: true
    })
  );
  assert.equal(session.getSnapshot().world.towns.stack.activeTownId, "stack-shek");
});

test("imprisonment and release are reversible while death is forward-permanent", () => {
  const session = new ScenarioSession(baseline());
  session.dispatch(characterCommand("imprison", 2));
  assert.equal(session.getSnapshot().worldStates["state-imprisoned"], 1);
  session.dispatch(characterCommand("release", 1));
  assert.equal(session.getSnapshot().worldStates["state-imprisoned"], 0);
  session.dispatch(characterCommand("death", 0));
  assert.equal(session.getSnapshot().characters.alpha, 0);

  const before = session.getSnapshot();
  assert.throws(
    () => session.dispatch(characterCommand("resurrection", 1)),
    (error) => error.code === "character_death_is_permanent"
  );
  assert.strictEqual(session.getSnapshot(), before);

  session.undo();
  assert.equal(session.getSnapshot().characters.alpha, 1);
  session.redo();
  assert.equal(session.getSnapshot().characters.alpha, 0);
});

test("one relation command owns threshold consequences and one Undo unit", () => {
  const session = new ScenarioSession(baseline());
  session.dispatch(relationCommand("ally", 60));
  assert.equal(session.getJournal().length, 1);
  assert.deepEqual(session.getJournal()[0].consequences, ["You are now an ally of Faction A."]);
  assert.equal(session.canUndo(), true);
  session.undo();
  assert.equal(session.getSnapshot().relations["faction-a"], 0);
  assert.equal(session.canUndo(), false);
  assert.equal(session.canRedo(), true);
});

test("relation provenance gates only world states that request player involvement", () => {
  const session = new ScenarioSession(baseline());
  session.dispatch(relationCommand("ally-no-player", 60, false));
  assert.equal(session.getSnapshot().worldStates["state-ally"], 1);
  assert.equal(session.getSnapshot().worldStates["state-ally-player"], 0);

  session.dispatch(relationCommand("ally-player", 60, true));
  assert.equal(session.getSnapshot().worldStates["state-ally-player"], 1);
  session.undo();
  assert.equal(session.getSnapshot().worldStates["state-ally-player"], 0);
});

test("changed character provenance cannot be replaced by relation provenance", () => {
  const normalized = baseline({
    worldStates: [
      worldState(
        "dead-and-enemy-player",
        {
          "NPC is": [reference("alpha", 0, "Alpha")],
          "player enemy": [reference("faction-a", 1, "Faction A")]
        },
        { playerInvolvement: true }
      ),
      worldState(
        "alive-and-enemy-player",
        {
          "NPC is": [reference("alpha", 1, "Alpha")],
          "player enemy": [reference("faction-a", 1, "Faction A")]
        },
        { playerInvolvement: true }
      )
    ],
    towns: [town("town-base")],
    squads: [],
    spawnAreas: []
  });

  const relationCaused = new ScenarioSession(normalized);
  relationCaused.dispatch(relationCommand("player-enemy", -100, true));
  assert.equal(relationCaused.getSnapshot().worldStates["alive-and-enemy-player"], 1);
  relationCaused.dispatch(characterCommand("non-player-death", 0, false));
  assert.equal(relationCaused.getSnapshot().worldStates["dead-and-enemy-player"], 0);

  const characterCaused = new ScenarioSession(normalized);
  characterCaused.dispatch(characterCommand("player-death", 0, true));
  characterCaused.dispatch(relationCommand("non-player-enemy", -100, false));
  assert.equal(characterCaused.getSnapshot().worldStates["dead-and-enemy-player"], 1);
});

test("dependency provenance follows only conditions that establish the resolved value", () => {
  const normalized = baseline({
    worldStates: [
      worldState("both-alive", {
        "NPC is": [reference("alpha", 1, "Alpha"), reference("bravo", 1, "Bravo")]
      }),
      worldState(
        "both-alive-is-false-by-player",
        { "world state": [reference("both-alive", 0)] },
        { playerInvolvement: true }
      )
    ],
    towns: [town("town-base")],
    squads: [],
    spawnAreas: []
  });
  const session = new ScenarioSession(normalized);

  session.dispatch(characterCommand("alpha-player", 1, true));
  session.dispatch(
    command("bravo-non-player-death", COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "bravo",
      status: 0,
      playerInvolved: false
    })
  );

  assert.equal(session.getSnapshot().worldStates["both-alive"], 0);
  assert.equal(session.getSnapshot().worldStateProvenance["both-alive"], false);
  assert.equal(session.getSnapshot().worldStates["both-alive-is-false-by-player"], 0);

  session.dispatch(
    command("bravo-player-involvement", COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "bravo",
      status: 0,
      playerInvolved: true
    })
  );
  assert.equal(session.getSnapshot().worldStateProvenance["both-alive"], true);
  assert.equal(session.getSnapshot().worldStates["both-alive-is-false-by-player"], 1);
});

test("rejected and no-op commands preserve state, journal, redo, and subscribers", () => {
  const session = new ScenarioSession(baseline());
  let notifications = 0;
  session.subscribe(() => {
    notifications += 1;
  });
  session.dispatch(relationCommand("ally", 60));
  session.undo();
  const snapshot = session.getSnapshot();
  const journal = session.getJournal();
  const notificationsBefore = notifications;

  assert.throws(
    () => session.dispatch(relationCommand("noop", 0, false)),
    (error) => error.code === "scenario_no_change"
  );
  assert.strictEqual(session.getSnapshot(), snapshot);
  assert.strictEqual(session.getJournal(), journal);
  assert.equal(session.canRedo(), true);
  assert.equal(notifications, notificationsBefore);

  assert.throws(
    () => session.dispatch(relationCommand("invalid", 101)),
    (error) => error.code === "invalid_scenario_command"
  );
  assert.equal(session.canRedo(), true);
  assert.equal(notifications, notificationsBefore);

  assert.throws(
    () => session.dispatch(relationCommand("null-provenance", 1, null)),
    (error) => error.code === "invalid_scenario_command"
  );
  assert.equal(session.canRedo(), true);
  assert.equal(notifications, notificationsBefore);
});

test("direct replay, document replacement, Undo, and Redo agree", () => {
  const normalized = baseline();
  const commands = [characterCommand("imprison", 2, false), relationCommand("ally", 60, true)];
  const direct = replayScenario(normalized, commands);

  const directSession = new ScenarioSession(normalized);
  commands.forEach((entry) => directSession.dispatch(entry));
  assert.deepEqual(directSession.getSnapshot(), direct.snapshot);

  const envelope = serializeScenarioEnvelope(directSession);
  const envelopeSession = new ScenarioSession(normalized);
  envelopeSession.replaceDocument(JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(envelopeSession.getSnapshot(), direct.snapshot);
  envelopeSession.undo();
  envelopeSession.redo();
  assert.deepEqual(envelopeSession.getSnapshot(), direct.snapshot);
});

test("world-state ordering does not affect the settled result", () => {
  const states = [
    worldState("chain-a", { "NPC is": [reference("alpha", 1)] }),
    worldState("chain-b", { "world state": [reference("chain-a", 1)] }),
    worldState("chain-c", { "world state": [reference("chain-b", 1)] })
  ];
  const options = { towns: [town("town-base")], squads: [], spawnAreas: [] };
  const forward = baseline({ ...options, worldStates: states });
  const reversed = baseline({ ...options, worldStates: [...states].reverse() });
  assert.deepEqual(
    new ScenarioSession(forward).getSnapshot().worldStates,
    new ScenarioSession(reversed).getSnapshot().worldStates
  );
});

test("non-convergent attempted commands are rejected atomically", () => {
  const normalized = baseline({
    worldStates: [
      worldState("toggle", {
        "NPC is": [reference("alpha", 0)],
        "world state": [reference("toggle", 0)]
      })
    ],
    towns: [town("town-base")],
    squads: [],
    spawnAreas: []
  });
  const session = new ScenarioSession(normalized);
  let notifications = 0;
  session.subscribe(() => {
    notifications += 1;
  });
  const before = session.getSnapshot();
  assert.throws(
    () => session.dispatch(characterCommand("death", 0)),
    (error) => error.code === "world_state_nonconvergence"
  );
  assert.strictEqual(session.getSnapshot(), before);
  assert.equal(session.getJournal().length, 0);
  assert.equal(notifications, 0);
});

test("town resolution uses weighted order and stops before a same-cascade repeat", () => {
  const normalized = baseline({
    worldStates: [worldState("alive", { "NPC is": [reference("alpha", 1)] })],
    towns: [
      town("base", { overrides: ["first", "second"] }),
      town("first", {
        Name: "First",
        owner: "Faction A",
        ownerId: "faction-a",
        overrides: ["base"],
        conditions: [{ id: "alive", value: 1 }]
      }),
      town("second", { Name: "Second", conditions: [{ id: "alive", value: 1 }] })
    ],
    squads: [],
    spawnAreas: [],
    mapData: [
      { Name: "Base marker", InstanceId: "base-marker", TargetId: "base" },
      { Name: "Base marker 2", InstanceId: "base-marker-2", TargetId: "base" }
    ]
  });
  const snapshot = new ScenarioSession(normalized).getSnapshot();
  assert.deepEqual(normalized.mapTownIds, ["base"]);
  assert.deepEqual(Object.keys(snapshot.world.towns), ["base"]);
  assert.equal(snapshot.world.towns.base.activeTownId, "first");
  assert.deepEqual(snapshot.world.towns.base.path, ["base", "first"]);
  assert.deepEqual(
    snapshot.world.towns.base.transitions.map((entry) => [entry.sourceTownId, entry.targetTownId]),
    [["base", "first"]]
  );
  assert.equal(snapshot.world.towns.base.ambiguous, true);
  assert.equal(snapshot.world.towns.base.cycle, true);
  assert.ok(snapshot.diagnostics.some((entry) => entry.code === "town_override_ambiguity"));
  assert.ok(snapshot.diagnostics.some((entry) => entry.code === "town_override_cycle"));
});

test("spawn occurrences have stable entity and unique occurrence identities", () => {
  const snapshot = new ScenarioSession(baseline()).getSnapshot();
  const entries = Object.values(snapshot.world.spawns["area-one"].entries);
  assert.deepEqual(
    entries.map((entry) => entry.occurrenceId),
    ["area-one:Squad:squad-one", "area-one:Squad:squad-one:2", "area-one:Nest:nest-one"]
  );
  assert.deepEqual(
    entries.map((entry) => entry.entityId),
    ["squad-one", "squad-one", "nest-one"]
  );
});

test("derived town and narrative snapshots disappear and return across Undo and Redo", () => {
  const session = new ScenarioSession(baseline());
  assert.equal(session.getSnapshot().world.towns["town-base"].activeTownId, "town-base");
  session.dispatch(characterCommand("death", 0));
  assert.equal(session.getSnapshot().world.towns["town-base"].activeTownId, "town-dead");
  assert.ok(session.getSnapshot().narrative.some((entry) => entry.includes("lost control")));
  session.undo();
  assert.equal(session.getSnapshot().world.towns["town-base"].activeTownId, "town-base");
  assert.deepEqual(session.getSnapshot().narrative, []);
  session.redo();
  assert.equal(session.getSnapshot().world.towns["town-base"].activeTownId, "town-dead");
});

test("scenario envelope validates its baseline and command metadata does not affect reduction", () => {
  const normalized = baseline();
  const first = replayScenario(normalized, [characterCommand("first", 2, false)]).snapshot;
  const second = replayScenario(normalized, [
    characterCommand("different-id", 2, false, "2030-01-01T00:00:00.000Z")
  ]).snapshot;
  assert.deepEqual(first, second);

  const session = new ScenarioSession(normalized);
  session.dispatch(characterCommand("imprison", 2));
  const envelope = serializeScenarioEnvelope(session);
  assert.equal(envelope.documentType, "scenario");
  assert.equal(envelope.schemaVersion, 1);
  assert.deepEqual(envelope.baseline, {
    contractVersion: 3,
    manifestId: "test-manifest",
    key: "manifest:test-manifest"
  });
  assert.throws(
    () => new ScenarioSession(baseline({ manifestId: "other" }), envelope),
    (error) => error.code === "scenario_baseline_mismatch"
  );
  assert.throws(
    () => session.replaceDocument([]),
    (error) => error.code === "invalid_scenario_envelope"
  );
  assert.throws(
    () => session.replaceDocument({ ...envelope, documentType: "markerSet" }),
    (error) => error.code === "invalid_scenario_envelope"
  );
});

test("read-only adapters expose current renderer reads without mutation authority", () => {
  const session = new ScenarioSession(baseline());
  const adapters = createScenarioAdapters(session);
  assert.equal(adapters.characterStore.getCharacter("alpha").status, 1);
  assert.equal(adapters.relationsStore.getFaction("faction-a").Name, "Faction A");
  assert.equal(adapters.worldStateStore.getState("state-alive"), 1);
  assert.deepEqual(adapters.historyStore.getHistory(), []);
  assert.equal("setRelation" in adapters.relationsStore, false);
  assert.equal("setCharacterStatus" in adapters.characterStore, false);

  session.dispatch(characterCommand("death", 0));
  assert.equal(adapters.characterStore.getCharacter("alpha").status, 0);
  assert.equal(adapters.historyStore.getHistory().length, 1);
  assert.throws(() => adapters.worldStateStore.worldStateData.push({}), TypeError);
});

test("successful transactions emit exactly one post-commit notification", () => {
  const session = new ScenarioSession(baseline());
  const observed = [];
  session.subscribe((change) => observed.push(change));
  session.dispatch(characterCommand("imprison", 2));
  session.undo();
  session.redo();
  session.replaceDocument(serializeScenarioEnvelope(baseline(), []));
  assert.deepEqual(
    observed.map((change) => change.type),
    ["dispatch", "undo", "redo", "replaceDocument"]
  );
  assert.ok(observed.every((change) => Object.isFrozen(change.snapshot)));
});
