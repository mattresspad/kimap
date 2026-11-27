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
import {
  SelectionError,
  SelectionSession,
  createContextProjection,
  createGeographicActions,
  createSelectionCatalog,
  createSelectionOrigin,
  parseMapView,
  serializeMapView
} from "../modules/selection/index.js";
import { createScenarioFixture } from "./fixtures/scenario-fixture.js";

function setup(fixture = createScenarioFixture()) {
  const origin = createSelectionOrigin(fixture.contract);
  const catalog = createSelectionCatalog({
    origin,
    towns: fixture.datasets.townFcsData,
    spawnAreas: fixture.datasets.spawnAreas,
    mapLocations: fixture.datasets.mapData
  });
  const baseline = normalizeScenarioBaseline(fixture);
  const scenario = new ScenarioSession(baseline);
  const selection = new SelectionSession(catalog);
  const references = {
    townById: Object.fromEntries(
      fixture.datasets.townFcsData.map((entry) => [entry.StringId, entry])
    ),
    squadById: Object.fromEntries(fixture.datasets.squads.map((entry) => [entry.StringId, entry])),
    resourceById: {},
    seasonById: {},
    weatherById: {},
    effectById: {}
  };
  const lenses = () =>
    createScenarioLensProjection({
      baseline,
      snapshot: scenario.getSnapshot(),
      journal: scenario.getJournal(),
      timeline: scenario.getTimeline(),
      characters: fixture.datasets.characters
    });
  return { fixture, origin, catalog, baseline, scenario, selection, references, lenses };
}

function townSelection(origin, overrides = {}) {
  return {
    kind: "entity",
    entityType: "town",
    entityId: "town-base",
    instanceId: null,
    source: "manifest",
    origin,
    ...overrides
  };
}

test("selection normalization preserves exact occurrences and chooses stable defaults", () => {
  const fixture = createScenarioFixture({
    mapData: [
      { Name: "Second", InstanceId: "marker-z", TargetId: "town-base", X: 200, Z: 300 },
      { Name: "First", InstanceId: "marker-a", TargetId: "town-base", X: 100, Z: 150 }
    ]
  });
  const origin = createSelectionOrigin(fixture.contract);
  const catalog = createSelectionCatalog({
    origin,
    towns: fixture.datasets.townFcsData,
    spawnAreas: fixture.datasets.spawnAreas,
    mapLocations: fixture.datasets.mapData
  });
  const session = new SelectionSession(catalog);

  session.select(townSelection(origin));
  assert.equal(session.getSelection().instanceId, "marker-a");
  assert.throws(
    () => session.select(townSelection(origin, { instanceId: "marker-z", entityId: "town-dead" })),
    (error) => error instanceof SelectionError && error.code === "selection_instance_mismatch"
  );
  assert.equal(session.getSelection().instanceId, "marker-a");
  session.select(townSelection(origin, { instanceId: "marker-z", source: "map" }));
  assert.equal(session.getSelection().instanceId, "marker-z");
  assert.throws(() => (session.getSelection().origin.manifestId = "changed"), TypeError);
});

test("override-only towns and map points are canonical while rejected changes stay atomic", () => {
  const { origin, selection } = setup();
  let notifications = 0;
  selection.subscribe(() => (notifications += 1));
  selection.select(townSelection(origin, { entityId: "town-dead", source: "override" }));
  assert.equal(selection.getSelection().entityId, "town-dead");
  assert.equal(selection.getSelection().instanceId, null);
  assert.equal(notifications, 1);

  assert.throws(
    () =>
      selection.select({
        kind: "point",
        point: { x: Number.NaN, z: 0 },
        source: "map",
        origin
      }),
    (error) => error.code === "invalid_selection_point"
  );
  assert.equal(selection.getSelection().entityId, "town-dead");
  assert.equal(notifications, 1);
  assert.equal(selection.select(selection.getSelection()), false);
  assert.equal(selection.clear().type, "clear");
  assert.equal(selection.clear(), false);
  assert.equal(notifications, 2);
});

test("town context follows scenario changes without replacing canonical selection", () => {
  const { origin, catalog, scenario, selection, references, lenses } = setup();
  selection.select(townSelection(origin));
  const beforeSelection = selection.getSelection();
  const before = createContextProjection({
    catalog,
    selection: beforeSelection,
    snapshot: scenario.getSnapshot(),
    lenses: lenses(),
    references,
    capabilities: { hasLayout: true }
  });
  assert.equal(before.town.currentTown.id, "town-base");
  assert.equal(before.town.location.instanceId, "marker-one");
  assert.equal(
    createGeographicActions(before).find((entry) => entry.id === "layout").enabled,
    true
  );

  scenario.dispatch(
    createScenarioCommand(
      COMMAND_TYPES.SET_CHARACTER_STATUS,
      { characterId: "alpha", status: 0, playerInvolved: true },
      { id: "kill-alpha", occurredAt: "2026-08-26T12:00:00.000Z" }
    )
  );
  const after = createContextProjection({
    catalog,
    selection: selection.getSelection(),
    snapshot: scenario.getSnapshot(),
    lenses: lenses(),
    references
  });
  assert.strictEqual(selection.getSelection(), beforeSelection);
  assert.equal(after.town.currentTown.id, "town-dead");

  scenario.undo();
  assert.equal(
    createContextProjection({
      catalog,
      selection: selection.getSelection(),
      snapshot: scenario.getSnapshot(),
      lenses: lenses(),
      references
    }).town.currentTown.id,
    "town-base"
  );
  scenario.redo();
  const changedDocument = serializeScenarioEnvelope(scenario);
  scenario.undo();
  scenario.replaceDocument(changedDocument);
  assert.equal(
    createContextProjection({
      catalog,
      selection: selection.getSelection(),
      snapshot: scenario.getSnapshot(),
      lenses: lenses(),
      references
    }).town.currentTown.id,
    "town-dead"
  );
  assert.strictEqual(selection.getSelection(), beforeSelection);
});

test("geographic entry sources converge on the same context actions", () => {
  const { origin, catalog, scenario, selection, references, lenses } = setup();
  let expectedActions = null;
  for (const source of [
    "manifest",
    "palette",
    "quickSearch",
    "favorite",
    "contentBrowser",
    "override",
    "context"
  ]) {
    selection.select(townSelection(origin, { source }));
    const context = createContextProjection({
      catalog,
      selection: selection.getSelection(),
      snapshot: scenario.getSnapshot(),
      lenses: lenses(),
      references,
      capabilities: { hasLayout: true }
    });
    const actions = createGeographicActions(context).map(({ id, enabled, reason }) => ({
      id,
      enabled,
      reason
    }));
    expectedActions ??= actions;
    assert.deepEqual(actions, expectedActions);
    assert.equal(context.town.id, "town-base");
    assert.equal(context.town.location.instanceId, "marker-one");
  }
});

test("spawn and point context remain useful when scenario analysis is unavailable", () => {
  const fixture = createScenarioFixture();
  fixture.datasets.townFcsData[0].ReferenceCategories.residents = [
    { StringId: "squad-one", Name: "Patrol", Value0: 1, Value1: 0 }
  ];
  const { origin, catalog, scenario, selection, references, lenses } = setup(fixture);
  const primaryAnchor = Object.freeze({
    spawnAreaId: "area-one",
    scanIndex: 0,
    pixelCount: 75,
    leafletAnchor: Object.freeze({ lat: 100, lng: 200 })
  });
  const containingAnchor = Object.freeze({
    spawnAreaId: "area-one",
    scanIndex: 1,
    pixelCount: 60,
    leafletAnchor: Object.freeze({ lat: 125, lng: 250 })
  });
  selection.select(townSelection(origin));
  const town = createContextProjection({
    catalog,
    selection: selection.getSelection(),
    references
  });
  assert.equal(town.scenarioAvailable, false);
  assert.deepEqual(town.town.currentTown.residents[0], {
    entityType: "squad",
    entityId: "squad-one",
    name: "Patrol",
    status: "unavailable",
    position: 0,
    value0: 1,
    value1: 0
  });
  const currentTown = createContextProjection({
    catalog,
    selection: selection.getSelection(),
    snapshot: scenario.getSnapshot(),
    lenses: lenses(),
    references
  });
  assert.equal(currentTown.town.currentTown.residents[0].status, "current");
  selection.select({
    kind: "entity",
    entityType: "spawnArea",
    entityId: "area-one",
    instanceId: null,
    source: "contentBrowser",
    origin
  });
  const spawn = createContextProjection({
    catalog,
    selection: selection.getSelection(),
    references,
    spawnAreaAnchor: primaryAnchor
  });
  assert.equal(spawn.scenarioAvailable, false);
  assert.strictEqual(spawn.spawnArea.anchor, primaryAnchor);
  assert.deepEqual(
    spawn.spawnArea.occurrences.map((entry) => entry.occurrenceId),
    ["area-one:Nest:nest-one", "area-one:Squad:squad-one", "area-one:Squad:squad-one:2"]
  );
  const spawnActions = createGeographicActions(spawn);
  assert.deepEqual(spawnActions.find((entry) => entry.id === "zoom").target, {
    kind: "spawnArea",
    anchor: primaryAnchor.leafletAnchor,
    targetZoom: 0
  });
  assert.deepEqual(spawnActions.find((entry) => entry.id === "favorite").target, {
    entityType: "spawnArea",
    entityId: "area-one",
    name: "Test Area"
  });
  const spawnWithoutRaster = createContextProjection({
    catalog,
    selection: selection.getSelection(),
    references
  });
  const unavailableAreaZoom = createGeographicActions(spawnWithoutRaster).find(
    (entry) => entry.id === "zoom"
  );
  assert.equal(unavailableAreaZoom.enabled, false);
  assert.match(unavailableAreaZoom.reason, /geometry is unavailable/u);

  selection.select({
    kind: "point",
    point: { x: 125, z: -250 },
    source: "map",
    origin
  });
  const point = createContextProjection({
    catalog,
    selection: selection.getSelection(),
    references,
    pointFacts: { spawnAreaId: "area-one", biome: { id: "test-biome", name: "Test Biome" } },
    spawnAreaAnchor: containingAnchor
  });
  assert.equal(point.point.spawnArea.id, "area-one");
  assert.strictEqual(point.point.spawnArea.anchor, containingAnchor);
  assert.equal(point.point.biome.name, "Test Biome");
  const actions = createGeographicActions(point, { currentZoom: 0, maxZoom: 2 });
  assert.equal(actions.find((entry) => entry.id === "togglePointContext").enabled, true);
  assert.deepEqual(actions.find((entry) => entry.id === "zoom").target, {
    kind: "spawnArea",
    anchor: containingAnchor.leafletAnchor,
    targetZoom: 0
  });
  assert.deepEqual(actions.find((entry) => entry.id === "favorite").target, {
    entityType: "spawnArea",
    entityId: "area-one",
    name: "Test Area"
  });
  assert.deepEqual(actions.find((entry) => entry.id === "zoomCloser").target, {
    kind: "point",
    anchor: point.point.coordinates.leaflet
  });
  assert.throws(
    () => (actions.find((entry) => entry.id === "favorite").target.name = "Changed"),
    TypeError
  );

  const exactPoint = selection.getSelection();
  const pointOnly = createContextProjection({
    catalog,
    selection: exactPoint,
    references,
    pointFacts: { biome: { id: "test-biome", name: "Test Biome" } }
  });
  const pointOnlyActions = createGeographicActions(pointOnly, { currentZoom: 2, maxZoom: 2 });
  assert.equal(pointOnly.point.spawnArea, null);
  assert.equal(pointOnlyActions.find((entry) => entry.id === "favorite").enabled, false);
  assert.equal(pointOnlyActions.find((entry) => entry.id === "togglePointContext").enabled, false);
  assert.equal(pointOnlyActions.find((entry) => entry.id === "zoomCloser").enabled, false);
  assert.strictEqual(selection.getSelection(), exactPoint);
});

test("versioned map views round-trip public context and guard manifest mismatches", () => {
  const { origin, catalog, selection } = setup();
  selection.select(townSelection(origin, { source: "map" }));
  const fragment = serializeMapView({
    origin,
    viewport: { center: { x: 1000, z: -2000 }, zoom: 0 },
    selection: selection.getSelection(),
    catalog
  });
  const parsed = parseMapView(fragment, catalog);
  assert.deepEqual(parsed.viewport, { center: { x: 1000, z: -2000 }, zoom: 0 });
  assert.equal(parsed.selection.entityId, "town-base");
  assert.equal(parsed.selection.instanceId, "marker-one");
  assert.doesNotMatch(fragment, /document|commands|favorite|paint|markerSet/u);
  for (const zoom of [-4, -3, 2]) {
    const viewport = { center: { x: 1000, z: -2000 }, zoom };
    const zoomFragment = serializeMapView({
      origin,
      viewport,
      selection: selection.getSelection(),
      catalog
    });
    const restored = parseMapView(zoomFragment, catalog);
    assert.equal(new URLSearchParams(zoomFragment.slice(1)).get("view"), "1");
    assert.deepEqual(restored.viewport, viewport);
    assert.deepEqual(restored.selection, parsed.selection);
  }
  for (const zoom of [-4.01, -5, 3]) {
    assert.throws(
      () => serializeMapView({ origin, viewport: { center: { x: 0, z: 0 }, zoom } }),
      /supported zoom/u
    );
    const invalidZoom = new URLSearchParams(fragment.slice(1));
    invalidZoom.set("zoom", String(zoom));
    const rejected = parseMapView(`#${invalidZoom.toString()}`, catalog);
    assert.equal(rejected.viewport, null);
    assert.equal(rejected.selection, null);
    assert.match(rejected.notice, /invalid coordinates or zoom/u);
  }
  assert.throws(
    () =>
      serializeMapView({
        origin,
        viewport: { center: { x: 0, z: 0 }, zoom: 0 },
        selection: townSelection(origin, { instanceId: "missing-instance" }),
        catalog
      }),
    (error) => error.code === "selection_instance_mismatch"
  );

  const mismatchParams = new URLSearchParams(fragment.slice(1));
  mismatchParams.set("baseline", "manifest:elsewhere");
  const mismatch = parseMapView(`#${mismatchParams.toString()}`, catalog);
  assert.deepEqual(mismatch.viewport, parsed.viewport);
  assert.equal(mismatch.selection, null);
  assert.match(mismatch.notice, /different manifest baseline/u);

  const invalid = parseMapView("#view=1&cx=999999&cz=0&zoom=0", catalog);
  assert.equal(invalid.viewport, null);
  assert.match(invalid.notice, /invalid coordinates/u);

  selection.select({
    kind: "entity",
    entityType: "spawnArea",
    entityId: "area-one",
    instanceId: null,
    source: "contentBrowser",
    origin
  });
  const spawnFragment = serializeMapView({
    origin,
    viewport: { center: { x: 0, z: 0 }, zoom: -1 },
    selection: selection.getSelection(),
    catalog
  });
  assert.equal(parseMapView(spawnFragment, catalog).selection.entityId, "area-one");

  selection.select({
    kind: "point",
    point: { x: -125, z: 250 },
    source: "map",
    origin
  });
  const pointFragment = serializeMapView({
    origin,
    viewport: { center: { x: 0, z: 0 }, zoom: 1 },
    selection: selection.getSelection(),
    catalog
  });
  assert.deepEqual(parseMapView(pointFragment, catalog).selection.point, { x: -125, z: 250 });

  const missingEntity = new URLSearchParams(spawnFragment.slice(1));
  missingEntity.set("id", "missing-area");
  const missing = parseMapView(`#${missingEntity.toString()}`, catalog);
  assert.equal(missing.selection, null);
  assert.match(missing.notice, /could not be restored/u);
});
