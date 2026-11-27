/** Real application checks shared with the reporting placement matrix. */
export async function checkFactionColorsWidget(doc, check, delay) {
  const view = doc.defaultView;
  const get = (selector) => doc.querySelector(selector);
  const widget = get("#faction-colors-widget");
  const body = get(".faction-colors-widget-body");
  const toggle = get(".faction-colors-widget-search-toggle");
  const search = get("#faction-colors-widget-search");
  const presented = (node) => node && !node.hidden && node.getBoundingClientRect().height > 0;
  const world = () => {
    if (get("#world-views-control").hidden) get("#world-views-btn").click();
  };
  const input = (value) => {
    search.value = value;
    search.dispatchEvent(new view.Event("input", { bubbles: true }));
  };
  const key = (node) =>
    node.dispatchEvent(
      new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
  get("#reset-panel-btn").click();
  world();
  get("#layer-choice-none").click();
  const info = get(".political-mode-info");
  info.open = true;
  const opener = get(".political-mode-info-widget");
  check(
    opener.disabled && opener.title.includes("Enable Political View"),
    "widget explains inactive layer"
  );
  check(
    view.getComputedStyle(get(".political-mode-info-widget-reason")).clipPath === "inset(50%)",
    "inactive-layer explanation is accessible without occupying World Views space"
  );
  check(get(".political-mode-info-help").textContent === "Political Mode Help", "short Help label");
  get("#layer-choice-political").click();
  await delay();
  for (const button of info.querySelectorAll("button")) {
    check(
      view.getComputedStyle(button).whiteSpace === "nowrap" &&
        button.scrollWidth <= button.clientWidth + 1,
      "all three Political Mode Info buttons fit one line"
    );
  }
  get("#world-views-control .layers-pin-btn").click();
  opener.click();
  await delay();
  check(
    get("#world-views-control").hidden &&
      get("#world-views-control .layers-pin-btn").getAttribute("aria-pressed") === "false",
    "widget opener closes and unpins World Views"
  );
  const planToggle = get("#faction-colors-widget-open-btn");
  check(
    opener.getAttribute("aria-pressed") === "true" &&
      planToggle.getAttribute("aria-pressed") === "true",
    "both entry points reflect remembered open state"
  );
  world();
  get("#world-views-control .layers-pin-btn").click();
  opener.focus({ preventScroll: true });
  opener.click();
  await delay();
  check(
    widget.hidden &&
      !get("#world-views-control").hidden &&
      get("#world-views-control .layers-pin-btn").getAttribute("aria-pressed") === "true" &&
      doc.activeElement === opener,
    "toggle off preserves chooser pin and activating focus"
  );
  check(
    opener.getAttribute("aria-pressed") === "false" &&
      planToggle.getAttribute("aria-pressed") === "false",
    "both entry points synchronize closure"
  );
  opener.click();
  await delay();
  const editorIds = [...doc.querySelectorAll("#political-faction-list [data-faction-id]")].map(
    (row) => row.dataset.factionId
  );
  const widgetRows = [...widget.querySelectorAll("li")];
  check(
    JSON.stringify(widgetRows.map((row) => row.dataset.factionId)) === JSON.stringify(editorIds),
    "widget consumes every included faction in palette order"
  );
  check(!widget.querySelector("li button, li input"), "rows are read-only");
  if (presented(widget) && widget.dataset.mode !== "folded") {
    check(doc.activeElement === toggle, "opening focuses search toggle");
    const stack = get("#map-navigation-stack").getBoundingClientRect();
    check(
      widget.getBoundingClientRect().bottom <= stack.bottom + 1,
      "widget never overhangs cursor frame"
    );
    check(
      (body.getBoundingClientRect().height - 4) % 20 === 0,
      "normal list viewport fits complete rows"
    );
    const raster = get(".political-view-overlay");
    const image = get(".kimap-base-map-image");
    const rasterSource = raster.src,
      imageSource = image.src;
    toggle.click();
    await delay();
    check(doc.activeElement === search, "search on demand focuses its input");
    check(
      widget.getBoundingClientRect().bottom <= stack.bottom + 1 &&
        (body.getBoundingClientRect().height - 4) % 20 === 0,
      "search preserves bottom boundary and row fitting"
    );
    input(widgetRows[0].dataset.factionId);
    await delay();
    check(
      widget.querySelectorAll("li:not([hidden])").length === 1,
      "exact ID search filters the independent widget list"
    );
    check(!get("#political-faction-search").value, "editor search unchanged");
    world();
    get("#layer-choice-none").click();
    await delay();
    check(widget.hidden && widget.inert, "layer-off widget is hidden and inaccessible");
    get("#layer-choice-political").click();
    get("#world-views-btn").click();
    await delay();
    check(
      !widget.hidden && search.value === widgetRows[0].dataset.factionId,
      "layer return remembers open state and search"
    );
    const paneTransform = get(".leaflet-map-pane").style.transform;
    toggle.click();
    await delay();
    body.dispatchEvent(new view.WheelEvent("wheel", { deltaY: 300, bubbles: true }));
    await delay();
    check(
      get(".leaflet-map-pane").style.transform === paneTransform,
      "widget wheel does not zoom map"
    );
    check(
      get(".political-view-overlay") === raster &&
        get(".kimap-base-map-image") === image &&
        raster.src === rasterSource &&
        image.src === imageSource,
      "widget choices preserve raster and base-image identity/source"
    );
    get("#workbench-focus-map-btn").click();
    await delay();
    check(widget.hidden, "Focus Map hides widget");
    get("#workbench-focus-map-btn").click();
    await delay();
    check(!widget.hidden, "Focus Map return restores widget");
    toggle.focus();
    key(toggle);
    await delay();
    check(
      widget.hidden && doc.activeElement === get("#world-views-btn"),
      "widget Escape returns to visible World Views launcher"
    );
  }
  if (opener.getAttribute("aria-pressed") === "true") {
    world();
    opener.click();
    await delay();
  }
  world();
  get(".political-mode-info-configure").click();
  await delay();
  const plan = get("#faction-colors-widget-open-btn");
  const route = get("#workbench-route-plan");
  check(
    plan.parentElement.previousElementSibling.classList.contains("political-legend") &&
      plan.parentElement.nextElementSibling.classList.contains("faction-colors-roster"),
    "Plan opener sits between interpretation and roster"
  );
  const scroll = route.scrollTop;
  plan.click();
  await delay();
  check(
    !get("#faction-colors-panel").hidden && route.scrollTop === scroll,
    "Plan opener retains route and scroll"
  );
  check(
    plan.textContent.includes("Close Faction Colors Widget") &&
      plan.getAttribute("aria-pressed") === "true" &&
      opener.getAttribute("aria-pressed") === "true",
    "Plan action wording and both pressed states synchronize"
  );
  plan.focus({ preventScroll: true });
  plan.click();
  await delay();
  check(
    widget.hidden &&
      doc.activeElement === plan &&
      route.scrollTop === scroll &&
      plan.textContent.includes("Open Faction Colors Widget") &&
      opener.getAttribute("aria-pressed") === "false",
    "Plan toggle closes without leaving route, scroll, or focus"
  );
  plan.click();
  await delay();
  if (!widget.hidden) {
    get(".faction-colors-widget-close").click();
    await delay();
    check(
      doc.activeElement === plan && widget.hidden,
      "explicit close returns to visible Plan opener"
    );
  }
  // Optional image failures retain the complete button labels and navigation.
  for (const image of doc.querySelectorAll(
    ".political-mode-info img, .faction-colors-widget-entry img"
  )) {
    image.dispatchEvent(new view.Event("error"));
    check(
      image.hidden && image.closest("button").textContent.trim().length > 0,
      "failed artwork retains button text"
    );
  }
  get("#reset-panel-btn").click();
  world();
  opener.click();
  await delay();
  check(!search.value && !search.getBoundingClientRect().height, "reset clears and closes search");
  get("#reset-panel-btn").click();
  check(widget.hidden, "reset closes widget");
}
