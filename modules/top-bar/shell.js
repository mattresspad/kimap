import {
  SEARCH_FILTER_GROUPS,
  THEATER_DESTINATIONS,
  createSearchFilterSelection,
  createSearchRecords,
  filterSearchRecords,
  getTheaterDestinationAvailability,
  getThemeTogglePresentation,
  getSearchRecordKey,
  normalizeTheme,
  persistTheme,
  setSearchFilterGroupEnabled,
  searchRecords
} from "./model.js";
import { createDestinationIcon } from "./icons.js";


const KIND_LABELS = Object.freeze({
  town: "Town",
  spawnArea: "Spawn Area",
  character: "Character / Animal",
  squad: "Squad",
  faction: "Faction",
  nest: "Nest",
  item: "Item",
  weapon: "Weapon",
  crossbow: "Crossbow",
  armour: "Armour",
  mapItem: "Map Item",
  nestItem: "Nest Item"
});

function isPresented(element) {
  if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  return element.getClientRects().length > 0;
}

function focusElement(element) {
  if (!element || typeof element.focus !== "function") return;
  try {
    element.focus({ preventScroll: true });
  } catch (_error) {
    element.focus();
  }
}

function createDestinationButton(destination, returnTrigger) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kimap-destination-button";
  button.dataset.theaterId = destination.id;
  button.dataset.returnTrigger = returnTrigger;
  button.dataset.destinationIcon = destination.icon;

  const label = document.createElement("span");
  label.textContent = destination.label;
  const icon = createDestinationIcon(destination.icon);
  if (icon) button.append(icon);
  button.append(label);
  return button;
}

function friendlyKind(kind) {
  return KIND_LABELS[kind] ?? kind;
}

export class TopBarController {
  constructor({
    root,
    windowManager,
    onActivateRecord,
    onBeforeOpenTransient = null,
    onBeforeOpenTheater = null,
    onSearchShortcut = null
  }) {
    if (!root) throw new Error("TopBarController requires a root element.");
    this.root = root;
    this.windowManager = windowManager;
    this.onActivateRecord = onActivateRecord;
    this.onBeforeOpenTransient = onBeforeOpenTransient;
    this.onBeforeOpenTheater = onBeforeOpenTheater;
    this.onSearchShortcut = onSearchShortcut;

    this.activeSurface = null;
    this.activeTrigger = null;
    this.layoutClass = root.dataset.layoutClass || "wide";
    this.registeredDestinations = new Set();
    this.destinationFailureReason = null;
    this.scenarioAvailable = false;
    this.searchState = "loading";
    this.searchUnavailableReason = "Searchable records are loading.";
    this.searchIndex = Object.freeze([]);
    this.searchResults = Object.freeze([]);
    this.enabledSearchFilterGroupIds = createSearchFilterSelection();
    this.searchFilterOpen = false;
    this.activeResultIndex = -1;
    this.suppressSearchFocusOpen = false;

    this.searchRoot = root.querySelector("#quick-search");
    this.searchLauncher = root.querySelector("[data-search-launcher]");
    this.searchInput = root.querySelector("#quick-search-input");
    this.searchClear = root.querySelector("[data-search-clear]");
    this.searchFilterTrigger = root.querySelector("[data-search-filter-trigger]");
    this.searchFilterPanel = root.querySelector("[data-search-filter-panel]");
    this.searchFilterOptions = root.querySelector("[data-search-filter-options]");
    this.searchPanel = root.querySelector("[data-search-panel]");
    this.searchResultsView = root.querySelector("[data-search-results-view]");
    this.searchStatus = root.querySelector("#quick-search-status");
    this.searchList = root.querySelector("#quick-search-results");
    this.themeToggle = root.querySelector("[data-theme-toggle]");

    this.handleRootClick = this.handleRootClick.bind(this);
    this.handleRootChange = this.handleRootChange.bind(this);
    this.handleRootKeydown = this.handleRootKeydown.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleSearchFocus = this.handleSearchFocus.bind(this);
    this.handleSearchKeydown = this.handleSearchKeydown.bind(this);

    this.renderDestinations();
    this.renderSearchFilterOptions();
    this.bindEvents();
    this.applyTheme(document.documentElement.dataset.theme);
    this.renderSearch();
    this.syncDestinationAvailability();
  }

  bindEvents() {
    this.root.addEventListener("click", this.handleRootClick);
    this.root.addEventListener("change", this.handleRootChange);
    this.root.addEventListener("keydown", this.handleRootKeydown);
    this.searchInput?.addEventListener("input", this.handleSearchInput);
    this.searchInput?.addEventListener("focus", this.handleSearchFocus);
    this.searchInput?.addEventListener("keydown", this.handleSearchKeydown);
    document.addEventListener("click", this.handleDocumentClick);
    document.addEventListener("keydown", this.handleDocumentKeydown);
  }

  destroy() {
    this.root.removeEventListener("click", this.handleRootClick);
    this.root.removeEventListener("change", this.handleRootChange);
    this.root.removeEventListener("keydown", this.handleRootKeydown);
    this.searchInput?.removeEventListener("input", this.handleSearchInput);
    this.searchInput?.removeEventListener("focus", this.handleSearchFocus);
    this.searchInput?.removeEventListener("keydown", this.handleSearchKeydown);
    document.removeEventListener("click", this.handleDocumentClick);
    document.removeEventListener("keydown", this.handleDocumentKeydown);
  }

  renderDestinations() {
    for (const host of this.root.querySelectorAll("[data-destination-group]")) {
      const group = host.dataset.destinationGroup;
      const fragment = document.createDocumentFragment();
      for (const destination of THEATER_DESTINATIONS) {
        if (destination.group === group) {
          fragment.append(createDestinationButton(destination, destination.group));
        }
      }
      host.replaceChildren(fragment);
    }
  }

  renderSearchFilterOptions() {
    if (!this.searchFilterOptions) return;
    const fragment = document.createDocumentFragment();
    for (const group of SEARCH_FILTER_GROUPS) {
      const label = document.createElement("label");
      label.className = "kimap-quick-search__filter-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.enabledSearchFilterGroupIds.includes(group.id);
      checkbox.dataset.searchFilterGroup = group.id;

      const text = document.createElement("span");
      text.textContent = group.label;
      label.append(checkbox, text);
      fragment.append(label);
    }
    this.searchFilterOptions.replaceChildren(fragment);
  }

  handleRootClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const disclosureTrigger = target.closest("[data-shell-trigger]");
    if (disclosureTrigger) {
      event.preventDefault();
      this.toggleDisclosure(disclosureTrigger.dataset.shellTrigger, disclosureTrigger);
      return;
    }

    const theaterButton = target.closest("[data-theater-id]");
    if (theaterButton) {
      event.preventDefault();
      if (theaterButton.disabled || theaterButton.getAttribute("aria-disabled") === "true") return;
      const paneId = theaterButton.dataset.theaterId;
      const returnKey = theaterButton.dataset.returnTrigger;
      const returnFocus = () =>
        this.getVisibleTrigger(returnKey) ?? this.root.querySelector(".kimap-wordmark");
      this.closeTransient({ restoreFocus: false });
      this.onBeforeOpenTheater?.(paneId);
      this.windowManager.open(paneId, { returnFocus });
      return;
    }

    if (target.closest("[data-search-launcher]")) {
      event.preventDefault();
      if (this.activeSurface === "search") {
        this.closeTransient({ restoreFocus: true });
      } else {
        this.openSearch({ focus: true });
      }
      return;
    }

    if (target.closest("[data-search-filter-trigger]")) {
      event.preventDefault();
      if (this.searchState !== "ready") return;
      if (this.activeSurface !== "search") this.openSearch();
      if (this.searchFilterOpen) this.closeSearchFilter({ focus: true });
      else this.openSearchFilter();
      return;
    }

    if (target.closest("[data-search-clear]")) {
      event.preventDefault();
      this.clearSearch({ focus: true });
      return;
    }

    if (target.closest("[data-theme-toggle]")) {
      event.preventDefault();
      this.closeTransient({ restoreFocus: false });
      const presentation = getThemeTogglePresentation(document.documentElement.dataset.theme);
      this.applyTheme(presentation.nextTheme, { persist: true });
      return;
    }


    const resultOption = target.closest("[data-search-result-key]");
    if (resultOption) {
      event.preventDefault();
      this.activateSearchResult(resultOption.dataset.searchResultKey);
      return;
    }

    if (target.closest("[data-shell-panel] a")) this.closeTransient({ restoreFocus: false });
    else if (
      this.activeSurface !== null &&
      !target.closest("[data-shell-panel]") &&
      !this.searchRoot?.contains(target)
    ) {
      this.closeTransient({ restoreFocus: false });
    }
  }

  handleRootChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    const checkbox = target?.closest("[data-search-filter-group]");
    if (!checkbox || this.searchState !== "ready") return;
    this.enabledSearchFilterGroupIds = setSearchFilterGroupEnabled(
      this.enabledSearchFilterGroupIds,
      checkbox.dataset.searchFilterGroup,
      checkbox.checked
    );
    this.updateSearchResults();
  }

  handleRootKeydown(event) {
    if (!this.searchFilterOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.closeSearchFilter({ focus: true });
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && event.target === this.searchFilterTrigger) {
      const firstCheckbox = this.searchFilterPanel?.querySelector("[data-search-filter-group]");
      if (!firstCheckbox) return;
      event.preventDefault();
      focusElement(firstCheckbox);
    }
  }

  handleDocumentClick(event) {
    if (this.activeSurface === null || this.root.contains(event.target)) return;
    this.closeTransient({ restoreFocus: false });
  }

  handleDocumentKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (this.searchState !== "ready") return;
      this.onSearchShortcut?.();
      this.openSearch({ focus: true });
    }
  }

  handleSearchInput() {
    this.updateSearchResults();
  }

  handleSearchFocus() {
    if (!this.suppressSearchFocusOpen) this.openSearch();
  }

  handleSearchKeydown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (this.searchResults.length === 0) return;
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const start = this.activeResultIndex < 0 ? (direction > 0 ? -1 : 0) : this.activeResultIndex;
      this.setActiveResult(
        (start + direction + this.searchResults.length) % this.searchResults.length
      );
      return;
    }
    if (event.key === "Enter" && this.activeResultIndex >= 0) {
      event.preventDefault();
      this.activateSearchResult(getSearchRecordKey(this.searchResults[this.activeResultIndex]));
    }
  }

  toggleDisclosure(name, trigger) {
    if (!name) return;
    if (this.activeSurface === name) {
      this.closeTransient({ restoreFocus: true });
      return;
    }
    this.onBeforeOpenTransient?.("shell");
    this.closeTransient({ restoreFocus: false });
    const panel = this.root.querySelector(`[data-shell-panel="${CSS.escape(name)}"]`);
    if (!panel) return;
    this.activeSurface = name;
    this.activeTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
  }

  openSearchFilter() {
    if (this.searchState !== "ready" || !this.searchFilterTrigger || !this.searchFilterPanel) {
      return false;
    }
    this.searchFilterOpen = true;
    this.activeResultIndex = -1;
    this.renderSearch();
    return true;
  }

  closeSearchFilter({ focus = false } = {}) {
    if (!this.searchFilterOpen) return false;
    this.searchFilterOpen = false;
    this.updateSearchResults();
    if (focus) focusElement(this.searchFilterTrigger);
    return true;
  }

  openSearch({ focus = false } = {}) {
    if (this.searchState !== "ready" || !this.searchInput) return false;
    if (this.activeSurface !== "search") {
      this.onBeforeOpenTransient?.("search");
      this.closeTransient({ restoreFocus: false });
      this.activeSurface = "search";
      this.activeTrigger = this.layoutClass === "narrow" ? this.searchLauncher : this.searchInput;
    }
    this.searchRoot.dataset.open = "true";
    this.searchLauncher?.setAttribute("aria-expanded", "true");
    this.updateSearchResults();
    if (focus) requestAnimationFrame(() => focusElement(this.searchInput));
    return true;
  }

  closeTransient({ restoreFocus = true } = {}) {
    if (this.activeSurface === null) return false;
    const surface = this.activeSurface;
    const trigger = this.activeTrigger;
    if (surface === "search") {
      this.searchRoot.dataset.open = "false";
      this.searchLauncher?.setAttribute("aria-expanded", "false");
      this.searchFilterOpen = false;
      this.searchFilterTrigger?.setAttribute("aria-expanded", "false");
      if (this.searchFilterPanel) this.searchFilterPanel.hidden = true;
      this.searchInput?.setAttribute("aria-expanded", "false");
      this.searchInput?.removeAttribute("aria-activedescendant");
      if (this.searchPanel) this.searchPanel.hidden = true;
      this.activeResultIndex = -1;
    } else {
      const panel = this.root.querySelector(`[data-shell-panel="${CSS.escape(surface)}"]`);
      if (panel) panel.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
    }
    this.activeSurface = null;
    this.activeTrigger = null;
    if (restoreFocus) {
      const focusTarget =
        surface === "search"
          ? this.layoutClass === "narrow"
            ? this.searchLauncher
            : this.searchInput
          : trigger;
      this.suppressSearchFocusOpen = surface === "search";
      focusElement(focusTarget);
      this.suppressSearchFocusOpen = false;
    }
    return true;
  }

  dismissTransient({ restoreFocus = true } = {}) {
    if (this.searchFilterOpen) return this.closeSearchFilter({ focus: restoreFocus });
    return this.closeTransient({ restoreFocus });
  }

  isTransientActive() {
    return this.activeSurface !== null;
  }

  getVisibleTrigger(key) {
    if (key === "navigation") {
      const resolvedKey = this.layoutClass === "wide" ? "simulation" : "navigation";
      return (
        [...this.root.querySelectorAll(`[data-shell-trigger="${resolvedKey}"]`)].find(
          isPresented
        ) ?? null
      );
    }
    if (["simulation", "reference", "workspace", "utility", "help"].includes(key)) {
      if (this.layoutClass === "wide") {
        const selector =
          key === "utility" || key === "help"
            ? '[data-theater-id="help"]'
            : `[data-shell-trigger="${CSS.escape(key)}"]`;
        return [...this.root.querySelectorAll(selector)].find(isPresented) ?? null;
      }
      return (
        [...this.root.querySelectorAll('[data-shell-trigger="navigation"]')].find(isPresented) ??
        null
      );
    }
    if (key === "search") return this.getSearchFocusTarget();
    if (key === "sites" && this.layoutClass === "wide") {
      return [...this.root.querySelectorAll(".kimap-ecosystem-wide a")].find(isPresented) ?? null;
    }
    return (
      [...this.root.querySelectorAll(`[data-shell-trigger="${CSS.escape(key ?? "")}"]`)].find(
        isPresented
      ) ?? null
    );
  }

  getSearchFocusTarget() {
    return this.layoutClass === "narrow" ? this.searchLauncher : this.searchInput;
  }

  setLayout(layoutClass) {
    const normalized = ["wide", "standard", "narrow"].includes(layoutClass) ? layoutClass : "wide";
    if (normalized === this.layoutClass) return false;
    const activeSurface = this.activeSurface;
    const focusWasInShell = this.root.contains(document.activeElement);
    this.closeTransient({ restoreFocus: false });
    this.layoutClass = normalized;
    this.root.dataset.layoutClass = normalized;
    if (activeSurface && focusWasInShell) {
      requestAnimationFrame(() => {
        focusElement(
          this.getVisibleTrigger(activeSurface) ?? this.root.querySelector(".kimap-wordmark")
        );
      });
    }
    return true;
  }

  setRegisteredDestinations(ids) {
    for (const id of ids) this.registeredDestinations.add(String(id));
    this.windowManager.setTabOrder?.(THEATER_DESTINATIONS.map(({ id }) => id));
    this.syncDestinationAvailability();
  }

  setDestinationFailure(reason) {
    this.destinationFailureReason = reason || "This destination is unavailable.";
    this.syncDestinationAvailability();
  }

  clearInitializationFailure() {
    if (this.destinationFailureReason === null) return false;
    this.destinationFailureReason = null;
    this.syncDestinationAvailability();
    return true;
  }

  setInitializationFailure(reason) {
    const message = reason || "Application initialization did not complete.";
    this.setDestinationFailure(message);
    this.setSearchUnavailable(message);
  }

  setScenarioAvailable(available) {
    this.scenarioAvailable = Boolean(available);
    this.syncDestinationAvailability();
  }

  syncDestinationAvailability() {
    for (const destination of THEATER_DESTINATIONS) {
      let availability;
      if (this.destinationFailureReason && destination.id !== "help") {
        availability = {
          available: false,
          reason: this.destinationFailureReason
        };
      } else if (!this.registeredDestinations.has(destination.id)) {
        availability = {
          available: false,
          reason: this.destinationFailureReason ?? `${destination.label} is loading.`
        };
      } else {
        availability = getTheaterDestinationAvailability(destination.id, {
          scenarioAvailable: this.scenarioAvailable
        });
      }
      this.windowManager.setAvailability(
        destination.id,
        availability.available,
        availability.reason ?? ""
      );
      for (const button of this.root.querySelectorAll(
        `[data-theater-id="${CSS.escape(destination.id)}"]`
      )) {
        button.disabled = !availability.available;
        button.setAttribute("aria-disabled", String(!availability.available));
        button.title = availability.available ? destination.label : availability.reason;
        if (availability.reason) button.dataset.unavailableReason = availability.reason;
        else delete button.dataset.unavailableReason;
      }
    }
  }

  setSearchRecords(databases) {
    this.searchIndex = createSearchRecords(databases);
    if (this.searchIndex.length === 0) {
      this.setSearchUnavailable("No searchable records are available for this manifest.");
      return;
    }
    this.searchState = "ready";
    this.searchUnavailableReason = "";
    this.searchRoot.dataset.state = "ready";
    this.searchInput.disabled = false;
    this.searchInput.placeholder = "Search map and reference records…";
    if (this.searchFilterTrigger) this.searchFilterTrigger.disabled = false;
    if (this.searchLauncher) {
      this.searchLauncher.disabled = false;
      this.searchLauncher.title = "Open Quick Search";
      this.searchLauncher.setAttribute("aria-label", "Open Quick Search");
    }
    this.renderSearch();
  }

  setSearchUnavailable(reason) {
    this.searchState = "unavailable";
    this.searchUnavailableReason = reason || "Quick Search is unavailable.";
    this.searchRoot.dataset.state = "unavailable";
    this.searchInput.disabled = true;
    this.searchInput.placeholder = this.searchUnavailableReason;
    if (this.searchFilterTrigger) {
      this.searchFilterTrigger.disabled = true;
      this.searchFilterTrigger.title = this.searchUnavailableReason;
      this.searchFilterTrigger.setAttribute("aria-label", this.searchUnavailableReason);
    }
    if (this.searchLauncher) {
      this.searchLauncher.disabled = true;
      this.searchLauncher.title = this.searchUnavailableReason;
      this.searchLauncher.setAttribute("aria-label", this.searchUnavailableReason);
    }
    this.closeTransient({ restoreFocus: false });
    this.renderSearch();
  }

  updateSearchResults() {
    if (this.searchState !== "ready") return;
    const filteredRecords = filterSearchRecords(this.searchIndex, this.enabledSearchFilterGroupIds);
    this.searchResults = searchRecords(filteredRecords, this.searchInput.value);
    this.activeResultIndex = this.searchResults.length > 0 ? 0 : -1;
    this.renderSearch();
  }

  renderSearch() {
    if (!this.searchInput || !this.searchList || !this.searchPanel || !this.searchStatus) return;
    const query = this.searchInput.value.trim();
    const enabledFilterCount = this.enabledSearchFilterGroupIds.length;
    const filterGroupCount = SEARCH_FILTER_GROUPS.length;
    this.searchClear.hidden = query === "";
    this.searchList.replaceChildren();

    if (this.searchFilterTrigger) {
      const filterLabel =
        enabledFilterCount === filterGroupCount
          ? "Filter search record types (all enabled)"
          : `Filter search record types (${String(enabledFilterCount)} of ${String(filterGroupCount)} enabled)`;
      this.searchFilterTrigger.disabled = this.searchState !== "ready";
      this.searchFilterTrigger.dataset.filtered = String(enabledFilterCount !== filterGroupCount);
      this.searchFilterTrigger.setAttribute("aria-expanded", String(this.searchFilterOpen));
      if (this.searchState === "ready") {
        this.searchFilterTrigger.title = filterLabel;
        this.searchFilterTrigger.setAttribute("aria-label", filterLabel);
      }
    }
    for (const checkbox of this.searchFilterOptions?.querySelectorAll(
      "[data-search-filter-group]"
    ) ?? []) {
      checkbox.checked = this.enabledSearchFilterGroupIds.includes(
        checkbox.dataset.searchFilterGroup
      );
    }

    if (this.searchState !== "ready") {
      this.searchStatus.textContent = this.searchUnavailableReason;
      this.searchPanel.hidden = true;
      if (this.searchFilterPanel) this.searchFilterPanel.hidden = true;
      if (this.searchResultsView) this.searchResultsView.hidden = false;
      return;
    }
    if (this.searchFilterOpen) {
      const expanded = this.activeSurface === "search";
      this.searchPanel.hidden = !expanded;
      if (this.searchFilterPanel) this.searchFilterPanel.hidden = false;
      if (this.searchResultsView) this.searchResultsView.hidden = true;
      this.searchInput.setAttribute("aria-expanded", "false");
      this.searchInput.removeAttribute("aria-activedescendant");
      return;
    }

    if (this.searchFilterPanel) this.searchFilterPanel.hidden = true;
    if (this.searchResultsView) this.searchResultsView.hidden = false;
    if (query === "") {
      this.searchStatus.textContent = "";
      this.searchPanel.hidden = true;
      this.searchInput.setAttribute("aria-expanded", "false");
      this.searchInput.removeAttribute("aria-activedescendant");
      return;
    }

    if (enabledFilterCount === 0) {
      this.searchStatus.textContent = "Select at least one record type.";
    } else if (this.searchResults.length === 0) {
      this.searchStatus.textContent = `No records found for “${query}”.`;
    } else {
      this.searchStatus.textContent = "";
      const fragment = document.createDocumentFragment();
      this.searchResults.forEach((record, index) => {
        const option = document.createElement("li");
        option.id = `quick-search-option-${String(index)}`;
        option.className = "kimap-quick-search__option";
        option.role = "option";
        option.setAttribute("aria-selected", String(index === this.activeResultIndex));

        option.dataset.searchResultKey = getSearchRecordKey(record);
        option.tabIndex = -1;

        const name = document.createElement("strong");
        name.textContent = record.name;
        const meta = document.createElement("span");
        meta.className = "kimap-quick-search__meta";
        const kind = document.createElement("span");
        kind.className = "kimap-quick-search__kind";
        kind.textContent = friendlyKind(record.kind);
        const separator = document.createElement("span");
        separator.className = "kimap-quick-search__separator";
        separator.textContent = "·";
        const stableId = document.createElement("span");
        stableId.className = "kimap-quick-search__id";
        stableId.textContent = record.id;
        meta.append(kind, separator, stableId);
        option.append(name, meta);
        fragment.append(option);
      });
      this.searchList.append(fragment);
    }

    const expanded = this.activeSurface === "search";
    this.searchPanel.hidden = !expanded;
    this.searchInput.setAttribute("aria-expanded", String(expanded));
    this.setActiveResult(this.activeResultIndex);
  }

  setActiveResult(index) {
    this.activeResultIndex = index;
    const options = [...this.searchList.querySelectorAll('[role="option"]')];
    options.forEach((option, optionIndex) => {
      option.setAttribute("aria-selected", String(optionIndex === index));
    });
    const active = options[index];
    if (active) {
      this.searchInput.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    } else {
      this.searchInput.removeAttribute("aria-activedescendant");
    }
  }

  activateSearchResult(key) {
    const record = this.searchResults.find((entry) => getSearchRecordKey(entry) === key);
    if (!record) return false;
    const activated = this.onActivateRecord?.(record) === true;
    if (!activated) return false;
    this.clearSearch();
    this.closeTransient({ restoreFocus: false });
    return true;
  }

  clearSearch({ focus = false } = {}) {
    if (!this.searchInput) return;
    this.searchInput.value = "";
    this.searchResults = Object.freeze([]);
    this.activeResultIndex = -1;
    this.renderSearch();
    if (focus) focusElement(this.searchInput);
  }

  applyTheme(theme, { persist = false } = {}) {
    const normalized = normalizeTheme(theme);
    document.documentElement.dataset.theme = normalized;
    if (persist) {
      try {
        persistTheme(localStorage, normalized);
      } catch (_error) {
        // Theme remains usable when browser storage is unavailable.
      }
    }
    const presentation = getThemeTogglePresentation(normalized);
    if (this.themeToggle) {
      this.themeToggle.title = presentation.title;
      this.themeToggle.setAttribute("aria-label", presentation.ariaLabel);
      for (const icon of this.themeToggle.querySelectorAll("[data-theme-icon]")) {
        icon.toggleAttribute("hidden", icon.dataset.themeIcon !== presentation.icon);
      }
    }
    return normalized;
  }

  closeDisclosureIfActive(name) {
    if (this.activeSurface === name) this.closeTransient({ restoreFocus: false });
  }
}

export function createTopBarController(options) {
  return new TopBarController(options);
}

export function createShellTransientAdapter(controller) {
  if (
    !controller ||
    typeof controller.isTransientActive !== "function" ||
    typeof controller.closeTransient !== "function" ||
    typeof controller.getVisibleTrigger !== "function"
  ) {
    throw new TypeError("A TopBarController-compatible transient owner is required.");
  }
  return Object.freeze({
    isActive: () => controller.isTransientActive(),
    dismiss: (options = {}) =>
      typeof controller.dismissTransient === "function"
        ? controller.dismissTransient(options)
        : controller.closeTransient(options),
    resolveVisibleTrigger: (key) => controller.getVisibleTrigger(key)
  });
}
