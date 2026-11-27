// kimap/modules/window-manager.js

import { createDestinationIcon } from "./top-bar/icons.js";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "details > summary:first-of-type",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

const HORIZONTAL_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

function isFocusable(element) {
  if (!element || element.getAttribute("aria-hidden") === "true") return false;
  return element.getClientRects().length > 0;
}

function requestFrame(callback) {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return setTimeout(callback, 0);
}

function cancelFrame(frameId) {
  if (frameId === null) return;
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
  else clearTimeout(frameId);
}

function navigationScrollBehavior() {
  return globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function createAvailability(available, reason = "") {
  const normalizedAvailable = Boolean(available);
  const normalizedReason = normalizedAvailable ? "" : String(reason).trim() || "Unavailable.";
  return Object.freeze({ available: normalizedAvailable, reason: normalizedReason });
}

function freezeDescriptors(entries, compare = null) {
  const copies = entries.map((entry) => Object.freeze({ ...entry }));
  if (compare) copies.sort(compare);
  return Object.freeze(copies);
}

function findDatasetOwner(target, boundary, key) {
  let current = target;
  while (current) {
    if (typeof current.dataset?.[key] === "string") return current;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return null;
}

const UNKNOWN_PANE_AVAILABILITY = createAvailability(false, "Unknown theater destination.");

export class WindowManager {
  constructor({ onBeforeOpen = null } = {}) {
    this.panes = new Map();
    this.tabs = new Map();
    this.availability = new Map();
    this.activePaneId = null;
    this.openState = false;
    this.previouslyFocusedElement = null;
    this.returnFocusResolver = null;
    this.visibilityFrame = null;
    this.closeTimer = null;
    this.sectionNavigationTimer = null;
    this.sectionHighlightTimer = null;
    this.sectionHighlightTarget = null;
    this.onBeforeOpen = typeof onBeforeOpen === "function" ? onBeforeOpen : null;

    this.navigationGroups = Object.freeze([]);
    this.navigationDestinations = Object.freeze([]);
    this.destinationDescriptors = new Map();
    this.groupButtons = new Map();
    this.childFocusByGroup = new Map();
    this.utilityDestinationId = null;
    this.browsedGroupId = null;

    this.shell = document.getElementById("unified-shell");
    this.backdrop = document.getElementById("unified-backdrop");
    this.stage = document.getElementById("unified-stage");
    this.groupContainer = document.getElementById("unified-groups");
    this.tabContainer = document.getElementById("unified-tabs");
    this.utilityButton = document.getElementById("unified-help-btn");
    this.currentTitle = document.getElementById("unified-current-title");
    this.warehouse = document.getElementById("pane-warehouse");
    this.scrollLeftBtn = document.getElementById("tabs-scroll-left");
    this.scrollRightBtn = document.getElementById("tabs-scroll-right");

    this.configureDialogSemantics();
    this.setupGlobalListeners();
  }

  configureDialogSemantics() {
    if (this.shell) {
      this.shell.setAttribute("role", "dialog");
      this.shell.setAttribute("aria-modal", "true");
      this.shell.setAttribute("tabindex", "-1");
      if (this.currentTitle?.id) this.shell.setAttribute("aria-labelledby", this.currentTitle.id);
    }
    if (this.backdrop) this.backdrop.setAttribute("aria-hidden", "true");
    if (this.groupContainer) {
      this.groupContainer.setAttribute("role", "toolbar");
      this.groupContainer.setAttribute("aria-label", "Theater sections");
    }
    if (this.tabContainer) {
      this.tabContainer.setAttribute("role", "toolbar");
      this.tabContainer.setAttribute("aria-label", "Theater destinations");
    }

    const closeBtn = document.getElementById("unified-close-btn");
    if (closeBtn && !closeBtn.getAttribute("aria-label")) {
      closeBtn.setAttribute("aria-label", "Close window");
    }
  }

  setupGlobalListeners() {
    const closeBtn = document.getElementById("unified-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    if (this.utilityButton) {
      this.utilityButton.addEventListener("click", () => {
        const paneId = this.utilityButton.dataset.pane;
        if (paneId) this.open(paneId);
      });
    }

    if (this.backdrop) {
      this.backdrop.addEventListener("click", (event) => {
        if (event.target === this.backdrop) this.close();
      });
    }

    // Escape is intentionally coordinated by the viewport workbench. This listener owns only
    // focus containment while the theater is open.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && this.isOpen()) this.trapFocus(event);
    });

    if (this.scrollLeftBtn && this.scrollRightBtn && this.tabContainer) {
      this.scrollLeftBtn.addEventListener("click", () => {
        this.tabContainer.scrollBy({ left: -200, behavior: navigationScrollBehavior() });
      });
      this.scrollRightBtn.addEventListener("click", () => {
        this.tabContainer.scrollBy({ left: 200, behavior: navigationScrollBehavior() });
      });
      this.tabContainer.addEventListener("scroll", () => this.checkScrollArrows());
      window.addEventListener("resize", () => this.checkScrollArrows());
    }

    this.groupContainer?.addEventListener("click", (event) => this.handleGroupClick(event));
    this.groupContainer?.addEventListener("keydown", (event) => this.handleGroupKeydown(event));
    this.tabContainer?.addEventListener("keydown", (event) => this.handleTabKeydown(event));
  }

  /**
   * Configures the immutable parent/child theater navigation without taking ownership of pane
   * availability or content. The utility destination remains fixed beside the close control.
   */
  configureNavigation({ groups, destinations, utilityDestinationId = null } = {}) {
    if (!Array.isArray(groups) || !Array.isArray(destinations)) return false;

    const normalizedUtilityId = utilityDestinationId === null ? null : String(utilityDestinationId);
    const allGroups = freezeDescriptors(
      groups
        .filter((entry) => entry && typeof entry.id === "string")
        .map((entry) => ({ ...entry, id: String(entry.id) })),
      (left, right) => left.order - right.order
    );
    const groupOrder = new Map(allGroups.map(({ id }, index) => [id, index]));
    const normalizedDestinations = freezeDescriptors(
      destinations
        .filter((entry) => entry && typeof entry.id === "string" && typeof entry.group === "string")
        .map((entry) => ({ ...entry, id: String(entry.id), group: String(entry.group) })),
      (left, right) =>
        (groupOrder.get(left.group) ?? Number.MAX_SAFE_INTEGER) -
          (groupOrder.get(right.group) ?? Number.MAX_SAFE_INTEGER) || left.order - right.order
    );
    const destinationIds = new Set(normalizedDestinations.map(({ id }) => id));
    const utilityGroup = normalizedDestinations.find(({ id }) => id === normalizedUtilityId)?.group;
    const normalizedGroups = freezeDescriptors(
      allGroups.filter(
        (entry) =>
          entry.id !== utilityGroup &&
          normalizedDestinations.some(
            (destination) =>
              destination.group === entry.id && destination.id !== normalizedUtilityId
          )
      )
    );

    if (normalizedGroups.length === 0 || destinationIds.size !== normalizedDestinations.length) {
      return false;
    }

    this.navigationGroups = normalizedGroups;
    this.navigationDestinations = normalizedDestinations;
    this.destinationDescriptors = new Map(
      normalizedDestinations.map((destination) => [destination.id, destination])
    );
    this.utilityDestinationId = destinationIds.has(normalizedUtilityId)
      ? normalizedUtilityId
      : null;

    this.renderGroupButtons();
    this.configureUtilityButton();
    for (const [paneId, pane] of this.panes) this.configurePaneAndLauncher(paneId, pane);
    this.setTabOrder(normalizedDestinations.map(({ id }) => id));

    const activeGroup = this.destinationDescriptors.get(this.activePaneId)?.group;
    const initialGroup = this.groupButtons.has(activeGroup)
      ? activeGroup
      : this.groupButtons.has(this.browsedGroupId)
        ? this.browsedGroupId
        : normalizedGroups[0]?.id;
    if (initialGroup) this.browseGroup(initialGroup, { force: true });
    this.updateActiveNavigation();
    return true;
  }

  renderGroupButtons() {
    if (!this.groupContainer) return;
    this.groupButtons.clear();
    const buttons = [];
    for (const group of this.navigationGroups) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "theater-group-btn";
      button.dataset.theaterGroup = group.id;
      button.setAttribute("aria-pressed", "false");
      button.tabIndex = -1;

      const label = document.createElement("span");
      label.className = "theater-group-label";
      label.textContent = group.label;
      const current = document.createElement("span");
      current.className = "theater-group-current";
      current.hidden = true;
      button.append(label, current);
      buttons.push(button);
      this.groupButtons.set(group.id, button);
    }
    this.groupContainer.replaceChildren(...buttons);
  }

  configureUtilityButton() {
    if (!this.utilityButton || !this.utilityDestinationId) return;
    const destination = this.destinationDescriptors.get(this.utilityDestinationId);
    if (!destination) return;

    this.utilityButton.dataset.pane = destination.id;
    this.utilityButton.dataset.destinationIcon = destination.icon;
    const paneId = this.panes.get(destination.id)?.element.id;
    if (paneId) this.utilityButton.setAttribute("aria-controls", paneId);
    else this.utilityButton.removeAttribute("aria-controls");
    this.utilityButton.setAttribute("aria-label", `Open ${destination.label}`);
    this.utilityButton.setAttribute("title", destination.label);
    const icon = createDestinationIcon(destination.icon);
    const label = document.createElement("span");
    label.className = "unified-visually-hidden";
    label.textContent = destination.label;
    this.utilityButton.replaceChildren(...(icon ? [icon, label] : [label]));
    this.tabs.set(destination.id, this.utilityButton);
    this.updateTabAvailability(destination.id);
  }

  /**
   * Registers a theater pane. Re-registering an existing ID updates its metadata without
   * creating another launcher.
   */
  register(id, title, element, onShow = null) {
    if (!element) {
      console.error(`WindowManager: Attempted to register pane '${id}' but element is null.`);
      return false;
    }

    const paneId = String(id);
    const descriptor = this.destinationDescriptors.get(paneId);
    const paneTitle = descriptor?.label ?? String(title);
    const wasRegistered = this.panes.has(paneId);
    this.panes.set(paneId, { title: paneTitle, element, onShow });
    if (!this.availability.has(paneId)) this.availability.set(paneId, createAvailability(true));

    if (!element.id) element.id = `unified-pane-${paneId}`;
    this.configurePaneAndLauncher(paneId, this.panes.get(paneId));
    this.setTabOrder(this.navigationDestinations.map(({ id: destinationId }) => destinationId));
    this.updateTabAvailability(paneId);
    this.syncChildVisibility();
    this.checkScrollArrows();
    return !wasRegistered;
  }

  configurePaneAndLauncher(paneId, pane) {
    const descriptor = this.destinationDescriptors.get(paneId);
    const paneTitle = descriptor?.label ?? pane.title;
    pane.title = paneTitle;
    pane.element.setAttribute("role", "region");
    if (this.currentTitle?.id) {
      pane.element.setAttribute("aria-labelledby", this.currentTitle.id);
      pane.element.removeAttribute("aria-label");
    } else {
      pane.element.removeAttribute("aria-labelledby");
      pane.element.setAttribute("aria-label", paneTitle);
    }

    if (paneId === this.utilityDestinationId && this.utilityButton) {
      this.tabs.set(paneId, this.utilityButton);
      this.utilityButton.setAttribute("aria-controls", pane.element.id);
      return;
    }

    let button = this.tabs.get(paneId);
    if (!button || button === this.utilityButton) {
      if (!this.tabContainer) return;
      button = document.createElement("button");
      button.type = "button";
      button.className = "theater-destination-btn";
      button.dataset.pane = paneId;
      button.id = `unified-tab-${paneId}`;
      button.setAttribute("aria-controls", pane.element.id);
      button.tabIndex = -1;
      button.addEventListener("click", () => this.open(paneId));
      this.tabs.set(paneId, button);
      this.tabContainer.appendChild(button);
    }
    button.textContent = paneTitle;
    button.dataset.theaterGroup = descriptor?.group ?? "";
    button.setAttribute("aria-controls", pane.element.id);
  }

  /**
   * Updates one pane's shared runtime availability. Calls may precede registration so async
   * application state can establish a destination policy before its theater module mounts.
   */
  setAvailability(paneId, available, reason = "") {
    const normalizedId = String(paneId);
    const next = createAvailability(available, reason);
    const current = this.availability.get(normalizedId);
    if (current?.available === next.available && current.reason === next.reason) return false;

    this.availability.set(normalizedId, next);
    this.updateTabAvailability(normalizedId);
    this.syncChildVisibility();
    if (!next.available && this.isOpen(normalizedId)) this.close();
    return true;
  }

  getAvailability(paneId) {
    return this.availability.get(String(paneId)) ?? UNKNOWN_PANE_AVAILABILITY;
  }

  /**
   * Applies a stable presentation order without changing pane registration or active state.
   * Unknown IDs are ignored and registered child launchers omitted from the requested order remain
   * last. The fixed utility launcher is never moved into the child row.
   */
  setTabOrder(paneIds) {
    if (!this.tabContainer || !Array.isArray(paneIds)) return false;
    const childIds = [...this.tabs.keys()].filter((id) => id !== this.utilityDestinationId);
    const orderedIds = [...new Set(paneIds.map(String))].filter((id) => childIds.includes(id));
    const remainingIds = childIds.filter((id) => !orderedIds.includes(id));
    const nextIds = [...orderedIds, ...remainingIds];
    const currentIds = this.tabContainer.children
      ? [...this.tabContainer.children]
          .map((tab) => tab.dataset?.pane)
          .filter((id) => typeof id === "string")
      : [];
    if (
      currentIds.length === nextIds.length &&
      currentIds.every((id, index) => id === nextIds[index])
    ) {
      return false;
    }
    for (const id of nextIds) this.tabContainer.appendChild(this.tabs.get(id));
    this.syncChildVisibility();
    this.checkScrollArrows();
    return true;
  }

  updateTabAvailability(paneId) {
    const normalizedId = String(paneId);
    const tab = this.tabs.get(normalizedId);
    if (!tab) return;

    const descriptor = this.destinationDescriptors.get(normalizedId);
    const { available, reason } = this.getAvailability(normalizedId);
    tab.disabled = !available;
    tab.setAttribute("aria-disabled", String(!available));
    if (available) {
      if (normalizedId === this.utilityDestinationId) {
        tab.setAttribute("title", descriptor?.label ?? "Help Guide");
        tab.setAttribute("aria-label", `Open ${descriptor?.label ?? "Help Guide"}`);
      } else {
        tab.removeAttribute("title");
        tab.removeAttribute("aria-label");
      }
      delete tab.dataset.unavailableReason;
    } else {
      tab.setAttribute("title", reason);
      tab.setAttribute("aria-label", descriptor?.label ? `${descriptor.label}: ${reason}` : reason);
      tab.dataset.unavailableReason = reason;
    }
  }

  /**
   * Changes only the parent group being browsed. It never opens or replaces a content pane.
   */
  browseGroup(groupId, { focusGroup = false, focusChild = false, force = false } = {}) {
    const normalizedId = String(groupId);
    if (!this.groupButtons.has(normalizedId)) return false;
    const changed = this.browsedGroupId !== normalizedId;
    if (!changed && !force) {
      if (focusGroup) this.groupButtons.get(normalizedId)?.focus({ preventScroll: true });
      if (focusChild) this.focusFirstAvailableChild(normalizedId);
      return false;
    }

    this.browsedGroupId = normalizedId;
    for (const [id, button] of this.groupButtons) {
      const browsed = id === normalizedId;
      button.setAttribute("aria-pressed", String(browsed));
      button.tabIndex = browsed ? 0 : -1;
    }
    const availableIds = this.childIdsForGroup(normalizedId, { availableOnly: true });
    const initialChildId = availableIds.includes(this.activePaneId)
      ? this.activePaneId
      : availableIds[0];
    if (initialChildId) this.childFocusByGroup.set(normalizedId, initialChildId);
    else this.childFocusByGroup.delete(normalizedId);
    this.syncChildVisibility();
    this.updateGroupPresentation();
    if (focusGroup) this.groupButtons.get(normalizedId)?.focus({ preventScroll: true });
    if (focusChild) this.focusFirstAvailableChild(normalizedId);
    this.tabContainer?.scrollTo?.({ left: 0, behavior: "auto" });
    const activeTab = this.tabs.get(this.activePaneId);
    if (activeTab && !activeTab.hidden && this.openState) {
      activeTab.scrollIntoView({
        behavior: navigationScrollBehavior(),
        block: "nearest",
        inline: "center"
      });
    }
    requestFrame(() => this.checkScrollArrows());
    return changed;
  }

  getBrowsedGroupId() {
    return this.browsedGroupId;
  }

  childIdsForGroup(groupId, { availableOnly = false } = {}) {
    const ids = this.navigationDestinations
      .filter(
        (destination) =>
          destination.group === groupId && destination.id !== this.utilityDestinationId
      )
      .map(({ id }) => id)
      .filter((id) => this.tabs.has(id));
    if (!availableOnly) return ids;
    return ids.filter((id) => this.getAvailability(id).available);
  }

  syncChildVisibility() {
    if (!this.tabContainer) return;
    const configured = this.navigationGroups.length > 0;
    for (const [id, tab] of this.tabs) {
      if (id === this.utilityDestinationId) continue;
      const groupId = this.destinationDescriptors.get(id)?.group ?? tab.dataset.theaterGroup;
      const visible = !configured || groupId === this.browsedGroupId;
      tab.hidden = !visible;
      if (!visible || !this.getAvailability(id).available) tab.tabIndex = -1;
    }
    if (!configured || !this.browsedGroupId) return;

    const availableIds = this.childIdsForGroup(this.browsedGroupId, { availableOnly: true });
    const activeInGroup = availableIds.includes(this.activePaneId) ? this.activePaneId : null;
    const remembered = this.childFocusByGroup.get(this.browsedGroupId);
    const rovingId = availableIds.includes(remembered)
      ? remembered
      : (activeInGroup ?? availableIds[0]);
    for (const id of availableIds) this.tabs.get(id).tabIndex = id === rovingId ? 0 : -1;
    if (rovingId) this.childFocusByGroup.set(this.browsedGroupId, rovingId);
  }

  focusFirstAvailableChild(groupId) {
    const availableIds = this.childIdsForGroup(groupId, { availableOnly: true });
    const activeInGroup = availableIds.includes(this.activePaneId) ? this.activePaneId : null;
    const destinationId = activeInGroup ?? availableIds[0];
    if (!destinationId) return false;
    this.setChildRovingFocus(groupId, destinationId);
    this.tabs.get(destinationId)?.focus({ preventScroll: true });
    return true;
  }

  setChildRovingFocus(groupId, paneId) {
    const availableIds = this.childIdsForGroup(groupId, { availableOnly: true });
    if (!availableIds.includes(paneId)) return false;
    this.childFocusByGroup.set(groupId, paneId);
    for (const id of availableIds) this.tabs.get(id).tabIndex = id === paneId ? 0 : -1;
    return true;
  }

  /**
   * Opens a specific pane. Returns true only when theater state, active pane, or grouped navigation
   * state changed.
   */
  open(paneId, options = {}) {
    const normalizedId = String(paneId);
    if (!this.panes.has(normalizedId) || !this.stage || !this.backdrop) return false;
    if (!this.getAvailability(normalizedId).available) return false;

    const descriptor = this.destinationDescriptors.get(normalizedId);
    const groupedDestination = this.groupButtons.has(descriptor?.group);
    const hasExplicitReturnFocus =
      options && Object.prototype.hasOwnProperty.call(options, "returnFocus");
    if (this.openState && this.activePaneId === normalizedId) {
      if (hasExplicitReturnFocus) this.setReturnFocus(options.returnFocus);
      return groupedDestination ? this.browseGroup(descriptor.group) : false;
    }

    this.onBeforeOpen?.(normalizedId);
    this.clearSectionNavigation();

    const wasOpen = this.openState;
    const pane = this.panes.get(normalizedId);
    const previousPane = this.panes.get(this.activePaneId);
    const moveFocusWithPane = Boolean(
      wasOpen && previousPane?.element.contains(document.activeElement)
    );
    const focusOutsideDialog = Boolean(
      wasOpen && this.shell && !this.shell.contains(document.activeElement)
    );
    if (!wasOpen && !this.previouslyFocusedElement) {
      this.captureFocus(hasExplicitReturnFocus ? options.returnFocus : null);
    } else if (hasExplicitReturnFocus) {
      this.setReturnFocus(options.returnFocus);
    }
    this.cancelPendingVisibilityChanges();

    if (this.activePaneId && this.activePaneId !== normalizedId) {
      const current = this.panes.get(this.activePaneId);
      if (current && this.warehouse) this.warehouse.appendChild(current.element);
    }

    this.stage.appendChild(pane.element);
    this.activePaneId = normalizedId;
    this.openState = true;
    if (groupedDestination) {
      this.childFocusByGroup.set(descriptor.group, normalizedId);
      this.browseGroup(descriptor.group, { force: true });
    }
    this.updateActiveNavigation();
    this.updateDialogTitle(pane.title);

    this.backdrop.classList.remove("hidden");
    this.backdrop.setAttribute("aria-hidden", "false");
    this.visibilityFrame = requestFrame(() => {
      this.visibilityFrame = null;
      if (!this.openState) return;
      this.backdrop.classList.add("visible");
      const activeTab = this.tabs.get(normalizedId);
      if (activeTab && !activeTab.hidden) {
        activeTab.scrollIntoView({
          behavior: navigationScrollBehavior(),
          block: "nearest",
          inline: "center"
        });
      }
      this.checkScrollArrows();
      if (!wasOpen || moveFocusWithPane || focusOutsideDialog) this.focusActivePane();
    });

    if (typeof pane.onShow === "function") pane.onShow();
    return true;
  }

  /**
   * Starts closing the theater. isOpen() becomes false and launcher focus is restored immediately;
   * the existing opacity transition completes before the backdrop is removed from layout.
   */
  close() {
    if (!this.openState || !this.backdrop) return false;

    this.openState = false;
    this.clearSectionNavigation();
    cancelFrame(this.visibilityFrame);
    this.visibilityFrame = null;
    clearTimeout(this.closeTimer);
    this.backdrop.classList.remove("visible");
    this.restoreFocus();
    this.backdrop.setAttribute("aria-hidden", "true");
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      if (this.openState) return;
      this.backdrop.classList.add("hidden");
    }, 200);
    return true;
  }

  isOpen(paneId = null) {
    if (!this.openState) return false;
    return paneId === null ? true : this.activePaneId === String(paneId);
  }

  getActivePaneId() {
    return this.openState ? this.activePaneId : null;
  }

  openAndScrollTo(paneId, elementId, options = {}) {
    this.open(paneId, options);
    this.clearSectionNavigation();
    this.sectionNavigationTimer = setTimeout(() => {
      this.sectionNavigationTimer = null;
      if (!this.isOpen(paneId)) return;
      const target = document.getElementById(elementId);
      if (target && this.panes.get(paneId)?.element.contains(target)) {
        const container = options.scrollContainer;
        if (container?.contains(target)) {
          container.scrollTo({
            top:
              container.scrollTop +
              target.getBoundingClientRect().top -
              container.getBoundingClientRect().top -
              container.clientTop,
            behavior: navigationScrollBehavior()
          });
        } else target.scrollIntoView({ behavior: navigationScrollBehavior(), block: "start" });
        if (options.focusTarget) {
          target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
        target.classList.add("target-highlight");
        this.sectionHighlightTarget = target;
        this.sectionHighlightTimer = setTimeout(() => {
          target.classList.remove("target-highlight");
          this.sectionHighlightTarget = null;
          this.sectionHighlightTimer = null;
        }, 2000);
      }
    }, 300);
  }

  clearSectionNavigation() {
    clearTimeout(this.sectionNavigationTimer);
    clearTimeout(this.sectionHighlightTimer);
    this.sectionHighlightTarget?.classList.remove("target-highlight");
    this.sectionNavigationTimer = null;
    this.sectionHighlightTimer = null;
    this.sectionHighlightTarget = null;
  }

  captureFocus(returnFocus = null) {
    const activeElement = document.activeElement;
    this.previouslyFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
    this.setReturnFocus(returnFocus);
  }

  setReturnFocus(returnFocus) {
    this.returnFocusResolver =
      typeof returnFocus === "function" ? returnFocus : returnFocus ? () => returnFocus : null;
  }

  focusActivePane() {
    if (!this.shell) return;
    const pane = this.panes.get(this.activePaneId);
    const autofocusTarget = [...(pane?.element.querySelectorAll("[autofocus]") ?? [])].find(
      isFocusable
    );
    const firstPaneControl = [...(pane?.element.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])].find(
      isFocusable
    );
    const target = autofocusTarget || firstPaneControl || this.shell;
    target.focus({ preventScroll: true });
  }

  restoreFocus() {
    let resolvedTarget = null;
    try {
      resolvedTarget = this.returnFocusResolver?.() ?? null;
    } catch (error) {
      console.warn("WindowManager: Could not resolve theater return focus.", error);
    }
    const hasResolvedTarget = Boolean(
      resolvedTarget?.isConnected && typeof resolvedTarget.focus === "function"
    );
    const target = hasResolvedTarget ? resolvedTarget : this.previouslyFocusedElement;
    this.previouslyFocusedElement = null;
    this.returnFocusResolver = null;
    if (!target?.isConnected || typeof target.focus !== "function") return;
    if (hasResolvedTarget) {
      target.focus({ preventScroll: true });
      return;
    }

    const current = document.activeElement;
    const focusBelongsToRegisteredPane = [...this.panes.values()].some((pane) =>
      pane.element.contains(current)
    );
    const focusStillBelongsToTheater =
      current === document.body ||
      current === this.backdrop ||
      this.shell?.contains(current) ||
      focusBelongsToRegisteredPane;
    if (focusStillBelongsToTheater) target.focus({ preventScroll: true });
  }

  /**
   * Public hook used by the manager's Tab listener and available to another keyboard coordinator.
   */
  trapFocus(event) {
    if (!this.openState || !this.shell || event.key !== "Tab") return false;

    const focusable = [...this.shell.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isFocusable);
    if (focusable.length === 0) {
      event.preventDefault();
      this.shell.focus({ preventScroll: true });
      return true;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !this.shell.contains(current))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return true;
    }
    if (!event.shiftKey && (current === last || !this.shell.contains(current))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  handleGroupClick(event) {
    const button = findDatasetOwner(event.target, this.groupContainer, "theaterGroup");
    if (!button) return false;
    return this.browseGroup(button.dataset.theaterGroup);
  }

  handleGroupKeydown(event) {
    if (!this.openState) return false;
    const button = findDatasetOwner(event.target, this.groupContainer, "theaterGroup");
    if (!button) return false;
    const groupId = button.dataset.theaterGroup;

    if (event.key === "ArrowDown") {
      if (!this.focusFirstAvailableChild(groupId)) return false;
      event.preventDefault();
      return true;
    }
    if (!HORIZONTAL_KEYS.has(event.key)) return false;

    const groupIds = this.navigationGroups.map(({ id }) => id);
    const currentIndex = Math.max(0, groupIds.indexOf(groupId));
    let destinationId;
    if (event.key === "Home") destinationId = groupIds[0];
    else if (event.key === "End") destinationId = groupIds.at(-1);
    else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      destinationId = groupIds[(currentIndex + direction + groupIds.length) % groupIds.length];
    }

    event.preventDefault();
    this.browseGroup(destinationId, { focusGroup: true });
    return true;
  }

  /**
   * Implements manual activation for the visible child-destination toolbar. Arrow keys move focus
   * without changing content; Enter or Space uses the ordinary availability-checked open path.
   */
  handleTabKeydown(event) {
    if (!this.openState) return false;
    const button = findDatasetOwner(event.target, this.tabContainer, "pane");
    if (!button || button.hidden) return false;
    const paneId = button.dataset.pane;
    const groupId = this.destinationDescriptors.get(paneId)?.group ?? button.dataset.theaterGroup;

    if (event.key === "ArrowUp") {
      const groupButton = this.groupButtons.get(groupId);
      if (!groupButton) return false;
      event.preventDefault();
      groupButton.focus({ preventScroll: true });
      return true;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (!this.getAvailability(paneId).available) return false;
      event.preventDefault();
      this.open(paneId);
      this.setChildRovingFocus(groupId, paneId);
      button.focus({ preventScroll: true });
      return true;
    }
    if (!HORIZONTAL_KEYS.has(event.key)) return false;

    const availableIds = this.childIdsForGroup(groupId, { availableOnly: true });
    if (availableIds.length === 0) return false;
    const currentIndex = Math.max(0, availableIds.indexOf(paneId));
    let destinationId;
    if (event.key === "Home") destinationId = availableIds[0];
    else if (event.key === "End") destinationId = availableIds.at(-1);
    else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      destinationId =
        availableIds[(currentIndex + direction + availableIds.length) % availableIds.length];
    }

    event.preventDefault();
    this.setChildRovingFocus(groupId, destinationId);
    this.tabs.get(destinationId)?.focus({ preventScroll: true });
    return true;
  }

  updateActiveNavigation() {
    for (const [id, tab] of this.tabs) {
      const active = this.openState && id === this.activePaneId;
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
      tab.removeAttribute("aria-selected");
    }
    this.syncChildVisibility();
    this.updateGroupPresentation();
  }

  updateGroupPresentation() {
    const activeDestination = this.openState
      ? this.destinationDescriptors.get(this.activePaneId)
      : null;
    for (const group of this.navigationGroups) {
      const button = this.groupButtons.get(group.id);
      if (!button) continue;
      const hasActive = Boolean(
        activeDestination &&
        activeDestination.id !== this.utilityDestinationId &&
        activeDestination.group === group.id
      );
      button.classList.toggle("has-active-pane", hasActive);
      button.dataset.hasActivePane = String(hasActive);
      const current = button.children?.[1];
      if (current) {
        current.textContent = hasActive ? `Current: ${activeDestination.label}` : "";
        current.hidden = !hasActive;
      }
      button.setAttribute(
        "aria-label",
        hasActive ? `${group.label}. Current theater: ${activeDestination.label}` : group.label
      );
    }
  }

  updateDialogTitle(title) {
    if (!this.shell) return;
    if (this.currentTitle) {
      this.currentTitle.textContent = title;
      this.shell.setAttribute("aria-labelledby", this.currentTitle.id);
      this.shell.removeAttribute("aria-label");
      return;
    }
    this.shell.removeAttribute("aria-labelledby");
    this.shell.setAttribute("aria-label", title);
  }

  cancelPendingVisibilityChanges() {
    cancelFrame(this.visibilityFrame);
    this.visibilityFrame = null;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  /**
   * Updates the visibility of the left/right scroll arrows based on the child-row scroll position.
   */
  checkScrollArrows() {
    if (!this.tabContainer || !this.scrollLeftBtn || !this.scrollRightBtn) return;

    const { scrollLeft, scrollWidth, clientWidth } = this.tabContainer;
    const isAtStart = scrollLeft <= 1;
    const isAtEnd = Math.abs(scrollWidth - clientWidth - scrollLeft) <= 1;
    const isOverflowing = scrollWidth > clientWidth;

    if (!isOverflowing) {
      this.scrollLeftBtn.classList.add("hidden");
      this.scrollRightBtn.classList.add("hidden");
      return;
    }

    this.scrollLeftBtn.classList.toggle("hidden", isAtStart);
    this.scrollRightBtn.classList.toggle("hidden", isAtEnd);
  }
}
