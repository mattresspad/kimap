import assert from "node:assert/strict";
import test from "node:test";

import { WindowManager } from "../modules/window-manager.js";
import { THEATER_DESTINATION_GROUPS, THEATER_DESTINATIONS } from "../modules/top-bar/index.js";

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(...names) {
    for (const name of names) this.names.add(name);
  }

  remove(...names) {
    for (const name of names) this.names.delete(name);
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.names.has(name) : Boolean(force);
    if (enabled) this.names.add(name);
    else this.names.delete(name);
    return enabled;
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(ownerDocument, tagName = "div", classes = []) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.classList = new FakeClassList(...classes);
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.id = "";
    this.className = "";
    this.textContent = "";
    this.disabled = false;
    this.hidden = false;
    this.tabIndex = 0;
    this.isConnected = true;
    this.clientWidth = 400;
    this.scrollWidth = 400;
    this.scrollLeft = 0;
    this.focusCount = 0;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  dispatch(type, init = {}) {
    const event = {
      target: this,
      currentTarget: this,
      key: "",
      shiftKey: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...init
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.children = child.parentElement.children.filter(
        (entry) => entry !== child
      );
    }
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...children);
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  querySelectorAll(selector) {
    const descendants = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (
          (selector === "[autofocus]" && child.getAttribute("autofocus") !== null) ||
          (selector !== "[autofocus]" && child.isKeyboardFocusable())
        ) {
          descendants.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return descendants;
  }

  isKeyboardFocusable() {
    if (this.disabled || this.getAttribute("aria-hidden") === "true") return false;
    return ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(this.tagName);
  }

  getClientRects() {
    return this.isConnected && !this.hidden ? [{}] : [];
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.focusCount += 1;
  }

  scrollIntoView() {}

  scrollBy({ left }) {
    this.scrollLeft += left;
  }

  scrollTo({ left }) {
    this.scrollLeft = left;
  }
}

function createHarness(t, managerOptions = {}) {
  const elements = new Map();
  const documentListeners = new Map();
  const frames = new Map();
  let nextFrameId = 1;
  const fakeDocument = {
    activeElement: null,
    body: null,
    getElementById(id) {
      return elements.get(id) ?? null;
    },
    createElement(tagName) {
      return new FakeElement(fakeDocument, tagName);
    },
    createElementNS(_namespace, tagName) {
      return new FakeElement(fakeDocument, tagName);
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(listener);
    }
  };

  const create = (id, tagName = "div", classes = []) => {
    const element = new FakeElement(fakeDocument, tagName, classes);
    element.id = id;
    elements.set(id, element);
    return element;
  };

  fakeDocument.body = create("body", "body");
  const backdrop = create("unified-backdrop", "div", ["hidden"]);
  const shell = create("unified-shell");
  const groupContainer = create("unified-groups", "nav");
  const tabContainer = create("unified-tabs");
  const utilityButton = create("unified-help-btn", "button");
  const currentTitle = create("unified-current-title", "h2");
  const stage = create("unified-stage");
  const warehouse = create("pane-warehouse");
  const closeButton = create("unified-close-btn", "button");
  const scrollLeft = create("tabs-scroll-left", "button");
  const scrollRight = create("tabs-scroll-right", "button");
  fakeDocument.body.appendChild(backdrop);
  fakeDocument.body.appendChild(warehouse);
  backdrop.appendChild(shell);
  shell.appendChild(groupContainer);
  shell.appendChild(tabContainer);
  shell.appendChild(utilityButton);
  shell.appendChild(currentTitle);
  shell.appendChild(stage);
  shell.appendChild(closeButton);
  shell.appendChild(scrollLeft);
  shell.appendChild(scrollRight);

  const previousGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame
  };
  globalThis.document = fakeDocument;
  globalThis.window = { addEventListener() {} };
  globalThis.HTMLElement = FakeElement;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);

  t.after(() => {
    globalThis.document = previousGlobals.document;
    globalThis.window = previousGlobals.window;
    globalThis.HTMLElement = previousGlobals.HTMLElement;
    globalThis.requestAnimationFrame = previousGlobals.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previousGlobals.cancelAnimationFrame;
  });

  const manager = new WindowManager(managerOptions);
  return {
    manager,
    document: fakeDocument,
    elements,
    groupContainer,
    tabContainer,
    utilityButton,
    currentTitle,
    create,
    flushFrames() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback();
    }
  };
}

function configureRegistryNavigation(harness) {
  assert.equal(
    harness.manager.configureNavigation({
      groups: THEATER_DESTINATION_GROUPS,
      destinations: THEATER_DESTINATIONS,
      utilityDestinationId: "help"
    }),
    true
  );
}

test("the pre-open hook runs only for an available pane that will actually open", (t) => {
  const calls = [];
  const harness = createHarness(t, {
    onBeforeOpen(paneId) {
      calls.push(paneId);
    }
  });
  registerPane(harness, "status");
  registerPane(harness, "history");

  harness.manager.setAvailability("status", false, "Scenario unavailable.");
  assert.equal(harness.manager.open("status"), false);
  assert.deepEqual(calls, []);

  assert.equal(harness.manager.open("history"), true);
  assert.deepEqual(calls, ["history"]);
  assert.equal(harness.manager.open("history"), false);
  assert.deepEqual(calls, ["history"]);
});

test("section navigation scrolls only its article, focuses its target and returns to the launcher", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = createHarness(t);
  const { pane } = registerPane(h, "help");
  const article = h.create("help-article");
  const target = h.create("guide-political-view", "section");
  const launcher = h.create("world-views-btn", "button");
  pane.append(article);
  article.append(target);
  article.scrollTop = 37;
  article.clientTop = 1;
  article.getBoundingClientRect = () => ({ top: 100 });
  target.getBoundingClientRect = () => ({ top: 500 });
  const scrolls = [];
  article.scrollTo = (value) => scrolls.push(value);
  target.scrollIntoView = () => assert.fail("must not scroll outside the article");
  h.manager.openAndScrollTo("help", target.id, {
    scrollContainer: article,
    focusTarget: true,
    returnFocus: () => launcher
  });
  h.flushFrames();
  t.mock.timers.tick(300);
  assert.equal(scrolls[0].top, 436);
  assert.equal(h.document.activeElement, target);
  assert.equal(target.getAttribute("tabindex"), "-1");
  assert.equal(target.classList.contains("target-highlight"), true);
  h.manager.close();
  assert.equal(h.document.activeElement, launcher);
  assert.equal(target.classList.contains("target-highlight"), false);
});

test("closing or replacing pending Help navigation cancels stale scrolling and ignores outside targets", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = createHarness(t);
  const { pane } = registerPane(h, "help");
  const first = h.create("first-section");
  const next = h.create("next-section");
  const outside = h.create("map-target");
  pane.append(first, next);
  const scrolled = [];
  for (const element of [first, next, outside])
    element.scrollIntoView = () => scrolled.push(element.id);
  h.manager.openAndScrollTo("help", first.id);
  h.manager.openAndScrollTo("help", next.id);
  t.mock.timers.tick(300);
  assert.deepEqual(scrolled, [next.id]);
  h.manager.openAndScrollTo("help", outside.id);
  t.mock.timers.tick(300);
  assert.deepEqual(scrolled, [next.id]);
  h.manager.openAndScrollTo("help", first.id);
  h.manager.close();
  t.mock.timers.tick(300);
  assert.deepEqual(scrolled, [next.id]);
});

test("tab presentation can follow registry order independently of registration timing", (t) => {
  const harness = createHarness(t);
  configureRegistryNavigation(harness);
  assert.equal(harness.utilityButton.getAttribute("aria-controls"), null);
  registerPane(harness, "help");
  registerPane(harness, "environment");
  registerPane(harness, "history");
  registerPane(harness, "status");

  assert.deepEqual(
    harness.tabContainer.children.map((tab) => tab.dataset.pane),
    ["status", "history", "environment"]
  );
  assert.equal(harness.manager.setTabOrder(THEATER_DESTINATIONS.map(({ id }) => id)), false);
  assert.equal(harness.utilityButton.dataset.pane, "help");
  assert.equal(harness.utilityButton.getAttribute("aria-controls"), "pane-help");
  assert.equal(harness.utilityButton.parentElement, harness.elements.get("unified-shell"));
  assert.equal(harness.tabContainer.getAttribute("role"), "toolbar");
  assert.equal(harness.groupContainer.getAttribute("role"), "toolbar");
});

test("browsing a parent group does not replace the active pane and reports its location", (t) => {
  const harness = createHarness(t);
  configureRegistryNavigation(harness);
  registerPane(harness, "status");
  registerPane(harness, "history");
  registerPane(harness, "environment");
  registerPane(harness, "settings");
  registerPane(harness, "markers");
  registerPane(harness, "help");

  harness.document.activeElement = harness.document.body;
  assert.equal(harness.manager.open("status"), true);
  assert.equal(harness.manager.getBrowsedGroupId(), "simulation");
  assert.equal(harness.manager.browseGroup("reference"), true);
  assert.equal(harness.manager.getActivePaneId(), "status");
  assert.equal(harness.manager.getBrowsedGroupId(), "reference");
  assert.equal(harness.manager.tabs.get("status").hidden, true);
  assert.equal(harness.manager.tabs.get("environment").hidden, false);

  const simulationGroup = harness.manager.groupButtons.get("simulation");
  const referenceGroup = harness.manager.groupButtons.get("reference");
  assert.equal(simulationGroup.dataset.hasActivePane, "true");
  assert.equal(simulationGroup.children[1].textContent, "Current: Global Status");
  assert.equal(referenceGroup.getAttribute("aria-pressed"), "true");
  assert.equal(harness.currentTitle.textContent, "Global Status");
  assert.equal(harness.manager.tabs.get("status").getAttribute("aria-current"), "page");
  assert.equal(harness.manager.tabs.get("status").getAttribute("aria-selected"), null);

  assert.equal(harness.manager.open("environment"), true);
  assert.equal(harness.manager.getBrowsedGroupId(), "reference");
  assert.equal(referenceGroup.dataset.hasActivePane, "true");
  assert.equal(referenceGroup.children[1].textContent, "Current: Environment Info");
  assert.equal(harness.manager.tabs.get("environment").getAttribute("aria-current"), "page");
  assert.equal(harness.manager.tabs.get("environment").tabIndex, 0);
});

test("Help remains a fixed utility and preserves the last browsed group", (t) => {
  const harness = createHarness(t);
  configureRegistryNavigation(harness);
  registerPane(harness, "status");
  registerPane(harness, "markers");
  registerPane(harness, "help");

  harness.document.activeElement = harness.document.body;
  harness.manager.open("status");
  harness.manager.browseGroup("workspace");
  assert.equal(harness.manager.open("help"), true);
  assert.equal(harness.manager.getBrowsedGroupId(), "workspace");
  assert.equal(harness.manager.getActivePaneId(), "help");
  assert.equal(harness.utilityButton.getAttribute("aria-current"), "page");
  assert.equal(harness.currentTitle.textContent, "Help Guide");
  assert.equal(
    [...harness.manager.groupButtons.values()].some(
      (button) => button.dataset.hasActivePane === "true"
    ),
    false
  );
});

function registerPane(harness, id, onShow = null) {
  const pane = harness.create(`pane-${id}`);
  const control = harness.create(`control-${id}`, "button");
  pane.appendChild(control);
  harness.elements.get("pane-warehouse").appendChild(pane);
  assert.equal(harness.manager.register(id, id.toUpperCase(), pane, onShow), true);
  return { pane, control, tab: harness.manager.tabs.get(id) };
}

test("runtime availability disables tabs, exposes a reason, and guards opening", (t) => {
  const harness = createHarness(t);
  let shows = 0;
  assert.equal(
    harness.manager.setAvailability("status", false, "Simulation baseline is unavailable."),
    true
  );
  const { tab } = registerPane(harness, "status", () => (shows += 1));

  assert.deepEqual(harness.manager.getAvailability("status"), {
    available: false,
    reason: "Simulation baseline is unavailable."
  });
  assert.equal(Object.isFrozen(harness.manager.getAvailability("status")), true);
  assert.equal(tab.disabled, true);
  assert.equal(tab.getAttribute("aria-disabled"), "true");
  assert.equal(tab.getAttribute("title"), "Simulation baseline is unavailable.");
  assert.equal(tab.dataset.unavailableReason, "Simulation baseline is unavailable.");
  assert.equal(harness.manager.open("status"), false);
  assert.equal(harness.manager.isOpen(), false);
  assert.equal(shows, 0);

  assert.equal(harness.manager.setAvailability("status", true), true);
  assert.equal(harness.manager.setAvailability("status", true), false);
  assert.deepEqual(harness.manager.getAvailability("status"), { available: true, reason: "" });
  assert.equal(tab.disabled, false);
  assert.equal(tab.getAttribute("aria-disabled"), "false");
  assert.equal(tab.getAttribute("title"), null);
  assert.equal(tab.getAttribute("aria-label"), null);
  assert.equal("unavailableReason" in tab.dataset, false);
  assert.equal(harness.manager.open("status"), true);
  assert.equal(shows, 1);
});

test("focus-return resolvers follow the current layout and survive tab changes", (t) => {
  const harness = createHarness(t);
  registerPane(harness, "status");
  registerPane(harness, "history");
  const originalLauncher = harness.create("wide-launcher", "button");
  const narrowLauncher = harness.create("narrow-launcher", "button");
  harness.document.body.appendChild(originalLauncher);
  harness.document.body.appendChild(narrowLauncher);
  harness.document.activeElement = originalLauncher;
  let currentLauncher = originalLauncher;

  assert.equal(harness.manager.open("status", { returnFocus: () => currentLauncher }), true);
  harness.flushFrames();
  assert.equal(harness.manager.open("history"), true);
  currentLauncher = narrowLauncher;
  assert.equal(harness.manager.close(), true);
  assert.equal(narrowLauncher.focusCount, 1);
  assert.equal(originalLauncher.focusCount, 0);

  const legacyLauncher = harness.create("legacy-launcher", "button");
  harness.document.body.appendChild(legacyLauncher);
  harness.document.activeElement = legacyLauncher;
  assert.equal(harness.manager.open("status"), true);
  harness.flushFrames();
  assert.equal(harness.manager.close(), true);
  assert.equal(legacyLauncher.focusCount, 1);
});

test("explicit focus return remains reliable before the opening frame completes", (t) => {
  const harness = createHarness(t);
  registerPane(harness, "help");
  const hiddenMenuItem = harness.create("hidden-menu-item", "button");
  const visibleLauncher = harness.create("visible-launcher", "button");
  harness.document.body.appendChild(hiddenMenuItem);
  harness.document.body.appendChild(visibleLauncher);
  harness.document.activeElement = hiddenMenuItem;

  assert.equal(harness.manager.open("help", { returnFocus: () => visibleLauncher }), true);
  assert.equal(harness.manager.close(), true);
  assert.equal(visibleLauncher.focusCount, 1);
});

test("parent and child keys browse manually, wrap focus, and skip unavailable destinations", (t) => {
  const harness = createHarness(t);
  configureRegistryNavigation(harness);
  const status = registerPane(harness, "status");
  const history = registerPane(harness, "history");
  const ranks = registerPane(harness, "ranks");
  const infamy = registerPane(harness, "infamy");
  const environment = registerPane(harness, "environment");
  const settings = registerPane(harness, "settings");
  const browser = registerPane(harness, "browser");
  harness.manager.setAvailability("ranks", false, "Scenario unavailable.");
  harness.manager.setAvailability("environment", false, "Reference unavailable.");

  harness.document.activeElement = harness.document.body;
  assert.equal(harness.manager.open("history"), true);
  assert.equal(history.tab.tabIndex, 0);
  assert.equal(status.tab.tabIndex, -1);
  assert.equal(ranks.tab.disabled, true);

  const simulationGroup = harness.manager.groupButtons.get("simulation");
  const referenceGroup = harness.manager.groupButtons.get("reference");
  let event = harness.groupContainer.dispatch("keydown", {
    key: "ArrowRight",
    target: simulationGroup
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.manager.getBrowsedGroupId(), "reference");
  assert.equal(harness.manager.getActivePaneId(), "history");
  assert.equal(referenceGroup.focusCount, 1);

  event = harness.groupContainer.dispatch("keydown", {
    key: "ArrowDown",
    target: referenceGroup
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(settings.tab.focusCount, 1);
  assert.equal(environment.tab.focusCount, 0);

  event = harness.tabContainer.dispatch("keydown", {
    key: "ArrowRight",
    target: settings.tab
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(browser.tab.tabIndex, 0);
  harness.manager.browseGroup("simulation");
  harness.manager.browseGroup("reference");
  assert.equal(settings.tab.tabIndex, 0);
  assert.equal(browser.tab.tabIndex, -1);

  harness.manager.browseGroup("simulation");
  history.tab.focus();
  event = harness.tabContainer.dispatch("keydown", {
    key: "ArrowRight",
    target: history.tab
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.manager.getActivePaneId(), "history");
  assert.equal(infamy.tab.focusCount, 1);
  assert.equal(infamy.tab.tabIndex, 0);
  assert.equal(ranks.tab.focusCount, 0);

  event = harness.tabContainer.dispatch("keydown", { key: "Enter", target: infamy.tab });
  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.manager.getActivePaneId(), "infamy");
  assert.equal(infamy.tab.getAttribute("aria-current"), "page");

  event = harness.tabContainer.dispatch("keydown", { key: "Home", target: infamy.tab });
  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.manager.getActivePaneId(), "infamy");
  assert.equal(status.tab.focusCount, 1);
  assert.equal(status.tab.tabIndex, 0);

  event = harness.tabContainer.dispatch("keydown", { key: "ArrowUp", target: status.tab });
  assert.equal(event.defaultPrevented, true);
  assert.equal(simulationGroup.focusCount, 1);

  harness.tabContainer.scrollWidth = 900;
  harness.tabContainer.clientWidth = 300;
  harness.tabContainer.scrollLeft = 0;
  harness.manager.checkScrollArrows();
  assert.equal(harness.elements.get("tabs-scroll-left").classList.contains("hidden"), true);
  assert.equal(harness.elements.get("tabs-scroll-right").classList.contains("hidden"), false);
  harness.tabContainer.scrollLeft = 600;
  harness.manager.checkScrollArrows();
  assert.equal(harness.elements.get("tabs-scroll-left").classList.contains("hidden"), false);
  assert.equal(harness.elements.get("tabs-scroll-right").classList.contains("hidden"), true);

  assert.equal(harness.manager.setAvailability("infamy", false, "Scenario unavailable."), true);
  assert.equal(harness.manager.isOpen(), false);
});

test("opening an already active child restores its group without reopening the pane", (t) => {
  const calls = [];
  const harness = createHarness(t, { onBeforeOpen: (paneId) => calls.push(paneId) });
  configureRegistryNavigation(harness);
  registerPane(harness, "status");
  registerPane(harness, "environment");

  harness.document.activeElement = harness.document.body;
  assert.equal(harness.manager.open("status"), true);
  harness.manager.browseGroup("reference");
  assert.equal(harness.manager.open("status"), true);
  assert.equal(harness.manager.getBrowsedGroupId(), "simulation");
  assert.equal(harness.manager.getActivePaneId(), "status");
  assert.deepEqual(calls, ["status"]);
});

test("group End and Home move only the browsed parent", (t) => {
  const harness = createHarness(t);
  configureRegistryNavigation(harness);
  registerPane(harness, "status");
  registerPane(harness, "markers");

  harness.document.activeElement = harness.document.body;
  harness.manager.open("status");
  const simulationGroup = harness.manager.groupButtons.get("simulation");
  const workspaceGroup = harness.manager.groupButtons.get("workspace");

  harness.groupContainer.dispatch("keydown", { key: "End", target: simulationGroup });
  assert.equal(harness.manager.getBrowsedGroupId(), "workspace");
  assert.equal(harness.manager.getActivePaneId(), "status");
  assert.equal(workspaceGroup.focusCount, 1);

  harness.groupContainer.dispatch("keydown", { key: "Home", target: workspaceGroup });
  assert.equal(harness.manager.getBrowsedGroupId(), "simulation");
  assert.equal(harness.manager.getActivePaneId(), "status");
  assert.equal(simulationGroup.focusCount, 1);
});
