import assert from "node:assert/strict";
import test from "node:test";
import { createPresenceFixture } from "./fixtures/presence-fixture.js";
import { reference } from "./fixtures/scenario-fixture.js";
import { createDiscoveryCatalog } from "../modules/discovery/catalog.js";
import { createPresenceProjection, isPresenceTownType } from "../modules/discovery/presence.js";
import { createPresenceReports } from "../modules/viewport/presence-reporting.js";
import { createReportingInputTracker } from "../modules/viewport/reporting-policy.js";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";
import {
  normalizeScenarioBaseline,
  createScenarioLensProjection,
  COMMAND_TYPES,
  createScenarioCommand
} from "../modules/scenario/index.js";
import { ScenarioSession, serializeScenarioEnvelope } from "../stores/scenario-session.js";

function setup(fixture = createPresenceFixture()) {
  const baseline = normalizeScenarioBaseline(fixture);
  const scenario = new ScenarioSession(baseline);
  const catalog = createDiscoveryCatalog({ datasets: fixture.datasets, baseline });
  const project = () => {
    const snapshot = scenario.getSnapshot();
    const lenses = createScenarioLensProjection({
      baseline,
      snapshot,
      journal: scenario.getJournal(),
      timeline: scenario.getTimeline()
    });
    return createPresenceProjection({ catalog, snapshot, lenses });
  };
  return { fixture, baseline, scenario, catalog, project };
}

test("current presence preserves roles, zero templates, repeats and exact occurrences", () => {
  const { project } = setup();
  const p = project();
  const town = p.occurrences["marker-one"].report;
  assert.equal(p.occurrences["marker-two"].report, town);
  assert.equal(town.entryCount, 5);
  assert.equal(town.groups[0].rows.find((row) => row.id === "resident").occurrences.length, 2);
  assert.equal(town.groups[0].rows.find((row) => row.id === "template").template, true);
  assert.equal(town.groups[0].rows.find((row) => row.id === "template").occurrences[0].value0, 0);
  assert.equal(town.groups[1].rows[0].id, "bar");
  assert.equal(town.groups[2].rows[0].id, "roaming");
  assert.equal(
    town.groups[1].rows[0].name,
    town.groups[0].rows.find((row) => row.id === "resident").name
  );
  assert.deepEqual(
    town.factions.map((row) => row.classification),
    ["enemy", "ally", "neutral"]
  );
  assert.ok(town.factions[0].sources.some((source) => source.path.includes("housemates")));
  assert.ok(
    town.factions[0].sources.some((source) =>
      source.references?.some(
        (edge) =>
          edge.sourceKey === "squad:resident" &&
          edge.targetKey === "squad:nested" &&
          edge.position === 0
      )
    )
  );
  assert.ok(town.diagnostics.some((note) => note.includes("cycle")));
  assert.ok(
    town.groups[0].rows
      .find((row) => row.id === "resident")
      .populationPaths.some((path) => path.stopped === "cycle" && path.id === "resident")
  );
  assert.equal(p.occurrences["empty-marker"].report.entryCount, 0);
  assert.equal(p.occurrences["nest-marker"], undefined);
  assert.equal(isPresenceTownType(0), false);
  assert.equal(isPresenceTownType(8), false);
  assert.equal(isPresenceTownType(4), true);
  assert.throws(() => town.groups[0].rows.push({}), TypeError);
});

test("area presence excludes conditional entries and never substitutes owner for missing factions", () => {
  const { project } = setup();
  const area = project().areas["area-one"];
  assert.equal(
    area.groups[0].rows.some((row) => row.id === "squad-one"),
    false
  );
  assert.equal(area.groups[0].rows.find((row) => row.id === "bar").occurrences.length, 2);
  assert.deepEqual(
    area.groups[0].rows.find((row) => row.id === "bar").occurrences.map((row) => row.value0),
    [0, 1]
  );
  assert.deepEqual(area.groups[0].rows.find((row) => row.id === "unattributed").factions, []);
  assert.equal(
    area.groups[0].rows.find((row) => row.id === "unattributed").populationPaths[0].attribution
      .state,
    "none"
  );
  assert.deepEqual(area.groups[0].rows.find((row) => row.id === "ambiguous").factions, []);
  assert.ok(area.diagnostics.length);
  assert.equal(area.groups[1].rows[0].id, "nest-one");
  assert.equal(area.owner, null);
  assert.ok(!area.factions.some((row) => row.id === "faction-a"));
});

test("scenario progression composes replacement categories and updates area status through undo/redo", () => {
  const { project, scenario } = setup();
  const original = project();
  scenario.dispatch(
    createScenarioCommand(COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "alpha",
      status: 0,
      playerInvolved: true
    })
  );
  const changed = project();
  assert.equal(changed.occurrences["marker-one"].activeTownId, "town-dead");
  assert.equal(changed.towns["town-base"].owner.id, "faction-a");
  assert.deepEqual(
    changed.towns["town-base"].groups[0].rows.map((row) => row.id),
    ["template"]
  );
  assert.equal(changed.towns["town-base"].groups[1].rows[0].id, "bar");
  assert.equal(
    changed.areas["area-one"].groups[0].rows.find((row) => row.id === "squad-one").occurrences
      .length,
    2
  );
  scenario.undo();
  assert.deepEqual(project(), original);
  scenario.redo();
  assert.deepEqual(project(), changed);
  const envelope = serializeScenarioEnvelope(scenario);
  const replacement = setup();
  replacement.scenario.replaceDocument(envelope);
  assert.deepEqual(replacement.project(), changed);
  replacement.scenario.replaceDocument(
    serializeScenarioEnvelope(new ScenarioSession(replacement.baseline))
  );
  assert.deepEqual(replacement.project(), original);
});

test("current-only coverage follows authoritative statuses and excludes member inventories", () => {
  const fixture = createPresenceFixture();
  const data = fixture.datasets;
  for (const [id, conditions] of [
    ["alive-only", [reference("state-alive", 1)]],
    ["two-unmet", [reference("state-dead", 1), reference("state-not-alive", 1)]]
  ]) {
    data.squads.push({
      StringId: id,
      Name: id,
      Values: {},
      ReferenceCategories: {
        faction: [reference("enemy", 0)],
        "world state": conditions,
        squad: [reference("alpha", 1)]
      }
    });
    data.spawnAreas[0].ReferenceCategories["homeless spawns"].push(reference(id, 1));
  }
  data.characters[0].ReferenceCategories.faction = [reference("faction-a", 0)];
  data.spawnAreas.push({
    StringId: "51405-Newwworld.mod",
    Name: "Rim Sands",
    ReferenceCategories: {}
  });
  const { scenario, project } = setup(fixture);
  const before = project();
  assert.equal(before.areas["51405-Newwworld.mod"], undefined);
  assert.ok(before.areas["area-one"].groups[0].rows.some((row) => row.id === "alive-only"));
  assert.ok(!before.areas["area-one"].groups[0].rows.some((row) => row.id === "two-unmet"));
  assert.ok(!before.areas["area-one"].factions.some((row) => row.id === "faction-a"));
  scenario.dispatch(
    createScenarioCommand(COMMAND_TYPES.SET_CHARACTER_STATUS, {
      characterId: "alpha",
      status: 0,
      playerInvolved: true
    })
  );
  const after = project();
  assert.equal(
    Object.values(scenario.getSnapshot().world.spawns["area-one"].entries).find(
      (row) => row.entityId === "alive-only"
    ).status,
    "Eliminated"
  );
  assert.ok(!after.areas["area-one"].groups[0].rows.some((row) => row.id === "alive-only"));
  assert.ok(after.areas["area-one"].groups[0].rows.some((row) => row.id === "two-unmet"));
  assert.deepEqual(
    after.areas["area-two"].groups.flatMap((group) => group.rows),
    []
  );
});

test("relation changes use the existing faction thresholds and retain source roles", () => {
  const { scenario, project } = setup();
  scenario.dispatch(
    createScenarioCommand(COMMAND_TYPES.SET_FACTION_RELATION, {
      factionId: "enemy",
      value: -29,
      playerInvolved: true
    })
  );
  const neutral = project().towns["town-base"].factions.find((row) => row.id === "enemy");
  assert.equal(neutral.classification, "neutral");
  assert.ok(neutral.sources.some((source) => source.role === "Residents"));
  assert.ok(neutral.sources.some((source) => source.role === "Roaming squads"));
  scenario.undo();
  assert.equal(
    project().towns["town-base"].factions.find((row) => row.id === "enemy").classification,
    "enemy"
  );
  scenario.redo();
  assert.equal(project().towns["town-base"].factions.find((row) => row.id === "enemy").value, -29);
});

test("duplicate names remain exact identities and deep nested paths stop with diagnostics", () => {
  const fixture = createPresenceFixture();
  const data = fixture.datasets;
  data.townFcsData[0].ReferenceCategories.residents.push(reference("bar", 1));
  for (let i = 0; i < 70; i++)
    data.squads.push({
      StringId: `chain-${i}`,
      Name: `Chain ${i}`,
      ReferenceCategories: {
        faction: [reference("neutral", 0)],
        ...(i < 69 ? { prisoners: [reference(`chain-${i + 1}`, 0)] } : {})
      }
    });
  data.spawnAreas[0].ReferenceCategories["homeless spawns"].push(reference("chain-0", 0));
  const { project } = setup(fixture);
  const p = project();
  assert.deepEqual(
    p.towns["town-base"].groups[0].rows
      .filter((row) => row.name === "Same name")
      .map((row) => row.id),
    ["bar", "resident"]
  );
  const chain = p.areas["area-one"].groups[0].rows.find((row) => row.id === "chain-0");
  assert.ok(chain.populationPaths.length < 70);
  assert.ok(chain.populationPaths.some((path) => path.stopped === "limit"));
  assert.ok(p.areas["area-one"].diagnostics.some((note) => note.includes("reporting limit")));
  assert.equal(chain.factions[0].id, "neutral");
});

test("point reports are cached per shared geometry; town availability is independent of raster", () => {
  const { project } = setup();
  const projection = project();
  const withoutRaster = createPresenceReports({ projection });
  assert.equal(withoutRaster.getState({ kind: "town" }).available, true);
  assert.equal(withoutRaster.getState().available, false);
  assert.equal(
    withoutRaster.getReportForTown({ entityId: "other", instanceId: "marker-one" }),
    null
  );
  const geometry = { key: "shared", areaIds: ["area-one", "area-two"], areaNames: ["One", "Two"] };
  const reports = createPresenceReports({
    projection,
    areaIndex: {
      available: true,
      geometries: [geometry],
      getGeometryAtKenshi: (point) => (point.x === 0 ? null : geometry)
    }
  });
  const reading = reports.getReportAtPoint({ x: 1 });
  assert.equal(reading, reports.getReportAtPoint({ x: 2 }));
  assert.equal(reading.ambiguous, true);
  assert.deepEqual(
    reading.areas.map((area) => area.id),
    ["area-one", "area-two"]
  );
  assert.match(reports.getReportAtPoint({ x: 0 }).reason, /No authored area/u);
  assert.equal(createPresenceProjection({}).available, false);
});

test("new report settings distinguish hidden from collapsed and reset without changing defaults", () => {
  const session = new ViewportCompositionSession();
  assert.equal(session.getSnapshot().tooltipSubject, "political");
  assert.equal(session.setRelationsReportFilter("tooltips", "alliesEnemies"), false);
  assert.equal(session.setRelationsProbeMode("expanded"), false);
  session.setReportingSubject("tooltips", "relations");
  session.setReportingSubject("pointProbe", "squadPresence");
  session.setRelationsReportFilter("tooltips", "includeNeutrals");
  session.setRelationsProbeMode("collapsed");
  session.setRelationsProbeMode("hidden");
  assert.equal(session.getSnapshot().relationsProbeExpanded, false);
  assert.equal(session.getSnapshot().relationsProbeHidden, true);
  assert.equal(session.getSnapshot().relationsProbeFilter, "alliesEnemies");
  session.enterFocusMap();
  session.exitFocusMap();
  assert.equal(session.getSnapshot().relationsProbeHidden, true);
  session.setRelationsProbeMode("expanded");
  assert.equal(session.getSnapshot().relationsProbeHidden, false);
  session.reset();
  assert.equal(session.getSnapshot().relationsTooltipFilter, "alliesEnemies");
  assert.equal(session.getSnapshot().tooltipSubject, "political");
  assert.equal(session.getSnapshot().squadPresenceTooltipMode, "reduced");
  assert.throws(() => session.setRelationsReportFilter("tooltips", "unknown"));
});

test("touch provenance survives compatibility mouse events but a real pointing device restores reporting", () => {
  const input = createReportingInputTracker();
  input.observe({ pointerType: "touch" });
  assert.equal(input.kind({ type: "click" }), "touch");
  input.observe({ pointerType: "mouse" });
  assert.equal(input.kind({ type: "click" }), "mouse");
  assert.equal(input.kind({ sourceCapabilities: { firesTouchEvents: true } }), "touch");
  input.observe({ pointerType: "pen" });
  assert.equal(input.kind({}), "pen");
});
