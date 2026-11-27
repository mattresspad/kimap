/* global document */
import { createCursorControls } from "../../modules/viewport/cursor-controls.js";
import { ViewportCompositionSession } from "../../stores/viewport-composition-session.js";
import { measureExpandedScannerHeight } from "../../modules/viewport/scanner-placement.js";
import { checkFactionColorsWidget } from "./faction-colors-widget-integration.js";
import { checkPresenceReporting } from "./presence-reporting-integration.js";

const frame = document.getElementById("map");
const output = document.getElementById("test-results");
const run = document.getElementById("run-checks");
document.getElementById("run-matrix").addEventListener("click", async (event) => {
  const matrix = document.getElementById("matrix-results");
  matrix.hidden = false;
  matrix.textContent = "";
  event.target.disabled = true;
  try {
    for (const size of ["1920x1080", "1366x768", "1280x720", "390x720", "960x360"]) {
      for (const theme of ["dark", "light"]) {
        const [width, height] = size.split("x").map(Number);
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;
        // Await the new document, not readiness left over from the previous run.
        const loaded = new Promise((resolve) =>
          frame.addEventListener("load", resolve, { once: true })
        );
        frame.contentWindow.location.reload();
        await loaded;
        await until(
          () => frame.contentDocument.querySelector("#map-workspace")?.dataset.mapReady === "true",
          "matrix initialization"
        );
        frame.contentDocument.documentElement.dataset.theme = theme;
        await delay();
        run.click();
        await until(() => !run.disabled, "matrix run", 120000);
        matrix.textContent += `${output.textContent}\n`;
        if (!output.textContent.startsWith("PASS:")) return;
      }
    }
  } catch (error) {
    matrix.textContent += `FAIL: ${error.message}\n`;
  } finally {
    event.target.disabled = false;
  }
});
document.getElementById("fixture-size").addEventListener("change", (event) => {
  const [width, height] = event.target.value.split("x").map(Number);
  frame.style.width = width ? `${width}px` : "";
  frame.style.height = height ? `${height}px` : "";
  frame.contentWindow.location.reload();
  output.textContent = "Reloading at the selected map viewport…";
});
// Observe a presented iframe frame before checking coalesced report/geometry work.
const delay = () =>
  new Promise((resolve) =>
    frame.contentWindow.requestAnimationFrame(() => setTimeout(resolve, 50))
  );
async function until(predicate, name, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${name}`);
    await delay();
  }
}
document.getElementById("theme").addEventListener("click", () => {
  const root = frame.contentDocument.documentElement;
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
});

run.addEventListener("click", async () => {
  run.disabled = true;
  document.getElementById("fixture-size").disabled = true;
  document.getElementById("theme").disabled = true;
  let assertions = 0;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    assertions++;
  };
  try {
    output.textContent = "Waiting for initialized local map…";
    await until(
      () =>
        frame.contentDocument?.querySelector("#world-tracker") &&
        frame.contentDocument.querySelector("#map-workspace")?.dataset.mapReady === "true" &&
        !frame.contentDocument.querySelector("#layer-choice-political")?.disabled,
      "reporting initialization"
    );
    const doc = frame.contentDocument;
    await checkFactionColorsWidget(doc, check, delay);
    const view = frame.contentWindow;
    const get = (selector) => doc.querySelector(selector);
    const rect = (node) => node.getBoundingClientRect();
    const presented = (node) =>
      node && rect(node).height > 0 && view.getComputedStyle(node).visibility !== "hidden";
    const change = (input, value) => {
      input.value = value;
      input.dispatchEvent(new view.Event("change", { bubbles: true }));
    };
    const key = (node, name) =>
      node.dispatchEvent(
        new view.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })
      );
    const openWorld = () => {
      if (get("#world-views-btn").getAttribute("aria-expanded") !== "true")
        get("#world-views-btn").click();
    };
    const openManager = () => {
      if (get("#cursor-controls-panel").hidden) get("#cursor-controls-btn").click();
    };
    const manager = get("#cursor-controls-panel");
    const launcher = get("#cursor-controls-btn");
    const banner = get("#world-views-cursor-controls");
    const tooltip = get("#cursor-controls-tooltips-setting");
    const probeSetting = get("#cursor-controls-pointProbe-setting");
    const tooltipSubject = get("#cursor-controls-tooltips-subject");
    const probeSubject = get("#cursor-controls-pointProbe-subject");
    const hoverPlacement = get("#cursor-controls-tooltips-placement");
    const probePlacement = get("#cursor-controls-pointProbe-placement");
    const worldSetting = get("#political-tooltip-mode");
    const widget = get("#world-tracker");
    const map = get("#map-container");
    get("#reset-panel-btn").click();
    openWorld();
    get("#layer-choice-none").click();
    check(presented(banner), "banner available with no surface active");
    check(
      banner.nextElementSibling.textContent === "Surface",
      "banner sits directly above Surface"
    );
    check(
      banner.querySelector(".cursor-controls-banner-label").scrollWidth <=
        banner.querySelector(".cursor-controls-banner-label").clientWidth + 1,
      "full banner label fits one line at supported widths"
    );
    check(!get(".political-mode-info-preview"), "old passive preview removed");
    check(
      rect(launcher).height === 38 &&
        Math.abs(
          rect(get("#cursor-controls-frame")).top - rect(get("#map-navigation-controls")).bottom - 8
        ) < 1,
      "standalone 38px launcher sits 8px below Zoom frame"
    );
    check(
      Math.abs(rect(launcher).left - rect(get("#map-zoom-in-btn")).left) < 1,
      "launcher aligns with Zoom buttons"
    );
    const pin = get("#world-views-control .layers-pin-btn");
    pin.click();
    banner.click();
    await delay();
    check(
      !manager.hidden &&
        get("#world-views-control").hidden &&
        pin.getAttribute("aria-pressed") === "false",
      "banner hands off and unpins chooser"
    );
    check(doc.activeElement.id === "cursor-controls-tooltips-tab", "opening focuses selected view");
    check(
      !tooltip.disabled && tooltip.value === "reduced",
      "inactive Political settings are editable and default Reduced"
    );
    check(
      manager.textContent.includes("Applies when Political View is active."),
      "inactive setting explains layer link"
    );
    change(tooltip, "full");
    check(
      worldSetting.value === "full" && get("#layer-choice-none").checked,
      "manager synchronizes selector without layer activation"
    );
    key(get("#cursor-controls-tooltips-tab"), "ArrowRight");
    check(
      doc.activeElement.id === "cursor-controls-pointProbe-tab",
      "arrow keys skip the planned tab"
    );
    doc.activeElement.click();
    check(
      get("#cursor-controls-tooltips-view").hidden && get("#cursor-controls-tooltips-view").inert,
      "inactive view hidden and inaccessible"
    );
    check(
      get(".cursor-controls-planned").disabled &&
        get(".cursor-controls-planned small").textContent === "Planned",
      "Paint & Plan explicitly planned"
    );
    change(probeSetting, "collapsed");
    key(manager, "Escape");
    await delay();
    check(
      manager.hidden && manager.inert && doc.activeElement === launcher,
      "Escape returns to visible launcher after banner handoff"
    );
    openManager();
    check(
      doc.activeElement.id === "cursor-controls-pointProbe-tab",
      "reopening remembers Point Probe view"
    );
    launcher.click();
    await delay();
    check(manager.hidden && doc.activeElement === launcher, "launcher closes with focus return");
    openManager();
    get(".cursor-controls-close").click();
    openWorld();
    banner.click();
    await delay();
    check(
      doc.activeElement.id === "cursor-controls-pointProbe-tab",
      "new handoff wins over queued focus from an earlier close"
    );
    get(".cursor-controls-close").click();
    await delay();
    openWorld();
    get("#layer-choice-political").click();
    await until(
      () => get(".political-view-overlay")?.naturalWidth > 0 && get(".political-scorecard-row"),
      "political raster and rows"
    );
    get(".political-mode-info").open = true;
    get(".political-mode-info-widget").click();
    await delay();
    const factionWidget = get("#faction-colors-widget");
    const checkLegendYield = () => {
      if (!presented(factionWidget)) return;
      const legend = rect(factionWidget);
      for (const target of [
        "#world-tracker",
        "#map-control-cluster",
        "#map-tool-shelf",
        "#cursor-controls-panel",
        "#map-content-control",
        "#world-views-control",
        ".location-probe-fixed",
        ".kenshi-popup-pane",
        "#location-hover-report"
      ]) {
        const element = get(target);
        if (!presented(element)) continue;
        const box = rect(element);
        check(
          legend.right <= box.left ||
            legend.left >= box.right ||
            legend.bottom <= box.top ||
            legend.top >= box.bottom,
          `faction list yields to ${target}`
        );
      }
    };
    checkLegendYield();
    openWorld();
    const image = get(".political-view-overlay");
    const imageUrl = image.src;
    const base = get(".kimap-base-map-image");
    const body = get("#political-scorecard-body");
    const row = body.firstElementChild;
    body.scrollTop = 120;
    const heldScroll = body.scrollTop;
    change(worldSetting, "hidden");
    banner.click();
    check(tooltip.value === "hidden", "World Views changes synchronize back to manager");
    for (const mode of ["reduced", "full", "hidden", "reduced"]) change(tooltip, mode);
    check(
      body.firstElementChild === row && body.scrollTop === heldScroll,
      "setting updates retain Scorecard content and scroll"
    );
    await delay();
    check(
      get(".political-view-overlay") === image &&
        image.src === imageUrl &&
        get(".kimap-base-map-image") === base,
      "settings retain political pixels, overlay and base image"
    );

    const hover = () => {
      const bounds = rect(map);
      map.dispatchEvent(
        new view.MouseEvent("mousemove", {
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2,
          bubbles: true
        })
      );
    };
    if (widget.dataset.expanded === "true") get("#wt-toggle").click();
    hover();
    await delay();
    check(
      get("#location-hover-report").hidden && get(".wt-ribbon-scope").textContent === "Global:",
      "open manager suppresses hover and local ribbon"
    );
    get(".cursor-controls-close").click();
    await delay();
    check(
      get(".wt-ribbon-scope").textContent === "Global:",
      "dismissal waits for eligible movement"
    );
    hover();
    await delay();
    check(
      get(".wt-ribbon-scope").textContent === "Local:",
      "local ribbon resumes after eligible movement"
    );
    checkLegendYield();
    openManager();
    map.dispatchEvent(new view.PointerEvent("pointerdown", { bubbles: true }));
    check(manager.hidden, "ordinary outside pointer dismisses manager");
    const bounds = rect(map);
    map.dispatchEvent(
      new view.MouseEvent("click", {
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        bubbles: true
      })
    );
    await until(() => get(".point-probe-popup"), "ordinary map click opens point probe");
    const popup = get(".point-probe-popup");
    const coordinates = popup.querySelector(".point-probe-coordinates").textContent;
    const details = popup.querySelector(".location-probe-report");
    const reportBody = popup.querySelector(".location-probe-body");
    check(!details.open, "preselected collapsed probe setting applies to real popup");
    openManager();
    get("#cursor-controls-pointProbe-tab").click();
    change(probeSetting, "expanded");
    await delay();
    check(
      details.open &&
        get(".point-probe-popup") === popup &&
        popup.querySelector(".point-probe-coordinates").textContent === coordinates,
      "manager updates existing probe without replacing its identity"
    );
    reportBody.scrollTop = 30;
    const probeScroll = reportBody.scrollTop;
    const reportNode = reportBody.firstChild;
    change(tooltip, "full");
    check(
      reportBody.firstChild === reportNode && reportBody.scrollTop === probeScroll,
      "settings retain probe content and scroll"
    );
    details.open = false;
    await delay();
    check(probeSetting.value === "collapsed", "popup disclosure synchronizes back to manager");
    await until(
      () =>
        !get(".leaflet-map-pane").classList.contains("leaflet-pan-anim") &&
        !map.classList.contains("leaflet-zoom-anim"),
      "probe opening pan settles before wheel check"
    );
    const transform = get(".leaflet-map-pane").style.transform;
    const pointMarker = get(".point-probe-marker");
    check(Boolean(pointMarker), "held probe has its gold point marker");
    const actionButtons = [...popup.querySelectorAll(".popup-actions button")];
    for (const hoverSubject of ["political", "resources", "weather"]) {
      change(tooltipSubject, hoverSubject);
      change(tooltip, "full");
      for (const subject of ["political", "resources", "weather"]) {
        change(probeSubject, subject);
        change(probeSetting, "expanded");
        await delay();
        check(
          tooltipSubject.value === hoverSubject && probeSubject.value === subject,
          "all nine subject combinations remain independent"
        );
        check(
          get(".point-probe-popup") === popup &&
            popup.querySelector(".point-probe-coordinates").textContent === coordinates &&
            actionButtons.every(
              (button, index) => popup.querySelectorAll(".popup-actions button")[index] === button
            ) &&
            get(".point-probe-marker") === pointMarker,
          "subject switch retains exact point presentation and action nodes"
        );
        check(
          popup.querySelector("summary").textContent ===
            `${subject[0].toUpperCase()}${subject.slice(1)} report`,
          "existing probe displays chosen report subject"
        );
        check(
          get(".leaflet-map-pane").style.transform === transform,
          "report subject and disclosure updates do not pan the map"
        );
        const retained = reportBody.firstChild;
        reportBody.focus({ preventScroll: true });
        reportBody.scrollTop = 40;
        const retainedScroll = reportBody.scrollTop;
        change(worldSetting, "hidden");
        check(
          tooltipSubject.value === hoverSubject &&
            probeSubject.value === subject &&
            reportBody.firstChild === retained &&
            reportBody.scrollTop === retainedScroll &&
            doc.activeElement === reportBody,
          "World Views does not switch subjects or replace focused report DOM"
        );
        reportBody.dispatchEvent(new view.WheelEvent("wheel", { deltaY: 300, bubbles: true }));
        await delay();
        check(
          get(".leaflet-map-pane").style.transform === transform,
          "probe wheel stays out of the map"
        );
      }
    }
    change(probeSubject, "resources");
    await delay();
    check(reportBody.scrollTop === 0, "a different subject starts its report at the top");
    for (const subject of ["political", "resources", "weather"]) {
      change(probeSubject, subject);
      change(probeSetting, "expanded");
      for (const hoverPosition of ["anchored", "bottomCenter"]) {
        change(hoverPlacement, hoverPosition);
        for (const probePosition of ["bottomCenter", "anchored"]) {
          const retained = reportBody.firstChild;
          reportBody.focus({ preventScroll: true });
          reportBody.scrollTop = 25;
          const scroll = reportBody.scrollTop;
          change(probePlacement, probePosition);
          await delay();
          check(
            popup === get(".point-probe-popup") &&
              reportBody.firstChild === retained &&
              reportBody.scrollTop === scroll &&
              doc.activeElement === reportBody,
            "host transfer retains report DOM, focus and scroll"
          );
          check(
            popup.querySelector(".point-probe-coordinates").textContent === coordinates &&
              get(".point-probe-marker") === pointMarker &&
              actionButtons.every(
                (button, i) => popup.querySelectorAll(".popup-actions button")[i] === button
              ),
            "host transfer retains coordinates, gold dot and actions"
          );
          check(
            get(".leaflet-map-pane").style.transform === transform,
            "placement changes never pan"
          );
          check(
            hoverPlacement.value === hoverPosition,
            "placements independent of subject and each other"
          );
          const host =
            probePosition === "bottomCenter"
              ? get(".location-probe-fixed")
              : get(".kenshi-popup-pane");
          const cap = measureExpandedScannerHeight(widget, get("#workbench-hud-region"));
          check(
            rect(host).height <= cap + 1,
            `whole probe height capped: ${rect(host).height} <= ${cap}`
          );
          hover();
          await delay();
          check(
            get("#location-hover-report").hidden &&
              get(".wt-ribbon-scope").textContent === "Global:",
            "presented probe suppresses hover and local Scorecard for both hosts"
          );
        }
      }
    }
    change(probeSubject, "resources");
    openWorld();
    get("#layer-choice-none").click();
    await delay();
    check(
      !popup.querySelector(".location-probe-slot").hidden &&
        reportBody.querySelector(".environment-local-report"),
      "environmental probe remains available with Political View off"
    );
    openManager();
    change(probeSubject, "political");
    check(
      popup.querySelector(".location-probe-slot").hidden,
      "Political probe retains its active-layer requirement"
    );
    change(probeSetting, "collapsed");
    change(tooltipSubject, "political");
    change(tooltip, "full");
    openWorld();
    get("#layer-choice-political").click();
    openManager();
    await delay();
    get(".cursor-controls-body").dispatchEvent(
      new view.WheelEvent("wheel", { deltaY: 300, bubbles: true })
    );
    await delay();
    check(
      get(".leaflet-map-pane").style.transform === transform,
      "settings wheel does not zoom map"
    );
    get(".cursor-controls-close").click();
    get(".point-probe-close").click();

    for (const subject of ["resources", "weather"]) {
      for (const mode of ["reduced", "full", "hidden"]) {
        openManager();
        change(tooltipSubject, subject);
        change(tooltip, mode);
        get(".cursor-controls-close").click();
        hover();
        await delay();
        const reading = get("#location-hover-report");
        check(
          reading.hidden === (mode === "hidden"),
          "environmental hover respects each detail mode"
        );
        check(
          get(".wt-ribbon-scope").textContent === "Local:",
          "political local tracking remains active with environmental or hidden hover"
        );
        if (!reading.hidden) {
          const box = rect(reading),
            workspace = rect(get("#map-workspace"));
          check(
            box.left >= workspace.left &&
              box.right <= workspace.right + 1 &&
              box.top >= workspace.top &&
              box.bottom <= workspace.bottom + 1 &&
              reading.scrollWidth <= reading.clientWidth + 1,
            "environmental hover remains passive and bounded"
          );
        }
      }
    }
    openManager();
    change(tooltipSubject, "political");
    change(hoverPlacement, "anchored");
    get(".cursor-controls-close").click();

    openManager();
    change(probeSubject, "resources");
    change(probePlacement, "bottomCenter");
    get(".cursor-controls-close").click();
    const beforePinnedOpen = get(".leaflet-map-pane").style.transform;
    map.dispatchEvent(
      new view.MouseEvent("click", {
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        bubbles: true
      })
    );
    await delay();
    let pinnedView = get(".point-probe-popup");
    check(
      Boolean(pinnedView) &&
        !get(".kenshi-popup-pane") &&
        get(".leaflet-map-pane").style.transform === beforePinnedOpen,
      "fresh pinned opening does not create a popup or pan"
    );
    map.dispatchEvent(
      new view.MouseEvent("click", {
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        bubbles: true
      })
    );
    await delay();
    check(
      get(".point-probe-popup") !== pinnedView && get(".point-probe-marker"),
      "replacing a probe at the same coordinates retains point authority and dot"
    );
    pinnedView = get(".point-probe-popup");
    const pinnedCoords = pinnedView.querySelector(".point-probe-coordinates").textContent;
    get("#workbench-focus-map-btn").click();
    await delay();
    check(
      get(".point-probe-popup") === pinnedView && presented(get(".location-probe-fixed")),
      "Focus Map preserves held pinned probe"
    );
    get("#workbench-focus-map-btn").click();
    await delay();
    get("#map-zoom-in-btn").click();
    await until(() => !map.classList.contains("leaflet-zoom-anim"), "pinned zoom completion");
    check(
      get(".point-probe-popup") === pinnedView &&
        pinnedView.querySelector(".point-probe-coordinates").textContent === pinnedCoords &&
        get(".point-probe-marker"),
      "zoom retains pinned point, coordinates and dot"
    );
    get("#map-zoom-out-btn").click();
    await until(() => !map.classList.contains("leaflet-zoom-anim"), "pinned zoom-out completion");

    for (const mode of ["scanner", "scorecard"]) {
      if (widget.dataset.mode !== mode) get("#wt-mode").click();
      for (const expanded of [false, true]) {
        if ((widget.dataset.expanded === "true") !== expanded) get("#wt-toggle").click();
        for (const anchor of ["left", "right"]) {
          if (widget.dataset.anchor !== anchor) get("#wt-anchor").click();
          openManager();
          await delay();
          const area = rect(get("#map-workspace"));
          const box = rect(manager);
          const readingBox = rect(get(".location-probe-fixed"));
          checkLegendYield();
          check(
            Math.abs(readingBox.left + readingBox.width / 2 - (area.left + area.right) / 2) < 1,
            "pinned probe stays centered for both HUD corners and modes"
          );
          check(
            readingBox.height <=
              measureExpandedScannerHeight(widget, get("#workbench-hud-region")) + 1,
            "collapsed or constrained HUD does not change intrinsic probe cap"
          );
          check(
            box.left >= area.left &&
              box.right <= area.right + 1 &&
              box.top >= area.top &&
              box.bottom <= area.bottom + 1,
            "manager stays within usable workspace"
          );
          check(
            manager.scrollWidth <= manager.clientWidth + 1,
            "manager has no horizontal overflow"
          );
          check(
            Math.abs(box.right - area.right + 12) < 1,
            "manager stays on right in either widget corner"
          );
          check(
            Math.abs(rect(get("#wt-details")).height - rect(body).height) < 1,
            "Scanner and Scorecard retain shared dimensions"
          );
          if (mode === "scanner" && expanded && area.height >= 600) {
            const scanner = get("#wt-details");
            check(
              scanner.scrollHeight <= scanner.clientHeight + 1 &&
                get("#wt-table").querySelectorAll("tr").length === 7,
              "ordinary expanded Scanner retains all seven rows without scrolling"
            );
          }
          get(".cursor-controls-close").click();
        }
      }
    }
    openManager();
    get("#map-tool-shelf-launcher").click();
    await delay();
    if (get("#viewport-workbench").dataset.layoutClass === "narrow")
      check(
        rect(get("#map-tool-shelf-panel")).right <= rect(get("#map-navigation-stack")).left,
        "narrow Plan Tools clears launcher column"
      );
    get("#map-tool-shelf-close-btn").click();
    get(".cursor-controls-close").click();
    key(pinnedView, "Escape");
    await delay();
    check(
      !get(".point-probe-popup") && !get(".point-probe-marker"),
      "Escape dismisses pinned probe at popup priority"
    );
    openManager();
    change(probeSetting, "collapsed");
    get("#workbench-focus-map-btn").click();
    check(manager.hidden && launcher.hidden, "Focus Map hides manager and launcher");
    get("#workbench-focus-map-btn").click();
    openManager();
    check(
      tooltip.value === "full" && probeSetting.value === "collapsed",
      "Focus Map retains reporting settings"
    );
    get("#workbench-dock-toggle-btn").click();
    if (get("#viewport-workbench").dataset.layoutClass === "narrow")
      check(manager.hidden, "opening a narrow sheet dismisses manager");
    openManager();
    if (get("#viewport-workbench").dataset.layoutClass === "narrow")
      check(!presented(get("#unified-dock")), "manager minimizes narrow sheet");
    get("#reset-panel-btn").click();
    check(
      manager.hidden && tooltip.value === "reduced" && probeSetting.value === "expanded",
      "workspace reset restores defaults"
    );
    check(
      hoverPlacement.value === "anchored" && probePlacement.value === "anchored",
      "reset restores both natural placements"
    );

    const session = new ViewportCompositionSession({ transientSurface: "cursorControls" });
    let availability = { available: false, reason: "Fixture political input unavailable <sample>" };
    const isolated = createCursorControls({
      session,
      getSubjectAvailability: () => availability,
      onToggle() {},
      onOpen() {},
      onClose() {},
      onGeometryChange() {}
    });
    get("#map-popover-host").append(isolated.element);
    const isolatedSelect = isolated.element.querySelector("#cursor-controls-tooltips-setting");
    isolatedSelect.focus();
    change(isolatedSelect, "hidden");
    isolated.refresh();
    check(
      !isolatedSelect.disabled &&
        isolatedSelect.value === "hidden" &&
        doc.activeElement === isolatedSelect,
      "unavailable settings retain input and focus"
    );
    check(
      isolated.element.textContent.includes(availability.reason) &&
        !isolated.element.querySelector("sample"),
      "readiness reason uses safe text"
    );
    for (const image of [
      ...isolated.banner.querySelectorAll("img"),
      ...isolated.launcher.querySelectorAll("img")
    ])
      image.dispatchEvent(new Event("error"));
    check(
      isolated.banner.textContent.includes("Tooltip & click settings") &&
        isolated.launcher.querySelector("img").hidden &&
        isolated.launcher.querySelector("svg"),
      "image failures preserve banner text and launcher fallback"
    );
    availability = { available: true, active: true };
    isolated.refresh();
    check(
      isolatedSelect.value === "hidden" && doc.activeElement === isolatedSelect,
      "readiness recovery retains prepared choices and focus"
    );
    isolated.element.remove();
    const townMarker = get(".leaflet-marker-icon[data-relation]");
    openManager();
    change(probePlacement, "bottomCenter");
    get(".cursor-controls-close").click();
    const clickBounds = rect(map);
    map.dispatchEvent(
      new view.MouseEvent("click", {
        clientX: clickBounds.left + clickBounds.width / 2,
        clientY: clickBounds.top + clickBounds.height / 2,
        bubbles: true
      })
    );
    await delay();
    check(
      presented(get(".location-probe-fixed")),
      "fresh pinned probe is presented without a Leaflet popup"
    );
    townMarker.click();
    await delay();
    check(
      !get(".point-probe-popup") && townMarker.classList.contains("selection-map-marker"),
      "town clicks keep exact geographic selection and never become point probes"
    );
    if (get("#viewport-workbench").dataset.layoutClass !== "narrow")
      check(presented(get("#info-panel")), "desktop town click opens the Inspector directly");
    get("#map-tool-shelf-launcher").click();
    openManager();
    await delay();
    if (manager.dataset.mode === "anchored") {
      check(
        rect(manager).top >= rect(get("#cursor-controls-frame")).bottom + 7,
        "manager stays below launcher with Inspector and Plan Tools"
      );
      const tools = rect(get("#map-tool-shelf")),
        panel = rect(manager);
      if (tools.right > panel.left && tools.left < panel.right)
        check(panel.top >= tools.bottom + 7, "small Plan Tools overlap clears downward");
    }
    get(".cursor-controls-close").click();
    get("#map-tool-shelf-close-btn").click();
    await checkPresenceReporting(frame, check, delay);
    output.textContent = `PASS: ${assertions} assertions; ${view.innerWidth}×${view.innerHeight}; ${doc.documentElement.dataset.theme}; DPR ${view.devicePixelRatio}. Cursor Controls, presence, synchronization, probe, focus, corners, sheets and retained overlays.`;
  } catch (error) {
    output.textContent = `FAIL after ${assertions}: ${error.message}`;
  } finally {
    run.disabled = false;
    document.getElementById("fixture-size").disabled = false;
    document.getElementById("theme").disabled = false;
  }
});
