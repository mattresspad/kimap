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
  await until(
    () => frame.contentDocument?.querySelector("#map-workspace")?.dataset.mapReady === "true",
    "application ready"
  );
  const doc = frame.contentDocument;
  const get = (selector) => doc.querySelector(selector);
  check(
    get("#viewport-workbench").dataset.phone === "true",
    "failure fixture loads the phone tier"
  );

  const map = get("#map-container").getBoundingClientRect();
  const belt = get("#phone-belt").getBoundingClientRect();
  const marker = [...doc.querySelectorAll(".leaflet-marker-icon[data-relation]")].find((node) => {
    const rect = node.getBoundingClientRect();
    return (
      rect.left > map.left + 20 &&
      rect.right < map.right - 20 &&
      rect.top > map.top + 70 &&
      rect.bottom < belt.top - 90
    );
  });
  check(Boolean(marker), "a town marker is available");
  marker.click();
  get("#phone-town-card-context").click();
  await until(
    () => get("#viewport-workbench").dataset.phoneForeground === "inspector",
    "Town Inspector"
  );
  const selectedTitle = get("#info-panel-title").textContent;
  const scroller = get("#info-panel-content");
  scroller.scrollTop = Math.min(40, scroller.scrollHeight - scroller.clientHeight);
  const selectedScroll = scroller.scrollTop;

  get("#info-panel-layout-btn").click();
  await until(
    () => get("#selection-status")?.textContent.includes("Town layout could not be displayed"),
    "failed building-data request"
  );
  await until(
    () => get("#town-layout-backdrop").getAttribute("aria-hidden") === "true",
    "layout failure cleanup"
  );
  check(
    get("#viewport-workbench").dataset.phoneForeground === "inspector" &&
      get("#info-panel-title").textContent === selectedTitle &&
      scroller.scrollTop === selectedScroll,
    "failed layout restores the originating Inspector, selection, and scroll"
  );
  await delay();
  check(
    doc.activeElement === get("#info-panel-layout-btn"),
    "failed layout returns focus to its launcher"
  );
}

document.getElementById("run").addEventListener("click", async () => {
  results.textContent = "";
  status.textContent = "Running…";
  try {
    await run();
    status.textContent = "Town Layout failure checks passed.";
  } catch (error) {
    results.textContent += `FAIL ${error.message}\n`;
    status.textContent = "Town Layout failure checks failed.";
    throw error;
  }
});
