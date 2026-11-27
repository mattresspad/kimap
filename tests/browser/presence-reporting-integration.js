import { createPresenceFixture } from "../fixtures/presence-fixture.js";
import { createDiscoveryCatalog } from "../../modules/discovery/catalog.js";
import { createPresenceProjection } from "../../modules/discovery/presence.js";
import {
  normalizeScenarioBaseline,
  createScenarioLensProjection
} from "../../modules/scenario/index.js";
import { ScenarioSession } from "../../stores/scenario-session.js";
import { renderPresenceReport } from "../../modules/viewport/presence-reporting.js";

export async function checkPresenceReporting(frame, check, delay) {
  const doc = frame.contentDocument,
    view = frame.contentWindow;
  const get = (selector) => doc.querySelector(selector);
  const change = (node, value) => {
    node.value = value;
    node.dispatchEvent(new view.Event("change", { bubbles: true }));
  };
  const manager = () => {
    if (get("#cursor-controls-panel").hidden) get("#cursor-controls-btn").click();
  };
  const closeManager = () => {
    if (!get("#cursor-controls-panel").hidden) get(".cursor-controls-close").click();
  };
  const point = (type = "mouse") => {
    const map = get("#map-container"),
      rect = map.getBoundingClientRect();
    const coordinates = {
      clientX: rect.left + rect.width * 0.55,
      clientY: rect.top + rect.height * 0.55,
      bubbles: true
    };
    map.dispatchEvent(new view.PointerEvent("pointerdown", { ...coordinates, pointerType: type }));
    map.dispatchEvent(new view.MouseEvent("click", coordinates));
  };
  get("#reset-panel-btn").click();
  get("#world-views-btn").click();
  get("#layer-choice-none").click();
  get("#world-views-btn").click();
  manager();
  const tooltipSubject = get("#cursor-controls-tooltips-subject");
  const probeSubject = get("#cursor-controls-pointProbe-subject");
  const hoverFilter = get("#cursor-controls-tooltips-relations-filter");
  const probeFilter = get("#cursor-controls-pointProbe-relations-filter");
  change(tooltipSubject, "relations");
  change(hoverFilter, "includeNeutrals");
  check(
    hoverFilter.value === "includeNeutrals" && probeFilter.value === "alliesEnemies",
    "Relations filters are independent"
  );
  change(get("#cursor-controls-tooltips-placement"), "bottomCenter");
  get("#cursor-controls-pointProbe-tab").click();
  change(probeSubject, "relations");
  change(get("#cursor-controls-pointProbe-placement"), "bottomCenter");
  closeManager();
  if (get("#unified-dock").getBoundingClientRect().height > 0) get("#dock-minimize-btn").click();
  await delay();
  const mapRect = get("#map-container").getBoundingClientRect();
  const candidates = [
    ...doc.querySelectorAll(".leaflet-marker-icon[data-relation]:not(.custom-nest-marker)")
  ]
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(
      ({ rect }) =>
        rect.left > mapRect.left + 20 &&
        rect.right < mapRect.right - 20 &&
        rect.top > mapRect.top + 40 &&
        rect.bottom < mapRect.bottom - 90
    )
    .sort(
      (a, b) =>
        Math.abs(a.rect.left - mapRect.left - mapRect.width / 2) -
        Math.abs(b.rect.left - mapRect.left - mapRect.width / 2)
    );
  check(candidates.length > 0, "ordinary town marker is available for hover");
  const marker = candidates[0].node;
  const hoverTown = (pointerType) => {
    const rect = marker.getBoundingClientRect();
    marker.dispatchEvent(
      new view.PointerEvent("pointermove", {
        pointerType,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      })
    );
  };
  hoverTown("mouse");
  await delay();
  const hover = get("#location-hover-report");
  check(
    !hover.hidden && hover.dataset.subject === "relations",
    "town mouse hover reports Relations with Political View off"
  );
  check(
    hover.querySelectorAll(".presence-report-row").length <= 3,
    "Reduced town hover is bounded to three rows"
  );
  check(!hover.querySelector("button, a, input"), "town hover remains passive");
  hoverTown("touch");
  await delay();
  check(hover.hidden, "touch town hover is suppressed");
  hoverTown("mouse");
  await delay();
  check(!hover.hidden, "a real mouse restores town reporting");
  get("#world-views-btn").click();
  get("#layer-choice-political").click();
  get("#world-views-btn").click();
  if (get("#world-tracker").dataset.expanded === "true") get("#wt-toggle").click();
  const hoverArea = () => {
    const bounds = get("#map-container").getBoundingClientRect();
    get("#map-container").dispatchEvent(
      new view.MouseEvent("mousemove", {
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        bubbles: true
      })
    );
  };
  hoverArea();
  await delay();
  check(
    get(".wt-ribbon-scope").textContent === "Local:",
    "Relations area hover retains local Scorecard tracking"
  );
  hoverTown("mouse");
  await delay();
  check(
    get(".wt-ribbon-scope").textContent === "Global:",
    "town hover clears area Scorecard context"
  );
  manager();
  get("#cursor-controls-tooltips-tab").click();
  change(tooltipSubject, "squadPresence");
  closeManager();
  hoverTown("mouse");
  await delay();
  check(
    hover.dataset.subject === "squadPresence" && hover.textContent.includes("Owner:"),
    "Squad Presence town hover uses owner and population coverage"
  );
  hoverArea();
  await delay();
  check(
    get(".wt-ribbon-scope").textContent === "Local:",
    "ordinary area movement restores local tracking after town hover"
  );
  marker.click();
  await delay();
  if (get("#viewport-workbench").dataset.phone === "true") {
    check(Boolean(get("#phone-town-card")?.getClientRects().length), "phone town click opens the bounded card");
    get("#phone-town-card-context").click();
    await delay();
  } else if (get("#viewport-workbench").dataset.layoutClass === "narrow") {
    check(Boolean(get(".custom-town-popup")), "narrow town click retains compact popup");
    [...get(".custom-town-popup").querySelectorAll("button")]
      .find((node) => node.textContent === "Open Context")
      .click();
    await delay();
  }
  check(get("#info-panel").getBoundingClientRect().height > 0, "town still routes to Inspector");
  check(
    Boolean(get(".inspector-presence")),
    "Inspector consumes the shared current population projection"
  );
  const linked = get(".inspector-presence .reference-link:not(:disabled)");
  if (linked) {
    linked.closest("details").open = true;
    linked.click();
    await delay();
    check(
      !get("#info-panel").textContent.includes("Reference record unavailable"),
      "population link resolves exact Reference target"
    );
  }
  manager();
  closeManager();
  point();
  await delay();
  const popup = get(".point-probe-popup"),
    body = get(".location-probe-body"),
    dot = get(".point-probe-marker");
  check(Boolean(popup), "presence point probe opens");
  const coords = popup.querySelector(".point-probe-coordinates").textContent;
  check(
    get(".location-probe-slot").dataset.subject === "relations",
    "area probe uses selected Relations subject"
  );
  manager();
  get("#cursor-controls-pointProbe-tab").click();
  change(get("#cursor-controls-pointProbe-setting"), "hidden");
  check(
    get(".location-probe-slot").hidden && get(".point-probe-popup") === popup,
    "Hidden removes only the Relations section"
  );
  change(get("#cursor-controls-pointProbe-setting"), "collapsed");
  check(
    !get(".location-probe-slot").hidden && !get(".location-probe-report").open,
    "Collapsed retains report disclosure"
  );
  change(get("#cursor-controls-pointProbe-setting"), "expanded");
  change(probeFilter, "includeNeutrals");
  change(probeSubject, "squadPresence");
  check(hoverFilter.value === "includeNeutrals", "probe changes retain independent hover choices");
  check(
    get(".location-probe-body") === body &&
      get(".point-probe-marker") === dot &&
      popup.querySelector(".point-probe-coordinates").textContent === coords,
    "subject switch retains probe identity and coordinates"
  );
  const children = [...body.childNodes];
  body.focus();
  body.scrollTop = 25;
  const scroll = body.scrollTop;
  change(hoverFilter, "alliesEnemies");
  check(
    children.every((node, i) => body.childNodes[i] === node) &&
      body.scrollTop === scroll &&
      doc.activeElement === body,
    "unrelated settings retain report DOM focus and scroll"
  );
  for (const placement of ["anchored", "bottomCenter"]) {
    change(get("#cursor-controls-pointProbe-placement"), placement);
    await delay();
    check(
      get(".point-probe-popup") === popup && get(".point-probe-marker") === dot,
      "presence report transfers using the retained point host"
    );
  }
  closeManager();
  const paneTransform = get(".leaflet-map-pane").style.transform;
  body.dispatchEvent(new view.WheelEvent("wheel", { bubbles: true, deltaY: 240 }));
  await delay();
  check(
    get(".leaflet-map-pane").style.transform === paneTransform,
    "report wheel does not zoom the map"
  );
  get(".point-probe-close").click();
  point("touch");
  await delay();
  check(
    get(".location-probe-body").textContent.includes("Touch reports are deferred"),
    "touch compatibility click retains actions with explicit new-subject explanation"
  );
  check(
    get(".point-probe-popup .popup-actions").children.length === 3,
    "touch retains existing probe actions"
  );
  get(".point-probe-close").click();
  point("mouse");
  await delay();
  check(
    !get(".location-probe-body").textContent.includes("Touch reports are deferred"),
    "mouse-created probe resumes the selected subject"
  );
  get(".point-probe-close").click();

  const fixture = createPresenceFixture();
  fixture.datasets.squads.find((row) => row.StringId === "bar").Name =
    "<img src=bad> Long squad & name";
  const baseline = normalizeScenarioBaseline(fixture),
    scenario = new ScenarioSession(baseline);
  const catalog = createDiscoveryCatalog({ datasets: fixture.datasets, baseline });
  const snapshot = scenario.getSnapshot();
  const projection = createPresenceProjection({
    catalog,
    snapshot,
    lenses: createScenarioLensProjection({ baseline, snapshot, journal: [], timeline: [] })
  });
  const report = { areas: [projection.towns["town-base"]], target: "town" };
  const reduced = renderPresenceReport(report, {
    subject: "relations",
    hover: true,
    mode: "reduced",
    limit: 1,
    completeHint: "Open Inspector."
  });
  check(
    reduced.querySelectorAll(".presence-report-row").length === 1 &&
      reduced.textContent.includes("more entries"),
    "Relations truncation has a truthful omission notice"
  );
  const full = renderPresenceReport(report, { subject: "squadPresence", mode: "full" });
  check(
    !full.querySelector("img") && full.textContent.includes("<img src=bad>"),
    "manifest names are safe text"
  );
  check(
    full.textContent.includes("Default template") &&
      full.textContent.includes("2 authored entries"),
    "template and repeated-entry labels are explicit"
  );
  check(
    full.textContent.includes("Enemy") && full.textContent.includes("Neutral"),
    "Full presence retains faction attitudes"
  );
  get("#reset-panel-btn").click();
  check(
    tooltipSubject.value === "political" &&
      probeSubject.value === "political" &&
      hoverFilter.value === "alliesEnemies",
    "workspace reset restores the reporting defaults"
  );
}
