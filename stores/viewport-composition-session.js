import { deepFreeze, isRecord } from "../modules/scenario/utils.js";
import { ViewportError } from "../modules/viewport/errors.js";
import { VIEWPORT_LAYOUTS } from "../modules/viewport/layout.js";
import { LAYER_CONFIGURATION_TARGETS } from "../modules/viewport/layers-presentation.js";
import { WORLD_VIEW_GROUP_DEFAULTS } from "../modules/viewport/layer-chooser-groups.js";
import {
  REPORT_SUBJECT_IDS,
  RELATION_REPORT_FILTERS
} from "../modules/viewport/reporting-policy.js";

const INTERNALS = new WeakMap();

export const VIEWPORT_TASKS = Object.freeze(["browse", "simulate", "plan"]);
export const VIEWPORT_SUBVIEWS = Object.freeze([
  "favorites",
  "relationsJournal",
  "layerConfiguration",
  "factionColors"
]);
export const VIEWPORT_TOOL_SHELF_TABS = Object.freeze(["marker", "paint"]);
export const VIEWPORT_BROWSE_MODES = Object.freeze(["context", "content"]);
export const POLITICAL_TOOLTIP_MODES = Object.freeze(["reduced", "full", "hidden"]);
const HUD_MODES = Object.freeze(["scanner", "scorecard"]);
const HUD_ANCHORS = Object.freeze(["left", "right"]);
const CURSOR_CONTROL_VIEWS = Object.freeze(["tooltips", "pointProbe"]);
const REPORT_PLACEMENTS = Object.freeze(["anchored", "bottomCenter"]);

function requireChoice(value, choices, label) {
  if (!choices.includes(value))
    throw new ViewportError("invalid_viewport_state", `Invalid ${label}.`);
  return value;
}
export const VIEWPORT_CONTEXT_ROUTES = Object.freeze([
  "dashboard",
  "keyCharacters",
  "bountyTargets",
  "deadlyAnimals",
  "fancyWeaponWielders",
  "treasureHunting",
  "shoppingList",
  "treasureSpots",
  "nestTreasures",
  "narcotics",
  "prospecting",
  "factionOverview"
]);
const CONTEXT_ROUTE_PARENT = Object.freeze({
  keyCharacters: "dashboard",
  bountyTargets: "dashboard",
  deadlyAnimals: "dashboard",
  fancyWeaponWielders: "treasureHunting",
  treasureHunting: "dashboard",
  shoppingList: "dashboard",
  treasureSpots: "treasureHunting",
  nestTreasures: "treasureHunting",
  narcotics: "shoppingList",
  prospecting: "dashboard",
  factionOverview: "dashboard"
});
export const VIEWPORT_TRANSIENT_SURFACES = Object.freeze([
  "mapContent",
  "worldViews",
  "cursorControls",
  "paintIcons"
]);
export const PHONE_FOREGROUNDS = Object.freeze([
  "map", "townCard", "tasks", "inspector", "layersTray", "mapContent", "worldViews",
  "planTray", "reportsTray", "reportSettings", "scorecard"
]);

function requirePhoneForeground(value) {
  return requireChoice(value, PHONE_FOREGROUNDS, "phone foreground");
}

const SUBVIEW_TASK = Object.freeze({
  favorites: "browse",
  relationsJournal: "simulate",
  layerConfiguration: "plan",
  factionColors: "plan"
});

function requireLayerConfigurationTarget(value, subview) {
  if (
    value !== null &&
    (subview !== "layerConfiguration" || !LAYER_CONFIGURATION_TARGETS.includes(value))
  ) {
    throw new ViewportError(
      "invalid_layer_configuration_target",
      "Only Layer Configuration may target the roads, borders, or debugGrid section."
    );
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new ViewportError("invalid_viewport_state", `${label} must be a boolean.`);
  }
  return value;
}

function requireInspectorTransparency(value) {
  if (!Number.isInteger(value) || value < 0 || value > 70) {
    throw new ViewportError(
      "invalid_viewport_state",
      "Inspector transparency must be an integer from 0 to 70."
    );
  }
  return value;
}

function normalizeWorldViewGroups(value = {}) {
  if (
    !isRecord(value) ||
    Object.keys(value).some((id) => !Object.hasOwn(WORLD_VIEW_GROUP_DEFAULTS, id))
  ) {
    throw new ViewportError("invalid_viewport_state", "Invalid World Views groups.");
  }
  return Object.fromEntries(
    Object.entries(WORLD_VIEW_GROUP_DEFAULTS).map(([id, expanded]) => [
      id,
      requireBoolean(value[id] ?? expanded, `${id} group expanded`)
    ])
  );
}

function requireSearch(value) {
  if (typeof value !== "string")
    throw new ViewportError("invalid_viewport_state", "Faction widget search must be text.");
  return value;
}

function requireTask(value) {
  if (!VIEWPORT_TASKS.includes(value)) {
    throw new ViewportError(
      "invalid_viewport_task",
      `Viewport task must be one of: ${VIEWPORT_TASKS.join(", ")}.`,
      { task: value }
    );
  }
  return value;
}

function requireSubview(value) {
  if (!VIEWPORT_SUBVIEWS.includes(value)) {
    throw new ViewportError(
      "invalid_viewport_subview",
      `Viewport subview must be one of: ${VIEWPORT_SUBVIEWS.join(", ")}.`,
      { subview: value }
    );
  }
  return value;
}

function requireLayoutClass(value) {
  if (!VIEWPORT_LAYOUTS.includes(value)) {
    throw new ViewportError(
      "invalid_viewport_layout",
      `Viewport layout must be one of: ${VIEWPORT_LAYOUTS.join(", ")}.`,
      { layoutClass: value }
    );
  }
  return value;
}

function requireToolShelfTab(value) {
  if (!VIEWPORT_TOOL_SHELF_TABS.includes(value)) {
    throw new ViewportError(
      "invalid_viewport_tool_shelf_tab",
      `Plan Tools tab must be one of: ${VIEWPORT_TOOL_SHELF_TABS.join(", ")}.`,
      { toolShelfTab: value }
    );
  }
  return value;
}

function requireBrowseMode(value) {
  if (!VIEWPORT_BROWSE_MODES.includes(value)) {
    throw new ViewportError(
      "invalid_browse_mode",
      `Browse mode must be one of: ${VIEWPORT_BROWSE_MODES.join(", ")}.`
    );
  }
  return value;
}

function requireContextRoute(value) {
  if (!VIEWPORT_CONTEXT_ROUTES.includes(value)) {
    throw new ViewportError(
      "invalid_context_route",
      `Context route must be one of: ${VIEWPORT_CONTEXT_ROUTES.join(", ")}.`
    );
  }
  return value;
}

function requireTransientSurface(value) {
  if (!VIEWPORT_TRANSIENT_SURFACES.includes(value)) {
    throw new ViewportError(
      "invalid_viewport_transient_surface",
      `Transient surface must be one of: ${VIEWPORT_TRANSIENT_SURFACES.join(", ")}.`,
      { transientSurface: value }
    );
  }
  return value;
}

function normalizeInitialState(options = {}) {
  if (!isRecord(options)) {
    throw new ViewportError(
      "invalid_viewport_defaults",
      "Viewport composition defaults must be an object."
    );
  }

  const activeTask = requireTask(options.activeTask ?? options.task ?? "browse");
  const activeSubview = options.activeSubview ?? options.subview ?? null;
  if (activeSubview !== null) {
    requireSubview(activeSubview);
    if (SUBVIEW_TASK[activeSubview] !== activeTask) {
      throw new ViewportError(
        "invalid_viewport_subview",
        `Subview '${activeSubview}' belongs to the '${SUBVIEW_TASK[activeSubview]}' task.`,
        { activeTask, activeSubview }
      );
    }
  }

  const layoutClass = requireLayoutClass(options.layoutClass ?? "wide");
  const short = requireBoolean(options.short ?? false, "short");
  const phone = requireBoolean(options.phone ?? false, "phone");
  const dockOpen = requireBoolean(options.dockOpen ?? true, "dockOpen");
  const inspectorOpen = requireBoolean(
    options.inspectorOpen ?? options.hasSelection ?? false,
    "inspectorOpen"
  );
  const toolShelfOpen = requireBoolean(options.toolShelfOpen ?? false, "toolShelfOpen");
  const toolShelfTab = requireToolShelfTab(options.toolShelfTab ?? "marker");
  const pointContextVisible = requireBoolean(
    options.pointContextVisible ?? true,
    "pointContextVisible"
  );
  const browseMode = requireBrowseMode(options.browseMode ?? "context");
  const contextRoute = requireContextRoute(options.contextRoute ?? "dashboard");
  const layerConfigurationTarget = requireLayerConfigurationTarget(
    options.layerConfigurationTarget ?? null,
    activeSubview
  );
  const focusMap = requireBoolean(options.focusMap ?? false, "focusMap");
  const transientSurface = options.transientSurface ?? null;
  if (transientSurface !== null) requireTransientSurface(transientSurface);

  const initial = settleNarrowTransient(
      {},
      {
        activeTask,
        activeSubview,
        dockOpen,
        inspectorOpen,
        toolShelfOpen,
        toolShelfTab,
        pointContextVisible,
        hudMode: requireChoice(options.hudMode ?? "scanner", HUD_MODES, "widget mode"),
        hudAnchor: requireChoice(options.hudAnchor ?? "right", HUD_ANCHORS, "widget anchor"),
        scannerExpanded: requireBoolean(options.scannerExpanded ?? false, "scannerExpanded"),
        scorecardExpanded: requireBoolean(options.scorecardExpanded ?? false, "scorecardExpanded"),
        politicalTooltipMode: requireChoice(
          options.politicalTooltipMode ?? "reduced",
          POLITICAL_TOOLTIP_MODES,
          "political tooltip mode"
        ),
        politicalProbeExpanded: requireBoolean(
          options.politicalProbeExpanded ?? true,
          "politicalProbeExpanded"
        ),
        tooltipSubject: requireChoice(
          options.tooltipSubject ?? "political",
          REPORT_SUBJECT_IDS,
          "tooltip subject"
        ),
        pointProbeSubject: requireChoice(
          options.pointProbeSubject ?? "political",
          REPORT_SUBJECT_IDS,
          "point probe subject"
        ),
        tooltipPlacement: requireChoice(
          options.tooltipPlacement ?? "anchored",
          REPORT_PLACEMENTS,
          "tooltip placement"
        ),
        pointProbePlacement: requireChoice(
          options.pointProbePlacement ?? "anchored",
          REPORT_PLACEMENTS,
          "point probe placement"
        ),
        resourcesTooltipMode: requireChoice(
          options.resourcesTooltipMode ?? "reduced",
          POLITICAL_TOOLTIP_MODES,
          "resources tooltip mode"
        ),
        weatherTooltipMode: requireChoice(
          options.weatherTooltipMode ?? "reduced",
          POLITICAL_TOOLTIP_MODES,
          "weather tooltip mode"
        ),
        resourcesProbeExpanded: requireBoolean(
          options.resourcesProbeExpanded ?? true,
          "resourcesProbeExpanded"
        ),
        weatherProbeExpanded: requireBoolean(
          options.weatherProbeExpanded ?? true,
          "weatherProbeExpanded"
        ),
        ...Object.fromEntries(
          ["relations", "squadPresence"].flatMap((subject) => [
            [
              `${subject}TooltipMode`,
              requireChoice(
                options[`${subject}TooltipMode`] ?? "reduced",
                POLITICAL_TOOLTIP_MODES,
                "tooltip mode"
              )
            ],
            [
              `${subject}ProbeExpanded`,
              requireBoolean(options[`${subject}ProbeExpanded`] ?? true, "probe expanded")
            ]
          ])
        ),
        relationsProbeHidden: requireBoolean(
          options.relationsProbeHidden ?? false,
          "relations probe hidden"
        ),
        relationsTooltipFilter: requireChoice(
          options.relationsTooltipFilter ?? "alliesEnemies",
          RELATION_REPORT_FILTERS,
          "relations filter"
        ),
        relationsProbeFilter: requireChoice(
          options.relationsProbeFilter ?? "alliesEnemies",
          RELATION_REPORT_FILTERS,
          "relations filter"
        ),
        cursorControlsView: requireChoice(
          options.cursorControlsView ?? "tooltips",
          CURSOR_CONTROL_VIEWS,
          "cursor controls view"
        ),
        factionColorsWidgetOpen: false,
        factionColorsWidgetSearchOpen: false,
        factionColorsWidgetSearch: "",
        browseMode,
        contextRoute,
        layerConfigurationTarget,
        worldViewGroupsExpanded: normalizeWorldViewGroups(options.worldViewGroupsExpanded),
        focusMap,
        layoutClass,
        short,
        phone,
        phoneForeground: requirePhoneForeground(options.phoneForeground ?? "map"),
        inspectorTransparency: requireInspectorTransparency(options.inspectorTransparency ?? 0),
        inspectorTransparencyOpen: requireBoolean(
          options.inspectorTransparencyOpen ?? false,
          "inspector transparency disclosure"
        ),
        transientSurface,
        narrowActiveSheet:
          layoutClass === "narrow" ? (inspectorOpen ? "inspector" : dockOpen ? "dock" : null) : null
      }
  );
  return deepFreeze(settlePhoneInspector(initial));
}

function effectiveVisibility(state) {
  if (state.focusMap) {
    return { dockVisible: false, inspectorVisible: false, toolShelfVisible: false };
  }
  if (state.phone) {
    return {
      dockVisible: state.phoneForeground === "tasks",
      inspectorVisible: state.phoneForeground === "inspector",
      toolShelfVisible: state.phoneForeground === "planTray"
    };
  }
  if (state.layoutClass === "narrow") {
    return {
      dockVisible: state.dockOpen && state.narrowActiveSheet === "dock",
      inspectorVisible: state.inspectorOpen && state.narrowActiveSheet === "inspector",
      toolShelfVisible: state.toolShelfOpen
    };
  }
  return {
    dockVisible: state.dockOpen,
    inspectorVisible: state.inspectorOpen,
    toolShelfVisible: state.toolShelfOpen
  };
}

function createSnapshot(state) {
  return deepFreeze({ ...state, effective: effectiveVisibility(state) });
}

function sameState(left, right) {
  return (
    left.activeTask === right.activeTask &&
    left.activeSubview === right.activeSubview &&
    left.dockOpen === right.dockOpen &&
    left.inspectorOpen === right.inspectorOpen &&
    left.toolShelfOpen === right.toolShelfOpen &&
    left.toolShelfTab === right.toolShelfTab &&
    left.pointContextVisible === right.pointContextVisible &&
    left.hudMode === right.hudMode &&
    left.hudAnchor === right.hudAnchor &&
    left.scannerExpanded === right.scannerExpanded &&
    left.scorecardExpanded === right.scorecardExpanded &&
    left.politicalTooltipMode === right.politicalTooltipMode &&
    left.politicalProbeExpanded === right.politicalProbeExpanded &&
    left.tooltipSubject === right.tooltipSubject &&
    left.pointProbeSubject === right.pointProbeSubject &&
    left.tooltipPlacement === right.tooltipPlacement &&
    left.pointProbePlacement === right.pointProbePlacement &&
    left.resourcesTooltipMode === right.resourcesTooltipMode &&
    left.weatherTooltipMode === right.weatherTooltipMode &&
    left.resourcesProbeExpanded === right.resourcesProbeExpanded &&
    left.weatherProbeExpanded === right.weatherProbeExpanded &&
    left.relationsTooltipMode === right.relationsTooltipMode &&
    left.squadPresenceTooltipMode === right.squadPresenceTooltipMode &&
    left.relationsProbeExpanded === right.relationsProbeExpanded &&
    left.squadPresenceProbeExpanded === right.squadPresenceProbeExpanded &&
    left.relationsProbeHidden === right.relationsProbeHidden &&
    left.relationsTooltipFilter === right.relationsTooltipFilter &&
    left.relationsProbeFilter === right.relationsProbeFilter &&
    left.cursorControlsView === right.cursorControlsView &&
    left.factionColorsWidgetOpen === right.factionColorsWidgetOpen &&
    left.factionColorsWidgetSearchOpen === right.factionColorsWidgetSearchOpen &&
    left.factionColorsWidgetSearch === right.factionColorsWidgetSearch &&
    left.browseMode === right.browseMode &&
    left.contextRoute === right.contextRoute &&
    left.layerConfigurationTarget === right.layerConfigurationTarget &&
    Object.keys(WORLD_VIEW_GROUP_DEFAULTS).every(
      (id) => left.worldViewGroupsExpanded[id] === right.worldViewGroupsExpanded[id]
    ) &&
    left.focusMap === right.focusMap &&
    left.layoutClass === right.layoutClass &&
    left.short === right.short &&
    left.phone === right.phone &&
    left.phoneForeground === right.phoneForeground &&
    left.inspectorTransparency === right.inspectorTransparency &&
    left.inspectorTransparencyOpen === right.inspectorTransparencyOpen &&
    left.transientSurface === right.transientSurface &&
    left.narrowActiveSheet === right.narrowActiveSheet
  );
}

function notify(session, type) {
  const internal = INTERNALS.get(session);
  const change = deepFreeze({ type, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // A presentation adapter cannot roll back an already committed composition change.
    }
  }
  return change;
}

function commit(session, type, update) {
  const internal = INTERNALS.get(session);
  const nextState = deepFreeze(
    settlePhoneInspector(settleNarrowTransient(internal.state, update({ ...internal.state })))
  );
  if (sameState(internal.state, nextState)) return false;
  internal.state = nextState;
  internal.snapshot = createSnapshot(nextState);
  return notify(session, type);
}

function settlePhoneInspector(state) {
  if (state.phone && state.phoneForeground === "inspector" && !state.focusMap) return state;
  return state.inspectorTransparencyOpen
    ? { ...state, inspectorTransparencyOpen: false }
    : state;
}

function isSheetExclusiveSurface(surface) {
  return surface === "mapContent" || surface === "worldViews" || surface === "cursorControls";
}

function settleNarrowTransient(previous, state) {
  if (state.phone) {
    if (["mapContent", "worldViews", "cursorControls"].includes(state.transientSurface)) {
      if (previous.phoneForeground !== state.phoneForeground &&
          previous.transientSurface === state.transientSurface)
        return { ...state, transientSurface: null };
      return { ...state, phoneForeground: state.transientSurface === "cursorControls"
        ? "reportSettings" : state.transientSurface };
    }
    if (["mapContent", "worldViews", "reportSettings"].includes(state.phoneForeground))
      return { ...state, phoneForeground: "map" };
    return state;
  }
  if (state.layoutClass !== "narrow" || !isSheetExclusiveSurface(state.transientSurface))
    return state;
  if (previous.layoutClass !== "narrow" || previous.transientSurface !== state.transientSurface) {
    // Resizing an open chooser or settings panel into narrow uses the same sheet handoff.
    return { ...state, dockOpen: false, inspectorOpen: false, narrowActiveSheet: null };
  }
  if (state.narrowActiveSheet !== null) {
    // An explicit sheet-opening action hands off from the transient.
    return { ...state, transientSurface: null };
  }
  return state;
}

function fallbackNarrowSheet(state) {
  if (state.inspectorOpen) return "inspector";
  if (state.dockOpen) return "dock";
  return null;
}

export class ViewportCompositionSession {
  constructor(options = {}) {
    const state = normalizeInitialState(options);
    INTERNALS.set(this, {
      state,
      snapshot: createSnapshot(state),
      subscribers: new Set()
    });
  }

  setTask(task) {
    requireTask(task);
    return commit(this, "setTask", (state) => ({
      ...state,
      activeTask: task,
      activeSubview: null,
      layerConfigurationTarget: null,
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  setHudMode(hudMode) {
    requireChoice(hudMode, HUD_MODES, "widget mode");
    return commit(this, "setHudMode", (state) => ({ ...state, hudMode }));
  }

  setHudAnchor(hudAnchor) {
    requireChoice(hudAnchor, HUD_ANCHORS, "widget anchor");
    return commit(this, "setHudAnchor", (state) => ({ ...state, hudAnchor }));
  }

  setHudExpanded(mode, expanded) {
    requireChoice(mode, HUD_MODES, "widget mode");
    requireBoolean(expanded, "expanded");
    return commit(this, "setHudExpanded", (state) => ({ ...state, [`${mode}Expanded`]: expanded }));
  }

  activatePoliticalReports() {
    return commit(this, "activatePoliticalReports", (state) => ({
      ...state,
      hudMode: "scorecard",
      scorecardExpanded: true
    }));
  }

  setPoliticalTooltipMode(mode) {
    requireChoice(mode, POLITICAL_TOOLTIP_MODES, "political tooltip mode");
    return commit(this, "setPoliticalTooltipMode", (state) => ({
      ...state,
      politicalTooltipMode: mode
    }));
  }

  setPoliticalProbeExpanded(expanded) {
    requireBoolean(expanded, "politicalProbeExpanded");
    return commit(this, "setPoliticalProbeExpanded", (state) => ({
      ...state,
      politicalProbeExpanded: expanded
    }));
  }

  setCursorControlsView(cursorControlsView) {
    requireChoice(cursorControlsView, CURSOR_CONTROL_VIEWS, "cursor controls view");
    return commit(this, "setCursorControlsView", (state) => ({ ...state, cursorControlsView }));
  }

  setFactionColorsWidgetOpen(open) {
    requireBoolean(open, "factionColorsWidgetOpen");
    return commit(this, "setFactionColorsWidgetOpen", (state) => ({
      ...state,
      factionColorsWidgetOpen: open
    }));
  }

  setFactionColorsWidgetSearchOpen(open) {
    requireBoolean(open, "factionColorsWidgetSearchOpen");
    return commit(this, "setFactionColorsWidgetSearchOpen", (state) => ({
      ...state,
      factionColorsWidgetSearchOpen: open,
      factionColorsWidgetSearch: open ? state.factionColorsWidgetSearch : ""
    }));
  }

  setFactionColorsWidgetSearch(search) {
    requireSearch(search);
    return commit(this, "setFactionColorsWidgetSearch", (state) => ({
      ...state,
      factionColorsWidgetSearch: search,
      factionColorsWidgetSearchOpen: true
    }));
  }

  setReportingSubject(view, subject) {
    requireChoice(view, CURSOR_CONTROL_VIEWS, "reporting view");
    requireChoice(subject, REPORT_SUBJECT_IDS, "reporting subject");
    return commit(this, "setReportingSubject", (state) => ({
      ...state,
      [view === "tooltips" ? "tooltipSubject" : "pointProbeSubject"]: subject
    }));
  }

  setReportTooltipMode(subject, mode) {
    requireChoice(subject, REPORT_SUBJECT_IDS, "reporting subject");
    if (subject === "political") return this.setPoliticalTooltipMode(mode);
    requireChoice(mode, POLITICAL_TOOLTIP_MODES, "tooltip mode");
    return commit(this, "setReportTooltipMode", (state) => ({
      ...state,
      [`${subject}TooltipMode`]: mode
    }));
  }

  setReportPlacement(view, placement) {
    requireChoice(view, CURSOR_CONTROL_VIEWS, "reporting view");
    requireChoice(placement, REPORT_PLACEMENTS, "report placement");
    return commit(this, "setReportPlacement", (state) => ({
      ...state,
      [view === "tooltips" ? "tooltipPlacement" : "pointProbePlacement"]: placement
    }));
  }

  setReportProbeExpanded(subject, expanded) {
    requireChoice(subject, REPORT_SUBJECT_IDS, "reporting subject");
    if (subject === "political") return this.setPoliticalProbeExpanded(expanded);
    requireBoolean(expanded, "probe expanded");
    return commit(this, "setReportProbeExpanded", (state) => ({
      ...state,
      [`${subject}ProbeExpanded`]: expanded
    }));
  }

  setRelationsReportFilter(view, filter) {
    requireChoice(view, CURSOR_CONTROL_VIEWS, "reporting view");
    requireChoice(filter, RELATION_REPORT_FILTERS, "relations filter");
    return commit(this, "setRelationsReportFilter", (state) => ({
      ...state,
      [view === "tooltips" ? "relationsTooltipFilter" : "relationsProbeFilter"]: filter
    }));
  }

  setRelationsProbeMode(mode) {
    requireChoice(mode, ["expanded", "collapsed", "hidden"], "relations probe mode");
    return commit(this, "setRelationsProbeMode", (state) => ({
      ...state,
      relationsProbeHidden: mode === "hidden",
      relationsProbeExpanded: mode === "hidden" ? state.relationsProbeExpanded : mode === "expanded"
    }));
  }

  setBrowseMode(browseMode) {
    requireBrowseMode(browseMode);
    return commit(this, "setBrowseMode", (state) => ({
      ...state,
      activeTask: "browse",
      activeSubview: null,
      browseMode,
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  openContextSubject(contextRoute) {
    requireContextRoute(contextRoute);
    if (contextRoute === "dashboard") return this.backToContextDashboard();
    return commit(this, "openContextSubject", (state) => ({
      ...state,
      activeTask: "browse",
      activeSubview: null,
      browseMode: "context",
      contextRoute,
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  openContextRoute(contextRoute) {
    return this.openContextSubject(contextRoute);
  }

  backContextRoute() {
    return commit(this, "backContextRoute", (state) => ({
      ...state,
      activeTask: "browse",
      activeSubview: null,
      browseMode: "context",
      contextRoute: CONTEXT_ROUTE_PARENT[state.contextRoute] ?? "dashboard",
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  backToContextDashboard() {
    return commit(this, "backToContextDashboard", (state) => ({
      ...state,
      activeTask: "browse",
      activeSubview: null,
      browseMode: "context",
      contextRoute: "dashboard",
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  openSubview(subview, layerConfigurationTarget = null) {
    requireSubview(subview);
    requireLayerConfigurationTarget(layerConfigurationTarget, subview);
    return commit(this, "openSubview", (state) => ({
      ...state,
      activeTask: SUBVIEW_TASK[subview],
      activeSubview: subview,
      layerConfigurationTarget,
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  back() {
    return commit(this, "back", (state) => {
      if (state.activeSubview === null) return state;
      return {
        ...state,
        activeSubview: null,
        layerConfigurationTarget: null,
        dockOpen: state.phone ? state.dockOpen : true,
        narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
      };
    });
  }

  showDock() {
    return commit(this, "showDock", (state) => ({
      ...state,
      dockOpen: state.phone ? state.dockOpen : true,
      phoneForeground: state.phone ? "tasks" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "dock" : null
    }));
  }

  hideDock() {
    return commit(this, "hideDock", (state) => ({
      ...state,
      dockOpen: state.phone ? state.dockOpen : false,
      phoneForeground: state.phone ? "map" : state.phoneForeground,
      narrowActiveSheet:
        state.phone ? state.narrowActiveSheet :
        state.layoutClass === "narrow" && state.narrowActiveSheet === "dock"
          ? state.inspectorOpen
            ? "inspector"
            : null
          : state.narrowActiveSheet
    }));
  }

  toggleDock() {
    return this.getSnapshot().dockOpen ? this.hideDock() : this.showDock();
  }

  showInspector() {
    return commit(this, "showInspector", (state) => ({
      ...state,
      inspectorOpen: state.phone ? state.inspectorOpen : true,
      phoneForeground: state.phone ? "inspector" : state.phoneForeground,
      narrowActiveSheet: state.phone ? state.narrowActiveSheet : state.layoutClass === "narrow" ? "inspector" : null
    }));
  }

  hideInspector() {
    return commit(this, "hideInspector", (state) => ({
      ...state,
      inspectorOpen: state.phone ? state.inspectorOpen : false,
      phoneForeground: state.phone ? "map" : state.phoneForeground,
      narrowActiveSheet:
        state.phone ? state.narrowActiveSheet :
        state.layoutClass === "narrow" && state.narrowActiveSheet === "inspector"
          ? state.dockOpen
            ? "dock"
            : null
          : state.narrowActiveSheet
    }));
  }

  showToolShelf() {
    return commit(this, "showToolShelf", (state) => ({
      ...state, toolShelfOpen: true,
      phoneForeground: state.phone ? "planTray" : state.phoneForeground
    }));
  }

  hideToolShelf() {
    return commit(this, "hideToolShelf", (state) => ({
      ...state,
      toolShelfOpen: false,
      phoneForeground: state.phone ? "map" : state.phoneForeground,
      transientSurface: state.transientSurface === "paintIcons" ? null : state.transientSurface
    }));
  }

  setToolShelfTab(toolShelfTab) {
    requireToolShelfTab(toolShelfTab);
    return commit(this, "setToolShelfTab", (state) => ({
      ...state,
      toolShelfTab,
      transientSurface:
        toolShelfTab !== "paint" && state.transientSurface === "paintIcons"
          ? null
          : state.transientSurface
    }));
  }

  openTransientSurface(transientSurface) {
    requireTransientSurface(transientSurface);
    return commit(this, "openTransientSurface", (state) => ({ ...state, transientSurface }));
  }

  openPhoneForeground(phoneForeground) {
    requirePhoneForeground(phoneForeground);
    return commit(this, "openPhoneForeground", (state) => ({
      ...state,
      phoneForeground: state.phone ? phoneForeground : state.phoneForeground,
      transientSurface: state.phone && !["mapContent", "worldViews"].includes(phoneForeground)
        ? null : state.transientSurface
    }));
  }

  closePhoneForeground() {
    return this.openPhoneForeground("map");
  }

  returnPhoneLayerChooserToTray(surface = null) {
    if (surface !== null) requireChoice(surface, ["mapContent", "worldViews"], "layer chooser");
    return commit(this, "returnPhoneLayerChooserToTray", (state) => {
      if (!state.phone || !["mapContent", "worldViews"].includes(state.phoneForeground) ||
          (surface !== null && state.phoneForeground !== surface)) return state;
      return { ...state, phoneForeground: "layersTray", transientSurface: null };
    });
  }

  setInspectorTransparency(value) {
    requireInspectorTransparency(value);
    return commit(this, "setInspectorTransparency", (state) => ({
      ...state,
      inspectorTransparency: value
    }));
  }

  setInspectorTransparencyOpen(open) {
    requireBoolean(open, "inspector transparency disclosure");
    return commit(this, "setInspectorTransparencyOpen", (state) => ({
      ...state,
      inspectorTransparencyOpen: open
    }));
  }

  setWorldViewGroupExpanded(id, expanded) {
    requireChoice(id, Object.keys(WORLD_VIEW_GROUP_DEFAULTS), "World Views group");
    requireBoolean(expanded, "World Views group expanded");
    return commit(this, "setWorldViewGroupExpanded", (state) => ({
      ...state,
      worldViewGroupsExpanded: { ...state.worldViewGroupsExpanded, [id]: expanded }
    }));
  }

  closeTransientSurface(transientSurface = null) {
    if (transientSurface !== null) requireTransientSurface(transientSurface);
    return commit(this, "closeTransientSurface", (state) => {
      if (transientSurface !== null && state.transientSurface !== transientSurface) return state;
      return { ...state, transientSurface: null };
    });
  }

  toggleTransientSurface(transientSurface) {
    requireTransientSurface(transientSurface);
    return commit(this, "toggleTransientSurface", (state) => ({
      ...state,
      transientSurface: state.transientSurface === transientSurface ? null : transientSurface
    }));
  }

  showPointContext() {
    return commit(this, "showPointContext", (state) => ({
      ...state,
      pointContextVisible: true
    }));
  }

  hidePointContext() {
    return commit(this, "hidePointContext", (state) => ({
      ...state,
      pointContextVisible: false
    }));
  }

  togglePointContext() {
    return commit(this, "togglePointContext", (state) => ({
      ...state,
      pointContextVisible: !state.pointContextVisible
    }));
  }

  enterFocusMap() {
    return commit(this, "enterFocusMap", (state) => ({
      ...state,
      focusMap: true,
      phoneForeground: state.phone ? "map" : state.phoneForeground,
      transientSurface: null
    }));
  }

  exitFocusMap() {
    return commit(this, "exitFocusMap", (state) => ({ ...state, focusMap: false }));
  }

  setLayoutClass(layoutClass, short, phone = false) {
    requireLayoutClass(layoutClass);
    requireBoolean(short, "short");
    requireBoolean(phone, "phone");
    return commit(this, "setLayoutClass", (state) => ({
      ...state,
      layoutClass,
      short,
      phone,
      phoneForeground: (phone && !state.phone) || (!phone && state.phoneForeground === "townCard")
        ? "map" : state.phoneForeground,
      narrowActiveSheet:
        layoutClass === "narrow"
          ? state.layoutClass === "narrow" && state.narrowActiveSheet !== null
            ? state.narrowActiveSheet
            : fallbackNarrowSheet(state)
          : null
    }));
  }

  reset(defaults = {}) {
    if (!isRecord(defaults)) {
      throw new ViewportError(
        "invalid_viewport_defaults",
        "Viewport reset defaults must be an object."
      );
    }
    const inspectorOpen = requireBoolean(
      defaults.inspectorOpen ?? defaults.hasSelection ?? false,
      "inspectorOpen"
    );
    return commit(this, "reset", (state) => ({
      activeTask: "browse",
      activeSubview: null,
      dockOpen: true,
      inspectorOpen,
      toolShelfOpen: false,
      toolShelfTab: "marker",
      pointContextVisible: true,
      hudMode: requireChoice(defaults.hudMode ?? "scanner", HUD_MODES, "widget mode"),
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
      focusMap: false,
      worldViewGroupsExpanded: WORLD_VIEW_GROUP_DEFAULTS,
      layoutClass: state.layoutClass,
      short: state.short,
      phone: state.phone,
      phoneForeground: "map",
      inspectorTransparency: 0,
      inspectorTransparencyOpen: false,
      transientSurface: null,
      narrowActiveSheet:
        state.layoutClass === "narrow" ? (inspectorOpen ? "inspector" : "dock") : null
    }));
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") {
      throw new ViewportError(
        "invalid_viewport_subscriber",
        "Viewport composition subscriber must be a function."
      );
    }
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}
