/* global document, window, requestAnimationFrame */
import { createLandmarkInspector } from "../../modules/landmark-inspector.js";
import { createLandmarkCatalog } from "../../modules/landmark-catalog.js";
import { openContextResultsPopup } from "../../modules/viewport/context-results-popup.js";

const frame = document.getElementById("map");
const results = document.getElementById("results");
const status = document.getElementById("status");
const delay = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 70)));
async function until(predicate, description) {
  const deadline = Date.now() + 60000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await delay();
  }
}
const check = (condition, description) => {
  if (!condition) throw new Error(description);
  results.textContent += `PASS ${description}\n`;
};

async function run() {
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  const get = (selector) => doc.querySelector(selector);
  const click = (selector) => {
    const node = get(selector);
    if (!node) throw new Error(`Missing ${selector}`);
    node.click();
  };
  const key = (value) =>
    doc.dispatchEvent(new view.KeyboardEvent("keydown", { key: value, bubbles: true }));
  const change = (node, value, type = "change") => {
    node.value = value;
    node.dispatchEvent(new view.Event(type, { bubbles: true }));
  };
  const title = () => get("#info-panel-title").textContent;
  const landmark = (name) => get(`.landmark-icon[title="${name}"]`);
  const inspect = (name) =>
    landmark(name).dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
  const mode = () => get("#info-panel").dataset.contextMode;
  const panelVisible = () => get("#info-panel").getAttribute("aria-hidden") === "false";
  const search = async (name, kind) => {
    const input = get("#quick-search-input");
    if (!input.getClientRects().length) click("#quick-search-launcher");
    input.focus();
    change(input, name, "input");
    await until(() => get("#quick-search-results [role=option]"), "search results");
    const options = [...doc.querySelectorAll("#quick-search-results [role=option]")];
    const option = options.find((node) => node.textContent.includes(kind)) ?? options[0];
    option.click();
    await delay();
  };

  await until(() => get("#map-workspace")?.dataset.mapReady === "true", "application ready");
  document.getElementById("metrics").textContent =
    `${view.innerWidth}×${view.innerHeight}, DPR ${view.devicePixelRatio}`;
  click("#reset-panel-btn");
  click("#info-panel-clear-btn");
  click("#map-content-btn");
  const toggle = get("#layer-choice-landmarks");
  if (!toggle.checked) toggle.click();
  click("#map-content-btn");
  await until(() => landmark("Stobe"), "landmark assets");
  check(doc.querySelectorAll(".landmark-icon").length === 27, "all 27 occurrences render");
  landmark("Satellite Wreckage").dispatchEvent(
    new view.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true
    })
  );
  await delay();
  await until(
    () => get(".landmark-area-reading")?.textContent === "The Eye",
    "landmark area lookup"
  );
  check(
    mode() === "landmark" && title() === "Satellite Wreckage",
    "marker opens landmark Inspector"
  );
  check(
    get("#info-panel-landmark-content").textContent.includes("X 42418, Z -19943"),
    "clicked occurrence coordinates preserved"
  );
  check(
    get(".landmark-area-reading").textContent === "The Eye",
    "shared raster resolves actual spawn area"
  );
  check(
    get("#info-panel-primary-actions").hidden && get("#info-panel-identity-actions").hidden,
    "unrelated actions are hidden"
  );
  check(!get(".point-probe-popup"), "landmark click does not create a point probe");
  click("#info-panel-clear-btn");
  await delay();
  check(!panelVisible(), "standalone close hides Inspector");

  await search("The Hub", "Town");
  const townTitle = title();
  const townBody = get("#info-panel-geographic-content").firstElementChild;
  inspect("Stobe");
  inspect("Satellite Wreckage");
  click("#info-panel-landmark-back-btn");
  await delay();
  check(
    mode() === "geographic" && title() === townTitle,
    "successive landmarks retain one geographic return point"
  );
  check(
    get("#info-panel-geographic-content").firstElementChild === townBody,
    "geographic DOM retained"
  );

  await search("Bloodrum", "Item");
  const referenceTitle = title();
  const group = get(".reference-lazy-list");
  group.open = true;
  group.dispatchEvent(new view.Event("toggle"));
  const link = group.querySelector("[data-reference-action=push]");
  check(Boolean(link), "fixture has linked reference evidence");
  link.click();
  await delay();
  const nestedTitle = title();
  const nestedGroup = get(".reference-lazy-list");
  if (nestedGroup) {
    nestedGroup.open = true;
    nestedGroup.dispatchEvent(new view.Event("toggle"));
  }
  const rootNode = get("#info-panel-reference-content").firstElementChild;
  const scroller = get("#info-panel-content");
  scroller.scrollTop = 110;
  const scroll = scroller.scrollTop;
  inspect("Stobe");
  const landmarkNode = get("#info-panel-landmark-content").firstElementChild;
  inspect("Stobe");
  check(
    get("#info-panel-landmark-content").firstElementChild === landmarkNode,
    "same occurrence is a DOM no-op"
  );
  click("#info-panel-minimize-btn");
  click("#workbench-inspector-toggle-btn");
  check(mode() === "landmark", "minimize and reopening retain landmark view");
  const mapBounds = get("#map-container").getBoundingClientRect();
  get("#map-container").dispatchEvent(
    new view.MouseEvent("click", {
      bubbles: true,
      clientX: mapBounds.left + mapBounds.width / 2,
      clientY: mapBounds.top + mapBounds.height * 0.7
    })
  );
  await delay();
  check(
    mode() === "landmark" && !panelVisible(),
    "ordinary probing hides but retains landmark visit"
  );
  click("#workbench-inspector-toggle-btn");
  check(panelVisible() && title() === "Stobe", "Inspector reopens held landmark after probing");
  // A landmark activation dismisses the temporary point probe without replacing its return point.
  inspect("Stobe");
  click("#workbench-focus-map-btn");
  click("#workbench-focus-map-btn");
  inspect("Satellite Wreckage");
  key("Escape");
  await delay();
  check(
    title() === nestedTitle && mode() === "reference",
    "Escape returns before clearing reference trail"
  );
  check(
    get("#info-panel-reference-content").firstElementChild === rootNode,
    "reference DOM retained across visits"
  );
  check(!nestedGroup || nestedGroup.open, "reference disclosure retained");
  check(Math.abs(scroller.scrollTop - scroll) <= 1, "reference reading position restored");
  click("#info-panel-reference-back-btn");
  await delay();
  check(title() === referenceTitle, "existing reference Back trail remains intact");

  inspect("Stobe");
  click("#map-content-btn");
  get("#layer-choice-landmarks").click();
  click("#map-content-btn");
  check(mode() === "landmark" && title() === "Stobe", "hiding landmark layer retains inspection");
  click("#map-content-btn");
  get("#layer-choice-landmarks").click();
  click("#map-content-btn");
  await search("The Hub", "Town");
  check(mode() === "geographic", "new geographic destination ends visit");
  inspect("Stobe");
  await search("Bloodrum", "Item");
  check(
    mode() === "reference" && title() === referenceTitle,
    "new reference destination ends visit"
  );

  await search("The Holy Nation", "Faction");
  inspect("Stobe");
  click("#workbench-task-simulate-btn");
  const factions = get("#faction-select-dropdown");
  const faction = [...factions.options].find((option) => option.textContent === "The Holy Nation");
  change(factions, faction.value);
  const slider = get("#faction-relations-slider");
  const original = slider.value;
  change(slider, original === "60" ? "70" : "60", "input");
  click("#faction-apply-button");
  await delay();
  click("#info-panel-landmark-back-btn");
  await delay();
  check(
    get("#info-panel-reference-content").textContent.includes(`${slider.value} (ally)`),
    "scenario updates remain current beneath landmark view"
  );
  click("#workbench-undo-btn");
  inspect("Stobe");
  click("#reset-panel-btn");
  check(mode() === "geographic", "workspace reset ends landmark visit");

  click('[data-context-subject="deadlyAnimals"]');
  click("#browse-context-show-btn");
  await until(() => get(".context-map-indicator.is-aggregate"), "live Context aggregate");
  get(".context-map-indicator.is-aggregate").dispatchEvent(
    new view.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
  );
  const liveChoice = get(".context-results-popup .context-reference-action");
  const chosenName = liveChoice.textContent;
  liveChoice.click();
  await delay();
  check(
    mode() === "reference" && title() === chosenName,
    "live aggregate opens the chosen reference"
  );
  check(
    doc.activeElement === get("#info-panel-title"),
    "Context destination receives keyboard focus"
  );

  // Use production DOM builders in the actual browser with adversarial text and an isolated Leaflet host.
  const host = document.createElement("div");
  document.body.append(host);
  const catalog = createLandmarkCatalog({
    features: [{ TargetId: "id", X: 1.2, Z: 3.4 }],
    whitelist: { id: { title: "<img src=x>", description: "<script>not markup</script>" } }
  });
  createLandmarkInspector({ container: host }).render(catalog.occurrences[0], null, "unavailable");
  check(
    !host.querySelector("script,img") && host.textContent.includes("<script>not markup</script>"),
    "landmark text cannot become executable markup"
  );
  host.remove();
  await checkChooser(view);
  status.textContent = `PASS ${view.innerWidth}×${view.innerHeight}, ${doc.documentElement.dataset.theme}, DPR ${view.devicePixelRatio}`;
}

async function checkChooser(view) {
  // Load the production builder in the application's own document/Leaflet realm.
  const doc = frame.contentDocument;
  const host = doc.createElement("div");
  host.style.cssText =
    "position:fixed;inset:80px 12px auto auto;width:min(420px,calc(100vw - 24px));height:260px;z-index:20000";
  doc.body.append(host);
  const L = view.L;
  window.L = L;
  const map = L.map(host, {
    zoomControl: false,
    attributionControl: false,
    crs: L.CRS.Simple
  }).setView([0, 0], 0);
  const marker = L.marker([0, 0], {
    icon: L.divIcon({ className: "fixture-marker", html: "Source", iconSize: [40, 24] })
  }).addTo(map);
  let action = null;
  const entries = Array.from({ length: 30 }, (_, i) => ({
    name: `Result ${i} — ${"long label ".repeat(4)}`,
    entityId: String(i)
  }));
  entries[0] = {
    ...entries[0],
    kind: "narcotic",
    locationName: "Town",
    referenceType: "item",
    referenceId: "exact-item"
  };
  const options = {
    map,
    entries,
    latLng: L.latLng(0, 0),
    marker,
    createReferenceButton: (_type, _id, name, className) => {
      const button = doc.createElement("button");
      button.className = className;
      button.textContent = name;
      return button;
    },
    onActivate: (entry) => {
      action = entry.entityId;
      return true;
    },
    onReference: (entry) => {
      action = entry.referenceId;
      return true;
    }
  };
  const popup = openContextResultsPopup(options);
  await delay();
  const list = host.querySelector(".context-results-list");
  const body = host.querySelector(".leaflet-popup-content-wrapper");
  const expected = view.getComputedStyle(doc.getElementById("info-panel")).backgroundColor;
  check(
    view.getComputedStyle(body).backgroundColor === expected,
    "Context chooser uses Inspector surface theme"
  );
  check(
    list.scrollHeight > list.clientHeight && list.clientHeight <= 152,
    "long chooser list is bounded and scrollable"
  );
  const before = map.getZoom();
  list.dispatchEvent(new view.WheelEvent("wheel", { bubbles: true, deltaY: -150 }));
  await delay();
  check(map.getZoom() === before, "chooser wheel does not zoom map");
  let resizePans = 0;
  map.on("autopanstart", () => {
    resizePans += 1;
  });
  host.style.height = "200px";
  map.invalidateSize({ pan: false });
  await delay();
  check(list.clientHeight <= 92, "chooser bounds update with a shorter viewport");
  check(resizePans === 0, "chooser refitting does not add a pan");
  host.querySelector(".context-popup-reference").click();
  check(action === "exact-item", "secondary reference route retains exact identity");
  openContextResultsPopup(options);
  host.querySelector(".context-reference-action").click();
  check(action === "0", "primary route retains exact entry");
  const close = openContextResultsPopup(options);
  map.closePopup(close);
  check(doc.activeElement === marker.getElement(), "chooser dismissal returns focus to marker");
  map.closePopup(popup);
  map.remove();
  host.remove();
  delete window.L;
}

document.getElementById("run").addEventListener("click", async (event) => {
  event.target.disabled = true;
  results.textContent = "";
  status.textContent = "Running…";
  try {
    await run();
  } catch (error) {
    status.textContent = `FAIL: ${error.message}`;
  } finally {
    event.target.disabled = false;
  }
});
document
  .getElementById("theme")
  .addEventListener("click", () => frame.contentDocument.getElementById("theme-toggle").click());
document.getElementById("matrix").addEventListener("click", async (event) => {
  event.target.disabled = true;
  results.textContent = "";
  try {
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1280, 720],
      [390, 720],
      [960, 360]
    ]) {
      for (const theme of ["dark", "light"]) {
        frame.style.width = `${width}px`;
        frame.style.height = `${height}px`;
        await new Promise((resolve) => {
          frame.addEventListener("load", resolve, { once: true });
          frame.contentWindow.location.reload();
        });
        await until(
          () => frame.contentDocument.querySelector("#map-workspace")?.dataset.mapReady === "true",
          "matrix initialization"
        );
        frame.contentDocument.documentElement.dataset.theme = theme;
        results.textContent += `\n${width}×${height} ${theme}\n`;
        await run();
      }
    }
    status.textContent = "PASS: all ten size/theme combinations";
  } catch (error) {
    status.textContent = `FAIL: ${error.message}`;
  } finally {
    event.target.disabled = false;
  }
});
