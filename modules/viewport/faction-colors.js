function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function createRow(faction) {
  const row = document.createElement("article");
  row.className = "faction-color-row";
  row.dataset.factionId = faction.id;
  const heading = document.createElement("header");
  const identity = document.createElement("div");
  const name = document.createElement("strong");
  name.className = "faction-color-name";
  const stableId = document.createElement("code");
  stableId.className = "faction-color-id";
  const evidence = document.createElement("span");
  evidence.className = "faction-color-evidence";
  identity.append(name, stableId);
  heading.append(identity, evidence);
  const editor = document.createElement("div");
  editor.className = "faction-color-editor";
  const label = document.createElement("label");
  label.textContent = "Color";
  const color = document.createElement("input");
  color.type = "color";
  color.dataset.politicalAction = "color";
  label.append(color);
  const hex = document.createElement("output");
  hex.className = "faction-color-hex";
  const source = document.createElement("span");
  source.className = "faction-color-source";
  editor.append(label, hex, source);
  const actions = document.createElement("div");
  actions.className = "faction-color-actions";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "secondary";
  reset.dataset.politicalAction = "reset";
  reset.textContent = "Reset Color";
  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "secondary";
  hide.dataset.politicalAction = "hide";
  hide.textContent = "Hide";
  actions.append(reset, hide);
  row.append(heading, editor, actions);
  return row;
}

export function matchesFactionColorSearch(faction, search) {
  return !search || `${faction.name} ${faction.id}`.toLocaleLowerCase().includes(search);
}

/** Persistent DOM only; the PoliticalPresentationSession owns every edited value. */
export function createFactionColorList({ list, onColor, onReset, onHide }) {
  const rows = new Map();
  list.addEventListener("input", (event) => {
    const action = event.target.closest('[data-political-action="color"]');
    const id = action?.closest("[data-faction-id]")?.dataset.factionId;
    if (id && !action.disabled) onColor(id, action.value);
  });
  list.addEventListener("click", (event) => {
    const action = event.target.closest("[data-political-action]");
    const id = action?.closest("[data-faction-id]")?.dataset.factionId;
    if (!id || action.disabled) return;
    if (action.dataset.politicalAction === "reset") onReset(id);
    if (action.dataset.politicalAction === "hide") onHide(id);
  });
  return {
    render({ factions = [], ready, search = "" }) {
      if (!ready) {
        for (const row of rows.values())
          for (const control of row.querySelectorAll("input, button")) control.disabled = true;
        return;
      }
      const included = factions.filter((faction) => faction.included);
      const ids = new Set(included.map((faction) => faction.id));
      for (const [id, row] of rows) if (!ids.has(id)) row.remove();
      let next = list.firstElementChild;
      for (const faction of included) {
        let row = rows.get(faction.id);
        if (!row) {
          row = createRow(faction);
          rows.set(faction.id, row);
        }
        text(row.querySelector(".faction-color-name"), faction.name);
        text(row.querySelector(".faction-color-id"), faction.id);
        text(row.querySelector(".faction-color-evidence"), faction.evidenceLabel);
        const color = row.querySelector('[data-political-action="color"]');
        if (color.value !== faction.color) color.value = faction.color;
        color.disabled = false;
        color.setAttribute("aria-label", `${faction.name} color`);
        text(row.querySelector(".faction-color-hex"), faction.color.toUpperCase());
        text(
          row.querySelector(".faction-color-source"),
          faction.colorSource === "authored" ? "Authored" : "Generated"
        );
        const reset = row.querySelector('[data-political-action="reset"]');
        reset.disabled = faction.color === faction.defaultColor;
        reset.setAttribute("aria-label", `Reset ${faction.name} color`);
        const hide = row.querySelector('[data-political-action="hide"]');
        hide.disabled = false;
        hide.setAttribute("aria-label", `Hide ${faction.name} from Political View`);
        row.hidden = !matchesFactionColorSearch(faction, search);
        // Appending an already ordered row detaches the focused native picker and disturbs scroll.
        if (row !== next) list.insertBefore(row, next);
        next = row.nextElementSibling;
      }
    },
    reveal(id, route) {
      const row = rows.get(id);
      const input = row?.querySelector('[data-political-action="color"]');
      if (!route || !row?.isConnected || row.hidden || input.disabled) return false;
      route.scrollTop += row.getBoundingClientRect().top - route.getBoundingClientRect().top - 12;
      input.focus({ preventScroll: true });
      return true;
    }
  };
}
