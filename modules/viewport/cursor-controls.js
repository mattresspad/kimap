import { kenshiAssetUrl } from "../asset-url.js";
import { REPORT_SUBJECTS } from "./reporting-policy.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function artwork(file, fallback = false) {
  const slot = element("span", "cursor-controls-artwork");
  slot.setAttribute("aria-hidden", "true");
  if (fallback) {
    // Project-owned functional fallback; published artwork remains optional.
    slot.innerHTML =
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 3v16l4-5 4 7 3-2-4-7h7Z"/></svg>';
  }
  const image = element("img");
  image.alt = "";
  image.width = 20;
  image.height = 20;
  image.addEventListener("load", () => {
    slot.dataset.loaded = "true";
  });
  image.addEventListener("error", () => {
    slot.dataset.loaded = "false";
    image.hidden = true;
  });
  image.src = kenshiAssetUrl(`icons/${file}.svg`, { forceCdn: true });
  slot.append(image);
  return slot;
}

/** Session settings and navigation only; subjects supply read-only report content. */
export function createCursorControls({
  session,
  getSubjectAvailability,
  onToggle,
  onOpen,
  onClose,
  onGeometryChange
}) {
  const launcher = element("button", "map-icon-control");
  launcher.id = "cursor-controls-btn";
  launcher.type = "button";
  launcher.setAttribute("aria-controls", "cursor-controls-panel");
  launcher.append(artwork("cursor-control", true));
  launcher.addEventListener("click", onToggle);
  const frame = element("div", "map-navigation-frame");
  frame.id = "cursor-controls-frame";
  frame.append(launcher);

  const banner = element("button", "cursor-controls-banner");
  banner.id = "world-views-cursor-controls";
  banner.type = "button";
  banner.title = "Open Cursor Controls: tooltip and click settings";
  banner.setAttribute("aria-label", banner.title);
  banner.setAttribute("aria-controls", "cursor-controls-panel");
  banner.append(
    artwork("cursor-control"),
    element("span", "cursor-controls-banner-label", "Tooltip & click settings"),
    artwork("cursor-control-arrow")
  );
  banner.addEventListener("click", onOpen);

  const panel = element("section", "cursor-controls map-anchored-popover");
  panel.id = "cursor-controls-panel";
  panel.hidden = true;
  panel.inert = true;
  panel.setAttribute("aria-labelledby", "cursor-controls-title");
  const header = element("header", "cursor-controls-header");
  const title = element("h2", "", "Cursor Controls");
  title.id = "cursor-controls-title";
  const close = element("button", "cursor-controls-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Close Cursor Controls");
  close.addEventListener("click", onClose);
  header.append(title, close);
  const tabs = element("div", "cursor-controls-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Cursor Controls views");
  const body = element("div", "cursor-controls-body");
  const entries = [];
  for (const [id, label, setting, values] of [
    ["tooltips", "Tooltips", "Tooltip detail", ["Reduced", "Full", "Hidden"]],
    ["pointProbe", "Point Probe", "Report disclosure", ["Expanded", "Collapsed"]]
  ]) {
    const tab = element("button", "", label);
    tab.type = "button";
    tab.id = `cursor-controls-${id}-tab`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `cursor-controls-${id}-view`);
    tab.addEventListener("click", () => session.setCursorControlsView(id));
    tabs.append(tab);
    const view = element("section", "cursor-controls-view");
    view.id = `cursor-controls-${id}-view`;
    view.setAttribute("role", "tabpanel");
    view.setAttribute("aria-labelledby", tab.id);
    const subjectField = element("label", "", "Subject");
    const subjectSelect = element("select");
    subjectSelect.id = `cursor-controls-${id}-subject`;
    for (const { id: subject, label: subjectLabel } of REPORT_SUBJECTS) {
      const option = element("option", "", subjectLabel);
      option.value = subject;
      subjectSelect.append(option);
    }
    subjectSelect.addEventListener("change", () =>
      session.setReportingSubject(id, subjectSelect.value)
    );
    subjectField.append(subjectSelect);
    const field = element("label", "", setting);
    const select = element("select");
    select.id = `cursor-controls-${id}-setting`;
    for (const label of values) {
      const option = element("option", "", label);
      option.value = label.toLowerCase();
      select.append(option);
    }
    const hiddenOption = id === "pointProbe" ? element("option", "", "Hidden") : null;
    if (hiddenOption) {
      hiddenOption.value = "hidden";
      select.append(hiddenOption);
    }
    select.addEventListener("change", () => {
      const state = session.getSnapshot();
      if (id === "tooltips") session.setReportTooltipMode(state.tooltipSubject, select.value);
      else if (state.pointProbeSubject === "relations") session.setRelationsProbeMode(select.value);
      else session.setReportProbeExpanded(state.pointProbeSubject, select.value === "expanded");
    });
    const filterField = element("label", "", "Faction filter");
    const filterSelect = element("select");
    filterSelect.id = `cursor-controls-${id}-relations-filter`;
    for (const [value, label] of [
      ["alliesEnemies", "Allies & enemies"],
      ["includeNeutrals", "Include neutrals"]
    ]) {
      const option = element("option", "", label);
      option.value = value;
      filterSelect.append(option);
    }
    filterSelect.addEventListener("change", () =>
      session.setRelationsReportFilter(id, filterSelect.value)
    );
    filterField.append(filterSelect);
    const status = element("p", "cursor-controls-status");
    status.id = `${view.id}-status`;
    select.setAttribute("aria-describedby", status.id);
    subjectSelect.setAttribute("aria-describedby", status.id);
    filterSelect.setAttribute("aria-describedby", status.id);
    field.append(select);
    const placementField = element("label", "", "Placement");
    const placementSelect = element("select");
    placementSelect.id = `cursor-controls-${id}-placement`;
    for (const [value, label] of [
      ["anchored", id === "tooltips" ? "Near cursor" : "At point"],
      ["bottomCenter", "Bottom center"]
    ]) {
      const option = element("option", "", label);
      option.value = value;
      placementSelect.append(option);
    }
    placementSelect.addEventListener("change", () =>
      session.setReportPlacement(id, placementSelect.value)
    );
    placementField.append(placementSelect);
    view.append(placementField, subjectField, filterField, field, status);
    body.append(view);
    entries.push({
      id,
      tab,
      view,
      select,
      subjectSelect,
      placementSelect,
      status,
      filterField,
      filterSelect,
      hiddenOption
    });
  }
  const planned = element("button", "cursor-controls-planned");
  planned.type = "button";
  planned.disabled = true;
  planned.setAttribute("role", "tab");
  planned.setAttribute("aria-selected", "false");
  planned.title = "Paint & Plan cursor settings are planned. Plan Tools remain available.";
  planned.append(element("span", "", "Paint & Plan"), element("small", "", "Planned"));
  tabs.append(planned);
  tabs.addEventListener("keydown", (event) => {
    const index = entries.findIndex(({ tab }) => tab === event.target);
    if (index < 0) return;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % entries.length
        : event.key === "ArrowLeft"
          ? (index + entries.length - 1) % entries.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? entries.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    entries[next].tab.focus({ preventScroll: true });
  });
  panel.append(header, tabs, body);
  for (const node of [panel, launcher, banner]) {
    for (const type of ["pointerdown", "mousedown", "dblclick", "click", "wheel"])
      node.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
  }

  const refresh = ({ focus = false } = {}) => {
    const state = session.getSnapshot();
    const open = state.transientSurface === "cursorControls" && !state.focusMap;
    panel.hidden = !open;
    panel.inert = !open;
    launcher.hidden = state.focusMap;
    frame.hidden = state.focusMap;
    launcher.title = `${open ? "Close" : "Open"} Cursor Controls`;
    launcher.setAttribute("aria-label", launcher.title);
    for (const button of [launcher, banner]) button.setAttribute("aria-expanded", String(open));
    for (const entry of entries) {
      const subject = state[entry.id === "tooltips" ? "tooltipSubject" : "pointProbeSubject"];
      const availability = getSubjectAvailability(subject);
      const message =
        subject === "political"
          ? availability.available
            ? availability.active
              ? "Applies to active Political View reporting."
              : "Applies when Political View is active."
            : `${availability.reason || "Political reporting is unavailable."} Settings will apply when Political View is available and active.`
          : ["relations", "squadPresence"].includes(subject)
            ? `${availability.available ? "Current authored associations, independent of Political View." : availability.reason || "Current presence is unavailable."} ${state.phone ? "Tap the map to open a Point Probe report." : "Mouse or pointing device reporting; touch reports are deferred."}`
            : availability.available
              ? "Authored area readings. Independent of World Views and Scanner expansion."
              : availability.reason || "Environmental reporting is unavailable.";
      const active = state.cursorControlsView === entry.id;
      entry.tab.setAttribute("aria-selected", String(active));
      entry.tab.tabIndex = active ? 0 : -1;
      entry.view.hidden = !active;
      entry.view.inert = !active || !open;
      const value =
        entry.id === "tooltips"
          ? state[`${subject}TooltipMode`]
          : subject === "relations" && state.relationsProbeHidden
            ? "hidden"
            : state[`${subject}ProbeExpanded`]
              ? "expanded"
              : "collapsed";
      if (entry.select.value !== value) entry.select.value = value;
      entry.filterField.hidden = subject !== "relations";
      entry.filterField.inert = subject !== "relations";
      const filter =
        state[entry.id === "tooltips" ? "relationsTooltipFilter" : "relationsProbeFilter"];
      if (entry.filterSelect.value !== filter) entry.filterSelect.value = filter;
      if (entry.hiddenOption) {
        entry.hiddenOption.hidden = subject !== "relations";
        entry.hiddenOption.disabled = subject !== "relations";
      }
      if (entry.subjectSelect.value !== subject) entry.subjectSelect.value = subject;
      entry.placementSelect.value =
        state[entry.id === "tooltips" ? "tooltipPlacement" : "pointProbePlacement"];
      entry.placementSelect.parentElement.hidden = state.phone && entry.id === "pointProbe";
      if (entry.status.textContent !== message) entry.status.textContent = message;
      if (active && focus && open) entry.tab.focus({ preventScroll: true });
    }
    if (open) onGeometryChange();
  };
  refresh();
  return Object.freeze({ element: panel, launcher, frame, banner, refresh });
}
