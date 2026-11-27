/* global document */
const frame = document.getElementById("map");
const results = document.getElementById("results");
const status = document.getElementById("status");
const delay = (ms = 90) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 60000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay();
  }
}
function check(condition, label) {
  if (!condition) throw new Error(label);
  results.textContent += `PASS ${label}\n`;
}
async function ready() {
  await until(
    () => frame.contentDocument.querySelector("#world-views-btn")?.disabled === false,
    "choosers initialized"
  );
}
async function run({ timers = false } = {}) {
  await ready();
  const doc = frame.contentDocument,
    view = frame.contentWindow;
  const get = (selector) => doc.querySelector(selector);
  const click = (selector) => get(selector).click();
  const world = get("#world-views-control"),
    content = get("#map-content-control");
  const launcher = get("#map-layer-family-launchers");
  const groups = [...world.querySelectorAll("[data-world-view-group]")];
  const openWorld = () => {
    if (world.hidden) click("#world-views-btn");
  };
  const openContent = () => {
    if (content.hidden) click("#map-content-btn");
  };
  const pointer = (node, type = "pointermove", pointerType = "mouse") => {
    const rect = node?.getBoundingClientRect();
    (node || doc.body).dispatchEvent(
      new view.PointerEvent(type, {
        bubbles: true,
        pointerType,
        clientX: rect ? rect.left + rect.width / 2 : -10,
        clientY: rect ? rect.top + rect.height / 2 : -10
      })
    );
  };
  const key = (node, value = "Tab") =>
    node.dispatchEvent(
      new view.KeyboardEvent("keydown", {
        bubbles: true,
        key: value
      })
    );
  click("#reset-panel-btn");
  await delay();
  pointer(launcher);
  openWorld();
  check(
    groups.map((g) => g.open).join() === "true,false,false,false",
    "only Geography starts open"
  );
  check(
    groups.map((g) => g.querySelector("summary").textContent).join("|") ===
      "Geography|Fertility|Mining & Resources|Weather & Hazards",
    "group titles and order"
  );
  const ids = [...world.querySelectorAll("[data-layer-id]")].map((row) => row.dataset.layerId);
  check(
    ids.join() ===
      "none,political,spawnAreas,spawnBorders,biomes,arid,green,swamp,copper,iron,stone,water,acidGround,acidRain,acidWater,burning,duststorm,gas,debugGrid",
    "complete World Views order"
  );
  check(
    doc.querySelectorAll("#layer-choice-roads").length === 1 &&
      content.contains(get("#layer-choice-roads")),
    "Road Network exists only in Map Content"
  );
  check(get("#layer-choice-spawnBorders").type === "checkbox", "Spawn Borders stays independent");
  for (const group of groups) if (!group.open) group.querySelector("summary").click();
  await delay();
  const retainedRows = [...world.querySelectorAll(".layer-choice-row")];
  const summary = groups[2].querySelector("summary");
  summary.focus();
  key(summary);
  const options = world.querySelector(".layers-control-options");
  options.scrollTop = 90;
  const scroll = options.scrollTop;
  click("#wt-anchor");
  await delay();
  check(
    doc.activeElement === summary && options.scrollTop === scroll,
    "unrelated HUD changes retain focus and scroll"
  );
  check(
    retainedRows.every((node) => node === get(`[data-layer-id="${node.dataset.layerId}"]`)),
    "updates retain row DOM"
  );
  openContent();
  openWorld();
  check(
    groups.every((g) => g.open),
    "sibling handoff remembers disclosures"
  );
  click("#workbench-focus-map-btn");
  check(world.hidden, "Focus Map dismisses chooser");
  click("#workbench-focus-map-btn");
  openWorld();
  check(
    groups.every((g) => g.open),
    "Focus Map retains disclosures"
  );
  await until(() => !get("#layer-choice-arid").disabled, "environmental layers ready");
  if (!get("#layer-choice-spawnBorders").checked) click("#layer-choice-spawnBorders");
  const radios = [...world.querySelectorAll('input[type="radio"]')];
  for (const input of radios.filter((node) => !node.disabled)) {
    input.click();
    check(
      radios.filter((node) => node.checked).length === 1 && input.checked,
      `${input.id} preserves single surface choice`
    );
    check(get("#layer-choice-spawnBorders").checked, "surface choice retains Spawn Borders");
  }
  click("#layer-choice-none");
  openContent();
  const road = get("#layer-choice-roads");
  if (!road.checked) road.click();
  check(!get('[data-layer-id="roads"] button').disabled, "active roads enable configuration cog");
  get('[data-layer-id="roads"] button').click();
  await delay();
  check(
    content.hidden && !get("#layer-configuration-roads").disabled,
    "road cog hands off to existing configuration"
  );
  check(
    get("#plan-layer-reference").textContent.includes("Road Network") &&
      !get("#plan-layer-map-content").textContent.includes("Road Network"),
    "Plan retains reference-overlay classification"
  );
  openContent();
  road.click();
  check(
    get("#layer-configuration-roads-status").textContent.includes("Map Content"),
    "inactive road explanation names Map Content"
  );
  openWorld();
  const pane = get(".leaflet-map-pane");
  const transform = pane.style.transform;
  let escapedWheel = false;
  const wheelListener = () => {
    escapedWheel = true;
  };
  doc.addEventListener("wheel", wheelListener);
  options.dispatchEvent(
    new view.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 150 })
  );
  doc.removeEventListener("wheel", wheelListener);
  await delay();
  check(
    !escapedWheel && pane.style.transform === transform,
    "chooser wheel stays isolated from map"
  );
  for (const surface of [world, content]) {
    if (surface === world) openWorld();
    else openContent();
    const bounds = () => {
      const rect = surface.getBoundingClientRect(),
        map = get("#map-workspace").getBoundingClientRect();
      check(
        rect.left >= map.left - 1 &&
          rect.right <= map.right + 1 &&
          rect.top >= map.top - 1 &&
          rect.bottom <= map.bottom + 1,
        "chooser bounded to workspace"
      );
      check(surface.scrollWidth <= surface.clientWidth + 1, "chooser has no horizontal overflow");
      const body = surface.querySelector(".layers-control-options");
      check(
        view.getComputedStyle(body).overflowY === "auto",
        "only options provide vertical scrolling"
      );
    };
    await delay();
    bounds();
    for (let corner = 0; corner < 2; corner++) {
      click("#wt-anchor");
      click("#wt-toggle");
      await delay();
      bounds();
      click("#wt-toggle");
    }
  }
  if (timers) {
    for (const panel of [world, content]) {
      const open = panel === world ? openWorld : openContent;
      pointer(launcher);
      open();
      pointer(panel);
      pointer(null);
      await delay(650);
      check(!panel.hidden, "departure survives the old 600ms deadline");
      pointer(launcher);
      await delay(700);
      check(!panel.hidden, "return to launcher cancels pending closure");
      pointer(panel);
      pointer(null);
      await delay(1300);
      check(panel.hidden, "mouse departure closes after generous grace");
      pointer(launcher);
      open();
      const focus = panel.querySelector(".layers-control-options");
      pointer(null);
      focus.focus();
      key(focus);
      await delay(1300);
      check(!panel.hidden, "keyboard focus protects panel");
      pointer(null);
      await delay(1300);
      check(panel.hidden, "mouse movement resumes auto-hide despite incidental focus");
      pointer(launcher, "pointerdown", "touch");
      open();
      pointer(null, "pointermove", "touch");
      await delay(1300);
      check(!panel.hidden, "touch does not auto-hide");
      pointer(null, "pointerdown", "touch");
      check(panel.hidden, "touch outside click dismisses");
      pointer(launcher);
      open();
      panel.querySelector(".layers-pin-btn").click();
      pointer(null, "pointerdown");
      await delay(1300);
      check(!panel.hidden, "pinned panel survives departure and outside click");
      key(doc.body, "Escape");
      await delay();
      check(panel.hidden, "Escape closes pinned panel");
    }
  }
  // A real geographic Inspector changes usable map space; narrow opening performs its normal handoff.
  click("#reset-panel-btn");
  const input = get("#quick-search-input");
  if (!input.getClientRects().length) click("#quick-search-launcher");
  input.value = "Shem";
  input.dispatchEvent(new view.Event("input", { bubbles: true }));
  await until(
    () =>
      [...doc.querySelectorAll("#quick-search-results [role=option]")].some(
        (n) => n.textContent.includes("Shem") && n.textContent.includes("Spawn Area")
      ),
    "Shem search"
  );
  [...doc.querySelectorAll("#quick-search-results [role=option]")]
    .find((n) => n.textContent.includes("Shem") && n.textContent.includes("Spawn Area"))
    .click();
  await delay();
  pointer(launcher);
  openWorld();
  await delay();
  if (get("#viewport-workbench").dataset.layoutClass !== "narrow") {
    check(
      world.getBoundingClientRect().right <= get("#info-panel").getBoundingClientRect().left,
      "chooser clears visible Inspector"
    );
  } else
    check(
      get("#viewport-workbench").dataset.activeSheet !== "inspector",
      "narrow chooser takes over sheet space"
    );
  check(
    groups.map((g) => g.open).join() === "true,false,false,false",
    "workspace reset restores group defaults"
  );
  status.textContent = `PASS ${view.innerWidth}×${view.innerHeight} ${doc.documentElement.dataset.theme}`;
}

async function faults() {
  const html = await (await fetch("/")).text();
  for (const mode of ["delayed", "failed"]) {
    frame.removeAttribute("srcdoc");
    await new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.src = "/tests/browser/layer-chooser-shell.html";
    });
    // A same-origin shell retains a real HTTP URL for the application's URL resolvers.
    const target = frame.contentDocument;
    target.open();
    target.write(
      html.replace(
        "<head>",
        `<head><base href="/"><script src="/tests/browser/chooser-raster-fault.js" data-mode="${mode}"></script>`
      )
    );
    target.close();
    await until(
      () => frame.contentDocument.documentElement.dataset.testRaster === mode,
      "raster interception"
    );
    await ready();
    const doc = frame.contentDocument,
      get = (selector) => doc.querySelector(selector);
    get("#world-views-btn").click();
    const panel = get("#world-views-control");
    const arid = get("#layer-choice-arid"),
      biome = get("#layer-choice-biomes");
    const group = get('[data-world-view-group="fertility"]');
    group.querySelector("summary").click();
    panel.querySelector(".layers-pin-btn").click();
    const summary = group.querySelector("summary");
    summary.focus();
    const body = panel.querySelector(".layers-control-options");
    body.scrollTop = 30;
    const scroll = body.scrollTop;
    check(arid.disabled && !biome.disabled, `${mode}: only raster-dependent choices disabled`);
    check(
      !get("#layer-choice-roads").disabled && !get("#layer-choice-towns").disabled,
      `${mode}: ordinary Map Content remains available`
    );
    biome.click();
    if (mode === "delayed") {
      frame.contentWindow.postMessage("release-test-raster", "*");
      await until(() => !arid.disabled, "late raster enabled");
      check(
        arid === get("#layer-choice-arid") && group.open && biome.checked,
        "late raster retains rows, disclosure and user-selected Biomes"
      );
      check(
        doc.activeElement === summary &&
          body.scrollTop === scroll &&
          panel.querySelector(".layers-pin-btn").getAttribute("aria-pressed") === "true",
        "late raster retains keyboard focus, scroll and pin"
      );
    } else {
      await until(
        () => get('[data-layer-id="arid"] .layer-choice-state').textContent === "Unavailable",
        "explicit unavailable state"
      );
      check(
        group.open && biome.checked && !panel.hidden,
        "raster failure preserves usable chooser"
      );
    }
  }
  status.textContent = "PASS delayed and failed raster cases";
}

async function execute(mode) {
  const buttons = [...document.querySelectorAll("header button")];
  buttons.forEach((button) => {
    button.disabled = true;
  });
  results.textContent = "";
  status.textContent = "Running…";
  try {
    if (mode === "faults") await faults();
    else if (mode === "run") await run({ timers: true });
    else {
      for (const [width, height] of [
        [1920, 1080],
        [1366, 768],
        [1280, 720],
        [390, 720],
        [320, 720],
        [960, 360]
      ]) {
        for (const theme of ["dark", "light"]) {
          frame.style.width = `${width}px`;
          frame.style.height = `${height}px`;
          frame.removeAttribute("srcdoc");
          await new Promise((resolve) => {
            frame.addEventListener("load", resolve, { once: true });
            frame.src = "/";
          });
          await ready();
          frame.contentDocument.documentElement.dataset.theme = theme;
          results.textContent += `\n${width}×${height} ${theme}\n`;
          await run();
        }
      }
      status.textContent = "PASS all twelve size/theme combinations";
    }
  } catch (error) {
    status.textContent = `FAIL ${error.message}`;
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}
for (const id of ["run", "matrix", "faults"])
  document.getElementById(id).addEventListener("click", () => void execute(id));
