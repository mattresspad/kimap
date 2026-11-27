import assert from "node:assert/strict";
import test from "node:test";

import {
  ViewportCompositionSession,
  ViewportError,
  VIEWPORT_WORKBENCH_TOKENS,
  classifyViewportLayout,
  createEscapeCoordinator,
  createViewportResizeAdapter,
  hasPhoneSizedTouchScreen
} from "../modules/viewport/index.js";
import {
  SelectionSession,
  createSelectionCatalog,
  createSelectionOrigin
} from "../modules/selection/index.js";
import { createScenarioFixture } from "./fixtures/scenario-fixture.js";

test("viewport composition snapshots are deeply immutable and suppress no-op notifications", () => {
  const session = new ViewportCompositionSession();
  const changes = [];
  session.subscribe((change) => changes.push(change));

  assert.deepEqual(session.getSnapshot(), {
    activeTask: "browse",
    activeSubview: null,
    dockOpen: true,
    inspectorOpen: false,
    toolShelfOpen: false,
    toolShelfTab: "marker",
    pointContextVisible: true,
    hudMode: "scanner",
    hudAnchor: "right",
    scannerExpanded: false,
    scorecardExpanded: false,
    politicalTooltipMode: "reduced",
    politicalProbeExpanded: true,
    tooltipSubject: "political",
    pointProbeSubject: "political",
    tooltipPlacement: "anchored",
    pointProbePlacement: "anchored",
    resourcesTooltipMode: "reduced",
    weatherTooltipMode: "reduced",
    resourcesProbeExpanded: true,
    weatherProbeExpanded: true,
    relationsTooltipMode: "reduced",
    squadPresenceTooltipMode: "reduced",
    relationsProbeExpanded: true,
    squadPresenceProbeExpanded: true,
    relationsProbeHidden: false,
    relationsTooltipFilter: "alliesEnemies",
    relationsProbeFilter: "alliesEnemies",
    cursorControlsView: "tooltips",
    factionColorsWidgetOpen: false,
    factionColorsWidgetSearchOpen: false,
    factionColorsWidgetSearch: "",
    browseMode: "context",
    contextRoute: "dashboard",
    layerConfigurationTarget: null,
    worldViewGroupsExpanded: { geography: true, fertility: false, resources: false, weather: false },
    focusMap: false,
    layoutClass: "wide",
    short: false,
    phone: false,
    phoneForeground: "map",
    inspectorTransparency: 0,
    inspectorTransparencyOpen: false,
    transientSurface: null,
    narrowActiveSheet: null,
    effective: { dockVisible: true, inspectorVisible: false, toolShelfVisible: false }
  });
  assert.throws(() => (session.getSnapshot().effective.dockVisible = false), TypeError);
  assert.equal(session.setTask("browse"), false);
  assert.equal(session.hideInspector(), false);
  assert.equal(changes.length, 0);

  assert.equal(session.setTask("simulate").type, "setTask");
  assert.equal(session.getSnapshot().activeTask, "simulate");
  assert.equal(changes.length, 1);
  assert.throws(
    () => session.setTask("unknown"),
    (error) => error instanceof ViewportError && error.code === "invalid_viewport_task"
  );
});

test("Browse Context routes are immutable, retained across surfaces, and reset deliberately", () => {
  const session = new ViewportCompositionSession();
  assert.equal(session.getSnapshot().browseMode, "context");
  assert.equal(session.getSnapshot().contextRoute, "dashboard");
  for (const subjectId of [
    "keyCharacters",
    "bountyTargets",
    "deadlyAnimals",
    "nestTreasures"
  ]) {
    assert.equal(session.openContextSubject(subjectId).type, "openContextSubject");
    assert.equal(session.getSnapshot().contextRoute, subjectId);
  }
  assert.equal(session.openContextSubject("nestTreasures"), false);
  assert.equal(session.setBrowseMode("content").type, "setBrowseMode");
  session.hideDock();
  session.enterFocusMap();
  assert.equal(session.getSnapshot().contextRoute, "nestTreasures");
  assert.equal(session.getSnapshot().browseMode, "content");
  session.reset();
  assert.equal(session.getSnapshot().browseMode, "context");
  assert.equal(session.getSnapshot().contextRoute, "dashboard");
  assert.throws(
    () => session.openContextSubject("unknown"),
    (error) => error instanceof ViewportError && error.code === "invalid_context_route"
  );
});

test("anchored popover state is immutable, exclusive, no-op aware, and dismissed by its owners", () => {
  const session = new ViewportCompositionSession();

  assert.equal(session.closeTransientSurface(), false);
  assert.equal(session.openTransientSurface("mapContent").type, "openTransientSurface");
  assert.equal(session.openTransientSurface("mapContent"), false);
  assert.equal(session.getSnapshot().transientSurface, "mapContent");
  assert.throws(() => (session.getSnapshot().transientSurface = "paintIcons"), TypeError);

  session.openTransientSurface("worldViews");
  assert.equal(session.getSnapshot().transientSurface, "worldViews");

  session.openTransientSurface("paintIcons");
  assert.equal(session.getSnapshot().transientSurface, "paintIcons");
  assert.equal(session.closeTransientSurface("mapContent"), false);
  assert.equal(session.setToolShelfTab("paint").type, "setToolShelfTab");
  assert.equal(session.getSnapshot().transientSurface, "paintIcons");
  session.setToolShelfTab("marker");
  assert.equal(session.getSnapshot().transientSurface, null);

  session.showToolShelf();
  session.setToolShelfTab("paint");
  session.openTransientSurface("paintIcons");
  session.hideToolShelf();
  assert.equal(session.getSnapshot().transientSurface, null);

  session.openTransientSurface("worldViews");
  session.enterFocusMap();
  assert.equal(session.getSnapshot().transientSurface, null);
  session.exitFocusMap();
  session.openTransientSurface("paintIcons");
  session.reset();
  assert.equal(session.getSnapshot().transientSurface, null);
  assert.throws(
    () => session.openTransientSurface("menu"),
    (error) => error instanceof ViewportError && error.code === "invalid_viewport_transient_surface"
  );
});

test("Layer Configuration is an immutable Plan subview retained across minimization and Focus Map", () => {
  const session = new ViewportCompositionSession({ layoutClass: "narrow", hasSelection: true });
  assert.equal(session.openSubview("layerConfiguration", "roads").type, "openSubview");
  const state = session.getSnapshot();
  assert.equal(state.activeTask, "plan");
  assert.equal(state.activeSubview, "layerConfiguration");
  assert.equal(state.layerConfigurationTarget, "roads");
  assert.equal(state.narrowActiveSheet, "dock");
  assert.equal(state.inspectorOpen, true);
  assert.equal(session.openSubview("layerConfiguration", "roads"), false);
  assert.strictEqual(session.getSnapshot(), state);
  assert.throws(() => (state.layerConfigurationTarget = "borders"), TypeError);
  session.hideDock();
  session.showDock();
  session.enterFocusMap();
  session.exitFocusMap();
  assert.equal(session.getSnapshot().activeSubview, "layerConfiguration");
  assert.equal(session.getSnapshot().layerConfigurationTarget, "roads");
  session.openSubview("layerConfiguration", "borders");
  assert.equal(session.getSnapshot().layerConfigurationTarget, "borders");
  session.openSubview("layerConfiguration", "debugGrid");
  assert.equal(session.openSubview("layerConfiguration", "debugGrid"), false);
  session.enterFocusMap();
  session.exitFocusMap();
  assert.equal(session.getSnapshot().layerConfigurationTarget, "debugGrid");
  session.back();
  assert.equal(session.getSnapshot().activeTask, "plan");
  assert.equal(session.getSnapshot().layerConfigurationTarget, null);
  session.openSubview("layerConfiguration", "roads");
  session.setTask("browse");
  assert.equal(session.getSnapshot().layerConfigurationTarget, null);
  session.openSubview("layerConfiguration", "borders");
  session.reset();
  assert.equal(session.getSnapshot().activeTask, "browse");
  assert.equal(session.getSnapshot().layerConfigurationTarget, null);
  assert.equal("mapAppearanceExpanded" in session.getSnapshot(), false);
});

test("configuration targets cannot leak into other routes or accept unimplemented layers", () => {
  const session = new ViewportCompositionSession();
  const original = session.getSnapshot();
  assert.throws(
    () => session.openSubview("layerConfiguration", "biomes"),
    /roads, borders, or debugGrid/
  );
  assert.throws(() => session.openSubview("favorites", "roads"), /Only Layer Configuration/);
  assert.throws(
    () => new ViewportCompositionSession({ layerConfigurationTarget: "roads" }),
    /Only Layer Configuration/
  );
  assert.strictEqual(session.getSnapshot(), original);
  session.openSubview("layerConfiguration");
  assert.equal(session.getSnapshot().layerConfigurationTarget, null);
  session.openSubview("layerConfiguration", "roads");
  session.openSubview("favorites");
  assert.equal(session.getSnapshot().layerConfigurationTarget, null);
});

test("Faction Colors is a Plan child route retained across disclosure and Focus Map", () => {
  const session = new ViewportCompositionSession({ layoutClass: "narrow" });
  const change = session.openSubview("factionColors");
  const opened = session.getSnapshot();
  assert.equal(change.type, "openSubview");
  assert.equal(opened.activeTask, "plan");
  assert.equal(opened.activeSubview, "factionColors");
  assert.equal(opened.layerConfigurationTarget, null);
  assert.equal(opened.narrowActiveSheet, "dock");
  assert.equal(session.openSubview("factionColors"), false);
  assert.strictEqual(session.getSnapshot(), opened);
  session.hideDock();
  session.showDock();
  session.enterFocusMap();
  session.exitFocusMap();
  assert.equal(session.getSnapshot().activeSubview, "factionColors");
  session.back();
  assert.equal(session.getSnapshot().activeTask, "plan");
  assert.equal(session.getSnapshot().activeSubview, null);
  session.openSubview("factionColors");
  session.reset();
  assert.equal(session.getSnapshot().activeTask, "browse");
  assert.equal(session.getSnapshot().activeSubview, null);
});

test("narrow layer-family choosers and structural sheets hand off without overlap", () => {
  const session = new ViewportCompositionSession({ hasSelection: true });
  session.openTransientSurface("mapContent");
  session.setLayoutClass("narrow", true);
  assert.equal(session.getSnapshot().transientSurface, "mapContent");
  assert.equal(session.getSnapshot().narrowActiveSheet, null);
  assert.equal(session.getSnapshot().effective.inspectorVisible, false);
  assert.equal(session.getSnapshot().effective.dockVisible, false);
  assert.equal(session.setLayoutClass("narrow", true), false);
  session.showInspector();
  assert.equal(session.getSnapshot().transientSurface, null);
  assert.equal(session.getSnapshot().narrowActiveSheet, "inspector");
  session.openTransientSurface("worldViews");
  session.showDock();
  assert.equal(session.getSnapshot().transientSurface, null);
  assert.equal(session.getSnapshot().narrowActiveSheet, "dock");
  session.openTransientSurface("mapContent");
  session.openSubview("layerConfiguration", "roads");
  assert.equal(session.getSnapshot().transientSurface, null);
  assert.equal(session.getSnapshot().activeSubview, "layerConfiguration");
  const initialized = new ViewportCompositionSession({
    layoutClass: "narrow",
    transientSurface: "worldViews"
  });
  assert.equal(initialized.getSnapshot().narrowActiveSheet, null);
});

test("point presentation is immutable, no-op aware, and preserved by disclosure changes", () => {
  const session = new ViewportCompositionSession();
  const changes = [];
  session.subscribe((change) => changes.push(change));

  assert.equal(session.showPointContext(), false);
  assert.equal(session.hidePointContext().type, "hidePointContext");
  assert.equal(session.hidePointContext(), false);
  assert.equal(session.getSnapshot().pointContextVisible, false);
  assert.throws(() => (session.getSnapshot().pointContextVisible = true), TypeError);

  session.showInspector();
  session.hideInspector();
  session.enterFocusMap();
  session.exitFocusMap();
  session.setTask("simulate");
  assert.equal(session.getSnapshot().pointContextVisible, false);

  assert.equal(session.togglePointContext().type, "togglePointContext");
  assert.equal(session.getSnapshot().pointContextVisible, true);
  assert.equal(session.showPointContext(), false);
  session.hidePointContext();
  session.reset({ hasSelection: true });
  assert.equal(session.getSnapshot().pointContextVisible, true);
  assert.equal(changes.filter((change) => change.type === "hidePointContext").length, 2);
});

test("task subviews return to their parent without retaining competing navigation state", () => {
  const session = new ViewportCompositionSession({ activeTask: "plan" });

  session.openSubview("favorites");
  assert.equal(session.getSnapshot().activeTask, "browse");
  assert.equal(session.getSnapshot().activeSubview, "favorites");
  assert.equal(session.back().type, "back");
  assert.equal(session.getSnapshot().activeSubview, null);
  assert.equal(session.back(), false);

  session.openSubview("relationsJournal");
  assert.equal(session.getSnapshot().activeTask, "simulate");
  assert.equal(session.getSnapshot().activeSubview, "relationsJournal");
  session.setTask("plan");
  assert.equal(session.getSnapshot().activeSubview, null);
});

test("Focus Map masks panels reversibly without destroying disclosure changes", () => {
  const session = new ViewportCompositionSession();
  session.showInspector();
  session.showToolShelf();
  session.enterFocusMap();
  assert.equal(session.getSnapshot().dockOpen, true);
  assert.equal(session.getSnapshot().inspectorOpen, true);
  assert.equal(session.getSnapshot().toolShelfOpen, true);
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: false,
    inspectorVisible: false,
    toolShelfVisible: false
  });

  session.hideInspector();
  session.hideDock();
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: false,
    inspectorVisible: false,
    toolShelfVisible: false
  });
  session.exitFocusMap();
  assert.equal(session.getSnapshot().dockOpen, false);
  assert.equal(session.getSnapshot().inspectorOpen, false);
  assert.equal(session.getSnapshot().toolShelfOpen, true);
  assert.equal(session.getSnapshot().effective.toolShelfVisible, true);

  session.toggleDock();
  assert.equal(session.getSnapshot().dockOpen, true);
  assert.equal(session.toggleDock().type, "hideDock");
});

test("narrow layouts expose exactly one retained sheet", () => {
  const session = new ViewportCompositionSession({ layoutClass: "narrow", short: true });
  assert.equal(session.getSnapshot().narrowActiveSheet, "dock");
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: true,
    inspectorVisible: false,
    toolShelfVisible: false
  });

  session.showInspector();
  assert.equal(session.getSnapshot().dockOpen, true);
  assert.equal(session.getSnapshot().narrowActiveSheet, "inspector");
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: false,
    inspectorVisible: true,
    toolShelfVisible: false
  });

  session.setTask("plan");
  assert.equal(session.getSnapshot().inspectorOpen, true);
  assert.equal(session.getSnapshot().narrowActiveSheet, "dock");
  session.hideDock();
  assert.equal(session.getSnapshot().narrowActiveSheet, "inspector");
  session.hideInspector();
  assert.equal(session.getSnapshot().narrowActiveSheet, null);
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: false,
    inspectorVisible: false,
    toolShelfVisible: false
  });
});

test("tool shelf disclosure is immutable, no-op aware, and independent of narrow sheets", () => {
  const session = new ViewportCompositionSession({ layoutClass: "narrow" });
  const changes = [];
  session.subscribe((change) => changes.push(change));

  assert.equal(session.hideToolShelf(), false);
  assert.equal(session.showToolShelf().type, "showToolShelf");
  assert.equal(session.showToolShelf(), false);
  assert.equal(session.getSnapshot().toolShelfOpen, true);
  assert.equal(session.getSnapshot().effective.toolShelfVisible, true);
  assert.equal(session.getSnapshot().narrowActiveSheet, "dock");
  assert.throws(() => (session.getSnapshot().toolShelfOpen = false), TypeError);

  assert.equal(session.hideToolShelf().type, "hideToolShelf");
  assert.equal(session.hideToolShelf(), false);
  assert.equal(changes.length, 2);
});

test("Plan Tools tab state is immutable, no-op aware, and reset to Markers", () => {
  const session = new ViewportCompositionSession();
  const changes = [];
  session.subscribe((change) => changes.push(change));

  assert.equal(session.setToolShelfTab("marker"), false);
  assert.equal(session.setToolShelfTab("paint").type, "setToolShelfTab");
  assert.equal(session.setToolShelfTab("paint"), false);
  assert.equal(session.getSnapshot().toolShelfTab, "paint");
  assert.throws(() => (session.getSnapshot().toolShelfTab = "marker"), TypeError);
  assert.throws(
    () => session.setToolShelfTab("layers"),
    (error) => error instanceof ViewportError && error.code === "invalid_viewport_tool_shelf_tab"
  );
  session.showToolShelf();
  session.enterFocusMap();
  session.exitFocusMap();
  assert.equal(session.getSnapshot().toolShelfTab, "paint");
  session.reset();
  assert.equal(session.getSnapshot().toolShelfTab, "marker");
  assert.equal(changes.filter((change) => change.type === "setToolShelfTab").length, 1);
});

test("workspace reset preserves responsive classification and only opens selected context", () => {
  const session = new ViewportCompositionSession({ layoutClass: "narrow", short: true });
  session.setTask("plan");
  session.showInspector();
  session.showToolShelf();
  session.enterFocusMap();

  assert.equal(session.reset({ hasSelection: true }).type, "reset");
  assert.equal(session.getSnapshot().activeTask, "browse");
  assert.equal(session.getSnapshot().activeSubview, null);
  assert.equal(session.getSnapshot().focusMap, false);
  assert.equal(session.getSnapshot().layoutClass, "narrow");
  assert.equal(session.getSnapshot().short, true);
  assert.equal(session.getSnapshot().inspectorOpen, true);
  assert.equal(session.getSnapshot().toolShelfOpen, false);
  assert.equal(session.getSnapshot().toolShelfTab, "marker");
  assert.equal(session.getSnapshot().narrowActiveSheet, "inspector");

  session.reset();
  assert.equal(session.getSnapshot().inspectorOpen, false);
  assert.equal(session.getSnapshot().narrowActiveSheet, "dock");
  assert.equal(session.reset(), false);
});

test("inspector disclosure never mutates the canonical geographic selection", () => {
  const fixture = createScenarioFixture();
  const origin = createSelectionOrigin(fixture.contract);
  const selection = new SelectionSession(
    createSelectionCatalog({
      origin,
      towns: fixture.datasets.townFcsData,
      spawnAreas: fixture.datasets.spawnAreas,
      mapLocations: fixture.datasets.mapData
    })
  );
  selection.select({
    kind: "entity",
    entityType: "town",
    entityId: "town-base",
    instanceId: "marker-one",
    source: "map",
    origin
  });
  const retainedSelection = selection.getSelection();
  let selectionNotifications = 0;
  selection.subscribe(() => (selectionNotifications += 1));

  const viewport = new ViewportCompositionSession();
  viewport.showInspector();
  viewport.hideInspector();
  viewport.showInspector();
  viewport.setTask("plan");
  viewport.enterFocusMap();
  viewport.reset({ hasSelection: true });

  assert.strictEqual(selection.getSelection(), retainedSelection);
  assert.equal(selectionNotifications, 0);
  assert.equal(viewport.getSnapshot().inspectorOpen, true);
});

test("layout classification honors structural token boundaries", () => {
  assert.equal(
    VIEWPORT_WORKBENCH_TOKENS.leftDockWidth +
      VIEWPORT_WORKBENCH_TOKENS.minimumWideMapWidth +
      VIEWPORT_WORKBENCH_TOKENS.rightInspectorWidth +
      VIEWPORT_WORKBENCH_TOKENS.structuralGap * 2,
    VIEWPORT_WORKBENCH_TOKENS.wideMinimumWidth
  );
  assert.equal(
    VIEWPORT_WORKBENCH_TOKENS.leftDockWidth +
      VIEWPORT_WORKBENCH_TOKENS.minimumStandardMapWidth +
      VIEWPORT_WORKBENCH_TOKENS.structuralGap,
    VIEWPORT_WORKBENCH_TOKENS.standardMinimumWidth
  );
  assert.deepEqual(classifyViewportLayout(1320, 620), {
    layoutClass: "wide",
    phone: false,
    short: false
  });
  assert.deepEqual(classifyViewportLayout(1319, 619), {
    layoutClass: "standard",
    phone: false,
    short: true
  });
  assert.deepEqual(classifyViewportLayout(880, 800), {
    layoutClass: "standard",
    phone: false,
    short: false
  });
  assert.deepEqual(classifyViewportLayout(879, 800), {
    layoutClass: "narrow",
    phone: false,
    short: false
  });
  assert.deepEqual(classifyViewportLayout(600, 800), {
    layoutClass: "narrow", phone: false, short: false
  });
  assert.deepEqual(classifyViewportLayout(599, 800), {
    layoutClass: "narrow", phone: true, short: false
  });
  assert.deepEqual(classifyViewportLayout(667, 375, { phoneLandscapeEligible: true }), {
    layoutClass: "narrow", phone: true, short: true
  });
  assert.deepEqual(classifyViewportLayout(844, 390, { phoneLandscapeEligible: true }), {
    layoutClass: "narrow", phone: true, short: true
  });
  assert.deepEqual(classifyViewportLayout(880, 390, { phoneLandscapeEligible: true }), {
    layoutClass: "narrow", phone: true, short: true
  });
  assert.deepEqual(classifyViewportLayout(1024, 390, { phoneLandscapeEligible: true }), {
    layoutClass: "narrow", phone: true, short: true
  });
  assert.deepEqual(classifyViewportLayout(1025, 390, { phoneLandscapeEligible: true }), {
    layoutClass: "standard", phone: false, short: true
  });
  assert.deepEqual(classifyViewportLayout(667, 375), {
    layoutClass: "narrow", phone: false, short: true
  });
  assert.deepEqual(classifyViewportLayout(880, 390), {
    layoutClass: "standard", phone: false, short: true
  });
  assert.deepEqual(classifyViewportLayout(600, 800, { phoneLandscapeEligible: true }), {
    layoutClass: "narrow", phone: false, short: false
  });
  assert.throws(
    () => classifyViewportLayout(Number.NaN, 800),
    (error) => error.code === "invalid_viewport_dimension"
  );
});

test("phone landscape eligibility requires a coarse pointer and a phone-sized screen", () => {
  const device = (width, height, coarse) => ({
    screen: { width, height },
    matchMedia: () => ({ matches: coarse })
  });
  assert.equal(hasPhoneSizedTouchScreen(device(667, 375, true)), true);
  assert.equal(hasPhoneSizedTouchScreen(device(375, 667, true)), true);
  assert.equal(hasPhoneSizedTouchScreen(device(667, 375, false)), false);
  assert.equal(hasPhoneSizedTouchScreen(device(1024, 600, true)), false);
  assert.equal(hasPhoneSizedTouchScreen({ matchMedia: () => ({ matches: true }) }), false);
});

test("phone rotation retains the foreground and coalesces map resizing", () => {
  let observer;
  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback;
      observer = this;
    }

    observe() {}
    disconnect() {}
    emit(target, width, height) {
      this.callback([{ target, contentRect: { width, height } }]);
    }
  }
  const frames = [];
  let invalidations = 0;
  const map = {
    center: [12, 34],
    zoom: 2,
    invalidateSize() { invalidations += 1; }
  };
  const workbenchElement = {
    getBoundingClientRect: () => ({ width: 667, height: 375 })
  };
  const initialLayout = classifyViewportLayout(667, 375, { phoneLandscapeEligible: true });
  const session = new ViewportCompositionSession({ ...initialLayout, hasSelection: true });
  assert.equal(session.getSnapshot().phoneForeground, "map");
  const adapter = createViewportResizeAdapter({
    session,
    map,
    workbenchElement,
    phoneLandscapeScreen: () => true,
    ResizeObserverClass: FakeResizeObserver,
    requestFrame: (callback) => frames.push(callback),
    cancelFrame: () => {}
  });
  session.showInspector();
  observer.emit(workbenchElement, 375, 667);
  assert.equal(session.getSnapshot().phoneForeground, "inspector");
  observer.emit(workbenchElement, 667, 375);
  assert.equal(session.getSnapshot().phoneForeground, "inspector");
  assert.equal(session.getSnapshot().layoutClass, "narrow");
  assert.equal(session.getSnapshot().phone, true);
  assert.equal(session.getSnapshot().inspectorOpen, true);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(invalidations, 1);
  assert.deepEqual(map.center, [12, 34]);
  assert.equal(map.zoom, 2);
  adapter.disconnect();
});

test("phone foreground is exclusive, returns directly to map, and preserves desktop disclosure", () => {
  const session = new ViewportCompositionSession({
    ...classifyViewportLayout(390, 844), hasSelection: true
  });
  assert.equal(session.getSnapshot().phoneForeground, "map");
  assert.equal(session.getSnapshot().effective.inspectorVisible, false);
  session.showDock();
  assert.equal(session.getSnapshot().phoneForeground, "tasks");
  session.showInspector();
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: false, inspectorVisible: true, toolShelfVisible: false
  });
  session.openPhoneForeground("layersTray");
  session.openTransientSurface("worldViews");
  assert.equal(session.getSnapshot().phoneForeground, "worldViews");
  session.openPhoneForeground("reportsTray");
  assert.equal(session.getSnapshot().transientSurface, null);
  assert.equal(session.getSnapshot().phoneForeground, "reportsTray");
  session.closePhoneForeground();
  assert.equal(session.getSnapshot().phoneForeground, "map");
  assert.equal(session.getSnapshot().inspectorOpen, true);
  session.openPhoneForeground("scorecard");
  session.enterFocusMap();
  assert.equal(session.getSnapshot().phoneForeground, "map");
  session.exitFocusMap();
  session.openPhoneForeground("planTray");
  session.reset({ hasSelection: true });
  assert.equal(session.getSnapshot().phoneForeground, "map");
  assert.equal(session.getSnapshot().inspectorOpen, true);
  session.showInspector();
  session.setLayoutClass("narrow", false, false);
  assert.equal(session.getSnapshot().effective.inspectorVisible, true);
  session.setLayoutClass("narrow", false, true);
  assert.equal(session.getSnapshot().phoneForeground, "map");
  assert.equal(session.getSnapshot().effective.inspectorVisible, false);
  const returning = new ViewportCompositionSession({
    layoutClass: "narrow", dockOpen: false, inspectorOpen: true
  });
  returning.setLayoutClass("narrow", false, true);
  returning.showDock();
  returning.showInspector();
  returning.closePhoneForeground();
  returning.setLayoutClass("narrow", false, false);
  assert.equal(returning.getSnapshot().dockOpen, false);
  assert.equal(returning.getSnapshot().inspectorOpen, true);
  assert.equal(returning.getSnapshot().effective.inspectorVisible, true);
});

test("phone town card is exclusive and closes across routes and layout tiers", () => {
  const session = new ViewportCompositionSession({
    ...classifyViewportLayout(599, 650), hasSelection: true
  });
  session.openPhoneForeground("townCard");
  assert.equal(session.getSnapshot().phoneForeground, "townCard");
  assert.deepEqual(session.getSnapshot().effective, {
    dockVisible: false, inspectorVisible: false, toolShelfVisible: false
  });
  session.showInspector();
  assert.equal(session.getSnapshot().phoneForeground, "inspector");
  session.openPhoneForeground("townCard");
  session.closePhoneForeground();
  assert.equal(session.getSnapshot().phoneForeground, "map");
  session.openPhoneForeground("townCard");
  session.setLayoutClass("narrow", false, false);
  assert.equal(session.getSnapshot().phoneForeground, "map");
  assert.equal(session.getSnapshot().inspectorOpen, true);
  session.setLayoutClass("narrow", false, true);
  assert.equal(session.getSnapshot().phoneForeground, "map");
});

test("phone chooser returns to Layers tray without altering retained presentation", () => {
  const session = new ViewportCompositionSession(classifyViewportLayout(390, 844));
  assert.equal(session.returnPhoneLayerChooserToTray(), false);
  session.openPhoneForeground("layersTray");
  session.openTransientSurface("mapContent");
  assert.equal(session.getSnapshot().phoneForeground, "mapContent");
  assert.equal(session.returnPhoneLayerChooserToTray("worldViews"), false);
  session.returnPhoneLayerChooserToTray("mapContent");
  assert.equal(session.getSnapshot().phoneForeground, "layersTray");
  assert.equal(session.getSnapshot().transientSurface, null);
  session.openTransientSurface("worldViews");
  session.returnPhoneLayerChooserToTray("worldViews");
  assert.equal(session.getSnapshot().phoneForeground, "layersTray");
  session.closePhoneForeground();
  assert.equal(session.getSnapshot().phoneForeground, "map");
});

test("phone Inspector transparency is bounded, session-only, and resettable", () => {
  const session = new ViewportCompositionSession(classifyViewportLayout(390, 844));
  session.showInspector();
  session.setInspectorTransparencyOpen(true);
  session.setInspectorTransparency(70);
  assert.equal(session.setInspectorTransparency(70), false);
  assert.equal(session.getSnapshot().inspectorTransparencyOpen, true);
  assert.throws(() => session.setInspectorTransparency(71), ViewportError);
  assert.throws(() => session.setInspectorTransparency(0.5), ViewportError);
  session.openPhoneForeground("layersTray");
  assert.equal(session.getSnapshot().inspectorTransparencyOpen, false);
  assert.equal(session.getSnapshot().inspectorTransparency, 70);
  session.showInspector();
  session.setInspectorTransparencyOpen(true);
  session.setLayoutClass("narrow", false, false);
  assert.equal(session.getSnapshot().inspectorTransparencyOpen, false);
  assert.equal(session.getSnapshot().inspectorTransparency, 70);
  session.setLayoutClass("narrow", false, true);
  session.reset({ hasSelection: true });
  assert.equal(session.getSnapshot().inspectorTransparency, 0);
  assert.equal(session.getSnapshot().inspectorTransparencyOpen, false);
});

test("resize adapter classifies the workbench and coalesces Leaflet invalidation", () => {
  class FakeResizeObserver {
    static instances = [];

    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      FakeResizeObserver.instances.push(this);
    }

    observe(target) {
      this.observed.push(target);
    }

    disconnect() {
      this.disconnected = true;
    }

    emit(entries) {
      this.callback(entries);
    }
  }

  const frames = new Map();
  let nextFrame = 1;
  const requestFrame = (callback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, callback);
    return id;
  };
  const cancelFrame = (id) => frames.delete(id);
  const flushFrames = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback();
  };

  const session = new ViewportCompositionSession();
  const workbenchElement = {
    getBoundingClientRect: () => ({ width: 1200, height: 600 })
  };
  const mapElement = {};
  let invalidations = 0;
  const map = {
    invalidateSize(options) {
      invalidations += 1;
      assert.deepEqual(options, { pan: false, animate: false });
    }
  };

  const adapter = createViewportResizeAdapter({
    session,
    map,
    workbenchElement,
    mapElement,
    ResizeObserverClass: FakeResizeObserver,
    requestFrame,
    cancelFrame
  });
  assert.equal(session.getSnapshot().layoutClass, "standard");
  assert.equal(session.getSnapshot().short, true);
  assert.deepEqual(FakeResizeObserver.instances[0].observed, [workbenchElement, mapElement]);
  assert.equal(frames.size, 1);

  session.showInspector();
  session.enterFocusMap();
  adapter.schedule();
  assert.equal(frames.size, 1);
  flushFrames();
  assert.equal(invalidations, 1);

  FakeResizeObserver.instances[0].emit([
    { target: workbenchElement, contentRect: { width: 1400, height: 700 } },
    { target: mapElement, contentRect: { width: 700, height: 700 } }
  ]);
  assert.equal(session.getSnapshot().layoutClass, "wide");
  assert.equal(session.getSnapshot().short, false);
  assert.equal(frames.size, 1);
  flushFrames();
  assert.equal(invalidations, 2);

  FakeResizeObserver.instances[0].emit([
    { target: workbenchElement, contentRect: { width: 599, height: 650 } }
  ]);
  assert.equal(session.getSnapshot().phone, true);
  assert.equal(session.getSnapshot().phoneForeground, "map");
  flushFrames();
  FakeResizeObserver.instances[0].emit([
    { target: workbenchElement, contentRect: { width: 600, height: 650 } }
  ]);
  assert.equal(session.getSnapshot().phone, false);
  assert.equal(session.getSnapshot().layoutClass, "narrow");
  flushFrames();

  assert.throws(
    () =>
      createViewportResizeAdapter({
        session,
        map,
        workbenchElement,
        ResizeObserverClass: FakeResizeObserver,
        requestFrame,
        cancelFrame
      }),
    (error) => error.code === "viewport_resize_adapter_exists"
  );

  session.hideInspector();
  assert.equal(frames.size, 1);
  assert.equal(adapter.disconnect(), true);
  assert.equal(frames.size, 0);
  assert.equal(FakeResizeObserver.instances[0].disconnected, true);
  assert.equal(adapter.disconnect(), false);
  session.showInspector();
  assert.equal(frames.size, 0);
});

test("Escape coordinator dismisses only the highest active presentation surface", () => {
  const active = { theater: true, transient: true, tool: true, popup: true };
  const dismissed = [];
  const domainState = Object.freeze({ commandCount: 2, markerCount: 3, paintCount: 4 });
  const coordinator = createEscapeCoordinator(
    Object.fromEntries(
      Object.keys(active).map((surface) => [
        surface,
        {
          isActive: () => active[surface],
          dismiss: () => {
            active[surface] = false;
            dismissed.push(surface);
          }
        }
      ])
    )
  );

  assert.equal(coordinator.dismiss(), "theater");
  assert.deepEqual(dismissed, ["theater"]);
  assert.equal(coordinator.dismiss(), "transient");
  assert.equal(coordinator.dismiss(), "tool");
  assert.equal(coordinator.dismiss(), "popup");
  assert.equal(coordinator.dismiss(), null);
  assert.deepEqual(domainState, { commandCount: 2, markerCount: 3, paintCount: 4 });

  active.popup = true;
  let prevented = 0;
  let stopped = 0;
  assert.equal(
    coordinator.handleKeydown({
      key: "Escape",
      defaultPrevented: false,
      preventDefault: () => (prevented += 1),
      stopPropagation: () => (stopped += 1)
    }),
    "popup"
  );
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  assert.equal(coordinator.handleKeydown({ key: "Enter", defaultPrevented: false }), false);
  assert.equal(coordinator.handleKeydown({ key: "Escape", defaultPrevented: true }), false);
});
