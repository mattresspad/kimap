import { matchesFactionColorSearch } from "./faction-colors.js";
import { createFactionColorsWidgetPlacement } from "./faction-colors-widget-placement.js";

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}
function pixels(element, property, value) {
  const text = `${value}px`;
  if (element.style[property] !== text) element.style[property] = text;
}

/** Read-only retained view; composition owns choices and political presentation owns the palette. */
export function createFactionColorsWidget({
  workspace,
  session,
  getProjection,
  getAvailability,
  getBounds,
  getAnchorRect,
  getObstructions,
  onGeometryChange,
  isPresented,
  getFallbackFocus
}) {
  const element = node("section", "faction-colors-widget kimap-ui");
  element.id = "faction-colors-widget";
  element.hidden = true;
  element.inert = true;
  element.setAttribute("aria-label", "Faction Colors");
  const header = node("div", "faction-colors-widget-header");
  const heading = node("h2", "faction-colors-widget-title", "Faction Colors");
  heading.tabIndex = -1;
  heading.title = "Faction Colors";
  heading.setAttribute("aria-label", "Faction Colors");
  const searchToggle = node("button", "faction-colors-widget-search-toggle");
  searchToggle.type = "button";
  searchToggle.title = "Search faction colors";
  searchToggle.setAttribute("aria-label", searchToggle.title);
  searchToggle.setAttribute("aria-controls", "faction-colors-widget-search");
  searchToggle.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="m12 12 5 5"/></svg>';
  const closeButton = node("button", "faction-colors-widget-close", "×");
  closeButton.type = "button";
  closeButton.title = "Close Faction Colors Widget";
  closeButton.setAttribute("aria-label", closeButton.title);
  header.append(heading, searchToggle, closeButton);
  const searchBox = node("div", "faction-colors-widget-search-box");
  const search = node("input");
  search.id = "faction-colors-widget-search";
  search.type = "search";
  search.autocomplete = "off";
  search.placeholder = "Search factions";
  search.setAttribute("aria-label", "Search faction names or stable IDs");
  searchBox.append(search);
  const body = node("div", "faction-colors-widget-body");
  body.tabIndex = 0;
  body.setAttribute("role", "region");
  body.setAttribute("aria-label", "Included faction colors");
  const list = node("ul", "faction-colors-widget-list");
  const empty = node("p", "faction-colors-widget-empty");
  body.append(list, empty);
  element.append(header, searchBox, body);
  workspace.append(element);
  for (const type of ["click", "dblclick", "pointerdown", "mousedown", "wheel"])
    element.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
  const rows = new Map();
  let lastProjection;
  let lastSearch;
  let invoker = null;
  let pendingFocus = false;
  let closing = false;
  let retainedScroll = 0;
  let measurements = null;
  let visibleRowCount = 0;
  let lastSearchOpen;
  let lastPlacementKey = null;

  function invalidateMeasurements() {
    measurements = null;
    if (element.isConnected) onGeometryChange();
  }
  // Observe intrinsic heights, not the fitted outer box. Changes here may only refit this widget.
  if (typeof ResizeObserver === "function") {
    const heights = new Map();
    const observer = new ResizeObserver((entries) => {
      for (const { target, contentRect } of entries) {
        if (contentRect.height <= 0 || heights.get(target) === contentRect.height) continue;
        heights.set(target, contentRect.height);
        invalidateMeasurements();
      }
    });
    observer.observe(header);
    observer.observe(search);
  }
  document.fonts?.addEventListener("loadingdone", invalidateMeasurements);
  window.addEventListener("resize", invalidateMeasurements, { passive: true });

  function rememberScroll() {
    if (!element.hidden && !body.hidden && body.getClientRects().length > 0)
      retainedScroll = body.scrollTop;
  }
  body.addEventListener("scroll", rememberScroll, { passive: true });

  function focusFallback() {
    getFallbackFocus()?.focus({ preventScroll: true });
  }
  function hide({ remember = true } = {}) {
    const focused = element.contains(document.activeElement);
    if (remember) rememberScroll();
    if (!element.hidden) element.hidden = true;
    if (!element.inert) element.inert = true;
    if ((focused || pendingFocus) && !closing) focusFallback();
    pendingFocus = false;
  }
  function refresh() {
    const state = session.getSnapshot();
    const projection = getProjection();
    if (state.factionColorsWidgetSearchOpen !== lastSearchOpen) measurements = null;
    lastSearchOpen = state.factionColorsWidgetSearchOpen;
    searchToggle.setAttribute("aria-expanded", String(state.factionColorsWidgetSearchOpen));
    if (search.value !== state.factionColorsWidgetSearch)
      search.value = state.factionColorsWidgetSearch;
    if (projection !== lastProjection || state.factionColorsWidgetSearch !== lastSearch) {
      rememberScroll();
      const scroll = lastSearch === state.factionColorsWidgetSearch ? retainedScroll : 0;
      const included = (projection?.rows ?? []).filter((row) => row.included);
      const query = state.factionColorsWidgetSearch.trim().toLocaleLowerCase();
      const ids = new Set(included.map((row) => row.id));
      for (const [id, row] of rows)
        if (!ids.has(id)) {
          row.element.remove();
          rows.delete(id);
        }
      let next = list.firstElementChild;
      let shown = 0;
      for (const faction of included) {
        let row = rows.get(faction.id);
        if (!row) {
          const entry = node("li");
          entry.dataset.factionId = faction.id;
          const swatch = node("span", "faction-colors-widget-swatch");
          swatch.setAttribute("aria-hidden", "true");
          const name = node("span", "faction-colors-widget-name");
          entry.append(swatch, name);
          row = { element: entry, swatch, name, color: null };
          rows.set(faction.id, row);
        }
        setText(row.name, faction.name);
        row.element.title = `${faction.name} (${faction.id})`;
        row.element.setAttribute("aria-label", `${faction.name} (${faction.id}), ${faction.color}`);
        if (row.color !== faction.color) {
          row.swatch.style.backgroundColor = faction.color;
          row.color = faction.color;
        }
        row.element.hidden = !matchesFactionColorSearch(faction, query);
        if (!row.element.hidden) shown++;
        if (row.element !== next) list.insertBefore(row.element, next);
        next = row.element.nextElementSibling;
      }
      empty.hidden = shown > 0;
      setText(empty, included.length ? "No matching factions." : "No included factions.");
      if (visibleRowCount !== shown) measurements = null;
      visibleRowCount = shown;
      body.scrollTop = scroll;
      retainedScroll = scroll;
      lastProjection = projection;
      lastSearch = state.factionColorsWidgetSearch;
    }
    if (!state.factionColorsWidgetOpen || state.focusMap || !getAvailability().available) hide();
    onGeometryChange();
  }

  function measure(state) {
    rememberScroll();
    // Only intrinsic changes require this measurement. Panning uses the retained metrics.
    element.style.visibility = "hidden";
    element.hidden = false;
    element.dataset.mode = "normal";
    element.style.width = "200px";
    element.style.height = "auto";
    body.style.height = "auto";
    body.hidden = false;
    searchToggle.hidden = false;
    searchBox.hidden = !state.factionColorsWidgetSearchOpen;
    const headerHeight = header.getBoundingClientRect().height;
    const border = getComputedStyle(element);
    const borders = parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth);
    const bodyStyle = getComputedStyle(body);
    const bodyPadding = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    setText(heading, "Colors");
    const titleRange = document.createRange();
    titleRange.selectNodeContents(heading);
    measurements = {
      chromeHeight: headerHeight + searchBox.getBoundingClientRect().height + borders,
      bodyHeight: body.scrollHeight,
      bodyPadding,
      rowHeight: list.querySelector("li:not([hidden])")?.getBoundingClientRect().height || 20,
      minimumBodyHeight: 20 + bodyPadding,
      foldedHeight: headerHeight + borders,
      foldedMinimumWidth: titleRange.getBoundingClientRect().width + 24 + 8 + 12 + borders
    };
    element.style.removeProperty("visibility");
  }
  function position() {
    const state = session.getSnapshot();
    if (!state.factionColorsWidgetOpen || state.focusMap || !getAvailability().available)
      return hide();
    const anchorRect = getAnchorRect();
    if (!anchorRect) return hide();
    const active = element.contains(document.activeElement) ? document.activeElement : null;
    const measured = !measurements;
    if (measured) measure(state);
    const placement = createFactionColorsWidgetPlacement({
      bounds: getBounds(),
      anchorRect,
      obstructions: getObstructions(),
      ...measurements
    });
    if (placement.mode === "hidden") {
      if (element.dataset.mode !== placement.mode) element.dataset.mode = placement.mode;
      return hide({ remember: !measured });
    }
    const folded = placement.mode === "folded";
    const workspaceRect = workspace.getBoundingClientRect();
    const left = placement.left - workspaceRect.left;
    const top = placement.top - workspaceRect.top;
    const key = [
      placement.mode,
      left,
      top,
      placement.width,
      placement.height,
      placement.bodyHeight,
      state.factionColorsWidgetSearchOpen
    ].join(":");
    if (measured || element.hidden || key !== lastPlacementKey) {
      if (!measured) rememberScroll();
      const scroll = retainedScroll;
      element.hidden = false;
      element.dataset.mode = placement.mode;
      setText(heading, placement.mode === "normal" ? "Faction Colors" : "Colors");
      heading.title = folded
        ? "Faction Colors — list will return when map space is available."
        : "Faction Colors";
      heading.setAttribute("aria-label", heading.title);
      searchToggle.hidden = folded;
      searchBox.hidden = folded || !state.factionColorsWidgetSearchOpen;
      body.hidden = folded;
      element.inert = false;
      pixels(element, "left", left);
      pixels(element, "top", top);
      pixels(element, "width", placement.width);
      pixels(element, "height", placement.height);
      if (!folded) {
        pixels(body, "height", placement.bodyHeight);
        if (body.scrollTop !== scroll) body.scrollTop = scroll;
      }
      lastPlacementKey = key;
    }
    if (pendingFocus) (folded ? heading : searchToggle).focus({ preventScroll: true });
    else if (active && !isPresented(active)) heading.focus({ preventScroll: true });
    pendingFocus = false;
  }
  function close({ returnFocus = invoker } = {}) {
    closing = true;
    session.setFactionColorsWidgetOpen(false);
    hide();
    closing = false;
    if (returnFocus && isPresented(returnFocus) && !returnFocus.disabled)
      returnFocus.focus({ preventScroll: true });
    else focusFallback();
  }
  searchToggle.addEventListener("click", () => {
    const open = !session.getSnapshot().factionColorsWidgetSearchOpen;
    session.setFactionColorsWidgetSearchOpen(open);
    position();
    if (open && isPresented(search)) search.focus({ preventScroll: true });
  });
  search.addEventListener("input", () => session.setFactionColorsWidgetSearch(search.value));
  closeButton.addEventListener("click", () => close());
  session.subscribe((change) => {
    if (change.type === "reset") {
      body.scrollTop = 0;
      retainedScroll = 0;
    }
    refresh();
  });
  refresh();
  return Object.freeze({
    element,
    refresh,
    position,
    close,
    containsFocus: () => !element.hidden && element.contains(document.activeElement),
    open(source) {
      if (!getAvailability().available || session.getSnapshot().focusMap) return false;
      invoker = source;
      pendingFocus = true;
      session.setFactionColorsWidgetOpen(true);
      refresh();
      return true;
    }
  });
}
