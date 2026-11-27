import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnchoredPopoverPlacement,
  createLayerPresentationProjection,
  createLayersPopoverPlacement,
  createMapControlsPlacement,
  createUsableMapBounds
} from "../modules/viewport/index.js";

const workspaceRect = Object.freeze({ left: 0, top: 0, right: 400, bottom: 300 });

test("anchored popovers align below their anchor and report usable block space", () => {
  const placement = createAnchoredPopoverPlacement({
    anchorRect: { left: 320, top: 20, right: 360, bottom: 60 },
    workspaceRect,
    surfaceSize: { width: 120, height: 100 },
    alignment: "end"
  });

  assert.deepEqual(placement, {
    placement: "below",
    left: 240,
    top: 68,
    availableBlockSize: 224
  });
  assert.throws(() => (placement.left = 0), TypeError);
});

test("anchored popovers flip, clamp, and remain relative to an offset workspace", () => {
  const flipped = createAnchoredPopoverPlacement({
    anchorRect: { left: 420, top: 300, right: 460, bottom: 330 },
    workspaceRect: { left: 100, top: 50, right: 500, bottom: 350 },
    surfaceSize: { width: 120, height: 80 },
    alignment: "end"
  });
  assert.deepEqual(flipped, {
    placement: "above",
    left: 240,
    top: 162,
    availableBlockSize: 234
  });

  const clamped = createAnchoredPopoverPlacement({
    anchorRect: { left: 0, top: 20, right: 20, bottom: 50 },
    workspaceRect,
    surfaceSize: { width: 120, height: 60 },
    alignment: "end"
  });
  assert.equal(clamped.left, 8);
  assert.equal(clamped.top, 58);
});

test("anchored placement prefers the roomier side and rejects malformed geometry", () => {
  const constrained = createAnchoredPopoverPlacement({
    anchorRect: { left: 180, top: 160, right: 220, bottom: 180 },
    workspaceRect,
    surfaceSize: { width: 100, height: 200 },
    preferredPlacement: "below",
    alignment: "center"
  });
  assert.equal(constrained.placement, "above");
  assert.equal(constrained.availableBlockSize, 144);

  assert.throws(
    () =>
      createAnchoredPopoverPlacement({
        anchorRect: { left: 20, top: 20, right: 10, bottom: 30 },
        workspaceRect,
        surfaceSize: { width: 40, height: 40 }
      }),
    /bounds are inverted/
  );
  assert.throws(
    () =>
      createAnchoredPopoverPlacement({
        anchorRect: { left: 10, top: 10, right: 20, bottom: 20 },
        workspaceRect,
        surfaceSize: { width: 40, height: 40 },
        alignment: "outside"
      }),
    /alignment must be one of/
  );
});

test("layer presentation reads every Road/Border combination without retaining layer state", () => {
  const roads = {},
    borders = {};
  const descriptors = [
    {
      id: "roads",
      name: "Road Network",
      kind: "overlay",
      family: "reference",
      configurationTarget: "roads",
      layer: roads
    },
    {
      id: "spawnBorders",
      name: "Spawn Borders",
      kind: "overlay",
      family: "reference",
      configurationTarget: "borders",
      layer: borders
    }
  ];
  for (const roadEnabled of [false, true]) {
    for (const borderEnabled of [false, true]) {
      const active = new Set([
        ...(roadEnabled ? [roads] : []),
        ...(borderEnabled ? [borders] : [])
      ]);
      const projection = createLayerPresentationProjection({
        descriptors,
        hasLayer: (layer) => active.has(layer)
      });
      assert.equal(projection.available, true);
      assert.equal(projection.roadEnabled, roadEnabled);
      assert.equal(projection.borderEnabled, borderEnabled);
      assert.equal(
        projection.referenceLayers.length,
        Number(roadEnabled) + Number(borderEnabled)
      );
      assert.throws(() => (projection.roadEnabled = true), TypeError);
      active.clear();
      const refreshed = createLayerPresentationProjection({
        descriptors,
        hasLayer: (layer) => active.has(layer)
      });
      assert.equal(refreshed.roadEnabled, false);
      assert.equal(refreshed.borderEnabled, false);
    }
  }
  assert.equal(Object.isFrozen(roads), false, "projection must not freeze live Leaflet objects");
});

test("all three configuration sections independently follow live activation before chooser readiness", () => {
  const targets = ["roads", "borders", "debugGrid"];
  const layers = targets.map(() => ({}));
  const configurationDescriptors = targets.map((configurationTarget, index) => ({
    id: configurationTarget,
    configurationTarget,
    layer: layers[index]
  }));
  for (let mask = 0; mask < 8; mask++) {
    const live = new Set(layers.filter((_, index) => mask & (1 << index)));
    const projection = createLayerPresentationProjection({
      configurationDescriptors,
      hasLayer: (layer) => live.has(layer)
    });
    assert.deepEqual(
      [projection.roadEnabled, projection.borderEnabled, projection.gridEnabled],
      layers.map((layer) => live.has(layer))
    );
    assert.equal(projection.configurationAvailable, true);
    assert.equal(projection.available, false);
    assert.equal(Object.isFrozen(projection), true);
  }
});

test("world view, map content, reference layers, and unavailable initialization are distinct", () => {
  const empty = {},
    towns = {},
    inactive = {};
  const descriptors = [
    { id: "none", name: "None", kind: "surface", family: "worldView", layer: empty },
    { id: "towns", name: "Towns", kind: "overlay", family: "mapContent", layer: towns },
    { id: "grid", name: "Debug Grid", kind: "overlay", family: "reference", layer: inactive }
  ];
  const projection = createLayerPresentationProjection({
    descriptors,
    hasLayer: (layer) => layer !== inactive
  });
  assert.deepEqual(projection.worldViews, [{ id: "none", name: "None" }]);
  assert.deepEqual(projection.mapContent, [{ id: "towns", name: "Towns" }]);
  assert.deepEqual(projection.referenceLayers, []);
  assert.throws(() => projection.mapContent.push({}), TypeError);
  assert.deepEqual(createLayerPresentationProjection(), {
    available: false,
    configurationAvailable: false,
    worldViews: [],
    mapContent: [],
    referenceLayers: [],
    roadEnabled: false,
    borderEnabled: false,
    gridEnabled: false
  });
  assert.throws(() => createLayerPresentationProjection({ descriptors }), /live hasLayer reader/);
});

test("Plan summarizes only active Towns and counts only present type filters", () => {
  const towns = {};
  const descriptors = [
    { id: "towns", name: "Towns", kind: "overlay", family: "mapContent", layer: towns }
  ];
  const townTypeProjection = Object.freeze({
    enabledCount: 7,
    totalTypeCount: 11,
    allEnabled: false,
    enabledPresentCount: 6,
    presentTypeCount: 8,
    allPresentEnabled: false
  });
  const active = createLayerPresentationProjection({
    descriptors,
    townTypeProjection,
    hasLayer: (layer) => layer === towns
  });
  assert.deepEqual(active.mapContent, [
    { id: "towns", name: "Towns (6 of 8 types)" }
  ]);
  const parentOff = createLayerPresentationProjection({
    descriptors,
    townTypeProjection,
    hasLayer: () => false
  });
  assert.deepEqual(parentOff.mapContent, []);

  const zeroCountFiltersDisabled = createLayerPresentationProjection({
    descriptors,
    townTypeProjection: {
      ...townTypeProjection,
      enabledPresentCount: 8,
      allPresentEnabled: true
    },
    hasLayer: (layer) => layer === towns
  });
  assert.deepEqual(zeroCountFiltersDisabled.mapContent, [{ id: "towns", name: "Towns" }]);
});

test("known configurable layers retain live enablement before the complete chooser is available", () => {
  const roads = {},
    borders = {};
  const configurationDescriptors = Object.freeze([
    Object.freeze({ id: "roads", layer: roads, configurationTarget: "roads" }),
    Object.freeze({ id: "spawnBorders", layer: borders, configurationTarget: "borders" })
  ]);
  const live = new Set([roads]);
  const read = () =>
    createLayerPresentationProjection({
      configurationDescriptors,
      hasLayer: (layer) => live.has(layer)
    });
  assert.deepEqual(read(), {
    available: false,
    configurationAvailable: true,
    worldViews: [],
    mapContent: [],
    referenceLayers: [],
    roadEnabled: true,
    borderEnabled: false,
    gridEnabled: false
  });
  live.clear();
  live.add(borders);
  assert.equal(read().roadEnabled, false);
  assert.equal(read().borderEnabled, true);
  assert.equal(Object.isFrozen(roads), false);
});

const layersPlacement = (options = {}) =>
  createLayersPopoverPlacement({
    workspaceRect: { left: 320, top: 60, right: 1200, bottom: 900 },
    anchorRect: { left: 332, top: 190, right: 550, bottom: 226 },
    surfaceBlockSize: 800,
    headerBlockSize: 40,
    optionBlockSize: 30,
    ...options
  });

test("layer-family choosers follow their launcher group with fixed width", () => {
  const result = layersPlacement();
  assert.deepEqual(result, {
    mode: "anchored",
    placement: "below",
    left: 12,
    top: 174,
    width: 240,
    availableBlockSize: 658
  });
  assert.throws(() => (result.mode = "bounded"), TypeError);
  const tallerRail = layersPlacement({
    anchorRect: { left: 332, top: 230, right: 550, bottom: 266 }
  });
  assert.equal(tallerRail.top, result.top + 40);
  assert.equal(tallerRail.availableBlockSize, result.availableBlockSize - 40);
});

test("layer-family choosers flip above the narrow rail and clamp to usable width", () => {
  const result = layersPlacement({
    workspaceRect: { left: 0, top: 60, right: 320, bottom: 700 },
    anchorRect: { left: 98, top: 620, right: 308, bottom: 656 },
    narrow: true
  });
  assert.equal(result.placement, "above");
  assert.equal(result.left, 68);
  assert.equal(result.top, 8);
  assert.equal(result.availableBlockSize, 544);
  const narrow = layersPlacement({
    workspaceRect: { left: 0, top: 0, right: 180, bottom: 500 },
    anchorRect: { left: 12, top: 12, right: 168, bottom: 48 }
  });
  assert.equal(narrow.width, 164);
  assert.equal(narrow.left, 8);
});

test("layer-family choosers use bounded fallback only below the three-row threshold", () => {
  const options = {
    workspaceRect: { left: 0, top: 0, right: 400, bottom: 300 },
    anchorRect: { left: 12, top: 130, right: 230, bottom: 166 }
  };
  const bounded = layersPlacement(options);
  assert.deepEqual(bounded, {
    mode: "bounded",
    placement: "bounded",
    left: 12,
    top: 8,
    width: 240,
    availableBlockSize: 284
  });
  const resized = layersPlacement({
    ...options,
    workspaceRect: { left: 0, top: 0, right: 400, bottom: 600 }
  });
  assert.equal(resized.mode, "anchored");
  assert.equal(resized.top, 174);
  assert.equal(
    layersPlacement({ ...options, headerBlockSize: 20, optionBlockSize: 20 }).mode,
    "anchored"
  );
  assert.throws(() => layersPlacement({ optionBlockSize: -1 }), /cannot be negative/);
});

test("layer-family choosers shorten around Scanner without disturbing clear placement", () => {
  const clear = layersPlacement({
    hudRects: [{ left: 650, top: 600, right: 1190, bottom: 890 }]
  });
  assert.deepEqual(clear, layersPlacement());
  const shortened = layersPlacement({
    hudRects: [{ left: 450, top: 600, right: 1190, bottom: 890 }]
  });
  assert.equal(shortened.mode, "anchored");
  assert.equal(shortened.placement, "below");
  assert.equal(shortened.left, clear.left);
  assert.equal(shortened.top, clear.top);
  assert.equal(shortened.availableBlockSize, 358);
  assert.equal(60 + shortened.top + shortened.availableBlockSize, 592);
});

test("only bounded layer-family fallback may overlap a HUD when neither side fits", () => {
  const result = layersPlacement({
    workspaceRect: { left: 0, top: 0, right: 400, bottom: 500 },
    anchorRect: { left: 12, top: 90, right: 230, bottom: 126 },
    hudRects: [{ left: 120, top: 230, right: 390, bottom: 490 }]
  });
  assert.equal(result.mode, "bounded");
  assert.equal(result.top, 8);
  assert.equal(result.availableBlockSize, 484);
});

test("usable bounds exclude inspector drawers and bottom sheets without changing workspace coordinates", () => {
  const workspace = { left: 320, top: 60, right: 1200, bottom: 900 };
  const usable = createUsableMapBounds({
    workspaceRect: workspace,
    occlusions: [
      { left: 0, top: 60, right: 320, bottom: 900 },
      { left: 840, top: 60, right: 1200, bottom: 900 }
    ]
  });
  assert.deepEqual(usable, { left: 320, top: 60, right: 840, bottom: 900 });
  const result = layersPlacement({ usableRect: usable });
  assert.equal(result.left, 12);
  assert.ok(result.left + result.width <= usable.right - workspace.left - 8);
  const sheet = createUsableMapBounds({
    workspaceRect: workspace,
    occlusions: [{ left: 320, top: 550, right: 1200, bottom: 900 }]
  });
  assert.equal(sheet.bottom, 550);
  assert.throws(() => (sheet.bottom = 800), TypeError);
});

test("the whole controller/launcher cluster stays reachable as rows and sheets change", () => {
  const workspace = { left: 0, top: 0, right: 400, bottom: 600 };
  const first = createMapControlsPlacement({ workspaceRect: workspace, contentBlockSize: 134 });
  assert.equal(first.top, 12);
  const second = createMapControlsPlacement({
    workspaceRect: workspace,
    contentBlockSize: 214,
    narrow: true
  });
  assert.equal(second.left, 148);
  assert.equal(second.top, 374);
  const constrained = createMapControlsPlacement({
    workspaceRect: workspace,
    usableRect: { left: 0, top: 0, right: 400, bottom: 60 },
    contentBlockSize: 214,
    narrow: true
  });
  assert.equal(constrained.top, 6);
  assert.equal(constrained.availableBlockSize, 48);
  assert.equal(constrained.width, 240);
  assert.throws(() => (constrained.top = -100), TypeError);
});
