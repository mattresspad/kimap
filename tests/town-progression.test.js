import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_TYPES,
  ScenarioSession,
  createScenarioLensProjection,
  getTownProgressionIndex,
  initializeTownProgression,
  normalizeScenarioBaseline,
  replayScenario,
  serializeScenarioEnvelope
} from "../modules/scenario/index.js";
import {
  createContextProjection,
  createSelectionCatalog,
  createSelectionOrigin
} from "../modules/selection/index.js";
import { createScenarioFixture, reference, town, worldState } from "./fixtures/scenario-fixture.js";

const OCCURRED_AT = "2026-08-30T18:00:00.000Z";
const CREATED_AT = "2026-08-30T12:00:00.000Z";

function characterCommand(id, status) {
  return {
    id,
    type: COMMAND_TYPES.SET_CHARACTER_STATUS,
    occurredAt: OCCURRED_AT,
    payload: { characterId: "alpha", status, playerInvolved: true }
  };
}

function relationCommand(id, value) {
  return {
    id,
    type: COMMAND_TYPES.SET_FACTION_RELATION,
    occurredAt: OCCURRED_AT,
    payload: { factionId: "faction-a", value, playerInvolved: true }
  };
}

function normalizedFixture({ worldStates, towns, mapData } = {}) {
  return normalizeScenarioBaseline(
    createScenarioFixture({
      worldStates,
      towns,
      mapData: mapData ?? [
        { Name: "Base marker", InstanceId: "base-marker", TargetId: "base", X: 1, Z: 2 }
      ],
      squads: [],
      spawnAreas: []
    })
  );
}

test("terminal town progression survives a counter-state command but rewinds with ordered Undo", () => {
  const baseline = normalizedFixture({
    worldStates: [worldState("bull-alive", { "NPC is": [reference("alpha", 1, "Flying Bull")] })],
    towns: [
      town("base", { Name: "New Kralia", overrides: ["fallen"] }),
      town("fallen", {
        Name: "New Kralia (override)",
        owner: "Kral's Chosen",
        ownerId: "faction-a",
        conditions: [{ id: "bull-alive", value: 0 }]
      })
    ]
  });
  const session = new ScenarioSession(baseline);

  session.dispatch(characterCommand("imprison", 2));
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "fallen");
  assert.equal(session.getJournal()[0].townTransitions.length, 1);

  session.dispatch(characterCommand("release", 1));
  assert.equal(session.getSnapshot().worldStates["bull-alive"], 1);
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "fallen");
  assert.equal(session.getSnapshot().world.towns.base.transitions.length, 1);
  assert.equal(session.getJournal()[1].townTransitions.length, 0);
  assert.equal(
    session
      .getJournal()[1]
      .consequences.some((message) => message.includes("restored standard administration")),
    false
  );

  session.undo();
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "fallen");
  session.undo();
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "base");
  session.redo();
  session.redo();
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "fallen");

  const envelope = serializeScenarioEnvelope(session);
  assert.equal(envelope.schemaVersion, 1);
  assert.deepEqual(Object.keys(envelope).sort(), [
    "baseline",
    "commands",
    "createdAt",
    "documentType",
    "schemaVersion",
    "updatedAt"
  ]);
  const replacement = new ScenarioSession(baseline);
  replacement.replaceDocument(JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(replacement.getSnapshot(), session.getSnapshot());
  assert.deepEqual(replacement.getTimeline(), session.getTimeline());
});

test("baseline truth cascades from the canonical base and produces derived initialization history", () => {
  const baseline = normalizedFixture({
    worldStates: [worldState("alive", { "NPC is": [reference("alpha", 1)] })],
    towns: [
      town("base", { Name: "Base", overrides: ["stage-a"] }),
      town("stage-a", {
        Name: "Stage A",
        overrides: ["stage-b"],
        conditions: [{ id: "alive", value: 1 }]
      }),
      town("stage-b", {
        Name: "Stage B",
        owner: "Faction A",
        ownerId: "faction-a"
      })
    ]
  });
  const replayed = replayScenario(baseline, [], { scenarioCreatedAt: CREATED_AT });
  const active = replayed.snapshot.world.towns.base;

  assert.equal(active.activeTownId, "stage-b");
  assert.deepEqual(active.path, ["base", "stage-a", "stage-b"]);
  assert.deepEqual(
    active.transitions.map((entry) => entry.phase),
    ["initialization", "initialization"]
  );
  assert.equal(replayed.journal.length, 0);
  assert.equal(replayed.timeline.length, 2);
  assert.ok(replayed.timeline.every((entry) => entry.occurredAt === CREATED_AT));
  assert.ok(replayed.timeline.every((entry) => entry.commandId === null));
  assert.equal(replayed.snapshot.baselineWorld.towns.base.activeTownId, "stage-b");
  assert.equal(replayed.snapshot.powerStatistics[0].townsGained, 0);
  assert.equal(Object.isFrozen(active.transitions), true);
  assert.throws(() => active.transitions.push({}), TypeError);
});

test("restoration narrative requires an explicit directed edge back to the base", () => {
  const baseline = normalizedFixture({
    worldStates: [
      worldState("alive", { "NPC is": [reference("alpha", 1)] }),
      worldState("imprisoned", { "NPC is": [reference("alpha", 2)] })
    ],
    towns: [
      town("base", {
        Name: "Rebuildable Town",
        overrides: ["fallen"],
        conditions: [{ id: "alive", value: 1 }]
      }),
      town("fallen", {
        Name: "Rebuildable Town (override)",
        overrides: ["base"],
        conditions: [{ id: "imprisoned", value: 1 }]
      })
    ]
  });
  const session = new ScenarioSession(baseline);
  session.dispatch(characterCommand("imprison", 2));
  session.dispatch(characterCommand("release", 1));

  const active = session.getSnapshot().world.towns.base;
  assert.equal(active.activeTownId, "base");
  assert.deepEqual(active.path, ["base"]);
  assert.deepEqual(
    active.transitions.map((entry) => `${entry.sourceTownId}->${entry.targetTownId}`),
    ["base->fallen", "fallen->base"]
  );
  assert.ok(
    session
      .getJournal()[1]
      .consequences.some((message) => message.includes("restored standard administration"))
  );
});

test("eligible targets use fewest conditions, then declaration order, with conditionless weight zero", () => {
  const states = ["one", "two", "three", "four"].map((id) =>
    worldState(id, { "NPC is": [reference("alpha", 1)] })
  );
  const weighted = normalizedFixture({
    worldStates: states,
    towns: [
      town("base", { overrides: ["heavy", "light-first", "light-second"] }),
      town("heavy", {
        conditions: ["one", "two", "three", "four"].map((id) => ({ id, value: 1 }))
      }),
      town("light-first", { conditions: [{ id: "one", value: 1 }] }),
      town("light-second", { conditions: [{ id: "two", value: 1 }] })
    ]
  });
  const weightedSnapshot = new ScenarioSession(weighted).getSnapshot();
  assert.equal(weightedSnapshot.world.towns.base.activeTownId, "light-first");
  assert.equal(weightedSnapshot.world.towns.base.transitions[0].conditionCount, 1);
  assert.equal(weightedSnapshot.world.towns.base.transitions[0].referencePosition, 1);
  assert.ok(
    weightedSnapshot.diagnostics.some(
      (entry) =>
        entry.code === "town_override_ambiguity" &&
        entry.context.selectedOverrideId === "light-first"
    )
  );

  const unconditional = normalizedFixture({
    worldStates: [states[0]],
    towns: [
      town("base", { overrides: ["conditional", "open"] }),
      town("conditional", { conditions: [{ id: "one", value: 1 }] }),
      town("open")
    ]
  });
  const open = new ScenarioSession(unconditional).getSnapshot().world.towns.base;
  assert.equal(open.activeTownId, "open");
  assert.equal(open.transitions[0].conditionCount, 0);
  assert.equal(open.transitions[0].referencePosition, 1);
});

test("explicit returns truncate active lineage while preserving chronological transition history", () => {
  const b = town("stage-b", {
    Name: "Stage B",
    overrides: ["stage-a"],
    conditions: [{ id: "alive", value: 1 }]
  });
  b.ReferenceCategories.residents = [reference("b-resident", 1, "Only in Stage B")];
  const fixture = createScenarioFixture({
    worldStates: [
      worldState("alive", { "NPC is": [reference("alpha", 1)] }),
      worldState("imprisoned", { "NPC is": [reference("alpha", 2)] })
    ],
    towns: [
      town("base", { Name: "Base", overrides: ["stage-a"] }),
      town("stage-a", {
        Name: "Stage A",
        owner: "Faction A",
        ownerId: "faction-a",
        overrides: ["stage-b"],
        conditions: [{ id: "imprisoned", value: 1 }]
      }),
      b
    ],
    mapData: [{ Name: "Base marker", InstanceId: "base-marker", TargetId: "base", X: 1, Z: 2 }],
    squads: [],
    spawnAreas: []
  });
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  session.dispatch(characterCommand("imprison-first", 2));
  session.dispatch(characterCommand("release", 1));
  session.dispatch(relationCommand("irrelevant-relation", 1));
  assert.equal(session.getJournal()[2].townTransitions.length, 0);
  session.dispatch(characterCommand("imprison-again", 2));

  const active = session.getSnapshot().world.towns.base;
  assert.equal(active.activeTownId, "stage-a");
  assert.deepEqual(active.path, ["base", "stage-a"]);
  assert.deepEqual(
    active.transitions.map((entry) => `${entry.sourceTownId}->${entry.targetTownId}`),
    ["base->stage-a", "stage-a->stage-b", "stage-b->stage-a"]
  );

  const lenses = createScenarioLensProjection({
    baseline,
    snapshot: session.getSnapshot(),
    journal: session.getJournal(),
    timeline: session.getTimeline(),
    characters: fixture.datasets.characters
  });
  const network = lenses.townOverrides.byBaseTownId.base;
  assert.deepEqual(network.activeLineage, ["base", "stage-a"]);
  assert.equal(network.transitionHistory.length, 3);
  const returnEdge = network.edges.find(
    (edge) => edge.sourceId === "stage-b" && edge.targetId === "stage-a"
  );
  assert.equal(returnEdge.traversalCount, 1);
  assert.equal(returnEdge.lastTraversal.commandId, "imprison-again");

  const origin = createSelectionOrigin(fixture.contract);
  const catalog = createSelectionCatalog({
    origin,
    towns: fixture.datasets.townFcsData,
    spawnAreas: [],
    mapLocations: fixture.datasets.mapData
  });
  const context = createContextProjection({
    catalog,
    selection: {
      kind: "entity",
      entityType: "town",
      entityId: "base",
      instanceId: "base-marker",
      source: "manifest",
      origin
    },
    snapshot: session.getSnapshot(),
    lenses,
    references: {}
  });
  assert.equal(context.title, "Base");
  assert.equal(context.town.currentTown.name, "Stage A");
  assert.deepEqual(context.town.currentTown.residents, []);
  assert.equal(context.town.primaryNetwork.transitionHistory.length, 3);
});

test("self references and same-cascade cycles stop without recording a repeated transition", () => {
  const state = worldState("alive", { "NPC is": [reference("alpha", 1)] });
  const selfBaseline = normalizedFixture({
    worldStates: [state],
    towns: [
      town("base", {
        overrides: ["base"],
        conditions: [{ id: "alive", value: 1 }]
      })
    ]
  });
  const selfSnapshot = new ScenarioSession(selfBaseline).getSnapshot();
  assert.equal(selfSnapshot.world.towns.base.activeTownId, "base");
  assert.deepEqual(selfSnapshot.world.towns.base.transitions, []);
  assert.ok(selfSnapshot.diagnostics.some((entry) => entry.code === "town_override_cycle"));

  const cyclicBaseline = normalizedFixture({
    worldStates: [state],
    towns: [
      town("base", { overrides: ["stage-a"] }),
      town("stage-a", {
        overrides: ["base"],
        conditions: [{ id: "alive", value: 1 }]
      })
    ]
  });
  const cyclic = new ScenarioSession(cyclicBaseline).getSnapshot().world.towns.base;
  assert.equal(cyclic.activeTownId, "stage-a");
  assert.deepEqual(cyclic.path, ["base", "stage-a"]);
  assert.equal(cyclic.transitions.length, 1);
});

test("the progression pass limit is deterministic and leaves the last completed node active", () => {
  const baseline = normalizedFixture({
    worldStates: [],
    towns: [
      town("base", { overrides: ["stage-a"] }),
      town("stage-a", { overrides: ["stage-b"] }),
      town("stage-b")
    ]
  });
  const result = initializeTownProgression(
    baseline,
    getTownProgressionIndex(baseline),
    {},
    { maxSteps: 1 }
  );

  assert.equal(result.progression.towns.base.activeTownId, "stage-a");
  assert.equal(result.transitions.length, 1);
  assert.ok(
    result.progression.diagnostics.some((entry) => entry.code === "town_override_pass_limit")
  );
  assert.throws(
    () =>
      initializeTownProgression(baseline, getTownProgressionIndex(baseline), {}, { maxSteps: 0 }),
    TypeError
  );
});

test("one command may cascade through several edges while remaining one Undo unit", () => {
  const baseline = normalizedFixture({
    worldStates: [worldState("imprisoned", { "NPC is": [reference("alpha", 2)] })],
    towns: [
      town("base", { overrides: ["stage-a"] }),
      town("stage-a", {
        overrides: ["stage-b"],
        conditions: [{ id: "imprisoned", value: 1 }]
      }),
      town("stage-b", { conditions: [{ id: "imprisoned", value: 1 }] })
    ]
  });
  const session = new ScenarioSession(baseline);
  session.dispatch(characterCommand("imprison", 2));

  assert.equal(session.getJournal().length, 1);
  assert.equal(session.getJournal()[0].townTransitions.length, 2);
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "stage-b");
  assert.equal(session.getTimeline().filter((entry) => entry.type === "town-transition").length, 2);
  session.undo();
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "base");
  assert.equal(session.canUndo(), false);
  session.redo();
  assert.equal(session.getSnapshot().world.towns.base.activeTownId, "stage-b");
});
