import { createLocationReportingController } from "../../modules/viewport/location-reporting.js";
import { createLocationReportSubjects } from "../../modules/viewport/location-report-subjects.js";
/* global document, requestAnimationFrame, window */
import { createPoliticalFixture } from "../fixtures/political-fixture.js";
import { createEnvironmentFixture } from "../fixtures/environment-fixture.js";
import { createEnvironmentReports } from "../../modules/viewport/environment-reporting.js";
import {
  createPoliticalAreaIndex,
  createPoliticalEvidenceCatalog,
  projectPoliticalEvidence,
  evaluatePoliticalInfluence,
  createPoliticalReports,
  POLITICAL_VIEW_POLICY
} from "../../modules/political/index.js";
import { createScannerReading, createScannerView } from "../../modules/viewport/scanner.js";
import { positionScannerWorkspace } from "../../modules/viewport/scanner-placement.js";
import { createPoliticalReportingController } from "../../modules/viewport/political-reporting.js";
import { ViewportCompositionSession } from "../../stores/viewport-composition-session.js";
import { classifyViewportLayout } from "../../modules/viewport/layout.js";
import { createUsableMapBounds } from "../../modules/viewport/anchored-popover.js";
import { WindowManager } from "../../modules/window-manager.js";
import { THEATER_DESTINATIONS, THEATER_DESTINATION_GROUPS } from "../../modules/top-bar/model.js";

const fixture = createPoliticalFixture();
const areaIndex = createPoliticalAreaIndex({
  raster: fixture.raster,
  spawnAreas: fixture.baseline.spawnAreas
});
const catalog = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex });
const projection = structuredClone(
  projectPoliticalEvidence({ catalog, snapshot: fixture.snapshot })
);
const geometry = projection.geometries.find((area) => area.key === "255,0,0");
const town = geometry.records.find((record) => record.kind === "town");
projection.geometries = [geometry];
projection.factions = Array.from({ length: 24 }, (_, index) => ({
  id: `fixture-${String(index).padStart(2, "0")}`,
  name:
    index === 0
      ? '<img src=x onerror="fixture"> Long custom faction & evidence'
      : `Long custom faction ${index} ${"Unbroken".repeat(6)}`
}));
geometry.areaNames = [
  "Shared <img src=x> area",
  "A very long second area identity for disconnected components"
];
geometry.records = projection.factions.map((faction, index) => ({
  ...town,
  id: `town-${index}`,
  factionId: faction.id,
  metrics: { ...town.metrics, residentReferences: { valid: true, value: 25 - index } }
}));
let colors = Object.fromEntries(projection.factions.map(({ id }) => [id, "#ac8545"]));
let reports;
let failed = false;
let active = false;
let suppressed = false;
let navigation = null;
let colorNavigation = null;
let colorAvailable = true;
let reportOverride;
let lookupCount = 0;
const environmentFixture = createEnvironmentFixture();
const environmentReports = createEnvironmentReports(environmentFixture);
let environmentAvailable = true;
let environmentPoint = environmentFixture.points.shared;
const callbacks = new Map();
const mapNode = document.getElementById("map-container");
const workspace = document.getElementById("map-workspace");
const container = document.getElementById("world-tracker");
const session = new ViewportCompositionSession({ dockOpen: false });
const sheet = document.getElementById("unified-dock");
const windowManager = new WindowManager();
windowManager.configureNavigation({
  groups: THEATER_DESTINATION_GROUPS,
  destinations: THEATER_DESTINATIONS
});
for (const id of ["environment", "ranks"])
  windowManager.register(id, id, document.getElementById(`fixture-${id}`));
const scanner = createScannerView(container);
const scannerInput = {
  spawnArea: { Name: "Shared <img src=x> area" },
  biome: { Name: "Fixture biome" },
  resources: {
    Values: {
      arid: 1,
      green: 0,
      swamp: 0.4,
      "copper mult": 1,
      "iron mult": 1,
      "stone mult": 0,
      "water mult": 2
    }
  },
  effects: ["Acidic Ground", "Acid Rain", "Duststorm"]
};
scanner.setCoordinates({ x: 123, z: 456, inBounds: true });
scanner.setArea(createScannerReading(scannerInput));
let geometryFrame;
const position = () => {
  geometryFrame = null;
  positionScannerWorkspace({
    workspace,
    root: document.getElementById("viewport-workbench"),
    hud: document.getElementById("workbench-hud-region"),
    container,
    cluster: document.getElementById("map-control-cluster"),
    state: session.getSnapshot(),
    getUsableBounds: () =>
      createUsableMapBounds({
        workspaceRect: workspace.getBoundingClientRect(),
        occlusions: sheet.hidden ? [] : [sheet.getBoundingClientRect()]
      })
  });
};
const schedulePosition = () => {
  if (geometryFrame == null) geometryFrame = requestAnimationFrame(position);
};
const geometryObserver = new window.ResizeObserver(schedulePosition);
for (const node of [container, container.querySelector("#wt-table"), sheet])
  geometryObserver.observe(node);

const map = {
  on(names, fn) {
    for (const name of names.split(" ")) {
      const handlers = callbacks.get(name) ?? [];
      handlers.push(fn);
      callbacks.set(name, handlers);
    }
  },
  getContainer: () => mapNode
};
const emit = (name, event = {}) => {
  for (const fn of callbacks.get(name) ?? []) fn(event);
};
const rebuild = (participantIds = projection.factions.map(({ id }) => id)) => {
  reports = createPoliticalReports({
    projection,
    influence: evaluatePoliticalInfluence({
      projection,
      participantIds,
      ...POLITICAL_VIEW_POLICY
    })
  });
};
rebuild();
const widget = createPoliticalReportingController({
  container,
  session,
  getPoliticalState: () => ({
    active,
    reports: failed ? null : reports,
    colors,
    canNavigate: true
  }),
  getReportAtPoint: () => {
    lookupCount += 1;
    return failed ? null : reportOverride === undefined ? reports.areas[0] : reportOverride;
  },
  onFaction: (id) => {
    navigation = id;
  },
  onFactionColor: (id) => {
    colorNavigation = id;
  },
  getFactionColorAvailability: () => ({
    available: colorAvailable,
    reason: "Fixture configuration unavailable."
  }),
  getTheaterAvailability: (id) => windowManager.getAvailability(id),
  onOpenTheater: (id, returnFocus) => windowManager.open(id, { returnFocus }),
  onResize: schedulePosition
});
const location = createLocationReportingController({
  map,
  workspace,
  session,
  subjects: createLocationReportSubjects({
    getPoliticalState: () => ({ active, reports: failed ? null : reports, colors }),
    getPoliticalReport: () => {
      lookupCount += 1;
      return failed ? null : reportOverride === undefined ? reports.areas[0] : reportOverride;
    },
    getEnvironmentState: () => ({
      available: environmentAvailable,
      reason: environmentAvailable ? null : "Environmental geography is loading."
    }),
    getEnvironmentReport: () => environmentReports.getReportAtPoint(environmentPoint)
  }),
  toPoint: (point) => point,
  getBounds: () => workspace.getBoundingClientRect(),
  isSuppressed: () =>
    suppressed ||
    windowManager.isOpen() ||
    session.getSnapshot().transientSurface === "cursorControls",
  onPointer: (point) => widget.setHoverPoint(point)
});
const controller = {
  ...widget,
  ...location,
  refresh() {
    widget.refresh();
    location.refresh();
  },
  reset() {
    widget.reset();
    location.reset();
    location.attachProbe(popup, { x: 123, z: 456 }, document.getElementById("probe-slot"));
  }
};
const popup = {
  options: { offset: [0, 0], autoPan: true },
  isOpen: () => false,
  on: () => {},
  update: () => {}
};
controller.attachProbe(popup, { x: 123, z: 456 }, document.getElementById("probe-slot"));
controller.mountTooltipControl(document.getElementById("tooltip-anchor"));
session.subscribe(() => {
  const state = session.getSnapshot();
  sheet.hidden = !state.effective.dockVisible || state.layoutClass !== "narrow";
  document.getElementById("viewport-workbench").dataset.activeSheet =
    state.narrowActiveSheet ?? "none";
  document.getElementById("viewport-workbench").dataset.focusMap = String(
    session.getSnapshot().focusMap
  );
  controller.refresh();
});
function resizeFixture() {
  const layout = classifyViewportLayout(window.innerWidth, window.innerHeight);
  session.setLayoutClass(layout.layoutClass, layout.short);
  document.getElementById("viewport-workbench").dataset.layoutClass = layout.layoutClass;
  schedulePosition();
}
window.addEventListener("resize", resizeFixture);
resizeFixture();
document.getElementById("wt-toggle").onclick = () => {
  const state = session.getSnapshot();
  session.setHudExpanded(state.hudMode, !state[`${state.hudMode}Expanded`]);
};
function activate(value) {
  active = value;
  if (active) session.activatePoliticalReports();
  else session.setHudMode("scanner");
  controller.refresh();
}
function hover() {
  const rect = workspace.getBoundingClientRect();
  emit("mousemove", {
    latlng: { x: 123, z: 456 },
    originalEvent: { target: mapNode, clientX: rect.right - 20, clientY: rect.top + 20 }
  });
}
const frame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
document.getElementById("fixture-activate").onclick = () => activate(!active);
document.getElementById("fixture-hover").onclick = hover;
document.getElementById("fixture-scenario").onclick = () => {
  geometry.records[0].metrics.residentReferences.value += 25;
  rebuild();
  controller.refresh();
};
document.getElementById("fixture-fail").onclick = () => {
  failed = !failed;
  controller.refresh();
};
document.getElementById("fixture-theme").onclick = () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
};

document.getElementById("fixture-subject").onchange = (event) => {
  const subject = event.target.value;
  session.setReportingSubject("tooltips", subject);
  session.setReportingSubject("pointProbe", subject);
  session.setReportTooltipMode(subject, "full");
  session.setReportProbeExpanded(subject, true);
};
document.getElementById("fixture-sheet").onclick = () =>
  sheet.hidden ? session.showDock() : session.hideDock();
document.getElementById("fixture-sheet-close").onclick = () => session.hideDock();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (windowManager.isOpen()) windowManager.close();
    else controller.dismissHover();
  }
});

async function checkRibbons(check) {
  const title = container.querySelector(".wt-title");
  const ribbon = container.querySelector("#wt-summary");
  const area = ribbon.querySelector(".wt-ribbon-primary");
  const coordinateRow = ribbon.querySelector(".wt-ribbon-coordinates");
  const coordinates = [...ribbon.querySelectorAll(".wt-ribbon-coordinate")];
  const visible = (node) =>
    node.getBoundingClientRect().width > 0 && window.getComputedStyle(node).visibility !== "hidden";
  const fits = (node) => node.scrollWidth <= node.clientWidth + 1;
  const compactHeader = () => {
    const header = container.querySelector(".wt-header").getBoundingClientRect();
    const center = container.querySelector(".wt-heading").getBoundingClientRect();
    return (
      [...container.querySelectorAll(".wt-header-button")].filter(visible).every((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.top >= header.top &&
          rect.bottom <= header.bottom + 1 &&
          rect.left >= header.left &&
          rect.right <= header.right + 1
        );
      }) &&
      header.height === 56 &&
      center.height === 56 &&
      [...container.querySelectorAll(".wt-wing")].every((wing) => {
        const rect = wing.getBoundingClientRect();
        return Math.abs(rect.top + rect.height / 2 - center.top - center.height / 2) < 1;
      }) &&
      container.scrollWidth <= container.clientWidth
    );
  };
  const twoRows = (summary) => {
    const [top, bottom] = [...summary.children].map((row) => row.getBoundingClientRect());
    return top.height === bottom.height && top.height === 27 && top.bottom === bottom.top;
  };
  const mapGaps = () => {
    const [left, center, right] = [...container.querySelector(".wt-header").children].map((node) =>
      node.getBoundingClientRect()
    );
    return (
      center.left - left.right === 4 &&
      right.left - center.right === 4 &&
      [left.right + 2, center.right + 2].every(
        (x) => document.elementFromPoint(x, center.top + center.height / 2) === mapNode
      )
    );
  };
  check(
    !visible(title) && visible(container.querySelector(".wt-identity-scanner")),
    "collapsed Scanner uses icon instead of title"
  );
  check(
    ribbon.querySelectorAll(".wt-ribbon-box").length === 3,
    "Scanner has exactly X, Z and spawn-area boxes"
  );
  scanner.setCoordinates({ x: -147456, z: 147455, inBounds: true });
  await frame();
  check(
    coordinates.map((box) => box.textContent).join("|") === "X:-147456|Z:147455",
    "complete signed boundary coordinates in compact boxes"
  );
  check(
    coordinates.every(
      (box) => !visible(box) || fits(box.querySelector(".wt-ribbon-coordinate-value"))
    ),
    "visible compact coordinate values are never clipped"
  );
  if (container.getBoundingClientRect().width >= 399)
    check(
      coordinateRow.dataset.fit === "full",
      "ordinary desktop Scanner fits complete coordinates"
    );
  check(
    twoRows(ribbon) && compactHeader(),
    "Scanner uses two equal rows with centered control wings"
  );
  const coordinateRect = coordinates[0].getBoundingClientRect();
  const firstLabel = coordinates[0].firstChild.getBoundingClientRect();
  const firstValue = coordinates[0].lastChild.getBoundingClientRect();
  check(
    !visible(coordinates[0]) ||
      (Math.abs(
        (firstLabel.left + firstValue.right) / 2 - coordinateRect.left - coordinateRect.width / 2
      ) < 1 &&
        Math.abs(coordinates[1].getBoundingClientRect().width - coordinateRect.width) < 1),
    "equal coordinate cells center each complete label/value pair"
  );
  scanner.setArea(
    createScannerReading({ ...scannerInput, spawnArea: { Name: "VeryLong<Area>".repeat(20) } })
  );
  await frame();
  check(
    area.title.includes("VeryLong<Area>".repeat(20)) &&
      window.getComputedStyle(area.firstChild).textOverflow === "ellipsis" &&
      compactHeader(),
    "long compact area retains full description in a bounded second row"
  );
  check(coordinates[0] === ribbon.querySelector(".wt-ribbon-coordinate"), "summary DOM is reused");
  activate(true);
  session.setHudMode("scanner");
  session.setHudExpanded("scanner", false);
  container.style.maxWidth = "300px";
  await frame();
  check(
    area.dataset.fit !== "hidden" && visible(coordinates[0]) === visible(coordinates[1]),
    "tight Scanner fits the area independently and never splits coordinates"
  );
  container.style.maxWidth = "190px";
  await frame();
  check(
    coordinateRow.dataset.fit === "hidden" && area.dataset.fit === "hidden" && compactHeader(),
    "smallest Scanner keeps icon and all controls"
  );
  container.style.removeProperty("max-width");
  session.setHudMode("scorecard");
  session.setHudExpanded("scorecard", false);
  await frame();
  const scoreRibbon = container.querySelector(".wt-score-summary");
  const lead = scoreRibbon.querySelector(".wt-ribbon-primary");
  const share = lead.querySelector(".wt-ribbon-share");
  const ranked = scoreRibbon.querySelector(".wt-ribbon-count");
  const rankedValue = ranked.querySelector(".wt-ribbon-count-value");
  check(
    !visible(title) &&
      visible(container.querySelector(".wt-identity-scorecard")) &&
      scoreRibbon.querySelectorAll(".wt-ribbon-box").length === 2,
    "collapsed Scorecard uses swords and two summary boxes"
  );
  check(
    lead.title.includes(reports.scorecard.rows[0].name) &&
      lead.title.includes("scored evidence") &&
      rankedValue.textContent === "24" &&
      ranked.querySelector(".wt-ribbon-scope").textContent === "Global:",
    "Scorecard summary matches included ranking and share meaning"
  );
  container.style.maxWidth = "300px";
  await frame();
  check(
    lead.dataset.fit === "compact" &&
      ranked.dataset.fit === "compact" &&
      visible(share) &&
      fits(share) &&
      lead.querySelector(".wt-ribbon-name").scrollWidth >
        lead.querySelector(".wt-ribbon-name").clientWidth &&
      window.getComputedStyle(lead.querySelector(".wt-ribbon-verb")).display === "none" &&
      window.getComputedStyle(ranked.querySelector(".wt-ribbon-count-noun")).display === "none",
    "tight Scorecard shortens both rows independently and preserves the full share"
  );
  container.style.maxWidth = "190px";
  await frame();
  check(
    lead.dataset.fit === "hidden" &&
      ranked.dataset.fit === "hidden" &&
      compactHeader() &&
      twoRows(scoreRibbon),
    "smallest Scorecard keeps icon and controls"
  );
  container.style.removeProperty("max-width");
  // The independent probe fixture can cover the left corner at short heights.
  const probeFixture = document.getElementById("fixture-probe");
  probeFixture.hidden = true;
  for (const anchor of ["left", "right"]) {
    session.setHudAnchor(anchor);
    await frame();
    container.scrollIntoView({ block: "nearest" });
    check(mapGaps(), "both transparent gaps target ordinary map space in either corner");
    check(
      compactHeader() && twoRows(scoreRibbon),
      "two-line Scorecard retains shape in either corner"
    );
  }
  probeFixture.hidden = false;
  const retainedButtons = [...container.querySelectorAll(".wt-header-button")];
  const retainedRows = [...scoreRibbon.children];
  const disclosure = document.getElementById("wt-toggle");
  disclosure.focus({ preventScroll: true });
  disclosure.click();
  await frame();
  check(
    visible(title) && !visible(scoreRibbon) && document.activeElement === disclosure,
    "expansion restores full title and retains disclosure focus"
  );
  const expandedWidth = container.getBoundingClientRect().width;
  disclosure.click();
  await frame();
  check(
    container.getBoundingClientRect().width === expandedWidth &&
      retainedButtons.every(
        (node, index) => node === container.querySelectorAll(".wt-header-button")[index]
      ) &&
      retainedRows.every((node, index) => node === scoreRibbon.children[index]),
    "expansion retains width, controls and summary nodes"
  );
  const priorValue = geometry.records[1].metrics.residentReferences.value;
  geometry.records[1].metrics.residentReferences.value =
    geometry.records[0].metrics.residentReferences.value;
  rebuild();
  controller.refresh();
  check(
    lead.querySelector(".wt-ribbon-name").textContent === "2 tied" &&
      lead.title.includes("Tied leading included"),
    "exact leading tie reports count and shared percentage"
  );
  geometry.records[1].metrics.residentReferences.value -= 1e-8;
  rebuild();
  controller.refresh();
  check(
    lead.querySelector(".wt-ribbon-name").textContent !== "2 tied",
    "display rounding does not create a leading tie"
  );
  geometry.records[1].metrics.residentReferences.value = priorValue;
  rebuild(projection.factions.slice(1).map(({ id }) => id));
  controller.refresh();
  check(
    !lead.title.includes(projection.factions[0].name) &&
      rankedValue.textContent === "23" &&
      reports.scorecard.outside.score > 0 &&
      lead.title.includes("Leading included faction"),
    "hidden top evidence stays outside the explicitly included ranking"
  );
  rebuild([]);
  controller.refresh();
  check(
    lead.querySelector(".wt-ribbon-name").textContent === "No ranked factions" &&
      rankedValue.textContent === "0",
    "outside-only evidence has an explicit empty included ranking"
  );
  failed = true;
  controller.refresh();
  check(
    lead.querySelector(".wt-ribbon-name").textContent === "Unavailable" &&
      rankedValue.textContent === "—",
    "unavailable summary never presents a zero or stale leader"
  );
  failed = false;
  rebuild();
  controller.refresh();
  for (const mode of ["scanner", "scorecard"]) {
    session.setHudMode(mode);
    session.setHudExpanded(mode, false);
    await frame();
    const artwork = container.querySelector(`.wt-identity-${mode}`);
    const wasLoaded = artwork.dataset.loaded === "true";
    artwork.querySelector("img").dispatchEvent(new window.Event("error"));
    check(
      visible(artwork.querySelector(".wt-artwork-fallback")) &&
        artwork.getBoundingClientRect().width === 24 &&
        compactHeader() &&
        container.getAttribute("aria-label") ===
          (mode === "scanner" ? "Scanner" : "Political Scorecard"),
      "failed identity artwork preserves fallback, accessible identity and control geometry"
    );
    if (wasLoaded) artwork.querySelector("img").dispatchEvent(new window.Event("load"));
  }
  session.reset();
  session.hideDock();
  activate(false);
  scanner.setCoordinates({ x: 123, z: 456, inBounds: true });
  scanner.setArea(createScannerReading(scannerInput));
  await frame();
}
async function checkNavigationPolish(check) {
  activate(true);
  const body = document.getElementById("political-scorecard-body");
  const scannerBody = document.getElementById("wt-details");
  const images = [...scannerBody.querySelectorAll(".wt-warning-artwork img")];
  for (const image of images) image.dispatchEvent(new window.Event("load"));
  await frame();
  check(
    images.every((image) => window.getComputedStyle(image).visibility === "hidden"),
    "loaded warning images cannot override inactive Scanner visibility"
  );
  const height = body.getBoundingClientRect().height;
  session.setHudMode("scanner");
  session.setHudExpanded("scanner", true);
  await frame();
  check(
    images.every((image) => window.getComputedStyle(image).visibility === "visible"),
    "loaded warnings return only with expanded Scanner"
  );
  check(
    Math.abs(height - scannerBody.getBoundingClientRect().height) < 1,
    "warning visibility does not change the sizing reference"
  );
  session.setHudMode("scorecard");
  for (const image of images) {
    image.dispatchEvent(new window.Event("error"));
    image.dispatchEvent(new window.Event("load"));
  }
  check(
    images.every((image) => window.getComputedStyle(image).visibility === "hidden"),
    "late warning load beneath Scorecard stays hidden"
  );
  const colorButton = body.querySelector("[data-political-color]");
  colorNavigation = navigation = null;
  colorButton.click();
  check(
    colorNavigation === "fixture-00" && navigation === null,
    "swatch routes exact ID independently of reference inspection"
  );
  check(
    colorButton.getAttribute("aria-label").startsWith("Configure ") &&
      colorButton.title.includes(" color"),
    "swatch has a labelled configuration action"
  );
  body.scrollTop = 120;
  colorButton.focus({ preventScroll: true });
  colors = { ...colors, "fixture-00": "#991122" };
  controller.refresh();
  check(
    body.scrollTop === 120 && document.activeElement.dataset.politicalColor === "fixture-00",
    "palette update retains swatch focus rather than switching to the name"
  );
  body.querySelector("[data-political-faction]").click();
  check(navigation === "fixture-00", "name still opens exact reference root");
  colorAvailable = false;
  controller.refresh();
  check(
    body.querySelector("[data-political-color]").disabled &&
      !body.querySelector("[data-political-faction]").disabled,
    "configuration and reference availability are independent"
  );
  colorAvailable = true;
  controller.refresh();
  session.setHudExpanded("scorecard", false);
  session.setPoliticalTooltipMode("hidden");
  hover();
  await frame();
  const ribbon = container.querySelector(".wt-score-summary");
  const lead = ribbon.querySelector(".wt-ribbon-primary");
  const name = ribbon.querySelector(".wt-ribbon-name");
  const scope = ribbon.querySelector(".wt-ribbon-scope");
  const count = ribbon.querySelector(".wt-ribbon-count-value");
  const retainedFirstRow = body.firstChild;
  check(
    scope.textContent === "Local:" && lead.title.includes(reports.areas[0].title),
    "Hidden tooltip still permits local ribbon with complete shared-area description"
  );
  check(
    document.getElementById("location-hover-report").hidden,
    "local ribbon does not turn Hidden tooltip on"
  );
  const local = reports.areas[0];
  reportOverride = {
    ...local,
    status: "dominant",
    outcomeLabel: "Dominant",
    leaders: [{ label: "The Holy Nation", score: 100, share: 0.625 }],
    rows: local.rows.slice(0, 1)
  };
  hover();
  await frame();
  check(
    count.textContent === "1" &&
      ribbon.querySelector(".wt-ribbon-count-noun").textContent === "faction" &&
      name.textContent === "The Holy Nation" &&
      lead.querySelector(".wt-ribbon-share").textContent === "62.5%" &&
      lead.querySelector(".wt-ribbon-verb").textContent === "leads with",
    "singular local count and leader sentence use the report-provided share"
  );
  if (container.getBoundingClientRect().width >= 399)
    check(
      lead.dataset.fit === "full",
      "ordinary leader line uses the complete leads-with wording when it fits"
    );
  container.style.maxWidth = "300px";
  await frame();
  check(
    lead.dataset.fit === "compact" &&
      window.getComputedStyle(lead.querySelector(".wt-ribbon-verb")).display === "none" &&
      window.getComputedStyle(lead.querySelector(".wt-ribbon-separator")).display !== "none" &&
      lead.title.includes("62.5% of local scored evidence"),
    "leader drops leads-with before ellipsizing its name, retaining full share meaning"
  );
  container.style.removeProperty("max-width");
  reportOverride = {
    ...local,
    status: "filtered",
    outcomeLabel: "Filtered",
    leaders: [{ label: "Outside visible roster", score: 100, share: 0.8 }],
    rows: local.rows.slice(0, 3)
  };
  hover();
  await frame();
  check(
    name.textContent === "Outside visible roster" && count.textContent === "3",
    "local concealed leader and local included count do not reuse global ranks"
  );
  check(
    lead.querySelector(".wt-ribbon-share").textContent === "80%",
    "local share comes from report denominator"
  );
  check(body.firstChild === retainedFirstRow, "pointer changes never rebuild expanded scorecard");
  controller.dismissHover();
  check(scope.textContent === "Local:", "Escape dismissal leaves local tracking intact");
  reportOverride = {
    ...reportOverride,
    status: "disputed",
    outcomeLabel: "Disputed",
    leaders: [
      { label: "One", score: 3, share: 0.4 },
      { label: "Outside visible roster", score: 3, share: 0.4 }
    ]
  };
  hover();
  await frame();
  check(name.textContent === "Tied leaders", "exact local tie selects no faction");
  check(
    lead.querySelector(".wt-ribbon-verb").textContent === "·",
    "local ties never claim a single leader"
  );
  reportOverride = {
    ...local,
    status: "unattributed",
    outcomeLabel: "Unattributed",
    leaders: [{ label: "Unattributed", score: 100, share: 0.9 }]
  };
  hover();
  await frame();
  check(
    name.textContent === "Unattributed" &&
      lead.querySelector(".wt-ribbon-share").textContent === "90%",
    "unattributed local evidence retains its identity and full-denominator share"
  );
  for (const [status, label, expectedCount] of [
    ["noEvidence", "No current evidence", "0"],
    ["excluded", "Excluded area", "0"],
    ["indeterminate", "Indeterminate", "—"],
    ["unavailable", "Unavailable", "—"]
  ]) {
    reportOverride = { ...local, status, outcomeLabel: status, rows: [], leaders: [] };
    hover();
    await frame();
    check(
      scope.textContent === "Local:" &&
        name.textContent === label &&
        count.textContent === expectedCount,
      `local ${status} is explicit rather than replaced by global leader`
    );
  }
  reportOverride = undefined;
  for (const event of ["mouseout", "movestart", "zoomstart", "popupopen"]) {
    hover();
    await frame();
    emit(event);
    check(scope.textContent === "Global:", `${event} clears local scope`);
    emit("moveend");
    emit("zoomend");
  }
  for (const target of [
    document.getElementById("wt-window"),
    Object.assign(document.createElement("div"), { className: "leaflet-marker-icon" })
  ]) {
    if (!target.isConnected) mapNode.append(target);
    hover();
    await frame();
    target.dispatchEvent(new window.PointerEvent("pointermove", { bubbles: true }));
    check(
      scope.textContent === "Global:",
      "controls and interactive markers restore map-wide scope"
    );
    if (target.parentElement === mapNode) target.remove();
  }
  hover();
  await frame();
  suppressed = true;
  controller.refresh();
  check(scope.textContent === "Global:", "theater and gesture suppression clears local ribbon");
  suppressed = false;
  controller.refresh();
  check(scope.textContent === "Global:", "suppression end waits for fresh eligible hover");
  hover();
  await frame();
  geometry.records[0].metrics.residentReferences.value += 10;
  rebuild();
  controller.refresh();
  await frame();
  check(
    scope.textContent === "Local:" && lead.title.includes(reports.areas[0].title),
    "live scenario refresh retains local scope"
  );
  geometry.records[0].metrics.residentReferences.value -= 10;
  rebuild();
  failed = true;
  controller.refresh();
  await frame();
  check(
    name.textContent === "Unavailable" && count.textContent === "—",
    "report failure clears stale local data"
  );
  failed = false;
  controller.reset();
  session.reset();
  session.hideDock();
  activate(false);
  await frame();
}

document.getElementById("run-checks").onclick = async () => {
  const output = document.getElementById("test-results");
  output.textContent = "Running browser checks…";
  let count = 0;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    count += 1;
  };
  try {
    failed = false;
    controller.reset();
    session.reset();
    session.hideDock();
    activate(false);
    check(
      container.dataset.mode === "scanner" && container.dataset.expanded === "false",
      "initial Scanner"
    );
    await frame();
    await checkRibbons(check);
    await checkNavigationPolish(check);
    session.setHudExpanded("scanner", true);
    await frame();
    const scannerBody = document.getElementById("wt-details");
    check(
      container.querySelector(".wt-title").getBoundingClientRect().width > 0 &&
        container.querySelector("#wt-summary").getBoundingClientRect().width === 0,
      "expanded Scanner restores full title and hides tracking boxes"
    );
    check(
      scannerBody.scrollHeight <= scannerBody.clientHeight + 1,
      "ordinary Scanner needs no scrolling"
    );
    check(container.querySelectorAll("#wt-table tr").length === 7, "all seven rows retained");
    check(
      container.querySelector("#wt-env").previousElementSibling.textContent === "Weather",
      "compact Weather label"
    );
    check(
      container.querySelector("#wt-env").getBoundingClientRect().bottom <=
        scannerBody.getBoundingClientRect().bottom + 1,
      "last Scanner row fully visible"
    );
    const oneLine = (selector) => {
      const rects = [...container.querySelectorAll(selector)].map((node) =>
        node.getBoundingClientRect()
      );
      return rects.every((rect) => Math.abs(rect.top - rects[0].top) < 1);
    };
    if (session.getSnapshot().layoutClass !== "narrow") {
      check(oneLine("#wt-resources .wt-reading"), "desktop resources share one row");
      check(oneLine("#wt-env .wt-reading"), "desktop weather shares one row");
    }
    const numericBoxes = [...container.querySelectorAll(".wt-reading:not(.wt-reading-hazard)")];
    check(
      numericBoxes.every((box) => {
        const label = box.querySelector(".wt-reading-label").getBoundingClientRect();
        const value = box.querySelector(".wt-reading-number").getBoundingClientRect();
        return label.top < value.bottom && value.top < label.bottom && label.right <= value.left;
      }),
      "numeric labels and values are inline"
    );
    check(
      [...container.querySelectorAll(".wt-boxes-coords .wt-reading")].every((box) => {
        const rect = box.getBoundingClientRect();
        const label = box.querySelector(".wt-reading-label").getBoundingClientRect();
        const value = box.querySelector(".wt-reading-number").getBoundingClientRect();
        return Math.abs((label.left + value.right - rect.left - rect.right) / 2) < 1;
      }),
      "coordinate label and value are centered together"
    );
    check(
      !container.querySelector(".wt-reading-indicator") && !scannerBody.textContent.includes("✓"),
      "checkmark elements and placeholder indicator space removed"
    );
    check(
      [...container.querySelectorAll(".wt-reading")].every(
        (box) => window.getComputedStyle(box).marginBottom === "0px"
      ),
      "Pico group margin cannot add blank rows"
    );
    const shortcut = document.getElementById("wt-window");
    const beforeWindow = session.getSnapshot();
    shortcut.focus();
    shortcut.click();
    await frame();
    check(windowManager.isOpen("environment"), "cloud opens registered Environment Info");
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    check(
      !windowManager.isOpen() && document.activeElement === shortcut,
      "Escape returns to window shortcut"
    );
    check(session.getSnapshot() === beforeWindow, "theater navigation preserves composition");
    activate(true);
    check(
      shortcut === document.getElementById("wt-window") &&
        shortcut.getAttribute("aria-label") === "Open Faction Power Ranks",
      "same shortcut switches to crown and ranks destination"
    );
    check(
      container.dataset.mode === "scorecard" && container.dataset.expanded === "true",
      "activation expands Scorecard"
    );
    check(
      document.querySelectorAll(".location-probe-body .political-report-faction").length === 24,
      "probe includes all contributors"
    );
    check(
      container.querySelectorAll("img").length === 4 &&
        !container.querySelector("[onerror]") &&
        !document.querySelector(".location-probe-body img"),
      "safe manifest text"
    );
    check(container.querySelectorAll(".wt-reading").length === 15, "all Scanner boxes exist");
    const copper = container.querySelector('[data-reading="copper mult"]');
    const ordinaryHeight = scannerBody.getBoundingClientRect().height;
    check(copper.dataset.state === "active", "positive resource active");
    check(
      container.querySelector('[data-reading="green"]').dataset.state === "inactive",
      "zero resource muted"
    );
    check(
      container.querySelector('[data-reading="Gas"]').dataset.state === "inactive",
      "absent weather muted"
    );
    scanner.setArea(createScannerReading());
    await frame();
    check(
      scannerBody.scrollHeight <= scannerBody.clientHeight + 1 &&
        scannerBody.getBoundingClientRect().height === ordinaryHeight,
      "unavailable readings keep a complete stable body"
    );
    check(
      copper.dataset.state === "unavailable" && copper.textContent.includes("—"),
      "unknown distinct from zero"
    );
    scanner.setArea(createScannerReading(scannerInput));
    check(copper === container.querySelector('[data-reading="copper mult"]'), "fixed Scanner DOM");
    scanner.setCoordinates({ inBounds: false });
    check(
      container
        .querySelector('[data-reading="x"]')
        .getAttribute("aria-label")
        .includes("Out of Bounds"),
      "out-of-bounds boxes retained"
    );
    scanner.setCoordinates({ x: 123, z: 456, inBounds: true });
    const allEffects = [
      "Acidic Ground",
      "Acidic Water",
      "Gas",
      "Acid Rain",
      "Duststorm",
      "Burning"
    ];
    const valueKeys = [
      "arid",
      "green",
      "swamp",
      "copper mult",
      "iron mult",
      "stone mult",
      "water mult"
    ];
    scanner.setArea(
      createScannerReading({
        ...scannerInput,
        effects: [],
        resources: { Values: Object.fromEntries(valueKeys.map((key) => [key, 0])) }
      })
    );
    await frame();
    check(
      scannerBody.scrollHeight <= scannerBody.clientHeight + 1 &&
        scannerBody.getBoundingClientRect().height === ordinaryHeight,
      "all-zero readings keep a complete stable body"
    );
    check(
      container.querySelectorAll('.wt-reading[data-state="inactive"]').length === 13,
      "all-zero and absent readings retained"
    );
    const warnings = [...container.querySelectorAll(".wt-warning-artwork")];
    check(
      warnings.every(
        (node) =>
          window.getComputedStyle(node).opacity === "0.4" &&
          window.getComputedStyle(node).filter === "grayscale(1)" &&
          node.getBoundingClientRect().width === 14
      ),
      "inactive warning artwork is faint grey in fixed slots"
    );
    scanner.setArea(
      createScannerReading({
        ...scannerInput,
        effects: allEffects,
        resources: { Values: Object.fromEntries(valueKeys.map((key) => [key, 1])) }
      })
    );
    await frame();
    check(
      scannerBody.scrollHeight <= scannerBody.clientHeight + 1 &&
        scannerBody.getBoundingClientRect().height === ordinaryHeight,
      "all-active ordinary readings keep a complete stable body"
    );
    if (session.getSnapshot().layoutClass !== "narrow")
      check(
        oneLine("#wt-resources .wt-reading") && oneLine("#wt-env .wt-reading"),
        "all-active resources and weather stay on one row"
      );
    const light = document.documentElement.dataset.theme === "light";
    const hazardColors = {
      "Acidic Ground": light ? "rgb(170, 41, 41)" : "rgb(255, 105, 105)",
      "Acidic Water": light ? "rgb(170, 41, 41)" : "rgb(255, 105, 105)",
      "Acid Rain": light ? "rgb(170, 41, 41)" : "rgb(255, 105, 105)",
      Gas: light ? "rgb(113, 67, 165)" : "rgb(195, 160, 255)",
      Duststorm: light ? "rgb(116, 96, 0)" : "rgb(241, 223, 80)",
      Burning: light ? "rgb(135, 80, 0)" : "rgb(255, 173, 51)"
    };
    check(
      Object.entries(hazardColors).every(
        ([key, color]) =>
          window.getComputedStyle(
            container.querySelector(`[data-reading="${key}"] .wt-reading-label`)
          ).color === color
      ),
      "active hazard colors match the theme-specific palette"
    );
    check(
      warnings.every(
        (node) =>
          window.getComputedStyle(node).opacity === "1" &&
          window.getComputedStyle(node).filter === "none" &&
          node.getBoundingClientRect().width === 14
      ),
      "active warning artwork restores supplied colors without changing size"
    );
    const warningHeight = scannerBody.getBoundingClientRect().height;
    for (const warning of warnings) {
      const wasLoaded = warning.dataset.loaded === "true";
      warning.querySelector("img").dispatchEvent(new window.Event("error"));
      check(
        warning.getBoundingClientRect().width === 14 &&
          scannerBody.getBoundingClientRect().height === warningHeight &&
          warning.parentElement.title.endsWith("Recorded"),
        "failed warning image preserves reading and body dimensions"
      );
      if (wasLoaded) warning.querySelector("img").dispatchEvent(new window.Event("load"));
    }
    scanner.setArea(
      createScannerReading({
        ...scannerInput,
        spawnArea: { Name: "UnbrokenCustomArea".repeat(15) },
        biome: { Name: "LongCustomBiome".repeat(15) },
        effects: allEffects,
        resources: { Values: Object.fromEntries(valueKeys.map((key) => [key, 12345678.9])) }
      })
    );
    check(
      container.querySelectorAll('.wt-reading[data-state="active"]').length === 15,
      "all-positive and recorded readings visible"
    );
    await frame();
    check(
      container.scrollWidth <= container.clientWidth,
      "long names and large values cannot widen widget"
    );
    scanner.setArea(createScannerReading(scannerInput));
    session.setLayoutClass("standard", false);
    document.getElementById("viewport-workbench").dataset.layoutClass = "standard";
    container.style.maxWidth = "244px";
    await frame();
    check(
      container.querySelector(".wt-title").getBoundingClientRect().right <=
        shortcut.getBoundingClientRect().left,
      "title wraps before header buttons in inspector clearance"
    );
    const constrainedTitle = container.querySelector(".wt-title");
    check(
      constrainedTitle.scrollWidth <= constrainedTitle.clientWidth + 1,
      "complete title text cannot paint underneath shortcut buttons"
    );
    container.style.removeProperty("max-width");
    resizeFixture();
    const body = document.getElementById("political-scorecard-body");
    await frame();
    const height = body.getBoundingClientRect().height;
    check(height >= 64, "expanded reading area is usable");
    session.setHudMode("scanner");
    check(
      document.getElementById("wt-details").getBoundingClientRect().height === height,
      "Scanner is sizing reference"
    );
    check(body.inert && !document.getElementById("wt-details").inert, "inactive mode inaccessible");
    session.setPoliticalProbeExpanded(false);
    activate(false);
    activate(true);
    check(!document.querySelector(".location-probe-report").open, "remember probe disclosure");
    session.setPoliticalProbeExpanded(true);
    body.scrollTop = 200;
    const beforeRanks = session.getSnapshot();
    const retainedReports = reports;
    shortcut.focus({ preventScroll: true });
    shortcut.click();
    await frame();
    check(windowManager.isOpen("ranks"), "crown opens registered Faction Power Ranks");
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    check(
      document.activeElement === shortcut &&
        body.scrollTop === 200 &&
        session.getSnapshot() === beforeRanks &&
        reports === retainedReports,
      "ranks close restores shortcut and preserves reports, scroll and preferences"
    );
    windowManager.setAvailability("ranks", false, "Scenario unavailable for this fixture.");
    controller.refreshWindowShortcut();
    check(
      shortcut.disabled && shortcut.title.includes("Scenario unavailable"),
      "shortcut shares theater availability and reason"
    );
    shortcut.click();
    check(!windowManager.isOpen(), "unavailable shortcut cannot open a theater");
    windowManager.setAvailability("ranks", true);
    controller.refreshWindowShortcut();
    const button = body.querySelector("[data-political-faction]");
    button.focus({ preventScroll: true });
    button.click();
    check(navigation === "fixture-00", "exact faction navigation");
    colors = { ...colors, "fixture-00": "#ffaa00" };
    controller.refresh();
    check(
      body.scrollTop === 200 && document.activeElement.dataset.politicalFaction === "fixture-00",
      "palette preserves scroll and focus"
    );
    session.setHudMode("scanner");
    rebuild();
    controller.refresh();
    check(container.dataset.mode === "scanner", "scenario update preserves manual Scanner");
    session.setHudMode("scorecard");
    check(body.scrollTop === 200, "mode switch preserves scroll");
    const retainedBody = body;
    document.getElementById("wt-anchor").click();
    await frame();
    check(session.getSnapshot().hudAnchor === "left", "anchor button switches side");
    check(body === retainedBody && body.scrollTop === 200, "anchor retains body and scroll");
    const widgetRect = container.getBoundingClientRect();
    check(
      Math.abs(widgetRect.left - workspace.getBoundingClientRect().left - 12) < 1,
      "left corner placed"
    );
    check(!container.querySelector("button button"), "independent header buttons");
    check(
      [...container.querySelectorAll(".wt-header-button")].map((node) => node.id).join() ===
        "wt-mode,wt-window,wt-anchor,wt-toggle",
      "header button order stays fixed across corners"
    );
    check(
      body.querySelectorAll(".political-scorecard-facts").length === 4,
      "coverage and neutral totals use lists"
    );
    session.setPoliticalTooltipMode("full");
    hover();
    await frame();
    const tooltip = document.getElementById("location-hover-report");
    check(!tooltip.hidden, "full hover visible");
    check(tooltip.querySelectorAll(".political-report-faction").length <= 5, "hover bounded");
    check(tooltip.textContent.includes("complete report"), "omission note visible");
    const first = tooltip.firstChild;
    hover();
    await frame();
    check(tooltip.firstChild === first && lookupCount > 0, "indexed hover reuses content");
    const heldReportRow = body.firstChild;
    const heldProbe = document.querySelector(".location-probe-body").firstChild;
    session.openTransientSurface("cursorControls");
    hover();
    await frame();
    check(
      tooltip.hidden && document.querySelector(".wt-ribbon-scope").textContent === "Global:",
      "Cursor Controls suppresses hover and local ribbon"
    );
    session.setPoliticalTooltipMode("hidden");
    session.setPoliticalProbeExpanded(false);
    session.setPoliticalProbeExpanded(true);
    check(
      body.firstChild === heldReportRow &&
        document.querySelector(".location-probe-body").firstChild === heldProbe,
      "manager settings do not rebuild cached Scorecard or point reports"
    );
    session.closeTransientSurface();
    await frame();
    check(
      document.querySelector(".wt-ribbon-scope").textContent === "Global:",
      "manager dismissal waits for new movement"
    );
    hover();
    await frame();
    check(
      tooltip.hidden && document.querySelector(".wt-ribbon-scope").textContent === "Local:",
      "Hidden mode resumes local tracking independently after manager dismissal"
    );
    session.setPoliticalTooltipMode("full");
    hover();
    await frame();
    const bounds = workspace.getBoundingClientRect(),
      rect = tooltip.getBoundingClientRect();
    check(
      rect.top >= bounds.top &&
        rect.bottom <= bounds.bottom &&
        rect.left >= bounds.left &&
        rect.right <= bounds.right,
      "hover inside bounds"
    );
    emit("popupopen");
    check(tooltip.hidden, "popup suppresses hover");
    suppressed = true;
    hover();
    await frame();
    check(tooltip.hidden, "gesture/theater suppression");
    suppressed = false;
    hover();
    await frame();
    controller.dismissHover();
    check(tooltip.hidden, "Escape dismissal");
    session.enterFocusMap();
    check(tooltip.hidden, "Focus hides hover");
    session.exitFocusMap();
    failed = true;
    controller.refresh();
    check(
      body.textContent.includes("unavailable") &&
        document.querySelector(".location-probe-body").textContent.includes("unavailable"),
      "bounded failure messages"
    );
    session.setHudMode("scanner");
    check(!document.getElementById("wt-details").inert, "Scanner survives reporting failure");
    failed = false;
    controller.refresh();
    const environmentalBody = document.querySelector(".location-probe-body");
    const retainedDetails = document.querySelector(".location-probe-report");
    for (const subject of ["resources", "weather"]) {
      session.setReportingSubject("tooltips", subject);
      session.setReportingSubject("pointProbe", subject);
      session.setReportTooltipMode(subject, "full");
      hover();
      await frame();
      check(
        !tooltip.hidden &&
          tooltip.textContent.includes("shared") &&
          tooltip.textContent.includes("complete report"),
        "ambiguous hover names its limitation and complete-reading route"
      );
      check(
        environmentalBody.querySelectorAll(".environment-report-area").length === 2 &&
          environmentalBody.textContent.includes("· a") &&
          environmentalBody.textContent.includes("· b") &&
          !environmentalBody.querySelector("b"),
        "probe keeps every exact area separate and renders manifest names safely"
      );
      environmentalBody.focus({ preventScroll: true });
      environmentalBody.scrollTop = 60;
      const environmentScroll = environmentalBody.scrollTop;
      const environmentNode = environmentalBody.firstChild;
      session.setPoliticalTooltipMode("reduced");
      check(
        environmentScroll > 0 &&
          environmentalBody.scrollTop === environmentScroll &&
          environmentalBody.firstChild === environmentNode &&
          document.activeElement === environmentalBody,
        "complete environmental readings scroll and retain focused DOM across unrelated changes"
      );
      if (subject === "resources")
        check(
          environmentalBody.querySelectorAll(".environment-report-reading").length === 14 &&
            environmentalBody.textContent.includes("0%") &&
            environmentalBody.textContent.includes("unavailable"),
          "resource probe retains known zero and explains missing first-reference targets"
        );
      else
        check(
          environmentalBody.querySelectorAll(".environment-report-condition").length === 12 &&
            environmentalBody.textContent.includes("Some linked weather data is unavailable"),
          "weather probe retains positive conditions with incomplete-data notice"
        );
      failed = true;
      activate(false);
      hover();
      await frame();
      check(
        !tooltip.hidden &&
          !document.getElementById("probe-slot").hidden &&
          environmentalBody.querySelector(".environment-local-report"),
        "environment works without a scenario or active Political View"
      );
      environmentAvailable = false;
      controller.refresh();
      hover();
      await frame();
      check(
        environmentalBody.textContent.includes("geography is loading") &&
          tooltip.textContent.includes("geography is loading"),
        "geography readiness differs from an unmatched location"
      );
      environmentAvailable = true;
      environmentPoint = environmentFixture.points.unmatched;
      controller.refresh();
      check(
        environmentalBody.textContent.includes("No authored area could be resolved"),
        "unmatched point is explicit"
      );
      environmentPoint = environmentFixture.points.shared;
      failed = false;
      activate(true);
      hover();
      await frame();
      check(
        document.querySelector(".wt-ribbon-scope").textContent === "Local:",
        "Scorecard tracks local geography independently of environmental subject"
      );
      session.setReportTooltipMode(subject, "hidden");
      hover();
      await frame();
      check(
        tooltip.hidden && document.querySelector(".wt-ribbon-scope").textContent === "Local:",
        "environmental Hidden does not disable local Scorecard tracking"
      );
      check(
        document.querySelector(".location-probe-report") === retainedDetails &&
          environmentalBody.tabIndex === 0,
        "one retained keyboard-accessible probe report host"
      );
    }
    environmentAvailable = false;
    session.setReportingSubject("pointProbe", "political");
    session.setReportingSubject("tooltips", "political");
    session.setPoliticalTooltipMode("full");
    hover();
    await frame();
    check(
      environmentalBody.querySelector(".political-local-report") && !tooltip.hidden,
      "environmental failure leaves Political reporting operational"
    );
    environmentAvailable = true;
    const root = document.getElementById("viewport-workbench");
    root.style.width = "min(390px, 100%)";
    root.style.height = "650px";
    session.setLayoutClass("narrow", false);
    root.dataset.layoutClass = "narrow";
    session.showDock();
    for (const anchor of ["left", "right"]) {
      session.setHudAnchor(anchor);
      await frame();
      check(
        scannerBody.scrollHeight <= scannerBody.clientHeight + 1,
        "complete Scanner takes priority above narrow sheet"
      );
      check(
        container.getBoundingClientRect().bottom + 11 <= sheet.getBoundingClientRect().top,
        "widget clears the open sheet in either corner"
      );
      check(
        document.getElementById("map-control-cluster").clientHeight >= 48,
        "map controls retain a reachable row above sheet"
      );
    }
    root.style.minHeight = "0";
    for (const mode of ["scanner", "scorecard"]) {
      session.setHudMode(mode);
      session.setHudExpanded(mode, false);
      for (const anchor of ["left", "right"]) {
        session.setHudAnchor(anchor);
        await frame();
        check(
          container.getBoundingClientRect().height === 56 &&
            container.getBoundingClientRect().bottom + 11 <= sheet.getBoundingClientRect().top &&
            document.getElementById("map-control-cluster").getBoundingClientRect().bottom + 7 <=
              container.getBoundingClientRect().top,
          "collapsed outer header reserves both rows above sheets and below controls"
        );
      }
    }
    session.setHudMode("scanner");
    session.setHudExpanded("scanner", true);
    root.style.height = "280px";
    schedulePosition();
    await frame();
    check(
      scannerBody.scrollHeight > scannerBody.clientHeight,
      "only physically constrained window needs emergency scrolling"
    );
    check(
      sheet.getBoundingClientRect().height >=
        document.getElementById("dock-header").getBoundingClientRect().height,
      "emergency layout keeps sheet minimize controls reachable"
    );
    check(
      container.getBoundingClientRect().bottom + 11 <= sheet.getBoundingClientRect().top,
      "emergency scroller remains above sheet"
    );
    session.hideDock();
    root.style.removeProperty("width");
    root.style.removeProperty("height");
    root.style.removeProperty("min-height");
    resizeFixture();
    await frame();
    session.reset({ hudMode: "scorecard" });
    session.hideDock();
    check(
      container.dataset.expanded === "false" &&
        session.getSnapshot().hudAnchor === "right" &&
        session.getSnapshot().politicalTooltipMode === "reduced" &&
        session.getSnapshot().politicalProbeExpanded,
      "workspace reset preferences"
    );
    check(
      !shortcut.hidden && shortcut.getBoundingClientRect().width > 0,
      "window shortcut remains available when collapsed"
    );
    activate(true);
    output.textContent = `PASS: ${count} browser assertions at ${window.innerWidth}×${window.innerHeight}, ${document.documentElement.dataset.theme}, DPR ${window.devicePixelRatio}. Synthetic manifest only.`;
  } catch (error) {
    output.textContent = `FAIL after ${count}: ${error.message}`;
  }
};
