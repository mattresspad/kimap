// script.js -- (2-10-26, 4:28PM)
// -- CSS Modules --
import '@picocss/pico/css/pico.min.css';
import './style.css';
import './modules/content-browser.css';
import './modules/environment-info.css';
import './modules/equipment-locker.css';
import './modules/global-settings.css';
import './modules/global-status.css';
import './modules/help-guide.css';
import './modules/infamy-tracker.css';
import './modules/kim-tooltips.css';
import './modules/paint-tools.css';
import './modules/player-markers.css';
import './modules/power-ranks.css';
import './modules/research-tree.css';
import './modules/town-overrides.css';
import './modules/unified-window.css';
import './modules/user-prefs.css';
import './modules/world-history.css';
import './modules/application-theme.css';
import './modules/document-manager.css';
import './modules/top-bar/shell.css';
// Workbench presentation owns the final viewport cascade after legacy modules.
import './modules/viewport/workbench.css';
// -- JS Modules --
import { kenshiAssetUrl } from
'./modules/asset-url.js';
import { BASE_MAP_REVISION } from './modules/viewport/base-map-resolution.js';
import { createBaseMapImageController } from './modules/viewport/base-map-image-controller.js';
import { createDebugGridController } from './modules/viewport/debug-grid.js';
import { createPoliticalModeInfo } from './modules/viewport/political-mode-info.js';
import { createFactionColorsWidget } from './modules/viewport/faction-colors-widget.js';
import { createViewportGeometryScheduler } from './modules/viewport/geometry-scheduler.js';
import { createPoliticalNavigationArtwork } from './modules/viewport/political-navigation-artwork.js';
import { createCursorControls } from './modules/viewport/cursor-controls.js';
import { REPORT_SUBJECTS, formatResourceReading } from './modules/viewport/reporting-policy.js';
import { bindChooserAutoHide } from './modules/viewport/chooser-auto-hide.js';
import { WORLD_VIEW_GROUPS } from './modules/viewport/layer-chooser-groups.js';
import { isGeographicArea, createGeographicColorMap } from './modules/selection/geographic-area-policy.js';
import { createCursorControlsPlacement } from './modules/viewport/cursor-controls-placement.js';
import {
  buildMapDataApiUrl,
  commitRequiredDatasets,
  getKimapRuntimeConfig,
  loadRequiredDatasets,
  parseMapDataResponse
} from './modules/map-contract.js';
import { initContentBrowser } from 
'./modules/content-browser.js';
import { initEnvironmentInfoModule } from 
'./modules/environment-info.js';
import { initEquipmentLockerModule } from 
'./modules/equipment-locker.js';
import { initGlobalSettings } from 
'./modules/global-settings.js';
import { initHelpGuide } from 
'./modules/help-guide.js';
import { initInteractiveTooltips } from 
'./modules/interactive-tooltips.js';
import { initLandmarksModule } from 
'./modules/landmarks.js';
import { createLandmarkInspector } from './modules/landmark-inspector.js';
import { captureInspectorReading, restoreInspectorReading } from './modules/inspector-reading-state.js';
import { openContextResultsPopup } from './modules/viewport/context-results-popup.js';
import { enableMarkerKeyboardActivation } from './modules/viewport/marker-keyboard.js';
import {
  cancelPaintInteraction,
  closePaintTools,
  getPaintDocumentStatus,
  getPaintInteractionState,
  initPaintModule,
  isPaintActive,

  setupPaintUI,
  startPaintDrawing,
  subscribePaintDocumentStatus,
  subscribePaintInteraction
} from
'./modules/paint-tools.js';
import {
  cancelPlayerMarkerPlacement,
  getPlayerMarkerDocumentStatus,
  getPlayerMarkerInteractionState,
  initPlayerMarkerModule,

  startPlayerMarkerPlacement,
  subscribePlayerMarkerDocumentStatus,
  subscribePlayerMarkerInteraction
} from
'./modules/player-markers.js';
import {
  DOCUMENT_TYPES,

  DocumentRecordState,
  documentFileName,
  downloadDocumentFile,

  parseDocumentFileText,

} from './modules/documents/index.js';
import { createScenarioDocumentPresentation } from './modules/documents/scenario-presentation.js';
import { createDocumentTabController } from './modules/document-tabs.js';
import { initPowerRanksModule } from 
'./modules/power-ranks.js';
import { initResearchTreeModule } from 
'./modules/research-tree.js';
import { selectIndexableResearchRecords } from './modules/research-tree-model.js';
import { createReferenceInspector } from
'./modules/reference-inspector.js';
import { createTownLayoutController } from
'./modules/town-layouts.js';
import { initTownOverridesModule } from
'./modules/town-overrides.js';
import { WindowManager } from 
'./modules/window-manager.js';
import {
  THEATER_DESTINATION_GROUPS,
  THEATER_DESTINATIONS,
  createSearchActivationRoute,
  createShellTransientAdapter,
  createTopBarController,
  getTheaterDestination
} from './modules/top-bar/index.js';
import {
  CHARACTER_STATUS_OPTIONS,
  MAP_IMAGE_READINESS,
  VIEWPORT_WORKBENCH_TOKENS,
  ViewportCompositionSession,
  classifyViewportLayout,
  createMapReadinessCoordinator,
  createEscapeCoordinator,
  createAreaZoomPlan,
  createAnchoredPopoverPlacement,
  createLayerPresentationProjection,
  createLayersPopoverPlacement,
  createUsableMapBounds,
  createTownTypeFilterProjection,
  createTimedStatusController,
  createViewportResizeAdapter,
  createWheelZoomGovernor,
  createZoomCloserPlan,
  getTownTypeFilterKey,
  hasPhoneSizedTouchScreen,
  isNestMarkerTownType,
  normalizeCharacterStatus,
  normalizeFactionRelation,
  TOWN_TYPE_FILTERS
} from './modules/viewport/index.js';
import {
  COMMAND_TYPES,
  ScenarioError,
  ScenarioSession,
  createScenarioLensProjection,
  createScenarioAdapters,
  createScenarioCommand,
  deriveBaselineKey,
  normalizeScenarioBaseline,
  parseScenarioEnvelope,
  serializeScenarioEnvelope
} from './modules/scenario/index.js';
import {
  KENSHI_MAX_COORD,
  KENSHI_MIN_COORD,
  MAP_HEIGHT,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_WIDTH,
  PointProbeSession,
  SelectionSession,
  createContextProjection,
  createGeographicActions,
  createSpawnAreaAnchorIndex,
  createSelectionCatalog,
  createSelectionOrigin,
  kenshiToLeaflet,
  leafletToKenshi,
  parseMapView,
  parseMapViewport,
  serializeMapView
} from './modules/selection/index.js';
import {
  DEFAULT_POLITICAL_PARTICIPANT_IDS,
  POLITICAL_VIEW_POLICY,
  createPoliticalAreaIndex,
  createPoliticalEvidenceCatalog,
  createPoliticalFactionProjection,
  createPoliticalPaletteDefaults,
  createPoliticalRasterProjection,
  createPoliticalReports,
  evaluatePoliticalInfluence,
  projectPoliticalEvidence
} from './modules/political/index.js';
import { createPoliticalReportingController } from './modules/viewport/political-reporting.js';
import { createLocationReportingController } from './modules/viewport/location-reporting.js';
import { createLocationReportSubjects } from './modules/viewport/location-report-subjects.js';
import { createEnvironmentInfoProjection } from './modules/environment-info-model.js';
import { createEnvironmentReports } from './modules/viewport/environment-reporting.js';
import {
    NUMERIC_CRITERIA,
    CONDITION_CRITERIA,
    createProspectingCatalog,
    projectProspecting,
    createProspectingRaster
} from './modules/prospecting/model.js';
import {
    createFactionOverviewCatalog,
    projectFactionOverview,
    createFactionOverviewRaster
} from './modules/faction-overview/index.js';
import { createPresenceProjection, isPresenceTownType } from './modules/discovery/presence.js';
import { composeEffectiveTown } from './modules/selection/effective-town.js';
import { createPresenceReports, formatPresenceFaction } from './modules/viewport/presence-reporting.js';
import { createFactionColorList, matchesFactionColorSearch } from './modules/viewport/faction-colors.js';
import { createScannerReading, createScannerView } from './modules/viewport/scanner.js';
import { positionScannerWorkspace, measureExpandedScannerHeight } from './modules/viewport/scanner-placement.js';
import {
  createDiscoveryCatalog,
  createDiscoveryContextCatalog,
  createNarcoticProhibitionRaster,
  hasDiscoveryTarget,
  projectDiscoveryContextSubject,
  projectDiscoveryEntity,
  projectNarcoticProhibition
} from './modules/discovery/index.js';
import { initWorldHistoryModule, renderWorldHistoryLog } from
'./modules/world-history.js';
// Alpine!
import Alpine from 'alpinejs';
// -- Stores --
import { PlayerMarkerStore } from 
'./stores/store-placements.js';
import { PaintStore } from 
'./stores/store-paint.js';
import { PoliticalPresentationSession } from
'./stores/political-presentation-session.js';
import { ReferenceNavigationSession } from
'./stores/reference-navigation-session.js';
import { DiscoveryPresentationSession } from
'./stores/discovery-presentation-session.js';
import { ProspectingPresentationSession } from './stores/prospecting-presentation-session.js';
import { FactionOverviewPresentationSession } from './stores/faction-overview-presentation-session.js';

const TRANSIENT_STATUS_TIMEOUT_MS = 5000;
//
// --- Map Setup & Declarations! ---
//
document.addEventListener('DOMContentLoaded', async function() {
const initialViewportLayout = classifyViewportLayout(
    document.documentElement.clientWidth || window.innerWidth,
    window.innerHeight,
    { phoneLandscapeEligible: hasPhoneSizedTouchScreen(window) }
);
const viewportComposition = new ViewportCompositionSession(initialViewportLayout);
let viewportResizeAdapter = null;
let escapeCoordinator = null;
let mapReadinessCoordinator = null;
let wheelZoomGovernor = null;
let townLayoutController = null;
const layerControls = { mapContent: null, worldViews: null };
let popoverResizeObserver = null;
const viewportGeometry = createViewportGeometryScheduler({
    positionViewport: positionActiveAnchoredPopover,
    positionWidget: () => factionColorsWidget?.position()
});
let pendingTransientFocusReturn = null;
let pendingLayerChooserFocus = null;
let anchoredPopoverDismissalReady = false;
let layerConfigurationReady = false;
let factionColorsReady = false;
let layerDescriptors = null;
let configurationLayerDescriptors = null;
let townTypeOccurrenceTypes = Object.freeze([]);
let spawnRasterStatus = 'loading';
let politicalStatus = 'loading';
let politicalStatusReason = 'Political evidence is loading.';
let politicalAreaIndex = null;
let politicalEvidenceCatalog = null;
let politicalEvidenceProjection = null;
let politicalInfluenceProjection = null;
let politicalPresentation = null;
let politicalFactionProjection = null;
let politicalImageOverlay = null;
let politicalRenderFrame = null;
let politicalRenderGeneration = 0;
let politicalRenderedGeneration = -1;
let politicalFactionList = null;
let politicalFactionSearch = '';
let surfaceChoiceTouched = false;
let applyingWorldSurfaceChoice = false;
let politicalReporting = null;
let locationReporting = null;
let environmentInfoProjection = null;
let environmentReportCatalog = null;
let environmentReportReason = 'Environmental data is loading.';
const prospectingPresentation = new ProspectingPresentationSession();
let prospectingCatalog = null;
let prospectingImageOverlay = null;
let prospectingRenderFrame = null;
let prospectingRenderGeneration = 0;
let prospectingOverlayReason = 'Prospecting geography is loading.';
const factionOverviewPresentation = new FactionOverviewPresentationSession();
let factionOverviewCatalog = null;
let factionOverviewProjection = null;
let factionOverviewImageOverlay = null;
let factionOverviewRenderFrame = null;
let factionOverviewRenderGeneration = 0;
let factionOverviewOverlayReason = 'Faction map geography is loading.';
let factionOverviewUnmappedAreaIds = [];
let factionOverviewRenderedProjection = null;
let factionOverviewRenderedId = null;
let presenceProjection = null;
let presenceReports = null;
let cursorControls = null;
let politicalModeInfo = null;
let factionColorsWidget = null;
let politicalReports = null;
let politicalReportsByGeometry = new Map();
let politicalReportingReason = 'Political reports are loading.';
const emptyPoliticalColors = Object.freeze({});
let appliedViewportComposition = null;
let map = null;
let townLayoutSuspendedSheet = null;
let townLayoutCoverVersion = 0;
let mapPopupOpen = false;
let firstInteractionCount = 0;
let activeCopyFeedback = null;
let initialTownMarkersRendered = false;
let interactionTimingActive = false;
let mapMovementDepth = 0;
let discoveryCatalog = null;
let discoveryContextCatalog = null;
let discoveryPresentation = null;
let discoveryContextProjection = null;
let discoveryContextRenderFrame = null;
let discoveryContextGeneration = 0;
let discoveryContextIndicatorStatus = 'loading';
let discoveryContextAreaIndex = null;
let narcoticProhibitionStatus = 'loading';
let narcoticProhibitionReason = 'Prohibition geography is loading.';
let narcoticProhibitionImageOverlay = null;
let narcoticProhibitionRenderFrame = null;
let narcoticProhibitionGeneration = 0;
let landmarkCatalog = null;
let landmarkInspector = null;
let landmarkReturnReading = null;
let landmarkMarkerFocus = null;
let referenceProjectionCache = null;
const referenceNavigation = new ReferenceNavigationSession({
    hasTarget: target => Boolean(discoveryCatalog && hasDiscoveryTarget(discoveryCatalog, target)),
    hasLandmark: id => Boolean(landmarkCatalog?.get(id))
});
let referenceInspector = null;
let referenceRootFocus = null;
let pendingReferenceFocus = [];
let preserveReferenceOnNextSelection = false;
// --- 1. ALPINE INITIALIZATION ---
document.addEventListener('alpine:init', () => {
// 1. User Store
Alpine.store('user', {
        name: 'Loading...',
        loggedIn: false,
        manifestId: 'vanilla'
    });

// 2. Workbench compatibility store. ViewportCompositionSession remains authoritative.
Alpine.store('layout', {
    resetAll() {
        resetViewportWorkspace();
    }
});
// 3. Legacy dock compatibility adapter.
Alpine.data('mainMenu', () => ({
    toggleCollapse() {
        viewportComposition.toggleDock();
    },
    handleHeaderClick() {}
}));
// 4. Context Inspector Store (presentation adapter only)
Alpine.store('infoPanel', {
    isOpen: false,
    type: null,
    activeId: null,
    instanceId: null,
    isFavorite: false,
    favoriteTarget: null,
    pointContextVisible: true,
    context: null,
    actions: [],
    error: '',
    data: emptyInfoPanelData(),

    update(context, actions, data, error = '') {
        this.context = context;
        this.actions = actions;
        this.error = error;
        this.type = context?.kind ?? null;
        this.activeId = context?.selection?.entityId ?? null;
        this.instanceId = context?.selection?.instanceId ?? null;
        this.data = data ?? emptyInfoPanelData();
    },

    open() {
        if (this.context || this.error) viewportComposition.showInspector();
    },

    close() {
        viewportComposition.hideInspector();
    },

    action(actionId) {
        return this.actions.find(entry => entry.id === actionId) ?? null;
    },

    actionEnabled(actionId) {
        return Boolean(this.action(actionId)?.enabled);
    },

    actionReason(actionId) {
        return this.action(actionId)?.reason ?? '';
    },

    zoomActionId() {
        return this.type === 'point' &&
            (!this.data.hasContainingSpawn || this.pointContextVisible)
            ? 'zoomCloser'
            : 'zoom';
    },

    zoomAction() {
        return this.action(this.zoomActionId());
    },

    zoomActionEnabled() {
        return Boolean(this.zoomAction()?.enabled);
    },

    zoomActionLabel() {
        return this.zoomAction()?.label ?? 'Zoom';
    },

    zoomActionReason() {
        return this.zoomAction()?.reason ?? this.zoomActionLabel();
    },

    togglePointContext() {
        viewportComposition.togglePointContext();
    },

    run(actionId, feedbackElement = null) {
        executeGeographicAction(actionId, feedbackElement);
    },

    selectTown(entityId) {
        showInfoPanel(entityId, 'town', null, 'override');
    },

    showReference(entityType, entityId, originatingControl) {
        pushReferenceTarget({ entityType, entityId }, originatingControl);
    }
});
});
// --- START ALPINE! ---
window.Alpine = Alpine;
Alpine.start();
// --- END ALPINE INITIALIZATION ---

// --- MOUSE THROTTLE --
function throttle(func, limit) 
{
  let inThrottle;
  return function() 
  {
    const args = arguments;
    const context = this;
    if (!inThrottle) 
    {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
// --- MAIN INIT ---
// --- Global Variables ---
function createReferenceOnlyScenarioAdapters(datasets = {}) {
    const factions = Array.isArray(datasets.factions) ? [...datasets.factions] : [];
    const factionById = Object.fromEntries(
        factions.filter(faction => faction?.StringId).map(faction => [faction.StringId, faction])
    );
    const relations = {};
    const playerFaction = factionById['204-gamedata.base'];
    for (const relation of playerFaction?.ReferenceCategories?.relations ?? []) {
        if (typeof relation?.StringId === 'string' && Number.isFinite(relation.Value0)) {
            relations[relation.StringId] = relation.Value0;
        }
    }

    const worldStateData = Array.isArray(datasets.worldStates) ? [...datasets.worldStates] : [];
    const characters = {};
    for (const worldState of worldStateData) {
        for (const category of ['NPC is', 'NPC is NOT']) {
            for (const reference of worldState?.ReferenceCategories?.[category] ?? []) {
                if (!reference?.StringId || characters[reference.StringId]) continue;
                characters[reference.StringId] = Object.freeze({
                    name: reference.Name || reference.StringId,
                    stringId: reference.StringId,
                    status: 1
                });
            }
        }
    }

    return Object.freeze({
        relationsStore: Object.freeze({
            getFaction: factionId => factionById[factionId],
            getAllFactions: () => [...factions],
            getRelation: factionId => relations[factionId] ?? 0,
            isAlly: factionId => (relations[factionId] ?? 0) >= 60,
            isEnemy: factionId => {
                const faction = factionById[factionId];
                const threshold = Number.isFinite(faction?.Values?.['enemy classification'])
                    ? faction.Values['enemy classification']
                    : -10;
                return (relations[factionId] ?? 0) <= threshold;
            }
        }),
        characterStore: Object.freeze({
            getCharacter: characterId => characters[characterId],
            getAllCharacters: () => Object.values(characters)
                .sort((left, right) => left.name.localeCompare(right.name))
        }),
        worldStateStore: Object.freeze({
            worldStateData,
            getState: () => 0
        }),
        historyStore: Object.freeze({
            getHistory: () => [],
            getTimeline: () => [],
            canUndo: () => false,
            canRedo: () => false
        })
    });
}

// -- Scenario session and read-only renderer adapters --
let scenarioSession = null;
let scenarioBaseline = null;
let scenarioBaselineError = null;
let scenarioLensProjection = null;
let scenarioLensError = null;
let selectionOrigin = null;
let selectionCatalog = null;
let selectionSession = null;
let pointProbeSession = null;
let contextProjection = null;
let powerRanksController = null;
let townOverridesController = null;

const scenarioDocumentState = new DocumentRecordState(DOCUMENT_TYPES.SCENARIO);
let {
    relationsStore,
    historyStore,
    characterStore
} = createReferenceOnlyScenarioAdapters();
const playerMarkerStore = new PlayerMarkerStore();
const paintStore = new PaintStore(); 
// -- Export & Import Management --
let initialApiData = {};
// -- DOM References --
const windowManager = new WindowManager({
    onBeforeOpen() {
        locationReporting?.hideHover(true);
        topBarController.closeTransient({ restoreFocus: false });
        if (townLayoutController?.isOpen()) closeTownLayoutCover();
        closeActiveTransientSurface({ restoreFocus: false });
        cancelActivePlanGestures();
    }
});
windowManager.configureNavigation({
    groups: THEATER_DESTINATION_GROUPS,
    destinations: THEATER_DESTINATIONS,
    utilityDestinationId: 'help'
});
const theaterLabel = paneId => getTheaterDestination(paneId)?.label ?? paneId;
const topBarController = createTopBarController({
    root: document.getElementById('top-bar'),
    windowManager,
    onActivateRecord(record) {
        const activation = createSearchActivationRoute(record);
        if (activation?.route === 'geographic') {
            if (!selectGeographicEntity(
                activation.entityType,
                activation.entityId,
                activation.instanceId,
                'quickSearch'
            )) return false;
            executeGeographicAction('inspect');
            return true;
        }
        if (activation?.route !== 'reference') return false;
        return showReferenceRoot(
            activation.entityType,
            activation.entityId,
            () => topBarController.getSearchFocusTarget()
        );
    },
    onBeforeOpenTransient() {
        locationReporting?.hideHover(true);
        if (townLayoutController?.isOpen()) closeTownLayoutCover();
        closeActiveTransientSurface({ restoreFocus: false });
    },
    onSearchShortcut() {
        if (windowManager.isOpen()) windowManager.close();
        if (townLayoutController?.isOpen()) closeTownLayoutCover();
        closeActiveTransientSurface({ restoreFocus: false });
    }
});
const shellTransientAdapter = createShellTransientAdapter(topBarController);
const helpModule = initHelpGuide(windowManager);
initInteractiveTooltips({
    tooltipId: 'kim-tooltip',
    onNavigate: helpModule.handleNavigation
});
topBarController.setRegisteredDestinations(['help']);
const documentTabControllers = [];
for (const root of document.querySelectorAll('[data-document-tabs]')) {
    try {
        documentTabControllers.push(createDocumentTabController(root));
    } catch (error) {
        console.error('Document tabs could not initialize.', error);
    }
}
setupEscapeCoordination();
window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    topBarController.destroy();
    documentTabControllers.forEach(controller => controller.destroy());
});
const userStatusContainer = document.getElementById('user-status-container');
const manifestContainer = document.getElementById('manifest-content');
const simulationContainer = document.getElementById('dock-section-simulation');
const selectionStatusController = createTimedStatusController({
    render(message, level) {
        const status = document.getElementById('selection-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.level = level;
        status.hidden = !message;
    }
});
window.addEventListener('pagehide', () => selectionStatusController.destroy(), { once: true });

const performanceDebugEnabled =
    window.location.hostname === 'localhost' ||
    new URLSearchParams(window.location.search).has('debugPerformance');

function markMapTiming(name) {
    if (!globalThis.performance?.mark) return;
    performance.mark(`kimap:${name}`);
}

function measureMapTiming(name, start, end) {
    if (!globalThis.performance?.measure) return;
    try {
        const measure = performance.measure(
            `kimap:${name}`,
            `kimap:${start}`,
            `kimap:${end}`
        );
        if (performanceDebugEnabled) {
            console.debug(`[KiMap timing] ${name}: ${measure.duration.toFixed(1)}ms`);
        }
    } catch (_error) {
        // Timing is diagnostic only; absent marks never affect map readiness.
    }
}

if (performanceDebugEnabled && typeof PerformanceObserver === 'function') {
    try {
        const longTaskObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                console.debug(`[KiMap long task] ${entry.duration.toFixed(1)}ms`, entry.name);
            }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
        window.addEventListener('pagehide', () => longTaskObserver.disconnect(), { once: true });
    } catch (_error) {
        // Long-task observation is unavailable in some browsers.
    }
}

function setWorkbenchElementVisible(element, visible) {
    if (!element) return;
    element.classList.toggle('workbench-region-hidden', !visible);
    if (element.dataset.workbenchRole === 'inspector') {
        element.classList.toggle('hidden', !visible);
    }
    element.setAttribute('aria-hidden', String(!visible));
}

let phoneScorecardHome = null;

function renderPhoneTownCard(state) {
    const card = document.getElementById('phone-town-card');
    if (!card) return;
    const selection = selectionSession?.getSelection();
    const visible = state.phone && state.phoneForeground === 'townCard' &&
        selection?.kind === 'entity' && selection.entityType === 'town';
    card.hidden = !visible;
    card.inert = !visible;
    card.setAttribute('aria-hidden', String(!visible));
    if (!visible) return;
    const original = townDatabase[selection.entityId];
    const active = getCurrentTownData(selection.entityId)?.finalState ?? original;
    const typeId = active?.Values?.type ?? original?.Values?.type;
    const numericTypeId = Number(typeId);
    const config = Number.isInteger(numericTypeId) && TOWN_TYPE_CONFIG[numericTypeId]
        ? TOWN_TYPE_CONFIG[numericTypeId] : TOWN_TYPE_CONFIG.default;
    document.getElementById('phone-town-card-title').textContent = active?.Name ?? original?.Name ?? 'Town';
    document.getElementById('phone-town-card-type').textContent = config.name;
}

function renderInspectorTransparency(state) {
    const inspector = document.getElementById('info-panel');
    if (!inspector) return;
    const isMapContext = state.phone && inspector.dataset.contextMode === 'geographic';
    const isAvailable = isMapContext && state.phoneForeground === 'inspector';
    const button = document.getElementById('phone-inspector-transparency-btn');
    const controls = document.getElementById('phone-inspector-transparency');
    const range = document.getElementById('phone-inspector-transparency-range');
    const value = document.getElementById('phone-inspector-transparency-value');
    if (button) {
        button.hidden = !isAvailable;
        button.setAttribute('aria-expanded', String(isAvailable && state.inspectorTransparencyOpen));
    }
    if (controls) controls.hidden = !isAvailable || !state.inspectorTransparencyOpen;
    if (range) range.value = String(state.inspectorTransparency);
    if (value) value.textContent = `${String(state.inspectorTransparency)}%`;
    inspector.style.setProperty('--phone-inspector-solid', `${String(100 - state.inspectorTransparency)}%`);
    inspector.dataset.inspectorTransparent = String(isMapContext && state.inspectorTransparency > 0);
}

function renderPhonePresentation(previous, state) {
    const belt = document.getElementById('phone-belt');
    if (!belt) return;
    belt.hidden = !state.phone;
    belt.inert = !state.phone;
    const navigation = referenceNavigation?.getSnapshot();
    const hasContext = Boolean(selectionSession?.getSelection() || navigation?.hasReference || navigation?.hasLandmark);
    const contextButton = document.getElementById('phone-context-btn');
    if (contextButton) contextButton.disabled = !hasContext;
    const planActive = getPlayerMarkerInteractionState().placementActive || getPaintInteractionState().active;
    for (const button of belt.querySelectorAll('[data-phone-route]')) {
        const route = button.dataset.phoneRoute;
        const pressed = route === state.phoneForeground ||
            (route === 'layersTray' && ['mapContent', 'worldViews'].includes(state.phoneForeground)) ||
            (route === 'reportsTray' && ['reportSettings', 'scorecard'].includes(state.phoneForeground)) ||
            (route === 'planTray' && planActive);
        button.setAttribute('aria-pressed', String(pressed));
    }
    const tasksButton = document.getElementById('phone-tasks-btn');
    if (tasksButton) {
        tasksButton.setAttribute('aria-label', state.focusMap ? 'Exit Focus Map' : 'Tasks');
        tasksButton.querySelector('small').textContent = state.focusMap ? 'Exit Focus' : 'Tasks';
    }
    const taskUtilities = document.getElementById('phone-workbench-utilities');
    if (taskUtilities && state.phoneForeground !== 'tasks') taskUtilities.open = false;
    for (const [id, route] of [
        ['phone-layers-tray', 'layersTray'], ['phone-reports-tray', 'reportsTray']
    ]) {
        const tray = document.getElementById(id);
        if (!tray) continue;
        const visible = state.phone && state.phoneForeground === route && !state.focusMap;
        tray.hidden = !visible;
        tray.inert = !visible;
    }
    const scorecardPanel = document.getElementById('phone-scorecard-panel');
    if (scorecardPanel) {
        scorecardPanel.hidden = !state.phone;
        scorecardPanel.inert = state.phoneForeground !== 'scorecard';
        scorecardPanel.setAttribute('aria-hidden', String(state.phoneForeground !== 'scorecard'));
    }
    const reportSelect = document.getElementById('phone-report-subject');
    if (reportSelect) reportSelect.value = state.pointProbeSubject;
    const scorecardButton = document.getElementById('phone-scorecard-btn');
    const scorecardReason = document.getElementById('phone-scorecard-reason');
    const scorecardAvailable = isPoliticalViewActive() && politicalReports?.available === true;
    if (scorecardButton) scorecardButton.disabled = !scorecardAvailable;
    if (scorecardReason) scorecardReason.textContent = scorecardAvailable ? '' :
        !isPoliticalViewActive() ? 'Enable Political View in World Views to see the Scorecard.' :
            politicalReportingReason;
    const scorecard = document.getElementById('political-scorecard-body');
    if (scorecard) {
        phoneScorecardHome ??= scorecard.parentElement;
        const destination = state.phone
            ? document.getElementById('phone-scorecard-slot') : phoneScorecardHome;
        if (destination && scorecard.parentElement !== destination) destination.append(scorecard);
    }
    const heldProbe = document.querySelector('.location-probe-fixed');
    if (heldProbe) heldProbe.inert = state.phone && state.phoneForeground !== 'map';
    renderPhoneTownCard(state);
    renderInspectorTransparency(state);
    if (previous?.phoneForeground !== state.phoneForeground && state.phone) {
        queueMicrotask(() => {
            if (viewportComposition.getSnapshot().phoneForeground !== state.phoneForeground) return;
            const target = {
                tasks: document.getElementById('unified-dock'),
                inspector: document.getElementById('info-panel'),
                layersTray: document.getElementById('phone-layers-tray'),
                planTray: document.getElementById('map-tool-shelf-panel'),
                reportsTray: document.getElementById('phone-reports-tray'),
                mapContent: document.getElementById('map-content-control-title'),
                worldViews: document.getElementById('world-views-control-title'),
                reportSettings: document.getElementById('cursor-controls-pointProbe-tab'),
                scorecard: document.getElementById('phone-scorecard-panel'),
                townCard: document.getElementById('phone-town-card'),
                map: document.getElementById(
                    ['mapContent', 'worldViews', 'layersTray'].includes(previous?.phoneForeground)
                        ? 'phone-layers-btn'
                        : ['reportSettings', 'scorecard', 'reportsTray'].includes(previous?.phoneForeground)
                            ? 'phone-reports-btn'
                            : previous?.phoneForeground === 'planTray'
                                ? 'phone-plan-btn'
                                : previous?.phoneForeground === 'inspector'
                                    ? 'phone-context-btn' : 'phone-tasks-btn'
                )
            }[state.phoneForeground];
            const focusTarget = state.phoneForeground === 'map' && previous?.phoneForeground === 'townCard'
                ? townMarkersByInstanceId.get(selectionSession?.getSelection()?.instanceId)?.getElement() ??
                    document.getElementById('phone-context-btn')
                : target;
            focusTarget?.focus({ preventScroll: true });
        });
    }
}

function setScannerExpanded(expanded) {
    const mode = isPoliticalViewActive() ? viewportComposition.getSnapshot().hudMode : 'scanner';
    viewportComposition.setHudExpanded(mode, Boolean(expanded));
}

function updateTownLayoutCanonicalWidth(state = viewportComposition.getSnapshot()) {
    const root = document.getElementById('viewport-workbench');
    const workspace = document.getElementById('map-workspace');
    if (!root || !workspace) return;
    if (state.layoutClass !== 'wide') {
        workspace.style.removeProperty('--town-layout-canonical-width');
        return;
    }
    const canonicalWidth = Math.max(
        0,
        root.getBoundingClientRect().width -
            VIEWPORT_WORKBENCH_TOKENS.leftDockWidth -
            VIEWPORT_WORKBENCH_TOKENS.rightInspectorWidth -
            VIEWPORT_WORKBENCH_TOKENS.structuralGap * 2
    );
    workspace.style.setProperty('--town-layout-canonical-width', `${String(canonicalWidth)}px`);
}

function suspendLayoutOverlays(launcher = null) {
    const state = viewportComposition.getSnapshot();
    townLayoutSuspendedSheet = null;
    if (state.phone) {
        townLayoutSuspendedSheet = Object.freeze({
            phone: true, phoneForeground: state.phoneForeground, launcher
        });
        viewportComposition.closePhoneForeground();
        return;
    }
    if (state.layoutClass === 'standard' && state.effective.inspectorVisible) {
        townLayoutSuspendedSheet = Object.freeze({
            layoutClass: state.layoutClass,
            inspectorOpen: state.inspectorOpen
        });
        viewportComposition.hideInspector();
        return;
    }
    if (state.layoutClass !== 'narrow' || state.narrowActiveSheet === null) return;
    townLayoutSuspendedSheet = Object.freeze({
        layoutClass: state.layoutClass,
        dockOpen: state.dockOpen,
        inspectorOpen: state.inspectorOpen,
        activeSheet: state.narrowActiveSheet
    });
    viewportComposition.hideDock();
    viewportComposition.hideInspector();
}

function restoreLayoutOverlays() {
    const suspended = townLayoutSuspendedSheet;
    townLayoutSuspendedSheet = null;
    if (!suspended) return;
    if (suspended.phone) {
        if (viewportComposition.getSnapshot().phone) {
            const navigation = referenceNavigation?.getSnapshot();
            const hasContext = selectionSession?.getSelection() || navigation?.hasReference || navigation?.hasLandmark;
            if (suspended.phoneForeground === 'inspector' && hasContext) {
                viewportComposition.showInspector();
                queueMicrotask(() => {
                    if (viewportComposition.getSnapshot().phoneForeground === 'inspector' &&
                        suspended.launcher?.isConnected) {
                        suspended.launcher.focus({ preventScroll: true });
                    }
                });
            } else if (!['map', 'townCard', 'inspector'].includes(suspended.phoneForeground)) {
                viewportComposition.openPhoneForeground(suspended.phoneForeground);
            }
        }
        return;
    }
    if (suspended.layoutClass === 'standard') {
        if (suspended.inspectorOpen) viewportComposition.showInspector();
        return;
    }
    if (suspended.layoutClass !== 'narrow') return;
    if (suspended.activeSheet === 'inspector') {
        if (suspended.dockOpen) viewportComposition.showDock();
        if (suspended.inspectorOpen) viewportComposition.showInspector();
    } else {
        if (suspended.inspectorOpen) viewportComposition.showInspector();
        if (suspended.dockOpen) viewportComposition.showDock();
    }
}

function focusTownLayoutCover() {
    const close = document.getElementById('close-town-layout-btn');
    const target = close ?? document.getElementById('town-layout-backdrop');
    if (!target) return;
    try {
        target.focus({ preventScroll: true });
    } catch (_error) {
        target.focus();
    }
}

async function openTownLayoutCover(townData, launcher) {
    if (!townLayoutController || !buildingLocationsUrl) return false;
    const version = ++townLayoutCoverVersion;
    locationReporting?.hideHover(true);
    topBarController.closeTransient({ restoreFocus: false });
    closeActiveTransientSurface();
    if (!townLayoutController.isOpen()) suspendLayoutOverlays(launcher);
    updateTownLayoutCanonicalWidth();
    try {
        const openPromise = townLayoutController.open(townData, buildingLocationsUrl, { launcher });
        focusTownLayoutCover();
        const opened = await openPromise;
        if (version !== townLayoutCoverVersion) return opened;
        if (!opened) closeTownLayoutCover();
        return opened;
    } catch (error) {
        if (version === townLayoutCoverVersion) {
            closeTownLayoutCover();
            setSelectionStatus(`Town layout could not be opened: ${error.message}`, 'error');
        }
        return false;
    }
}

function closeTownLayoutCover() {
    townLayoutCoverVersion += 1;
    if (townLayoutSuspendedSheet) restoreLayoutOverlays();
    const closed = townLayoutController?.close() ?? false;
    return closed;
}

function getVisibleDockFocusTarget(state) {
    const subviewBackId = state.activeSubview === 'favorites'
        ? 'favorites-subview-back-btn'
        : state.activeSubview === 'relationsJournal'
            ? 'relations-subview-back-btn'
            : state.activeSubview === 'layerConfiguration'
                ? 'layer-configuration-back-btn'
                : state.activeSubview === 'factionColors'
                    ? 'faction-colors-back-btn'
                : null;
    return (subviewBackId && document.getElementById(subviewBackId)) ||
        document.getElementById(`workbench-task-${state.activeTask}-btn`) ||
        document.getElementById('unified-dock');
}

function focusPresentedWorkbenchElement(element) {
    if (
        !element ||
        element.disabled ||
        element.closest('[aria-hidden="true"]') ||
        !isElementPresented(element)
    ) return false;

    try {
        element.focus({ preventScroll: true });
    } catch (_error) {
        element.focus();
    }
    return document.activeElement === element || element.contains(document.activeElement);
}

function transferWorkbenchFocus(previous, current, activeElement) {
    if (!previous || !activeElement) return;

    const dock = document.getElementById('unified-dock');
    const inspector = document.getElementById('info-panel');
    const dockToggle = document.getElementById('workbench-dock-toggle-btn');
    const inspectorToggle = document.getElementById('workbench-inspector-toggle-btn');
    const focusMapButton = document.getElementById('workbench-focus-map-btn');
    const mapWorkspace = document.getElementById('map-workspace');
    const focusWasInDock = Boolean(dock?.contains(activeElement));
    const focusWasInInspector = Boolean(inspector?.contains(activeElement));
    const narrowSheetChanged = (
        previous.layoutClass === 'narrow' &&
        current.layoutClass === 'narrow' &&
        previous.narrowActiveSheet !== current.narrowActiveSheet
    );
    let target = null;

    if (narrowSheetChanged && current.effective.inspectorVisible && (
        focusWasInDock || activeElement === inspectorToggle
    )) {
        target = inspector;
    } else if (narrowSheetChanged && current.effective.dockVisible && (
        focusWasInInspector || activeElement === dockToggle
    )) {
        target = getVisibleDockFocusTarget(current);
    } else if (
        previous.effective.dockVisible &&
        !current.effective.dockVisible &&
        focusWasInDock
    ) {
        target = current.effective.inspectorVisible ? inspector : dockToggle;
    } else if (
        previous.effective.inspectorVisible &&
        !current.effective.inspectorVisible &&
        focusWasInInspector
    ) {
        target = current.effective.dockVisible
            ? getVisibleDockFocusTarget(current)
            : inspectorToggle;
    } else if (
        !previous.effective.dockVisible &&
        current.effective.dockVisible &&
        activeElement === dockToggle
    ) {
        target = getVisibleDockFocusTarget(current);
    } else if (
        !previous.effective.inspectorVisible &&
        current.effective.inspectorVisible &&
        activeElement === inspectorToggle
    ) {
        target = inspector;
    }

    if (target && !focusPresentedWorkbenchElement(target)) {
        if (!focusPresentedWorkbenchElement(focusMapButton)) {
            focusPresentedWorkbenchElement(mapWorkspace);
        }
    }
}

function setWorkbenchControlLabel(control, label) {
    if (!control) return;
    control.setAttribute('aria-label', label);
    control.title = label;
    const visibleLabel = control.querySelector('.workbench-control-label');
    if (visibleLabel) visibleLabel.textContent = label;
}

function setPaintIconPopoverPresented(open, { focus = false } = {}) {
    const popover = document.getElementById('icon-grid-popover');
    const trigger = document.getElementById('tool-btn-icon-main');
    if (popover) popover.hidden = !open;
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
    if (open && focus) {
        queueMicrotask(() => {
            const activeChoice = popover?.querySelector('.icon-grid-btn.active');
            (activeChoice ?? popover?.querySelector('.icon-grid-btn'))?.focus();
        });
    }
}

function isLayerChooserSurface(surface) {
    return surface === 'mapContent' || surface === 'worldViews';
}

function getLayerChooserLauncher(surface) {
    const id = surface === 'mapContent' ? 'map-content-btn'
        : surface === 'worldViews' ? 'world-views-btn' : null;
    return id ? document.getElementById(id) : null;
}

function getAnchoredPopoverElements(surface) {
    if (surface === 'cursorControls') {
        return { anchor: cursorControls?.frame, popover: cursorControls?.element, alignment: 'end' };
    }
    if (isLayerChooserSurface(surface)) {
        return {
            anchor: document.getElementById('map-layer-family-launchers'),
            popover: layerControls[surface]?.getContainer() ?? null,
            alignment: 'start'
        };
    }
    if (surface === 'paintIcons') {
        return {
            anchor: document.getElementById('tool-btn-icon-main'),
            popover: document.getElementById('icon-grid-popover'),
            alignment: 'center'
        };
    }
    return { anchor: null, popover: null, alignment: 'end' };
}

function getUsableWorkspaceBounds(workspaceRect) {
    const state = viewportComposition.getSnapshot();
    const occlusions = [];
    for (const [id, visible] of [
        ['unified-dock', state.effective.dockVisible],
        ['info-panel', state.effective.inspectorVisible]
    ]) {
        const element = document.getElementById(id);
        if (visible && element) occlusions.push(element.getBoundingClientRect());
    }
    if (state.phone) {
        const belt = document.getElementById('phone-belt');
        if (belt) occlusions.push(belt.getBoundingClientRect());
        for (const id of ['phone-layers-tray', 'phone-reports-tray', 'map-tool-shelf']) {
            const element = document.getElementById(id);
            if (element && isElementPresented(element) && !element.hidden) {
                occlusions.push(element.getBoundingClientRect());
            }
        }
    }
    return createUsableMapBounds({ workspaceRect, occlusions });
}

function positionMapControlCluster() {
    if (viewportComposition.getSnapshot().phone) return;
    const workspace = document.getElementById('map-workspace');
    const cluster = document.getElementById('map-control-cluster');
    if (!workspace || !cluster) return;
    positionScannerWorkspace({
        workspace,
        root: document.getElementById('viewport-workbench'),
        hud: document.getElementById('workbench-hud-region'),
        container: document.getElementById('world-tracker'),
        cluster,
        state: viewportComposition.getSnapshot(),
        getUsableBounds: () => getUsableWorkspaceBounds(workspace.getBoundingClientRect())
    });
}

function positionActiveAnchoredPopover() {
    positionMapControlCluster();
    const surface = viewportComposition.getSnapshot().transientSurface;
    if (!surface) { locationReporting?.position(); return false; }
    if (viewportComposition.getSnapshot().phone &&
        ['mapContent', 'worldViews', 'cursorControls'].includes(surface)) {
        locationReporting?.position();
        return true;
    }
    const workspace = document.getElementById('map-workspace');
    const { anchor, popover, alignment } = getAnchoredPopoverElements(surface);
    if (!workspace || !anchor || !popover || popover.hidden) { locationReporting?.position(); return false; }

    const popoverRect = popover.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const scanner = document.getElementById('world-tracker');
    const placement = surface === 'cursorControls' ? createCursorControlsPlacement({
        anchorRect: anchor.getBoundingClientRect(),
        workspaceRect,
        usableRect: getUsableWorkspaceBounds(workspaceRect),
        surfaceBlockSize: popover.querySelector('.cursor-controls-body').scrollHeight +
            popover.querySelector('.cursor-controls-header').getBoundingClientRect().height +
            popover.querySelector('.cursor-controls-tabs').getBoundingClientRect().height + 2,
        chromeBlockSize: popover.querySelector('.cursor-controls-header').getBoundingClientRect().height +
            popover.querySelector('.cursor-controls-tabs').getBoundingClientRect().height + 2,
        obstructions: ['world-tracker', 'map-control-cluster', 'map-tool-shelf']
            .map(id => document.getElementById(id)).filter(node => node && isElementPresented(node))
            .map(node => node.getBoundingClientRect()),
        narrow: viewportComposition.getSnapshot().layoutClass === 'narrow'
    }) : isLayerChooserSurface(surface) ? createLayersPopoverPlacement({
        anchorRect: anchor.getBoundingClientRect(),
        workspaceRect,
        usableRect: getUsableWorkspaceBounds(workspaceRect),
        surfaceBlockSize: popover.querySelector('.layers-control-options').scrollHeight +
            popover.querySelector('.layers-control-header').getBoundingClientRect().height + 2,
        headerBlockSize: popover.querySelector('.layers-control-header').getBoundingClientRect().height,
        optionBlockSize: Math.max(29, ...[...popover.querySelectorAll('[data-layer-option-row]')]
            .map(row => row.getBoundingClientRect().height)),
        hudRects: scanner && isElementPresented(scanner) ? [scanner.getBoundingClientRect()] : [],
        narrow: viewportComposition.getSnapshot().layoutClass === 'narrow'
    }) : createAnchoredPopoverPlacement({
        anchorRect: anchor.getBoundingClientRect(),
        workspaceRect,
        surfaceSize: {
            width: Math.max(popoverRect.width, popover.scrollWidth),
            height: Math.max(popoverRect.height, popover.scrollHeight)
        },
        preferredPlacement: 'below',
        alignment,
        gap: 8,
        padding: 8
    });
    if (isLayerChooserSurface(surface) || surface === 'cursorControls') {
        popover.style.width = `${placement.width}px`;
        popover.dataset.mode = placement.mode;
    }
    if (isLayerChooserSurface(surface)) {
        const closeButton = popover.querySelector('.layers-close-btn');
        if (placement.mode !== 'bounded' && document.activeElement === closeButton) {
            popover.querySelector('.layers-settings-btn')?.focus({ preventScroll: true });
        }
        if (closeButton) closeButton.hidden = placement.mode !== 'bounded';
    }
    popover.style.left = `${Math.round(placement.left)}px`;
    popover.style.top = `${Math.round(placement.top)}px`;
    popover.style.setProperty(
        '--map-popover-max-block-size',
        `${Math.floor(placement.availableBlockSize)}px`
    );
    popover.dataset.placement = placement.placement;
    if (isLayerChooserSurface(surface)) layerControls[surface]?.refreshAutoHide();
    locationReporting?.position();
    return true;
}

function getFactionColorsWidgetAvailability() {
    const availability = getFactionColorAvailability();
    if (!availability.available) return availability;
    return isPoliticalViewActive() ? { available: true, reason: '' }
        : { available: false, reason: 'Enable Political View to use this widget.' };
}

function refreshFactionColorsWidget() {
    factionColorsWidget?.refresh();
    refreshFactionColorsWidgetControls();
}

function refreshFactionColorsWidgetControls() {
    politicalModeInfo?.refresh();
    const button = document.getElementById('faction-colors-widget-open-btn');
    const reason = document.getElementById('faction-colors-widget-open-reason');
    const availability = getFactionColorsWidgetAvailability();
    const open = viewportComposition.getSnapshot().factionColorsWidgetOpen;
    const action = `${open ? 'Close' : 'Open'} Faction Colors Widget`;
    if (button) {
        button.disabled = !availability.available;
        button.setAttribute('aria-pressed', String(open));
        button.title = availability.available ? action : availability.reason;
        const label = button.querySelector('span:last-child');
        if (label.textContent !== action) label.textContent = action;
        if (availability.available) button.removeAttribute('aria-describedby');
        else button.setAttribute('aria-describedby', 'faction-colors-widget-open-reason');
    }
    if (reason) { reason.hidden = availability.available; reason.textContent = availability.reason; }
}

function toggleFactionColorsWidget(source) {
    if (!getFactionColorsWidgetAvailability().available) return;
    if (viewportComposition.getSnapshot().factionColorsWidgetOpen) {
        factionColorsWidget?.close({ returnFocus: source });
        return;
    }
    if (source?.closest('#world-views-control')) {
        pendingLayerChooserFocus = null;
        pendingTransientFocusReturn = null;
        closeActiveTransientSurface({ expected: 'worldViews' });
    }
    factionColorsWidget?.open(source);
}

function scheduleActiveAnchoredPopoverPosition() {
    viewportGeometry.requestViewport();
}

function closeActiveTransientSurface({
    expected = null,
    restoreFocus = false,
    respectPinned = false
} = {}) {
    const active = viewportComposition.getSnapshot().transientSurface;
    if (!active || (expected && expected !== active)) return false;
    if (respectPinned && isLayerChooserSurface(active) && layerControls[active]?.isPinned()) {
        return false;
    }
    if (restoreFocus) pendingTransientFocusReturn = active;
    return viewportComposition.closeTransientSurface(active) !== false;
}

function setLayerLauncherPresentation(surface, active) {
    const launcher = getLayerChooserLauncher(surface);
    if (!launcher) return;
    const name = surface === 'mapContent' ? 'Map Content' : 'World Views';
    const action = active ? `Close ${name}` : `Open ${name}`;
    launcher.setAttribute('aria-expanded', String(active));
    launcher.setAttribute('aria-pressed', String(active));
    launcher.setAttribute('aria-label', action);
    launcher.title = action;
}

function renderAnchoredPopoverPresentation(previousState, state) {
    const changed = previousState?.transientSurface !== state.transientSurface;
    for (const surface of ['mapContent', 'worldViews']) {
        if (state.transientSurface === surface) layerControls[surface]?.expand();
        else layerControls[surface]?.forceCollapse();
        const chooser = document.getElementById(
            surface === 'mapContent' ? 'map-content-control' : 'world-views-control'
        );
        const close = chooser?.querySelector('.layers-close-btn');
        if (close) close.hidden = !state.phone;
        setLayerLauncherPresentation(surface, state.transientSurface === surface);
    }
    setPaintIconPopoverPresented(state.transientSurface === 'paintIcons', {
        focus: changed && state.transientSurface === 'paintIcons'
    });
    cursorControls?.refresh({ focus: changed && state.transientSurface === 'cursorControls' });

    if (
        changed &&
        pendingLayerChooserFocus === state.transientSurface &&
        isLayerChooserSurface(state.transientSurface)
    ) {
        const surface = pendingLayerChooserFocus;
        pendingLayerChooserFocus = null;
        queueMicrotask(() => layerControls[surface]?.focusHeading());
    }

    if (changed && state.transientSurface === null && pendingTransientFocusReturn) {
        const focusSurface = pendingTransientFocusReturn;
        pendingTransientFocusReturn = null;
        queueMicrotask(() => {
            // A newer handoff owns focus even when an earlier close queued its return.
            if (viewportComposition.getSnapshot().transientSurface !== null) return;
            const target = isLayerChooserSurface(focusSurface)
                ? getLayerChooserLauncher(focusSurface)
                : focusSurface === 'cursorControls' ? cursorControls?.launcher
                    : document.getElementById('tool-btn-icon-main');
            focusPresentedWorkbenchElement(target);
        });
    }
    if (state.transientSurface) scheduleActiveAnchoredPopoverPosition();
}

function setupAnchoredPopoverGeometry() {
    if (popoverResizeObserver) return;
    const workspace = document.getElementById('map-workspace');
    const cluster = document.getElementById('map-control-cluster');
    const rail = document.getElementById('workbench-map-controls');
    const launchers = document.getElementById('map-layer-family-launchers');
    const dock = document.getElementById('unified-dock');
    const inspector = document.getElementById('info-panel');
    const toolShelf = document.getElementById('map-tool-shelf');
    if (typeof ResizeObserver === 'function') {
        popoverResizeObserver = new ResizeObserver(scheduleActiveAnchoredPopoverPosition);
        for (const element of [workspace, cluster, rail, launchers, dock, inspector, toolShelf,
            document.getElementById('map-navigation-stack'), cursorControls?.element]) {
            if (element) popoverResizeObserver.observe(element);
        }
    }
    cluster?.addEventListener('scroll', scheduleActiveAnchoredPopoverPosition, { passive: true });
    document.getElementById('paint-toolbar')?.addEventListener(
        'scroll',
        scheduleActiveAnchoredPopoverPosition,
        { passive: true }
    );
    window.addEventListener('resize', scheduleActiveAnchoredPopoverPosition, { passive: true });
}

function setupAnchoredPopoverDismissal() {
    if (anchoredPopoverDismissalReady) return;
    anchoredPopoverDismissalReady = true;
    document.addEventListener('pointerdown', event => {
        const active = viewportComposition.getSnapshot().transientSurface;
        if (!active) return;
        const { anchor, popover } = getAnchoredPopoverElements(active);
        const target = event.target;
        if (popover?.contains(target) || anchor?.contains(target)) return;
        closeActiveTransientSurface({ expected: active, respectPinned: true });
    }, true);
}

function renderLayerPresentation() {
    const townTypes = layerDescriptors ? getTownTypeProjection() : null;
    const projection = createLayerPresentationProjection({
        descriptors: map ? layerDescriptors : null,
        configurationDescriptors: map ? configurationLayerDescriptors : null,
        townTypeProjection: townTypes,
        hasLayer: layer => map.hasLayer(layer)
    });
    const worldView = document.getElementById('plan-layer-world-view');
    const mapContent = document.getElementById('plan-layer-map-content');
    const reference = document.getElementById('plan-layer-reference');
    const unavailable = 'Layers are loading or unavailable.';
    if (worldView) worldView.textContent = projection.available
        ? projection.worldViews.map(layer => layer.name).join(', ') || 'None'
        : unavailable;
    if (mapContent) mapContent.textContent = projection.available
        ? projection.mapContent.map(layer => layer.name).join(', ') || 'None'
        : unavailable;
    if (reference) reference.textContent = projection.available
        ? projection.referenceLayers.map(layer => layer.name).join(', ') || 'None'
        : unavailable;
    const phoneMapContent = document.getElementById('phone-map-content-summary');
    const phoneWorldViews = document.getElementById('phone-world-views-summary');
    if (phoneMapContent) phoneMapContent.textContent = mapContent?.textContent ?? unavailable;
    if (phoneWorldViews) phoneWorldViews.textContent = worldView?.textContent ?? unavailable;
    for (const [target, enabled] of [
        ['roads', projection.roadEnabled], ['borders', projection.borderEnabled],
        ['debugGrid', projection.gridEnabled]
    ]) {
        const section = document.getElementById(`layer-configuration-${target}`);
        const status = document.getElementById(`layer-configuration-${target}-status`);
        if (section) {
            if (!enabled && section.contains(document.activeElement)) {
                focusPresentedWorkbenchElement(document.getElementById(`layer-configuration-${target}-title`));
            }
            section.disabled = !enabled;
        }
        if (status) status.textContent = !projection.configurationAvailable ? 'Layer unavailable'
            : enabled ? 'Active' : `Inactive — enable this layer in ${target === 'roads' ? 'Map Content' : 'World Views'}.`;
    }
    politicalModeInfo?.refresh();
    if (layerDescriptors) syncLayerFamilyControls();
}

function focusPlanRouteElement(id) {
    queueMicrotask(() => {
        const target = document.getElementById(id);
        const route = document.getElementById('workbench-route-plan');
        if (!target || !route || !isElementPresented(target)) return;
        route.scrollTop += target.getBoundingClientRect().top - route.getBoundingClientRect().top - 12;
        focusPresentedWorkbenchElement(target);
    });
}

function openOverlayControls() {
    pendingTransientFocusReturn = null;
    closeActiveTransientSurface();
    viewportComposition.setTask('plan');
    focusPlanRouteElement('plan-overlay-title');
}

function openLayerConfigurationView(target = null) {
    pendingTransientFocusReturn = null;
    closeActiveTransientSurface();
    viewportComposition.openSubview('layerConfiguration', target);
    focusPlanRouteElement(target ? `layer-configuration-${target}-title` : 'layer-configuration-title');
}

function openFactionColorsView(factionId = null) {
    pendingTransientFocusReturn = null;
    closeActiveTransientSurface();
    viewportComposition.openSubview('factionColors');
    if (!factionId) {
        focusPlanRouteElement('faction-colors-title');
        return;
    }
    queueMicrotask(() => {
        const availability = getFactionColorAvailability();
        const faction = politicalFactionProjection?.rows.find(row => row.id === factionId && row.included);
        if (availability.available && faction) {
            if (!matchesFactionColorSearch(faction, politicalFactionSearch)) {
                politicalFactionSearch = '';
                document.getElementById('political-faction-search').value = '';
            }
            renderFactionColorsPanel();
            if (politicalFactionList?.reveal(factionId, document.getElementById('workbench-route-plan'))) return;
        }
        const status = document.getElementById('political-readiness-status');
        status.textContent = availability.available
            ? 'This faction is no longer included in Faction Colors.' : availability.reason;
        focusPlanRouteElement('faction-colors-title');
    });
}

function getFactionColorAvailability() {
    const available = Boolean(politicalStatus === 'ready' && politicalPresentation && politicalFactionProjection?.available);
    return { available, reason: available ? null : getPoliticalSurfaceReason() };
}

function initializeConfigurationLayerDescriptors() {
    if (configurationLayerDescriptors) return;
    configurationLayerDescriptors = Object.freeze([
        Object.freeze({ id: 'roads', name: 'Road Network', layer: roadLayer,
            kind: 'overlay', family: 'reference', available: true,
            configurationTarget: 'roads' }),
        Object.freeze({ id: 'spawnBorders', name: 'Spawn Borders', layer: spawnBorderLayer,
            kind: 'overlay', family: 'reference', available: true,
            configurationTarget: 'borders' }),
        Object.freeze({ id: 'debugGrid', name: 'Debug Grid', layer: debugGridLayer,
            kind: 'overlay', family: 'reference', available: true,
            configurationTarget: 'debugGrid' })
    ]);
}

function setupLayerConfigurationControls() {
    if (layerConfigurationReady) return;
    initializeConfigurationLayerDescriptors();
    const mapContainer = document.getElementById('map-container');
    const nativeInput = document.getElementById('map-road-native-color');
    const customInput = document.getElementById('map-road-custom-color');
    const borderInput = document.getElementById('map-border-color');
    const gridInput = document.getElementById('map-debug-grid-color');
    nativeInput?.addEventListener('input', event => {
        mapContainer?.style.setProperty('--road-color-native', event.target.value);
    });
    customInput?.addEventListener('input', event => {
        mapContainer?.style.setProperty('--road-color-custom', event.target.value);
    });
    document.getElementById('map-road-match-btn')?.addEventListener('click', () => {
        if (!nativeInput || !customInput) return;
        customInput.value = nativeInput.value;
        mapContainer?.style.setProperty('--road-color-custom', nativeInput.value);
    });
    document.getElementById('map-road-highvis-btn')?.addEventListener('click', () => {
        if (!nativeInput || !customInput) return;
        nativeInput.value = '#00ffff';
        customInput.value = '#ff00ff';
        mapContainer?.style.setProperty('--road-color-native', nativeInput.value);
        mapContainer?.style.setProperty('--road-color-custom', customInput.value);
    });
    document.getElementById('map-road-reset-btn')?.addEventListener('click', () => {
        if (!nativeInput || !customInput) return;
        nativeInput.value = '#dfa959';
        customInput.value = '#ffaa00';
        mapContainer?.style.removeProperty('--road-color-native');
        mapContainer?.style.removeProperty('--road-color-custom');
    });
    borderInput?.addEventListener('input', event => {
        if (map?.hasLayer(spawnBorderLayer)) renderSpawnBorders(event.target.value);
    });
    gridInput?.addEventListener('input', event => {
        if (map?.hasLayer(debugGridLayer)) debugGridController?.setColor(event.target.value);
    });
    layerConfigurationReady = true;
    renderLayerPresentation();
}

function setPoliticalStatus(status, reason) {
    politicalStatus = status;
    politicalStatusReason = reason;
    if (layerDescriptors) refreshLayerDescriptors();
    renderFactionColorsPanel();
}

function isPoliticalViewActive() {
    return Boolean(map && map.hasLayer(politicalViewLayer));
}

function updatePoliticalOverlayOpacity() {
    const opacity = politicalPresentation?.getSnapshot().opacity ?? 0.7;
    politicalImageOverlay?.setOpacity(opacity);
}

function commitPoliticalRaster(generation) {
    if (
        generation !== politicalRenderGeneration ||
        !isPoliticalViewActive() ||
        !politicalAreaIndex ||
        !politicalInfluenceProjection ||
        !politicalPresentation
    ) return false;
    const raster = createPoliticalRasterProjection({
        areaIndex: politicalAreaIndex,
        influence: politicalInfluenceProjection,
        colorsByFactionId: politicalPresentation.getSnapshot().colorsByFactionId
    });
    if (!raster.available || generation !== politicalRenderGeneration) return false;

    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Political raster canvas is unavailable.');
    const image = context.createImageData(raster.width, raster.height);
    image.data.set(raster.copyRgba());
    context.putImageData(image, 0, 0);
    const url = canvas.toDataURL();
    if (generation !== politicalRenderGeneration) return false;

    if (!politicalImageOverlay) {
        politicalImageOverlay = L.imageOverlay(url, [[0, 0], [mapHeight, mapWidth]], {
            opacity: politicalPresentation.getSnapshot().opacity,
            interactive: false,
            pane: 'politicalPane',
            className: 'political-view-overlay pixelated-overlay'
        });
        politicalViewLayer.addLayer(politicalImageOverlay);
    } else {
        politicalImageOverlay.setUrl(url);
        updatePoliticalOverlayOpacity();
    }
    politicalRenderedGeneration = generation;
    return true;
}

function schedulePoliticalRasterRender() {
    politicalRenderGeneration += 1;
    if (!isPoliticalViewActive() || politicalStatus !== 'ready') return;
    if (politicalRenderFrame !== null) return;
    politicalRenderFrame = requestAnimationFrame(() => {
        politicalRenderFrame = null;
        const generation = politicalRenderGeneration;
        try {
            commitPoliticalRaster(generation);
        } catch (error) {
            console.error('Political View could not be painted.', error);
            setPoliticalStatus('unavailable', `Political rendering failed: ${error.message}`);
            if (map.hasLayer(politicalViewLayer)) {
                activateWorldSurface(getLayerDescriptor('none'));
            }
            return;
        }
        if (
            generation !== politicalRenderGeneration &&
            isPoliticalViewActive() &&
            politicalStatus === 'ready'
        ) schedulePoliticalRasterRender();
    });
}

function refreshPoliticalReports(rebuild = false) {
    if (rebuild) {
        try {
            politicalReports = createPoliticalReports({
                projection: politicalEvidenceProjection,
                influence: politicalInfluenceProjection
            });
            politicalReportsByGeometry = new Map(politicalReports.areas.map(report => [report.geometryKey, report]));
            politicalReportingReason = politicalReports.reason;
        } catch (error) {
            console.error('Political reporting could not be projected.', error);
            politicalReports = null;
            politicalReportsByGeometry = new Map();
            politicalReportingReason = 'Political reporting is unavailable. Scanner remains available.';
        }
    }
    try {
        politicalReporting?.refresh();
    } catch (error) {
        console.error('Political reporting could not be presented.', error);
        politicalReports = null;
        politicalReportsByGeometry = new Map();
        politicalReportingReason = 'Political reporting is unavailable. Scanner remains available.';
        try { politicalReporting?.refresh(); } catch (_error) { /* Keep map rendering independent. */ }
    }
    locationReporting?.refresh();
    cursorControls?.refresh();
    renderPhonePresentation(null, viewportComposition.getSnapshot());
}

function refreshPresenceReports(rebuild = false) {
    try {
        if (rebuild || !presenceProjection) presenceProjection = createPresenceProjection({
            catalog: discoveryCatalog, snapshot: scenarioSession?.getSnapshot(), lenses: scenarioLensProjection
        });
        presenceReports = createPresenceReports({ projection: presenceProjection, areaIndex: discoveryContextAreaIndex });
    } catch (error) {
        presenceProjection = null;
        presenceReports = null;
        console.error('Current presence reporting is unavailable.', error);
    }
}

function refreshEnvironmentReports() {
    environmentReportCatalog = null;
    if (!environmentInfoProjection) {
        environmentReportReason = 'Environmental data is unavailable.';
    } else if (!discoveryContextAreaIndex) {
        environmentReportReason = spawnRasterStatus === 'loading'
            ? 'Area geography is loading.' : 'Area geography is unavailable.';
    } else {
        try {
            environmentReportCatalog = createEnvironmentReports({
                projection: environmentInfoProjection, areaIndex: discoveryContextAreaIndex
            });
            environmentReportReason = '';
        } catch (error) {
            environmentReportReason = 'Environmental reporting is unavailable.';
            console.error(environmentReportReason, error);
        }
    }
    refreshPresenceReports();
    locationReporting?.refresh();
    cursorControls?.refresh();
}

function refreshPoliticalProjection() {
    if (
        politicalStatus !== 'ready' ||
        !politicalEvidenceCatalog ||
        !politicalPresentation ||
        !scenarioSession
    ) {
        politicalEvidenceProjection = null;
        politicalInfluenceProjection = null;
        politicalFactionProjection = null;
        refreshPoliticalReports(true);
        renderFactionColorsPanel();
        return false;
    }
    try {
        politicalEvidenceProjection = projectPoliticalEvidence({
            catalog: politicalEvidenceCatalog,
            snapshot: scenarioSession.getSnapshot()
        });
        politicalInfluenceProjection = evaluatePoliticalInfluence({
            projection: politicalEvidenceProjection,
            participantIds: politicalPresentation.getSnapshot().participantIds,
            townMetric: POLITICAL_VIEW_POLICY.townMetric,
            sourceMix: POLITICAL_VIEW_POLICY.sourceMix,
            confidenceRule: POLITICAL_VIEW_POLICY.confidenceRule
        });
        politicalFactionProjection = createPoliticalFactionProjection({
            projection: politicalEvidenceProjection,
            presentation: politicalPresentation
        });
        renderFactionColorsPanel();
        schedulePoliticalRasterRender();
        refreshPoliticalReports(true);
        return true;
    } catch (error) {
        console.error('Political evidence could not be projected.', error);
        setPoliticalStatus('unavailable', `Political evidence failed: ${error.message}`);
        if (map?.hasLayer(politicalViewLayer)) {
            activateWorldSurface(getLayerDescriptor('none'));
        }
        return false;
    }
}

function initializePoliticalFoundation(raster, sharedAreaIndex = null) {
    if (!scenarioBaseline || !scenarioSession) {
        setPoliticalStatus(
            'unavailable',
            'Political View requires an available scenario projection.'
        );
        return false;
    }
    try {
        politicalAreaIndex = sharedAreaIndex ?? createPoliticalAreaIndex({
            raster,
            spawnAreas: scenarioBaseline.spawnAreas
        });
        politicalEvidenceCatalog = createPoliticalEvidenceCatalog({
            baseline: scenarioBaseline,
            areaIndex: politicalAreaIndex
        });
        const palette = createPoliticalPaletteDefaults({
            factions: politicalEvidenceCatalog.factions,
            colourSchemes: Object.values(colourSchemeDatabase),
            participantIds: DEFAULT_POLITICAL_PARTICIPANT_IDS
        });
        politicalPresentation = new PoliticalPresentationSession({
            defaultsByFactionId: palette.defaultsByFactionId,
            participantIds: palette.resolvedParticipantIds
        });
        politicalPresentation.subscribe(change => {
            if (change.type === 'setOpacity') {
                updatePoliticalOverlayOpacity();
                renderFactionColorsPanel();
                return;
            }
            if (change.type === 'setFactionColor' || change.type === 'resetFactionColor') {
                politicalFactionProjection = createPoliticalFactionProjection({
                    projection: politicalEvidenceProjection, presentation: politicalPresentation
                });
                renderFactionColorsPanel();
                schedulePoliticalRasterRender();
                refreshPoliticalReports();
                return;
            }
            refreshPoliticalProjection();
        });
        setPoliticalStatus('ready', 'Political evidence is ready.');
        refreshPoliticalProjection();
        return true;
    } catch (error) {
        politicalAreaIndex = null;
        politicalEvidenceCatalog = null;
        politicalEvidenceProjection = null;
        politicalInfluenceProjection = null;
        politicalPresentation = null;
        politicalFactionProjection = null;
        console.error('Political View initialization failed.', error);
        setPoliticalStatus('unavailable', `Political evidence is unavailable: ${error.message}`);
        return false;
    }
}

function renderFactionColorsPanel() {
    refreshFactionColorsWidget();
    const status = document.getElementById('political-readiness-status');
    const controls = document.getElementById('faction-colors-controls');
    const opacity = document.getElementById('political-opacity');
    const opacityValue = document.getElementById('political-opacity-value');
    const restore = document.getElementById('political-restore-defaults-btn');
    const addSelect = document.getElementById('political-add-faction-select');
    const addButton = document.getElementById('political-add-faction-btn');
    const search = document.getElementById('political-faction-search');
    const count = document.getElementById('political-faction-count');
    const list = document.getElementById('political-faction-list');
    if (!status || !list) return;

    const ready = politicalStatus === 'ready' &&
        politicalPresentation && politicalFactionProjection?.available;
    status.textContent = ready
        ? `${POLITICAL_VIEW_POLICY.label} is ready for this manifest.`
        : getPoliticalSurfaceReason();
    if (controls) controls.disabled = !ready;
    if (search) search.disabled = !ready;
    const snapshot = politicalPresentation?.getSnapshot();
    if (opacity && snapshot) opacity.value = String(Math.round(snapshot.opacity * 100));
    if (opacityValue && snapshot) opacityValue.textContent = `${Math.round(snapshot.opacity * 100)}%`;
    if (restore) restore.disabled = !ready;

    if (!ready) {
        politicalFactionList?.render({ ready: false });
        if (addSelect) {
            addSelect.replaceChildren(new Option('Political evidence unavailable', ''));
            addSelect.disabled = true;
        }
        if (addButton) addButton.disabled = true;
        if (count) count.textContent = 'No faction palette is available.';
        return;
    }

    const includedRows = politicalFactionProjection.rows.filter(({ included }) => included);
    politicalFactionList?.render({ factions: politicalFactionProjection.rows, ready: true, search: politicalFactionSearch });

    const hiddenRows = politicalFactionProjection.rows.filter(({ included }) => !included);
    if (addSelect) {
        const retainedValue = addSelect.value;
        const options = hiddenRows.map(faction => new Option(`${faction.name} — ${faction.id}`, faction.id));
        addSelect.replaceChildren(...(options.length > 0
            ? [new Option('Select a hidden faction', ''), ...options]
            : [new Option('No hidden factions', '')]));
        addSelect.value = hiddenRows.some(({ id }) => id === retainedValue) ? retainedValue : '';
        addSelect.disabled = hiddenRows.length === 0;
    }
    if (addButton) addButton.disabled = hiddenRows.length === 0 || !addSelect?.value;
    if (count) {
        const shown = includedRows.filter(faction => {
            const searchText = `${faction.name} ${faction.id}`.toLocaleLowerCase();
            return !politicalFactionSearch || searchText.includes(politicalFactionSearch);
        }).length;
        count.textContent = `${includedRows.length} included · ${shown} shown`;
    }
}

function setupFactionColorsControls() {
    if (factionColorsReady) return;
    factionColorsReady = true;
    document.getElementById('political-opacity')?.addEventListener('input', event => {
        politicalPresentation?.setOpacity(Number(event.target.value) / 100);
    });
    document.getElementById('political-restore-defaults-btn')?.addEventListener('click', () => {
        politicalPresentation?.restoreDefaults();
    });
    const addSelect = document.getElementById('political-add-faction-select');
    const addButton = document.getElementById('political-add-faction-btn');
    addSelect?.addEventListener('change', () => {
        if (addButton) addButton.disabled = !addSelect.value;
    });
    addButton?.addEventListener('click', () => {
        if (addSelect?.value) politicalPresentation?.include(addSelect.value);
    });
    document.getElementById('political-faction-search')?.addEventListener('input', event => {
        politicalFactionSearch = event.target.value.trim().toLocaleLowerCase();
        renderFactionColorsPanel();
    });
    const list = document.getElementById('political-faction-list');
    politicalFactionList = createFactionColorList({
        list,
        onColor: (id, value) => politicalPresentation?.setColor(id, value),
        onReset: id => politicalPresentation?.resetColor(id),
        onHide: id => politicalPresentation?.hide(id)
    });
    renderFactionColorsPanel();
}

const DISCOVERY_CONTEXT_LABELS = Object.freeze({
    keyCharacters: 'Key Characters',
    bountyTargets: 'Bounty Targets',
    deadlyAnimals: 'Deadly Animals',
    fancyWeaponWielders: 'Fancy Weapon Wielders',
    nestTreasures: 'Nest Treasures',
    treasureSpots: 'Treasure Spots',
    narcotics: 'Narcotics'
});
const DISCOVERY_CONTEXT_COLLECTIONS = Object.freeze({
    treasureHunting: {
        label: 'Treasure Hunting',
        description: 'Follow valuable generated stock, death-loot provenance, and Nest treasures.'
    },
    shoppingList: {
        label: 'Shopping List',
        description: 'Explore possible vendor sources and the trade context surrounding selected goods.'
    }
});
const DISCOVERY_CONTEXT_PARENT = Object.freeze({
    treasureSpots: 'treasureHunting',
    nestTreasures: 'treasureHunting',
    fancyWeaponWielders: 'treasureHunting',
    narcotics: 'shoppingList'
});
const DISCOVERY_CONTEXT_INTRO = Object.freeze({
    keyCharacters: {
        summary: 'World-state characters with reachable map context.'
    },
    bountyTargets: {
        summary: 'Reachable characters with authored bounty amount and chance.'
    },
    deadlyAnimals: {
        summary: 'Reachable animals with notable strength or death items.'
    },
    fancyWeaponWielders: {
        summary: 'Reachable characters with possible Edge or Meitou weapons.'
    },
    nestTreasures: {
        summary: 'Valuable Nest Items at reachable Nest sources.'
    },
    treasureSpots: {
        summary: 'Towns with valuable stock or character death items.'
    },
    narcotics: {
        summary: 'Possible vendor sources for narcotics.'
    }
});
const PROSPECTING_CONTEXT_INTRO = Object.freeze({
    summary: 'Find authored areas where your selected resources and conditions meet together.'
});
const CONTEXT_HELP_TARGETS = Object.freeze({
    keyCharacters: 'guide-context-key-characters',
    bountyTargets: 'guide-context-bounty-targets',
    deadlyAnimals: 'guide-context-deadly-animals',
    treasureSpots: 'guide-context-treasure-spots',
    nestTreasures: 'guide-context-nest-treasures',
    fancyWeaponWielders: 'guide-context-fancy-weapon-wielders',
    narcotics: 'guide-context-narcotics',
    prospecting: 'guide-context-prospecting',
    factionOverview: 'guide-context-faction-overview'
});
let retainedBrowseScrollTop = 0;
let contextChromeFrame = null;

function syncContextChrome() {
    if (contextChromeFrame !== null) {
        cancelAnimationFrame(contextChromeFrame);
        contextChromeFrame = null;
    }
    const chrome = document.getElementById('browse-context-chrome');
    const route = document.getElementById('workbench-route-browse');
    if (!chrome || !route) return;
    if (chrome.dataset.subjectOpen !== 'true') {
        chrome.classList.remove('is-context-compact');
        return;
    }
    if (route.scrollTop >= 84) chrome.classList.add('is-context-compact');
    else if (route.scrollTop <= 28) chrome.classList.remove('is-context-compact');
}

function scheduleContextChromeSync() {
    if (contextChromeFrame !== null) return;
    contextChromeFrame = requestAnimationFrame(() => {
        contextChromeFrame = null;
        syncContextChrome();
    });
}

function activeDiscoveryContextSubject(state = viewportComposition.getSnapshot()) {
    return Object.hasOwn(DISCOVERY_CONTEXT_LABELS, state.contextRoute) ? state.contextRoute : null;
}

function projectActiveDiscoveryContext(subjectId = activeDiscoveryContextSubject()) {
    if (!subjectId || !discoveryContextCatalog || !discoveryCatalog) return null;
    try {
        discoveryContextProjection = projectDiscoveryContextSubject({
            contextCatalog: discoveryContextCatalog,
            discoveryCatalog,
            snapshot: scenarioSession?.getSnapshot() ?? null,
            lenses: scenarioLensProjection,
            subjectId
        });
        return discoveryContextProjection;
    } catch (error) {
        console.error('Discovery Context projection failed.', error);
        discoveryContextProjection = null;
        return null;
    }
}

function contextSearchMatch(row, subjectId, searchText) {
    if (!searchText) return true;
    const values = [row.name, row.entityId];
    if (subjectId === 'keyCharacters' || subjectId === 'bountyTargets' || subjectId === 'fancyWeaponWielders') {
        values.push(row.affiliation?.factionName, row.affiliation?.factionId);
    }
    if (subjectId === 'fancyWeaponWielders') {
        for (const weapon of row.weaponTypes ?? []) values.push(weapon.name, weapon.weaponId);
        for (const grade of row.candidateGrades ?? []) {
            values.push(grade.label, grade.modelId, grade.manufacturerName, grade.manufacturerId);
        }
    }
    if (subjectId === 'keyCharacters') {
        for (const state of row.worldStates ?? []) values.push(state.name, state.stateId);
    }
    if (subjectId === 'bountyTargets') {
        for (const issuer of row.issuers ?? []) values.push(issuer.name, issuer.factionId);
    }
    if (subjectId === 'nestTreasures') {
        for (const source of row.sources ?? []) values.push(source.name, source.nestId);
    }
    if (subjectId === 'treasureSpots') {
        for (const occurrence of row.occurrences ?? []) {
            values.push(occurrence.name, occurrence.occurrenceId);
        }
        for (const entry of [
            ...(row.vendorEvidence ?? []),
            ...(row.blockedVendorEvidence ?? []),
            ...(row.deathLootEvidence ?? [])
        ]) {
            values.push(
                entry.itemName,
                entry.itemId,
                entry.vendorListName,
                entry.vendorListId,
                entry.characterName,
                entry.characterId,
                entry.faction?.factionName,
                entry.faction?.factionId,
                entry.tradeCulture?.cultureName,
                entry.tradeCulture?.cultureId
            );
        }
    }
    if (subjectId === 'narcotics') {
        for (const entry of row.evidence ?? []) {
            values.push(
                entry.root?.name,
                entry.root?.parentId,
                entry.vendorListName,
                entry.vendorListId,
                ...(entry.squadNames ?? []),
                ...(entry.squadIds ?? []),
                entry.faction?.factionName,
                entry.faction?.factionId,
                entry.tradeCulture?.cultureName,
                entry.tradeCulture?.cultureId
            );
        }
    }
    return values.some(value => String(value ?? '').toLocaleLowerCase().includes(searchText));
}

function createContextReferenceButton(entityType, entityId, name, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `context-reference-action ${className}`.trim();
    button.dataset.contextAction = 'reference';
    button.dataset.entityType = entityType;
    button.dataset.entityId = entityId;
    button.textContent = name;
    return button;
}

function appendContextMetric(parent, label, value) {
    const item = document.createElement('span');
    const key = document.createElement('strong');
    key.textContent = label;
    item.append(key, document.createTextNode(` ${String(value)}`));
    parent.appendChild(item);
}

function createContextCharacterRow(row, subjectId, checked, controlsAvailable) {
    const article = document.createElement('article');
    article.className = `discovery-context-row context-character-row ${subjectId === 'bountyTargets' ? 'bounty-target-row' : 'key-character-row'}`;
    article.dataset.contextEntityId = row.entityId;
    const header = document.createElement('header');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    toggle.disabled = !controlsAvailable || !row.mapControlsAvailable;
    toggle.dataset.contextAction = 'toggle-character';
    toggle.dataset.subjectId = subjectId;
    toggle.dataset.entityId = row.entityId;
    toggle.setAttribute('aria-label', `Show ${row.name} on the map`);
    const identity = document.createElement('div');
    identity.append(
        createContextReferenceButton('character', row.entityId, row.name, 'context-row-title')
    );
    const stableId = document.createElement('code');
    stableId.textContent = row.entityId;
    identity.appendChild(stableId);
    header.append(toggle, identity);
    if (subjectId === 'bountyTargets') {
        const amount = document.createElement('span');
        amount.className = 'context-treasure-value context-bounty-amount';
        amount.textContent = `c.${row.bountyAmount.toLocaleString()}`;
        header.appendChild(amount);
    }

    const metrics = document.createElement('div');
    metrics.className = 'context-row-metrics';
    appendContextMetric(metrics, 'Faction', row.affiliation?.factionName ?? 'Unattributed');
    appendContextMetric(metrics, 'Status', row.lifeStatusLabel);
    if (subjectId === 'keyCharacters') {
        appendContextMetric(metrics, 'World states', row.worldStates?.length ?? 0);
    } else {
        appendContextMetric(metrics, 'Chance', row.bountyChance);
    }
    appendContextMetric(metrics, 'Current', row.currentLocationCount);
    appendContextMetric(metrics, 'Conditional', row.conditionalLocationCount);
    article.append(header, metrics);

    if (subjectId === 'bountyTargets') {
        const wantedBy = document.createElement('p');
        wantedBy.className = 'context-bounty-issuers';
        const label = document.createElement('strong');
        label.textContent = 'Wanted by';
        const issuerText = row.issuers?.length > 0
            ? row.issuers
                .map(issuer => issuer.resolved ? issuer.name : `${issuer.name} (unresolved)`)
                .join(', ')
            : 'Not authored';
        wantedBy.append(label, document.createTextNode(` ${issuerText}`));
        article.appendChild(wantedBy);
    }
    return article;
}

function createFancyWeaponWielderRow(row, checked, controlsAvailable) {
    const article = document.createElement('article');
    article.className = 'discovery-context-row context-wielder-row';
    article.dataset.contextEntityId = row.entityId;
    const header = document.createElement('header');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    toggle.disabled = !controlsAvailable || !row.mapControlsAvailable;
    toggle.dataset.contextAction = 'toggle-character';
    toggle.dataset.subjectId = 'fancyWeaponWielders';
    toggle.dataset.entityId = row.entityId;
    toggle.setAttribute('aria-label', `Show possible weapon wielder ${row.name} on the map`);
    const identity = document.createElement('div');
    identity.append(createContextReferenceButton('character', row.entityId, row.name, 'context-row-title'));
    const stableId = document.createElement('code');
    stableId.textContent = row.entityId;
    identity.appendChild(stableId);
    header.append(toggle, identity);

    const metrics = document.createElement('div');
    metrics.className = 'context-row-metrics';
    appendContextMetric(metrics, 'Faction', row.affiliation?.factionName ?? 'Unattributed');
    appendContextMetric(metrics, 'Status', row.lifeStatusLabel);
    appendContextMetric(metrics, 'Current', row.currentLocationCount);
    appendContextMetric(metrics, 'Conditional', row.conditionalLocationCount);

    const grades = document.createElement('div');
    grades.className = 'context-reason-badges context-wielder-grades';
    const gradeLabel = document.createElement('strong');
    gradeLabel.textContent = 'Possible grades';
    grades.appendChild(gradeLabel);
    for (const grade of [...new Set(row.candidateGrades.map(({ label }) => label))]) {
        const badge = document.createElement('span');
        badge.textContent = grade;
        grades.appendChild(badge);
    }

    const weapons = document.createElement('div');
    weapons.className = 'context-wielder-weapons';
    const weaponLabel = document.createElement('strong');
    weaponLabel.textContent = 'Authored weapon types';
    weapons.appendChild(weaponLabel);
    const groupedWeapons = new Map();
    for (const weapon of row.weaponTypes) {
        const existing = groupedWeapons.get(weapon.weaponId);
        groupedWeapons.set(weapon.weaponId, {
            ...weapon,
            count: (existing?.count ?? 0) + 1
        });
    }
    for (const weapon of groupedWeapons.values()) {
        const action = createContextReferenceButton('weapon', weapon.weaponId, weapon.name, 'context-source-title');
        if (weapon.count > 1) action.append(document.createTextNode(` ×${String(weapon.count)}`));
        weapons.appendChild(action);
    }

    const evidence = document.createElement('details');
    evidence.className = 'context-wielder-evidence';
    const summary = document.createElement('summary');
    summary.textContent = 'Grade source references';
    evidence.appendChild(summary);
    const list = document.createElement('ul');
    for (const grade of row.candidateGrades) {
        const item = document.createElement('li');
        item.textContent = `${grade.label} via ${grade.manufacturerName} (${grade.manufacturerId})`;
        list.appendChild(item);
    }
    evidence.appendChild(list);
    article.append(header, metrics, grades, weapons, evidence);
    return article;
}

function createDeadlyAnimalRow(row, checked, controlsAvailable) {
    const article = document.createElement('article');
    article.className = 'discovery-context-row deadly-animal-row';
    article.dataset.contextEntityId = row.entityId;
    const header = document.createElement('header');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    toggle.disabled = !controlsAvailable;
    toggle.dataset.contextAction = 'toggle-animal';
    toggle.dataset.entityId = row.entityId;
    toggle.setAttribute('aria-label', `Show ${row.name} on the map`);
    const identity = document.createElement('div');
    identity.append(
        createContextReferenceButton('character', row.entityId, row.name, 'context-row-title')
    );
    const stableId = document.createElement('code');
    stableId.textContent = row.entityId;
    identity.appendChild(stableId);
    header.append(toggle, identity);

    const badges = document.createElement('div');
    badges.className = 'context-reason-badges';
    for (const reason of row.reasons) {
        const badge = document.createElement('span');
        badge.textContent = reason === 'strength' ? 'Strength 50+' : 'Trophies 5,000+';
        badges.appendChild(badge);
    }
    const metrics = document.createElement('div');
    metrics.className = 'context-row-metrics';
    appendContextMetric(metrics, 'Strength', row.strength ?? 'Unknown');
    appendContextMetric(metrics, 'Death items', row.deathItemValue.toLocaleString());
    appendContextMetric(metrics, 'Current', row.currentLocationCount);
    appendContextMetric(metrics, 'Conditional', row.conditionalLocationCount);
    article.append(header, badges, metrics);
    return article;
}

function createNestTreasureRow(row, checkedKeys, controlsAvailable) {
    const article = document.createElement('article');
    article.className = 'discovery-context-row nest-treasure-row';
    article.dataset.contextEntityId = row.entityId;
    const header = document.createElement('header');
    const identity = document.createElement('div');
    identity.append(
        createContextReferenceButton('nestItem', row.entityId, row.name, 'context-row-title')
    );
    const stableId = document.createElement('code');
    stableId.textContent = row.entityId;
    identity.appendChild(stableId);
    const value = document.createElement('span');
    value.className = 'context-treasure-value';
    value.textContent = `Value ${row.value.toLocaleString()}`;
    header.append(identity, value);

    const sources = document.createElement('details');
    sources.className = 'context-source-list';
    sources.open = row.sources.length <= 3;
    const summary = document.createElement('summary');
    summary.textContent = `${String(row.sources.length)} reachable source ${row.sources.length === 1 ? 'Nest' : 'Nests'}`;
    sources.appendChild(summary);
    for (const source of row.sources) {
        const sourceRow = document.createElement('div');
        sourceRow.className = 'context-source-row';
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = checkedKeys.has(`${row.entityId}\u0000${source.nestId}`);
        toggle.disabled = !controlsAvailable || !source.mapControlsAvailable;
        toggle.dataset.contextAction = 'toggle-nest-source';
        toggle.dataset.nestItemId = row.entityId;
        toggle.dataset.nestId = source.nestId;
        toggle.setAttribute('aria-label', `Show ${row.name} source ${source.name} on the map`);
        const sourceIdentity = document.createElement('div');
        sourceIdentity.append(
            createContextReferenceButton('nest', source.nestId, source.name, 'context-source-title')
        );
        const sourceId = document.createElement('code');
        sourceId.textContent = source.nestId;
        sourceIdentity.appendChild(sourceId);
        const counts = document.createElement('small');
        counts.textContent = `${String(source.currentLocationCount)} current · ${String(source.conditionalLocationCount)} conditional`;
        sourceRow.append(toggle, sourceIdentity, counts);
        sources.appendChild(sourceRow);
    }
    article.append(header, sources);
    return article;
}

function appendContextBadge(parent, label, className = '') {
    const badge = document.createElement('span');
    badge.className = className;
    badge.textContent = label;
    parent.appendChild(badge);
}

function createLazyContextEvidence(label, subjectId, entityId, evidenceKind, count) {
    const details = document.createElement('details');
    details.className = 'context-source-list context-evidence-list';
    details.dataset.contextLazyEvidence = evidenceKind;
    details.dataset.contextSubjectId = subjectId;
    details.dataset.contextEntityId = entityId;
    details.dataset.materialized = 'false';
    const summary = document.createElement('summary');
    summary.textContent = `${label} (${String(count)})`;
    details.appendChild(summary);
    return details;
}

function createTreasureSpotRow(row, checked, controlsAvailable) {
    const article = document.createElement('article');
    article.className = 'discovery-context-row treasure-spot-row';
    article.dataset.contextEntityId = row.townId;
    const header = document.createElement('header');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    toggle.disabled = !controlsAvailable || !row.mapControlsAvailable;
    toggle.dataset.contextAction = 'toggle-treasure-town';
    toggle.dataset.entityId = row.townId;
    toggle.setAttribute('aria-label', `Show every eligible occurrence of ${row.name} on the map`);
    const identity = document.createElement('div');
    const occurrenceToggle = document.createElement('button');
    occurrenceToggle.type = 'button';
    occurrenceToggle.className = 'context-reference-action context-row-title';
    occurrenceToggle.dataset.contextAction = 'toggle-occurrences';
    occurrenceToggle.dataset.entityId = row.townId;
    occurrenceToggle.setAttribute('aria-expanded', 'false');
    occurrenceToggle.textContent = row.name;
    const stableId = document.createElement('code');
    stableId.textContent = row.townId;
    identity.append(occurrenceToggle, stableId);
    header.append(toggle, identity);

    const badges = document.createElement('div');
    badges.className = 'context-reason-badges';
    if (row.qualificationKinds.includes('valuableStock')) {
        appendContextBadge(badges, 'High-value stock 5,000+');
    }
    if (row.qualificationKinds.includes('deathLoot')) {
        appendContextBadge(badges, 'Individual death loot 5,000+');
    }
    if (row.uncertainLocationCount > 0) {
        appendContextBadge(badges, 'Uncertain valuable stock', 'is-uncertain');
    }
    const metrics = document.createElement('div');
    metrics.className = 'context-row-metrics';
    appendContextMetric(metrics, 'Occurrences', row.occurrences.length);
    appendContextMetric(metrics, 'Current', row.currentLocationCount);
    appendContextMetric(metrics, 'Conditional', row.conditionalLocationCount);
    appendContextMetric(metrics, 'Uncertain', row.uncertainLocationCount);

    const occurrences = document.createElement('div');
    occurrences.className = 'context-occurrence-links';
    occurrences.dataset.contextOccurrences = row.townId;
    occurrences.hidden = true;
    for (const occurrence of row.occurrences) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'context-geographic-action';
        button.dataset.contextAction = 'geographic';
        button.dataset.entityType = 'town';
        button.dataset.entityId = row.townId;
        button.dataset.instanceId = occurrence.occurrenceId;
        button.textContent = `${occurrence.name} — ${occurrence.state}`;
        occurrences.appendChild(button);
    }
    const possibleStock = createLazyContextEvidence(
        'Possible generated stock',
        'treasureSpots',
        row.townId,
        'vendorEvidence',
        row.vendorEvidence.length
    );
    const deathLoot = createLazyContextEvidence(
        'Death-loot provenance',
        'treasureSpots',
        row.townId,
        'deathLootEvidence',
        row.deathLootEvidence.length
    );
    const blocked = createLazyContextEvidence(
        'Blocked by trade culture',
        'treasureSpots',
        row.townId,
        'blockedVendorEvidence',
        row.blockedVendorEvidence.length
    );
    blocked.hidden = row.blockedVendorEvidence.length === 0;
    article.append(header, badges, metrics, occurrences, possibleStock, deathLoot, blocked);
    return article;
}

function createNarcoticRow(row, checked, prohibitionId, controlsAvailable) {
    const article = document.createElement('article');
    article.className = 'discovery-context-row narcotic-row';
    article.dataset.contextEntityId = row.entityId;
    const header = document.createElement('header');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    toggle.disabled = !controlsAvailable || !row.mapControlsAvailable;
    toggle.dataset.contextAction = 'toggle-narcotic';
    toggle.dataset.entityId = row.entityId;
    toggle.setAttribute('aria-label', `Show possible ${row.name} purchase sources on the map`);
    const identity = document.createElement('div');
    identity.append(createContextReferenceButton('item', row.entityId, row.name, 'context-row-title'));
    const stableId = document.createElement('code');
    stableId.textContent = row.entityId;
    identity.appendChild(stableId);
    header.append(toggle, identity);
    if (row.value !== null) {
        const value = document.createElement('span');
        value.className = 'context-treasure-value';
        value.textContent = `Value ${row.value.toLocaleString()}`;
        header.appendChild(value);
    }

    const metrics = document.createElement('div');
    metrics.className = 'context-row-metrics';
    appendContextMetric(metrics, 'Current', row.currentLocationCount);
    appendContextMetric(metrics, 'Conditional', row.conditionalLocationCount);
    appendContextMetric(metrics, 'Uncertain', row.uncertainLocationCount);
    appendContextMetric(metrics, 'Blocked', row.blockedLocationCount);

    const prohibition = document.createElement('button');
    prohibition.type = 'button';
    prohibition.className = 'context-prohibition-action';
    prohibition.dataset.contextAction = 'prohibition';
    prohibition.dataset.entityId = row.entityId;
    prohibition.setAttribute('aria-pressed', String(prohibitionId === row.entityId));
    prohibition.disabled = !row.prohibitionAuthored || narcoticProhibitionStatus !== 'ready';
    prohibition.textContent = row.prohibitionAuthored
        ? prohibitionId === row.entityId
            ? 'Hide Prohibition'
            : 'Show Prohibition'
        : 'No authored prohibition';

    const confirmed = createLazyContextEvidence(
        'Possible vendor stock',
        'narcotics',
        row.entityId,
        'confirmedEvidence',
        row.confirmedEvidence.length
    );
    const uncertain = createLazyContextEvidence(
        'Uncertain vendor evidence',
        'narcotics',
        row.entityId,
        'uncertainEvidence',
        row.uncertainEvidence.length
    );
    uncertain.hidden = row.uncertainEvidence.length === 0;
    const blocked = createLazyContextEvidence(
        'Blocked by trade culture',
        'narcotics',
        row.entityId,
        'blockedEvidence',
        row.blockedEvidence.length
    );
    blocked.hidden = row.blockedEvidence.length === 0;
    article.append(header, metrics, prohibition, confirmed, uncertain, blocked);
    return article;
}

function appendContextEvidenceEntry(parent, entry) {
    const row = document.createElement('div');
    row.className = 'context-evidence-row';
    const title = document.createElement('strong');
    if (entry.kind === 'deathLoot') {
        title.textContent = `${entry.characterName} — ${entry.itemName}`;
    } else {
        title.textContent = `${entry.itemName} — ${entry.root?.name ?? 'Unknown location'}`;
    }
    const detail = document.createElement('small');
    const parts = entry.kind === 'deathLoot'
        ? [`Value ${Number(entry.itemValue).toLocaleString()}`, 'authored death item']
        : [
            entry.vendorListName,
            entry.faction?.factionName ?? 'Unattributed faction',
            entry.tradeCulture?.cultureName ?? 'Unattributed trade culture',
            entry.availability === 'uncertain' ? 'uncertain filtering' : entry.availability
        ];
    detail.textContent = parts.filter(Boolean).join(' · ');
    row.append(title, detail);
    parent.appendChild(row);
}

function materializeContextEvidence(details) {
    if (details.dataset.materialized === 'true') return;
    const subjectId = details.dataset.contextSubjectId;
    const entityId = details.dataset.contextEntityId;
    const evidenceKind = details.dataset.contextLazyEvidence;
    const projection = projectActiveDiscoveryContext(subjectId);
    const row = projection?.rows?.find(candidate =>
        (subjectId === 'treasureSpots' ? candidate.townId : candidate.entityId) === entityId
    );
    const evidence = row?.[evidenceKind] ?? [];
    const fragment = document.createDocumentFragment();
    for (const entry of evidence) appendContextEvidenceEntry(fragment, entry);
    if (evidence.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'context-evidence-empty';
        empty.textContent = 'No evidence in the current scenario.';
        fragment.appendChild(empty);
    }
    details.appendChild(fragment);
    details.dataset.materialized = 'true';
}

function prospectingNumericValue(area, id) {
    const farming = id === 'arid' || id === 'green' || id === 'swamp';
    return area.resources?.[farming ? 'fertility' : 'multipliers']?.[id] ?? null;
}

function formatProspectingReading(raw, farming) {
    const reading = formatResourceReading(raw, farming);
    return reading.text === '—' ? '—' : `${reading.text}${farming ? '%' : '×'}`;
}

function formatProspectingMinimum(raw, farming) {
    if (raw === 0) return 'Any positive';
    const value = farming ? raw * 100 : raw;
    const displayed = Number(value.toPrecision(6));
    const approximation = displayed === value ? '' : '≈';
    return `${approximation}${new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(value)}${farming ? '%' : '×'} or more`;
}

function appendProspectingReadings(parent, heading, readings) {
    const group = document.createElement('section');
    group.className = 'prospecting-row-reading-group';
    const title = document.createElement('h4');
    title.textContent = heading;
    const list = document.createElement('dl');
    for (const [label, value] of readings) {
        const row = document.createElement('div');
        const key = document.createElement('dt');
        key.textContent = label;
        const detail = document.createElement('dd');
        detail.textContent = value;
        row.append(key, detail);
        list.append(row);
    }
    group.append(title, list);
    parent.append(group);
}

function createProspectingRow(area, selectedNumericIds, selectedConditionIds) {
    const article = document.createElement('article');
    article.className = 'discovery-context-row prospecting-row';
    article.dataset.contextEntityId = area.id;
    const header = document.createElement('header');
    header.className = 'prospecting-row-header';
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = area.name;
    const id = document.createElement('code');
    id.textContent = area.id;
    identity.append(name, id);
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.textContent = 'Inspect Area';
    inspect.dataset.contextAction = 'geographic';
    inspect.dataset.entityType = 'spawnArea';
    inspect.dataset.entityId = area.id;
    inspect.disabled = !selectionSession;
    header.append(identity, inspect);
    const matches = document.createElement('div');
    matches.className = 'prospecting-row-matches';
    for (const criterion of NUMERIC_CRITERIA.filter(({ id: key }) => selectedNumericIds.includes(key))) {
        const chip = document.createElement('span');
        const farming = ['arid', 'green', 'swamp'].includes(criterion.id);
        chip.textContent = `${criterion.label} ${formatProspectingReading(prospectingNumericValue(area, criterion.id), farming)}`;
        matches.append(chip);
    }
    for (const criterion of CONDITION_CRITERIA.filter(({ id: key }) => selectedConditionIds.includes(key))) {
        const chip = document.createElement('span');
        chip.textContent = `${criterion.label} recorded`;
        matches.append(chip);
    }
    article.append(header, matches);

    const notices = [];
    if (area.mapStatus === 'unmapped') notices.push('This area has no resolved raster pixels; a precise map location is unavailable.');
    if (area.mapStatus === 'shared') notices.push('This area shares a raster color; its map shape is ambiguous.');
    if (area.mapStatus === 'geography-unavailable') notices.push('Map geography is unavailable; authored readings remain available.');
    if (area.resourceStatus !== 'available' || NUMERIC_CRITERIA.some(({ id: key }) =>
        formatProspectingReading(prospectingNumericValue(area, key), ['arid', 'green', 'swamp'].includes(key)) === '—'
    )) notices.push('Some resource readings are unavailable; — does not mean zero.');
    if (area.unresolvedWeather || area.conditions.some(({ state }) => state === 'unavailable' || state === 'not-authored')) {
        notices.push('Some conditions cannot be ruled out from the authored weather data.');
    }
    for (const message of notices) {
        const note = document.createElement('p');
        note.className = 'prospecting-row-warning';
        note.textContent = message;
        article.append(note);
    }

    const details = document.createElement('details');
    details.className = 'prospecting-row-details';
    const summary = document.createElement('summary');
    summary.textContent = 'All area readings';
    details.append(summary);
    appendProspectingReadings(details, 'Fertility', NUMERIC_CRITERIA
        .filter(({ id: key }) => ['arid', 'green', 'swamp'].includes(key))
        .map(({ id: key, label }) => [label, formatProspectingReading(prospectingNumericValue(area, key), true)]));
    appendProspectingReadings(details, 'Resources', NUMERIC_CRITERIA
        .filter(({ id: key }) => !['arid', 'green', 'swamp'].includes(key))
        .map(({ id: key, label }) => [label, formatProspectingReading(prospectingNumericValue(area, key), false)]));
    appendProspectingReadings(details, 'Weather & Zone Effects', CONDITION_CRITERIA.map(({ id: key, label }) => {
        const state = area.conditions.find(condition => condition.id === key)?.state ?? 'unavailable';
        return [label, ({ recorded: 'Recorded', 'not-recorded': 'Not recorded', 'not-authored': 'Not authored', unavailable: 'Unavailable' })[state] ?? 'Unavailable'];
    }));
    article.append(details);
    return article;
}

function renderProspectingPresentation() {
    const snapshot = prospectingPresentation.getSnapshot();
    const catalog = prospectingCatalog;
    const projection = projectProspecting({
        catalog,
        selectedNumeric: snapshot.selectedNumericIds,
        minimums: snapshot.minimumByNumericId,
        selectedConditions: snapshot.selectedConditionIds
    });
    const title = document.getElementById('browse-context-title');
    const summary = document.getElementById('browse-context-summary');
    const back = document.getElementById('browse-context-back-btn');
    const status = document.getElementById('browse-context-status');
    const search = document.getElementById('browse-context-search-input');
    const count = document.getElementById('browse-context-result-count');
    const results = document.getElementById('browse-context-results');
    if (results) results.hidden = false;
    const bulk = document.querySelector('#browse-context-subject .browse-context-bulk-actions');
    const controls = document.getElementById('browse-prospecting-controls');
    const clear = document.getElementById('browse-prospecting-clear-btn');
    const mapStatus = document.getElementById('browse-prospecting-map-status');
    const legend = document.getElementById('browse-prospecting-legend');
    if (title) title.textContent = 'Prospecting';
    if (summary) summary.textContent = PROSPECTING_CONTEXT_INTRO.summary;
    if (back) back.textContent = '← Context';
    if (bulk) bulk.hidden = true;
    if (controls) controls.hidden = false;
    if (status) {
        status.textContent = !catalog?.available
            ? 'Environmental data is unavailable; Prospecting cannot evaluate areas.'
            : projection.uncertainCount > 0
                ? `${String(projection.uncertainCount)} area${projection.uncertainCount === 1 ? '' : 's'} with unavailable selected evidence excluded from confirmed matches.`
                : '';
        status.hidden = !status.textContent;
        status.dataset.level = 'warning';
    }
    if (clear) clear.disabled = projection.criteriaCount === 0 && !NUMERIC_CRITERIA.some(({ id }) =>
        snapshot.minimumByNumericId[id] > 0
    );
    if (search && search.value !== snapshot.search) search.value = snapshot.search;
    const selectedNumeric = new Set(snapshot.selectedNumericIds);
    const selectedConditions = new Set(snapshot.selectedConditionIds);
    for (const input of controls?.querySelectorAll('[data-prospecting-criterion]') ?? []) {
        const id = input.value;
        input.checked = (NUMERIC_CRITERIA.some(criterion => criterion.id === id) ? selectedNumeric : selectedConditions).has(id);
        input.disabled = !catalog?.available;
    }
    for (const row of controls?.querySelectorAll('[data-prospecting-slider-row]') ?? []) {
        const id = row.dataset.prospectingSliderRow;
        const input = row.querySelector('[data-prospecting-minimum]');
        const output = row.querySelector('output');
        const maximum = catalog?.maxima?.[id] ?? 0;
        const minimum = Math.min(snapshot.minimumByNumericId[id] ?? 0, maximum);
        const farming = ['arid', 'green', 'swamp'].includes(id);
        row.hidden = !selectedNumeric.has(id);
        if (!input) continue;
        input.max = String(maximum);
        input.value = String(minimum);
        input.disabled = !catalog?.available || maximum <= 0;
        input.setAttribute('aria-valuetext', formatProspectingMinimum(minimum, farming));
        if (output) output.textContent = formatProspectingMinimum(minimum, farming);
    }
    if (mapStatus) {
        mapStatus.textContent = projection.criteriaCount > 0 ? prospectingOverlayReason : '';
        mapStatus.hidden = !mapStatus.textContent;
    }
    if (legend) legend.hidden = projection.matchingAreaIds.length === 0 ||
        !discoveryContextAreaIndex || Boolean(prospectingOverlayReason);
    if (count) {
        count.hidden = !catalog?.available || projection.criteriaCount === 0;
        const searchText = snapshot.search.trim().toLocaleLowerCase();
        const shown = projection.areas.filter(area =>
            !searchText || area.name.toLocaleLowerCase().includes(searchText) || area.id.toLocaleLowerCase().includes(searchText)
        ).length;
        count.textContent = `${String(shown)} of ${String(projection.areas.length)} matching areas shown`;
    }
    if (!results) return;
    if (!catalog?.available || projection.criteriaCount === 0) {
        const prompt = document.createElement('p');
        prompt.className = 'browse-context-status';
        prompt.textContent = catalog?.available
            ? 'Select a fertility, resource, weather, or zone effect to find matching areas.'
            : 'Prospecting readings are unavailable until the environmental data loads.';
        results.replaceChildren(prompt);
        return;
    }
    const searchText = snapshot.search.trim().toLocaleLowerCase();
    const shown = projection.areas.filter(area =>
        !searchText || area.name.toLocaleLowerCase().includes(searchText) || area.id.toLocaleLowerCase().includes(searchText)
    );
    if (!shown.length) {
        const empty = document.createElement('p');
        empty.className = 'browse-context-status';
        empty.textContent = projection.areas.length
            ? 'No matching area names or IDs.'
            : 'No authored areas satisfy every selected criterion.';
        results.replaceChildren(empty);
        return;
    }
    results.replaceChildren(...shown.map(area =>
        createProspectingRow(area, snapshot.selectedNumericIds, snapshot.selectedConditionIds)
    ));
}

function factionOverviewAction(label, action, entityType, entityId, instanceId = null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = label;
    button.dataset.factionOverviewAction = action;
    if (entityType) button.dataset.entityType = entityType;
    if (entityId) button.dataset.entityId = entityId;
    if (instanceId) button.dataset.instanceId = instanceId;
    button.dataset.factionActionKey = [action, entityType, entityId, instanceId].filter(Boolean).join(':');
    return button;
}

function appendFactionOverviewSection(parent, label, entries, renderEntry) {
    const details = document.createElement('details');
    details.className = 'browse-faction-report-section';
    details.dataset.factionSection = label;
    const summary = document.createElement('summary');
    summary.textContent = `${label} (${String(entries.length)})`;
    details.append(summary);
    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'browse-faction-report-note';
        empty.textContent = 'None';
        details.append(empty);
    } else {
        const list = document.createElement('ul');
        for (const entry of entries) {
            const item = document.createElement('li');
            item.className = 'browse-faction-report-entry';
            renderEntry(item, entry);
            list.append(item);
        }
        details.append(list);
    }
    parent.append(details);
}

function appendFactionOverviewIdentity(item, name, id) {
    const identity = document.createElement('span');
    identity.className = 'browse-faction-report-entry-identity';
    const title = document.createElement('strong');
    title.textContent = name || id;
    const stableId = document.createElement('small');
    stableId.textContent = id;
    identity.append(title, stableId);
    item.append(identity);
}

function appendFactionOverviewActions(item, ...buttons) {
    const actions = document.createElement('span');
    actions.className = 'browse-faction-report-entry-actions';
    actions.append(...buttons);
    item.append(actions);
}

function renderSelectedFactionOverview(entry, reportElement) {
    const previousOpen = new Set([...reportElement.querySelectorAll('details[open]')]
        .map(details => details.dataset.factionSection));
    const focusedKey = reportElement.contains(document.activeElement)
        ? document.activeElement.dataset?.factionActionKey ?? null
        : null;
    const fragment = document.createElement('article');
    const header = document.createElement('header');
    header.className = 'browse-faction-report-header';
    const heading = document.createElement('h3');
    heading.textContent = entry.name;
    const stableId = document.createElement('small');
    stableId.textContent = entry.id;
    header.append(heading, stableId);
    fragment.append(header);

    const status = document.createElement('p');
    status.className = 'browse-faction-report-status';
    status.textContent = ({
        current: 'Current mapped presence',
        conditional: 'Conditional evidence only',
        none: 'No current mapped presence',
        unavailable: 'Scenario analysis unavailable'
    })[entry.status] ?? 'Scenario analysis unavailable';
    fragment.append(status);

    const actions = document.createElement('div');
    actions.className = 'browse-faction-report-actions';
    const ranksAction = factionOverviewAction('Power Ranks', 'power-ranks', 'faction', entry.id);
    ranksAction.disabled = !scenarioLensProjection;
    if (ranksAction.disabled) ranksAction.title = 'Power Ranks requires scenario analysis.';
    actions.append(
        factionOverviewAction('Open Faction Reference', 'reference', 'faction', entry.id),
        ranksAction
    );
    fragment.append(actions);

    const report = entry.report;
    if (!entry.available || !report) {
        const unavailable = document.createElement('p');
        unavailable.className = 'browse-faction-report-note';
        unavailable.textContent = 'Current spawn, character, and town evidence cannot be projected for this manifest. Faction reference remains available.';
        fragment.append(unavailable);
        reportElement.replaceChildren(fragment);
        return;
    }

    const metrics = document.createElement('div');
    metrics.className = 'browse-faction-report-metrics';
    for (const [label, value] of [
        ['Spawn Presence', `${String(report.spawnPresence.areaCount)} active areas · ${String(report.spawnPresence.squadCount)} unique squads`],
        ['World-State Characters', `${String(report.worldStateCharacters.aliveCount)} alive · ${String(report.worldStateCharacters.totalCount)} affiliated`],
        ['Town Control', `${String(report.townsOwned)} current · +${String(report.townsGained)} gained · −${String(report.townsLost)} lost`]
    ]) {
        const metric = document.createElement('div');
        metric.className = 'browse-faction-report-metric';
        const key = document.createElement('h4');
        key.textContent = label;
        const reading = document.createElement('p');
        reading.textContent = value;
        metric.append(key, reading);
        metrics.append(metric);
    }
    fragment.append(metrics);

    appendFactionOverviewSection(fragment, 'Active Spawn Areas', report.spawnPresence.areas, (item, area) => {
        appendFactionOverviewIdentity(item, area.name, area.id);
        appendFactionOverviewActions(item, factionOverviewAction('Inspect Area', 'geographic', 'spawnArea', area.id));
    });
    appendFactionOverviewSection(fragment, 'Squad Templates', report.spawnPresence.squads, (item, squad) => {
        appendFactionOverviewIdentity(item, squad.name, squad.id);
        appendFactionOverviewActions(item, factionOverviewAction('Reference', 'reference', 'squad', squad.id));
    });
    appendFactionOverviewSection(fragment, 'Tracked World-State Characters', report.worldStateCharacters.entries, (item, character) => {
        appendFactionOverviewIdentity(item, character.name, character.id);
        const lifeStatus = document.createElement('span');
        lifeStatus.textContent = character.statusLabel;
        item.append(lifeStatus);
        appendFactionOverviewActions(item, factionOverviewAction('Reference', 'reference', 'character', character.id));
    });
    appendFactionOverviewSection(fragment, 'Currently Owned Towns', report.townControl.current, (item, town) => {
        appendFactionOverviewIdentity(item, town.name, town.baseTownId);
        const occurrences = (entry.townOccurrences ?? []).filter(occurrence =>
            occurrence.baseTownId === town.baseTownId
        );
        if (occurrences.length === 0) {
            appendFactionOverviewActions(item, factionOverviewAction('Inspect Town', 'geographic', 'town', town.baseTownId));
        } else {
            appendFactionOverviewActions(item, ...occurrences.map(occurrence =>
                factionOverviewAction(
                    occurrences.length > 1 ? `Inspect ${occurrence.id}` : 'Inspect Town',
                    'geographic', 'town', town.baseTownId, occurrence.id
                )
            ));
            if (occurrences.some(occurrence => !occurrence.coordinate)) {
                const note = document.createElement('small');
                note.textContent = 'A map occurrence lacks a reliable position; Inspect opens its context without a precise zoom.';
                item.append(note);
            }
        }
    });
    appendFactionOverviewSection(fragment, 'Gained Towns', report.townControl.gained, (item, town) => {
        appendFactionOverviewIdentity(item, town.name, town.id);
        if (town.id !== town.baseTownId) {
            const base = document.createElement('small');
            base.textContent = `Base town: ${town.baseTownId}`;
            item.append(base);
        }
        appendFactionOverviewActions(item, factionOverviewAction('Reference', 'reference', 'town', town.id));
    });
    appendFactionOverviewSection(fragment, 'Lost Towns', report.townControl.lost, (item, town) => {
        appendFactionOverviewIdentity(item, town.name, town.id);
        if (town.id !== town.baseTownId) {
            const base = document.createElement('small');
            base.textContent = `Base town: ${town.baseTownId}`;
            item.append(base);
        }
        appendFactionOverviewActions(item, factionOverviewAction('Reference', 'reference', 'town', town.id));
    });
    if (entry.conditionalAreaIds?.length) {
        appendFactionOverviewSection(fragment, 'Conditional Squad Areas', entry.conditionalAreaIds, (item, areaId) => {
            const areaName = scenarioBaseline?.spawnAreaById?.[areaId]?.name ?? areaId;
            appendFactionOverviewIdentity(item, areaName, areaId);
            appendFactionOverviewActions(item, factionOverviewAction('Inspect Area', 'geographic', 'spawnArea', areaId));
        });
    }
    reportElement.replaceChildren(fragment);
    for (const details of reportElement.querySelectorAll('details[data-faction-section]')) {
        details.open = previousOpen.has(details.dataset.factionSection);
    }
    if (focusedKey) {
        const target = [...reportElement.querySelectorAll('[data-faction-action-key]')].find(
            candidate => candidate.dataset.factionActionKey === focusedKey
        );
        target?.focus({ preventScroll: true });
    }
}

function renderFactionOverviewPresentation() {
    const title = document.getElementById('browse-context-title');
    const summary = document.getElementById('browse-context-summary');
    const back = document.getElementById('browse-context-back-btn');
    const status = document.getElementById('browse-context-status');
    const search = document.getElementById('browse-context-search-input');
    const bulk = document.querySelector('#browse-context-subject .browse-context-bulk-actions');
    const count = document.getElementById('browse-context-result-count');
    const results = document.getElementById('browse-context-results');
    const controls = document.getElementById('browse-faction-overview-controls');
    const picker = document.getElementById('browse-faction-picker');
    const pickerCount = document.getElementById('browse-faction-picker-count');
    const diagnosticsElement = document.getElementById('browse-faction-diagnostics');
    const clear = document.getElementById('browse-faction-clear-btn');
    const reportElement = document.getElementById('browse-faction-report');
    const mapStatus = document.getElementById('browse-faction-map-status');
    const legend = document.getElementById('browse-faction-legend');
    const snapshot = factionOverviewPresentation.getSnapshot();
    const roster = factionOverviewCatalog?.factions ?? [];
    const selectedFaction = roster.find(faction => faction.id === snapshot.selectedFactionId) ?? null;
    const selected = factionOverviewProjection?.entries?.find(entry => entry.id === snapshot.selectedFactionId) ??
        (selectedFaction
            ? { ...selectedFaction,
                available: false, status: 'unavailable', report: null, townOccurrences: [] }
            : null);
    if (title) title.textContent = 'Faction Overview';
    if (summary) summary.textContent = 'Explore one faction’s current mapped presence and scenario status.';
    if (back) back.textContent = '← Context';
    if (controls) controls.hidden = false;
    if (bulk) bulk.hidden = true;
    if (count) count.hidden = true;
    if (results) {
        results.hidden = true;
        results.replaceChildren();
    }
    const diagnostics = factionOverviewProjection?.diagnostics ?? [];
    if (status) {
        const diagnosticCount = diagnostics.length;
        const messages = [
            factionOverviewCatalog?.available === false
                ? 'Faction reference evidence is unavailable for this manifest.'
                : null,
            factionOverviewCatalog?.available && factionOverviewProjection?.available !== true
                ? 'Scenario analysis is unavailable; choose a faction to open its reference record.'
                : null,
            diagnosticCount
                ? `${String(diagnosticCount)} evidence diagnostic${diagnosticCount === 1 ? '' : 's'}; inspect details below.`
                : null
        ].filter(Boolean);
        status.textContent = [...new Set(messages)].join(' ');
        status.hidden = !status.textContent;
        status.dataset.level = 'warning';
    }
    if (diagnosticsElement) {
        diagnosticsElement.hidden = diagnostics.length === 0;
        const diagnosticSummary = diagnosticsElement.querySelector('summary');
        const diagnosticList = diagnosticsElement.querySelector('ul');
        if (diagnosticSummary) diagnosticSummary.textContent = `Evidence diagnostics (${String(diagnostics.length)})`;
        if (diagnosticList) {
            const visible = diagnostics.slice(0, 50);
            diagnosticList.replaceChildren(...visible.map(diagnostic => {
                const item = document.createElement('li');
                item.className = 'browse-faction-report-entry';
                const kind = document.createElement('strong');
                kind.textContent = diagnostic.kind ?? 'Evidence';
                const id = document.createElement('small');
                id.textContent = diagnostic.entityId ?? '';
                const reason = document.createElement('span');
                reason.textContent = diagnostic.reason ?? 'Unresolved evidence.';
                item.append(kind, id, reason);
                return item;
            }));
            if (diagnostics.length > visible.length) {
                const omitted = document.createElement('li');
                omitted.className = 'browse-faction-report-note';
                omitted.textContent = `${String(diagnostics.length - visible.length)} additional diagnostics omitted from this panel.`;
                diagnosticList.append(omitted);
            }
        }
    }
    if (search && search.value !== snapshot.search) search.value = snapshot.search;
    const query = snapshot.search.trim().toLocaleLowerCase();
    const choices = roster.filter(faction => !query ||
        faction.name.toLocaleLowerCase().includes(query) || faction.id.toLocaleLowerCase().includes(query)
    );
    if (picker) {
        picker.replaceChildren(...choices.map(faction => {
            const option = document.createElement('option');
            option.value = faction.id;
            option.textContent = `${faction.name} · ${faction.id}`;
            return option;
        }));
        picker.selectedIndex = choices.findIndex(faction => faction.id === snapshot.selectedFactionId);
        picker.disabled = choices.length === 0;
    }
    if (pickerCount) pickerCount.textContent = `${String(choices.length)} of ${String(roster.length)} map-linked factions shown`;
    if (clear) clear.disabled = !snapshot.selectedFactionId;
    if (reportElement) {
        if (!snapshot.selectedFactionId) {
            reportElement.replaceChildren();
            const prompt = document.createElement('p');
            prompt.className = 'browse-faction-report-note';
            prompt.textContent = roster.length ? 'Choose a faction to see its report and map presence.' : 'No map-linked factions are available.';
            reportElement.append(prompt);
            factionOverviewRenderedProjection = null;
            factionOverviewRenderedId = null;
        } else if (selected && (factionOverviewRenderedProjection !== factionOverviewProjection ||
            factionOverviewRenderedId !== selected.id)) {
            renderSelectedFactionOverview(selected, reportElement);
            factionOverviewRenderedProjection = factionOverviewProjection;
            factionOverviewRenderedId = selected.id;
        }
    }
    const areaCount = selected?.report?.spawnPresence?.areaCount ?? 0;
    const townCount = selected?.townOccurrences?.length ?? 0;
    const missingTownAnchors = (selected?.townOccurrences ?? []).filter(occurrence => !occurrence.coordinate).length;
    if (mapStatus) {
        mapStatus.textContent = selected?.available && (areaCount > 0 || townCount > 0)
            ? [
                areaCount > 0 ? factionOverviewOverlayReason : null,
                factionOverviewUnmappedAreaIds.length
                    ? `${String(factionOverviewUnmappedAreaIds.length)} active spawn area${factionOverviewUnmappedAreaIds.length === 1 ? '' : 's'} have no raster cells.`
                    : null,
                missingTownAnchors
                    ? `${String(missingTownAnchors)} town occurrence${missingTownAnchors === 1 ? '' : 's'} lack a reliable map position.`
                    : null
            ].filter(Boolean).join(' ')
            : '';
        mapStatus.hidden = !mapStatus.textContent;
    }
    if (legend) {
        legend.hidden = !selected?.available || (areaCount === 0 && townCount === 0);
        if (legend.children[0]) legend.children[0].hidden = areaCount === 0 || Boolean(factionOverviewOverlayReason);
        if (legend.children[1]) legend.children[1].hidden = areaCount === 0 || Boolean(factionOverviewOverlayReason);
        if (legend.children[2]) legend.children[2].hidden = townCount === missingTownAnchors;
    }
}

function renderBrowsePresentation() {
    const state = viewportComposition.getSnapshot();
    const contextView = document.getElementById('browse-context-view');
    const contentView = document.getElementById('browse-content-view');
    const contextButton = document.getElementById('browse-mode-context-btn');
    const contentButton = document.getElementById('browse-mode-content-btn');
    const dashboard = document.getElementById('browse-context-dashboard');
    const collectionRoute = document.getElementById('browse-context-collection');
    const subjectRoute = document.getElementById('browse-context-subject');
    const subjectId = activeDiscoveryContextSubject(state);
    const prospectingOpen = state.contextRoute === 'prospecting';
    const factionOverviewOpen = state.contextRoute === 'factionOverview';
    const collection = DISCOVERY_CONTEXT_COLLECTIONS[state.contextRoute] ?? null;
    const subjectOpen = state.browseMode === 'context' &&
        (Boolean(subjectId) || prospectingOpen || factionOverviewOpen);
    const chrome = document.getElementById('browse-context-chrome');
    const subjectHeader = document.getElementById('browse-context-subject-header');
    const subjectSearch = document.getElementById('browse-context-search');
    const browseRoute = document.getElementById('workbench-route-browse');
    if (chrome) chrome.dataset.subjectOpen = String(subjectOpen);
    if (browseRoute) browseRoute.dataset.contextSubjectOpen = String(subjectOpen);
    if (subjectHeader) subjectHeader.hidden = !subjectOpen;
    if (subjectSearch) subjectSearch.hidden = !subjectOpen;
    const searchLabel = document.querySelector('#browse-context-search .browse-context-search-label');
    if (searchLabel) searchLabel.textContent = factionOverviewOpen ? 'Search factions' : 'Search this subject';
    document.getElementById('browse-context-search-input')?.setAttribute(
        'aria-label', factionOverviewOpen ? 'Search factions' : 'Search this subject'
    );
    syncContextChrome();
    if (contextView) contextView.hidden = state.browseMode !== 'context';
    if (contentView) contentView.hidden = state.browseMode !== 'content';
    if (contextButton) contextButton.setAttribute('aria-pressed', String(state.browseMode === 'context'));
    if (contentButton) contentButton.setAttribute('aria-pressed', String(state.browseMode === 'content'));
    if (dashboard) dashboard.hidden = state.contextRoute !== 'dashboard';
    if (collectionRoute) collectionRoute.hidden = !collection;
    if (subjectRoute) subjectRoute.hidden = !subjectOpen;
    for (const cards of document.querySelectorAll('[data-context-collection-route]')) {
        cards.hidden = cards.dataset.contextCollectionRoute !== state.contextRoute;
    }
    const collectionTitle = document.getElementById('browse-context-collection-title');
    const collectionStatus = document.getElementById('browse-context-collection-status');
    if (collectionTitle && collection) collectionTitle.textContent = collection.label;
    if (collectionStatus && collection) collectionStatus.textContent = collection.description;

    if (prospectingOpen && subjectOpen) {
        const factionControls = document.getElementById('browse-faction-overview-controls');
        if (factionControls) factionControls.hidden = true;
        const retention = document.getElementById('browse-context-retention');
        if (retention) retention.hidden = true;
        renderProspectingPresentation();
        return;
    }
    if (factionOverviewOpen && subjectOpen) {
        const prospectingControls = document.getElementById('browse-prospecting-controls');
        if (prospectingControls) prospectingControls.hidden = true;
        const retention = document.getElementById('browse-context-retention');
        if (retention) retention.hidden = true;
        renderFactionOverviewPresentation();
        return;
    }
    const prospectingControls = document.getElementById('browse-prospecting-controls');
    const factionControls = document.getElementById('browse-faction-overview-controls');
    const bulk = document.querySelector('#browse-context-subject .browse-context-bulk-actions');
    if (prospectingControls) prospectingControls.hidden = true;
    if (factionControls) factionControls.hidden = true;
    if (bulk) bulk.hidden = false;
    const count = document.getElementById('browse-context-result-count');
    if (count) count.hidden = false;

    const snapshot = discoveryPresentation?.getSnapshot();
    const checkedCount = subjectId ? ({
        keyCharacters: snapshot?.checkedKeyCharacterIds.length ?? 0,
        bountyTargets: snapshot?.checkedBountyTargetIds.length ?? 0,
        fancyWeaponWielders: snapshot?.checkedFancyWielderIds.length ?? 0,
        deadlyAnimals: snapshot?.checkedAnimalIds.length ?? 0,
        nestTreasures: snapshot?.checkedNestSources.length ?? 0,
        treasureSpots: snapshot?.checkedTreasureTownIds.length ?? 0,
        narcotics: snapshot?.checkedNarcoticItemIds.length ?? 0
    })[subjectId] : 0;
    const hasRetainedProhibition = subjectId === 'narcotics' && Boolean(
        snapshot?.activeNarcoticProhibitionId
    );
    const retention = document.getElementById('browse-context-retention');
    const retentionLabel = document.getElementById('browse-context-retention-label');
    if (retention) retention.hidden = !subjectId || (checkedCount === 0 && !hasRetainedProhibition);
    if (retentionLabel && subjectId) {
        const indicatorLabel = `${String(checkedCount)} ${DISCOVERY_CONTEXT_LABELS[subjectId]} indicator${checkedCount === 1 ? '' : 's'}`;
        retentionLabel.textContent = hasRetainedProhibition
            ? `${indicatorLabel} and one prohibition overlay retained.`
            : `${indicatorLabel} retained.`;
    }
    if (!subjectId || !subjectRoute || subjectRoute.hidden) return;

    const projection = projectActiveDiscoveryContext(subjectId);
    const title = document.getElementById('browse-context-title');
    const status = document.getElementById('browse-context-status');
    const summary = document.getElementById('browse-context-summary');
    const search = document.getElementById('browse-context-search-input');
    const show = document.getElementById('browse-context-show-btn');
    const clear = document.getElementById('browse-context-clear-btn');
    const resultCount = document.getElementById('browse-context-result-count');
    const results = document.getElementById('browse-context-results');
    if (title) title.textContent = DISCOVERY_CONTEXT_LABELS[subjectId];
    if (summary) summary.textContent = DISCOVERY_CONTEXT_INTRO[subjectId].summary;
    const back = document.getElementById('browse-context-back-btn');
    const parentCollection = DISCOVERY_CONTEXT_COLLECTIONS[DISCOVERY_CONTEXT_PARENT[subjectId]];
    if (back) back.textContent = `← ${parentCollection?.label ?? 'Context'}`;
    const controlsAvailable = Boolean(
        projection?.available &&
        scenarioSession &&
        scenarioLensProjection &&
        discoveryContextIndicatorStatus === 'ready'
    );
    if (status) {
        const indicatorReason = discoveryContextIndicatorStatus === 'loading'
            ? 'Context map geography is still loading; reference rows remain available.'
            : discoveryContextIndicatorStatus === 'unavailable'
                ? 'Context map indicators are unavailable; reference rows remain available.'
                : '';
        const prohibitionReason = subjectId === 'narcotics' && narcoticProhibitionStatus !== 'ready'
            ? narcoticProhibitionReason
            : '';
        status.textContent = !projection?.available
            ? projection?.reason ?? 'Context evidence is unavailable.'
            : [indicatorReason, prohibitionReason].filter(Boolean).join(' ');
        status.hidden = status.textContent === '';
        status.dataset.level = 'warning';
    }
    const searchText = snapshot?.searchBySubject[subjectId] ?? '';
    if (search && search.value !== searchText) search.value = searchText;
    const normalizedSearch = searchText.trim().toLocaleLowerCase();
    const matchedRows = (projection?.rows ?? []).filter(row =>
        contextSearchMatch(row, subjectId, normalizedSearch)
    );
    if (show) {
        show.textContent = normalizedSearch ? 'Show Matches' : 'Show All';
        show.disabled = !controlsAvailable || matchedRows.length === 0;
    }
    if (clear) clear.disabled = checkedCount === 0 && !hasRetainedProhibition;
    if (resultCount) resultCount.textContent = `${String(matchedRows.length)} of ${String(projection?.rows?.length ?? 0)} shown`;
    if (!results) return;
    results.hidden = false;
    const checkedKeyCharacters = new Set(snapshot?.checkedKeyCharacterIds ?? []);
    const checkedBountyTargets = new Set(snapshot?.checkedBountyTargetIds ?? []);
    const checkedFancyWielders = new Set(snapshot?.checkedFancyWielderIds ?? []);
    const checkedAnimals = new Set(snapshot?.checkedAnimalIds ?? []);
    const checkedSources = new Set(
        (snapshot?.checkedNestSources ?? []).map(pair => `${pair.nestItemId}\u0000${pair.nestId}`)
    );
    const checkedTreasureTowns = new Set(snapshot?.checkedTreasureTownIds ?? []);
    const checkedNarcotics = new Set(snapshot?.checkedNarcoticItemIds ?? []);
    results.replaceChildren(...matchedRows.map(row => {
        if (subjectId === 'keyCharacters') {
            return createContextCharacterRow(
                row,
                subjectId,
                checkedKeyCharacters.has(row.entityId),
                controlsAvailable
            );
        }
        if (subjectId === 'bountyTargets') {
            return createContextCharacterRow(
                row,
                subjectId,
                checkedBountyTargets.has(row.entityId),
                controlsAvailable
            );
        }
        if (subjectId === 'fancyWeaponWielders') {
            return createFancyWeaponWielderRow(
                row,
                checkedFancyWielders.has(row.entityId),
                controlsAvailable
            );
        }
        if (subjectId === 'deadlyAnimals') {
            return createDeadlyAnimalRow(row, checkedAnimals.has(row.entityId), controlsAvailable);
        }
        if (subjectId === 'nestTreasures') {
            return createNestTreasureRow(row, checkedSources, controlsAvailable);
        }
        if (subjectId === 'treasureSpots') {
            return createTreasureSpotRow(
                row,
                checkedTreasureTowns.has(row.townId),
                controlsAvailable
            );
        }
        return createNarcoticRow(
            row,
            checkedNarcotics.has(row.entityId),
            snapshot?.activeNarcoticProhibitionId ?? null,
            controlsAvailable
        );
    }));
}

function contextIndicatorSvg(kind, count) {
    const glyphs = {
        character: '<circle cx="12" cy="8" r="3"/><path d="M6.5 19c.6-4 2.4-6 5.5-6s4.9 2 5.5 6"/>',
        bounty: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
        wielder: '<path d="m5 19 9-9m-2-5 7 7M4 20l3-1-2-2-1 3Zm9-16 7 7-3 3-7-7 3-3Z"/>',
        animal: '<path d="M7 18c0-4 1.8-7 5-7s5 3 5 7M8 10 6 6l4 2m6 2 2-4-4 2M10 15h.01M14 15h.01"/>',
        treasure: '<path d="M12 4c3.5 0 6 6.1 6 10.5a6 6 0 0 1-12 0C6 10.1 8.5 4 12 4Z"/><path d="M8.5 13c1.8-.8 5.2-.8 7 0"/>',
        treasureSpot: '<path d="M4 7h16v12H4Z"/><path d="M8 7V5h8v2M4 11h16M10 11v3h4v-3"/>',
        narcotic: '<path d="M8 4h8l2 5-2 11H8L6 9Z"/><path d="M9 8h6m-5 4h4m-5 4h6"/>'
    };
    const glyph = glyphs[kind] ?? glyphs.character;
    const badge = count > 1
        ? `<circle cx="19" cy="5" r="4.5" class="context-indicator-count-bg"/><text x="19" y="6.7" class="context-indicator-count">${String(Math.min(count, 99))}</text>`
        : '';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${glyph}${badge}</svg>`;
}

function contextIndicatorAnchor(appearance) {
    if (appearance.parentType === 'town') {
        const marker = townMarkersByInstanceId.get(appearance.occurrenceId);
        return marker ? [{
            key: `town:${appearance.occurrenceId}`,
            latLng: marker.getLatLng()
        }] : [];
    }
    if (appearance.parentType !== 'spawnArea' || !spawnAreaAnchorIndex) return [];
    return spawnAreaAnchorIndex.getComponents(appearance.parentId).map(component => ({
        key: `spawnArea:${appearance.parentId}:${String(component.scanIndex)}`,
        latLng: component.leafletAnchor
    }));
}

function collectContextIndicatorAnchors(subjectId, projection, presentation) {
    const checkedKeyCharacters = new Set(presentation.checkedKeyCharacterIds);
    const checkedBountyTargets = new Set(presentation.checkedBountyTargetIds);
    const checkedFancyWielders = new Set(presentation.checkedFancyWielderIds);
    const checkedAnimals = new Set(presentation.checkedAnimalIds);
    const checkedSources = new Set(
        presentation.checkedNestSources.map(pair => `${pair.nestItemId}\u0000${pair.nestId}`)
    );
    const checkedTreasureTowns = new Set(presentation.checkedTreasureTownIds);
    const checkedNarcotics = new Set(presentation.checkedNarcoticItemIds);
    const anchors = new Map();
    const add = (anchor, state, entry, availability = 'confirmed') => {
        const group = anchors.get(anchor.key) ?? {
            key: anchor.key,
            latLng: anchor.latLng,
            state,
            availability,
            entries: new Map()
        };
        if (state === 'current') group.state = 'current';
        if (availability === 'confirmed') group.availability = 'confirmed';
        const retained = group.entries.get(entry.key);
        if (
            !retained ||
            (state === 'current' && retained.state !== 'current') ||
            (availability === 'confirmed' && retained.availability !== 'confirmed')
        ) {
            group.entries.set(entry.key, { ...entry, state, availability });
        }
        anchors.set(anchor.key, group);
    };

    if (subjectId === 'keyCharacters' || subjectId === 'bountyTargets' || subjectId === 'fancyWeaponWielders') {
        const checked = subjectId === 'keyCharacters'
            ? checkedKeyCharacters
            : subjectId === 'bountyTargets' ? checkedBountyTargets : checkedFancyWielders;
        const kind = subjectId === 'keyCharacters' ? 'character'
            : subjectId === 'bountyTargets' ? 'bounty' : 'wielder';
        for (const row of projection.rows.filter(({ entityId }) => checked.has(entityId))) {
            for (const appearance of row.placements) {
                for (const anchor of contextIndicatorAnchor(appearance)) {
                    add(anchor, appearance.state, {
                        key: `character:${row.entityId}`,
                        kind,
                        entityType: 'character',
                        entityId: row.entityId,
                        name: row.name,
                        bountyAmount: row.bountyAmount ?? null
                    });
                }
            }
        }
    } else if (subjectId === 'deadlyAnimals') {
        for (const row of projection.rows.filter(({ entityId }) => checkedAnimals.has(entityId))) {
            for (const appearance of row.placements) {
                for (const anchor of contextIndicatorAnchor(appearance)) {
                    add(anchor, appearance.state, {
                        key: `character:${row.entityId}`,
                        kind: 'animal',
                        entityType: 'character',
                        entityId: row.entityId,
                        name: row.name
                    });
                }
            }
        }
    } else if (subjectId === 'nestTreasures') {
        for (const treasure of projection.rows) {
            for (const source of treasure.sources) {
                if (!checkedSources.has(`${treasure.entityId}\u0000${source.nestId}`)) continue;
                for (const appearance of source.placements) {
                    for (const anchor of contextIndicatorAnchor(appearance)) {
                        add(anchor, appearance.state, {
                            key: `nestItem:${treasure.entityId}:nest:${source.nestId}`,
                            kind: 'treasure',
                            entityType: 'nest',
                            entityId: source.nestId,
                            name: source.name,
                            treasureName: treasure.name,
                            nestItemId: treasure.entityId
                        });
                    }
                }
            }
        }
    } else if (subjectId === 'treasureSpots') {
        for (const row of projection.rows.filter(({ townId }) => checkedTreasureTowns.has(townId))) {
            for (const appearance of row.placements) {
                for (const anchor of contextIndicatorAnchor(appearance)) {
                    add(anchor, appearance.state, {
                        key: `town:${row.townId}:${appearance.occurrenceId}`,
                        kind: 'treasureSpot',
                        action: 'geographic',
                        entityType: 'town',
                        entityId: row.townId,
                        instanceId: appearance.occurrenceId,
                        name: row.name
                    }, appearance.availability);
                }
            }
        }
    } else if (subjectId === 'narcotics') {
        for (const row of projection.rows.filter(({ entityId }) => checkedNarcotics.has(entityId))) {
            for (const appearance of row.placements) {
                for (const anchor of contextIndicatorAnchor(appearance)) {
                    add(anchor, appearance.state, {
                        key: `item:${row.entityId}`,
                        kind: 'narcotic',
                        action: 'geographic',
                        entityType: appearance.parentType === 'town' ? 'town' : 'spawnArea',
                        entityId: appearance.parentId,
                        instanceId: appearance.parentType === 'town' ? appearance.occurrenceId : null,
                        referenceType: 'item',
                        referenceId: row.entityId,
                        name: row.name,
                        locationName: appearance.name
                    }, appearance.availability);
                }
            }
        }
    }
    return [...anchors.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function contextIndicatorTooltip(entries) {
    const tooltip = document.createElement('span');
    if (entries.length === 1) {
        const entry = entries[0];
        tooltip.textContent = entry.kind === 'treasure'
            ? `${entry.treasureName} — ${entry.name}`
            : entry.kind === 'narcotic'
                ? `${entry.name} — ${entry.locationName}`
                : entry.kind === 'wielder'
                    ? `${entry.name} — possible weapon wielder`
                : entry.name;
    } else {
        tooltip.textContent = `${String(entries.length)} Context results`;
    }
    return tooltip;
}

function activateContextIndicatorEntry(entry) {
    if (entry.action === 'geographic') {
        const selected = selectGeographicEntity(
            entry.entityType,
            entry.entityId,
            entry.instanceId ?? null,
            'context'
        );
        if (selected) executeGeographicAction('inspect');
        return selected;
    }
    showReferenceRoot(entry.entityType, entry.entityId, null);
    return true;
}

function openContextIndicatorAggregate(entries, latLng, marker) {
    return openContextResultsPopup({
        map, entries, latLng, marker,
        createReferenceButton: createContextReferenceButton,
        onActivate: activateContextIndicatorEntry,
        onReference: (entry, button) => showReferenceRoot(entry.referenceType, entry.referenceId, button),
        onNavigate: () => queueMicrotask(() => document.getElementById('info-panel-title')?.focus({ preventScroll: true }))
    });
}

function renderDiscoveryContextIndicators(generation) {
    if (generation !== discoveryContextGeneration) return;
    const subjectId = activeDiscoveryContextSubject();
    const presentation = discoveryPresentation?.getSnapshot();
    const projection = projectActiveDiscoveryContext(subjectId);
    contextIndicatorLayer.clearLayers();
    if (
        !subjectId ||
        !presentation ||
        !projection?.available ||
        discoveryContextIndicatorStatus !== 'ready'
    ) return;
    try {
        const anchors = collectContextIndicatorAnchors(subjectId, projection, presentation);
        for (const anchor of anchors) {
            const entries = [...anchor.entries.values()].sort(
                (left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key)
            );
            const kind = ({
                keyCharacters: 'character',
                bountyTargets: 'bounty',
                fancyWeaponWielders: 'wielder',
                deadlyAnimals: 'animal',
                nestTreasures: 'treasure',
                treasureSpots: 'treasureSpot',
                narcotics: 'narcotic'
            })[subjectId];
            const icon = L.divIcon({
                className: `context-map-indicator is-${kind} is-${anchor.state}${anchor.availability === 'uncertain' ? ' is-uncertain' : ''}${entries.length > 1 ? ' is-aggregate' : ''}`,
                html: contextIndicatorSvg(kind, entries.length),
                iconSize: [32, 32],
                iconAnchor: [-5, 27],
                tooltipAnchor: [13, -13]
            });
            const accessibleName = entries.length === 1
                ? entries[0].kind === 'treasure'
                    ? `${entries[0].treasureName} from ${entries[0].name}, ${anchor.state} Context evidence`
                    : entries[0].kind === 'narcotic'
                        ? `${entries[0].name} at ${entries[0].locationName}, ${anchor.availability} ${anchor.state} purchase evidence`
                        : entries[0].kind === 'wielder'
                            ? `${entries[0].name}, possible weapon wielder with ${anchor.state} placement evidence`
                        : `${entries[0].name}, ${anchor.availability === 'uncertain' ? 'uncertain ' : ''}${anchor.state} Context evidence`
                : `${String(entries.length)} ${DISCOVERY_CONTEXT_LABELS[subjectId]} Context results`;
            const marker = L.marker(anchor.latLng, {
                icon,
                pane: 'contextIndicatorPane',
                keyboard: true,
                title: accessibleName,
                alt: accessibleName,
                riseOnHover: false
            });
            marker.bindTooltip(contextIndicatorTooltip(entries), { direction: 'top' });
            marker.on('click', event => {
                if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
                if (entries.length === 1) {
                    activateContextIndicatorEntry(entries[0]);
                } else {
                    openContextIndicatorAggregate(entries, anchor.latLng, marker);
                }
            });
            enableMarkerKeyboardActivation(marker);
            marker.addTo(contextIndicatorLayer);
        }
    } catch (error) {
        contextIndicatorLayer.clearLayers();
        discoveryContextIndicatorStatus = 'unavailable';
        renderBrowsePresentation();
        console.error('Context map indicators are unavailable; reference exploration remains active.', error);
    }
}

function scheduleDiscoveryContextIndicators() {
    discoveryContextGeneration += 1;
    const generation = discoveryContextGeneration;
    if (discoveryContextRenderFrame !== null) cancelAnimationFrame(discoveryContextRenderFrame);
    discoveryContextRenderFrame = requestAnimationFrame(() => {
        discoveryContextRenderFrame = null;
        renderDiscoveryContextIndicators(generation);
    });
}

function shouldShowNarcoticProhibition(state = viewportComposition.getSnapshot()) {
    return Boolean(
        discoveryPresentation?.getSnapshot().activeNarcoticProhibitionId &&
        state.contextRoute === 'narcotics' &&
        (state.browseMode === 'context' || state.browseMode === 'content')
    );
}

function hideNarcoticProhibitionOverlay() {
    if (narcoticProhibitionImageOverlay) {
        narcoticProhibitionLayer.removeLayer(narcoticProhibitionImageOverlay);
    }
}

function commitNarcoticProhibition(generation) {
    if (generation !== narcoticProhibitionGeneration) return false;
    const itemId = discoveryPresentation?.getSnapshot().activeNarcoticProhibitionId ?? null;
    if (!itemId || !shouldShowNarcoticProhibition()) {
        hideNarcoticProhibitionOverlay();
        return false;
    }
    if (
        narcoticProhibitionStatus !== 'ready' ||
        !discoveryContextAreaIndex ||
        !scenarioSession ||
        !scenarioLensProjection
    ) {
        hideNarcoticProhibitionOverlay();
        return false;
    }
    const projection = projectNarcoticProhibition({
        contextCatalog: discoveryContextCatalog,
        discoveryCatalog,
        snapshot: scenarioSession.getSnapshot(),
        lenses: scenarioLensProjection,
        areaIndex: discoveryContextAreaIndex,
        itemId
    });
    if (!projection.available) throw new Error(projection.reason ?? 'Prohibition projection failed.');
    const raster = createNarcoticProhibitionRaster({
        areaIndex: discoveryContextAreaIndex,
        projection
    });
    if (!raster.available) throw new Error(raster.reason ?? 'Prohibition raster failed.');
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Prohibition raster canvas is unavailable.');
    const image = context.createImageData(raster.width, raster.height);
    image.data.set(raster.copyRgba());
    context.putImageData(image, 0, 0);
    const url = canvas.toDataURL();
    if (generation !== narcoticProhibitionGeneration) return false;
    if (!narcoticProhibitionImageOverlay) {
        narcoticProhibitionImageOverlay = L.imageOverlay(
            url,
            [[0, 0], [mapHeight, mapWidth]],
            {
                pane: 'prohibitionPane',
                className: 'narcotic-prohibition-overlay pixelated-overlay',
                interactive: false,
                opacity: 1
            }
        );
    } else {
        narcoticProhibitionImageOverlay.setUrl(url);
    }
    if (!narcoticProhibitionLayer.hasLayer(narcoticProhibitionImageOverlay)) {
        narcoticProhibitionLayer.addLayer(narcoticProhibitionImageOverlay);
    }
    return true;
}

function scheduleNarcoticProhibition() {
    narcoticProhibitionGeneration += 1;
    if (narcoticProhibitionRenderFrame !== null) return;
    narcoticProhibitionRenderFrame = requestAnimationFrame(() => {
        narcoticProhibitionRenderFrame = null;
        const generation = narcoticProhibitionGeneration;
        try {
            commitNarcoticProhibition(generation);
        } catch (error) {
            hideNarcoticProhibitionOverlay();
            narcoticProhibitionStatus = 'unavailable';
            narcoticProhibitionReason = `Prohibition overlay is unavailable: ${error.message}`;
            console.error('Narcotic prohibition overlay failed; purchase browsing remains active.', error);
            renderBrowsePresentation();
        }
        if (generation !== narcoticProhibitionGeneration) scheduleNarcoticProhibition();
    });
}

function refreshProspectingCatalog() {
    try {
        prospectingCatalog = createProspectingCatalog({
            projection: environmentInfoProjection,
            areaIndex: discoveryContextAreaIndex
        });
    } catch (error) {
        prospectingCatalog = null;
        prospectingOverlayReason = `Prospecting data is unavailable: ${error.message}`;
        console.error('Prospecting catalog failed; other map views remain available.', error);
    }
    if (!discoveryContextAreaIndex) {
        prospectingOverlayReason = spawnRasterStatus === 'loading'
            ? 'Prospecting map geography is loading; authored area results remain available.'
            : 'Prospecting map geography is unavailable; authored area results remain available.';
    } else if (prospectingCatalog?.available) {
        prospectingOverlayReason = '';
    }
    renderBrowsePresentation();
    scheduleProspectingOverlay();
}

function shouldShowProspectingOverlay(state = viewportComposition.getSnapshot()) {
    return state.contextRoute === 'prospecting' &&
        (state.focusMap || (state.activeTask === 'browse' && state.activeSubview === null && state.browseMode === 'context'));
}

function hideProspectingOverlay() {
    if (prospectingImageOverlay) prospectingLayer.removeLayer(prospectingImageOverlay);
}

function commitProspectingOverlay(generation) {
    if (generation !== prospectingRenderGeneration) return false;
    const snapshot = prospectingPresentation.getSnapshot();
    if (!shouldShowProspectingOverlay() ||
        snapshot.selectedNumericIds.length + snapshot.selectedConditionIds.length === 0) {
        hideProspectingOverlay();
        return false;
    }
    if (!prospectingCatalog?.available || !discoveryContextAreaIndex || !map) {
        hideProspectingOverlay();
        return false;
    }
    const matches = projectProspecting({
        catalog: prospectingCatalog,
        selectedNumeric: snapshot.selectedNumericIds,
        minimums: snapshot.minimumByNumericId,
        selectedConditions: snapshot.selectedConditionIds
    });
    if (!matches.available || matches.matchingAreaIds.length === 0) {
        hideProspectingOverlay();
        return false;
    }
    const raster = createProspectingRaster({ areaIndex: discoveryContextAreaIndex, matches });
    if (!raster.available) throw new Error(raster.reason ?? 'Prospecting raster failed.');
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Prospecting raster canvas is unavailable.');
    const image = context.createImageData(raster.width, raster.height);
    image.data.set(raster.copyRgba());
    context.putImageData(image, 0, 0);
    const url = canvas.toDataURL();
    if (generation !== prospectingRenderGeneration) return false;
    if (!prospectingImageOverlay) {
        prospectingImageOverlay = L.imageOverlay(url, [[0, 0], [mapHeight, mapWidth]], {
            pane: 'prospectingPane',
            className: 'prospecting-overlay pixelated-overlay',
            interactive: false,
            opacity: 1
        });
    } else {
        prospectingImageOverlay.setUrl(url);
    }
    if (!prospectingLayer.hasLayer(prospectingImageOverlay)) {
        prospectingLayer.addLayer(prospectingImageOverlay);
    }
    if (prospectingOverlayReason) {
        prospectingOverlayReason = '';
        renderBrowsePresentation();
    }
    return true;
}

function scheduleProspectingOverlay() {
    prospectingRenderGeneration += 1;
    if (prospectingRenderFrame !== null) return;
    prospectingRenderFrame = requestAnimationFrame(() => {
        prospectingRenderFrame = null;
        const generation = prospectingRenderGeneration;
        try {
            commitProspectingOverlay(generation);
        } catch (error) {
            hideProspectingOverlay();
            prospectingOverlayReason = `Prospecting map highlight is unavailable: ${error.message}`;
            console.error('Prospecting overlay failed; area browsing remains available.', error);
            renderBrowsePresentation();
        }
        if (generation !== prospectingRenderGeneration) scheduleProspectingOverlay();
    });
}

function refreshFactionOverviewProjection() {
    try {
        factionOverviewProjection = projectFactionOverview({
            catalog: factionOverviewCatalog,
            baseline: scenarioBaseline,
            snapshot: scenarioSession && scenarioLensProjection
                ? scenarioSession.getSnapshot()
                : null
        });
    } catch (error) {
        factionOverviewProjection = null;
        console.error('Faction Overview projection failed; other map views remain available.', error);
    }
    renderBrowsePresentation();
    scheduleFactionOverviewOverlay();
}

function shouldShowFactionOverviewOverlay(state = viewportComposition.getSnapshot()) {
    return state.contextRoute === 'factionOverview' &&
        (state.focusMap || (state.activeTask === 'browse' && state.activeSubview === null && state.browseMode === 'context'));
}

function hideFactionOverviewOverlay() {
    if (factionOverviewImageOverlay) factionOverviewAreaLayer.removeLayer(factionOverviewImageOverlay);
    factionOverviewTownLayer.clearLayers();
}

function commitFactionOverviewOverlay(generation) {
    if (generation !== factionOverviewRenderGeneration) return false;
    const selectedId = factionOverviewPresentation.getSnapshot().selectedFactionId;
    const entry = factionOverviewProjection?.entries?.find(candidate => candidate.id === selectedId);
    if (!shouldShowFactionOverviewOverlay() || !entry?.available || !entry.report) {
        hideFactionOverviewOverlay();
        factionOverviewUnmappedAreaIds = [];
        return false;
    }

    factionOverviewTownLayer.clearLayers();
    for (const occurrence of entry.townOccurrences ?? []) {
        if (!occurrence.coordinate || !Number.isFinite(occurrence.coordinate.x) ||
            !Number.isFinite(occurrence.coordinate.z)) continue;
        const position = kenshiToLeaflet(occurrence.coordinate);
        if (!position) continue;
        const ring = L.circleMarker(position, {
            pane: 'factionOverviewTownPane',
            interactive: false,
            radius: 14,
            color: '#e6ae4b',
            weight: 3,
            opacity: 0.95,
            fill: false
        });
        factionOverviewTownLayer.addLayer(ring);
    }

    const areaIds = entry.report.spawnPresence.areas.map(area => area.id);
    if (areaIds.length === 0) {
        if (factionOverviewImageOverlay) factionOverviewAreaLayer.removeLayer(factionOverviewImageOverlay);
        factionOverviewUnmappedAreaIds = [];
        factionOverviewOverlayReason = '';
        renderBrowsePresentation();
        return true;
    }
    if (!discoveryContextAreaIndex) {
        if (factionOverviewImageOverlay) factionOverviewAreaLayer.removeLayer(factionOverviewImageOverlay);
        factionOverviewOverlayReason = spawnRasterStatus === 'loading'
            ? 'Faction spawn-area geography is loading; town rings and the report remain available.'
            : 'Faction spawn-area geography is unavailable; town rings and the report remain available.';
        renderBrowsePresentation();
        return true;
    }
    const raster = createFactionOverviewRaster({ areaIndex: discoveryContextAreaIndex, areaIds });
    if (!raster.available) throw new Error(raster.reason ?? 'Faction raster failed.');
    factionOverviewUnmappedAreaIds = [...raster.unmappedAreaIds];
    if (raster.statusCounts.solid + raster.statusCounts.caution === 0) {
        if (factionOverviewImageOverlay) factionOverviewAreaLayer.removeLayer(factionOverviewImageOverlay);
        factionOverviewOverlayReason = '';
        renderBrowsePresentation();
        return true;
    }
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Faction raster canvas is unavailable.');
    const image = context.createImageData(raster.width, raster.height);
    image.data.set(raster.copyRgba());
    context.putImageData(image, 0, 0);
    const url = canvas.toDataURL();
    if (generation !== factionOverviewRenderGeneration) return false;
    if (!factionOverviewImageOverlay) {
        factionOverviewImageOverlay = L.imageOverlay(url, [[0, 0], [mapHeight, mapWidth]], {
            pane: 'factionOverviewAreaPane',
            className: 'faction-overview-overlay pixelated-overlay',
            interactive: false,
            opacity: 1
        });
    } else {
        factionOverviewImageOverlay.setUrl(url);
    }
    if (!factionOverviewAreaLayer.hasLayer(factionOverviewImageOverlay)) {
        factionOverviewAreaLayer.addLayer(factionOverviewImageOverlay);
    }
    factionOverviewOverlayReason = '';
    renderBrowsePresentation();
    return true;
}

function scheduleFactionOverviewOverlay() {
    factionOverviewRenderGeneration += 1;
    if (factionOverviewRenderFrame !== null) return;
    factionOverviewRenderFrame = requestAnimationFrame(() => {
        factionOverviewRenderFrame = null;
        const generation = factionOverviewRenderGeneration;
        try {
            commitFactionOverviewOverlay(generation);
        } catch (error) {
            if (factionOverviewImageOverlay) factionOverviewAreaLayer.removeLayer(factionOverviewImageOverlay);
            factionOverviewOverlayReason = `Faction spawn-area highlight is unavailable: ${error.message}`;
            console.error('Faction Overview raster failed; report and town rings remain available.', error);
            renderBrowsePresentation();
        }
        if (generation !== factionOverviewRenderGeneration) scheduleFactionOverviewOverlay();
    });
}

function applyViewportComposition(change) {
    const previousState = appliedViewportComposition;
    const activeElement = document.activeElement;
    const state = viewportComposition.getSnapshot();
    const browseScrollOwner = document.getElementById('workbench-route-browse');
    if (change?.type.startsWith('setInspectorTransparency')) {
        appliedViewportComposition = state;
        renderInspectorTransparency(state);
        return;
    }
    if (previousState?.effective.dockVisible && !state.effective.dockVisible && browseScrollOwner) {
        retainedBrowseScrollTop = browseScrollOwner.scrollTop;
    }
    if (previousState && !previousState.phone && state.phone && mapPopupOpen) map.closePopup();
    // Widget choices are presentation-only; don't refresh discovery or reporting on search input.
    if (change?.type.startsWith('setFactionColorsWidget')) {
        appliedViewportComposition = state;
        refreshFactionColorsWidgetControls();
        viewportGeometry.requestWidget();
        return;
    }
    topBarController.setLayout(state.layoutClass);
    if (previousState && previousState.focusMap !== state.focusMap) {
        topBarController.closeTransient({ restoreFocus: false });
    }
    const root = document.getElementById('viewport-workbench');
    if (root) {
        root.dataset.layoutClass = state.layoutClass;
        root.dataset.phone = String(state.phone);
        root.dataset.phoneForeground = state.phoneForeground;
        root.dataset.short = String(state.short);
        root.dataset.activeTask = state.activeTask;
        root.dataset.activeSubview = state.activeSubview ?? 'none';
        root.dataset.focusMap = String(state.focusMap);
        root.dataset.activeSheet = state.narrowActiveSheet ?? 'none';
        root.dataset.dockVisible = String(state.effective.dockVisible);
        root.dataset.inspectorVisible = String(state.effective.inspectorVisible);
        root.dataset.toolShelfOpen = String(state.toolShelfOpen);
        root.dataset.toolShelfVisible = String(state.effective.toolShelfVisible);
        root.dataset.pointContextVisible = String(state.pointContextVisible);
        root.dataset.browseMode = state.browseMode;
        root.dataset.contextRoute = state.contextRoute;
        root.dataset.transientSurface = state.transientSurface ?? 'none';
    }

    setWorkbenchElementVisible(
        document.getElementById('unified-dock'),
        state.phone || state.effective.dockVisible
    );
    setWorkbenchElementVisible(
        document.getElementById('info-panel'),
        state.phone || state.effective.inspectorVisible
    );
    for (const [id, presented] of [
        ['unified-dock', state.effective.dockVisible],
        ['info-panel', state.effective.inspectorVisible]
    ]) {
        const panel = document.getElementById(id);
        if (!panel) continue;
        panel.inert = !presented;
        panel.setAttribute('aria-hidden', String(!presented));
    }

    const toolShelf = document.getElementById('map-tool-shelf');
    const toolShelfPanel = document.getElementById('map-tool-shelf-panel');
    const toolShelfLauncher = document.getElementById('map-tool-shelf-launcher');
    if (toolShelf) toolShelf.dataset.open = String(state.effective.toolShelfVisible);
    if (toolShelf) toolShelf.dataset.activeTab = state.toolShelfTab;
    if (toolShelfPanel) toolShelfPanel.hidden = !state.effective.toolShelfVisible;
    if (toolShelfLauncher) {
        toolShelfLauncher.setAttribute('aria-expanded', String(state.effective.toolShelfVisible));
    }
    for (const tab of ['marker', 'paint']) {
        const button = document.getElementById(`map-tool-${tab}-tab`);
        const panel = document.getElementById(`map-tool-${tab}-panel`);
        const active = state.toolShelfTab === tab;
        if (button) {
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        }
        if (panel) panel.hidden = !active;
    }

    const infoStore = Alpine.store('infoPanel');
    if (infoStore) {
        infoStore.isOpen = state.phone || state.effective.inspectorVisible;
        infoStore.pointContextVisible = state.pointContextVisible;
    }

    for (const task of ['browse', 'simulate', 'plan']) {
        const button = document.getElementById(`workbench-task-${task}-btn`);
        const route = document.getElementById(`workbench-route-${task}`);
        const active = state.activeTask === task && state.activeSubview === null;
        if (button) {
            button.setAttribute('aria-selected', String(state.activeTask === task));
            button.tabIndex = state.activeTask === task ? 0 : -1;
        }
        if (route) route.hidden = state.activeTask !== task;
        if (route) route.dataset.routeActive = String(active);
    }

    const favoritesOpen = state.activeSubview === 'favorites';
    const relationsOpen = state.activeSubview === 'relationsJournal';
    const layerConfigurationOpen = state.activeSubview === 'layerConfiguration';
    const factionColorsOpen = state.activeSubview === 'factionColors';
    const browseMain = document.getElementById('browse-main-view');
    const simulateMain = document.getElementById('simulate-main-view');
    const planMain = document.getElementById('plan-main-view');
    const layerConfiguration = document.getElementById('layer-configuration-panel');
    const factionColors = document.getElementById('faction-colors-panel');
    if (browseMain) browseMain.hidden = favoritesOpen;
    if (simulateMain) simulateMain.hidden = relationsOpen;
    if (planMain) planMain.hidden = layerConfigurationOpen || factionColorsOpen;
    if (layerConfiguration) layerConfiguration.hidden = !layerConfigurationOpen;
    if (factionColors) factionColors.hidden = !factionColorsOpen;
    const favorites = document.getElementById('favorites-panel');
    const relations = document.getElementById('relations-journal-panel');
    if (favorites) favorites.classList.toggle('hidden', !favoritesOpen);
    if (relations) relations.classList.toggle('hidden', !relationsOpen);
    renderBrowsePresentation();
    if (previousState && !previousState.effective.dockVisible && state.effective.dockVisible) {
        requestAnimationFrame(() => {
            if (!viewportComposition.getSnapshot().effective.dockVisible) return;
            if (browseScrollOwner) browseScrollOwner.scrollTop = retainedBrowseScrollTop;
            syncContextChrome();
        });
    }

    const dockToggle = document.getElementById('workbench-dock-toggle-btn');
    if (dockToggle) {
        const dockPresented = state.effective.dockVisible;
        dockToggle.setAttribute('aria-expanded', String(dockPresented));
        dockToggle.setAttribute('aria-pressed', String(dockPresented));
        setWorkbenchControlLabel(
            dockToggle,
            dockPresented ? 'Hide Map Tasks' : 'Open Map Tasks'
        );
    }
    const inspectorToggle = document.getElementById('workbench-inspector-toggle-btn');
    if (inspectorToggle) {
        const hasSelection = Boolean(selectionSession?.getSelection());
        const navigation = referenceNavigation.getSnapshot();
        const hasReference = navigation.hasReference;
        const inspectorPresented = state.effective.inspectorVisible;
        const referenceVisible = referenceNavigation?.getSnapshot().surface === 'reference';
        inspectorToggle.disabled = !hasSelection && !hasReference && !navigation.hasLandmark;
        inspectorToggle.setAttribute('aria-expanded', String(inspectorPresented));
        setWorkbenchControlLabel(
            inspectorToggle,
            inspectorPresented
                ? `Hide ${navigation.hasLandmark ? 'Landmark' : referenceVisible ? 'Reference' : 'Selected'} Context`
                : `Open ${navigation.hasLandmark ? 'Landmark' : referenceVisible ? 'Reference' : 'Selected'} Context`
        );
    }
    const focusButton = document.getElementById('workbench-focus-map-btn');
    if (focusButton) {
        focusButton.setAttribute('aria-pressed', String(state.focusMap));
        setWorkbenchControlLabel(
            focusButton,
            state.focusMap ? 'Exit Focus Map' : 'Focus Map Mode'
        );
    }

    renderAnchoredPopoverPresentation(previousState, state);
    renderLayerPresentation();
    renderPhonePresentation(previousState, state);
    if (discoveryPresentation) {
        scheduleDiscoveryContextIndicators();
        scheduleNarcoticProhibition();
    }
    if (!previousState || shouldShowProspectingOverlay(previousState) !== shouldShowProspectingOverlay(state)) {
        scheduleProspectingOverlay();
    }
    if (!previousState || shouldShowFactionOverviewOverlay(previousState) !== shouldShowFactionOverviewOverlay(state)) {
        scheduleFactionOverviewOverlay();
    }
    transferWorkbenchFocus(previousState, state, activeElement);
    appliedViewportComposition = state;
    updateTownLayoutCanonicalWidth(state);
    viewportResizeAdapter?.schedule();
    scheduleActiveAnchoredPopoverPosition();
    refreshPoliticalReports();
}

function resetViewportWorkspace() {
    topBarController.closeTransient({ restoreFocus: false });
    politicalReporting?.reset();
    locationReporting?.reset();
    dismissPointProbe({ closePopup: true });
    referenceNavigation?.clear();
    landmarkReturnReading = null;
    landmarkMarkerFocus = null;
    pendingReferenceFocus = [];
    referenceRootFocus = null;
    map?.closePopup();
    dismissWorkbenchTransientSurface();
    closePlanToolShelf();
    closeTownLayoutCover();
    document.getElementById('player-marker-panel')?.classList.add('hidden');
    discoveryPresentation?.restoreDefaults();
    prospectingPresentation.restoreDefaults();
    factionOverviewPresentation.restoreDefaults();
    viewportComposition.reset({
        hasSelection: Boolean(selectionSession?.getSelection()),
        hudMode: isPoliticalViewActive() ? 'scorecard' : 'scanner'
    });
}

viewportComposition.subscribe(applyViewportComposition);
prospectingPresentation.subscribe(change => {
    renderBrowsePresentation();
    if (change.type !== 'setSearch') scheduleProspectingOverlay();
});
factionOverviewPresentation.subscribe(change => {
    if (change.type !== 'setSearch') factionOverviewUnmappedAreaIds = [];
    renderBrowsePresentation();
    if (change.type !== 'setSearch') scheduleFactionOverviewOverlay();
});
applyViewportComposition();

function setScenarioStatus(message, level = 'info') {
    const status = document.getElementById('scenario-status');
    if (!status) return;

    if (!message) {
        status.hidden = true;
        status.textContent = '';
        status.removeAttribute('data-level');
        return;
    }

    status.textContent = message;
    status.dataset.level = level;
    status.hidden = false;
}

function setScenarioAvailability(isAvailable, message = '') {
    topBarController.setScenarioAvailable(isAvailable);
    politicalReporting?.refreshWindowShortcut();
    if (simulationContainer) {
        simulationContainer.dataset.scenarioAvailable = String(isAvailable);
        simulationContainer.querySelectorAll('button, input, select').forEach(control => {
            control.disabled = !isAvailable;
        });
    }
    for (const id of ['workbench-undo-btn', 'workbench-redo-btn']) {
        const control = document.getElementById(id);
        if (control) control.disabled = !isAvailable;
    }

    for (const controlId of [
        'export-history-btn',
        'import-history-file',
        'scenario-save-btn',
        'scenario-save-as-btn',
        'import-btn',
        'import-save-select'
    ]) {
        const control = document.getElementById(controlId);
        if (control) control.disabled = !isAvailable;
    }

    if (!isAvailable) setScenarioStatus(message || 'Scenario simulation is unavailable.', 'error');
}

function hideInitializationError() {
    document.getElementById('initialization-error-overlay')?.classList.add('hidden');
}

function showInitializationError(error) {
    topBarController.setInitializationFailure(
        'Map data is unavailable because application initialization did not complete.'
    );
    const overlay = document.getElementById('initialization-error-overlay');
    if (!overlay) return;

    const context = error?.context || {};
    const summary = document.getElementById('initialization-error-summary');
    const details = document.getElementById('initialization-error-context');
    const retryButton = document.getElementById('initialization-error-retry');

    if (summary) {
        summary.textContent = error?.message || 'KiMap could not initialize required map data.';
    }

    if (details) {
        const labels = [];
        if (context.contractVersion !== undefined) labels.push(`Contract: v${context.contractVersion}`);
        if (context.manifestId) labels.push(`Manifest: ${context.manifestId}`);
        if (context.key) labels.push(`Dataset: ${context.key}`);
        details.textContent = labels.join(' | ') || 'No contract context was available.';
    }

    if (retryButton) retryButton.onclick = () => window.location.reload();
    overlay.classList.remove('hidden');
}
// -- MapDBs --
let aiPackageDatabase = {};
let animalDatabase = {};
let armourDatabase = {};
let artifactDatabase = {};
let bagDatabase = {};
let biomeDatabase = {};
let buildingDatabase = {};
let buildingSwapDatabase = {};
let characterDatabase = {};
let colourSchemeDatabase = {};
let constantsDatabase = {};
let crossbowDatabase = {};
let effectDatabase = {};
let factionDatabase = {};
let factionCampaignDatabase = {};
let gameStartDatabase = {};
let itemDatabase = {};
let itemMaterialsWeaponDatabase = {};
let limbReplacementDatabase = {};
let locationDatabase = {};
let mapItemDatabase = {};
let nestItemDatabase = {};
let raceDatabase = {};
let researchDatabase = {};
let resourceDatabase = {};
let seasonDatabase = {};
let spawnAreaDatabase = {};
let squadDatabase = {};
let statsDatabase = {};
let townDatabase = {};
let tradeCultureDatabase = {};
let vendorListDatabase = {};
let weaponDatabase = {};
let weaponManufacturerDatabase = {};
let weatherDatabase = {};
let worldStateListDatabase = {};
// -- Map-wides --
let townLayer = L.layerGroup();
let nestLayer = L.layerGroup();
const townTypeLayers = new Map();
let relationsModeLayer = L.layerGroup();
let emptyLayer = L.layerGroup();
let politicalViewLayer = L.layerGroup();
const narcoticProhibitionLayer = L.layerGroup();
const prospectingLayer = L.layerGroup();
const factionOverviewAreaLayer = L.layerGroup();
const factionOverviewTownLayer = L.layerGroup();
const contextIndicatorLayer = L.layerGroup();
let spawnAreaOverlay = null;
let colorToAreaMap = new Map();
let spawnAreaAnchorIndex = null;
let biomeLayer = null;
let biomePixelData = null;
let colorToBiomeMap = new Map();
let roadLayer = L.layerGroup();
let debugGridLayer = L.layerGroup();
let debugGridController = null;
let landmarkLayer = L.layerGroup();
let selectionPointLayer = L.layerGroup();
let pointProbeLayer = L.layerGroup();
let buildingLocationsUrl = '';
let roadNetworkUrl = '';
let roadNetworkLoadPromise = null;
let landmarksLoadPromise = null;
const spawnBorderLayer = L.layerGroup();
const spawnLabelLayer = L.layerGroup();
const aridLayer   = L.layerGroup();
const greenLayer  = L.layerGroup();
const swampLayer  = L.layerGroup();
const copperLayer = L.layerGroup();
const ironLayer   = L.layerGroup();
const stoneLayer  = L.layerGroup();
const waterLayer  = L.layerGroup();
const acidGroundLayer = L.layerGroup();
const acidWaterLayer  = L.layerGroup();
const acidRainLayer   = L.layerGroup();
const burningLayer    = L.layerGroup();
const duststormLayer  = L.layerGroup();
const gasLayer        = L.layerGroup();
const DATA_LAYERS = 
{
  'arid':   { layer: aridLayer,   key: 'arid',        color: {r:255, g:215, b:0} },   // Gold
  'green':  { layer: greenLayer,  key: 'green',       color: {r:50,  g:205, b:50} },  // Lime
  'swamp':  { layer: swampLayer,  key: 'swamp',       color: {r:107, g:142, b:35} },  // Olive
  'copper': { layer: copperLayer, key: 'copper mult', color: {r:184, g:115, b:51} },  // Copper
  'iron':   { layer: ironLayer,   key: 'iron mult',   color: {r:169, g:169, b:169} }, // Grey
  'stone':  { layer: stoneLayer,  key: 'stone mult',  color: {r:105, g:105, b:105} }, // Dark Grey
  'water':  { layer: waterLayer,  key: 'water mult',  color: {r:0,   g:191, b:255} },  // Blue
  'acid_ground': { layer: acidGroundLayer, isWeather: true, match: 'Acidic Ground', color: {r:139, g:69, b:19} }, // SaddleBrown
  'acid_water':  { layer: acidWaterLayer,  isWeather: true, match: 'Acidic Water',  color: {r:205, g:92, b:92} }, // IndianRed
  'acid_rain':   { layer: acidRainLayer,   isWeather: true, match: 'Acid Rain',          color: {r:255, g:0, b:0} },   // Red
  'burning':     { layer: burningLayer,    isWeather: true, match: 'Burning',       color: {r:255, g:69, b:0} },  // RedOrange
  'duststorm':   { layer: duststormLayer,  isWeather: true, match: 'Duststorm',     color: {r:210, g:180, b:140} }, // Tan
  'gas':         { layer: gasLayer,        isWeather: true, match: 'Gas',           color: {r:173, g:255, b:47} }   // GreenYellow
};
const TOWN_TYPE_CONFIG = {
    // 0: Nest (Technical null)
    0:  { name: "Nest",          icon: "icon-nest.png",     scale: 0.9 },
    // 1: Outpost (Medium Towns)
    1:  { name: "Outpost",       icon: "icon-outpost.png",     scale: 1.1 },
    // 2: Major Towns
    2:  { name: "Town",          icon: "icon-town.png",     scale: 1.0 },
    // 3: Village (Small Towns)
    3:  { name: "Village",       icon: "icon-village.png",     scale: 0.7 },
    // 4: Ancient Ruin
    4:  { name: "Ruin",  icon: "icon-ruin.png",     scale: 0.7 },  
    // 5: Slave Camp / Mine
    5:  { name: "Slave Camp",    icon: "icon-slave.png",     scale: 0.7 },
    // 6: Military Base
    6:  { name: "Military Base", icon: "icon-outpost.png",     scale: 1.1 },
    // 7: Prison 
    7:  { name: "Prison",        icon: "icon-outpost.png",     scale: 1.1 },
    // 8: Static Nest Marker
    8:  { name: "Nest Marker",   icon: "icon-nest.png",     scale: 0.9 },
    // 9: Point of Interest
    9:  { name: "Point of Interest", icon: "icon-poi.png",     scale: 0.7 },
    // 10: Generic Location (Fallback)
    10: { name: "Location",      icon: "town-marker.svg",     scale: 1.0 },
    
    // Fallback for unknowns
    'default': { name: "Unknown", icon: "town-marker.svg" }
};
for (const { key } of TOWN_TYPE_FILTERS) {
    const layer = L.layerGroup();
    townTypeLayers.set(key, layer);
    townLayer.addLayer(layer);
}
let playerMarkerLayer = L.layerGroup();
const townMarkersByInstanceId = new Map();
const mapWidth = MAP_WIDTH, mapHeight = MAP_HEIGHT;
const kenshiMinCoord = KENSHI_MIN_COORD, kenshiMaxCoord = KENSHI_MAX_COORD;
// The responsive shell is already interactive before this asynchronous asset-route probe.

map = L.map('map-container',
{
  crs: L.CRS.Simple,
  zoomControl: false,
  scrollWheelZoom: false,
  minZoom: MAP_MIN_ZOOM,
  maxZoom: MAP_MAX_ZOOM,
  maxBounds: [[-500, -500], [mapHeight + 500, mapWidth + 500]],
  maxBoundsViscosity: 1.0,
  attributionControl: false
});
// Every prepared base-image replacement must stay below ordinary World View rasters.
map.createPane('baseMapPane');
map.getPane('baseMapPane').style.zIndex = 200;
map.getPane('baseMapPane').style.pointerEvents = 'none';
map.createPane('politicalPane');
map.getPane('politicalPane').style.zIndex = 410;
map.getPane('politicalPane').style.pointerEvents = 'none';
map.createPane('prohibitionPane');
map.getPane('prohibitionPane').style.zIndex = 415;
map.getPane('prohibitionPane').style.pointerEvents = 'none';
map.createPane('prospectingPane');
map.getPane('prospectingPane').style.zIndex = 417;
map.getPane('prospectingPane').style.pointerEvents = 'none';
map.createPane('factionOverviewAreaPane');
map.getPane('factionOverviewAreaPane').style.zIndex = 418;
map.getPane('factionOverviewAreaPane').style.pointerEvents = 'none';
map.createPane('referencePane');
map.getPane('referencePane').style.zIndex = 420;
map.getPane('referencePane').style.pointerEvents = 'none';
map.createPane('factionOverviewTownPane');
map.getPane('factionOverviewTownPane').style.zIndex = 585;
map.getPane('factionOverviewTownPane').style.pointerEvents = 'none';
map.createPane('contextIndicatorPane');
map.getPane('contextIndicatorPane').style.zIndex = 590;
const bounds = [[0, 0], [mapHeight, mapWidth]];

const baseMapController = createBaseMapImageController({
    getZoom: () => map.getZoom(),
    getPixelRatio: () => window.devicePixelRatio,
    resolveUrls(record) {
        return [kenshiAssetUrl(record.path, { version: BASE_MAP_REVISION })];
    },
    createOverlay: image => L.imageOverlay(image, bounds, {
        pane: 'baseMapPane',
        className: 'kimap-base-map-image',
        interactive: false
    }).addTo(map),
    onChange({ size, imageStatus, degraded }) {
        const container = map.getContainer();
        container.dataset.baseMapResolution = String(size);
        container.dataset.baseMapStatus = degraded ? 'degraded' : imageStatus;
    },
    onError: error => console.warn('Base-map resolution unavailable; retaining the last usable image.', error)
});
const refreshBaseMapResolution = () => baseMapController.reconcile();
map.on('resize', refreshBaseMapResolution);
window.addEventListener('resize', refreshBaseMapResolution);
const refreshVisibleBaseMap = () => {
    if (document.visibilityState === 'visible') refreshBaseMapResolution();
};
document.addEventListener('visibilitychange', refreshVisibleBaseMap);
window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    baseMapController.destroy();
    map.off('resize', refreshBaseMapResolution);
    window.removeEventListener('resize', refreshBaseMapResolution);
    document.removeEventListener('visibilitychange', refreshVisibleBaseMap);
});
wheelZoomGovernor = createWheelZoomGovernor({
    map,
    element: map.getContainer(),
    focusTarget: window,
    normalizeDelta: event => L.DomEvent.getWheelDelta(event)
});
for (const handler of [
    map.dragging,
    map.doubleClickZoom,
    map.boxZoom,
    map.keyboard,
    map.touchZoom
]) {
    handler?.disable?.();
}
townLayer.addTo(map);
narcoticProhibitionLayer.addTo(map);
prospectingLayer.addTo(map);
factionOverviewAreaLayer.addTo(map);
factionOverviewTownLayer.addTo(map);
contextIndicatorLayer.addTo(map);
playerMarkerLayer.addTo(map);
selectionPointLayer.addTo(map);
pointProbeLayer.addTo(map);
map.on('popupopen', () => { mapPopupOpen = true; });
map.on('popupclose', () => { mapPopupOpen = false; });
map.on('zoomend', () => {
    if (selectionSession?.getSelection()?.kind === 'point') {
        synchronizeSelectionUI({ type: 'viewport' });
    }
});

const workbenchElement = document.getElementById('viewport-workbench');
if (workbenchElement) {
    const initialRect = workbenchElement.getBoundingClientRect();
    const initialLayout = classifyViewportLayout(initialRect.width, initialRect.height, {
        phoneLandscapeEligible: hasPhoneSizedTouchScreen(window)
    });
    viewportComposition.setLayoutClass(initialLayout.layoutClass, initialLayout.short, initialLayout.phone);
}

mapReadinessCoordinator = createMapReadinessCoordinator({
    prepareImage: () => baseMapController.prepareInitial(
        parseMapViewport(window.location.hash)?.zoom ?? map.getBoundsZoom(bounds, false, [16, 16])
    ),
    onInitialStabilize({ imageStatus, preparedImage }) {
        if (imageStatus === MAP_IMAGE_READINESS.ERROR) {
            throw new Error('The Kenshi base-map image could not be loaded.');
        }
        markMapTiming('base-image-ready');
        baseMapController.mountInitial(preparedImage);
        map.invalidateSize({ pan: false, animate: false });
        map.fitBounds(bounds, { animate: false, padding: [8, 8] });
        baseMapController.reconcile();
        const workspace = document.getElementById('map-workspace');
        if (workspace) {
            workspace.dataset.mapImageStatus = imageStatus;
        }
        markMapTiming('initial-fit-complete');
        measureMapTiming('base-map image and initial fit', 'map-readiness-start', 'initial-fit-complete');
    },
    onOptionalJobError(error, job) {
        console.warn(`Optional map hydration '${job.id}' failed.`, error);
    }
});
map.on('movestart zoomstart', () => {
    mapMovementDepth += 1;
    mapReadinessCoordinator.setMovementActive(true);
    baseMapController.setMovementActive(true);
    if (
        !interactionTimingActive &&
        firstInteractionCount < 2 &&
        document.getElementById('map-workspace')?.dataset.mapReady === 'true'
    ) {
        firstInteractionCount += 1;
        interactionTimingActive = true;
        markMapTiming(`interaction-${String(firstInteractionCount)}-start`);
    }
});
map.on('moveend zoomend', () => {
    mapMovementDepth = Math.max(0, mapMovementDepth - 1);
    if (mapMovementDepth === 0) {
        mapReadinessCoordinator.setMovementActive(false);
        baseMapController.setMovementActive(false);
    }
    if (!interactionTimingActive || mapMovementDepth !== 0) return;
    markMapTiming(`interaction-${String(firstInteractionCount)}-complete`);
    measureMapTiming(
        `interaction ${String(firstInteractionCount)}`,
        `interaction-${String(firstInteractionCount)}-start`,
        `interaction-${String(firstInteractionCount)}-complete`
    );
    interactionTimingActive = false;
});
window.addEventListener('pagehide', () => mapReadinessCoordinator?.destroy(), { once: true });
window.addEventListener('pagehide', () => wheelZoomGovernor?.destroy(), { once: true });

function completeMapReadiness() {
    baseMapController.enable();
    for (const handler of [
        map.dragging,
        map.doubleClickZoom,
        map.boxZoom,
        map.keyboard,
        map.touchZoom
    ]) {
        handler?.enable?.();
    }
    wheelZoomGovernor.enable();
    const workspace = document.getElementById('map-workspace');
    if (workspace) workspace.dataset.mapReady = 'true';
    markMapTiming('application-ready');
    measureMapTiming('complete map readiness', 'map-readiness-start', 'application-ready');
}

townLayoutController = createTownLayoutController({
    backdrop: document.getElementById('town-layout-backdrop'),
    title: document.getElementById('town-layout-title'),
    vizContainer: document.getElementById('town-layout-viz'),
    loader: document.getElementById('layout-loading-overlay'),
    resetButton: document.getElementById('town-layout-reset-btn'),
    onError(error) {
        console.error('Town layout could not be displayed.', error);
        setSelectionStatus('Town layout could not be displayed.', 'error');
    }
});
window.addEventListener('pagehide', () => townLayoutController?.disconnect(), { once: true });
const townLayoutWidthObserver = new ResizeObserver(() => updateTownLayoutCanonicalWidth());
if (workbenchElement) townLayoutWidthObserver.observe(workbenchElement);
window.addEventListener('pagehide', () => townLayoutWidthObserver.disconnect(), { once: true });
//
/**  
*    Order matters! Please note the ongoing modal window shift.
*    Note for v2 -- Layouts & Landmarks -- Consider response minifier.
*    Test -- Manifested Roads, Layouts & Landmarks -- Then consult RoadSmith
**/ 
async function initializeMap() {
hideInitializationError();
// 
L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
setupEventListeners();
setupLayerSynchronization();
setupProjectMapControls();
const runtimeConfig = getKimapRuntimeConfig();
const apiUrl = buildMapDataApiUrl(runtimeConfig);

const initialApiRequest = fetch(apiUrl, { credentials: 'omit' });
void initialApiRequest.catch(() => {});
markMapTiming('map-readiness-start');
await mapReadinessCoordinator.start();
if (workbenchElement && !viewportResizeAdapter) {
    viewportResizeAdapter = createViewportResizeAdapter({
        session: viewportComposition,
        map,
        workbenchElement,
        mapElement: document.getElementById('map-container')
    });
    window.addEventListener('pagehide', () => viewportResizeAdapter?.disconnect(), { once: true });
}
// -1A. Try the API
return initialApiRequest
// -1B. Response Determination
.then(response => {
if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
return response.json();
})
// -1C. If API Failure
.then(async apiResponse => {
// 0. Clear cached overlays
if (spawnAreaOverlay && map.hasLayer(spawnAreaOverlay)) 
{
  spawnAreaOverlay.removeFrom(map);
}
spawnAreaOverlay = null;
// 1. API Responses
const result = parseMapDataResponse(apiResponse, runtimeConfig);
initialApiData = result;
topBarController.clearInitializationFailure();
const userData = result.userData;
let documentBaselineKey = `unavailable:${userData.manifestId}`;
try {
  documentBaselineKey = deriveBaselineKey(result);
} catch (error) {
  console.warn('Portable document origin could not derive a scenario baseline key.', error);
}
const documentOrigin = { manifestId: userData.manifestId, baselineKey: documentBaselineKey };
const getAssetUrl = (key) => kenshiAssetUrl(result.assets[key].url);
// 1A. Initialize Player Markers
initPlayerMarkerModule({
  map: map,
  playerMarkerLayer: playerMarkerLayer,
  playerMarkerStore: playerMarkerStore,
  documentOrigin
});
// 1B. Initialize Paint Module
initPaintModule({
  map: map,
  paintStore: paintStore,
  documentOrigin,
  toolHost: document.getElementById('map-tool-shelf-paint-slot'),
  popoverHost: document.getElementById('map-popover-host'),
  onIconPopoverToggle: () => {
      topBarController.closeTransient({ restoreFocus: false });
      viewportComposition.toggleTransientSurface('paintIcons');
  },
  onIconPopoverClose: ({ restoreFocus = false } = {}) => closeActiveTransientSurface({
      expected: 'paintIcons',
      restoreFocus
  })
});
setupPaintUI(); 
setupAnchoredPopoverGeometry();
subscribePlayerMarkerDocumentStatus(renderPlanDashboard);
subscribePaintDocumentStatus(renderPlanDashboard);
subscribePlayerMarkerInteraction(handlePlayerMarkerInteraction);
subscribePaintInteraction(handlePaintInteraction);
renderPlanDashboard();
renderPlanToolInteractions();
// 2. Process Data
// --- MIGRATION: PARALLEL DATA QUEUE ---
// 3A. Define which datasets are handled by the new system
const loadingQueue = [
    { key: 'aiPackages',         handler: processAiPackageData }, 
    { key: 'animals',            handler: processAnimalData },    
    { key: 'armours',            handler: processArmourData },    
    { key: 'artifacts',          handler: processArtifactData },
    { key: 'bags',               handler: processBagData },
    { key: 'biomes',             handler: processBiomeData },
    { key: 'buildings',          handler: processBuildingData },
    { key: 'buildingSwaps',      handler: processBuildingSwapData },
    { key: 'characters',         handler: processCharacterData },
    { key: 'colourSchemes',      handler: processColourSchemeData },
    { key: 'constants',          handler: processConstantsData },
    { key: 'crossbows',          handler: processCrossbowData },
    { key: 'effects',            handler: processEffectData },
    { key: 'factionCampaigns',   handler: processFactionCampaignData },
    { key: 'gameStarts',         handler: processGameStartData },
    { 
        key: 'factions',         
        handler: (data) => {
            processFactionData(data);
            console.log("Faction reference data initialized.");
        }
    },
    { key: 'items',               handler: processItemData },
    { key: 'itemMaterialsWeapon', handler: processItemMaterialsWeaponData },
    { key: 'limbReplacements',    handler: processLimbReplacementData },
    { key: 'mapItems',            handler: processMapItemData },
    { key: 'nestItems',           handler: processNestItemData },
    { key: 'races',     handler: processRaceData },
    { key: 'research',  handler: processResearchData },
    { key: 'resources', handler: processResourceData },
    { key: 'seasons',    handler: processSeasonData },
    { key: 'spawnAreas', handler: processSpawnAreaData },
    { key: 'squads',     handler: processSquadData },
    { key: 'stats',      handler: processStatsData },
    { key: 'townFcsData',   handler: processFcsData },
    { key: 'tradeCultures', handler: processTradeCultureData },
    { key: 'vendorLists',   handler: processVendorListData },
    { 
        key: 'mapData', 
        handler: (data) => {
            processLocationData(data); // 1. Populate the database
            
            // Keep the existing renderer-facing map-data reference available.
            if (typeof initialApiData !== 'undefined') {
                initialApiData.mapData = data;
            }
            console.log("Map Data (Locations) loaded and cached for subscribers.");
        }
    },
    { key: 'weapons',             handler: processWeaponData },
    { key: 'weaponManufacturers', handler: processWeaponManufacturerData },
    { key: 'weather',             handler: processWeatherData },
    { 
        key: 'worldStates', 
        handler: (data) => {
            processWorldStateListData(data);

            if (typeof initialApiData !== 'undefined') {
                initialApiData.worldStates = data;
            }

            console.log("World-state reference data initialized.");
        }
    }
];
// 3B. Fetch and parse every required dataset before mutating application stores.
markMapTiming('required-datasets-start');
const stagedDatasets = await loadRequiredDatasets(result);
markMapTiming('required-datasets-complete');
measureMapTiming(
    'required dataset staging',
    'required-datasets-start',
    'required-datasets-complete'
);

// 3C. Build geographic selection identity independently of scenario normalization.
try {
    selectionOrigin = createSelectionOrigin(result);
    selectionCatalog = createSelectionCatalog({
        origin: selectionOrigin,
        towns: stagedDatasets.townFcsData,
        spawnAreas: stagedDatasets.spawnAreas,
        mapLocations: stagedDatasets.mapData
    });
    selectionSession = new SelectionSession(selectionCatalog);
    pointProbeSession = new PointProbeSession(selectionCatalog);
} catch (error) {
    selectionOrigin = null;
    selectionCatalog = null;
    selectionSession = null;
    pointProbeSession = null;
    console.error('Geographic selection is unavailable; continuing with map exploration.', error);
}

// 3D. Build the immutable scenario baseline before existing handlers mutate application databases.
try {
    markMapTiming('scenario-normalization-start');
    scenarioBaseline = normalizeScenarioBaseline({ contract: result, datasets: stagedDatasets });
    markMapTiming('scenario-normalization-complete');
    measureMapTiming(
        'scenario normalization',
        'scenario-normalization-start',
        'scenario-normalization-complete'
    );
} catch (error) {
    scenarioBaselineError = error;
    console.error('Scenario baseline is unavailable; continuing in reference-only mode.', error);
}

// 3E. Commit the complete staged set through the existing handlers in declared order.
commitRequiredDatasets(loadingQueue, stagedDatasets, {
    contractVersion: result.contractVersion,
    manifestId: userData.manifestId
});

// 3F. Install either the authoritative command session or read-only reference adapters.
if (scenarioBaseline) {
    try {
        scenarioSession = new ScenarioSession(scenarioBaseline);
        ({ relationsStore, characterStore, historyStore } =
            createScenarioAdapters(scenarioSession));
    } catch (error) {
        scenarioBaselineError = error;
        scenarioSession = null;
        console.error('Scenario solver is unavailable; continuing in reference-only mode.', error);
    }
}

if (!scenarioSession) {
    ({ relationsStore, characterStore, historyStore } =
        createReferenceOnlyScenarioAdapters(stagedDatasets));
}

// 3G. Discovery is an exact-ID, read-only projection over the staged manifest.
setupReferenceInspector();
try {
    discoveryCatalog = createDiscoveryCatalog({ datasets: stagedDatasets, baseline: scenarioBaseline });
} catch (error) {
    discoveryCatalog = null;
    discoveryContextCatalog = null;
    discoveryPresentation = null;
    console.error('Discovery reference data is unavailable; map exploration remains active.', error);
}

if (discoveryCatalog) {
    try {
        discoveryContextCatalog = createDiscoveryContextCatalog({
            discoveryCatalog,
            datasets: stagedDatasets,
            baseline: scenarioBaseline
        });
    } catch (error) {
        console.error('Discovery Context evidence is unavailable; references remain active.', error);
        discoveryContextCatalog = createDiscoveryContextCatalog({
            discoveryCatalog,
            datasets: stagedDatasets,
            baseline: null
        });
    }
    discoveryPresentation = new DiscoveryPresentationSession({
        keyCharacterIds: discoveryContextCatalog.keyCharacters.map(({ entityId }) => entityId),
        bountyTargetIds: discoveryContextCatalog.bountyTargets.map(({ entityId }) => entityId),
        fancyWielderIds: discoveryContextCatalog.fancyWeaponWielders.map(({ entityId }) => entityId),
        animalIds: discoveryContextCatalog.deadlyAnimals.map(({ entityId }) => entityId),
        nestSources: discoveryContextCatalog.nestTreasures.flatMap(({ entityId, sources }) =>
            sources.map(({ nestId }) => ({ nestItemId: entityId, nestId }))
        ),
        treasureTownIds: discoveryContextCatalog.treasureSpots.map(({ townId }) => townId),
        narcoticItemIds: discoveryContextCatalog.narcotics.map(({ entityId }) => entityId)
    });
    discoveryPresentation.subscribe(() => {
        renderBrowsePresentation();
        scheduleDiscoveryContextIndicators();
        scheduleNarcoticProhibition();
    });
}
try {
    factionOverviewCatalog = createFactionOverviewCatalog({
        datasets: stagedDatasets,
        baseline: scenarioBaseline,
        snapshot: scenarioSession?.getSnapshot() ?? null
    });
    factionOverviewProjection = projectFactionOverview({
        catalog: factionOverviewCatalog,
        baseline: scenarioBaseline,
        snapshot: null
    });
} catch (error) {
    factionOverviewCatalog = null;
    factionOverviewProjection = null;
    console.error('Faction Overview evidence is unavailable; ordinary references remain active.', error);
}
//
// Gather the databases you want searchable
const discoverySearchDatabase = entityType => Object.fromEntries(
    Object.values(discoveryCatalog?.byType?.[entityType] ?? {}).map(entity => [
        entity.entityId,
        { StringId: entity.entityId, Name: entity.name }
    ])
);
const searchTownDatabase = Object.fromEntries(
    Object.entries(townDatabase).filter(([, town]) => Number(town?.Values?.type) !== 0)
);
const searchDatabases = {
    // Entities that use showInfoPanel (Map Entities)
    'town': searchTownDatabase,
    'spawnArea': spawnAreaDatabase, 

    // Exact-ID discovery reference entities.
    'nest': discoverySearchDatabase('nest'),
    'squad': discoverySearchDatabase('squad'),
    'character': discoverySearchDatabase('character'),
    'faction': discoverySearchDatabase('faction'),
    'item': discoverySearchDatabase('item'),
    'weapon': discoverySearchDatabase('weapon'),
    'crossbow': discoverySearchDatabase('crossbow'),
    'armour': discoverySearchDatabase('armour'),
    'mapItem': discoverySearchDatabase('mapItem'),
    'nestItem': discoverySearchDatabase('nestItem')
};
topBarController.setSearchRecords(searchDatabases);

// --- END MIGRATION QUEUE ---
colorToAreaMap = buildColorToAreaMap(Object.values(spawnAreaDatabase));
const areasMapUrl = getAssetUrl('areasMap');
if (areasMapUrl) {
    loadAndProcessSpawnMap(areasMapUrl);
} else {
    spawnRasterStatus = 'unavailable';
    discoveryContextIndicatorStatus = 'unavailable';
    refreshProspectingCatalog();
    renderBrowsePresentation();
    setPoliticalStatus('unavailable', 'Political View requires the areas raster, which is unavailable.');
    console.warn("No areas map URL provided by getmapdata.");
}
buildingLocationsUrl = getAssetUrl('buildingLocations');
roadNetworkUrl = getAssetUrl('roadNetwork');
if (roadNetworkUrl) {
    mapReadinessCoordinator.addOptionalJob({
        id: 'road-network',
        priority: 5,
        run: loadRoadNetwork
    });
}
// 4. Scenario-derived snapshots are read directly from the authoritative session.
// 5. Setup the Content Browser
const browserData = 
{
  aiPackage: aiPackageDatabase,
  animal: animalDatabase,
  armour: armourDatabase,
  bags: bagDatabase,
  biome: biomeDatabase,
  building: buildingDatabase,
  buildingSwap: buildingSwapDatabase,
  character: characterDatabase,
  colourScheme: colourSchemeDatabase,
  crossbow: crossbowDatabase,
  effects: effectDatabase,
  faction: factionDatabase,
  factionCampaign: factionCampaignDatabase,
  gameStart: gameStartDatabase,
  item: itemDatabase,
  itemMaterialsWeapon: itemMaterialsWeaponDatabase,
  mapItem: mapItemDatabase,
  nestItem: nestItemDatabase,
  race: raceDatabase,
  research: researchDatabase,
  resources: resourceDatabase,
  season: seasonDatabase,
  spawnArea: spawnAreaDatabase,    
  squad: squadDatabase,
  stats: statsDatabase,
  town: townDatabase,
  tradeCulture: tradeCultureDatabase,
  vendorList: vendorListDatabase,
  weather: weatherDatabase,
  weapon: weaponDatabase,
  weaponManufacturer: weaponManufacturerDatabase,
  worldState: worldStateListDatabase
};
// --- RELATIONS LAYER LOGIC ---
// When the layer is "added" (checked), turn on the CSS mode
relationsModeLayer.on('add', () => {
    document.getElementById('map-container').classList.add('mode-relations');
});
// When the layer is "removed" (unchecked), turn off the CSS mode
relationsModeLayer.on('remove', () => {
    document.getElementById('map-container').classList.remove('mode-relations');
});
// 6. WINDOW REGISTRATION ZONE ---
// 6-01. Global Status Init
const statusPane = document.getElementById('pane-global-status');
windowManager.register('status', theaterLabel('status'), statusPane, () => {
    // Lifecycle Hook: Updates UI every time the tab is opened
    updateStatusWindow(); // Use the main file func
    updateUndoRedoButtons(); // Ensures button state is correct
});
// 6-02. World History Init
initWorldHistoryModule(windowManager);
// 6-03. Power Ranks Init
powerRanksController = initPowerRanksModule(
    windowManager,
    () => scenarioLensProjection
        ? {
            entries: scenarioLensProjection.powerRanks,
            diagnostics: scenarioLensProjection.powerRankDiagnostics
        }
        : null
);
// 6-04. Infamy Tracker Init
const infamyPane = document.getElementById('pane-infamy');
windowManager.register('infamy', theaterLabel('infamy'), infamyPane, () => {
    // Run logic every time the window opens to ensure fresh state
    populateInfamyTracker();
});
// 6-05. Town Overrides Init
townOverridesController = initTownOverridesModule(
    windowManager,
    () => scenarioLensProjection?.townOverrides ?? null,
    kenshiAssetUrl,
    townId => selectGeographicEntity('town', townId, null, 'override')
);
// 6-06. Environment Info Init
try {
    environmentInfoProjection = createEnvironmentInfoProjection({
        spawnArea: spawnAreaDatabase, season: seasonDatabase, weather: weatherDatabase,
        effect: effectDatabase, resource: resourceDatabase
    });
} catch (error) {
    console.error('Environmental data could not be projected.', error);
}
initEnvironmentInfoModule(windowManager, environmentInfoProjection);
refreshEnvironmentReports();
refreshProspectingCatalog();
// 6-07. Global Settings Init
initGlobalSettings(windowManager, constantsDatabase, artifactDatabase);
// 6-08. Content Browser Init
initContentBrowser(windowManager, browserData, {
    selectGeographic: (entityType, entityId) =>
        showInfoPanel(entityId, entityType, null, 'contentBrowser'),
    getGeographicContext: () => contextProjection
});
// 6-09. Equipment Locker Init
// Project directly from the staged arrays so malformed and duplicate exact identities
// remain available to the Locker's isolated diagnostics instead of being collapsed by maps.
initEquipmentLockerModule(windowManager, {
    weapons: stagedDatasets.weapons,
    crossbows: stagedDatasets.crossbows,
    armours: stagedDatasets.armours,
    bags: stagedDatasets.bags,
    limbReplacements: stagedDatasets.limbReplacements,
    items: stagedDatasets.items,
    mapItems: stagedDatasets.mapItems,
    nestItems: stagedDatasets.nestItems,
    characters: stagedDatasets.characters,
    weaponManufacturers: stagedDatasets.weaponManufacturers
});
// 6-10. Research Tree Init
initResearchTreeModule(windowManager, stagedDatasets.research);
// 6-11. Player Markers Init
const pmPane = document.getElementById('pane-player-markers');
windowManager.register('markers', theaterLabel('markers'), pmPane);
const paintPane = document.getElementById('pane-paint-tools');
windowManager.register('paint', theaterLabel('paint'), paintPane);
const prefsPane = document.getElementById('pane-user-prefs');
windowManager.register('prefs', theaterLabel('prefs'), prefsPane, renderScenarioDocumentStatus);
const prefsId = document.getElementById('prefs-manifest-id');
if (prefsId) prefsId.textContent = userData.manifestId;
topBarController.setRegisteredDestinations(THEATER_DESTINATIONS.map(({ id }) => id));
// 7. Update the UI
// Status shifted to Alpine store
Alpine.store('user').manifestId = userData.manifestId || 'vanilla';
setupHistoryManagementListeners();

populateFactionControlsPanel(Object.values(factionDatabase));
populateCharacterStatusPanel();
populateManifest(result);
loadBiomeMap();
initializeLayerControls();
setupLayerConfigurationControls();
setupFactionColorsControls();
markMapTiming('scanner-mount-start');
initWorldTracker(map);
markMapTiming('scanner-mount-complete');
measureMapTiming('Scanner mount', 'scanner-mount-start', 'scanner-mount-complete');
if (performanceDebugEnabled) {
    const scannerElement = document.getElementById('world-tracker');
    const scannerFilter = scannerElement ? getComputedStyle(scannerElement).backdropFilter : 'none';
    console.debug('[KiMap timing] Scanner backdrop filter:', scannerFilter || 'none');
}
mapReadinessCoordinator.addOptionalJob({
    id: 'landmarks',
    priority: 1,
    run: loadLandmarksBackground
});
setupDockLogic();
setupEscapeCoordination();
renderBrowsePresentation();

// 8. One authoritative geographic selection fans out to map and context renderers.
if (selectionSession) {
    selectionSession.subscribe(change => {
        if ((change.type === 'select' || change.type === 'clear') &&
            viewportComposition.getSnapshot().phoneForeground === 'townCard') {
            viewportComposition.closePhoneForeground();
        }
        if (change.type === 'select') dismissPointProbe({ closePopup: true });
        if (change.type === 'select' && !preserveReferenceOnNextSelection) {
            referenceNavigation?.clear();
            pendingReferenceFocus = [];
        }
        if (change.type === 'select' || change.type === 'clear') {
            viewportComposition.showPointContext();
        }
    });
    selectionSession.subscribe(synchronizeSelectionUI);
    synchronizeSelectionUI({ type: 'initialize' });
    restoreSharedMapView();
}
if (pointProbeSession) pointProbeSession.subscribe(refreshPointProbePresentation);

// 9. One authoritative scenario subscription fans out to the existing renderers.
if (scenarioSession) {
    setScenarioAvailability(true);
    scenarioSession.subscribe(synchronizeScenarioUI);
    synchronizeScenarioUI({ type: 'initialize' });
    const diagnostics = scenarioLensProjection?.diagnostics.visible ?? [];
    if (diagnostics.length > 0) {
        console.warn('Scenario lens diagnostics:', diagnostics);
        setScenarioStatus(
            `Scenario ready with ${diagnostics.length} data diagnostic${diagnostics.length === 1 ? '' : 's'}.`,
            'info'
        );
    } else if (scenarioLensError) {
        setScenarioStatus(`Scenario analysis unavailable: ${scenarioLensError.message}`, 'error');
    } else {
        setScenarioStatus('');
    }
} else {
    const reason = scenarioBaselineError instanceof ScenarioError
        ? scenarioBaselineError.message
        : 'Scenario data could not be normalized safely.';
    setScenarioAvailability(false, `Simulation unavailable: ${reason}`);
    updateVerboseLog([]);
    renderWorldHistoryLog([]);
    updateUndoRedoButtons();
    if (initialApiData.mapData) drawTownMarkers(initialApiData.mapData);
}

completeMapReadiness();

}) // Enact 1C
.catch(error => 
{
  console.error('Fatal Error loading initial data:', error);
  if(userStatusContainer) userStatusContainer.textContent = 'Error loading map data.';
  showInitializationError(error);
});
}
// ---Initialization complete! --- (Line 837). (2-10, 4:28PM)
// --- Data Processing Functions ---

function processAiPackageData(data) {
    if (!data) return;
    data.forEach(item => { aiPackageDatabase[item.StringId] = item; });
}

function processAnimalData(animals) {
    if (!animals) return;
    animals.forEach(animal => {
        animalDatabase[animal.StringId] = animal;
    });
}

function processArmourData(armours) {
    if (!armours) return;
    armours.forEach(item => {
        armourDatabase[item.StringId] = item;
    });
}

function processArtifactData(artifacts) {
    if (!artifacts) return;
    artifacts.forEach(item => { artifactDatabase[item.StringId] = item; });
}

function processBagData(bags) {
    if (!bags) return;
    bags.forEach(item => { bagDatabase[item.StringId] = item; });
}

function processBiomeData(data) {
    if (!data) return;
    data.forEach(item => { biomeDatabase[item.StringId] = item; });
}

function processBuildingData(buildings) {
    if (!buildings) return;
    buildings.forEach(item => { buildingDatabase[item.StringId] = item; });
}

function processBuildingSwapData(data) {
    if (!data) return;
    data.forEach(item => { buildingSwapDatabase[item.StringId] = item; });
}

function processCharacterData(characters) {
    if (!characters) return;
    characters.forEach(item => { characterDatabase[item.StringId] = item; });
}

function processColourSchemeData(data) {
    if (!data) return;
    data.forEach(item => { colourSchemeDatabase[item.StringId] = item; });
}

function processConstantsData(constants) {
    if (!constants) return;
    constants.forEach(item => { constantsDatabase[item.StringId] = item; });
}

function processCrossbowData(crossbows) {
    if (!crossbows) return;
    crossbows.forEach(item => { crossbowDatabase[item.StringId] = item; });
}

    function processEffectData(data) {
    if (!data) return;
    data.forEach(item => { effectDatabase[item.StringId] = item; });
}

function processFactionCampaignData(data) {
    if (!data) return;
    data.forEach(item => { factionCampaignDatabase[item.StringId] = item; });
}

function processFactionData(factions) {
    if (!factions) return;    
    factions.forEach(faction => {
        factionDatabase[faction.StringId] = faction;
    });
}

function processGameStartData(gameStarts) {
    if (!gameStarts) return;
    gameStarts.forEach(item => { gameStartDatabase[item.StringId] = item; });
}

function processItemData(items) {
    if (!items) return; 
    items.forEach(item => { itemDatabase[item.StringId] = item; });
}

function processItemMaterialsWeaponData(data) {
    if (!data) return;
    data.forEach(item => { itemMaterialsWeaponDatabase[item.StringId] = item; });
}

function processLimbReplacementData(data) {
    if (!data) return;
    data.forEach(item => { limbReplacementDatabase[item.StringId] = item; });
}

function processMapItemData(data) {
    if (!data) return;
    data.forEach(item => { mapItemDatabase[item.StringId] = item; });
}

function processNestItemData(data) {
    if (!data) return;
    data.forEach(item => { nestItemDatabase[item.StringId] = item; });
}

function processRaceData(data) {
    if (!data) return;
    data.forEach(item => { raceDatabase[item.StringId] = item; });
}

function processResearchData(data) {
    selectIndexableResearchRecords(data).forEach(item => {
        researchDatabase[item.StringId] = item;
    });
}

function processResourceData(data) {
    if (!data) return;
    data.forEach(item => { resourceDatabase[item.StringId] = item; });
}

function processSeasonData(data) {
    if (!data) return;
    data.forEach(item => { seasonDatabase[item.StringId] = item; });
}

function processSpawnAreaData(spawnAreas) {
    if (!spawnAreas) return;
    spawnAreas.forEach(area => {
        spawnAreaDatabase[area.StringId] = area;
    });
}

function processSquadData(data) {
    if (!data) return;
    data.forEach(item => { squadDatabase[item.StringId] = item; });
}

function processStatsData(data) {
    if (!data) return;
    data.forEach(item => { statsDatabase[item.StringId] = item; });
}

function processFcsData(fcsData) {
    if (!fcsData) return;
    fcsData.forEach(town => { townDatabase[town.StringId] = town; });
}

function processTradeCultureData(data) {
    if (!data) return;
    data.forEach(item => { tradeCultureDatabase[item.StringId] = item; });
}

function processVendorListData(data) {
    if (!data) return;
    data.forEach(item => { vendorListDatabase[item.StringId] = item; });
}

function processLocationData(locations) {
    if (!locations) return;
    locations.forEach(loc => { locationDatabase[loc.InstanceId] = loc; });
}

function processWeaponData(data) {
    if (!data) return;
    data.forEach(item => { weaponDatabase[item.StringId] = item; });
}

function processWeaponManufacturerData(data) {
    if (!data) return;
    data.forEach(item => { weaponManufacturerDatabase[item.StringId] = item; });
}

function processWeatherData(data) {
    if (!data) return;
    data.forEach(item => { weatherDatabase[item.StringId] = item; });
}

function processWorldStateListData(data) {
    if (!data) return;
    data.forEach(item => { worldStateListDatabase[item.StringId] = item; });
}

    /**
     * Central hub for all application event listeners. Uses event delegation for efficiency.
     */
    function setupEventListeners() {
        map.on('click', function(e) {
            if (
                e.originalEvent?.kimapPlanGestureConsumed ||
                playerMarkerStore.isPlacementModeActive() ||
                isPaintActive()
            ) return;
            if (!setPointProbe(e.latlng)) return;
            viewportComposition.hideInspector();
            openPointProbePopup(e.latlng, locationReporting?.getProbeInputKind(e.originalEvent));
        });

    // Main Menu Things
    if (simulationContainer) {
        simulationContainer.addEventListener('change', (event) => {
            // Handle Faction Dropdown
            if (event.target.id === 'faction-select-dropdown') {
                updateFactionControlUI(event.target.value);
            }
            // Handle Character Dropdown
            if (event.target.id === 'character-select-dropdown') {
                updateCharacterControlUI(event.target.value);
            }
        });

        simulationContainer.addEventListener('input', (event) => {
            // Sync Faction slider/input
            if (event.target.id === 'faction-relations-slider') {
                document.getElementById('faction-relations-input').value = event.target.value;
            }
            if (event.target.id === 'faction-relations-input') {
                document.getElementById('faction-relations-slider').value = event.target.value;
            }
        });

        simulationContainer.addEventListener('click', (event) => {
            // Faction Apply
            if (event.target.id === 'faction-apply-button') {
                const factionId = document.getElementById('faction-select-dropdown').value;
                if (!factionId || !scenarioSession) return;

                try {
                    const newValue = normalizeFactionRelation(
                        document.getElementById('faction-relations-input').valueAsNumber
                    );
                    scenarioSession.dispatch(createScenarioCommand(
                        COMMAND_TYPES.SET_FACTION_RELATION,
                        { factionId, value: newValue, playerInvolved: true }
                    ));
                } catch (error) {
                    console.error('Faction scenario command rejected:', error);
                    setScenarioStatus(error?.message || 'The faction change was rejected.', 'error');
                }
            }
            // Character Apply
            if (event.target.id === 'character-apply-button') {
                const charSelect = document.getElementById('character-select-dropdown');
                const selectedStatus = simulationContainer.querySelector(
                    'input[name="character-status"]:checked'
                );
                const playerInvolved = document.getElementById('character-player-involved')?.checked ?? true;

                if (!charSelect?.value || !scenarioSession) return;
                try {
                    const newValue = normalizeCharacterStatus(selectedStatus?.value);
                    scenarioSession.dispatch(createScenarioCommand(
                        COMMAND_TYPES.SET_CHARACTER_STATUS,
                        { characterId: charSelect.value, status: newValue, playerInvolved }
                    ));
                } catch (error) {
                    console.error('Character scenario command rejected:', error);
                    setScenarioStatus(error?.message || 'The character change was rejected.', 'error');
                }
            }    
        });
    }

    // --- 2. Manifest Tab (Formerly Left Menu) ---
    if (manifestContainer) {
        // Filter Logic
        manifestContainer.addEventListener('keyup', (event) => {
            if (event.target.classList.contains('filter-input')) {
                const filterText = event.target.value.toLowerCase();
                const targetListId = event.target.dataset.targetList;
                const select = document.getElementById(targetListId);
                if (select) {
                    for (const option of select.options) {
                        const optionText = option.text.toLowerCase();
                        option.style.display = optionText.startsWith(filterText) ? '' : 'none';
                    }
                }
            }
        });

        // Enter and the established double-click interaction share one exact-ID route.
        manifestContainer.addEventListener('keydown', event => {
            if (event.key !== 'Enter' || event.target.tagName !== 'SELECT') return;
            const option = event.target.selectedOptions?.[0];
            if (option) openBrowseOption(option);
        });

        manifestContainer.addEventListener('dblclick', (event) => {
            if (event.target.tagName === 'OPTION') openBrowseOption(event.target);
        });
    }

    // Verbose Logging Listener 
    const logContainer = document.getElementById('verbose-log-container');
    if (logContainer) {
        logContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('tab-button')) {
                // Remove active class from all tabs and content
                logContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                logContainer.querySelectorAll('.log-content').forEach(content => content.classList.remove('active'));
            
                // Add active class to the clicked tab and corresponding content
                const tabName = event.target.dataset.tab;
                event.target.classList.add('active');
                document.getElementById(`verbose-log-${tabName}`).classList.add('active');
            }
        });
    }

    // State Undo & Redo Listener
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            scenarioSession?.undo();
        });
    }
    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            scenarioSession?.redo();
        });
    }    

// --- Town Layout Window Listeners ---
const closeLayoutBtn = document.getElementById('close-town-layout-btn');
const layoutBackdrop = document.getElementById('town-layout-backdrop');

if (closeLayoutBtn) {
    closeLayoutBtn.addEventListener('click', closeTownLayoutCover);
}

if (layoutBackdrop) {
    layoutBackdrop.addEventListener('click', (e) => {
        if (e.target === layoutBackdrop) {
            closeTownLayoutCover();
        }
    });
    layoutBackdrop.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const focusable = [...layoutBackdrop.querySelectorAll(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), ' +
            'textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )].filter(isElementPresented);
        if (focusable.length === 0) {
            event.preventDefault();
            layoutBackdrop.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}

        // Space left for additiona event listeners and integrating the existing...

    }

/**
 * Connects the structural workbench chrome to its presentation-only session.
 */
function setupDockLogic() {
    if (!document.getElementById('unified-dock')) return;

    const taskButtons = [...document.querySelectorAll('[data-workbench-task]')];
    taskButtons.forEach((button, index) => {
        button.addEventListener('click', () => viewportComposition.setTask(button.dataset.workbenchTask));
        button.addEventListener('keydown', event => {
            let nextIndex = null;
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % taskButtons.length;
            if (event.key === 'ArrowLeft') nextIndex = (index - 1 + taskButtons.length) % taskButtons.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = taskButtons.length - 1;
            if (nextIndex === null) return;
            event.preventDefault();
            const next = taskButtons[nextIndex];
            viewportComposition.setTask(next.dataset.workbenchTask);
            next.focus();
        });
    });

    document.getElementById('browse-mode-context-btn')?.addEventListener('click', () => {
        viewportComposition.setBrowseMode('context');
    });
    document.getElementById('browse-mode-content-btn')?.addEventListener('click', () => {
        viewportComposition.setBrowseMode('content');
    });
    document.getElementById('browse-context-dashboard')?.addEventListener('click', event => {
        const route = event.target.closest('[data-context-route]')?.dataset.contextRoute;
        if (!route) return;
        viewportComposition.openContextRoute(route);
        queueMicrotask(() => {
            const scrollOwner = document.getElementById('workbench-route-browse');
            if (scrollOwner) scrollOwner.scrollTop = 0;
            retainedBrowseScrollTop = 0;
            syncContextChrome();
            const destination = DISCOVERY_CONTEXT_COLLECTIONS[route]
                ? 'browse-context-collection-title'
                : 'browse-context-title';
            document.getElementById(destination)?.focus({ preventScroll: true });
        });
    });
    document.getElementById('browse-context-collection')?.addEventListener('click', event => {
        const route = event.target.closest('[data-context-route]')?.dataset.contextRoute;
        if (!route) return;
        viewportComposition.openContextRoute(route);
        queueMicrotask(() => {
            const scrollOwner = document.getElementById('workbench-route-browse');
            if (scrollOwner) scrollOwner.scrollTop = 0;
            retainedBrowseScrollTop = 0;
            syncContextChrome();
            document.getElementById('browse-context-title')?.focus({ preventScroll: true });
        });
    });
    document.getElementById('browse-context-collection-back-btn')?.addEventListener('click', () => {
        const route = viewportComposition.getSnapshot().contextRoute;
        viewportComposition.backContextRoute();
        queueMicrotask(() => {
            const card = document.querySelector(`[data-context-route="${route}"]`);
            card?.focus({ preventScroll: true });
            card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            syncContextChrome();
        });
    });
    document.getElementById('browse-context-back-btn')?.addEventListener('click', () => {
        const route = viewportComposition.getSnapshot().contextRoute;
        viewportComposition.backContextRoute();
        queueMicrotask(() => {
            const card = document.querySelector(`[data-context-route="${route}"]`);
            card?.focus({ preventScroll: true });
            card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            syncContextChrome();
        });
    });
    document.getElementById('workbench-route-browse')?.addEventListener('scroll', scheduleContextChromeSync, { passive: true });
    document.getElementById('browse-context-help-btn')?.addEventListener('click', event => {
        const route = viewportComposition.getSnapshot().contextRoute;
        const target = CONTEXT_HELP_TARGETS[route];
        if (target) helpModule.handleNavigation(target, { returnFocus: event.currentTarget });
    });
    document.getElementById('browse-context-search-input')?.addEventListener('input', event => {
        if (viewportComposition.getSnapshot().contextRoute === 'prospecting') {
            prospectingPresentation.setSearch(event.target.value);
            return;
        }
        if (viewportComposition.getSnapshot().contextRoute === 'factionOverview') {
            factionOverviewPresentation.setSearch(event.target.value);
            return;
        }
        const subjectId = activeDiscoveryContextSubject();
        if (subjectId) discoveryPresentation?.setSearch(subjectId, event.target.value);
    });
    document.getElementById('browse-faction-picker')?.addEventListener('change', event => {
        const id = event.target.value;
        if (factionOverviewCatalog?.factions.some(faction => faction.id === id)) {
            factionOverviewPresentation.setSelectedFactionId(id);
        }
    });
    document.getElementById('browse-faction-clear-btn')?.addEventListener('click', () => {
        factionOverviewPresentation.setSelectedFactionId(null);
        document.getElementById('browse-faction-picker')?.focus({ preventScroll: true });
    });
    document.getElementById('browse-faction-overview-controls')?.addEventListener('click', event => {
        const control = event.target.closest('[data-faction-overview-action]');
        if (!control) return;
        if (control.dataset.factionOverviewAction === 'reference') {
            showReferenceRoot(control.dataset.entityType, control.dataset.entityId, control);
        } else if (control.dataset.factionOverviewAction === 'geographic') {
            const selected = selectGeographicEntity(
                control.dataset.entityType,
                control.dataset.entityId,
                control.dataset.instanceId || null,
                'context'
            );
            if (selected) executeGeographicAction('inspect');
        } else if (control.dataset.factionOverviewAction === 'power-ranks') {
            powerRanksController?.openFaction(control.dataset.entityId, { returnFocus: control });
        }
    });
    document.getElementById('browse-prospecting-controls')?.addEventListener('change', event => {
        const input = event.target.closest('[data-prospecting-criterion]');
        if (!input) return;
        const id = input.value;
        if (NUMERIC_CRITERIA.some(criterion => criterion.id === id)) {
            prospectingPresentation.setNumericSelected(id, input.checked);
        } else {
            prospectingPresentation.setConditionSelected(id, input.checked);
        }
    });
    document.getElementById('browse-prospecting-controls')?.addEventListener('input', event => {
        const input = event.target.closest('[data-prospecting-minimum]');
        if (!input) return;
        prospectingPresentation.setMinimum(input.dataset.prospectingMinimum, Number(input.value));
    });
    document.getElementById('browse-prospecting-clear-btn')?.addEventListener('click', () => {
        prospectingPresentation.clearCriteria();
    });
    document.getElementById('browse-context-show-btn')?.addEventListener('click', () => {
        const subjectId = activeDiscoveryContextSubject();
        const projection = projectActiveDiscoveryContext(subjectId);
        const snapshot = discoveryPresentation?.getSnapshot();
        const searchText = snapshot?.searchBySubject?.[subjectId]?.trim().toLocaleLowerCase() ?? '';
        const rows = (projection?.rows ?? []).filter(row =>
            contextSearchMatch(row, subjectId, searchText)
        );
        if (subjectId === 'keyCharacters' || subjectId === 'bountyTargets' || subjectId === 'fancyWeaponWielders') {
            discoveryPresentation?.showMany(subjectId, rows.map(({ entityId }) => entityId));
        } else if (subjectId === 'deadlyAnimals') {
            discoveryPresentation?.showMany(subjectId, rows.map(({ entityId }) => entityId));
        } else if (subjectId === 'nestTreasures') {
            discoveryPresentation?.showMany(subjectId, rows.flatMap(({ entityId, sources }) =>
                sources.map(({ nestId }) => ({ nestItemId: entityId, nestId }))
            ));
        } else if (subjectId === 'treasureSpots') {
            discoveryPresentation?.showMany(subjectId, rows.map(({ townId }) => townId));
        } else if (subjectId === 'narcotics') {
            discoveryPresentation?.showMany(subjectId, rows.map(({ entityId }) => entityId));
        }
    });
    document.getElementById('browse-context-clear-btn')?.addEventListener('click', () => {
        const subjectId = activeDiscoveryContextSubject();
        if (subjectId) discoveryPresentation?.clearSubject(subjectId);
    });
    document.getElementById('browse-context-results')?.addEventListener('click', event => {
        const control = event.target.closest('[data-context-action]');
        if (!control) return;
        const action = control.dataset.contextAction;
        if (action === 'reference') {
            showReferenceRoot(control.dataset.entityType, control.dataset.entityId, control);
        } else if (action === 'geographic') {
            const selected = selectGeographicEntity(
                control.dataset.entityType,
                control.dataset.entityId,
                control.dataset.instanceId || null,
                'context'
            );
            if (selected) executeGeographicAction('inspect');
        } else if (action === 'toggle-occurrences') {
            const occurrences = document.querySelector(
                `[data-context-occurrences="${CSS.escape(control.dataset.entityId)}"]`
            );
            if (!occurrences) return;
            occurrences.hidden = !occurrences.hidden;
            control.setAttribute('aria-expanded', String(!occurrences.hidden));
            if (!occurrences.hidden) occurrences.querySelector('button')?.focus({ preventScroll: true });
        } else if (action === 'prohibition') {
            const current = discoveryPresentation?.getSnapshot().activeNarcoticProhibitionId;
            discoveryPresentation?.setNarcoticProhibition(
                current === control.dataset.entityId ? null : control.dataset.entityId
            );
        }
    });
    document.getElementById('browse-context-results')?.addEventListener('toggle', event => {
        const details = event.target.closest('details[data-context-lazy-evidence]');
        if (details?.open) materializeContextEvidence(details);
    }, true);
    document.getElementById('browse-context-results')?.addEventListener('change', event => {
        const action = event.target.dataset.contextAction;
        try {
            if (action === 'toggle-character') {
                discoveryPresentation?.toggleCharacter(
                    event.target.dataset.subjectId,
                    event.target.dataset.entityId,
                    event.target.checked
                );
            }
            if (action === 'toggle-animal') {
                discoveryPresentation?.toggleAnimal(event.target.dataset.entityId, event.target.checked);
            }
            if (action === 'toggle-nest-source') {
                discoveryPresentation?.toggleNestSource({
                    nestItemId: event.target.dataset.nestItemId,
                    nestId: event.target.dataset.nestId
                }, event.target.checked);
            }
            if (action === 'toggle-treasure-town') {
                discoveryPresentation?.toggleTreasureTown(
                    event.target.dataset.entityId,
                    event.target.checked
                );
            }
            if (action === 'toggle-narcotic') {
                discoveryPresentation?.toggleNarcotic(
                    event.target.dataset.entityId,
                    event.target.checked
                );
            }
        } catch (error) {
            event.target.checked = !event.target.checked;
            setSelectionStatus(error.message, 'error');
        }
    });
    document.getElementById('browse-return-context-btn')?.addEventListener('click', () => {
        viewportComposition.setBrowseMode('context');
        queueMicrotask(() => document.getElementById('browse-context-title')?.focus({ preventScroll: true }));
    });
    document.getElementById('browse-clear-context-btn')?.addEventListener('click', () => {
        const subjectId = activeDiscoveryContextSubject();
        if (subjectId) discoveryPresentation?.clearSubject(subjectId);
    });

    document.getElementById('open-relations-journal-btn')?.addEventListener('click', () => {
        openRelationsJournalSubview();
    });

    for (const id of ['relations-subview-back-btn', 'journal-panel-close-btn']) {
        document.getElementById(id)?.addEventListener('click', () => viewportComposition.back());
    }

    document.getElementById('workbench-dock-toggle-btn')?.addEventListener('click', () => {
        viewportComposition.toggleDock();
    });
    const phoneReportSubject = document.getElementById('phone-report-subject');
    if (phoneReportSubject && !phoneReportSubject.options.length) {
        for (const { id, label } of REPORT_SUBJECTS) phoneReportSubject.add(new Option(label, id));
    }
    document.getElementById('phone-belt')?.addEventListener('click', event => {
        const button = event.target.closest('[data-phone-route]');
        if (!button || button.disabled) return;
        const route = button.dataset.phoneRoute;
        const layoutWasOpen = townLayoutController?.isOpen() === true;
        if (layoutWasOpen) closeTownLayoutCover();
        const state = viewportComposition.getSnapshot();
        if (layoutWasOpen && route === 'inspector' && state.phoneForeground === 'inspector') return;
        if (state.focusMap) {
            viewportComposition.exitFocusMap();
            return;
        }
        if (state.phoneForeground === route) {
            if (route === 'planTray') closePlanToolShelf();
            else viewportComposition.closePhoneForeground();
            return;
        }
        if (route === 'tasks') viewportComposition.showDock();
        else if (route === 'inspector') viewportComposition.showInspector();
        else if (route === 'planTray') showPlanToolShelf();
        else viewportComposition.openPhoneForeground(route);
    });
    document.getElementById('phone-town-card-close')?.addEventListener('click', () => {
        viewportComposition.closePhoneForeground();
    });
    document.getElementById('phone-town-card-context')?.addEventListener('click', () => {
        executeGeographicAction('inspect');
    });
    document.getElementById('phone-town-card-copy')?.addEventListener('click', event => {
        void copyCurrentMapView(event.currentTarget);
    });
    const transparencyButton = document.getElementById('phone-inspector-transparency-btn');
    transparencyButton?.addEventListener('click', () => {
        viewportComposition.setInspectorTransparencyOpen(
            !viewportComposition.getSnapshot().inspectorTransparencyOpen
        );
        if (viewportComposition.getSnapshot().inspectorTransparencyOpen) {
            queueMicrotask(() => document.getElementById('phone-inspector-transparency-range')?.focus({ preventScroll: true }));
        }
    });
    document.getElementById('phone-inspector-transparency-range')?.addEventListener('input', event => {
        viewportComposition.setInspectorTransparency(Number(event.currentTarget.value));
    });
    document.addEventListener('pointerdown', event => {
        if (!viewportComposition.getSnapshot().inspectorTransparencyOpen ||
            event.target.closest('#phone-inspector-transparency, #phone-inspector-transparency-btn')) return;
        viewportComposition.setInspectorTransparencyOpen(false);
    }, true);
    document.querySelectorAll('[data-phone-close]').forEach(button => {
        button.addEventListener('click', () => viewportComposition.closePhoneForeground());
    });
    document.getElementById('phone-tasks-close-btn')?.addEventListener('click', () => {
        viewportComposition.closePhoneForeground();
    });
    document.getElementById('phone-focus-map-btn')?.addEventListener('click', () => {
        document.getElementById('phone-workbench-utilities').open = false;
        cancelActivePlanGestures();
        viewportComposition.enterFocusMap();
    });
    document.getElementById('phone-reset-workspace-btn')?.addEventListener('click', () => {
        document.getElementById('phone-workbench-utilities').open = false;
        resetViewportWorkspace();
    });
    for (const [id, surface] of [
        ['phone-map-content-btn', 'mapContent'],
        ['phone-world-views-btn', 'worldViews']
    ]) {
        document.getElementById(id)?.addEventListener('click', () => {
            if (getLayerChooserLauncher(surface)?.disabled) return;
            viewportComposition.openTransientSurface(surface);
        });
    }
    phoneReportSubject?.addEventListener('change', () => {
        viewportComposition.setReportingSubject('pointProbe', phoneReportSubject.value);
    });
    document.getElementById('phone-report-settings-btn')?.addEventListener('click', () => {
        viewportComposition.setCursorControlsView('pointProbe');
        viewportComposition.openTransientSurface('cursorControls');
    });
    document.getElementById('phone-scorecard-btn')?.addEventListener('click', () => {
        if (!isPoliticalViewActive() || politicalReports?.available !== true) return;
        viewportComposition.setHudMode('scorecard');
        viewportComposition.setHudExpanded('scorecard', true);
        viewportComposition.openPhoneForeground('scorecard');
    });
    document.getElementById('workbench-inspector-toggle-btn')?.addEventListener('click', () => {
        const navigation = referenceNavigation.getSnapshot();
        if (!selectionSession?.getSelection() && !navigation.hasReference && !navigation.hasLandmark) return;
        if (viewportComposition.getSnapshot().inspectorOpen) viewportComposition.hideInspector();
        else viewportComposition.showInspector();
    });
    document.getElementById('info-panel-minimize-btn')?.addEventListener('click', () => {
        viewportComposition.hideInspector();
    });
    document.getElementById('info-panel-clear-btn')?.addEventListener('click', () => {
        if (referenceNavigation.getSnapshot().hasLandmark) closeLandmarkInspection();
        else if (referenceNavigation?.getSnapshot().surface === 'reference') closeReferenceTrail();
        else executeGeographicAction('clear');
    });
    document.getElementById('info-panel-landmark-back-btn')?.addEventListener('click', closeLandmarkInspection);
    document.getElementById('info-panel-reference-back-btn')?.addEventListener('click', () => {
        const focus = pendingReferenceFocus.at(-1) ?? null;
        if (referenceNavigation?.back() === false) return;
        pendingReferenceFocus.pop();
        queueMicrotask(() => {
            let match = [...document.querySelectorAll('[data-reference-action="push"]')]
                .find(button =>
                    focus?.linkKey
                        ? button.dataset.referenceLinkKey === focus.linkKey
                        : button.dataset.entityType === focus?.entityType &&
                          button.dataset.entityId === focus?.entityId
                );
            if (!match && focus?.group) {
                const group = [...document.querySelectorAll('.reference-lazy-list')]
                    .find(details => details.dataset.referenceGroup === focus.group);
                if (group) {
                    group.open = true;
                    group.dispatchEvent(new Event('toggle'));
                    match = [...group.querySelectorAll('[data-reference-action="push"]')]
                        .find(button =>
                            focus.linkKey
                                ? button.dataset.referenceLinkKey === focus.linkKey
                                : button.dataset.entityType === focus.entityType &&
                                  button.dataset.entityId === focus.entityId
                        );
                }
            }
            (match ?? (focus?.fallback?.isConnected ? focus.fallback : null))?.focus({
                preventScroll: true
            });
        });
    });
    document.getElementById('info-panel-map-context-btn')?.addEventListener('click', () => {
        if (!selectionSession?.getSelection()) return;
        referenceNavigation?.showGeographic();
        synchronizeSelectionUI({ type: 'mapContext' });
        queueMicrotask(() => document.getElementById('info-panel-title')?.focus({ preventScroll: true }));
    });
    document.getElementById('info-panel-return-reference-btn')?.addEventListener('click', () => {
        referenceNavigation?.showReference();
        queueMicrotask(() => document.getElementById('info-panel-title')?.focus({ preventScroll: true }));
    });
    document.getElementById('workbench-focus-map-btn')?.addEventListener('click', () => {
        if (viewportComposition.getSnapshot().focusMap) viewportComposition.exitFocusMap();
        else {
            cancelActivePlanGestures();
            viewportComposition.enterFocusMap();
        }
    });
    document.getElementById('reset-panel-btn')?.addEventListener('click', resetViewportWorkspace);

    document.getElementById('workbench-undo-btn')?.addEventListener('click', () => {
        scenarioSession?.undo();
    });
    document.getElementById('workbench-redo-btn')?.addEventListener('click', () => {
        scenarioSession?.redo();
    });
    document.getElementById('copy-scenario-baseline-btn')?.addEventListener('click', async event => {
        if (!scenarioBaseline) return;
        const value = `${scenarioBaseline.manifestId} · ${scenarioBaseline.key}`;
        try {
            await writeClipboardText(value);
            const button = event.currentTarget;
            button.textContent = 'Copied';
            setScenarioStatus('Baseline identity copied.', 'success');
            window.setTimeout(() => {
                if (button.isConnected) button.textContent = 'Copy';
            }, 2000);
        } catch (error) {
            setScenarioStatus(`Could not copy baseline identity: ${error.message}`, 'error');
        }
    });
    document.getElementById('open-workbench-world-history-btn')?.addEventListener('click', () => {
        windowManager.open('history');
    });
    document.getElementById('open-workbench-global-status-btn')?.addEventListener('click', () => {
        windowManager.open('status');
    });

    document.getElementById('plan-marker-place-btn')?.addEventListener('click', () => {
        toggleMarkerPlacementFromWorkbench();
    });
    document.getElementById('plan-marker-manage-btn')?.addEventListener('click', () => {
        windowManager.open('markers');
    });
    document.getElementById('plan-paint-draw-btn')?.addEventListener('click', () => {
        togglePaintDrawingFromWorkbench();
    });
    document.getElementById('plan-paint-manage-btn')?.addEventListener('click', () => {
        windowManager.open('paint');
    });
    document.getElementById('plan-layer-configuration-btn')?.addEventListener('click', () => {
        openLayerConfigurationView();
    });
    document.getElementById('plan-faction-colors-btn')?.addEventListener('click', () => {
        openFactionColorsView();
    });
    document.getElementById('layer-configuration-back-btn')?.addEventListener('click', () => {
        viewportComposition.back();
        focusPlanRouteElement('plan-layer-configuration-btn');
    });
    document.getElementById('faction-colors-back-btn')?.addEventListener('click', () => {
        viewportComposition.back();
        focusPlanRouteElement('plan-faction-colors-btn');
    });

    document.getElementById('map-tool-shelf-launcher')?.addEventListener('click', () => {
        showPlanToolShelf();
    });
    document.getElementById('map-tool-shelf-close-btn')?.addEventListener('click', () => {
        closePlanToolShelf();
    });
    document.getElementById('map-tool-marker-place-btn')?.addEventListener('click', () => {
        toggleMarkerPlacementFromWorkbench();
    });
    for (const tab of ['marker', 'paint']) {
        document.getElementById(`map-tool-${tab}-tab`)?.addEventListener('click', () => {
            setPlanToolShelfTab(tab);
        });
    }

    const journalContent = document.getElementById('journal-panel-content');
    journalContent?.addEventListener('click', handleRelationsJournalInteraction);

}

function isElementPresented(element) {
    if (!element || element.hidden || element.classList.contains('hidden')) return false;
    return window.getComputedStyle(element).display !== 'none';
}

function hasWorkbenchTransientSurface() {
    return townLayoutController?.isOpen() === true ||
        shellTransientAdapter.isActive() ||
        viewportComposition.getSnapshot().inspectorTransparencyOpen ||
        viewportComposition.getSnapshot().transientSurface !== null ||
        (viewportComposition.getSnapshot().phone &&
            viewportComposition.getSnapshot().phoneForeground !== 'map') ||
        locationReporting?.isHoverVisible() === true;
}

function dismissWorkbenchTransientSurface() {
    if (townLayoutController?.isOpen()) {
        closeTownLayoutCover();
        return;
    }
    if (shellTransientAdapter.isActive()) {
        shellTransientAdapter.dismiss({ restoreFocus: true });
        return;
    }
    if (viewportComposition.getSnapshot().inspectorTransparencyOpen) {
        viewportComposition.setInspectorTransparencyOpen(false);
        document.getElementById('phone-inspector-transparency-btn')?.focus({ preventScroll: true });
        return;
    }
    if (viewportComposition.getSnapshot().transientSurface !== null) {
        const state = viewportComposition.getSnapshot();
        if (state.phone && ['mapContent', 'worldViews'].includes(state.transientSurface)) {
            viewportComposition.returnPhoneLayerChooserToTray(state.transientSurface);
        } else {
            closeActiveTransientSurface({ restoreFocus: true });
        }
        return;
    }
    if (viewportComposition.getSnapshot().phone &&
        viewportComposition.getSnapshot().phoneForeground !== 'map') {
        if (viewportComposition.getSnapshot().phoneForeground === 'planTray') closePlanToolShelf();
        else viewportComposition.closePhoneForeground();
        return;
    }
    locationReporting?.dismissHover();
}

function setupEscapeCoordination() {
    if (escapeCoordinator) return;
    escapeCoordinator = createEscapeCoordinator({
        theater: {
            isActive() {
                return windowManager.isOpen();
            },
            dismiss() {
                windowManager.close();
            }
        },
        transient: {
            isActive: hasWorkbenchTransientSurface,
            dismiss: dismissWorkbenchTransientSurface
        },
        focusedHud: {
            isActive: () => factionColorsWidget?.containsFocus() === true,
            dismiss: () => factionColorsWidget.close()
        },
        tool: {
            isActive() {
                return isPaintActive() || playerMarkerStore.isPlacementModeActive();
            },
            dismiss() {
                cancelActivePlanGestures();
            }
        },
        reference: {
            isActive() {
                const navigation = referenceNavigation.getSnapshot();
                return navigation.hasLandmark || navigation.hasReference;
            },
            dismiss() {
                if (referenceNavigation.getSnapshot().hasLandmark) closeLandmarkInspection();
                else closeReferenceTrail();
            }
        },
        popup: {
            isActive() {
                return mapPopupOpen || locationReporting?.isProbePresented();
            },
            dismiss() {
                dismissPointProbe({ closePopup: true });
                map.closePopup();
            }
        }
    });
    document.addEventListener('keydown', event => escapeCoordinator.handleKeydown(event), true);
}

function setupHistoryManagementListeners() {

    for (const exportBtn of document.querySelectorAll('[data-scenario-export]')) {
        exportBtn.addEventListener('click', () => {
            if (!scenarioSession) return;
            const state = scenarioDocumentState.getSnapshot();
            const name = state.name ?? 'scenario';
            downloadDocumentFile(
                serializeScenarioEnvelope(scenarioSession),
                documentFileName(name, DOCUMENT_TYPES.SCENARIO)
            );
            setScenarioStatus(`Exported "${name}" as JSON.`, 'success');
        });
    }

    for (const importFile of document.querySelectorAll('[data-scenario-import]')) {
        importFile.addEventListener('change', async () => {
            const file = importFile.files?.[0];
            if (!file || !scenarioSession || !scenarioBaseline) return;
            try {
                const imported = parseDocumentFileText(await file.text(), value => {
                    parseScenarioEnvelope(scenarioBaseline, value);
                    return value;
                });
                scenarioSession.replaceDocument(imported);
                scenarioDocumentState.clear({ dirty: true });
                renderScenarioDocumentStatus();
                setScenarioStatus('Imported scenario JSON.', 'success');
            } catch (error) {
                setScenarioStatus(`Import failed: ${error.message}`, 'error');
            } finally {
                importFile.value = '';
            }
        });
    }

}

function renderScenarioDocumentStatus() {
    const status = document.getElementById('prefs-loaded-save');
    const state = scenarioDocumentState.getSnapshot();
    const presentation = createScenarioDocumentPresentation(state);
    const workbenchLabel = state.id
        ? `${state.name}, revision ${String(state.revision)}`
        : 'Unsaved scenario';
    if (status) {
        status.textContent = presentation.label;
        status.closest('[data-scenario-document-state]')?.setAttribute(
            'data-scenario-document-state',
            presentation.state
        );
    }
    const workbenchStatus = document.getElementById('scenario-document-summary');
    if (workbenchStatus) {
        workbenchStatus.textContent = workbenchLabel;
        workbenchStatus.title = workbenchLabel;
    }
    const dirtyStatus = document.getElementById('scenario-dirty-summary');
    if (dirtyStatus) {
        dirtyStatus.textContent = state.dirty
            ? 'Unsaved changes'
            : state.id ? 'Saved state current' : 'New session';
        dirtyStatus.dataset.dirty = String(state.dirty);
    }
}

function renderRecentScenarioJournal(journal = scenarioSession?.getJournal() ?? []) {
    const container = document.getElementById('log-entries');
    if (!container) return;
    const entries = [...journal].slice(-5).reverse();
    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'workbench-empty-state';
        empty.textContent = 'No scenario commands yet.';
        container.replaceChildren(empty);
        return;
    }

    const list = document.createElement('ol');
    list.className = 'scenario-recent-list';
    for (const entry of entries) {
        const item = document.createElement('li');
        const summary = document.createElement('span');
        summary.textContent = entry.summary;
        const time = document.createElement('time');
        time.dateTime = entry.occurredAt;
        time.textContent = new Date(entry.occurredAt).toLocaleTimeString();
        item.append(summary, time);
        if (entry.consequences?.length) {
            const consequence = document.createElement('small');
            consequence.textContent = entry.consequences.join(' ');
            item.appendChild(consequence);
        }
        list.appendChild(item);
    }
    container.replaceChildren(list);
}

function renderWorkbenchScenarioSummary() {
    renderScenarioDocumentStatus();
    const baseline = document.getElementById('scenario-baseline-summary');
    const copyBaseline = document.getElementById('copy-scenario-baseline-btn');
    if (baseline) {
        if (scenarioBaseline) {
            const key = scenarioBaseline.key;
            const abbreviatedKey = key.length > 18 ? `${key.slice(0, 8)}…${key.slice(-8)}` : key;
            const fullIdentity = `${scenarioBaseline.manifestId} · ${key}`;
            const manifestLine = document.createElement('span');
            manifestLine.className = 'scenario-baseline-manifest';
            manifestLine.textContent = scenarioBaseline.manifestId;
            const keyLine = document.createElement('span');
            keyLine.className = 'scenario-baseline-key';
            keyLine.textContent = abbreviatedKey;
            baseline.replaceChildren(manifestLine, keyLine);
            baseline.title = fullIdentity;
        } else {
            baseline.textContent = 'Scenario baseline unavailable';
            baseline.removeAttribute('title');
        }
    }
    if (copyBaseline) copyBaseline.disabled = !scenarioBaseline;
    renderRecentScenarioJournal();
}

function formatPlanDocumentStatus(state, label) {
    if (state.id) {
        return `${state.name || label}, revision ${String(state.revision)}` +
            (state.dirty ? ' · unsaved changes' : ' · saved');
    }
    return state.dirty ? `Unsaved ${label} with changes.` : `No saved ${label} loaded.`;
}

function renderPlanDashboard() {
    const markerState = getPlayerMarkerDocumentStatus();
    const paintState = getPaintDocumentStatus();
    const markerStatus = document.getElementById('plan-marker-document-status');
    const paintStatus = document.getElementById('plan-paint-document-status');
    const markerCount = document.getElementById('plan-marker-count');
    const paintCount = document.getElementById('plan-paint-count');
    if (markerStatus) markerStatus.textContent = formatPlanDocumentStatus(markerState, 'marker set');
    if (paintStatus) paintStatus.textContent = formatPlanDocumentStatus(paintState, 'paint plan');
    if (markerCount) markerCount.textContent = String(markerState.itemCount);
    if (paintCount) paintCount.textContent = String(paintState.itemCount);
}

let synchronizingPlanInteractions = false;

function renderPlanToolInteractions() {
    const markerActive = getPlayerMarkerInteractionState().placementActive;
    const paintState = getPaintInteractionState();
    for (const id of ['plan-marker-place-btn', 'map-tool-marker-place-btn']) {
        const button = document.getElementById(id);
        if (!button) continue;
        button.textContent = markerActive ? 'Cancel Placement' : 'Place Marker';
        button.setAttribute('aria-pressed', String(markerActive));
    }
    const paintButton = document.getElementById('plan-paint-draw-btn');
    if (paintButton) {
        paintButton.textContent = paintState.active ? 'Stop Drawing' : 'Start Drawing';
        paintButton.setAttribute('aria-pressed', String(paintState.active));
    }
    const launcherLabel = document.querySelector('#map-tool-shelf-launcher span:last-child');
    if (launcherLabel) {
        launcherLabel.textContent = markerActive
            ? 'Placing Marker'
            : paintState.active
                ? `Drawing: ${paintState.drawingMode ?? paintState.toolState}`
                : 'Plan Tools';
    }
    const phonePlan = document.getElementById('phone-plan-btn');
    if (phonePlan && viewportComposition.getSnapshot().phone) {
        phonePlan.setAttribute('aria-pressed', String(
            markerActive || paintState.active || viewportComposition.getSnapshot().phoneForeground === 'planTray'
        ));
    }
}

function reconcilePlanToolExclusion(source) {
    if (synchronizingPlanInteractions) return;
    synchronizingPlanInteractions = true;
    try {
        if (source === 'marker' && getPlayerMarkerInteractionState().placementActive) {
            cancelPaintInteraction();
        }
        if (source === 'paint' && getPaintInteractionState().active) {
            cancelPlayerMarkerPlacement();
        }
        renderPlanToolInteractions();
    } finally {
        synchronizingPlanInteractions = false;
    }
}

function handlePlayerMarkerInteraction() {
    reconcilePlanToolExclusion('marker');
    if (viewportComposition.getSnapshot().phone &&
        viewportComposition.getSnapshot().phoneForeground === 'planTray' &&
        getPlayerMarkerInteractionState().placementActive) {
        viewportComposition.hideToolShelf();
    }
}

function handlePaintInteraction() {
    reconcilePlanToolExclusion('paint');
    if (viewportComposition.getSnapshot().phone &&
        viewportComposition.getSnapshot().phoneForeground === 'planTray' &&
        getPaintInteractionState().active) {
        viewportComposition.hideToolShelf();
    }
}

function setPlanToolShelfTab(tab) {
    const current = viewportComposition.getSnapshot().toolShelfTab;
    if (tab === current) return false;
    if (tab === 'marker') cancelPaintInteraction();
    else cancelPlayerMarkerPlacement();
    viewportComposition.setToolShelfTab(tab);
    renderPlanToolInteractions();
    return true;
}

function showPlanToolShelf(tab = viewportComposition.getSnapshot().toolShelfTab) {
    setPlanToolShelfTab(tab);
    viewportComposition.showToolShelf();
    renderPlanToolInteractions();
}

function cancelActivePlanGestures() {
    cancelPaintInteraction();
    cancelPlayerMarkerPlacement();
    renderPlanToolInteractions();
}

function closePlanToolShelf() {
    cancelActivePlanGestures();
    closePaintTools();
    viewportComposition.hideToolShelf();
    renderPlanToolInteractions();
}

function toggleMarkerPlacementFromWorkbench() {
    showPlanToolShelf('marker');
    if (getPlayerMarkerInteractionState().placementActive) {
        cancelPlayerMarkerPlacement();
    } else {
        cancelPaintInteraction();
        startPlayerMarkerPlacement();
    }
    renderPlanToolInteractions();
    if (viewportComposition.getSnapshot().phone && getPlayerMarkerInteractionState().placementActive) {
        viewportComposition.hideToolShelf();
    }
}

function togglePaintDrawingFromWorkbench() {
    if (getPaintInteractionState().active) {
        closePaintTools();
        viewportComposition.hideToolShelf();
    } else {
        cancelPlayerMarkerPlacement();
        showPlanToolShelf('paint');
        startPaintDrawing('box');
    }
    renderPlanToolInteractions();
    if (viewportComposition.getSnapshot().phone && getPaintInteractionState().active) {
        viewportComposition.hideToolShelf();
    }
}

    /**
     * The master function to update the content of the Global Status Window.
     */
    function updateStatusWindow() {
        const relationsList = document.getElementById('global-relations-list');
        const charactersList = document.getElementById('global-characters-list');
        const statesList = document.getElementById('global-states-list');
        if (!relationsList || !charactersList || !statesList) return;

        const lens = scenarioLensProjection?.globalStatus;
        if (!lens) {
            for (const container of [relationsList, charactersList, statesList]) {
                const message = document.createElement('p');
                message.textContent = scenarioLensError?.message || 'Scenario analysis unavailable.';
                container.replaceChildren(message);
            }
            return;
        }

        const appendRow = (container, name, value, valueClass = '') => {
            const row = document.createElement('p');
            const label = document.createElement('span');
            label.textContent = name;
            const result = document.createElement('span');
            result.className = `value ${valueClass}`.trim();
            result.textContent = String(value);
            row.append(label, result);
            container.appendChild(row);
        };

        relationsList.replaceChildren();
        for (const faction of lens.relations) {
            appendRow(
                relationsList,
                faction.name,
                faction.value,
                `value-${faction.classification}`
            );
        }

        const statusClasses = { 0: 'value-dead', 1: 'value-alive', 2: 'value-imprisoned' };
        charactersList.replaceChildren();
        for (const character of lens.characters) {
            appendRow(
                charactersList,
                character.name,
                character.statusLabel,
                statusClasses[character.status] || ''
            );
        }

        statesList.replaceChildren();
        for (const state of lens.worldStates) {
            const valueClass = state.active
                ? state.value === 1 ? 'value-alive' : 'value-neutral'
                : 'value-inactive';
            appendRow(statesList, state.name, state.valueLabel, valueClass);
        }
    }

    /**
     * Formats a single history event into a human-readable string.
     * @param {object} event - The event object from the history store.
     * @returns {string} A user-friendly description of the event.
     */
    function formatEventForDisplay(event) {
        const time = `[${new Date(event.occurredAt).toLocaleTimeString()}]`;
        return `${time} ${event.summary}`;
    }
    
    // Push appropriate events to the logs as according to the type
    function updateVerboseLog(history) {
        const readableContainer = document.getElementById('verbose-log-readable');
        const rawContainer = document.getElementById('verbose-log-raw');
        if (!readableContainer || !rawContainer) return;

        // Populate the Readable Log
        readableContainer.innerHTML = '';
        history.forEach(event => {
            const entry = document.createElement('p');
            entry.textContent = formatEventForDisplay(event);
            readableContainer.appendChild(entry);
        });

        // Populate the Raw Log
        rawContainer.innerHTML = '';
        history.forEach(event => {
            const entry = document.createElement('pre');
            entry.textContent = JSON.stringify(event, null, 2);
            rawContainer.appendChild(entry);
        });

        // Auto-scroll both to the bottom
        readableContainer.scrollTop = readableContainer.scrollHeight;
        rawContainer.scrollTop = rawContainer.scrollHeight;
    }

    /**
     * Fans one committed ScenarioSession change out to the existing renderer surfaces.
     */
    function synchronizeScenarioUI(change) {
        if (!scenarioSession) return;

        const journal = scenarioSession.getJournal();
        try {
            scenarioLensProjection = createScenarioLensProjection({
                baseline: scenarioBaseline,
                snapshot: scenarioSession.getSnapshot(),
                journal,
                timeline: scenarioSession.getTimeline(),
                campaigns: Object.values(factionCampaignDatabase),
                characters: Object.values(characterDatabase)
            });
            scenarioLensError = null;
        } catch (error) {
            scenarioLensProjection = null;
            scenarioLensError = error;
            console.error('Scenario lens projection failed:', error);
        }

        refreshPresenceReports(true);
        locationReporting?.refresh();
        cursorControls?.refresh();
        updateVerboseLog(historyStore.getHistory());
        renderWorldHistoryLog(scenarioLensProjection?.worldHistory ?? []);
        updateUndoRedoButtons();
        renderRecentScenarioJournal(journal);
        refreshMenuPanels();

        if (initialApiData.mapData) drawTownMarkers(initialApiData.mapData);
        if (politicalStatus === 'ready') refreshPoliticalProjection();
        refreshFactionOverviewProjection();
        scheduleDiscoveryContextIndicators();
        scheduleNarcoticProhibition();

        const journalPanel = document.getElementById('relations-journal-panel');
        if (journalPanel && !journalPanel.classList.contains('hidden')) {
            renderRelationsJournal();
        }

        const statusPane = document.getElementById('pane-global-status');
        if (statusPane && statusPane.offsetParent !== null) updateStatusWindow();
        const infamyPane = document.getElementById('pane-infamy');
        if (infamyPane && infamyPane.offsetParent !== null) populateInfamyTracker();
        const ranksPane = document.getElementById('pane-power-ranks');
        if (ranksPane && ranksPane.offsetParent !== null) powerRanksController?.refresh();
        const overridesPane = document.getElementById('pane-overrides');
        if (overridesPane && overridesPane.offsetParent !== null) townOverridesController?.refresh();
        updateActiveInfoPanel();

        if (change?.type && change.type !== 'initialize') {
            scenarioDocumentState.markDirty();
            renderScenarioDocumentStatus();
            const activity = {
                dispatch: 'Scenario command applied.',
                undo: 'Scenario command undone.',
                redo: 'Scenario command restored.',
                replaceDocument: 'Scenario save loaded.'
            }[change.type];
            if (scenarioLensError) {
                setScenarioStatus(`Scenario analysis unavailable: ${scenarioLensError.message}`, 'error');
            } else {
                setScenarioStatus(activity ?? '');
            }
        }
        renderWorkbenchScenarioSummary();
    }

    /**
     * Updates the enabled/disabled state of the Undo/Redo buttons.
     */
    function updateUndoRedoButtons() {
        for (const id of ['undo-btn', 'workbench-undo-btn']) {
            const undoButton = document.getElementById(id);
            if (undoButton) undoButton.disabled = !scenarioSession?.canUndo();
        }
        for (const id of ['redo-btn', 'workbench-redo-btn']) {
            const redoButton = document.getElementById(id);
            if (redoButton) redoButton.disabled = !scenarioSession?.canRedo();
        }
    }

    /**
     * Refreshes the UI of the side panels to reflect the current store data.
     * This is called after an undo/redo.
     */
    function refreshMenuPanels() {
        // Get the currently selected faction and character
        const selectedFactionId = document.getElementById('faction-select-dropdown')?.value;
        const selectedCharacterId = document.getElementById('character-select-dropdown')?.value;

        // Trigger the update functions for them
        if (selectedFactionId) {
            updateFactionControlUI(selectedFactionId);
        }
        if (selectedCharacterId) {
            updateCharacterControlUI(selectedCharacterId);
        }
    }

    /**
     * Builds the HTML for the Faction Relations panel.
     */
    function populateFactionControlsPanel(factionData) {
        const panel = document.getElementById('faction-relations-panel');
        if (!factionData || !panel) return;
        const sortedFactions = [...factionData].sort((a, b) => a.Name.localeCompare(b.Name));
        const select = document.createElement('select');
        select.id = 'faction-select-dropdown';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a Faction';
        select.appendChild(placeholder);
        for (const faction of sortedFactions) {
            if (faction.Values['not real']) continue;
            const option = document.createElement('option');
            option.value = faction.StringId;
            option.textContent = faction.Name;
            select.appendChild(option);
        }
        const controls = document.createElement('div');
        controls.id = 'faction-control-container';
        panel.replaceChildren(select, controls);
    }

    /**
     * Creates the slider/input/button controls for the selected faction.
     */
    function updateFactionControlUI(factionId) {
        const container = document.getElementById('faction-control-container');
        if (!container) return;
        if (!factionId) { container.replaceChildren(); return; }

        const currentRelation = relationsStore.getRelation(factionId);
        const controls = document.createElement('div');
        controls.className = 'control-grid faction-relation-editor';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'faction-relations-slider';
        slider.min = '-100';
        slider.max = '100';
        slider.value = String(currentRelation);
        slider.setAttribute('aria-label', 'Faction relation');
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'faction-relations-input';
        input.min = '-100';
        input.max = '100';
        input.value = String(currentRelation);
        input.setAttribute('aria-label', 'Faction relation value');
        const current = document.createElement('output');
        current.className = 'simulation-current-value';
        current.setAttribute('aria-label', `Current faction relation: ${String(currentRelation)}`);
        current.textContent = `Current: ${String(currentRelation)}`;
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.id = 'faction-apply-button';
        apply.className = 'apply-button';
        apply.textContent = 'Apply';
        controls.append(slider, input, current, apply);
        container.replaceChildren(controls);
    }

    /**
     * Builds the HTML for the Character Status panel.
     */
    function populateCharacterStatusPanel() {
        const panel = document.getElementById('character-status-panel');
        if (!panel) return;

        const characters = characterStore.getAllCharacters();
        const select = document.createElement('select');
        select.id = 'character-select-dropdown';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a Character';
        select.appendChild(placeholder);
        for (const character of characters) {
            const option = document.createElement('option');
            option.value = character.stringId;
            option.textContent = character.name;
            select.appendChild(option);
        }
        const controls = document.createElement('div');
        controls.id = 'character-control-container';
        panel.replaceChildren(select, controls);
    }

    /**
     * Creates the slider/input/button controls for the selected character.
     */
    function updateCharacterControlUI(characterId) {
        const container = document.getElementById('character-control-container');
        if (!container) return;
        if (!characterId) { container.replaceChildren(); return; }

        const char = characterStore.getCharacter(characterId);
        if (!char) return;
        const editor = document.createElement('div');
        editor.className = 'character-status-editor';
        const choices = document.createElement('fieldset');
        choices.className = 'character-status-choices';
        const legend = document.createElement('legend');
        legend.textContent = 'Status';
        choices.appendChild(legend);
        for (const option of CHARACTER_STATUS_OPTIONS) {
            const label = document.createElement('label');
            label.className = 'character-status-choice';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'character-status';
            input.value = String(option.value);
            input.checked = option.value === char.status;
            const text = document.createElement('span');
            text.textContent = option.label;
            label.append(input, text);
            choices.appendChild(label);
        }
        const involvement = document.createElement('label');
        involvement.className = 'player-involvement-control';
        const involvementInput = document.createElement('input');
        involvementInput.type = 'checkbox';
        involvementInput.id = 'character-player-involved';
        involvementInput.checked = true;
        involvement.append(involvementInput, document.createTextNode(' Player Involvement'));
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.id = 'character-apply-button';
        apply.className = 'apply-button';
        apply.textContent = 'Apply';
        const current = document.createElement('output');
        current.className = 'simulation-current-value';
        const currentStatus = CHARACTER_STATUS_OPTIONS.find((option) => option.value === char.status)?.label ?? 'Unavailable';
        current.setAttribute('aria-label', `Current character status: ${currentStatus}`);
        current.textContent = `Current: ${currentStatus}`;
        const actions = document.createElement('div');
        actions.className = 'simulation-editor-actions';
        actions.append(current, apply);
        editor.append(choices, involvement, actions);
        container.replaceChildren(editor);
    }

/**
 * Populates the "Manifest" tab in the Main Menu with Nested Item Categories.
 */
function openBrowseOption(option) {
    const itemId = option?.value;
    const selectId = option?.parentElement?.id;
    if (!itemId || !selectId) return false;
    const geographicTypes = {
        'spawn-areas-list': 'spawnArea',
        'towns-list': 'town'
    };
    const referenceTypes = {
        'nests-list': 'nest',
        'squads-list': 'squad',
        'characters-list': 'character',
        'animals-list': 'character',
        'factions-list': 'faction',
        'items-list': 'item',
        'weapons-list': 'weapon',
        'crossbows-list': 'crossbow',
        'armour-list': 'armour',
        'map-items-list': 'mapItem',
        'nest-items-list': 'nestItem'
    };
    if (geographicTypes[selectId]) {
        return showInfoPanel(itemId, geographicTypes[selectId], null, 'manifest');
    }
    if (referenceTypes[selectId]) {
        return showReferenceRoot(referenceTypes[selectId], itemId, option.parentElement);
    }
    return false;
}

function populateManifest(_data) {
    const panel = document.getElementById('manifest-content');
    if (!panel) return;

    panel.replaceChildren();

    // UPDATED HELPER: Accepts 'targetParent' to allow nesting
    const createSection = (title, items, targetParent, filterFn = null) => {
        let itemList = items;
        if (filterFn) itemList = items.filter(filterFn);
        
        if (!itemList || itemList.length === 0) return;
    
        const sortedItems = [...itemList].sort((a, b) => a.Name.localeCompare(b.Name));
        const listId = `${title.toLowerCase().replace(/ /g, '-')}-list`;
        
        const section = document.createElement('details');
        section.className = 'menu-section';
        
        const summary = document.createElement('summary');
        summary.textContent = `${title} (${String(sortedItems.length)})`;
        const content = document.createElement('div');
        content.className = 'menu-section-content';
        const filter = document.createElement('input');
        filter.type = 'text';
        filter.placeholder = 'Filter...';
        filter.className = 'filter-input';
        filter.dataset.targetList = listId;
        const select = document.createElement('select');
        select.id = listId;
        select.size = 8;
        let populated = false;
        const populateOptions = () => {
            if (populated) return false;
            populated = true;
            const fragment = document.createDocumentFragment();
            for (const item of sortedItems) {
                const option = document.createElement('option');
                option.value = item.StringId;
                option.textContent = item.Name;
                fragment.appendChild(option);
            }
            select.appendChild(fragment);
            return true;
        };
        section.addEventListener('toggle', () => {
            if (section.open) populateOptions();
        });
        content.append(filter, select);
        section.append(summary, content);
        targetParent.appendChild(section);
        mapReadinessCoordinator?.addOptionalJob({
            id: `manifest-options:${listId}`,
            priority: -10,
            run: populateOptions
        });
    };

    // 1. Spawn Areas
    createSection('Spawn Areas', Object.values(spawnAreaDatabase).filter(area => isGeographicArea(area.StringId)), panel);
    
    // 2. Geographic towns and type-8 nest markers. Type-0 templates live in Discovery.
    createSection(
        'Towns',
        Object.values(townDatabase),
        panel,
        town => !town.Name.startsWith('_') && Number(town?.Values?.type) !== 0
    );

    // 3. Type-0 Nest templates
    createSection(
        'Nests',
        Object.values(discoveryCatalog?.byType?.nest ?? {}).map(entity => entity.authored),
        panel
    );

    // 4. Squads
    createSection('Squads', Object.values(squadDatabase), panel);

    // 5. Factions
    createSection('Factions', Object.values(factionDatabase), panel);

    // 6. Stable geographic usedness curates Content without narrowing exhaustive reference routes.
    const usedCharacterIds = discoveryContextCatalog?.available
        ? new Set(discoveryContextCatalog.characters.filter(({ used }) => used).map(({ entityId }) => entityId))
        : null;
    const visibleCharacters = usedCharacterIds
        ? Object.values(characterDatabase).filter(character => usedCharacterIds.has(character.StringId))
        : Object.values(characterDatabase);
    createSection('Characters', visibleCharacters, panel);
    const usedAnimalIds = discoveryContextCatalog?.available
        ? new Set(discoveryContextCatalog.animals.filter(({ used }) => used).map(({ entityId }) => entityId))
        : null;
    const visibleAnimals = discoveryContextCatalog?.available
        ? Object.values(animalDatabase).filter(animal => usedAnimalIds.has(animal.StringId))
        : Object.values(animalDatabase);
    createSection('Animals', visibleAnimals, panel);
    const contentWarning = document.getElementById('browse-content-warning');
    if (contentWarning) {
        contentWarning.hidden = discoveryContextCatalog?.available !== false;
        contentWarning.textContent = discoveryContextCatalog?.available === false
            ? 'Character and Animal reachability could not be classified; Content is showing every Character and Animal.'
            : '';
    }

    // 7. ITEMS & EQUIPMENT (Parent Container)
    const itemsParent = document.createElement('details');
    itemsParent.className = 'menu-section'; // Style matches other sections
    const itemsSummary = document.createElement('summary');
    itemsSummary.textContent = 'Items & Equipment';
    itemsParent.appendChild(itemsSummary);
    
    // A wrapper div for indentation/spacing of nested items
    const itemsWrapper = document.createElement('div');
    itemsWrapper.style.paddingLeft = '10px'; 
    itemsWrapper.style.borderLeft = '1px solid #444'; // Visual thread guide
    itemsParent.appendChild(itemsWrapper);
    
    // 5a. Sub-Sections (Appended to itemsWrapper, not panel)
    createSection('Weapons', Object.values(weaponDatabase), itemsWrapper);
    createSection('Crossbows', Object.values(crossbowDatabase), itemsWrapper);
    createSection('Armour', Object.values(armourDatabase), itemsWrapper);
    createSection('Items', Object.values(itemDatabase), itemsWrapper);
    createSection('Map Items', Object.values(mapItemDatabase), itemsWrapper);
    createSection('Nest Items', Object.values(nestItemDatabase), itemsWrapper);

    // Finally, append the whole structure to the main panel
    panel.appendChild(itemsParent);
}

function emptyInfoPanelData() {
    return {
        stringId: '',
        instanceId: null,
        name: 'No Selection',
        coordinates: null,
        hasLayout: false,
        factionName: '',
        relationVal: null,
        relationClass: '',
        residents: [],
        populationGroups: [],
        populationAvailable: false,
        populationNotes: [],
        overridePath: [],
        nextOverrides: [],
        overrideDiagnostics: [],
        overrideReportState: 'unavailable',
        overrideNotice: '',
        selectedStatus: '',
        currentTownName: '',
        spawnCount: 0,
        nestCount: 0,
        weatherEffects: [],
        weatherNotices: [],
        biome: '',
        fertilityList: [],
        resourceList: [],
        squads: [],
        pointX: null,
        pointZ: null,
        hasContainingSpawn: false,
        scenarioAvailable: false,
        contextDiagnostics: []
    };
}

function selectionReferenceData() {
    return {
        townById: townDatabase,
        squadById: squadDatabase,
        resourceById: resourceDatabase
    };
}

function resolvePointFacts(point) {
    const latLng = kenshiToLeaflet(point);
    if (!latLng) return null;
    let spawnAreaId = null;
    let spawnAreaAnchor = null;
    let biome = null;

    if (spawnAreaAnchorIndex) {
        spawnAreaId = spawnAreaAnchorIndex.getAreaIdAtLeaflet(latLng);
        if (spawnAreaId) {
            spawnAreaAnchor =
                spawnAreaAnchorIndex.getContainingAnchor(latLng, spawnAreaId) ??
                spawnAreaAnchorIndex.getPrimaryAnchor(spawnAreaId);
        }
    }

    if (biomePixelData && colorToBiomeMap.size > 0) {
        const x = Math.floor((latLng.lng / mapWidth) * biomePixelData.width);
        const y = Math.floor((1 - latLng.lat / mapHeight) * biomePixelData.height);
        if (x >= 0 && x < biomePixelData.width && y >= 0 && y < biomePixelData.height) {
            const index = (y * biomePixelData.width + x) * 4;
            const key = `${biomePixelData.data[index]},${biomePixelData.data[index + 1]},${biomePixelData.data[index + 2]}`;
            const record = colorToBiomeMap.get(key);
            if (record) biome = { id: record.StringId, name: record.Name };
        }
    }

    return { spawnAreaId, spawnAreaAnchor, biome };
}

function adaptContextToInfoData(context) {
    const data = emptyInfoPanelData();
    if (!context) return data;
    data.name = context.title;
    data.scenarioAvailable = context.scenarioAvailable;
    data.hasLayout = context.capabilities.hasLayout;
    data.contextDiagnostics = context.diagnostics.map(diagnostic => diagnostic.message);

    if (context.kind === 'town') {
        const town = context.town;
        data.stringId = town.id;
        data.instanceId = town.location?.instanceId ?? null;
        data.coordinates = town.location?.coordinates?.leaflet ?? null;
        data.factionName = town.currentTown.ownerName;
        data.relationVal = town.currentTown.relationValue;
        data.relationClass = town.currentTown.relationClassification
            ? `value-${town.currentTown.relationClassification}`
            : '';
        data.residents = town.currentTown.residents;
        const population = presenceProjection?.occurrences?.[town.location?.instanceId]?.report ??
            presenceProjection?.towns?.[town.primaryNetwork?.baseTownId ?? town.id];
        if (population) {
            data.populationAvailable = true;
            data.factionName = population.owner?.name ?? 'Unresolved';
            data.relationVal = population.owner?.value ?? null;
            data.relationClass = population.owner ? `value-${population.owner.classification}` : '';
            data.populationGroups = population.groups.map(group => ({
                ...group,
                rows: group.rows.map(row => ({
                    ...row,
                    detail: [row.template ? 'Default template' : '', `${row.occurrences.length} authored ${row.occurrences.length === 1 ? 'entry' : 'entries'}`].filter(Boolean).join(' · '),
                    factionText: row.factions.length ? row.factions.map(formatPresenceFaction).join('; ') : 'Faction unresolved',
                    provenance: [...new Set(row.sources.filter(source => source.path.length).map(source => [source.role, ...source.path].join(' → ')))].join('; ')
                }))
            }));
            data.populationNotes = [...population.diagnostics,
                ...(population.entryCount === 0 ? ['No current authored population entries.'] : []),
                "Current scenario's authored entries and templates, not simultaneous population."];
        }
        data.currentTownName = town.currentTown.name;
        data.selectedStatus = town.selectedTown.branchStatus ?? '';
        data.overridePath = town.primaryNetwork?.activeSteps ?? [];
        data.overrideDiagnostics = town.diagnostics.map(diagnostic => diagnostic.message);
        data.overrideReportState = town.overrideReport.state;
        data.overrideNotice = town.overrideReport.notice;
        data.nextOverrides = (town.primaryNetwork?.outgoing ?? []).map(edge => ({
            id: edge.targetId,
            name: townDatabase[edge.targetId]?.Name ?? edge.targetId,
            conditions: edge.conditions.map(condition => ({
                text: condition.text,
                met: condition.satisfied
            })),
            status: edge.status,
            isImplausible: edge.status === 'locked' || edge.status === 'indeterminate',
            implausibilityReason: edge.implausibilityReason
        }));
    } else {
        const spawnArea = context.kind === 'spawnArea'
            ? context.spawnArea
            : context.point.spawnArea;
        data.hasContainingSpawn = Boolean(spawnArea);
        data.stringId = spawnArea?.id ?? context.selection.entityId ?? 'map-point';
        data.coordinates = context.kind === 'point' ? context.point.coordinates.leaflet : null;
        data.spawnCount = spawnArea?.spawnCount ?? 0;
        data.nestCount = spawnArea?.nestCount ?? 0;
        data.squads = (spawnArea?.occurrences ?? [])
            .map(occurrence => ({
                entityId: occurrence.entityId,
                entityType: occurrence.type === 'Nest' ? 'nest' : 'squad',
                name: occurrence.name,
                chance: 100,
                status: occurrence.status
            }));
        data.weatherEffects = (spawnArea?.weather.effects ?? []).map(effect => ({
            label: effect.label,
            icon: kenshiAssetUrl(effect.iconPath)
        }));
        data.weatherNotices = spawnArea?.weather.notices ?? [];
        data.fertilityList = (spawnArea?.fertility ?? []).map(entry => ({
            label: entry.label,
            value: `${String(entry.value)}%`,
            color: { Arid: '#e6c280', Green: '#81c784', Swamp: '#5c8a5e' }[entry.label],
            icon: kenshiAssetUrl(`icons/panel-${entry.id}.svg`)
        }));
        data.resourceList = (spawnArea?.resources ?? []).map(entry => ({
            label: entry.label,
            value: entry.id === 'water'
                ? `${String(Math.round(entry.value * 100))}%`
                : `${String(entry.value)}x`,
            color: { copper: '#d35400', iron: '#aaa', stone: '#9e9e9e', water: '#64b5f6' }[entry.id],
            icon: kenshiAssetUrl(`icons/panel-${entry.id}.svg`)
        }));
        if (context.kind === 'point') {
            data.pointX = Math.round(context.point.coordinates.x);
            data.pointZ = Math.round(context.point.coordinates.z);
            data.biome = context.point.biome?.name ?? 'None';
        }
    }
    return data;
}

function setSelectionStatus(message, level = 'info', options = {}) {
    if (activeCopyFeedback) {
        activeCopyFeedback.element.textContent = activeCopyFeedback.originalLabel;
        activeCopyFeedback = null;
    }
    if (!message) {
        selectionStatusController.clear();
        return;
    }
    selectionStatusController.show(message, {
        level,
        timeout: options.timeout ?? 0,
        onExpire: options.onExpire ?? null
    });
}

function currentReferenceProjection() {
    const target = referenceNavigation?.getSnapshot().current;
    if (!target || !discoveryCatalog) return null;
    const snapshot = scenarioSession?.getSnapshot() ?? null;
    const key = `${target.entityType}:${target.entityId}`;
    if (referenceProjectionCache?.key === key &&
        referenceProjectionCache.catalog === discoveryCatalog &&
        referenceProjectionCache.snapshot === snapshot &&
        referenceProjectionCache.lenses === scenarioLensProjection) {
        return referenceProjectionCache.projection;
    }
    const projection = projectDiscoveryEntity({
        catalog: discoveryCatalog,
        snapshot,
        lenses: scenarioLensProjection,
        target
    });
    referenceProjectionCache = { key, catalog: discoveryCatalog, snapshot, lenses: scenarioLensProjection, projection };
    return projection;
}

function renderReferencePresentation({ focusHeading = false } = {}) {
    const navigation = referenceNavigation?.getSnapshot() ?? {
        surface: 'geographic', stack: [], current: null, depth: 0, hasReference: false
    };
    const inspector = document.getElementById('info-panel');
    const referenceContent = document.getElementById('info-panel-reference-content');
    const geographicContent = document.getElementById('info-panel-geographic-content');
    const landmarkContent = document.getElementById('info-panel-landmark-content');
    const landmarkActions = document.getElementById('info-panel-landmark-actions');
    const landmarkVisible = navigation.hasLandmark === true;
    const utilityRibbon = document.getElementById('info-panel-utility-ribbon');
    const referenceActions = document.getElementById('info-panel-reference-actions');
    const primaryActions = document.getElementById('info-panel-primary-actions');
    const back = document.getElementById('info-panel-reference-back-btn');
    const mapContext = document.getElementById('info-panel-map-context-btn');
    const returnReference = document.getElementById('info-panel-return-reference-btn');
    const title = document.getElementById('info-panel-title');
    const clear = document.getElementById('info-panel-clear-btn');
    const hasGeographic = Boolean(selectionSession?.getSelection());
    const referenceVisible = navigation.surface === 'reference' && navigation.hasReference;
    if ((referenceVisible || landmarkVisible) &&
        viewportComposition.getSnapshot().inspectorTransparencyOpen) {
        viewportComposition.setInspectorTransparencyOpen(false);
    }
    if (inspector) {
        inspector.dataset.contextMode = landmarkVisible ? 'landmark' : referenceVisible ? 'reference' : 'geographic';
        inspector.setAttribute(
            'aria-label',
            landmarkVisible ? 'Landmark context' : referenceVisible ? 'Reference context' : 'Selected map context'
        );
    }
    if (referenceContent) referenceContent.hidden = !referenceVisible;
    if (geographicContent) geographicContent.hidden = referenceVisible || landmarkVisible;
    if (landmarkContent) landmarkContent.hidden = !landmarkVisible;
    if (landmarkActions) landmarkActions.hidden = !landmarkVisible || !navigation.returnSurface;
    const identityActions = document.getElementById('info-panel-identity-actions');
    if (identityActions) identityActions.hidden = landmarkVisible;
    if (utilityRibbon) {
        utilityRibbon.hidden = landmarkVisible && !navigation.returnSurface;
        utilityRibbon.setAttribute(
            'aria-label',
            landmarkVisible ? 'Landmark actions' : referenceVisible ? 'Reference context actions' : 'Selected context actions'
        );
    }
    if (primaryActions) primaryActions.hidden = referenceVisible || landmarkVisible;
    if (referenceActions) referenceActions.hidden = !navigation.hasReference || landmarkVisible;
    if (back) back.hidden = !referenceVisible || navigation.depth <= 1;
    if (mapContext) mapContext.hidden = !referenceVisible || !hasGeographic;
    if (returnReference) returnReference.hidden = referenceVisible || !navigation.hasReference;
    if (clear) {
        const label = landmarkVisible ? 'Close landmark' : referenceVisible ? 'Close reference trail' : 'Clear geographic selection';
        clear.title = label;
        clear.setAttribute('aria-label', label);
    }

    if (referenceVisible || (landmarkVisible && navigation.returnSurface === 'reference')) {
        const projection = currentReferenceProjection();
        if (referenceInspector && referenceInspector.getProjection() !== projection) {
            const scroller = document.getElementById('info-panel-content');
            const sameTarget = referenceInspector.getProjection()?.target?.entityId === projection?.target?.entityId &&
                referenceInspector.getProjection()?.target?.entityType === projection?.target?.entityType;
            const reading = sameTarget
                ? (landmarkVisible ? landmarkReturnReading : captureInspectorReading(referenceContent, scroller))
                : null;
            referenceInspector.render(projection);
            if (reading) {
                const visibleScroll = scroller.scrollTop;
                restoreInspectorReading(referenceContent, scroller, reading);
                if (landmarkVisible) scroller.scrollTop = visibleScroll;
            }
        }
        if (referenceVisible) {
            if (title) title.textContent = projection?.identity?.name ?? 'Reference unavailable';
        }
    }
    if (landmarkVisible) {
        const landmark = landmarkCatalog?.get(navigation.landmarkId);
        landmarkInspector?.render(landmark, discoveryContextAreaIndex, narcoticProhibitionStatus);
        if (title) title.textContent = landmark?.name ?? 'Landmark unavailable';
    } else if (!referenceVisible) {
        if (title) title.textContent = Alpine.store('infoPanel')?.data?.name ?? 'Details';
    }
    if (title) title.title = title.textContent;
    if (focusHeading) queueMicrotask(() => title?.focus({ preventScroll: true }));
    applyViewportComposition();
}

function showLandmarkInspection(id, originatingMarker) {
    if (!landmarkCatalog?.get(id)) return false;
    const navigation = referenceNavigation.getSnapshot();
    const scroller = document.getElementById('info-panel-content');
    if (!navigation.hasLandmark) {
        const content = document.getElementById(navigation.surface === 'reference'
            ? 'info-panel-reference-content' : 'info-panel-geographic-content');
        landmarkReturnReading = captureInspectorReading(content, scroller);
    }
    landmarkMarkerFocus = originatingMarker;
    dismissPointProbe({ closePopup: true });
    map.closePopup();
    const change = referenceNavigation.openLandmark(id, {
        hasGeographic: Boolean(selectionSession?.getSelection())
    });
    viewportComposition.showInspector();
    if (change !== false) scroller.scrollTop = 0;
    renderReferencePresentation({ focusHeading: true });
    return true;
}

function closeLandmarkInspection() {
    const navigation = referenceNavigation.getSnapshot();
    if (!navigation.hasLandmark) return false;
    const reading = landmarkReturnReading;
    const marker = landmarkMarkerFocus;
    referenceNavigation.closeLandmark();
    landmarkReturnReading = null;
    landmarkMarkerFocus = null;
    if (navigation.returnSurface) {
        viewportComposition.showInspector();
        const container = document.getElementById(navigation.returnSurface === 'reference'
            ? 'info-panel-reference-content' : 'info-panel-geographic-content');
        queueMicrotask(() => {
            document.getElementById('info-panel-title')?.focus({ preventScroll: true });
            restoreInspectorReading(container, document.getElementById('info-panel-content'), reading, { focus: true });
        });
    } else {
        viewportComposition.hideInspector();
        if (marker?.isConnected && isElementPresented(marker)) marker.focus({ preventScroll: true });
    }
    return true;
}

function showReferenceRoot(entityType, entityId, originatingControl = null) {
    if (!discoveryCatalog) {
        setSelectionStatus('Reference data is unavailable for this manifest.', 'error');
        return false;
    }
    try {
        referenceRootFocus = typeof originatingControl === 'function' || originatingControl instanceof Element
            ? originatingControl
            : document.activeElement;
        pendingReferenceFocus = [];
        referenceNavigation.replace({ entityType, entityId });
        viewportComposition.showInspector();
        renderReferencePresentation({ focusHeading: true });
        return true;
    } catch (error) {
        setSelectionStatus(error.message, 'error');
        return false;
    }
}

function pushReferenceTarget(target, originatingControl) {
    if (!referenceNavigation) return false;
    try {
        pendingReferenceFocus.push({
            entityType: target.entityType,
            entityId: target.entityId,
            group: originatingControl?.dataset.referenceGroup ?? null,
            linkKey: originatingControl?.dataset.referenceLinkKey ?? null,
            fallback: originatingControl
        });
        const change = referenceNavigation.push(target);
        if (change === false) pendingReferenceFocus.pop();
        viewportComposition.showInspector();
        return change !== false;
    } catch (error) {
        pendingReferenceFocus.pop();
        setSelectionStatus(error.message, 'error');
        return false;
    }
}

function closeReferenceTrail({ restoreFocus = true } = {}) {
    if (!referenceNavigation?.getSnapshot().hasReference) return false;
    referenceNavigation.clear();
    pendingReferenceFocus = [];
    if (selectionSession?.getSelection()) {
        synchronizeSelectionUI({ type: 'referenceClose' });
        queueMicrotask(() => document.getElementById('info-panel-title')?.focus({ preventScroll: true }));
    } else {
        viewportComposition.hideInspector();
        const returnFocus = typeof referenceRootFocus === 'function'
            ? referenceRootFocus()
            : referenceRootFocus;
        if (restoreFocus && returnFocus?.isConnected && isElementPresented(returnFocus)) {
            queueMicrotask(() => returnFocus.focus({ preventScroll: true }));
        }
    }
    return true;
}

function showReferenceTargetOnMap(target) {
    preserveReferenceOnNextSelection = true;
    const selected = selectGeographicEntity(
        target.entityType,
        target.entityId,
        target.instanceId,
        'context'
    );
    preserveReferenceOnNextSelection = false;
    if (!selected) return false;
    referenceNavigation.showGeographic();
    executeGeographicAction('inspect');
    queueMicrotask(() => document.getElementById('info-panel-title')?.focus({ preventScroll: true }));
    return true;
}

function setupReferenceInspector() {
    const container = document.getElementById('info-panel-reference-content');
    if (!container || !referenceNavigation || referenceInspector) return;
    referenceInspector = createReferenceInspector({
        container,
        onNavigate: pushReferenceTarget,
        onShowOnMap: showReferenceTargetOnMap
    });
    landmarkInspector = createLandmarkInspector({ container: document.getElementById('info-panel-landmark-content') });
    referenceNavigation.subscribe(change => {
        renderReferencePresentation();
        if (!change.snapshot.hasLandmark && change.type !== 'closeLandmark') {
            landmarkReturnReading = null;
            landmarkMarkerFocus = null;
        }
    });
}

function selectGeographicEntity(entityType, entityId, instanceId = null, source = 'context') {
    if (!selectionSession || !selectionOrigin) return false;
    try {
        const change = selectionSession.select({
            kind: 'entity',
            entityType,
            entityId,
            instanceId,
            source,
            origin: selectionOrigin
        });
        // Selecting the already-selected town is still an explicit geographic action.
        dismissPointProbe({ closePopup: true });
        if (
            change === false &&
            !preserveReferenceOnNextSelection &&
            (referenceNavigation?.getSnapshot().hasReference || referenceNavigation?.getSnapshot().hasLandmark)
        ) {
            referenceNavigation.clear();
            pendingReferenceFocus = [];
        }
        setSelectionStatus('');
        return true;
    } catch (error) {
        setSelectionStatus(error.message, 'error');
        return false;
    }
}

function setPointProbe(latLng, source = 'map') {
    const point = leafletToKenshi(latLng);
    if (!pointProbeSession || !selectionOrigin || !point) return false;
    try {
        pointProbeSession.set({ kind: 'point', point, source, origin: selectionOrigin });
        setSelectionStatus('');
        return true;
    } catch (error) {
        setSelectionStatus(error.message, 'error', {
            timeout: TRANSIENT_STATUS_TIMEOUT_MS
        });
        return false;
    }
}

function pointProbeKey(probe) {
    return probe ? `${String(probe.point.x)}:${String(probe.point.z)}` : null;
}

function refreshPointProbePresentation() {
    pointProbeLayer.clearLayers();
    const probe = pointProbeSession?.getProbe();
    const latLng = probe ? kenshiToLeaflet(probe.point) : null;
    if (!latLng) return;
    L.circleMarker(latLng, {
        radius: 7,
        color: '#f0b95d',
        weight: 3,
        fillColor: '#1b1f23',
        fillOpacity: 0.72,
        interactive: false,
        className: 'point-probe-marker'
    }).addTo(pointProbeLayer);
}

function dismissPointProbe({ closePopup = false } = {}) {
    if (!pointProbeSession?.getProbe()) return false;
    const changed = pointProbeSession.clear() !== false;
    locationReporting?.dismissProbe();
    if (changed && closePopup && mapPopupOpen) map.closePopup();
    return changed;
}

function projectSelectionContext(selection) {
    const pointFacts = selection.kind === 'point' ? resolvePointFacts(selection.point) : null;
    const spawnAreaAnchor = selection.kind === 'point'
        ? pointFacts?.spawnAreaAnchor ?? null
        : selection.entityType === 'spawnArea'
            ? spawnAreaAnchorIndex?.getPrimaryAnchor(selection.entityId) ?? null
            : null;
    return createContextProjection({
        catalog: selectionCatalog,
        selection,
        snapshot: scenarioSession?.getSnapshot() ?? null,
        lenses: scenarioLensProjection,
        references: selectionReferenceData(),
        environmentProjection: environmentInfoProjection,
        pointFacts,
        spawnAreaAnchor,
        capabilities: { hasLayout: Boolean(buildingLocationsUrl) }
    });
}

function geographicActionsFor(context) {
    return createGeographicActions(context, {
        currentZoom: map.getZoom(),
        maxZoom: MAP_MAX_ZOOM
    });
}

function promotePointProbe() {
    const probe = pointProbeSession?.getProbe();
    if (!probe || !selectionSession) return false;
    try {
        viewportComposition.showPointContext();
        selectionSession.select(probe);
        referenceNavigation?.clear();
        pendingReferenceFocus = [];
        dismissPointProbe({ closePopup: true });
        viewportComposition.showInspector();
        map.closePopup();
        return true;
    } catch (error) {
        setSelectionStatus(error.message, 'error');
        return false;
    }
}

function visibleWorkbenchOcclusions() {
    return ['unified-dock', 'info-panel']
        .map(id => document.getElementById(id))
        .filter(isElementPresented)
        .map(element => element.getBoundingClientRect());
}

function zoomCloserToSelection(selection) {
    if (selection?.kind !== 'point') return false;
    const workspace = document.getElementById('map-workspace');
    const latLng = kenshiToLeaflet(selection.point);
    if (!workspace || !latLng) return false;
    const plan = createZoomCloserPlan({
        currentZoom: map.getZoom(),
        maxZoom: MAP_MAX_ZOOM,
        workspaceRect: workspace.getBoundingClientRect(),
        occlusionRects: visibleWorkbenchOcclusions(),
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    });
    if (!plan.enabled) return false;
    map.once('zoomend', () => {
        map.panInside(latLng, {
            animate: plan.animate,
            paddingTopLeft: L.point(plan.paddingTopLeft.x, plan.paddingTopLeft.y),
            paddingBottomRight: L.point(plan.paddingBottomRight.x, plan.paddingBottomRight.y)
        });
    });
    map.setView(latLng, plan.targetZoom, { animate: plan.animate });
    return true;
}

function zoomToSpawnArea(target) {
    const workspace = document.getElementById('map-workspace');
    const anchor = target?.kind === 'spawnArea' ? target.anchor : null;
    if (!workspace || !anchor) return false;
    const plan = createAreaZoomPlan({
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        targetZoom: target.targetZoom,
        workspaceRect: workspace.getBoundingClientRect(),
        occlusionRects: visibleWorkbenchOcclusions(),
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    });
    const panInside = () => {
        map.panInside(anchor, {
            animate: plan.animate,
            paddingTopLeft: L.point(plan.paddingTopLeft.x, plan.paddingTopLeft.y),
            paddingBottomRight: L.point(plan.paddingBottomRight.x, plan.paddingBottomRight.y)
        });
    };
    const currentCenter = map.getCenter();
    const sameCenter =
        Math.abs(currentCenter.lat - anchor.lat) < 1e-9 &&
        Math.abs(currentCenter.lng - anchor.lng) < 1e-9;
    if (map.getZoom() !== plan.targetZoom) {
        map.once('zoomend', panInside);
        map.setView(anchor, plan.targetZoom, { animate: plan.animate });
    } else if (!sameCenter) {
        map.once('moveend', panInside);
        map.setView(anchor, plan.targetZoom, { animate: plan.animate });
    } else {
        map.setView(anchor, plan.targetZoom, { animate: plan.animate });
        panInside();
    }
    return true;
}

function openPointProbePopup(latLng, inputKind = 'mouse') {
    const probe = pointProbeSession?.getProbe();
    if (!probe) return false;
    const probeKey = pointProbeKey(probe);
    let probeContext;
    try {
        probeContext = projectSelectionContext(probe);
    } catch (error) {
        setSelectionStatus(`Point context unavailable: ${error.message}`, 'error');
        return false;
    }

    const popupContent = document.createElement('div');
    popupContent.className = 'kenshi-popup kimap-ui point-probe-popup';
    const heading = document.createElement('h4');
    heading.textContent = probeContext.title ?? 'Map Point';
    const coordinates = document.createElement('div');
    coordinates.className = 'point-probe-coordinates';
    for (const [axis, value] of [['X', probe.point.x], ['Z', probe.point.z]]) {
        const coordinate = document.createElement('span');
        coordinate.className = 'point-probe-coordinate';
        const axisLabel = document.createElement('span');
        axisLabel.className = `point-probe-coordinate-axis is-${axis.toLocaleLowerCase()}`;
        axisLabel.textContent = axis;
        const coordinateValue = document.createElement('span');
        coordinateValue.textContent = String(Math.round(value));
        coordinate.append(axisLabel, coordinateValue);
        coordinates.append(coordinate);
    }
    const actions = document.createElement('div');
    actions.className = 'popup-actions';
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.textContent = 'Open Context';
    inspect.addEventListener('click', promotePointProbe);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy View';
    copy.addEventListener('click', () => void copyCurrentMapView(copy, probe));
    const zoomCloser = document.createElement('button');
    zoomCloser.type = 'button';
    zoomCloser.textContent = 'Zoom Closer';
    const zoomAction = geographicActionsFor(probeContext).find(action => action.id === 'zoomCloser');
    zoomCloser.disabled = !zoomAction?.enabled;
    if (zoomAction?.reason) zoomCloser.title = zoomAction.reason;
    zoomCloser.addEventListener('click', () => {
        if (zoomCloserToSelection(probe)) {
            zoomCloser.disabled = map.getZoom() >= MAP_MAX_ZOOM;
        }
    });
    actions.append(inspect, copy, zoomCloser);
    const reportSlot = document.createElement('div');
    reportSlot.className = 'location-probe-slot';
    popupContent.append(heading, coordinates, reportSlot, actions);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'point-probe-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close Point Probe');
    close.addEventListener('click', () => dismissPointProbe({ closePopup: true }));
    popupContent.append(close);

    const popup = L.popup({ closeButton: false, className: 'kenshi-popup-pane kimap-ui' })
        .setLatLng(latLng)
        .setContent(popupContent);
    locationReporting.attachProbe(popup, probe.point, reportSlot, {
        content: popupContent,
        inputKind,
        onDismiss: () => {
            if (pointProbeKey(pointProbeSession?.getProbe()) === probeKey) pointProbeSession.clear();
        }
    });
    locationReporting.presentProbe();
    return true;
}

function showInfoPanel(itemId, itemType, instanceId = null, source = 'manifest') {
    if (selectGeographicEntity(itemType, itemId, instanceId, source)) {
        executeGeographicAction('inspect');
        return true;
    }
    return false;
}

function refreshSelectionHighlights() {
    const selection = selectionSession?.getSelection();
    for (const [instanceId, marker] of townMarkersByInstanceId.entries()) {
        marker.getElement()?.classList.toggle(
            'selection-map-marker',
            selection?.kind === 'entity' &&
            selection.entityType === 'town' &&
            selection.instanceId === instanceId
        );
    }

    selectionPointLayer.clearLayers();
    if (selection?.kind === 'point') {
        const latLng = kenshiToLeaflet(selection.point);
        if (latLng) {
            L.circleMarker(latLng, {
                radius: 8,
                color: '#dfa959',
                weight: 3,
                fillColor: '#111',
                fillOpacity: 0.65,
                interactive: false,
                className: 'selection-point-marker'
            }).addTo(selectionPointLayer);
        }
    }
}

function synchronizeSelectionUI(change = { type: 'refresh' }) {
    const store = Alpine.store('infoPanel');
    const selection = selectionSession?.getSelection() ?? null;
    if (!selection || !selectionCatalog) {
        contextProjection = null;
        store.update(null, [], emptyInfoPanelData());
        refreshSelectionHighlights();
        if (change.type === 'clear' && referenceNavigation?.getSnapshot().hasReference) {
            referenceNavigation.showReference();
            viewportComposition.showInspector();
        } else if (change.type === 'clear') {
            store.close();
        }
        renderReferencePresentation();
        return;
    }

    try {
        contextProjection = projectSelectionContext(selection);
        const actions = geographicActionsFor(contextProjection);
        store.update(contextProjection, actions, adaptContextToInfoData(contextProjection));
    } catch (error) {
        contextProjection = null;
        store.update(null, [], emptyInfoPanelData(), error.message);
        console.error('Selection context projection failed:', error);
    }
    refreshSelectionHighlights();
    renderReferencePresentation();
}

async function writeClipboardText(value) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('The browser rejected the clipboard request.');
}

async function copyCurrentMapView(feedbackElement = null, selectionOverride = undefined) {
    if (!selectionOrigin) return false;
    try {
        const center = leafletToKenshi(map.getCenter());
        const fragment = serializeMapView({
            origin: selectionOrigin,
            viewport: { center, zoom: map.getZoom() },
            selection: selectionOverride === undefined
                ? selectionSession?.getSelection() ?? null
                : selectionOverride,
            catalog: selectionCatalog
        });
        const url = `${window.location.href.split('#')[0]}${fragment}`;
        await writeClipboardText(url);
        const feedbackLabel = feedbackElement?.querySelector('[data-copy-view-label]') ?? feedbackElement;
        setSelectionStatus('View link copied.', 'success', {
            timeout: TRANSIENT_STATUS_TIMEOUT_MS,
            onExpire() {
                if (activeCopyFeedback?.element === feedbackLabel) {
                    feedbackLabel.textContent = activeCopyFeedback.originalLabel;
                    activeCopyFeedback = null;
                }
            }
        });
        if (feedbackLabel) {
            // setSelectionStatus restores any previous feedback before we remember this label.
            activeCopyFeedback = { element: feedbackLabel, originalLabel: feedbackLabel.textContent };
            feedbackLabel.textContent = 'Copied';
        }
        return true;
    } catch (error) {
        setSelectionStatus(`Could not copy view: ${error.message}`, 'error');
        return false;
    }
}

function executeGeographicAction(actionId, feedbackElement = null) {
    if (actionId === 'clear' && selectionSession?.getSelection()) {
        selectionSession.clear();
        map.closePopup();
        return true;
    }
    const action = geographicActionsFor(contextProjection).find(entry => entry.id === actionId);
    if (!action?.enabled) {
        if (action?.reason) setSelectionStatus(action.reason, 'error');
        return false;
    }

    switch (actionId) {
        case 'inspect':
            Alpine.store('infoPanel').open();
            break;
        case 'zoom': {
            if (action.target.kind === 'town') {
                map.flyTo(action.target.anchor, action.target.targetZoom, { duration: 1.5 });
            } else {
                zoomToSpawnArea(action.target);
            }
            break;
        }
        case 'copyView':
            void copyCurrentMapView(feedbackElement);
            break;
        case 'zoomCloser':
            zoomCloserToSelection(contextProjection.selection);
            break;
        case 'togglePointContext':
            viewportComposition.togglePointContext();
            break;
        case 'layout': {
            const location = contextProjection.town.location;
            void openTownLayoutCover({
                Name: contextProjection.town.currentTown.name,
                Values: { X: location.coordinates.x, Z: location.coordinates.z }
            }, feedbackElement);
            break;
        }
        case 'overrides': {
            const baseTownId = contextProjection.town.primaryNetwork?.baseTownId;
            if (baseTownId) townOverridesController?.selectTown(baseTownId);
            break;
        }
        default:
            return false;
    }
    return true;
}

function restoreSharedMapView() {
    if (!selectionCatalog || !window.location.hash) return;
    const shared = parseMapView(window.location.hash, selectionCatalog);
    if (!shared) return;
    if (shared.viewport) {
        const center = kenshiToLeaflet(shared.viewport.center);
        if (center) map.setView(center, shared.viewport.zoom);
    }
    if (shared.selection) {
        selectionSession.select(shared.selection);
        Alpine.store('infoPanel').open();
    }
    if (shared.notice) setSelectionStatus(shared.notice, 'info');
}

function updateActiveInfoPanel() {
    synchronizeSelectionUI({ type: 'scenario' });
}

/**
 * Renders the Relations Journal from the authoritative scenario lens.
 */
function renderRelationsJournal() {
    const content = document.getElementById('journal-panel-content');
    if (!content) return;
    const previouslyOpen = new Set(
        [...content.querySelectorAll('.journal-campaigns-container.active')]
            .map(container => container.dataset.factionId)
    );
    content.replaceChildren();

    const factions = scenarioLensProjection?.relations.factions
        .filter(faction => !faction.notReal) ?? [];
    if (factions.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = scenarioLensError?.message || 'No known faction relations.';
        content.appendChild(empty);
        return;
    }

    const list = document.createElement('ul');
    list.className = 'journal-list';
    for (const faction of factions) {
        const entry = document.createElement('li');
        entry.className = 'journal-entry';
        entry.dataset.factionId = faction.id;

        const row = document.createElement('div');
        row.className = 'journal-row-main';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'journal-row-toggle';
        toggle.setAttribute('aria-expanded', String(previouslyOpen.has(faction.id)));
        toggle.setAttribute('aria-label', `${faction.name} campaigns, current relation ${String(faction.value)}`);
        const left = document.createElement('div');
        left.className = 'journal-left';
        const name = document.createElement('span');
        name.className = 'journal-name';
        name.textContent = faction.name;
        left.appendChild(name);

        const right = document.createElement('div');
        right.className = 'journal-right';
        const value = document.createElement('div');
        value.className = `journal-val-box value-${faction.classification}`;
        value.textContent = String(faction.value);
        right.appendChild(value);
        toggle.append(left, right);

        const inspect = document.createElement('button');
        inspect.type = 'button';
        inspect.className = 'journal-inspect-btn';
        inspect.title = 'Inspect Faction Details';
        inspect.dataset.action = 'inspect';
        inspect.setAttribute('aria-label', `Inspect ${faction.name}`);
        inspect.textContent = '⌕';
        row.append(toggle, inspect);

        const campaigns = document.createElement('div');
        campaigns.className = 'journal-campaigns-container';
        campaigns.id = `campaigns-${faction.id}`;
        campaigns.dataset.factionId = faction.id;
        toggle.setAttribute('aria-controls', campaigns.id);
        if (previouslyOpen.has(faction.id)) campaigns.classList.add('active');
        entry.append(row, campaigns);
        list.appendChild(entry);
    }
    content.appendChild(list);
    for (const factionId of previouslyOpen) populateCampaigns(factionId);
}

function openRelationsJournalSubview() {
    renderRelationsJournal();
    viewportComposition.openSubview('relationsJournal');
}

function handleRelationsJournalInteraction(event) {
    const inspectButton = event.target.closest('.journal-inspect-btn');
    if (inspectButton) {
        event.stopPropagation();
        const factionId = inspectButton.closest('.journal-entry')?.dataset.factionId;
        if (factionId) showReferenceRoot('faction', factionId, inspectButton);
        return;
    }

    const row = event.target.closest('.journal-row-main');
    const toggle = row?.querySelector('.journal-row-toggle');
    const factionId = toggle?.closest('.journal-entry')?.dataset.factionId;
    if (!factionId) return;
    const campaignBox = document.getElementById(`campaigns-${factionId}`);
    if (!campaignBox) return;
    const expanded = campaignBox.classList.toggle('active');
    toggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) populateCampaigns(factionId);
}

/**
 * Renders the tested world-state eligibility projection for a faction's campaigns.
 */
function populateCampaigns(factionId) {
    const container = document.getElementById(`campaigns-${factionId}`);
    if (!container) return;
    container.replaceChildren();
    const campaigns = scenarioLensProjection?.relations.byFactionId[factionId]?.campaigns ?? [];
    if (campaigns.length === 0) {
        const empty = document.createElement('em');
        empty.textContent = 'No campaigns found.';
        container.appendChild(empty);
        return;
    }

    const list = document.createElement('ul');
    list.className = 'campaign-list';
    const statusClasses = {
        eligible: 'status-possible',
        blocked: 'status-inactive',
        'no-prerequisites': 'status-potential',
        indeterminate: 'status-inactive'
    };
    for (const campaign of campaigns) {
        const item = document.createElement('li');
        item.className = 'campaign-item';
        const heading = document.createElement('div');
        const name = document.createElement('span');
        name.className = 'campaign-name';
        name.textContent = campaign.name;
        const status = document.createElement('span');
        status.className = `campaign-status ${statusClasses[campaign.status]}`;
        status.textContent = campaign.statusLabel;
        heading.append(name, status);
        item.appendChild(heading);

        const count = document.createElement('small');
        count.textContent = `${String(campaign.satisfiedCount)}/${String(campaign.requiredCount)} world-state prerequisites satisfied.`;
        item.appendChild(count);
        if (campaign.conditions.length > 0) {
            const conditions = document.createElement('ul');
            for (const condition of campaign.conditions) {
                const conditionItem = document.createElement('li');
                conditionItem.textContent = `${condition.name}: requires ${condition.requiredValue === 1 ? 'TRUE' : 'FALSE'}, currently ${condition.actualValue === 1 ? 'TRUE' : 'FALSE'}`;
                conditionItem.className = condition.satisfied ? 'condition-met' : 'condition-unmet';
                conditions.appendChild(conditionItem);
            }
            item.appendChild(conditions);
        }
        list.appendChild(item);
    }
    const note = document.createElement('small');
    note.className = 'campaign-scheduler-note';
    note.textContent = 'Eligibility reflects modeled world states only; it does not predict campaign scheduling.';
    container.append(list, note);
}

    /**
     * Populates the Infamy Tracker window with live state data.
     */
    function populateInfamyTracker() {
        const influenceContainer = document.getElementById('infamy-influence-list');
        const bountyContainer = document.getElementById('infamy-bounty-list');
        const spawnListContainer = document.getElementById('infamy-spawn-list');
        if (!influenceContainer || !bountyContainer || !spawnListContainer) return;
        const lens = scenarioLensProjection?.infamy;
        for (const container of [influenceContainer, bountyContainer, spawnListContainer]) {
            container.replaceChildren();
        }
        if (!lens) {
            for (const container of [influenceContainer, bountyContainer, spawnListContainer]) {
                const message = document.createElement('p');
                message.textContent = scenarioLensError?.message || 'Scenario analysis unavailable.';
                container.appendChild(message);
            }
            return;
        }

        const renderInfluenceGroup = (title, factions, valueClass) => {
            const heading = document.createElement('h4');
            heading.textContent = title;
            influenceContainer.appendChild(heading);
            if (factions.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'muted-text';
                empty.textContent = 'None';
                influenceContainer.appendChild(empty);
                return;
            }
            const list = document.createElement('ul');
            for (const faction of factions) {
                const item = document.createElement('li');
                const name = document.createElement('span');
                name.textContent = faction.name;
                const value = document.createElement('span');
                value.className = `value ${valueClass}`;
                value.textContent = String(faction.value);
                item.append(name, value);
                list.appendChild(item);
            }
            influenceContainer.appendChild(list);
        };

        renderInfluenceGroup('Allies', lens.allies, 'value-ally');
        influenceContainer.appendChild(document.createElement('hr'));
        renderInfluenceGroup('Enemies', lens.enemies, 'value-enemy');

        const statusClassMap = {
            0: 'status-dead',
            1: 'status-alive',
            2: 'status-imprisoned'
        };
        if (lens.bounties.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'No tracked bounties found.';
            bountyContainer.appendChild(empty);
        }
        for (const bounty of lens.bounties) {
            const card = document.createElement('article');
            card.className = 'bounty-card';
            const header = document.createElement('header');
            const indicator = document.createElement('span');
            indicator.className = `status-indicator ${bounty.scenarioTracked ? statusClassMap[bounty.status] : 'status-stateless'}`;
            indicator.title = bounty.statusLabel;
            const name = document.createElement('span');
            name.textContent = bounty.name;
            header.append(indicator, name);

            const amount = document.createElement('p');
            const amountLabel = document.createElement('strong');
            amountLabel.textContent = 'Bounty: ';
            amount.append(amountLabel, `${bounty.amount.toLocaleString()} Cats`);
            const chance = document.createElement('p');
            const chanceLabel = document.createElement('strong');
            chanceLabel.textContent = 'Assignment: ';
            chance.append(chanceLabel, bounty.chanceLabel);
            const status = document.createElement('p');
            const statusLabel = document.createElement('strong');
            statusLabel.textContent = 'Scenario status: ';
            status.append(statusLabel, bounty.statusLabel);
            const footer = document.createElement('footer');
            const issuers = document.createElement('small');
            issuers.textContent = `Wanted By: ${bounty.factions.map(faction => faction.name).join(', ')}`;
            footer.appendChild(issuers);
            card.append(header, amount, chance, status, footer);
            bountyContainer.appendChild(card);
        }

        for (const area of lens.spawns) {
            if (area.entries.length === 0) continue;
            const details = document.createElement('details');
            details.open = true;
            const summary = document.createElement('summary');
            summary.textContent = area.name;
            const list = document.createElement('ul');
            for (const spawn of area.entries) {
                const item = document.createElement('li');
                item.dataset.occurrenceId = spawn.occurrenceId;
                const identity = document.createElement('span');
                const indicator = document.createElement('span');
                indicator.className = `status-indicator status-${spawn.status.toLowerCase()}`;
                const name = document.createElement('span');
                name.textContent = spawn.name;
                identity.append(indicator, name);
                const type = document.createElement('em');
                type.textContent = spawn.type;
                item.append(identity, type);
                list.appendChild(item);
            }
            details.append(summary, list);
            spawnListContainer.appendChild(details);
        }
    }

    /**
     * Resolves the CURRENT active state of a town by checking for active overrides.
     * Includes loop detection and increased iteration limits for mod compatibility.
     * @param {string} baseTownId - The StringId of the town to start from.
     * @returns {object|null} An object containing the final resolved town data and the path taken.
     */
    function getCurrentTownData(baseTownId) {
        const baseTown = townDatabase[baseTownId];
        if (!baseTown) {
            // Silently fail for missing base towns (common in partial datasets)
            return null;
        }

        const authoritative = scenarioSession?.getSnapshot().world.towns[baseTownId];
        const overrideProjection = scenarioLensProjection?.townOverrides.byBaseTownId[baseTownId];
        if (!authoritative) {
            return {
                finalState: baseTown,
                path: [{ townId: baseTownId, townName: baseTown.Name, reason: 'Base Town' }],
                baseTown,
                activeTownId: baseTownId,
                ambiguous: false,
                cycle: false
            };
        }

        const resolvedTownData = composeEffectiveTown(townDatabase, baseTownId, authoritative);
        const activePathIndex = authoritative.path.lastIndexOf(authoritative.activeTownId);
        const activePath = authoritative.path.slice(0, activePathIndex + 1);
        const path = activePath.map((townId, index) => {
            const town = townDatabase[townId];
            return {
                townId,
                townName: town?.Name ?? townId,
                reason: index === 0
                    ? 'Base Town'
                    : overrideProjection?.edges
                        .find(edge => edge.sourceId === activePath[index - 1] && edge.targetId === townId)
                        ?.conditions.map(condition => condition.text).join(' & ') ||
                        'Override prerequisites satisfied'
            };
        });

        return {
            finalState: resolvedTownData,
            path,
            baseTown,
            activeTownId: authoritative.activeTownId,
            ambiguous: authoritative.ambiguous,
            cycle: authoritative.cycle
        };
    }

    /**
     * Analyzes a spawn area and returns a list of all unique weather/environmental effects.
     * @param {object} spawnArea The spawn area object from spawnAreaDatabase.
     * @returns {string[]} An array of unique effect names.
     */
    function getWeatherEffectsForSpawnArea(spawnArea) {
        if (!spawnArea) return [];

        const uniqueEffects = new Set();
        const affectTypeMap = { 1: "Duststorm", 2: "Acid Rain", 3: "Burning", 4: "Gas" };

        // 1. Check for direct acid values on the spawn area itself
        if (spawnArea.Values['acidic ground'] > 0) uniqueEffects.add("Acidic Ground");
        if (spawnArea.Values['acidic water'] > 0) uniqueEffects.add("Acidic Water");

        // 2. Traverse the seasons -> weathers -> effects chain
        const seasonRefs = spawnArea.ReferenceCategories?.seasons; 
    
        if (seasonRefs) {
            seasonRefs.forEach(seasonRef => {
                const season = seasonDatabase[seasonRef.StringId];
                if (!season) return;

                const weatherRefs = season.ReferenceCategories?.weathers;
                if (weatherRefs) {
                    weatherRefs.forEach(weatherRef => {
                        const weather = weatherDatabase[weatherRef.StringId];
                        if (!weather) return;
                    
                        const weatherAffectType = weather.Values['affect type'];
                        if (weatherAffectType && affectTypeMap[weatherAffectType]) {
                            uniqueEffects.add(affectTypeMap[weatherAffectType]);
                        }

                        const effectRefs = weather.ReferenceCategories?.effects;
                        if (effectRefs) {
                            effectRefs.forEach(effectRef => {
                                const effect = effectDatabase[effectRef.StringId];
                                if (!effect) return;

                                const effectAffectType = effect.Values['affect type'];
                                if (effectAffectType && affectTypeMap[effectAffectType]) {
                                    uniqueEffects.add(affectTypeMap[effectAffectType]);
                                }
                            });
                        }
                    });
                }
            });
        }

        return Array.from(uniqueEffects);
    }

/**
 * Creates the consolidated World Scanner panel.
 * Replaces the old 4-box tracker system.
 * Updated 12/22 (Final Polish): Full color coding for resources, coordinates, and bounds checking.
 */
function initWorldTracker(map) {
    const container = document.createElement('section');
    container.id = 'world-tracker';
    container.dataset.expanded = 'false';
    container.setAttribute('aria-label', 'Scanner');

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const scannerView = createScannerView(container);
    scannerView.setCoordinates({});
    scannerView.setArea(createScannerReading());
    const scannerSlot = document.getElementById('workbench-scanner-slot');
    (scannerSlot ?? document.getElementById('map-container')).appendChild(container);
    popoverResizeObserver?.observe(container);
    popoverResizeObserver?.observe(container.querySelector('#wt-table'));
    container.querySelector('#wt-toggle')?.addEventListener('click', () => {
        const state = viewportComposition.getSnapshot();
        const mode = isPoliticalViewActive() ? state.hudMode : 'scanner';
        setScannerExpanded(!state[`${mode}Expanded`]);
    });
    const getPoliticalState = () => ({
        active: isPoliticalViewActive(), reports: politicalReports,
        colors: politicalPresentation?.getSnapshot().colorsByFactionId ?? emptyPoliticalColors,
        reason: politicalReportingReason, canNavigate: Boolean(referenceNavigation)
    });
    const getPoliticalReport = point => politicalReportsByGeometry.get(
        politicalAreaIndex?.getGeometryAtKenshi(point)?.key
    ) ?? null;
    politicalReporting = createPoliticalReportingController({
        container, session: viewportComposition, getPoliticalState, getReportAtPoint: getPoliticalReport,
        onFaction: (id, button) => showReferenceRoot('faction', id, button),
        onFactionColor: openFactionColorsView,
        getFactionColorAvailability,
        getTheaterAvailability: id => windowManager.getAvailability(id),
        onOpenTheater: (id, returnFocus) => windowManager.open(id, { returnFocus }),
        onResize: scheduleActiveAnchoredPopoverPosition
    });
    locationReporting = createLocationReportingController({
        map, workspace: document.getElementById('map-workspace'), session: viewportComposition,
        subjects: createLocationReportSubjects({
            getPoliticalState, getPoliticalReport,
            getEnvironmentState: () => ({ available: Boolean(environmentReportCatalog), reason: environmentReportReason }),
            getEnvironmentReport: point => environmentReportCatalog?.getReportAtPoint(point) ?? null,
            getPresenceState: target => presenceReports?.getState(target) ?? ({ available: false, reason: 'Current presence reporting is unavailable.' }),
            getPresenceReport: point => presenceReports?.getReportAtPoint(point) ?? null,
            getTownPresenceReport: target => presenceReports?.getReportForTown(target) ?? null
        }),
        toPoint: leafletToKenshi,
        getBounds: () => getUsableWorkspaceBounds(document.getElementById('map-workspace').getBoundingClientRect()),
        getProbeHeightCap: () => {
            if (!viewportComposition.getSnapshot().phone) {
                return measureExpandedScannerHeight(container, document.getElementById('workbench-hud-region'));
            }
            const bounds = getUsableWorkspaceBounds(document.getElementById('map-workspace').getBoundingClientRect());
            return Math.max(0, (bounds.bottom - bounds.top) / 2);
        },
        getHudRect: () => !viewportComposition.getSnapshot().phone && isElementPresented(container)
            ? container.getBoundingClientRect() : null,
        onGeometryChange: scheduleActiveAnchoredPopoverPosition,
        onVisibleBoundsChange: () => {
            const state = viewportComposition.getSnapshot();
            if (state.factionColorsWidgetOpen && !state.focusMap && getFactionColorsWidgetAvailability().available) {
                viewportGeometry.requestWidget();
            }
        },
        getObstructions: () => [...new Set([
            ...['world-tracker', 'map-control-cluster', 'map-tool-shelf', 'map-navigation-stack',
                'cursor-controls-panel', 'map-content-control', 'world-views-control'].map(id => document.getElementById(id)),
            ...document.querySelectorAll('#map-workspace [data-report-obstruction]')
        ])].filter(element => element && isElementPresented(element))
            .map(element => element.getBoundingClientRect()),
        isSuppressed: () => mapPopupOpen || windowManager.isOpen() || townLayoutController?.isOpen() ||
            isPaintActive() || playerMarkerStore.isPlacementModeActive() || shellTransientAdapter.isActive() ||
            (viewportComposition.getSnapshot().phone && viewportComposition.getSnapshot().phoneForeground !== 'map') ||
            viewportComposition.getSnapshot().transientSurface === 'cursorControls',
        onPointer: point => politicalReporting.setHoverPoint(point)
    });
    politicalReporting.mountTooltipControl(document.querySelector('[data-layer-id="political"]'));
    for (const [instanceId, marker] of townMarkersByInstanceId) {
        const location = selectionCatalog?.locationById[instanceId];
        const town = location && getCurrentTownData(location.TargetId)?.finalState;
        if (town && isPresenceTownType(town.Values?.type)) {
            const release = locationReporting.registerTownTarget(marker.getElement(), { entityId: location.TargetId, instanceId });
            if (release) marker.once('remove', release);
        }
    }
    refreshPoliticalReports();

    let lastSpawnArea, lastBiome, lastResources, lastInBounds, lastReading;
    map.on('mousemove', throttle(function(e) {
        // 1. Coordinates with Bounds Checking
        const worldSize = kenshiMaxCoord - kenshiMinCoord;
        const kenshiX = (e.latlng.lng / mapWidth) * worldSize + kenshiMinCoord;
        const kenshiZ = ((mapHeight - e.latlng.lat) / mapHeight) * worldSize + kenshiMinCoord;

        const inBounds =
            kenshiX >= kenshiMinCoord && kenshiX <= kenshiMaxCoord &&
            kenshiZ >= kenshiMinCoord && kenshiZ <= kenshiMaxCoord;
        scannerView.setCoordinates({ x: kenshiX, z: kenshiZ, inBounds });

        // 2. Spawn Area (TGA Lookup)
        let currentSpawnArea = null;
        if (window.decodedTgaData && colorToAreaMap) {
            const tga = window.decodedTgaData;
            const tx = Math.floor((e.latlng.lng / mapWidth) * tga.width);
            const ty = Math.floor((1 - (e.latlng.lat / mapHeight)) * tga.height);
            if (tx >= 0 && tx < tga.width && ty >= 0 && ty < tga.height) {
                const idx = ((tga.height - 1 - ty) * tga.width + tx) * 4;
                const key = `${tga.data[idx]},${tga.data[idx+1]},${tga.data[idx+2]}`;
                currentSpawnArea = colorToAreaMap.get(key);
            }
        }

        // 3. Biome (PNG Lookup)
        let currentBiome = null;
        if (biomePixelData && colorToBiomeMap) {
            const bx = Math.floor((e.latlng.lng / mapWidth) * biomePixelData.width);
            const by = Math.floor((1 - (e.latlng.lat / mapHeight)) * biomePixelData.height);
            if (bx >= 0 && bx < biomePixelData.width && by >= 0 && by < biomePixelData.height) {
                const idx = (by * biomePixelData.width + bx) * 4;
                const key = `${biomePixelData.data[idx]},${biomePixelData.data[idx+1]},${biomePixelData.data[idx+2]}`;
                currentBiome = colorToBiomeMap.get(key);
            }
        }

        // Shared Resource Data Lookup
        let resData = null;
        if (currentSpawnArea) {
            const resRef = currentSpawnArea.ReferenceCategories?.resources?.[0];
            resData = resRef ? resourceDatabase[resRef.StringId] : null;
        }

        if (!lastReading || currentSpawnArea !== lastSpawnArea || currentBiome !== lastBiome ||
            resData !== lastResources || inBounds !== lastInBounds) {
            lastReading = createScannerReading({
                spawnArea: inBounds ? currentSpawnArea : null,
                biome: inBounds ? currentBiome : null,
                resources: inBounds ? resData : null,
                effects: inBounds && currentSpawnArea ? getWeatherEffectsForSpawnArea(currentSpawnArea) : []
            });
            scannerView.setArea(lastReading);
            lastSpawnArea = currentSpawnArea;
            lastBiome = currentBiome;
            lastResources = resData;
            lastInBounds = inBounds;
        }
    }, 50));
}

/**
 * Synchronizes both layer-family choosers and Plan summaries with live Leaflet state.
 */
function setupLayerSynchronization() {
    map.on('layeradd', (e) => {
        const addedSurface = (layerDescriptors ?? []).find(descriptor =>
            descriptor.family === 'worldView' &&
            descriptor.kind === 'surface' &&
            descriptor.layer === e.layer);
        if (addedSurface) {
            if (!addedSurface.available) {
                map.removeLayer(e.layer);
                return;
            }
            if (!applyingWorldSurfaceChoice) surfaceChoiceTouched = true;
            for (const candidate of layerDescriptors) {
                if (
                    candidate.family === 'worldView' &&
                    candidate.kind === 'surface' &&
                    candidate.layer &&
                    candidate.layer !== e.layer &&
                    map.hasLayer(candidate.layer)
                ) map.removeLayer(candidate.layer);
            }
        }
        if (e.layer === debugGridLayer) createDebugGridLayer();
        if (e.layer === politicalViewLayer) {
            viewportComposition.activatePoliticalReports();
            if (politicalRenderedGeneration !== politicalRenderGeneration) {
                schedulePoliticalRasterRender();
            }
            updatePoliticalOverlayOpacity();
        }
        if (e.layer === landmarkLayer) {
            void loadLandmarksBackground().catch(error => {
                console.error('Landmarks could not be enabled.', error);
            });
        }
        if (e.layer === roadLayer) {
            void loadRoadNetwork().catch(error => {
                console.error('Road network could not be enabled.', error);
            });
        }
        if (e.layer === spawnBorderLayer) {
            const pickerInput = document.getElementById('map-border-color');
            const color = pickerInput ? pickerInput.value : "#000000";
            renderSpawnBorders(color);
        }
        if (e.layer === spawnLabelLayer) renderSpawnLabels();

        const layerKey = Object.keys(DATA_LAYERS).find(key => DATA_LAYERS[key].layer === e.layer);
        if (layerKey) renderDataOverlay(layerKey);
        if ((layerDescriptors ?? configurationLayerDescriptors)?.some(descriptor => descriptor.layer === e.layer)) renderLayerPresentation();
    });

    map.on('layerremove', (e) => {
        if (e.layer === politicalViewLayer) {
            viewportComposition.setHudMode('scanner');
            refreshPoliticalReports();
        }
        if ((layerDescriptors ?? configurationLayerDescriptors)?.some(descriptor => descriptor.layer === e.layer)) renderLayerPresentation();
    });
}

function updateProjectZoomControls() {
    const zoom = map.getZoom();
    const min = map.getMinZoom();
    const max = map.getMaxZoom();
    const zoomIn = document.getElementById('map-zoom-in-btn');
    const zoomOut = document.getElementById('map-zoom-out-btn');
    if (zoomIn) zoomIn.disabled = zoom >= max;
    if (zoomOut) zoomOut.disabled = zoom <= min;
}

function setupProjectMapControls() {
    cursorControls = createCursorControls({
        session: viewportComposition,
        getSubjectAvailability: subject => subject === 'political' ? ({
            active: isPoliticalViewActive(), available: politicalReports?.available === true,
            reason: politicalReportingReason
        }) : ['relations', 'squadPresence'].includes(subject)
            ? presenceReports?.getState() ?? ({ available: false, reason: 'Current presence reporting is unavailable.' })
            : ({ available: Boolean(environmentReportCatalog), reason: environmentReportReason }),
        onToggle: () => {
            if (viewportComposition.getSnapshot().transientSurface === 'cursorControls') {
                closeActiveTransientSurface({ expected: 'cursorControls', restoreFocus: true });
            } else openCursorControls();
        },
        onOpen: openCursorControls,
        onClose: () => closeActiveTransientSurface({ expected: 'cursorControls', restoreFocus: true }),
        onGeometryChange: scheduleActiveAnchoredPopoverPosition
    });
    document.getElementById('map-navigation-stack').append(cursorControls.frame);
    document.getElementById('map-popover-host').append(cursorControls.element);
    popoverResizeObserver?.observe(cursorControls.element);
    const workspace = document.getElementById('map-workspace');
    const isPresented = node => isElementPresented(node) && node.getClientRects().length > 0 &&
        window.getComputedStyle(node).visibility !== 'hidden';
    factionColorsWidget = createFactionColorsWidget({
        workspace, session: viewportComposition,
        getProjection: () => politicalFactionProjection,
        getAvailability: getFactionColorsWidgetAvailability,
        getBounds: () => getUsableWorkspaceBounds(workspace.getBoundingClientRect()),
        getAnchorRect: () => {
            const stack = document.getElementById('map-navigation-stack');
            return isPresented(stack) ? stack.getBoundingClientRect() : null;
        },
        getObstructions: () => [
            ...['world-tracker', 'map-control-cluster', 'map-tool-shelf', 'cursor-controls-panel',
                'map-content-control', 'world-views-control', 'icon-grid-popover']
                .map(id => document.getElementById(id)).filter(isPresented)
                .map(node => node.getBoundingClientRect()),
            ...(locationReporting?.getVisibleBounds() ?? [])
        ],
        onGeometryChange: viewportGeometry.requestWidget,
        isPresented,
        getFallbackFocus: () => [getLayerChooserLauncher('worldViews'),
            document.getElementById('workbench-focus-map-btn'), workspace].find(isPresented)
    });
    const widgetOpener = document.getElementById('faction-colors-widget-open-btn');
    widgetOpener.prepend(createPoliticalNavigationArtwork('faction-colors-widget', { preserveColors: true }));
    widgetOpener.addEventListener('click', () => toggleFactionColorsWidget(widgetOpener));
    refreshFactionColorsWidget();
    const zoomIn = document.getElementById('map-zoom-in-btn');
    const zoomOut = document.getElementById('map-zoom-out-btn');
    zoomIn?.addEventListener('click', () => map.zoomIn());
    zoomOut?.addEventListener('click', () => map.zoomOut());
    for (const surface of ['mapContent', 'worldViews']) {
        const launcher = getLayerChooserLauncher(surface);
        if (!launcher) continue;
        launcher.disabled = true;
        launcher.addEventListener('click', () => {
            const state = viewportComposition.getSnapshot();
            if (state.transientSurface === surface) {
                pendingLayerChooserFocus = null;
                closeActiveTransientSurface({ expected: surface, restoreFocus: true });
                return;
            }
            pendingLayerChooserFocus = isLayerChooserSurface(state.transientSurface)
                ? surface : null;
            if (state.layoutClass === 'narrow') {
                viewportComposition.hideDock();
                viewportComposition.hideInspector();
            }
            topBarController.closeTransient({ restoreFocus: false });
            viewportComposition.openTransientSurface(surface);
        });
    }
    map.on('zoomend', updateProjectZoomControls);
    setupAnchoredPopoverDismissal();
    updateProjectZoomControls();
}

function openCursorControls() {
    pendingLayerChooserFocus = null;
    pendingTransientFocusReturn = null;
    topBarController.closeTransient({ restoreFocus: false });
    viewportComposition.openTransientSurface('cursorControls');
}

// Layer family controls.
const LAYER_CHOOSER_SURFACES = Object.freeze(['mapContent', 'worldViews']);
const LAYER_SETTINGS_GLYPH = `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="3"/>
    <path d="m8 3 .5-1h3L12 3l1.5.9 1.3-.1 1.5 2.6-.7 1.1v1.8l.7 1.1-1.5 2.6-1.3-.1-1.5.9-.5 1h-3l-.5-1-1.5-.9-1.3.1-1.5-2.6.7-1.1V7.5l-.7-1.1 1.5-2.6 1.3.1Z" transform="translate(0 1.5)"/>
</svg>`;
const LAYER_PIN_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
</svg>`;
const LAYER_DOWN_GLYPH = `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="m4 7 6 6 6-6"/>
</svg>`;

function createLayerDescriptor({
    id,
    name,
    layer,
    kind,
    family,
    configurationTarget = null,
    configurationSubview = null,
    experimental = false,
    available = true,
    unavailableReason = ''
}) {
    return Object.freeze({
        id,
        name,
        layer,
        kind,
        family,
        configurationTarget,
        configurationSubview,
        experimental,
        available,
        unavailableReason
    });
}

function getRasterSurfaceReason() {
    return spawnRasterStatus === 'loading'
        ? 'Available after spawn-area raster loading completes.'
        : 'Unavailable because the spawn-area raster could not be loaded.';
}

function getPoliticalSurfaceReason() {
    return politicalStatusReason || (politicalStatus === 'loading'
        ? 'Political evidence is loading.'
        : 'Political evidence is unavailable.');
}

function refreshLayerDescriptors() {
    initializeConfigurationLayerDescriptors();
    const rasterReady = spawnRasterStatus === 'ready';
    const rasterReason = rasterReady ? '' : getRasterSurfaceReason();
    const surface = (id, name, layer, options = {}) => createLayerDescriptor({
        id,
        name,
        layer,
        kind: 'surface',
        family: 'worldView',
        available: options.requiresRaster ? rasterReady : Boolean(layer),
        unavailableReason: options.requiresRaster ? rasterReason
            : layer ? '' : 'This world view is unavailable.'
    });
    const content = (id, name, layer) => createLayerDescriptor({
        id,
        name,
        layer,
        kind: 'overlay',
        family: 'mapContent'
    });

    layerDescriptors = Object.freeze([
        surface('none', 'None', emptyLayer),
        createLayerDescriptor({
            id: 'political',
            name: 'Political View',
            layer: politicalViewLayer,
            kind: 'surface',
            family: 'worldView',
            configurationSubview: 'factionColors',
            experimental: true,
            available: politicalStatus === 'ready',
            unavailableReason: politicalStatus === 'ready' ? '' : getPoliticalSurfaceReason()
        }),
        surface('spawnAreas', 'Spawn Areas', spawnAreaOverlay, { requiresRaster: true }),
        surface('biomes', 'Biomes', biomeLayer),
        surface('arid', 'Fertility: Arid', aridLayer, { requiresRaster: true }),
        surface('green', 'Fertility: Green', greenLayer, { requiresRaster: true }),
        surface('swamp', 'Fertility: Swamp', swampLayer, { requiresRaster: true }),
        surface('copper', 'Mining: Copper', copperLayer, { requiresRaster: true }),
        surface('iron', 'Mining: Iron', ironLayer, { requiresRaster: true }),
        surface('stone', 'Mining: Stone', stoneLayer, { requiresRaster: true }),
        surface('water', 'Resource: Water', waterLayer, { requiresRaster: true }),
        surface('acidGround', 'Hazard: Acid Ground', acidGroundLayer, { requiresRaster: true }),
        surface('acidWater', 'Hazard: Acid Water', acidWaterLayer, { requiresRaster: true }),
        surface('acidRain', 'Weather: Acid Rain', acidRainLayer, { requiresRaster: true }),
        surface('burning', 'Weather: Burning', burningLayer, { requiresRaster: true }),
        surface('duststorm', 'Weather: Duststorm', duststormLayer, { requiresRaster: true }),
        surface('gas', 'Weather: Gas', gasLayer, { requiresRaster: true }),
        configurationLayerDescriptors.find(({ configurationTarget }) =>
            configurationTarget === 'borders'),
        configurationLayerDescriptors.find(({ configurationTarget }) =>
            configurationTarget === 'roads'),
        configurationLayerDescriptors.find(({ configurationTarget }) =>
            configurationTarget === 'debugGrid'),
        content('towns', 'Towns', townLayer),
        content('nests', 'Nests & Camps', nestLayer),
        content('regionLabels', 'Region Names', spawnLabelLayer),
        content('landmarks', 'Landmarks', landmarkLayer),
        content('relations', 'Player Relations', relationsModeLayer)
    ]);
    syncLayerFamilyControls();
    renderLayerPresentation();
}

function getLayerDescriptor(id) {
    return layerDescriptors?.find(descriptor => descriptor.id === id) ?? null;
}

function getTownTypeProjection() {
    return createTownTypeFilterProjection({
        occurrenceTypes: townTypeOccurrenceTypes,
        isEnabled(key) {
            const layer = townTypeLayers.get(key);
            return Boolean(layer && townLayer.hasLayer(layer));
        }
    });
}

function getActiveWorldSurface() {
    return (layerDescriptors ?? []).find(descriptor =>
        descriptor.family === 'worldView' &&
        descriptor.id !== 'none' &&
        descriptor.layer &&
        map.hasLayer(descriptor.layer)) ?? null;
}

function isLayerDescriptorActive(descriptor) {
    if (!descriptor?.layer) return false;
    if (descriptor.id === 'none') return getActiveWorldSurface() === null;
    return map.hasLayer(descriptor.layer);
}

function activateWorldSurface(descriptor, { userInitiated = false } = {}) {
    if (!descriptor?.available || !descriptor.layer) return false;
    if (userInitiated) surfaceChoiceTouched = true;
    applyingWorldSurfaceChoice = true;
    try {
        for (const candidate of layerDescriptors ?? []) {
            if (
                candidate.family === 'worldView' &&
                candidate.kind === 'surface' &&
                candidate.layer &&
                candidate.layer !== descriptor.layer &&
                map.hasLayer(candidate.layer)
            ) {
                map.removeLayer(candidate.layer);
            }
        }
        if (!map.hasLayer(descriptor.layer)) map.addLayer(descriptor.layer);
    } finally {
        applyingWorldSurfaceChoice = false;
    }
    renderLayerPresentation();
    return true;
}

function setOverlayLayerActive(descriptor, active) {
    if (!descriptor?.available || !descriptor.layer) return false;
    if (active && !map.hasLayer(descriptor.layer)) map.addLayer(descriptor.layer);
    else if (!active && map.hasLayer(descriptor.layer)) map.removeLayer(descriptor.layer);
    return true;
}

function syncLayerFamilyControls() {
    for (const surface of LAYER_CHOOSER_SURFACES) layerControls[surface]?.sync();
    refreshFactionColorsWidget();
    scheduleActiveAnchoredPopoverPosition();
}

function createLayerHeaderButton(className, label, glyph) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `layers-icon-btn ${className}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = glyph;
    return button;
}

class PinnedLayerChooser {
    constructor({ surface, title }) {
        this.surface = surface;
        this.title = title;
        this._isPinned = false;
        this._container = document.createElement('section');
        this._container.id = surface === 'mapContent'
            ? 'map-content-control' : 'world-views-control';
        this._container.className = 'map-layer-control map-anchored-popover';
        this._container.hidden = true;
        this._container.setAttribute('role', 'region');

        const header = document.createElement('header');
        header.className = 'layers-control-header';
        this._heading = document.createElement('span');
        this._heading.id = `${this._container.id}-title`;
        this._heading.className = 'layers-header-title';
        this._heading.tabIndex = -1;
        this._heading.textContent = title;
        this._container.setAttribute('aria-labelledby', this._heading.id);

        const actions = document.createElement('div');
        actions.className = 'layers-header-actions';
        this._pinButton = createLayerHeaderButton(
            'layers-pin-btn', `Pin ${title} open`, LAYER_PIN_GLYPH);
        this._pinButton.setAttribute('aria-pressed', 'false');
        const settings = createLayerHeaderButton(
            'layers-settings-btn', 'Open Overlay Controls', LAYER_SETTINGS_GLYPH);
        this._closeButton = createLayerHeaderButton(
            'layers-close-btn', 'Back to Layers', LAYER_DOWN_GLYPH);
        this._closeButton.hidden = true;
        actions.append(this._pinButton, settings, this._closeButton);
        header.append(this._heading, actions);

        this._options = document.createElement('div');
        this._options.className = 'layers-control-options';
        this._options.tabIndex = 0;
        this._options.setAttribute('aria-label', `${title} choices`);
        this._container.append(header, this._options);

        if (surface === 'mapContent') buildMapContentOptions(this._options);
        else buildWorldViewsOptions(this._options);

        this._pinButton.addEventListener('click', event => {
            event.stopPropagation();
            this._togglePin();
        });
        settings.addEventListener('click', event => {
            event.stopPropagation();
            openOverlayControls();
        });
        this._closeButton.addEventListener('click', event => {
            event.stopPropagation();
            viewportComposition.returnPhoneLayerChooserToTray(surface);
        });
        this._autoHide = bindChooserAutoHide({
            launcherFrame: document.getElementById('map-layer-family-launchers'),
            panel: this._container,
            isPresented: () => !this._container.hidden &&
                viewportComposition.getSnapshot().transientSurface === surface,
            isPinned: () => this._isPinned,
            onDismiss: () => closeActiveTransientSurface({ expected: surface, respectPinned: true })
        });
        L.DomEvent.disableClickPropagation(this._container);
        L.DomEvent.disableScrollPropagation(this._container);
    }

    _togglePin() {
        this._isPinned = !this._isPinned;
        const label = this._isPinned ? `Unpin ${this.title}` : `Pin ${this.title} open`;
        this._pinButton.title = label;
        this._pinButton.setAttribute('aria-label', label);
        this._pinButton.setAttribute('aria-pressed', String(this._isPinned));
        this._pinButton.classList.toggle('active', this._isPinned);
        this._container.classList.toggle('is-pinned', this._isPinned);
        if (this._isPinned) this.expand();
        this._autoHide.refresh();
    }

    expand() {
        this._container.hidden = false;
        this._container.classList.add('visible');
        this._autoHide.refresh();
    }

    forceCollapse() {
        this._isPinned = false;
        this._container.hidden = true;
        this._container.classList.remove('visible', 'is-pinned');
        this._pinButton.classList.remove('active');
        this._pinButton.setAttribute('aria-pressed', 'false');
        this._pinButton.setAttribute('aria-label', `Pin ${this.title} open`);
        this._pinButton.title = `Pin ${this.title} open`;
        this._autoHide.refresh();
    }

    isPinned() {
        return this._isPinned;
    }

    refreshAutoHide() {
        this._autoHide.refresh();
    }

    focusHeading() {
        this._heading.focus({ preventScroll: true });
    }

    getContainer() {
        return this._container;
    }

    sync() {
        if (this.surface === 'mapContent') syncMapContentOptions(this._options);
        else syncWorldViewsOptions(this._options);
    }
}

function createLayerGroupHeading(label) {
    const heading = document.createElement('h3');
    heading.className = 'layer-choice-group-title';
    heading.textContent = label;
    return heading;
}

function createLayerChoiceRow(descriptorId, { radio = false, choiceLabel = null } = {}) {
    const row = document.createElement('div');
    row.className = 'layer-choice-row';
    row.dataset.layerId = descriptorId;
    row.dataset.layerOptionRow = '';
    if (choiceLabel) row.dataset.choiceLabel = choiceLabel;

    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = radio ? 'radio' : 'checkbox';
    input.id = `layer-choice-${descriptorId}`;
    if (radio) input.name = 'world-view-surface';
    const text = document.createElement('span');
    text.className = 'layer-choice-label';
    const badge = document.createElement('span');
    badge.className = 'layer-choice-badge';
    badge.textContent = 'Experimental';
    badge.hidden = true;
    const state = document.createElement('span');
    state.className = 'layer-choice-state';
    state.hidden = true;
    label.htmlFor = input.id;
    label.append(input, text, badge, state);
    row.append(label);

    input.addEventListener('change', event => {
        event.stopPropagation();
        const descriptor = getLayerDescriptor(descriptorId);
        if (!descriptor) return;
        if (radio) activateWorldSurface(descriptor, { userInitiated: true });
        else setOverlayLayerActive(descriptor, input.checked);
        syncLayerFamilyControls();
        renderLayerPresentation();
    });

    const descriptor = getLayerDescriptor(descriptorId);
    if (descriptor?.configurationTarget || descriptor?.configurationSubview) {
        row.classList.add('layers-configurable-row');
        const button = createLayerHeaderButton(
            'layers-row-settings-btn', `Configure ${descriptor.name}`, LAYER_SETTINGS_GLYPH);
        if (descriptor.configurationTarget) {
            button.dataset.configurationTarget = descriptor.configurationTarget;
        }
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const current = getLayerDescriptor(descriptorId);
            if (!current?.available) return;
            if (current.configurationSubview === 'factionColors') {
                openFactionColorsView();
                return;
            }
            if (!current.layer || !map.hasLayer(current.layer)) return;
            openLayerConfigurationView(current.configurationTarget);
        });
        row.append(button);
    }

    return row;
}

function appendLayerChoiceGroup(options, title, descriptorIds) {
    options.append(createLayerGroupHeading(title));
    for (const descriptorId of descriptorIds) {
        options.append(createLayerChoiceRow(descriptorId, {
            radio: getLayerDescriptor(descriptorId)?.kind === 'surface'
        }));
    }
}

function buildWorldViewsOptions(options) {
    if (cursorControls) options.append(cursorControls.banner);
    appendLayerChoiceGroup(options, 'Surface', ['none', 'political']);
    politicalModeInfo = createPoliticalModeInfo({
        settingsGlyph: LAYER_SETTINGS_GLYPH,
        getConfigurationAvailability: getFactionColorAvailability,
        getWidgetAvailability: getFactionColorsWidgetAvailability,
        getWidgetOpen: () => viewportComposition.getSnapshot().factionColorsWidgetOpen,
        onToggleWidget: toggleFactionColorsWidget,
        onConfigureFactions: () => openFactionColorsView(),
        onOpenHelp: () => helpModule.handleNavigation('guide-political-view', {
            returnFocus: () => getLayerChooserLauncher('worldViews')
        }),
        onGeometryChange: scheduleActiveAnchoredPopoverPosition
    });
    options.querySelector('[data-layer-id="political"]')?.after(politicalModeInfo.element);
    politicalReporting?.mountTooltipControl(options.querySelector('[data-layer-id="political"]'));
    for (const group of WORLD_VIEW_GROUPS) {
        const details = document.createElement('details');
        details.className = 'world-view-group';
        details.dataset.worldViewGroup = group.id;
        details.open = viewportComposition.getSnapshot().worldViewGroupsExpanded[group.id];
        const summary = document.createElement('summary');
        summary.textContent = group.title;
        details.append(summary);
        for (const choice of group.choices) {
            details.append(createLayerChoiceRow(choice.id, {
                radio: getLayerDescriptor(choice.id)?.kind === 'surface',
                choiceLabel: choice.label
            }));
        }
        summary.addEventListener('click', event => {
            event.preventDefault();
            const expanded = viewportComposition.getSnapshot().worldViewGroupsExpanded[group.id];
            viewportComposition.setWorldViewGroupExpanded(group.id, !expanded);
        });
        details.addEventListener('toggle', scheduleActiveAnchoredPopoverPosition);
        options.append(details);
    }
    appendLayerChoiceGroup(options, 'Debug', ['debugGrid']);
}

function createTownTypeDisclosure() {
    const details = document.createElement('details');
    details.className = 'town-type-filter-disclosure';
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.textContent = 'Town types';
    const count = document.createElement('span');
    count.className = 'town-type-filter-summary-count';
    count.dataset.townTypeSummary = '';
    summary.append(title, count);
    const choices = document.createElement('div');
    choices.className = 'town-type-filter-list';

    for (const descriptor of TOWN_TYPE_FILTERS) {
        const row = document.createElement('div');
        row.className = 'town-type-filter-row';
        row.dataset.townTypeKey = descriptor.key;
        row.dataset.layerOptionRow = '';
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `town-type-filter-${descriptor.key}`;
        const text = document.createElement('span');
        text.className = 'town-type-filter-label';
        text.textContent = descriptor.label;
        const occurrenceCount = document.createElement('span');
        occurrenceCount.className = 'town-type-filter-count';
        occurrenceCount.setAttribute('aria-label', 'Loaded map occurrences');
        label.htmlFor = input.id;
        label.append(input, text, occurrenceCount);
        row.append(label);
        input.addEventListener('change', event => {
            event.stopPropagation();
            const layer = townTypeLayers.get(descriptor.key);
            if (!layer) return;
            if (input.checked && !townLayer.hasLayer(layer)) townLayer.addLayer(layer);
            else if (!input.checked && townLayer.hasLayer(layer)) townLayer.removeLayer(layer);
            syncLayerFamilyControls();
            renderLayerPresentation();
        });
        choices.append(row);
    }
    details.append(summary, choices);
    details.addEventListener('toggle', scheduleActiveAnchoredPopoverPosition);
    return details;
}

function buildMapContentOptions(options) {
    options.append(createLayerGroupHeading('Locations'));
    options.append(createLayerChoiceRow('towns'));
    options.append(createTownTypeDisclosure());
    options.append(createLayerChoiceRow('nests'));
    appendLayerChoiceGroup(options, 'Names', ['regionLabels']);
    appendLayerChoiceGroup(options, 'Reference layers', ['landmarks', 'roads']);
    appendLayerChoiceGroup(options, 'Interpretation', ['relations']);
}

function syncLayerChoiceRow(row) {
    const descriptor = getLayerDescriptor(row.dataset.layerId);
    const input = row.querySelector('input');
    const label = row.querySelector('.layer-choice-label');
    const state = row.querySelector('.layer-choice-state');
    const badge = row.querySelector('.layer-choice-badge');
    if (!descriptor || !input || !label || !state) return;
    const available = descriptor.available && Boolean(descriptor.layer);
    input.disabled = !available;
    input.checked = available && isLayerDescriptorActive(descriptor);
    label.textContent = row.dataset.choiceLabel || descriptor.name;
    if (badge) badge.hidden = !descriptor.experimental;
    state.hidden = available;
    state.textContent = descriptor.id === 'political'
        ? politicalStatus === 'loading' ? 'Loading' : 'Unavailable'
        : spawnRasterStatus === 'loading' ? 'Loading' : 'Unavailable';
    row.classList.toggle('is-unavailable', !available);
    if (available) row.removeAttribute('title');
    else row.title = descriptor.unavailableReason;

    const settings = row.querySelector('.layers-row-settings-btn');
    if (settings) {
        const configurationReady = descriptor.configurationSubview === 'factionColors'
            ? available
            : available && map.hasLayer(descriptor.layer);
        const action = configurationReady
            ? `Configure ${descriptor.name}`
            : descriptor.configurationSubview === 'factionColors'
                ? `${descriptor.name} configuration is unavailable`
                : `Enable ${descriptor.name} to configure it`;
        settings.disabled = !configurationReady;
        settings.title = action;
        settings.setAttribute('aria-label', action);
    }
}

function syncWorldViewsOptions(options) {
    for (const row of options.querySelectorAll('.layer-choice-row')) syncLayerChoiceRow(row);
    const expanded = viewportComposition.getSnapshot().worldViewGroupsExpanded;
    for (const details of options.querySelectorAll('[data-world-view-group]')) {
        const open = expanded[details.dataset.worldViewGroup];
        if (details.open !== open) details.open = open;
    }
}

function syncMapContentOptions(options) {
    for (const row of options.querySelectorAll('.layer-choice-row')) syncLayerChoiceRow(row);
    const projection = getTownTypeProjection();
    const disclosure = options.querySelector('.town-type-filter-disclosure');
    const summary = options.querySelector('[data-town-type-summary]');
    if (disclosure) disclosure.hidden = projection.presentTypeCount === 0;
    if (summary) {
        summary.textContent = `${projection.enabledPresentCount} of ${projection.presentTypeCount}`;
    }
    for (const rowProjection of projection.rows) {
        const row = options.querySelector(`[data-town-type-key="${rowProjection.key}"]`);
        const input = row?.querySelector('input');
        const count = row?.querySelector('.town-type-filter-count');
        if (row) row.hidden = rowProjection.count === 0;
        if (input) input.checked = rowProjection.enabled;
        if (count) count.textContent = String(rowProjection.count);
    }
}

function initializeLayerControls() {
    if (layerControls.mapContent || !biomeLayer) return;
    refreshLayerDescriptors();
    if (spawnRasterStatus === 'ready' && !surfaceChoiceTouched) {
        activateWorldSurface(getLayerDescriptor('spawnAreas'));
    } else if (!getActiveWorldSurface() && !map.hasLayer(emptyLayer)) {
        map.addLayer(emptyLayer);
    }

    const popoverHost = document.getElementById('map-popover-host');
    if (!popoverHost) return;
    layerControls.mapContent = new PinnedLayerChooser({
        surface: 'mapContent',
        title: 'Map Content'
    });
    layerControls.worldViews = new PinnedLayerChooser({
        surface: 'worldViews',
        title: 'World Views'
    });
    for (const surface of LAYER_CHOOSER_SURFACES) {
        const control = layerControls[surface];
        const container = control.getContainer();
        popoverHost.appendChild(container);
        popoverResizeObserver?.observe(container);
        const launcher = getLayerChooserLauncher(surface);
        if (launcher) launcher.disabled = false;
    }
    syncLayerFamilyControls();
    renderAnchoredPopoverPresentation(
        appliedViewportComposition,
        viewportComposition.getSnapshot()
    );
    renderLayerPresentation();
}

function setSpawnRasterStatus(status) {
    spawnRasterStatus = status;
    if (!layerDescriptors) return;
    refreshLayerDescriptors();
    if (status === 'ready' && !surfaceChoiceTouched) {
        activateWorldSurface(getLayerDescriptor('spawnAreas'));
    }
    if (status === 'ready' && map.hasLayer(spawnLabelLayer)) renderSpawnLabels();
    if (status === 'ready' && map.hasLayer(spawnBorderLayer)) {
        const borderInput = document.getElementById('map-border-color');
        renderSpawnBorders(borderInput?.value ?? '#000000');
    }
}

/**
 * Renders the heatmap for a specific config profile.
 * Supports both Resource (numeric) and Weather (binary) modes.
 */
function renderDataOverlay(id) {
    const config = DATA_LAYERS[id];
    if (!config) return;

    if (config.layer.getLayers().length > 0) return;

    if (!window.decodedTgaData || !colorToAreaMap) {
        console.warn("Map data not ready yet.");
        return;
    }

    console.log(`Rendering overlay: ${id}`);

    const activeColorKeys = new Map(); 

    colorToAreaMap.forEach((area, colorKey) => {
        // --- 1. FILTER: The Void Fix ---
        // Exclude the default 'None' area which has fake fertility data
        if (area.StringId === "18003-gamedata.base") return; 

        let intensity = 0;

        // --- 2. BRANCH: Weather vs Resources ---
        if (config.isWeather) {
            // Weather Mode: Use the existing helper to check effects
            const effects = getWeatherEffectsForSpawnArea(area);
            if (effects.includes(config.match)) {
                intensity = 1.0; // Binary: It exists or it doesn't
            }
        } else {
            // Resource Mode: Look up values in the resource package
            const resRef = area.ReferenceCategories?.resources?.[0];
            const resData = resRef ? resourceDatabase[resRef.StringId] : null;
            if (resData) {
                intensity = resData.Values[config.key] || 0;
            }
        }

        // Store if valid
        if (intensity > 0) {
            activeColorKeys.set(colorKey, intensity);
        }
    });

    if (activeColorKeys.size === 0) return; 

    // Paint the Canvas (Standard Logic)
    const tga = window.decodedTgaData;
    const canvas = document.createElement('canvas');
    canvas.width = tga.width;
    canvas.height = tga.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(tga.width, tga.height);
    const pixels = imgData.data;
    const color = config.color;

    for (let y = 0; y < tga.height; y++) {
        for (let x = 0; x < tga.width; x++) {
            const srcIdx = ((tga.height - 1 - y) * tga.width + x) * 4;
            const key = `${tga.data[srcIdx]},${tga.data[srcIdx+1]},${tga.data[srcIdx+2]}`;
            
            const intensity = activeColorKeys.get(key);

            if (intensity !== undefined) {
                const destIdx = (y * tga.width + x) * 4;
                pixels[destIdx]   = color.r;
                pixels[destIdx+1] = color.g;
                pixels[destIdx+2] = color.b;
                pixels[destIdx+3] = 255 * (0.6 * intensity); 
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);

    const url = canvas.toDataURL();
    const bounds = [[0, 0], [mapHeight, mapWidth]];
    L.imageOverlay(url, bounds, { opacity: 1.0, interactive: false }).addTo(config.layer);
}

    /**
     * Loads the areasmap.tga file, decodes it, and logs the pixel data.
     * This is our initial test and debugging step for the spawn area feature.
     * @param {string} url - The URL of the .tga file to load.
     */
     async function loadAndProcessSpawnMap(url) {
         if (!url) {
             setSpawnRasterStatus('unavailable');
             narcoticProhibitionStatus = 'unavailable';
             narcoticProhibitionReason = 'Prohibition overlay requires the areas raster.';
             console.warn("No areasmap.tga URL provided. Skipping spawn map.");
             return;
         }

         console.log(`Fetching spawn map from: ${url}`);
         try {
             const response = await fetch(url);
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             const arrayBuffer = await response.arrayBuffer();

             // Use the correct global object and function name...
             const tgaData = tgaCodec.decodeTga(new Uint8Array(arrayBuffer));
             console.log("--- TGA DECODE SUCCESS ---");
             console.log(`Dimensions: ${tgaData.width} x ${tgaData.height}`);
             window.decodedTgaData = tgaData;
             try {
                 spawnAreaAnchorIndex = createSpawnAreaAnchorIndex({
                     raster: tgaData,
                     colorToAreaMap,
                     mapWidth,
                     mapHeight
                 });
                 renderSpawnOverlay(tgaData);
                 setSpawnRasterStatus('ready');
                 discoveryContextIndicatorStatus = 'ready';
                 synchronizeSelectionUI({ type: 'referenceData' });
                 renderBrowsePresentation();
                 scheduleDiscoveryContextIndicators();
             } catch (error) {
                 setSpawnRasterStatus('unavailable');
                 discoveryContextIndicatorStatus = 'unavailable';
                 renderBrowsePresentation();
                 console.error('Spawn Areas could not be initialized.', error);
             }
             try {
                 discoveryContextAreaIndex = createPoliticalAreaIndex({
                     raster: tgaData,
                     spawnAreas: scenarioBaseline?.spawnAreas ?? Object.values(spawnAreaDatabase)
                 });
                 narcoticProhibitionStatus = 'ready';
                 narcoticProhibitionReason = '';
                 refreshProspectingCatalog();
                 scheduleFactionOverviewOverlay();
                 renderBrowsePresentation();
                 scheduleNarcoticProhibition();
             } catch (error) {
                 discoveryContextAreaIndex = null;
                 narcoticProhibitionStatus = 'unavailable';
                 narcoticProhibitionReason = `Prohibition geography is unavailable: ${error.message}`;
                 refreshProspectingCatalog();
                 scheduleFactionOverviewOverlay();
                 renderBrowsePresentation();
                 console.error('Prohibition geography could not be initialized.', error);
             }
             initializePoliticalFoundation(tgaData, discoveryContextAreaIndex);
             refreshEnvironmentReports();
             renderReferencePresentation();

         } catch (error) {
             setSpawnRasterStatus('unavailable');
             discoveryContextIndicatorStatus = 'unavailable';
             discoveryContextAreaIndex = null;
             narcoticProhibitionStatus = 'unavailable';
             narcoticProhibitionReason = 'Prohibition overlay requires the areas raster, which could not be loaded.';
             refreshProspectingCatalog();
             scheduleFactionOverviewOverlay();
             renderBrowsePresentation();
             setPoliticalStatus(
                 'unavailable',
                 'Political View requires the areas raster, which could not be loaded.'
             );
             console.error("Failed to load or process the TGA file:", error);
             refreshEnvironmentReports();
             renderReferencePresentation();
         }
     }

    /**
     * Unpacks a Kenshi FCS color index (integer) into an RGB object.
     * @param {number} index - The integer value from spawn_area_data.json.
     * @returns {{r: number, g: number, b: number}} An object with R, G, B values.
     */
    function unpackFcsColor(index) {
        const r = (index >> 16) & 0xFF; // Shift right 16 bits for Red
        const g = (index >> 8) & 0xFF;  // Shift right 8 bits for Green
        const b = index & 0xFF;         // No shift for Blue
        return { r, g, b };
    }

    /**
     * Creates a lookup map that connects a color string (e.g., "155,20,0")
     * to its corresponding spawn area object.
     * @param {Array} spawnAreas - The array of spawn area objects from the API.
     * @returns {Map<string, object>} The color-to-area lookup map.
     */
    function buildColorToAreaMap(spawnAreas) {
        return createGeographicColorMap(spawnAreas);
    }

    /**
     * Takes decoded TGA pixel data and renders it as a semi-transparent
     * overlay on the Leaflet map.
     * @param {object} tgaData - The decoded TGA object { width, height, data }.
     */
    function renderSpawnOverlay(tgaData) {
        console.log("Rendering spawn area overlay...");

        const canvas = document.createElement('canvas');
        canvas.width = tgaData.width;
        canvas.height = tgaData.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(tgaData.width, tgaData.height);
        const pixels = imageData.data;

        // Use a nested loop to flip the image vertically while copying.
        for (let y = 0; y < tgaData.height; y++) {
            for (let x = 0; x < tgaData.width; x++) {
                // The destination index is a standard top-to-bottom read
                const destIndex = (y * tgaData.width + x) * 4;
                // The source index reads from the *bottom* row of the TGA data and moves up
                const srcIndex = ((tgaData.height - 1 - y) * tgaData.width + x) * 4;

                const r = tgaData.data[srcIndex];
                const g = tgaData.data[srcIndex + 1];
                const b = tgaData.data[srcIndex + 2];

                pixels[destIndex] = r;
                pixels[destIndex + 1] = g;
                pixels[destIndex + 2] = b;
                pixels[destIndex + 3] = (r === 0 && g === 0 && b === 0) ? 0 : 128;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const imageUrl = canvas.toDataURL();
        const bounds = [[0, 0], [mapHeight, mapWidth]];

        // Create the layer but DO NOT add it to the map by default.
        spawnAreaOverlay = L.imageOverlay(imageUrl, bounds, { opacity: 0.7 });
        
        console.log("Spawn area overlay successfully rendered.");
    }

    /**
     * Draws town occurrences and connects each marker to canonical selection.
     */
    function drawTownMarkers(locations) {
        if (!locations || !Array.isArray(locations)) return;
        const isInitialBuild = !initialTownMarkersRendered;
        if (isInitialBuild) markMapTiming('initial-markers-start');
        for (const layer of townTypeLayers.values()) layer.clearLayers();
        nestLayer.clearLayers();
        townMarkersByInstanceId.clear();
        const occurrenceTypes = [];

        const createIcon = (filename, isNest, scale = 1.0) => {
            const size = 32 * scale;
            const extraClass = isNest ? ' custom-nest-marker' : '';
            return L.divIcon({
                className: `custom-map-marker${extraClass}`,
                html: `<img src="${kenshiAssetUrl(`icons/${filename}`)}" alt="Location">`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size],
                popupAnchor: [0, -size]
            });
        };

        for (const location of locations) {
            if (location.TargetId === 'DELETED') continue;
            const townData = townDatabase[location.TargetId];
            if (!townData) continue;
            const resolvedTown = getCurrentTownData(townData.StringId);
            const activeTownData = resolvedTown?.finalState ?? townData;
            const mapCoords = convertKenshiCoordsToLeaflet(location.X, location.Z);
            let relationStatus = 'neutral';
            const factionId = activeTownData.ReferenceCategories?.faction?.[0]?.StringId;
            if (factionId && relationsStore.isAlly(factionId)) relationStatus = 'ally';
            else if (factionId && relationsStore.isEnemy(factionId)) relationStatus = 'enemy';

            const typeId = activeTownData.Values?.type ?? townData.Values?.type;
            const numericTypeId = Number(typeId);
            const config = Number.isInteger(numericTypeId) && TOWN_TYPE_CONFIG[numericTypeId]
                ? TOWN_TYPE_CONFIG[numericTypeId] : TOWN_TYPE_CONFIG.default;
            const isHiddenNest = isNestMarkerTownType(typeId);
            const townTypeKey = getTownTypeFilterKey(typeId);
            const targetLayer = isHiddenNest ? nestLayer : townTypeLayers.get(townTypeKey);
            if (!targetLayer) continue;
            occurrenceTypes.push(typeId);
            const marker = L.marker(mapCoords, { icon: createIcon(config.icon, isHiddenNest, config.scale) });
            marker.on('add', function() {
                const element = this.getElement();
                if (!element) return;
                element.setAttribute('data-relation', relationStatus);
                if (isPresenceTownType(typeId)) {
                    const release = locationReporting?.registerTownTarget(element, {
                        entityId: townData.StringId, instanceId: location.InstanceId
                    });
                    if (release) this.once('remove', release);
                }
                const selection = selectionSession?.getSelection();
                element.classList.toggle(
                    'selection-map-marker',
                    selection?.kind === 'entity' &&
                    selection.entityType === 'town' &&
                    selection.instanceId === location.InstanceId
                );
            });

            const popup = document.createElement('div');
            popup.className = 'kenshi-popup';
            const heading = document.createElement('p');
            heading.textContent = activeTownData.Name;
            const type = document.createElement('small');
            type.textContent = config.name;
            const actions = document.createElement('div');
            actions.className = 'popup-actions';
            const inspect = document.createElement('button');
            inspect.type = 'button';
            inspect.textContent = 'Open Context';
            inspect.addEventListener('click', () => {
                executeGeographicAction('inspect');
                map.closePopup();
            });
            const copy = document.createElement('button');
            copy.type = 'button';
            copy.textContent = 'Copy View';
            copy.addEventListener('click', () => void copyCurrentMapView(copy));
            actions.append(inspect, copy);
            popup.append(heading, type, actions);
            const townPopup = L.popup({
                className: 'custom-town-popup',
                offset: [0, -20 - 32 * (config.scale ?? 1)]
            }).setContent(popup);
            marker.on('click', (event) => {
                if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
                const selected = selectGeographicEntity(
                    'town',
                    townData.StringId,
                    location.InstanceId,
                    'map'
                );
                if (!selected) return;
                const state = viewportComposition.getSnapshot();
                if (state.phone) {
                    map.closePopup();
                    viewportComposition.openPhoneForeground('townCard');
                } else if (state.layoutClass !== 'narrow') {
                    map.closePopup();
                    executeGeographicAction('inspect');
                } else {
                    viewportComposition.hideInspector();
                    map.openPopup(townPopup, mapCoords);
                }
            });
            marker.addTo(targetLayer);
            townMarkersByInstanceId.set(location.InstanceId, marker);
        }
        townTypeOccurrenceTypes = Object.freeze(occurrenceTypes);
        syncLayerFamilyControls();
        renderLayerPresentation();
        if (isInitialBuild) {
            initialTownMarkersRendered = true;
            markMapTiming('initial-markers-complete');
            measureMapTiming(
                'initial marker rendering',
                'initial-markers-start',
                'initial-markers-complete'
            );
        }
        scheduleDiscoveryContextIndicators();
    }

    /** Reuse the passive wireframe image on activation; color input never rebuilds its geometry. */
    function createDebugGridLayer() {
        debugGridController ??= createDebugGridController({
            map, layer: debugGridLayer, leaflet: L, width: mapWidth, height: mapHeight
        });
        debugGridController.ensureOverlay(document.getElementById('map-debug-grid-color')?.value);
    }

    /**
     * Loads the static biomemap.png, creates the visual overlay, 
     * and extracts pixel data for tracking.
     */
    function loadBiomeMap() {
        console.log("Loading Biome Map...");
        //const imageUrl = "./data/overlays/biomemap.png"; // Assuming it is at root or 'data/biomemap.png'
	const imageUrl = kenshiAssetUrl('data/overlays/biomemap.png');
        const bounds = [[0, 0], [mapHeight, mapWidth]];

        // 1. Create the Visual Layer (Leaflet)
        // We do NOT addTo(map) here. The layer control will handle that.
        biomeLayer = L.imageOverlay(imageUrl, bounds, { opacity: 0.7 });

        // 2. Load Data for Tracking (Canvas)
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // Kenshi maps are often flipped in different formats. 
            // Unlike the TGA decoder which we flipped manually, PNGs usually display 'correctly' in browser.
            // If tracking is inverted Y-axis, we can flip the canvas context here.
            // For now, standard draw:
            ctx.drawImage(img, 0, 0);

            // Extract the raw pixel data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            biomePixelData = {
                width: canvas.width,
                height: canvas.height,
                data: imageData.data
            };
            
            // Build the lookup map using the API data we already have
            // We assume 'biomeDatabase' is populated by processBiomeData() [cite: 162]
            colorToBiomeMap = buildColorToBiomeMap(Object.values(biomeDatabase));
            
            // Refresh controls if they already exist, or simpler: 
            // relying on the async flow to init controls after all data is ready.
            console.log("Biome map data processed.");
            synchronizeSelectionUI({ type: 'referenceData' });
        };

        img.onerror = function(e) {
            console.error("Failed to load biomemap.png", e);
        };
    }

    /**
     * Maps RGB colors to Biome objects.
     */
    function buildColorToBiomeMap(biomes) {
        const map = new Map();
        if (!biomes) return map;

        biomes.forEach(biome => {
            // Biomes in Kenshi FCS usually have a 'mapcolor' or similar index.
            // Check your API response for 'Values.mapcolor' or 'Values.index'.
            // Falling back to 'Values.index' as per Spawn Area logic:
            if (biome.Values && typeof biome.Values.index !== 'undefined') {
                const color = unpackFcsColor(biome.Values.index); // Reuse existing helper 
                const colorKey = `${color.r},${color.g},${color.b}`;
                map.set(colorKey, biome);
            }
        });
        console.log("Built Color-to-Biome map:", map);
        return map;
    }

/**
 * Generates sharp outlines between different spawn zones.
 * Updated: Accepts custom hex color + Pixelated rendering.
 */
function renderSpawnBorders(hexColor = "#000000") {
    // Note: We REMOVED the "if (getLayers().length > 0)" check 
    // because we need to allow re-rendering when color changes.
    
    if (!window.decodedTgaData) return;
    spawnBorderLayer.clearLayers(); // Clear old borders if changing color

    console.log(`Generating Spawn Borders (${hexColor})...`);
    
    const tga = window.decodedTgaData;
    const canvas = document.createElement('canvas');
    canvas.width = tga.width;
    canvas.height = tga.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(tga.width, tga.height);
    const pixels = imgData.data;

    // Convert Hex to RGB
    const rVal = parseInt(hexColor.substr(1,2), 16);
    const gVal = parseInt(hexColor.substr(3,2), 16);
    const bVal = parseInt(hexColor.substr(5,2), 16);

    const getColor = (idx) => `${tga.data[idx]},${tga.data[idx+1]},${tga.data[idx+2]}`;
    
    for (let y = 0; y < tga.height; y++) {
        for (let x = 0; x < tga.width; x++) {
            const srcIdx = ((tga.height - 1 - y) * tga.width + x) * 4;
            const myColor = getColor(srcIdx);

            let isEdge = false;

            // Check neighbors (Right & Bottom)
            if (x < tga.width - 1) {
                const rightIdx = ((tga.height - 1 - y) * tga.width + (x + 1)) * 4;
                if (getColor(rightIdx) !== myColor) isEdge = true;
            }
            if (!isEdge && y < tga.height - 1) {
                const bottomIdx = ((tga.height - 1 - (y + 1)) * tga.width + x) * 4;
                if (getColor(bottomIdx) !== myColor) isEdge = true;
            }

            if (isEdge) {
                const destIdx = (y * tga.width + x) * 4;
                pixels[destIdx] = rVal;
                pixels[destIdx + 1] = gVal;
                pixels[destIdx + 2] = bVal;
                pixels[destIdx + 3] = 255; // Full Opacity for that "Inked" look
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    const url = canvas.toDataURL();
    const bounds = [[0, 0], [mapHeight, mapWidth]];
    
    // Apply the 'pixelated-overlay' class for sharpness
    L.imageOverlay(url, bounds, { 
        opacity: 0.8, 
        interactive: false,
        pane: 'referencePane',
        className: 'pixelated-overlay' 
    }).addTo(spawnBorderLayer);
}

/**
 * Calculates centroids for DISJOINT spawn areas (Connected Components).
 * Solves the "Arm of Okran" split issue.
 */
function renderSpawnLabels() {
    if (spawnLabelLayer.getLayers().length > 0) return;
    if (!spawnAreaAnchorIndex) return;

    console.log("Generating Smart Region Labels...");

    for (const component of spawnAreaAnchorIndex.components) {
        const areaData = spawnAreaDatabase[component.spawnAreaId];
        if (!areaData) continue;
        const label = document.createElement('span');
        label.textContent = areaData.Name;
        const textIcon = L.divIcon({
            className: 'region-nameplate',
            html: label,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
        });
        L.marker(component.leafletAnchor, { icon: textIcon, interactive: false })
            .addTo(spawnLabelLayer);
    }
}

function loadRoadNetwork() {
    if (roadNetworkLoadPromise) return roadNetworkLoadPromise;
    if (!roadNetworkUrl) return Promise.resolve(false);
    console.log('Fetching and mounting road network:', roadNetworkUrl);
    markMapTiming('optional-road-start');
    roadNetworkLoadPromise = fetch(roadNetworkUrl, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error(`Road network request failed: ${response.status}.`);
            return response.text();
        })
        .then(svgText => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = doc.documentElement;
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            svgElement.removeAttribute('id');
            svgElement.classList.add('road-network-overlay');
            svgElement.setAttribute('viewBox', '-285 -40 8640 8430');
            svgElement.setAttribute('preserveAspectRatio', 'none');
            const roadOverlay = L.svgOverlay(svgElement, [[0, 0], [mapHeight, mapWidth]], {
                opacity: 0.8,
                interactive: false,
                pane: 'referencePane'
            });
            roadLayer.clearLayers();
            roadLayer.addLayer(roadOverlay);
            console.log('Road network mounted with calibrated alignment.');
            markMapTiming('optional-road-complete');
            measureMapTiming(
                'optional road hydration',
                'optional-road-start',
                'optional-road-complete'
            );
            return true;
        });
    return roadNetworkLoadPromise;
}

function loadLandmarksBackground() {
    if (landmarksLoadPromise) return landmarksLoadPromise;
    console.log("Background fetching landmarks...");
    markMapTiming('optional-landmarks-start');

    landmarksLoadPromise = Promise.all([
        fetch(kenshiAssetUrl('data/overlays/features_refined.json')).then(r => r.json()),
        fetch(kenshiAssetUrl('data/overlays/fog_features_clean.json')).then(r => r.json()),
        // Fetch the whitelist
        fetch(kenshiAssetUrl('data/overlays/landmarks_whitelist.json')).then(r => r.json())
    ])
    .then(([features, fog, whitelist]) => {
        landmarkCatalog = initLandmarksModule({ features, fog, whitelist, layer: landmarkLayer, onInspect: showLandmarkInspection });
        
        console.log("Landmarks data populated.");
        markMapTiming('optional-landmarks-complete');
        measureMapTiming(
            'optional landmark hydration',
            'optional-landmarks-start',
            'optional-landmarks-complete'
        );
    })
    .catch(err => {
        console.warn("Landmark load skipped:", err);
        throw err;
    });
    return landmarksLoadPromise;
}

    /**
     * Converts Kenshi's world coordinates to Leaflet's pixel-based Lat/Lng.
     */
    function convertKenshiCoordsToLeaflet(kenshiX, kenshiZ) {
        const worldSize = kenshiMaxCoord - kenshiMinCoord;
        const percentX = (kenshiX - kenshiMinCoord) / worldSize;
        const percentZ = (kenshiZ - kenshiMinCoord) / worldSize;
        return L.latLng(mapHeight * (1 - percentZ), mapWidth * percentX);
    }

/**
 * Universal Drag Logic
 * Applies strictly generic dragging to any absolute positioned element via a header handle.
 * UPDATED: Includes mobile guard (<= 1024px) to prevent dragging on tablets/phones.
 */
function makeElementDraggable(elementOrId, headerOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    const header = typeof headerOrId === 'string' ? document.getElementById(headerOrId) : headerOrId;

    if (!el || !header) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
        // --- 1. MOBILE GUARD ---
        // Don't allow dragging if the screen is effectively a tablet or phone
        if (window.innerWidth <= 1024) return;

        // --- 2. BUTTON GUARD ---
        // Prevent dragging if clicking buttons (like Minimize or Close) inside the header
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // CRITICAL: Calculate position relative to the offset parent
        // This locks the element to specific pixel coordinates, overriding CSS anchoring
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;

        el.style.left = `${initialLeft}px`;
        el.style.top = `${initialTop}px`;
        el.style.bottom = 'auto';
        el.style.right = 'auto';
        
        header.style.cursor = 'grabbing';

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    function onMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = `${initialLeft + dx}px`;
        el.style.top = `${initialTop + dy}px`;
    }

    function onUp() {
        isDragging = false;
        header.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
}

    // --- Initial Kick-off ---
    void initializeMap().catch(error => {
        console.error('Map readiness failed before application initialization.', error);
        showInitializationError(error);
    });
    makeElementDraggable('player-marker-panel', 'player-marker-panel-header');
});
