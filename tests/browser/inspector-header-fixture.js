/* global document, requestAnimationFrame */
import { detailChecks } from "./inspector-detail-checks.js";
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
function check(condition, description) {
  if (!condition) throw new Error(description);
  results.textContent += `PASS ${description}\n`;
}
const visible = (node) => Boolean(node?.getClientRects().length);
const intersects = (a, b) =>
  a.left < b.right - 0.5 &&
  a.right > b.left + 0.5 &&
  a.top < b.bottom - 0.5 &&
  a.bottom > b.top + 0.5;

async function run({ expiry = true } = {}) {
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  const get = (selector) => doc.querySelector(selector);
  const click = (selector) => get(selector).click();
  const title = () => get("#info-panel-title").textContent;
  const mode = () => get("#info-panel").dataset.contextMode;
  await until(() => get("#map-workspace")?.dataset.mapReady === "true", "application ready");
  const search = async (name, kind) => {
    const input = get("#quick-search-input");
    if (!visible(input)) click("#quick-search-launcher");
    input.value = name;
    input.dispatchEvent(new view.Event("input", { bubbles: true }));
    await until(
      () =>
        [...doc.querySelectorAll("#quick-search-results [role=option]")].some(
          (node) => node.textContent.includes(name) && node.textContent.includes(kind)
        ),
      "search result"
    );
    [...doc.querySelectorAll("#quick-search-results [role=option]")]
      .find((node) => node.textContent.includes(name) && node.textContent.includes(kind))
      .click();
    await delay();
  };
  const header = (description, { singleRow = true } = {}) => {
    const panel = get("#info-panel").getBoundingClientRect();
    const ribbon = get("#info-panel-title-ribbon").getBoundingClientRect();
    const heading = get("#info-panel-title");
    const name = heading.getBoundingClientRect();
    const minimize = get("#info-panel-minimize-btn").getBoundingClientRect();
    const controls = [...doc.querySelectorAll("#info-panel-utility-ribbon button")].filter(visible);
    const rects = controls.map((node) => node.getBoundingClientRect());
    check(Math.abs(ribbon.height - 56) < 1, `${description}: stable 56px title strip`);
    check(
      name.right <= minimize.left && heading.title === heading.textContent,
      `${description}: title cannot overlap controls and retains its full tooltip`
    );
    check(
      rects.every((rect) => rect.left >= panel.left && rect.right <= panel.right),
      `${description}: every action stays inside Inspector`
    );
    check(
      rects.every((rect, i) => rects.slice(i + 1).every((other) => !intersects(rect, other))),
      `${description}: actions never overlap`
    );
    if (singleRow && rects.length) {
      check(
        rects.every((rect) => Math.abs(rect.top - rects[0].top) < 1),
        `${description}: actions fit one row`
      );
    }
    const returns = controls.filter((node) => /-(back|return-reference)-btn$/.test(node.id));
    check(returns.length <= 1, `${description}: at most one applicable return action`);
    for (const button of returns) {
      check(
        button.getBoundingClientRect().width === 32 &&
          button.getBoundingClientRect().height === 32 &&
          button.querySelector("img")?.src.includes("/return-back.svg") &&
          button.title === button.getAttribute("aria-label"),
        `${description}: named 32px return icon`
      );
    }
  };
  const inspect = (name) =>
    get(`.landmark-icon[title="${name}"]`).dispatchEvent(
      new view.MouseEvent("click", { bubbles: true })
    );
  click("#reset-panel-btn");
  click("#info-panel-clear-btn");
  click("#map-content-btn");
  if (!get("#layer-choice-landmarks").checked) click("#layer-choice-landmarks");
  click("#map-content-btn");
  await until(() => get('.landmark-icon[title="Stobe"]'), "landmarks");
  inspect("Stobe");
  await delay();
  header("standalone landmark");
  check(get("#info-panel-utility-ribbon").hidden, "standalone landmark has no unrelated actions");
  click("#info-panel-clear-btn");

  await search("Bark", "Town");
  header("town");
  const layout = get("#info-panel-layout-btn");
  const copy = get("#info-panel-copy-view-btn");
  const label = copy.querySelector("[data-copy-view-label]");
  check(
    layout.getBoundingClientRect().width === 72 &&
      copy.getBoundingClientRect().width === 72 &&
      layout.getBoundingClientRect().height === 32 &&
      copy.getBoundingClientRect().height === 32,
    "stacked actions retain 72px widths and 32px heights"
  );
  check(
    layout.querySelector("img") &&
      layout.querySelector("span").textContent === "View\nLayout" &&
      label.textContent === "Copy\nView" &&
      view.getComputedStyle(label).fontSize === "12px",
    "two-line system labels retain the layout icon"
  );
  check(
    get("#info-panel-wiki-btn").disabled &&
      get("#info-panel-wiki-btn").title.includes("unavailable"),
    "disabled action retains its explanation"
  );
  layout.click();
  await until(
    () => get("#town-layout-backdrop").getAttribute("aria-hidden") === "false",
    "town layout"
  );
  click("#close-town-layout-btn");

  await search("Bloodrum", "Item");
  header("root reference with Map Context");
  const rootTitle = title();
  for (const [button, filename] of [
    [get("#info-panel-map-context-btn"), "inspector-map-context.svg"],
    [layout, "view-layouts.svg"],
    [copy, "inspector-copy-view.svg"]
  ]) {
    check(
      button.firstElementChild.tagName === "IMG" && button.firstElementChild.src.includes(filename),
      `${filename}: icon precedes the label`
    );
  }
  const group = get(".reference-lazy-list");
  group.open = true;
  group.dispatchEvent(new view.Event("toggle"));
  group.querySelector("[data-reference-action=push]").click();
  await delay();
  header("nested reference with Back and Map Context");
  const nestedTitle = title();
  const nestedBody = get("#info-panel-reference-content").firstElementChild;
  const nestedGroup = get(".reference-lazy-list");
  if (nestedGroup) {
    nestedGroup.open = true;
    nestedGroup.dispatchEvent(new view.Event("toggle"));
  }
  const scroller = get("#info-panel-content");
  scroller.scrollTop = 100;
  const reading = scroller.scrollTop;
  inspect("Suspicious Lab Bridge");
  await delay();
  header("landmark with Back");
  click("#info-panel-minimize-btn");
  click("#workbench-inspector-toggle-btn");
  click("#workbench-focus-map-btn");
  click("#workbench-focus-map-btn");
  click("#info-panel-landmark-back-btn");
  await delay();
  check(
    title() === nestedTitle &&
      get("#info-panel-reference-content").firstElementChild === nestedBody &&
      (!nestedGroup || nestedGroup.open) &&
      Math.abs(scroller.scrollTop - reading) <= 1,
    "landmark Back, minimize and Focus Map retain reference DOM, disclosure and reading position"
  );
  click("#info-panel-map-context-btn");
  await delay();
  header("town with Return to Reference and all actions");
  check(
    title() === "Bark" && get("#info-panel-return-reference-btn").title === "Return to Reference",
    "Map Context retains the return destination"
  );
  const inspectorHeader = get("#info-panel-header");
  inspectorHeader.style.width = "240px";
  const utility = get("#info-panel-utility-ribbon").getBoundingClientRect();
  header("exceptionally narrow ribbon", { singleRow: false });
  check(
    [...doc.querySelectorAll("#info-panel-utility-ribbon button")]
      .filter(visible)
      .every((node) => node.getBoundingClientRect().right <= utility.right) && utility.height > 43,
    "exceptionally narrow ribbon wraps without clipping"
  );
  inspectorHeader.style.width = "";

  // Test the real copy action/timer without changing the user's system clipboard.
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(view.navigator, "clipboard");
  const writes = [];
  const copyIcon = copy.querySelector("img");
  let refuse = false;
  Object.defineProperty(view.navigator, "clipboard", {
    configurable: true,
    value: {
      async writeText(value) {
        if (refuse) throw new Error("Fixture clipboard refusal");
        writes.push(value);
      }
    }
  });
  try {
    copy.click();
    await until(() => label.textContent === "Copied", "first copy feedback");
    copy.click();
    await until(() => writes.length === 2, "repeated copy");
    await delay();
    check(
      get("#selection-status").textContent === "View link copied." &&
        copy.querySelector("[data-copy-view-label]") === label &&
        copy.querySelector("img") === copyIcon &&
        visible(copyIcon) &&
        writes[0] === writes[1],
      "repeated copy preserves label DOM, success message and view URL"
    );
    if (expiry) {
      const started = Date.now();
      await until(() => label.textContent === "Copy\nView", "five-second copy expiry");
      check(Date.now() - started >= 4800, "feedback lasts five seconds and restores stacked label");
      refuse = true;
      copy.click();
      await until(
        () => get("#selection-status").textContent.includes("Could not copy"),
        "copy failure"
      );
      check(label.textContent === "Copy\nView", "copy failure preserves stacked label");
      refuse = false;
    }
    copy.click();
    await until(() => label.textContent === "Copied", "copy before cancellation");
    await delay();
    await search("Bark", "Town");
    check(
      label.textContent === "Copy\nView",
      "geographic selection cancels feedback without losing the stack"
    );
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(view.navigator, "clipboard", clipboardDescriptor);
    else delete view.navigator.clipboard;
  }

  for (const button of [layout, copy]) {
    const icon = button.querySelector("img");
    const source = icon.src;
    icon.src = "/__fixture-missing-icon.svg";
    await delay();
    check(
      visible(button.querySelector("span")) && button.getAttribute("aria-label"),
      "missing action artwork retains its visible and accessible label"
    );
    icon.src = source;
  }

  // Stress only the existing DOM presentation, without adding synthetic manifest records.
  const heading = get("#info-panel-title");
  const originalName = heading.textContent;
  for (const name of [
    "Bark",
    "A Town With A Long Name",
    "Very long town name ".repeat(12),
    "W".repeat(180)
  ]) {
    heading.textContent = heading.title = name;
    header("title fixture");
    const lineHeight = parseFloat(view.getComputedStyle(heading).lineHeight);
    check(heading.clientHeight <= lineHeight * 2 + 1, "title is bounded to two lines");
    if (name.length > 100)
      check(heading.clientHeight > lineHeight + 1, "long title uses both lines");
  }
  heading.textContent = heading.title = originalName;
  const rootFont = doc.documentElement.style.fontSize;
  doc.documentElement.style.fontSize = "32px";
  check(
    get("#info-panel-title-ribbon").getBoundingClientRect().height > 56,
    "reserved title height scales with enlarged text (separate from browser zoom)"
  );
  doc.documentElement.style.fontSize = rootFont;

  // Rebuild the reference trail after geographic selection, then verify each return destination.
  await search("Bloodrum", "Item");
  const links = get(".reference-lazy-list");
  links.open = true;
  links.dispatchEvent(new view.Event("toggle"));
  links.querySelector("[data-reference-action=push]").click();
  await delay();
  click("#info-panel-map-context-btn");
  await delay();
  click("#info-panel-return-reference-btn");
  await delay();
  check(
    title() === nestedTitle && mode() === "reference",
    "Return to Reference restores the nested destination"
  );
  click("#info-panel-reference-back-btn");
  await delay();
  check(title() === rootTitle, "reference Back pops only one trail entry");

  const mapRect = get("#map-container").getBoundingClientRect();
  get("#map-container").dispatchEvent(
    new view.MouseEvent("click", {
      bubbles: true,
      clientX: mapRect.left + mapRect.width / 2,
      clientY: mapRect.top + mapRect.height / 2
    })
  );
  await until(() => get(".point-probe-popup .popup-actions button"), "ordinary point probe");
  get(".point-probe-popup .popup-actions button").click();
  await delay();
  header("point inspection");
  check(
    copy.getAttribute("aria-label") === "Copy exact point view",
    "point Copy View keeps its exact-point accessible name"
  );
  await search("Shem", "Spawn Area");
  header("direct spawn area");
  check(!visible(layout), "spawn area has no town layout action");
  await detailChecks({ doc, view, get, click, search, check, delay, visible });
  click("#info-panel-clear-btn");
  await search("Bloodrum", "Item");
  header("reference without map selection");
  check(
    !visible(get("#info-panel-map-context-btn")),
    "Map Context stays hidden without a selection"
  );
  const standaloneGroup = get(".reference-lazy-list");
  standaloneGroup.open = true;
  standaloneGroup.dispatchEvent(new view.Event("toggle"));
  standaloneGroup.querySelector("[data-reference-action=push]").click();
  await delay();
  header("nested reference without map selection");
  status.textContent = `PASS ${view.innerWidth}×${view.innerHeight}, ${doc.documentElement.dataset.theme}, DPR ${view.devicePixelRatio}`;
}

async function execute(matrix) {
  document.getElementById("run").disabled = document.getElementById("matrix").disabled = true;
  results.textContent = "";
  status.textContent = "Running…";
  try {
    if (!matrix) await run();
    else {
      let expiry = true;
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
          await new Promise((resolve) => {
            frame.addEventListener("load", resolve, { once: true });
            frame.contentWindow.location.reload();
          });
          await until(
            () =>
              frame.contentDocument.querySelector("#map-workspace")?.dataset.mapReady === "true",
            "matrix ready"
          );
          frame.contentDocument.documentElement.dataset.theme = theme;
          results.textContent += `\n${width}×${height} ${theme}\n`;
          await run({ expiry });
          expiry = false;
        }
      }
      status.textContent = "PASS: all twelve size/theme combinations";
    }
  } catch (error) {
    status.textContent = `FAIL: ${error.message}`;
  } finally {
    document.getElementById("run").disabled = document.getElementById("matrix").disabled = false;
  }
}
document.getElementById("run").addEventListener("click", () => void execute(false));
document.getElementById("matrix").addEventListener("click", () => void execute(true));
document.getElementById("resize").addEventListener("click", () => {
  const [width, height] = document.getElementById("preview-size").value.split(",");
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
});
document
  .getElementById("theme")
  .addEventListener("click", () => frame.contentDocument.getElementById("theme-toggle").click());
