import assert from "node:assert/strict";
import test from "node:test";

import {
  PointProbeSession,
  SelectionError,
  SelectionSession,
  createSelectionCatalog,
  createSelectionOrigin,
  serializeMapView
} from "../modules/selection/index.js";
import { createAreaZoomPlan, createZoomCloserPlan } from "../modules/viewport/index.js";
import { createScenarioFixture } from "./fixtures/scenario-fixture.js";

function setup() {
  const fixture = createScenarioFixture();
  const origin = createSelectionOrigin(fixture.contract);
  const catalog = createSelectionCatalog({
    origin,
    towns: fixture.datasets.townFcsData,
    spawnAreas: fixture.datasets.spawnAreas,
    mapLocations: fixture.datasets.mapData
  });
  return { origin, catalog };
}

function candidate(origin, x = 125.5, z = -250.25) {
  return { kind: "point", point: { x, z }, source: "map", origin };
}

test("point probes are immutable, no-op aware, replaceable, and isolated from selection", () => {
  const { origin, catalog } = setup();
  const probe = new PointProbeSession(catalog);
  const selection = new SelectionSession(catalog);
  const changes = [];
  probe.subscribe((change) => changes.push(change));

  assert.equal(probe.set(candidate(origin)).type, "set");
  assert.equal(probe.set(candidate(origin)), false);
  assert.equal(selection.getSelection(), null);
  assert.throws(() => (probe.getProbe().point.x = 0), TypeError);
  assert.equal(probe.set(candidate(origin, 300, 400)).type, "set");
  assert.deepEqual(probe.getProbe().point, { x: 300, z: 400 });
  assert.equal(changes.length, 2);

  selection.select(probe.getProbe());
  const promoted = selection.getSelection();
  probe.clear();
  assert.deepEqual(promoted.point, { x: 300, z: 400 });
  assert.equal(probe.getProbe(), null);
  assert.equal(probe.clear(), false);
});

test("point probe validation is atomic and rejects entities, stale origins, and bad coordinates", () => {
  const { origin, catalog } = setup();
  const probe = new PointProbeSession(catalog);
  probe.set(candidate(origin));
  const retained = probe.getProbe();

  assert.throws(
    () => probe.set({ ...candidate(origin), point: { x: Number.NaN, z: 0 } }),
    (error) => error instanceof SelectionError && error.code === "invalid_selection_point"
  );
  assert.throws(
    () => probe.set({ ...candidate(origin), origin: { ...origin, baselineKey: "stale" } }),
    (error) => error instanceof SelectionError && error.code === "stale_selection_origin"
  );
  assert.throws(
    () =>
      probe.set({
        kind: "entity",
        entityType: "town",
        entityId: "town-base",
        instanceId: null,
        source: "map",
        origin
      }),
    (error) => error instanceof SelectionError && error.code === "invalid_point_probe"
  );
  assert.strictEqual(probe.getProbe(), retained);
});

test("Copy View can serialize a validated probe candidate without promotion", () => {
  const { origin, catalog } = setup();
  const probe = new PointProbeSession(catalog);
  probe.set(candidate(origin, 12.25, -19.75));
  const fragment = serializeMapView({
    origin,
    viewport: { center: { x: 0, z: 0 }, zoom: -1 },
    selection: probe.getProbe(),
    catalog
  });

  assert.match(fragment, /type=point/u);
  assert.match(fragment, /px=12\.25/u);
  assert.match(fragment, /pz=-19\.75/u);
  assert.doesNotMatch(fragment, /document|favorite|paint|marker/u);
});

test("Zoom Closer advances one level, honors bounds and occluding panels, and reduces motion", () => {
  const workspaceRect = { left: 100, top: 50, right: 900, bottom: 650 };
  const plan = createZoomCloserPlan({
    currentZoom: -2,
    maxZoom: 2,
    workspaceRect,
    occlusionRects: [
      { left: 100, top: 50, right: 220, bottom: 650 },
      { left: 820, top: 50, right: 900, bottom: 650 }
    ],
    reducedMotion: true
  });
  assert.equal(plan.targetZoom, -1);
  assert.equal(plan.enabled, true);
  assert.equal(plan.animate, false);
  assert.deepEqual(plan.paddingTopLeft, { x: 132, y: 12 });
  assert.deepEqual(plan.paddingBottomRight, { x: 92, y: 12 });
  assert.throws(() => (plan.targetZoom = 2), TypeError);

  const bounded = createZoomCloserPlan({ currentZoom: 2, maxZoom: 2 });
  assert.equal(bounded.targetZoom, 2);
  assert.equal(bounded.enabled, false);
});

test("Area Zoom targets bounded level zero with shared panel padding and motion preferences", () => {
  const plan = createAreaZoomPlan({
    minZoom: -3,
    maxZoom: 2,
    targetZoom: 0,
    workspaceRect: { left: 100, top: 50, right: 900, bottom: 650 },
    occlusionRects: [
      { left: 100, top: 50, right: 220, bottom: 650 },
      { left: 820, top: 50, right: 900, bottom: 650 }
    ],
    reducedMotion: true
  });
  assert.equal(plan.enabled, true);
  assert.equal(plan.targetZoom, 0);
  assert.equal(plan.animate, false);
  assert.deepEqual(plan.paddingTopLeft, { x: 132, y: 12 });
  assert.deepEqual(plan.paddingBottomRight, { x: 92, y: 12 });
  assert.throws(() => (plan.paddingTopLeft.x = 0), TypeError);

  assert.equal(createAreaZoomPlan({ minZoom: 1, maxZoom: 2, targetZoom: 0 }).targetZoom, 1);
  assert.equal(createAreaZoomPlan({ minZoom: -3, maxZoom: -1, targetZoom: 0 }).targetZoom, -1);
  assert.throws(() => createAreaZoomPlan({ minZoom: 2, maxZoom: -3 }), /minimum/u);
});
