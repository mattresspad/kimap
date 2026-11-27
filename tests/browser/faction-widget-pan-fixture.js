// Test-only instrumentation. The application exposes no profiling or map-control API.
export async function checkWidgetPanning(frame, check, delay, output, subject = "political") {
  const doc = frame.contentDocument,
    view = frame.contentWindow;
  const get = (selector) => doc.querySelector(selector);
  const nextFrame = () => new Promise((resolve) => view.requestAnimationFrame(resolve));
  const until = async (predicate, label) => {
    const deadline = Date.now() + 30000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
      await delay();
    }
  };
  const world = () => {
    if (get("#world-views-control").hidden) get("#world-views-btn").click();
  };
  const widget = (open) => {
    const button = get(".political-mode-info-widget");
    if ((button.getAttribute("aria-pressed") === "true") !== open) {
      world();
      button.click();
    }
    if (!get("#world-views-control").hidden) get("#world-views-btn").click();
  };
  const setPlacement = async (value) => {
    get("#cursor-controls-btn").click();
    get("#cursor-controls-pointProbe-tab").click();
    const subjectSelect = get("#cursor-controls-pointProbe-subject");
    subjectSelect.value = subject;
    subjectSelect.dispatchEvent(new view.Event("change", { bubbles: true }));
    const select = get("#cursor-controls-pointProbe-placement");
    select.value = value;
    select.dispatchEvent(new view.Event("change", { bubbles: true }));
    get("#cursor-controls-btn").click();
    await delay();
  };
  const mouse = (node, type, x, y, buttons = 0) =>
    node.dispatchEvent(
      new view.MouseEvent(type, {
        view,
        clientX: x,
        clientY: y,
        button: 0,
        buttons,
        bubbles: true,
        cancelable: true
      })
    );
  const settleMovement = async () => {
    // Mouseup can start Leaflet inertia. A fixed delay may mistake its final fit for idle work.
    const deadline = Date.now() + 10000;
    let previous = null;
    let stable = 0;
    while (stable < 6) {
      await nextFrame();
      const transform = get(".leaflet-map-pane").style.transform;
      stable = transform === previous ? stable + 1 : 0;
      previous = transform;
      if (Date.now() > deadline) throw new Error("Map movement did not settle");
    }
  };
  const clickPoint = (map, x, y) => {
    map.dispatchEvent(
      new view.PointerEvent("pointerdown", { clientX: x, clientY: y, bubbles: true })
    );
    mouse(map, "mousedown", x, y, 1);
    mouse(doc, "mouseup", x, y);
    mouse(map, "click", x, y);
  };
  const originalUpdate = view.L.Popup.prototype.update;
  let popupUpdates = 0;
  view.L.Popup.prototype.update = function (...args) {
    popupUpdates++;
    return originalUpdate.apply(this, args);
  };
  const results = [];
  try {
    get("#reset-panel-btn").click();
    world();
    get("#layer-choice-political").click();
    get("#world-views-btn").click();
    // A pending, legitimate resolution replacement after setup zoom must settle before comparing pans.
    for (let step = 0; step < 2; step++) {
      const nextSize = Math.min(8192, Number(get("#map-container").dataset.baseMapResolution) * 2);
      get("#map-zoom-in-btn").click();
      await until(
        () =>
          get("#map-container").dataset.baseMapResolution === String(nextSize) &&
          !get("#map-container").classList.contains("leaflet-zoom-anim") &&
          doc.querySelectorAll(".kimap-base-map-image").length === 1,
        "setup zoom image replacement"
      );
    }
    for (const theme of ["dark", "light"]) {
      doc.documentElement.dataset.theme = theme;
      for (const [name, open, placement] of [
        ["neither", false, null],
        ["widget", true, null],
        ["floating probe", false, "anchored"],
        ["both floating", true, "anchored"],
        ["fixed probe", false, "bottomCenter"],
        ["both fixed", true, "bottomCenter"]
      ]) {
        get(".point-probe-close")?.click();
        widget(open);
        if (placement) await setPlacement(placement);
        const searchOpen = theme === "light" && name === "both floating";
        if (open) {
          const toggle = get(".faction-colors-widget-search-toggle");
          if ((toggle.getAttribute("aria-expanded") === "true") !== searchOpen) toggle.click();
          if (searchOpen) {
            const search = get("#faction-colors-widget-search");
            search.value = "band";
            search.dispatchEvent(new view.Event("input", { bubbles: true }));
          }
          await delay();
        }
        const map = get("#map-container"),
          box = map.getBoundingClientRect();
        if (placement) clickPoint(map, box.left + box.width / 2, box.top + box.height / 2);
        await delay();
        await settleMovement();
        const probe = get(".point-probe-popup"),
          body = get(".location-probe-body");
        const point = get(".point-probe-marker");
        check(
          Boolean(probe) === Boolean(placement) && Boolean(point) === Boolean(placement),
          `${theme} ${name}: requested probe presentation is present`
        );
        const coordinates = get(".point-probe-coordinates")?.textContent;
        const widgetBody = get(".faction-colors-widget-body");
        if (searchOpen) widgetBody.scrollTop = 20;
        const widgetScroll = widgetBody.scrollTop;
        if (body) body.scrollTop = 60;
        const scroll = body?.scrollTop;
        const base = get(".kimap-base-map-image"),
          raster = get(".political-view-overlay");
        const baseSource = base.src,
          rasterSource = raster.src;
        const updatesBefore = popupUpdates;
        const initialTransform = get(".leaflet-map-pane").style.transform;
        const start = [box.left + box.width * 0.68, box.top + box.height * 0.65];
        mouse(map, "mousedown", ...start, 1);
        const intervals = [];
        let previous = await nextFrame();
        for (let step = 1; step <= 40; step++) {
          mouse(map, "mousemove", start[0] + step * 3, start[1] + step, 1);
          const now = await nextFrame();
          intervals.push(now - previous);
          previous = now;
        }
        // Let Leaflet's last queued move and the passive consumer finish before mouseup.
        await nextFrame();
        const during = popupUpdates - updatesBefore;
        check(
          get(".leaflet-map-pane").style.transform !== initialTransform,
          `${theme} ${name}: dispatched drag actually pans Leaflet`
        );
        check(
          during === 0,
          `${theme} ${name}: no popup updates during sustained movement (${during})`
        );
        mouse(doc, "mouseup", start[0] + 120, start[1] + 40);
        await delay();
        await settleMovement();
        check(
          get(".point-probe-popup") === probe && get(".point-probe-marker") === point,
          `${theme} ${name}: held view and dot identities survive panning`
        );
        if (probe)
          check(
            get(".point-probe-coordinates").textContent === coordinates &&
              body.scrollTop === scroll,
            `${theme} ${name}: coordinates and report scroll survive`
          );
        check(
          base === get(".kimap-base-map-image") &&
            base.src === baseSource &&
            raster === get(".political-view-overlay") &&
            raster.src === rasterSource,
          `${theme} ${name}: no raster or base-image replacement`
        );
        const settled = popupUpdates;
        for (let i = 0; i < 8; i++) await nextFrame();
        check(popupUpdates === settled, `${theme} ${name}: idle layout settles`);
        intervals.sort((a, b) => a - b);
        results.push({
          subject,
          theme,
          case: name,
          frames: 40,
          popupUpdatesDuringPan: during,
          frameMedianMs: +intervals[20].toFixed(1),
          frameP95Ms: +intervals[37].toFixed(1)
        });
        output.textContent = JSON.stringify(results, null, 2);
        // Restore the map extent so every combination exercises the same geography.
        mouse(map, "mousedown", ...start, 1);
        for (let step = 1; step <= 20; step++) {
          mouse(map, "mousemove", start[0] - step * 6, start[1] - step * 2, 1);
          await nextFrame();
        }
        mouse(doc, "mouseup", start[0] - 120, start[1] - 40);
        await delay();
        await settleMovement();
        if (searchOpen) {
          // A hidden list has no scroll box. Check its retained reading after releasing the report.
          get(".point-probe-close").click();
          await delay();
          check(
            !get("#faction-colors-widget").hidden &&
              get("#faction-colors-widget-search").value === "band" &&
              widgetBody.scrollTop === widgetScroll,
            `search and scroll return after panning (${widgetBody.scrollTop} / ${widgetScroll})`
          );
        }
      }
    }
    get(".point-probe-close")?.click();
    widget(true);
    await setPlacement("anchored");
    const map = get("#map-container"),
      box = map.getBoundingClientRect();
    clickPoint(map, box.right - 380, box.top + 360);
    await delay();
    await settleMovement();
    const probe = get(".point-probe-popup"),
      point = get(".point-probe-marker");
    check(Boolean(probe) && Boolean(point), "near-widget probe is presented");
    const coordinates = get(".point-probe-coordinates").textContent;
    const panel = get("#faction-colors-widget");
    const modes = new Set();
    const start = [box.left + box.width * 0.4, box.top + box.height * 0.85];
    mouse(map, "mousedown", ...start, 1);
    for (let step = 1; step <= 60; step++) {
      const amount = step <= 30 ? step : 60 - step;
      mouse(map, "mousemove", start[0] + amount * 5, start[1] - amount * 4, 1);
      await nextFrame();
      await nextFrame();
      modes.add(panel.hidden ? "hidden" : panel.dataset.mode);
      if (!panel.hidden) {
        const a = panel.getBoundingClientRect(),
          b = get(".leaflet-popup").getBoundingClientRect();
        check(
          a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom,
          "moving report keeps priority over the color widget"
        );
      }
    }
    mouse(doc, "mouseup", ...start);
    await delay();
    await settleMovement();
    check(
      probe === get(".point-probe-popup") &&
        point === get(".point-probe-marker") &&
        coordinates === get(".point-probe-coordinates").textContent,
      "near-widget pan retains the held point"
    );
    check(
      !panel.hidden && panel.dataset.mode === "normal",
      "widget restores after the report moves away"
    );
    output.textContent += `\nNear-widget movement modes: ${[...modes].join(", ")}`;
    // Zoom still transports and settles the same overlay/probe instances.
    const raster = get(".political-view-overlay");
    get("#map-zoom-in-btn").click();
    await delay();
    get("#map-zoom-out-btn").click();
    await delay();
    check(
      get(".political-view-overlay") === raster &&
        get(".point-probe-popup") === probe &&
        get(".point-probe-marker") === point,
      "pan polish preserves overlay/probe identity through zoom"
    );
  } finally {
    view.L.Popup.prototype.update = originalUpdate;
    get("#reset-panel-btn").click();
  }
  return results;
}
