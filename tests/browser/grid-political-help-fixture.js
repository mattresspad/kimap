/* global document */
import { createPoliticalModeInfo } from "../../modules/viewport/political-mode-info.js";

const run = document.querySelector("#run-checks");
const output = document.querySelector("#test-results");
const frame = document.querySelector("#map");
const delay = () => new Promise((resolve) => setTimeout(resolve, 50));
async function until(predicate, label) {
  const deadline = Date.now() + 45000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay();
  }
}
document.querySelector("#theme").addEventListener("click", () => {
  const root = frame.contentDocument.documentElement;
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
});

run.addEventListener("click", async () => {
  run.disabled = true;
  let assertions = 0;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    assertions++;
  };
  output.textContent = "Waiting for the local map…";
  try {
    await until(
      () => frame.contentDocument?.querySelector('#map-workspace[data-map-ready="true"]'),
      "map ready"
    );
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    const get = (selector) => doc.querySelector(selector);
    const bounds = (element) => element.getBoundingClientRect();
    const presented = (element) =>
      element &&
      bounds(element).height > 0 &&
      view.getComputedStyle(element).visibility !== "hidden";
    const openWorldViews = () => {
      if (get("#world-views-btn").getAttribute("aria-expanded") !== "true")
        get("#world-views-btn").click();
    };
    const chooser = get("#world-views-control");
    const gridChoice = get("#layer-choice-debugGrid");
    const gridCog = get('[data-layer-id="debugGrid"] .layers-row-settings-btn');
    const input = get("#map-debug-grid-color");
    const fieldset = get("#layer-configuration-debugGrid");
    const route = get("#workbench-route-plan");
    const activeSurface = () => get('#world-views-control input[type="radio"]:checked')?.id;
    const map = get("#map-container");
    const pane = get(".leaflet-map-pane");
    const base = () => get(".kimap-base-map-image");
    await until(
      () => !map.classList.contains("leaflet-zoom-anim") && base()?.complete,
      "base image"
    );
    if (gridChoice.checked) gridChoice.click();
    assert(
      input.value === "#00ffff" || /^#[0-9a-f]{6}$/i.test(input.value),
      "grid color input is valid"
    );
    assert(fieldset.disabled && gridCog.disabled, "inactive grid disables picker and cog");
    const initialSurface = activeSurface();
    openWorldViews();
    gridChoice.click();
    await until(() => get(".leaflet-debugGrid-pane img")?.naturalWidth > 0, "grid image");
    const image = get(".leaflet-debugGrid-pane img");
    const gridPane = image.parentElement;
    assert(view.getComputedStyle(gridPane).zIndex === "550", "grid remains in pane 550");
    assert(view.getComputedStyle(gridPane).pointerEvents === "none", "grid pane remains passive");
    assert(!gridCog.disabled && !fieldset.disabled, "activation enables both controls");
    get("#world-views-control .layers-pin-btn").click();
    gridCog.click();
    await until(
      () => doc.activeElement?.id === "layer-configuration-debugGrid-title",
      "grid route focus"
    );
    assert(chooser.hidden, "configuration handoff closes chooser");
    assert(
      get("#world-views-control .layers-pin-btn").getAttribute("aria-pressed") === "false",
      "configuration handoff unpins"
    );
    assert(presented(input), "grid picker is reachable");
    assert(
      bounds(input).top >= bounds(route).top && bounds(input).bottom <= bounds(route).bottom + 1,
      "only Plan route scroll reveals grid picker"
    );
    const heldBase = base();
    const heldTransform = pane.style.transform;
    input.focus({ preventScroll: true });
    const heldScroll = route.scrollTop;
    for (const color of ["#663399", "#cc5577", "#ffaa33"]) {
      input.value = color;
      input.dispatchEvent(new view.Event("input", { bubbles: true }));
    }
    await until(
      () => decodeURIComponent(image.src).includes('stroke="#ffaa33"'),
      "latest grid color"
    );
    assert(
      get("#map-debug-grid-color") === input && doc.activeElement === input,
      "picker updates preserve input identity and focus"
    );
    assert(Math.abs(route.scrollTop - heldScroll) < 1, "picker updates preserve route scroll");
    assert(
      base() === heldBase && pane.style.transform === heldTransform,
      "picker leaves base image and map navigation unchanged"
    );
    assert(get(".leaflet-debugGrid-pane img") === image, "picker retains grid image identity");
    assert(activeSurface() === initialSurface, "grid controls do not switch the main surface");
    gridChoice.click();
    assert(fieldset.disabled && gridCog.disabled, "deactivation disables both controls");
    assert(
      doc.activeElement?.id === "layer-configuration-debugGrid-title",
      "deactivation moves focus out of the disabled fieldset"
    );
    assert(input.value === "#ffaa33", "deactivation retains chosen color");
    gridChoice.click();
    await until(() => image.isConnected, "grid reactivation");
    assert(get(".leaflet-debugGrid-pane img") === image, "reactivation retains overlay identity");
    get("#workbench-focus-map-btn").click();
    get("#workbench-focus-map-btn").click();
    assert(input.value === "#ffaa33", "Focus Map retains grid color");
    get("#layer-configuration-back-btn").click();
    await until(() => doc.activeElement?.id === "plan-layer-configuration-btn", "Back focus");

    openWorldViews();
    const info = get(".political-mode-info");
    assert(
      info && !get(".political-interpretation-disclosure"),
      "Political Mode Info replaces the old interpretation"
    );
    info.open = true;
    await delay();
    const configure = info.querySelector(".political-mode-info-configure");
    const helpButton = info.querySelector(".political-mode-info-help");
    assert(
      !info.querySelector(".political-mode-info-preview"),
      "preview moved to Cursor Controls banner"
    );
    assert(get("#world-views-cursor-controls"), "World Views has the functional manager banner");
    for (const element of [configure, helpButton]) {
      assert(
        element.scrollWidth <= element.clientWidth + 1,
        "info rows wrap without horizontal overflow"
      );
    }
    const pin = get("#world-views-control .layers-pin-btn");
    if (pin.getAttribute("aria-pressed") !== "true") pin.click();
    for (let corner = 0; corner < 2; corner++) {
      get("#wt-anchor").click();
      await delay();
      assert(
        !chooser.hidden && pin.getAttribute("aria-pressed") === "true",
        "info remains pinned through corner changes"
      );
      assert(
        chooser.scrollWidth <= chooser.clientWidth + 1,
        "pinned info stays horizontally bounded in either corner"
      );
    }
    await until(() => !configure.disabled, "political readiness");
    configure.click();
    await until(
      () => doc.activeElement?.id === "faction-colors-title",
      "Faction Colors navigation"
    );
    assert(presented(get("#faction-colors-panel")), "info opens existing Faction Colors subview");
    assert(
      activeSurface() === initialSurface,
      "Faction Colors navigation never activates Political View"
    );
    openWorldViews();
    get("#world-views-control .layers-pin-btn").click();
    const hash = view.location.hash;
    const mapBeforeHelp = pane.style.transform;
    helpButton.click();
    await until(() => doc.activeElement?.id === "guide-political-view", "direct Help target");
    const article = get("#help-article");
    const section = get("#guide-political-view");
    const toc = get("#help-toc-container");
    await until(
      () => Math.abs(bounds(section).top - bounds(article).top) < 2,
      "article settles at political section"
    );
    assert(presented(article), "guide opens in existing theater");
    assert(
      chooser.hidden &&
        get("#world-views-control .layers-pin-btn").getAttribute("aria-pressed") === "false",
      "Help follows pinned transient handoff"
    );
    assert(view.location.hash === hash, "direct Help preserves public map URL fragment");
    assert(
      article.scrollHeight > article.clientHeight && article.scrollWidth <= article.clientWidth + 1,
      "guide has bounded vertical scrolling without horizontal overflow"
    );
    assert(
      section.textContent.includes("at least 55%") &&
        section.textContent.includes("at least 10 percentage points"),
      "guide exposes current confidence thresholds"
    );
    assert(
      section.textContent.includes("Outside visible roster") &&
        section.textContent.includes("Unattributed"),
      "guide preserves denominator and redaction explanations"
    );
    assert(
      section.textContent.includes("geometry contributes once") &&
        section.textContent.includes("Faction Power Ranks"),
      "guide distinguishes aggregation and Power Ranks"
    );
    if (get("#viewport-workbench").dataset.layoutClass === "narrow") {
      assert(bounds(toc).bottom <= bounds(article).top + 1, "narrow Contents stacks above article");
      assert(
        bounds(article).width >= bounds(get("#help-window-content")).width - 2,
        "narrow guide receives full column width"
      );
    } else
      assert(
        bounds(toc).right <= bounds(article).left + 1,
        "desktop Contents remains beside article"
      );
    assert(
      bounds(article).bottom <= view.innerHeight + 1,
      "article remains inside theater viewport"
    );
    get('#help-toc-list a[href="#section-intro"]').click();
    await until(() => doc.activeElement?.id === "section-intro", "Contents introduction");
    get('#help-toc-list a[href="#guide-political-view"]').click();
    await until(() => doc.activeElement === section, "Contents political section");
    assert(view.location.hash === hash, "Contents navigation does not write URL fragments");
    article.scrollTop += 150;
    assert(
      pane.style.transform === mapBeforeHelp,
      "Help navigation and reading do not move the map"
    );
    doc.dispatchEvent(new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await until(
      () => doc.activeElement?.id === "world-views-btn",
      "Escape returns to visible World Views launcher"
    );
    assert(presented(doc.activeElement), "Help return target is visible");

    get("#reset-panel-btn").click();
    assert(
      input.value === "#ffaa33" && gridChoice.checked,
      "workspace reset retains grid color and activation"
    );
    assert(activeSurface() === initialSurface, "workspace reset retains the main surface");

    const zoomIn = get("#map-zoom-in-btn");
    const zoomOut = get("#map-zoom-out-btn");
    const firstZoom = zoomIn.disabled ? zoomOut : zoomIn;
    const reverseZoom = firstZoom === zoomIn ? zoomOut : zoomIn;
    for (const button of [firstZoom, reverseZoom]) {
      button.click();
      await delay();
      await until(() => !map.classList.contains("leaflet-zoom-anim"), "map zoom settles");
      assert(
        image.isConnected && get(".leaflet-debugGrid-pane img") === image,
        "zoom retains the recolored grid image"
      );
      assert(
        gridChoice.checked && decodeURIComponent(image.src).includes('stroke="#ffaa33"'),
        "zoom retains activation and color"
      );
    }

    // Exercise unavailable/failure behavior using the production component, without altering app data.
    let availability = { available: false, reason: "Political evidence is unavailable." };
    let configurations = 0;
    let helpOpens = 0;
    const isolated = createPoliticalModeInfo({
      settingsGlyph: "",
      getConfigurationAvailability: () => availability,
      onConfigureFactions: () => configurations++,
      onOpenHelp: () => helpOpens++,
      onGeometryChange() {}
    });
    const isolatedButton = isolated.element.querySelector(".political-mode-info-configure");
    assert(
      isolatedButton.disabled && isolatedButton.title === availability.reason,
      "unavailable component gives existing readiness reason"
    );
    isolatedButton.click();
    isolated.element.querySelector(".political-mode-info-help").click();
    assert(
      configurations === 0 && helpOpens === 1,
      "unavailable evidence disables configuration but retains Help"
    );
    availability = { available: true, reason: null };
    isolated.refresh();
    isolatedButton.click();
    assert(
      !isolatedButton.disabled && configurations === 1,
      "readiness refresh enables retained configuration button"
    );
    assert(
      get("#world-tracker") !== null && activeSurface() === initialSurface,
      "settled widget and surface selection remain intact"
    );
    output.textContent = `PASS: ${assertions} assertions; ${view.innerWidth}×${view.innerHeight}; ${doc.documentElement.dataset.theme}; DPR ${view.devicePixelRatio}. Grid controls, Help, focus, pinned menus, and zoom.`;
  } catch (error) {
    output.textContent = `FAIL after ${assertions} assertions: ${error.message}`;
  } finally {
    run.disabled = false;
  }
});
