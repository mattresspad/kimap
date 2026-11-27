/* global document, window, requestAnimationFrame */
import {
  createFactionColorList,
  matchesFactionColorSearch
} from "../../modules/viewport/faction-colors.js";
import { PoliticalPresentationSession } from "../../stores/political-presentation-session.js";

const factions = Array.from({ length: 52 }, (_, index) => ({
  id: index === 31 ? "48791-Dialogue.mod" : `fixture-${index}`,
  name:
    index === 31 ? "Grayflayers" : index === 32 ? "Grayflayers" : `Faction ${index} <safe text>`,
  evidenceLabel: "Both"
}));
const session = new PoliticalPresentationSession({
  participantIds: factions.map((row) => row.id),
  defaultsByFactionId: Object.fromEntries(
    factions.map((row) => [row.id, { color: "#8e49df", source: "generated" }])
  )
});
const route = document.getElementById("fixture-route");
const list = document.getElementById("fixture-list");
const search = document.getElementById("fixture-search");
let ready = true;
const view = createFactionColorList({
  list,
  onColor: (id, color) => session.setColor(id, color),
  onReset: (id) => session.resetColor(id),
  onHide: (id) => session.hide(id)
});
function render() {
  const snapshot = session.getSnapshot();
  view.render({
    ready,
    search: search.value.trim().toLocaleLowerCase(),
    factions: factions.map((row) => ({
      ...row,
      included: snapshot.participantIds.includes(row.id),
      color: snapshot.colorsByFactionId[row.id],
      defaultColor: snapshot.defaultsByFactionId[row.id].color,
      colorSource: "generated"
    }))
  });
}
session.subscribe(render);
search.addEventListener("input", render);
function reveal(id) {
  const faction = factions.find((row) => row.id === id);
  if (faction && !matchesFactionColorSearch(faction, search.value.trim().toLocaleLowerCase()))
    search.value = "";
  render();
  return view.reveal(id, route);
}
document.getElementById("fixture-reveal").onclick = () => reveal("48791-Dialogue.mod");
document.getElementById("fixture-theme").onclick = () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
};
render();
const frame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
document.getElementById("run-checks").onclick = async () => {
  const output = document.getElementById("test-results");
  let count = 0;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    count += 1;
  };
  try {
    ready = true;
    search.value = "";
    session.restoreDefaults();
    render();
    const pageScroll = window.scrollY;
    search.value = "fixture-2";
    render();
    check(reveal("48791-Dialogue.mod"), "reveal exact faction after clearing conflicting search");
    await frame();
    const row = [...list.children].find((node) => node.dataset.factionId === "48791-Dialogue.mod");
    const input = row.querySelector("input");
    check(
      document.activeElement === input && search.value === "",
      "exact ID distinguishes duplicate names and focuses color input"
    );
    check(
      window.scrollY === pageScroll &&
        Math.abs(row.getBoundingClientRect().top - route.getBoundingClientRect().top - 12) < 2,
      "only route scrolls to the requested row"
    );
    const scrollTop = route.scrollTop;
    const observer = new window.MutationObserver(() => {});
    observer.observe(list, { childList: true });
    for (const value of ["#cc3377", "#34aa88", "#8e49df", "#4455bb"]) {
      input.value = value;
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
      check(
        session.getSnapshot().colorsByFactionId["48791-Dialogue.mod"] === value,
        "delegated input updates authoritative palette"
      );
      check(
        document.activeElement === input && route.scrollTop === scrollTop && input.isConnected,
        "continuous picker input preserves exact input, focus and scroll"
      );
    }
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    input.dispatchEvent(new window.Event("click", { bubbles: true }));
    check(
      route.scrollTop === scrollTop && document.activeElement === input,
      "confirmation/click does not scroll or replace picker"
    );
    session.setOpacity(0.8);
    check(observer.takeRecords().length === 0, "color and opacity updates do not move any row");
    observer.disconnect();
    const reset = row.querySelector('[data-political-action="reset"]');
    reset.click();
    check(
      input === row.querySelector("input") &&
        route.scrollTop === scrollTop &&
        input.value === "#8e49df",
      "reset preserves row and route position"
    );
    search.value = "grayflayers";
    render();
    check(
      reveal("48791-Dialogue.mod") && search.value === "grayflayers",
      "matching search remains intact"
    );
    ready = false;
    render();
    check(
      input.disabled && !view.reveal("48791-Dialogue.mod", route),
      "unavailable palette disables navigation and edits"
    );
    ready = true;
    search.value = "";
    render();
    session.hide("48791-Dialogue.mod");
    check(!view.reveal("48791-Dialogue.mod", route), "removed target is not silently re-included");
    session.include("48791-Dialogue.mod");
    check(
      row === [...list.children].find((node) => node.dataset.factionId === "48791-Dialogue.mod"),
      "real membership changes reuse retained row"
    );
    reveal("48791-Dialogue.mod");
    output.textContent = `PASS: ${count} color-picker assertions.`;
  } catch (error) {
    output.textContent = `FAIL after ${count}: ${error.message}`;
  }
};
