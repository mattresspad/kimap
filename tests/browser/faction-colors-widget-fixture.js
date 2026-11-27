/* global document, requestAnimationFrame, getComputedStyle, WheelEvent, MutationObserver */
import { createFactionColorsWidget } from "../../modules/viewport/faction-colors-widget.js";
import { ViewportCompositionSession } from "../../stores/viewport-composition-session.js";
import { checkFactionColorsWidget } from "./faction-colors-widget-integration.js";
import { checkWidgetPanning } from "./faction-widget-pan-fixture.js";

const output = document.getElementById("test-results");
const frame = document.getElementById("map");
const delay = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));
async function until(predicate, name) {
  const deadline = Date.now() + 60000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${name}`);
    await delay();
  }
}
let count = 0;
function check(condition, message) {
  if (!condition) throw new Error(message);
  count++;
}

document.getElementById("run-components").onclick = async (event) => {
  event.target.disabled = true;
  const workspace = document.getElementById("component-workspace");
  frame.hidden = true;
  workspace.hidden = false;
  count = 0;
  try {
    for (const theme of ["dark", "light"]) {
      document.documentElement.dataset.theme = theme;
      const session = new ViewportCompositionSession();
      let ready = true;
      let obstructions = [];
      let projection = {
        rows: Array.from({ length: 52 }, (_, i) => ({
          id: `id-${String(i).padStart(3, "0")}`,
          included: i !== 51,
          color: "#8e49df",
          name:
            i < 2
              ? "A duplicate faction"
              : i === 2
                ? "A very long faction name <safe text> ".repeat(3)
                : `Faction ${i}`
        }))
      };
      const rect = () => workspace.getBoundingClientRect();
      const anchor = () => ({
        left: rect().right - 48,
        top: rect().top + 12,
        bottom: rect().top + 158
      });
      const visible = (node) =>
        node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
      let pending = false;
      let widget;
      const schedule = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          widget?.position();
        });
      };
      widget = createFactionColorsWidget({
        workspace,
        session,
        getProjection: () => projection,
        getAvailability: () => ({ available: ready }),
        getBounds: rect,
        getAnchorRect: anchor,
        getObstructions: () => obstructions,
        onGeometryChange: schedule,
        isPresented: visible,
        getFallbackFocus: () => document.getElementById("run-components")
      });
      const panel = widget.element;
      const body = panel.querySelector(".faction-colors-widget-body");
      const toggle = panel.querySelector(".faction-colors-widget-search-toggle");
      const search = panel.querySelector("input");
      widget.open(document.getElementById("run-components"));
      await delay();
      check(
        panel.dataset.mode === "normal" &&
          panel.getBoundingClientRect().width === 200 &&
          panel.getBoundingClientRect().bottom === anchor().bottom,
        "normal dimensions use production stylesheet"
      );
      const completeRows = () => (body.getBoundingClientRect().height - 4) % 20 === 0;
      check(completeRows(), "initial viewport has whole rows and quiet remainder spacing");
      check(
        panel.querySelectorAll("li").length === 51 && !panel.querySelector("li input, li button"),
        "all included rows are read-only"
      );
      const rows = [...panel.querySelectorAll("li")];
      check(
        rows[0] !== rows[1] && rows[0].textContent === rows[1].textContent,
        "duplicate names preserve exact identities"
      );
      check(
        rows[2].title.includes("<safe text>") && !rows[2].querySelector("safe"),
        "long names use safe text and complete titles"
      );
      check(
        getComputedStyle(rows[0]).fontSize === "12px" &&
          rows[0].getBoundingClientRect().height === 20,
        "small text and stable row height"
      );
      toggle.click();
      await delay();
      check(document.activeElement === search, "search toggle focuses retained input");
      check(
        panel.getBoundingClientRect().bottom === anchor().bottom && completeRows(),
        "search keeps the same bottom boundary and complete rows"
      );
      search.value = "id-002";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await delay();
      check(panel.querySelectorAll("li:not([hidden])").length === 1, "stable-ID filtering");
      search.value = "absent";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await delay();
      check(!panel.querySelector(".faction-colors-widget-empty").hidden, "no-match explanation");
      toggle.click();
      await delay();
      check(!search.value && !visible(search), "collapsing search clears its filter");
      body.scrollTop = 400;
      body.focus();
      const scroll = body.scrollTop;
      const observer = new MutationObserver(() => {});
      observer.observe(panel.querySelector("ul"), { childList: true, subtree: true });
      for (const color of ["#112233", "#334455", "#556677"]) {
        projection = { rows: projection.rows.map((row) => ({ ...row, color })) };
        widget.refresh();
        widget.position();
      }
      check(
        observer.takeRecords().length === 0 && rows[2] === panel.querySelectorAll("li")[2],
        "palette changes retain row/text identity"
      );
      observer.disconnect();
      check(
        document.activeElement === body && body.scrollTop === scroll,
        "palette changes retain focus and scroll"
      );
      const movementObserver = new MutationObserver(() => {});
      movementObserver.observe(panel, {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true
      });
      for (let step = 0; step < 30; step++) {
        obstructions = [{ left: step * 3, right: step * 3 + 290, top: 300, bottom: 600 }];
        widget.position();
      }
      check(
        movementObserver.takeRecords().length === 0,
        "nonintersecting moving report causes no widget DOM/style writes or remeasurement"
      );
      movementObserver.disconnect();
      check(
        body.scrollTop === scroll && document.activeElement === body,
        "movement preserves list scroll and focus"
      );
      let wheels = 0;
      const wheel = () => wheels++;
      workspace.addEventListener("wheel", wheel);
      body.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
      check(wheels === 0, "wheel stays inside widget");
      workspace.removeEventListener("wheel", wheel);
      const root = rect();
      obstructions = [
        { left: root.left + 720, right: root.left + 790, top: root.top, bottom: root.top + 150 }
      ];
      widget.position();
      check(
        panel.dataset.mode === "shrunk" &&
          panel.getBoundingClientRect().width === 140 &&
          panel.getBoundingClientRect().height <= 104,
        "shrunk dimensions avoid an overlapping control"
      );
      obstructions = [
        { left: root.left + 700, right: root.right, top: root.top + 56, bottom: root.bottom }
      ];
      body.focus();
      widget.position();
      check(
        panel.dataset.mode === "folded" &&
          body.hidden &&
          document.activeElement === panel.querySelector("h2"),
        "folding moves focus to retained heading"
      );
      obstructions = [
        { left: root.left + 700, right: root.right, top: root.top + 35, bottom: root.bottom }
      ];
      widget.position();
      check(panel.hidden && panel.inert, "emergency hiding removes inaccessible content");
      movementObserver.observe(panel, { attributes: true, subtree: true });
      for (let step = 0; step < 30; step++) widget.position();
      check(
        movementObserver.takeRecords().length === 0,
        "continued obstruction while hidden does not rewrite widget attributes"
      );
      movementObserver.disconnect();
      obstructions = [];
      widget.position();
      check(
        !panel.hidden && panel.dataset.mode === "normal",
        "space recovery automatically restores normal list"
      );
      check(body.scrollTop === scroll, "folding and emergency hiding retain the reading position");
      ready = false;
      widget.refresh();
      check(panel.hidden && !widget.open(null), "unavailable palette cannot open");
      ready = true;
      widget.refresh();
      await delay();
      check(!panel.hidden, "availability return retains open intent");
      check(body.scrollTop === scroll, "temporary unavailability retains the reading position");
      projection = { rows: [] };
      widget.refresh();
      widget.position();
      check(
        panel.querySelector(".faction-colors-widget-empty").textContent === "No included factions.",
        "empty roster explanation"
      );
      session.reset();
      check(
        panel.hidden && !session.getSnapshot().factionColorsWidgetSearch,
        "reset clears choices"
      );
      panel.remove();
    }
    output.textContent = `PASS: ${count} component assertions; both themes.`;
  } catch (error) {
    output.textContent = `FAIL after ${count}: ${error.message}`;
  } finally {
    workspace.replaceChildren();
    workspace.hidden = true;
    frame.hidden = false;
    event.target.disabled = false;
  }
};

async function runMap() {
  count = 0;
  await until(
    () =>
      frame.contentDocument.querySelector("#map-workspace")?.dataset.mapReady === "true" &&
      !frame.contentDocument.querySelector("#layer-choice-political")?.disabled,
    "map readiness"
  );
  await checkFactionColorsWidget(frame.contentDocument, check, delay);
  const d = frame.contentDocument;
  output.textContent = `PASS: ${count} integration assertions; ${frame.clientWidth}×${frame.clientHeight}; ${d.documentElement.dataset.theme}.`;
}
document.getElementById("run-checks").onclick = async (event) => {
  event.target.disabled = true;
  try {
    await runMap();
  } catch (error) {
    output.textContent = `FAIL after ${count}: ${error.message}`;
  } finally {
    event.target.disabled = false;
  }
};

document.getElementById("run-pans").onclick = async (event) => {
  event.target.disabled = true;
  const subjectSelect = document.getElementById("pan-subject");
  const subject = subjectSelect.value;
  subjectSelect.disabled = true;
  const report = document.getElementById("matrix-results");
  report.hidden = false;
  report.textContent = "";
  count = 0;
  try {
    // Each comparison starts at the same initial extent, including repeated runs.
    const loaded = new Promise((resolve) =>
      frame.addEventListener("load", resolve, { once: true })
    );
    frame.contentWindow.location.reload();
    await loaded;
    await until(
      () =>
        frame.contentDocument.querySelector("#map-workspace")?.dataset.mapReady === "true" &&
        !frame.contentDocument.querySelector("#layer-choice-political")?.disabled,
      "pan readiness"
    );
    await checkWidgetPanning(frame, check, delay, report, subject);
    output.textContent = `PASS: ${count} ${subject} pan assertions; both themes; synthetic drag frame intervals recorded below.`;
  } catch (error) {
    output.textContent = `FAIL after ${count}: ${error.message}`;
  } finally {
    event.target.disabled = false;
    subjectSelect.disabled = false;
  }
};
document.getElementById("run-matrix").onclick = async (event) => {
  event.target.disabled = true;
  const report = document.getElementById("matrix-results");
  report.hidden = false;
  report.textContent = "";
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
        await runMap();
        report.textContent += `${output.textContent}\n`;
      }
    }
  } catch (error) {
    output.textContent = `FAIL after ${count}: ${error.message}`;
    report.textContent += output.textContent;
  } finally {
    event.target.disabled = false;
  }
};
