import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_TYPES,
  ScenarioSession,
  createScenarioCommand,
  normalizeScenarioBaseline,
  resolveCharacterAffiliations,
  serializeScenarioEnvelope
} from "../modules/scenario/index.js";
import { createPowerRankReportProjection } from "../modules/scenario/power-report.js";
import { createPowerRanksViewState } from "../modules/power-ranks.js";
import {
  createScenarioFixture,
  faction,
  reference,
  town,
  worldState
} from "./fixtures/scenario-fixture.js";

function character(StringId, ReferenceCategories = {}, Name = StringId) {
  return { StringId, Name, Values: {}, ReferenceCategories, Referrers: [] };
}

function squad(StringId, ReferenceCategories = {}, Name = StringId) {
  return { StringId, Name, Values: {}, ReferenceCategories, Referrers: [] };
}

function command(characterId, status, id) {
  return createScenarioCommand(
    COMMAND_TYPES.SET_CHARACTER_STATUS,
    { characterId, status, playerInvolved: true },
    { id, occurredAt: "2026-09-14T12:00:00.000Z" }
  );
}

function report(baseline, session) {
  return createPowerRankReportProjection(baseline, session.getSnapshot());
}

function createReportingFixture() {
  const characterIds = ["direct", "squad-member", "town-member", "ambiguous", "cyclic"];
  const baseTown = town("town-a", {
    Name: "A Hold",
    owner: "Faction A",
    ownerId: "faction-a",
    overrides: ["town-a-captured"]
  });
  baseTown.ReferenceCategories.residents = [reference("town-residents", 1)];

  return createScenarioFixture({
    factions: [
      faction("204-gamedata.base", "Nameless"),
      faction("faction-a", "Faction A"),
      faction("faction-b", "Faction B")
    ],
    characters: [
      character("direct", { faction: [reference("faction-a", 0)] }, "Direct Character"),
      character("squad-member", {}, "Squad Character"),
      character("town-member", {}, "Town Character"),
      character("ambiguous", {}, "Ambiguous Character"),
      character("cyclic", {}, "Cyclic Character")
    ],
    worldStates: [
      worldState("all-observed", {
        "NPC is": characterIds.map((id) => reference(id, 1, id))
      }),
      worldState("direct-dead", { "NPC is": [reference("direct", 0, "direct")] })
    ],
    towns: [
      baseTown,
      town("town-a-captured", {
        Name: "A Hold Captured",
        owner: "Faction B",
        ownerId: "faction-b",
        conditions: [{ id: "direct-dead", value: 1 }]
      }),
      town("town-b", { Name: "B Hold", owner: "Faction B", ownerId: "faction-b" })
    ],
    squads: [
      squad("spawn-a", { faction: [reference("faction-a", 0)] }, "Faction A Patrol"),
      squad("spawn-b", { faction: [reference("faction-b", 0)] }, "Faction B Patrol"),
      squad(
        "inactive-spawn",
        {
          faction: [reference("faction-a", 0)],
          "world state": [reference("direct-dead", 1)]
        },
        "Inactive Patrol"
      ),
      squad(
        "squad-affiliation",
        {
          faction: [reference("faction-a", 0)],
          leader: [reference("squad-member", 1)]
        },
        "Faction A Named Squad"
      ),
      squad("town-residents", { squad: [reference("town-member", 1)] }, "Town Residents"),
      squad("ambiguous-a", {
        faction: [reference("faction-a", 0)],
        squad: [reference("ambiguous", 1)]
      }),
      squad("ambiguous-b", {
        faction: [reference("faction-b", 0)],
        squad2: [reference("ambiguous", 1)]
      }),
      squad("cycle-a", {
        leader: [reference("cyclic", 1)],
        squad: [reference("cycle-b", 1)]
      }),
      squad("cycle-b", { squad2: [reference("cycle-a", 1)] })
    ],
    spawnAreas: [
      {
        StringId: "area-one",
        Name: "Area One",
        Values: {},
        ReferenceCategories: {
          "homeless spawns": [reference("spawn-a", 1), reference("spawn-a", 1)]
        },
        Referrers: []
      },
      {
        StringId: "area-two",
        Name: "Area Two",
        Values: {},
        ReferenceCategories: {
          "homeless spawns": [reference("spawn-a", 1), reference("inactive-spawn", 1)]
        },
        Referrers: []
      },
      {
        StringId: "area-three",
        Name: "Area Three",
        Values: {},
        ReferenceCategories: { "homeless spawns": [reference("spawn-b", 1)] },
        Referrers: []
      }
    ],
    mapData: [
      { Name: "A Hold marker", InstanceId: "marker-a", TargetId: "town-a" },
      { Name: "B Hold marker", InstanceId: "marker-b", TargetId: "town-b" }
    ]
  });
}

test("power reports preserve territorial ranking while counting exact current spawn evidence", () => {
  const baseline = normalizeScenarioBaseline(createReportingFixture());
  const session = new ScenarioSession(baseline);
  const projection = report(baseline, session);

  assert.deepEqual(
    projection.entries.map((entry) => entry.id),
    session.getSnapshot().powerStatistics.map((entry) => entry.id)
  );
  assert.deepEqual(
    projection.entries.map((entry) => entry.townsOwned),
    session.getSnapshot().powerStatistics.map((entry) => entry.townsOwned)
  );

  const factionA = projection.entries.find((entry) => entry.id === "faction-a");
  assert.deepEqual(
    factionA.spawnPresence.areas.map((entry) => entry.id),
    ["area-one", "area-two"]
  );
  assert.deepEqual(
    factionA.spawnPresence.squads.map((entry) => entry.id),
    ["spawn-a"]
  );
  assert.equal(factionA.spawnPresence.areaCount, 2);
  assert.equal(factionA.spawnPresence.squadCount, 1);
  assert.ok(!factionA.spawnPresence.squads.some((entry) => entry.id === "inactive-spawn"));
  assert.throws(() => projection.entries.push({}), TypeError);
});

test("unused geographic areas retain scenario evidence without adding reported spawn presence", () => {
  const fixture = createReportingFixture();
  fixture.datasets.spawnAreas[0].StringId = "51405-Newwworld.mod";
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  const before = session.getSnapshot();
  const factionA = report(baseline, session).entries.find((entry) => entry.id === "faction-a");

  assert.equal(factionA.spawnPresence.areaCount, 1);
  assert.deepEqual(
    factionA.spawnPresence.areas.map((entry) => entry.id),
    ["area-two"]
  );
  assert.ok(baseline.spawnAreas.some((area) => area.id === "51405-Newwworld.mod"));
  assert.ok(before.world.spawns["51405-Newwworld.mod"]);
  assert.equal(session.getSnapshot(), before);
});

test("character affiliation follows exact character, squad, then baseline-town evidence", () => {
  const baseline = normalizeScenarioBaseline(createReportingFixture());
  const session = new ScenarioSession(baseline);
  const projection = report(baseline, session);
  const affiliations = resolveCharacterAffiliations({
    baseline,
    baselineWorld: session.getSnapshot().baselineWorld,
    characters: baseline.characters
  });
  const factionA = projection.entries.find((entry) => entry.id === "faction-a");
  const characters = Object.fromEntries(
    factionA.worldStateCharacters.entries.map((entry) => [entry.id, entry])
  );

  assert.equal(characters.direct.affiliationSource, "character");
  assert.equal(characters["squad-member"].affiliationSource, "squad");
  assert.equal(characters["town-member"].affiliationSource, "town");
  assert.equal(affiliations.byCharacterId.direct.source, "character");
  assert.equal(affiliations.byCharacterId["squad-member"].source, "squad");
  assert.equal(affiliations.byCharacterId["town-member"].source, "town");
  assert.throws(() => (affiliations.byCharacterId.direct.source = "mutated"), TypeError);
  assert.equal(factionA.worldStateCharacters.aliveCount, 3);
  assert.equal(factionA.worldStateCharacters.totalCount, 3);
  assert.ok(
    projection.diagnostics.some(
      (entry) => entry.entityId === "ambiguous" && /more than one faction/u.test(entry.reason)
    )
  );
  assert.ok(
    projection.diagnostics.some(
      (entry) => entry.entityId === "cyclic" && /cycle/u.test(entry.reason)
    )
  );
});

test("status and town reports retain baseline affiliation through progression, Undo, Redo, and replacement", () => {
  const baseline = normalizeScenarioBaseline(createReportingFixture());
  const session = new ScenarioSession(baseline);
  session.dispatch(command("squad-member", 2, "imprison-squad-member"));
  session.dispatch(command("direct", 0, "kill-direct"));

  const changed = report(baseline, session);
  const factionA = changed.entries.find((entry) => entry.id === "faction-a");
  const factionB = changed.entries.find((entry) => entry.id === "faction-b");
  assert.deepEqual(
    factionA.worldStateCharacters.entries.map((entry) => [entry.id, entry.statusLabel]),
    [
      ["direct", "Dead"],
      ["squad-member", "Imprisoned"],
      ["town-member", "Alive"]
    ]
  );
  assert.equal(factionA.worldStateCharacters.aliveCount, 1);
  assert.deepEqual(
    factionA.spawnPresence.squads.map((entry) => entry.id),
    ["spawn-a", "inactive-spawn"]
  );
  assert.deepEqual(factionA.townControl.current, []);
  assert.deepEqual(
    factionA.townControl.lost.map((entry) => entry.baseTownId),
    ["town-a"]
  );
  assert.deepEqual(
    factionB.townControl.gained.map((entry) => entry.baseTownId),
    ["town-a"]
  );
  assert.deepEqual(
    changed.entries.map((entry) => entry.id),
    session.getSnapshot().powerStatistics.map((entry) => entry.id)
  );

  session.undo();
  const undone = report(baseline, session);
  assert.equal(undone.entries.find((entry) => entry.id === "faction-a").townControl.lost.length, 0);
  session.redo();
  assert.deepEqual(report(baseline, session), changed);

  const replacement = new ScenarioSession(baseline);
  replacement.replaceDocument(serializeScenarioEnvelope(session));
  assert.deepEqual(report(baseline, replacement), changed);
});

test("Power Ranks disclosure and focused-faction state retain exact IDs independently", () => {
  const state = createPowerRanksViewState();
  assert.deepEqual(state.getOpenIds(), []);
  assert.equal(state.getFocusedId(), null);
  state.setOpen("faction-b", true);
  state.setOpen("faction-a", true);
  state.setFocusedId("faction-b");
  assert.equal(state.isOpen("faction-a"), true);
  assert.equal(state.isOpen("faction-b"), true);
  assert.equal(state.getFocusedId(), "faction-b");
  assert.deepEqual(state.getOpenIds(), ["faction-a", "faction-b"]);
  state.setOpen("faction-a", false);
  assert.deepEqual(state.getOpenIds(), ["faction-b"]);
  assert.equal(state.getFocusedId(), "faction-b");
});
