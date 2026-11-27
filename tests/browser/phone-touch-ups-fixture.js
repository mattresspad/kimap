/* global document, requestAnimationFrame */
const frame = document.getElementById("map");
const status = document.getElementById("status");
const results = document.getElementById("results");
const delay = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 70)));
async function until(predicate, description) {
  const deadline = Date.now() + 60000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await delay();
  }
}
function check(condition, description) {
  if (!condition) throw new Error(description);
  results.textContent += `PASS ${description}\n`;
}

async function run() {
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  const get = (selector) => doc.querySelector(selector);
  const click = (selector) => get(selector).click();
  const route = () => get("#viewport-workbench").dataset.phoneForeground;
  const escape = () =>
    doc.dispatchEvent(
      new view.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true
      })
    );
  const resize = async (width, height, phone) => {
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    await until(
      () => get("#viewport-workbench").dataset.phone === String(phone) &&
        Math.abs(get("#viewport-workbench").getBoundingClientRect().width - width) < 1 &&
        Math.abs(view.innerHeight - height) < 1,
      `${width}px tier`
    );
    await delay();
  };
  await until(() => get("#map-workspace")?.dataset.mapReady === "true", "application ready");
  await resize(390, 844, true);
  check(route() === "map", "phone starts at the quiet map");
  const belt = get("#phone-belt").getBoundingClientRect();
  check(belt.bottom <= view.innerHeight + 1, "phone belt fits inside the viewport");

  const map = get("#map-container").getBoundingClientRect();
  const marker = [...doc.querySelectorAll(".leaflet-marker-icon[data-relation]")].find((node) => {
    const rect = node.getBoundingClientRect();
    return (
      rect.left > map.left + 20 &&
      rect.right < map.right - 20 &&
      rect.top > map.top + 70 &&
      rect.bottom < belt.top - 90
    );
  });
  check(Boolean(marker), "a town marker is available on the resting map");
  marker.click();
  await until(() => route() === "townCard", "phone town card");
  await delay();
  check(doc.activeElement === get("#phone-town-card"), "town card receives keyboard focus");
  check(
    !get("#phone-town-card").hidden && !get(".custom-town-popup"),
    "phone town uses its fixed card without a Leaflet popup"
  );
  check(
    get("#phone-town-card").getBoundingClientRect().bottom <= belt.top - 8,
    "town card clears the belt"
  );
  click("#phone-town-card-close");
  check(
    route() === "map" && !get("#phone-context-btn").disabled,
    "closing the town card retains selection"
  );
  marker.click();
  escape();
  check(route() === "map", "Escape dismisses the town card");
  marker.click();
  const mapSurface = get("#map-container").getBoundingClientRect();
  get("#map-container").dispatchEvent(
    new view.MouseEvent("click", {
      bubbles: true,
      clientX: mapSurface.left + mapSurface.width / 2,
      clientY: mapSurface.top + mapSurface.height / 2
    })
  );
  check(route() === "map", "a bare-map tap dismisses the town card");
  marker.click();
  click("#phone-town-card-context");
  await until(() => route() === "inspector", "town Inspector");
  const title = get("#info-panel-title").textContent;

  click("#phone-inspector-transparency-btn");
  check(!get("#phone-inspector-transparency").hidden, "identity icon opens transparency slider");
  check(
    get("#phone-inspector-transparency-btn").getBoundingClientRect().left <=
      get("#info-panel-title-ribbon").getBoundingClientRect().left + 3,
    "Inspector transparency control aligns with the left panel edge"
  );
  const range = get("#phone-inspector-transparency-range");
  range.value = "70";
  range.dispatchEvent(new view.Event("input", { bubbles: true }));
  check(
    get("#info-panel").dataset.inspectorTransparent === "true" &&
      get("#phone-inspector-transparency-value").textContent === "70%",
    "transparency adjusts the Map Context background"
  );
  escape();
  check(
    route() === "inspector" && get("#phone-inspector-transparency").hidden,
    "Escape closes transparency before Inspector"
  );
  check(
    doc.activeElement === get("#phone-inspector-transparency-btn"),
    "slider Escape returns focus to its launcher"
  );

  click("#quick-search-launcher");
  const search = get("#quick-search-input");
  search.value = "Bloodrum";
  search.dispatchEvent(new view.Event("input", { bubbles: true }));
  await until(
    () =>
      [...doc.querySelectorAll("#quick-search-results [role=option]")].some(
        (node) => node.textContent.includes("Bloodrum") && node.textContent.includes("Item")
      ),
    "reference search result"
  );
  [...doc.querySelectorAll("#quick-search-results [role=option]")]
    .find((node) => node.textContent.includes("Bloodrum") && node.textContent.includes("Item"))
    .click();
  await until(() => get("#info-panel").dataset.contextMode === "reference", "reference Inspector");
  check(
    get("#phone-inspector-transparency-btn").hidden &&
      get("#info-panel").dataset.contextMode === "reference",
    "reference Inspector stays opaque and has no transparency control"
  );
  click("#info-panel-map-context-btn");
  check(
    get("#info-panel").dataset.contextMode === "geographic" &&
      get("#phone-inspector-transparency-range").value === "70",
    "Map Context restores the session transparency choice"
  );
  const beforeZoom = marker.getBoundingClientRect();
  click("#info-panel-zoom-btn");
  await until(() => {
    if (!marker.isConnected) return true;
    const afterZoom = marker.getBoundingClientRect();
    return (
      Math.abs(afterZoom.left - beforeZoom.left) > 1 || Math.abs(afterZoom.top - beforeZoom.top) > 1
    );
  }, "map movement behind Inspector");
  check(route() === "inspector", "map moves behind the translucent Inspector");

  const inspectorScroller = get("#info-panel-content");
  inspectorScroller.scrollTop = Math.min(
    40,
    inspectorScroller.scrollHeight - inspectorScroller.clientHeight
  );
  const inspectorScroll = inspectorScroller.scrollTop;
  click("#info-panel-layout-btn");
  await until(
    () => get("#town-layout-backdrop").getAttribute("aria-hidden") === "false",
    "town layout"
  );
  check(
    get("#town-layout-window").getBoundingClientRect().bottom <=
      get("#phone-belt").getBoundingClientRect().top - 7,
    "town layout and footer stop above the belt"
  );
  click("#close-town-layout-btn");
  await delay();
  check(
    route() === "inspector" &&
      get("#info-panel-title").textContent === title &&
      inspectorScroller.scrollTop === inspectorScroll,
    "closing town layout restores its originating Inspector and scroll"
  );
  check(
    doc.activeElement === get("#info-panel-layout-btn"),
    "layout close restores launcher focus"
  );
  click("#info-panel-layout-btn");
  await until(
    () => get("#town-layout-backdrop").getAttribute("aria-hidden") === "false",
    "town layout reopen"
  );
  click("#phone-layers-btn");
  check(
    doc.querySelectorAll("#phone-layers-tray .phone-layer-section").length === 2 &&
      view.getComputedStyle(get("#phone-layers-tray > header > strong")).color !==
        view.getComputedStyle(get("#phone-layers-tray .phone-layer-section h3")).color,
    "Layers tray has two distinct summary sections and a gold title"
  );
  check(
    route() === "layersTray" && get("#town-layout-backdrop").getAttribute("aria-hidden") === "true",
    "belt route dismisses town layout and opens the tapped route"
  );
  click("#phone-map-content-btn");
  check(
    route() === "mapContent" &&
      get("#map-content-control .layers-close-btn").getAttribute("aria-label") === "Back to Layers",
    "phone chooser uses the named down-arrow route"
  );
  click("#map-content-control .layers-close-btn");
  check(route() === "layersTray", "chooser returns to Layers tray");
  await delay();
  check(doc.activeElement === get("#phone-layers-tray"), "chooser return focuses Layers tray");
  click("#phone-world-views-btn");
  escape();
  check(route() === "layersTray", "Escape returns World Views to Layers tray");
  click("#phone-layers-btn");
  check(route() === "map", "Layers belt closes tray to map");

  click("#phone-tasks-btn");
  const utilities = get("#phone-workbench-utilities summary").getBoundingClientRect();
  const close = get("#phone-tasks-close-btn").getBoundingClientRect();
  check(
    Math.abs(utilities.top - close.top) < 1 && utilities.height >= 44,
    "Utilities and Close are vertically aligned touch targets"
  );
  check(
    get("#phone-tasks-close-btn").textContent.trim() === "×" &&
      get("#phone-workbench-utilities summary img").getAttribute("src").includes("utilities-cog.svg") &&
      get("#browse-context-collection-back-btn img").getAttribute("src").includes("back-arrow.svg"),
    "Workbench X and decorative Utilities and Context back icons are present"
  );
  click("#phone-tasks-close-btn");
  click("#phone-plan-btn");
  check(
    get("#map-tool-shelf-close-btn").getBoundingClientRect().height >= 44 &&
      view.getComputedStyle(get("#map-tool-shelf-close-btn")).borderTopWidth === "1px",
    "Plan Tools uses an outlined 44px phone close control"
  );
  click("#phone-plan-btn");
  await resize(320, 650, true);
  check(
    get("#phone-belt").getBoundingClientRect().bottom <= view.innerHeight + 1,
    "320px phone belt remains visible"
  );
  await resize(375, 667, true);
  check(
    get("#phone-belt").getBoundingClientRect().bottom <= view.innerHeight + 1,
    "375px phone belt remains visible"
  );
  click("#phone-context-btn");
  click("#info-panel-layout-btn");
  await until(
    () => get("#town-layout-backdrop").getAttribute("aria-hidden") === "false",
    "375px layout"
  );
  check(
    get("#town-layout-window").getBoundingClientRect().bottom <=
      get("#phone-belt").getBoundingClientRect().top - 7,
    "375px layout and footer clear the belt"
  );
  click("#close-town-layout-btn");
  click("#phone-context-btn");
  await resize(390, 500, true);
  click("#phone-context-btn");
  click("#info-panel-layout-btn");
  await until(
    () => get("#town-layout-backdrop").getAttribute("aria-hidden") === "false",
    "short layout"
  );
  check(
    get("#town-layout-window").getBoundingClientRect().bottom <=
      get("#phone-belt").getBoundingClientRect().top - 7,
    "short landscape layout clears the belt"
  );
  escape();
  check(route() === "inspector", "Escape restores Inspector from short layout");
  await resize(599, 800, true);
  check(!get("#phone-belt").hidden, "599px boundary retains the phone belt");
  await resize(600, 800, false);
  check(
    get("#phone-belt").hidden && get("#info-panel").dataset.inspectorTransparent === "false",
    "600px boundary retains narrow presentation and opaque Inspector"
  );
  await resize(390, 844, true);
  click("#phone-tasks-btn");
  click("#phone-workbench-utilities summary");
  click("#phone-reset-workspace-btn");
  check(
    route() === "map" && get("#phone-inspector-transparency-range").value === "0",
    "Restore Default Workspace clears the transparency setting"
  );

  const retainedSelectionTitle = get("#info-panel-title").textContent;
  const originalMatchMedia = view.matchMedia;
  const originalScreenDescriptor = Object.getOwnPropertyDescriptor(view, "screen");
  try {
    Object.defineProperty(view, "screen", {
      configurable: true,
      value: { width: 375, height: 667 }
    });
    view.matchMedia = (query) => query === "(any-pointer: coarse)"
      ? { matches: true }
      : originalMatchMedia.call(view, query);
    click("#phone-layers-btn");
    await resize(667, 375, true);
    check(
      route() === "layersTray" && get("#phone-belt").getBoundingClientRect().bottom <= 375 &&
        view.getComputedStyle(get("#workbench-hud-region")).display === "none" &&
        get("#info-panel-title").textContent === retainedSelectionTitle,
      "375×667 phone rotation retains Layers, selection, belt, and hidden Scanner"
    );
    await resize(375, 667, true);
    await resize(390, 844, true);
    await resize(844, 390, true);
    const landscapeTray = get("#phone-layers-tray").getBoundingClientRect();
    const landscapeBelt = get("#phone-belt").getBoundingClientRect();
    check(
      route() === "layersTray" && get("#viewport-workbench").dataset.layoutClass === "narrow" &&
        landscapeTray.top >= get("#top-bar").getBoundingClientRect().bottom - 1 &&
        landscapeTray.bottom <= landscapeBelt.top + 1 &&
        view.getComputedStyle(get("#phone-layers-tray")).overflowY === "auto",
      "390×844 phone rotation keeps the narrow phone route and a scrollable Layers tray"
    );
  } finally {
    view.matchMedia = originalMatchMedia;
    if (originalScreenDescriptor) Object.defineProperty(view, "screen", originalScreenDescriptor);
    else delete view.screen;
  }
  await resize(667, 375, false);
  check(
    get("#phone-belt").hidden && view.getComputedStyle(get("#workbench-hud-region")).display !== "none",
    "fine-pointer landscape returns to the existing narrow layout and Scanner"
  );
}

document.getElementById("run").addEventListener("click", async () => {
  results.textContent = "";
  status.textContent = "Running…";
  try {
    await run();
    status.textContent = "All phone touch-up checks passed.";
  } catch (error) {
    results.textContent += `FAIL ${error.message}\n`;
    status.textContent = "Phone touch-up checks failed.";
    throw error;
  }
});
frame.addEventListener("load", () => {
  status.textContent = "Local application ready to test.";
});
