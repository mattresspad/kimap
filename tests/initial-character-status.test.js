import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_TYPES,
  ScenarioSession,
  createScenarioLensProjection,
  deriveInitialCharacterStatuses,
  normalizeScenarioBaseline,
  replayScenario,
  serializeScenarioEnvelope
} from "../modules/scenario/index.js";
import { createScenarioFixture, reference, town, worldState } from "./fixtures/scenario-fixture.js";

const OCCURRED_AT = "2026-08-30T22:00:00.000Z";

function character(id, name = id) {
  return { Name: name, StringId: id, Values: {}, ReferenceCategories: {}, Referrers: [] };
}

function squadTemplate(
  id,
  { name = id, leader = [], squad = [], squad2 = [], prisoners = [], conditions = [] } = {}
) {
  return {
    Name: name,
    StringId: id,
    Values: {},
    ReferenceCategories: {
      ...(leader.length > 0 ? { leader } : {}),
      ...(squad.length > 0 ? { squad } : {}),
      ...(squad2.length > 0 ? { squad2 } : {}),
      ...(prisoners.length > 0 ? { prisoners } : {}),
      ...(conditions.length > 0 ? { "world state": conditions } : {})
    },
    Referrers: []
  };
}

function townWithResidents(id, residents, options = {}) {
  const rawTown = town(id, options);
  rawTown.ReferenceCategories.residents = residents;
  return rawTown;
}

function placementFixture() {
  const yabuta = "yabuta";
  const agnu = "agnu";
  const towns = [
    town("fort", { Name: "Fort Simion", overrides: ["fort-yabuta"] }),
    town("fort-yabuta", {
      Name: "Fort Yabuta",
      conditions: [{ id: "yabuta-alive", value: 1 }]
    }),
    townWithResidents("vault", [reference("vault-residents", 1)], {
      Name: "Tengu's Vault"
    }),
    townWithResidents("tower", [reference("tower-residents", 1)], {
      Name: "Tower of Abuse"
    })
  ];
  const squads = [
    squadTemplate("vault-residents", {
      prisoners: [reference("vault-prisoners", 0)]
    }),
    squadTemplate("vault-prisoners", {
      squad: [reference(yabuta, 1, "Yabuta of the Sands")]
    }),
    squadTemplate("tower-residents", {
      prisoners: [reference("agnu-prisoners", 0)]
    }),
    squadTemplate("agnu-prisoners", {
      leader: [reference(agnu, 1, "Agnu")]
    })
  ];
  const mapData = [
    { Name: "Fort Simion", InstanceId: "fort-marker", TargetId: "fort" },
    { Name: "Tengu's Vault", InstanceId: "vault-marker", TargetId: "vault" },
    { Name: "Tower of Abuse", InstanceId: "tower-marker", TargetId: "tower" }
  ];
  const worldStates = [
    worldState("yabuta-alive", {
      "NPC is": [reference(yabuta, 1, "Yabuta of the Sands")]
    }),
    worldState("agnu-dead", { "NPC is": [reference(agnu, 0, "Agnu")] })
  ];
  return createScenarioFixture({
    worldStates,
    characters: [character(yabuta, "Yabuta of the Sands"), character(agnu, "Agnu")],
    towns,
    squads,
    spawnAreas: [],
    mapData
  });
}

function statusCommand(id, characterId, status, playerInvolved = true) {
  return {
    id,
    type: COMMAND_TYPES.SET_CHARACTER_STATUS,
    occurredAt: OCCURRED_AT,
    payload: { characterId, status, playerInvolved }
  };
}

function relationCommand(id, value, playerInvolved = false) {
  return {
    id,
    type: COMMAND_TYPES.SET_FACTION_RELATION,
    occurredAt: OCCURRED_AT,
    payload: { factionId: "faction-a", value, playerInvolved }
  };
}

test("base-town prisoner placement initializes Yabuta and Agnu as imprisoned", () => {
  const fixture = placementFixture();
  const derived = deriveInitialCharacterStatuses({
    towns: fixture.datasets.townFcsData,
    squads: fixture.datasets.squads,
    mapLocations: fixture.datasets.mapData,
    characters: fixture.datasets.characters,
    observedCharacterIds: ["yabuta", "agnu"]
  });

  assert.deepEqual(derived.statusByCharacterId, { agnu: 2, yabuta: 2 });
  assert.equal(derived.placementEvidenceByCharacterId.yabuta[0].memberCategory, "squad");
  assert.equal(derived.placementEvidenceByCharacterId.agnu[0].memberCategory, "leader");
  assert.equal(Object.isFrozen(derived.placementEvidenceByCharacterId.yabuta), true);

  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  const snapshot = session.getSnapshot();
  assert.equal(baseline.characterById.yabuta.initialStatus, 2);
  assert.equal(baseline.characterById.agnu.initialStatus, 2);
  assert.equal(baseline.characterById.yabuta.initialStatusEvidence[0].townId, "vault");
  assert.equal(snapshot.characters.yabuta, 2);
  assert.equal(snapshot.characters.agnu, 2);
  assert.equal(snapshot.characterProvenance.yabuta, false);
  assert.equal(snapshot.worldStates["yabuta-alive"], 0);
  assert.equal(snapshot.worldStates["agnu-dead"], 0);
  assert.equal(snapshot.world.towns.fort.activeTownId, "fort");
  assert.deepEqual(session.getTimeline(), []);

  const lenses = createScenarioLensProjection({
    baseline,
    snapshot,
    journal: session.getJournal(),
    timeline: session.getTimeline()
  });
  assert.equal(
    lenses.globalStatus.characters.find((entry) => entry.id === "yabuta").statusLabel,
    "Imprisoned"
  );
});

test("releasing Yabuta advances Fort Simion while counter-state commands cannot infer a return", () => {
  const baseline = normalizeScenarioBaseline(placementFixture());
  const session = new ScenarioSession(baseline);

  session.dispatch(statusCommand("release", "yabuta", 1));
  assert.equal(session.getSnapshot().world.towns.fort.activeTownId, "fort-yabuta");
  assert.equal(session.getJournal()[0].townTransitions.length, 1);
  session.dispatch(statusCommand("imprison-again", "yabuta", 2));
  assert.equal(session.getSnapshot().world.towns.fort.activeTownId, "fort-yabuta");
  assert.equal(session.getJournal()[1].townTransitions.length, 0);
  session.undo();
  assert.equal(session.getSnapshot().world.towns.fort.activeTownId, "fort-yabuta");
  session.undo();
  assert.equal(session.getSnapshot().world.towns.fort.activeTownId, "fort");
  session.redo();
  assert.equal(session.getSnapshot().world.towns.fort.activeTownId, "fort-yabuta");

  const death = new ScenarioSession(baseline);
  death.dispatch(statusCommand("death", "yabuta", 0));
  assert.equal(death.getSnapshot().world.towns.fort.activeTownId, "fort");
});

test("base-town scope supports nested and duplicate prisoner evidence but excludes override towns", () => {
  const towns = [
    townWithResidents("base-a", [reference("host-a", 1)]),
    townWithResidents("base-b", [reference("host-b", 1)]),
    townWithResidents("inactive-override", [reference("override-host", 1)])
  ];
  const squads = [
    squadTemplate("host-a", { prisoners: [reference("nested-a", 0)] }),
    squadTemplate("nested-a", { prisoners: [reference("prisoners", 0)] }),
    squadTemplate("host-b", { prisoners: [reference("prisoners", 0)] }),
    squadTemplate("prisoners", { squad2: [reference("alpha", 1)] }),
    squadTemplate("override-host", { prisoners: [reference("override-prisoners", 0)] }),
    squadTemplate("override-prisoners", { leader: [reference("bravo", 1)] })
  ];
  const result = deriveInitialCharacterStatuses({
    towns,
    squads,
    mapLocations: [
      { InstanceId: "a", TargetId: "base-a" },
      { InstanceId: "b", TargetId: "base-b" }
    ],
    characters: [character("alpha"), character("bravo")],
    observedCharacterIds: ["alpha", "bravo"]
  });

  assert.equal(result.statusByCharacterId.alpha, 2);
  assert.equal(result.statusByCharacterId.bravo, 1);
  assert.equal(result.placementEvidenceByCharacterId.alpha.length, 2);
  assert.deepEqual(result.placementEvidenceByCharacterId.alpha[0].prisonerSquadIds, [
    "nested-a",
    "prisoners"
  ]);
});

test("missing and cyclic prisoner references stop scenario normalization explicitly", () => {
  const common = {
    towns: [townWithResidents("base", [reference("host", 1)])],
    mapLocations: [{ InstanceId: "base-marker", TargetId: "base" }],
    characters: [character("alpha")],
    observedCharacterIds: ["alpha"]
  };

  assert.throws(
    () => deriveInitialCharacterStatuses({ ...common, squads: [] }),
    (error) => error.code === "missing_scenario_identity"
  );
  assert.throws(
    () =>
      deriveInitialCharacterStatuses({
        ...common,
        squads: [squadTemplate("host", { prisoners: [reference("missing", 0)] })]
      }),
    (error) => error.code === "missing_scenario_identity"
  );
  assert.throws(
    () =>
      deriveInitialCharacterStatuses({
        ...common,
        squads: [
          squadTemplate("host", { prisoners: [reference("one", 0)] }),
          squadTemplate("one", { prisoners: [reference("two", 0)] }),
          squadTemplate("two", { prisoners: [reference("one", 0)] })
        ]
      }),
    (error) => error.code === "initial_prisoner_graph_cycle"
  );
});

test("optional, conditional, and unsupported prisoner membership is indeterminate", () => {
  const common = {
    towns: [townWithResidents("base", [reference("host", 1)])],
    mapLocations: [{ InstanceId: "base-marker", TargetId: "base" }],
    characters: [character("alpha")],
    observedCharacterIds: ["alpha"]
  };
  const expectIndeterminate = (squads) =>
    assert.throws(
      () => deriveInitialCharacterStatuses({ ...common, squads }),
      (error) => error.code === "indeterminate_initial_character_status"
    );

  expectIndeterminate([
    squadTemplate("host", { prisoners: [reference("prisoners", 0)] }),
    squadTemplate("prisoners", { squad: [reference("alpha", 0)] })
  ]);
  expectIndeterminate([
    squadTemplate("host", {
      prisoners: [reference("prisoners", 0)],
      conditions: [reference("state", 1)]
    }),
    squadTemplate("prisoners", { leader: [reference("alpha", 1)] })
  ]);
  const unsupported = squadTemplate("prisoners");
  unsupported.ReferenceCategories["choosefrom list"] = [reference("alpha", 1)];
  expectIndeterminate([
    squadTemplate("host", { prisoners: [reference("prisoners", 0)] }),
    unsupported
  ]);
  expectIndeterminate([squadTemplate("host", { prisoners: [reference("alpha", 0)] })]);
});

test("conflicting guaranteed prisoner and ordinary resident placement disables simulation", () => {
  assert.throws(
    () =>
      deriveInitialCharacterStatuses({
        towns: [townWithResidents("base", [reference("host", 1)])],
        squads: [
          squadTemplate("host", {
            leader: [reference("alpha", 1)],
            prisoners: [reference("prisoners", 0)]
          }),
          squadTemplate("prisoners", { squad: [reference("alpha", 1)] })
        ],
        mapLocations: [{ InstanceId: "base-marker", TargetId: "base" }],
        characters: [character("alpha")],
        observedCharacterIds: ["alpha"]
      }),
    (error) =>
      error.code === "ambiguous_initial_character_status" &&
      error.context.prisonerPlacements.length === 1 &&
      error.context.ordinaryPlacements.length === 1
  );
});

test("retained exact no-op commands replay without weakening live dispatch validation", () => {
  const baseline = normalizeScenarioBaseline(placementFixture());
  const retainedStatus = statusCommand("retained-status", "yabuta", 2, false);
  const retainedRelation = relationCommand("retained-relation", 0, false);
  const replayed = replayScenario(baseline, [retainedStatus, retainedRelation]);

  assert.equal(replayed.commands.length, 2);
  assert.ok(replayed.journal.every((entry) => entry.noOp === true));
  assert.ok(replayed.journal.every((entry) => entry.consequences.length === 0));
  assert.ok(replayed.journal.every((entry) => entry.townTransitions.length === 0));
  assert.match(replayed.journal[0].summary, /Retained command made no change/u);
  assert.equal(replayed.snapshot.world.towns.fort.activeTownId, "fort");

  const envelope = serializeScenarioEnvelope(baseline, [retainedStatus, retainedRelation], {
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  });
  assert.equal(envelope.schemaVersion, 1);
  assert.deepEqual(Object.keys(envelope).sort(), [
    "baseline",
    "commands",
    "createdAt",
    "documentType",
    "schemaVersion",
    "updatedAt"
  ]);
  const session = new ScenarioSession(baseline, envelope);
  assert.equal(session.canUndo(), true);
  session.undo();
  session.undo();
  assert.equal(session.canUndo(), false);
  session.redo();
  session.redo();
  assert.ok(session.getJournal().every((entry) => entry.noOp === true));

  const replacement = new ScenarioSession(baseline);
  replacement.replaceDocument(envelope);
  assert.equal(replacement.getSnapshot().commandCount, 2);
  assert.ok(replacement.getJournal().every((entry) => entry.noOp === true));
  assert.throws(
    () => session.dispatch(statusCommand("live-noop", "yabuta", 2, false)),
    (error) => error.code === "scenario_no_change"
  );

  const provenanceChange = new ScenarioSession(baseline);
  provenanceChange.dispatch(statusCommand("provenance", "yabuta", 2, true));
  assert.equal(provenanceChange.getJournal()[0].noOp, false);
  assert.equal(provenanceChange.getSnapshot().characterProvenance.yabuta, true);
});
