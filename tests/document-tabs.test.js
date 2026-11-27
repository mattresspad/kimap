import assert from "node:assert/strict";
import test from "node:test";

import { createDocumentTabController, nextDocumentTabIndex } from "../modules/document-tabs.js";

function createTab(id, panelId, selected) {
  const attributes = new Map([
    ["aria-controls", panelId],
    ["aria-selected", String(selected)]
  ]);

  return {
    dataset: { documentTab: id },
    focusCount: 0,
    tabIndex: selected ? 0 : -1,
    closest(selector) {
      return selector === '[role="tab"][data-document-tab]' ? this : null;
    },
    focus() {
      this.focusCount += 1;
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
}

function createHarness(name) {
  const savePanel = { id: `${name}-save-panel`, hidden: false };
  const loadPanel = { id: `${name}-load-panel`, hidden: true };
  const saveTab = createTab("save", savePanel.id, true);
  const loadTab = createTab("load", loadPanel.id, false);
  const tabs = [saveTab, loadTab];
  const panels = new Map([
    [savePanel.id, savePanel],
    [loadPanel.id, loadPanel]
  ]);
  const listeners = new Map();
  const root = {
    dataset: {},
    hidden: false,
    ownerDocument: {
      getElementById(id) {
        return panels.get(id) ?? null;
      }
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    contains(element) {
      return tabs.includes(element) || [...panels.values()].includes(element);
    },
    querySelectorAll(selector) {
      return selector === '[role="tab"][data-document-tab]' ? tabs : [];
    }
  };

  return {
    root,
    saveTab,
    loadTab,
    savePanel,
    loadPanel,
    controller: createDocumentTabController(root),
    click(tab) {
      listeners.get("click")?.({ target: tab });
    },
    keydown(tab, key) {
      let prevented = false;
      listeners.get("keydown")?.({
        target: tab,
        key,
        preventDefault() {
          prevented = true;
        }
      });
      return prevented;
    },
    hasListener(type) {
      return listeners.has(type);
    }
  };
}

test("document managers default to Save and retain independent presentation state", () => {
  const paint = createHarness("paint");
  const markers = createHarness("markers");

  assert.equal(paint.controller.getActiveTabId(), "save");
  assert.equal(paint.root.dataset.activeDocumentTab, "save");
  assert.equal(paint.saveTab.getAttribute("aria-selected"), "true");
  assert.equal(paint.saveTab.tabIndex, 0);
  assert.equal(paint.savePanel.hidden, false);
  assert.equal(paint.loadPanel.hidden, true);

  paint.click(paint.loadTab);
  paint.root.hidden = true;
  paint.root.hidden = false;

  assert.equal(paint.controller.getActiveTabId(), "load", "pane reopening retains Paint state");
  assert.equal(markers.controller.getActiveTabId(), "save", "Marker state remains independent");
  assert.equal(paint.savePanel.hidden, true);
  assert.equal(paint.loadPanel.hidden, false);
});

test("document tab arrow, Home, and End keys automatically activate roving focus", () => {
  const manager = createHarness("paint");

  assert.equal(manager.keydown(manager.saveTab, "ArrowRight"), true);
  assert.equal(manager.controller.getActiveTabId(), "load");
  assert.equal(manager.loadTab.focusCount, 1);
  assert.equal(manager.loadTab.tabIndex, 0);
  assert.equal(manager.saveTab.tabIndex, -1);
  assert.equal(manager.loadTab.getAttribute("aria-selected"), "true");

  assert.equal(manager.keydown(manager.loadTab, "ArrowRight"), true);
  assert.equal(manager.controller.getActiveTabId(), "save", "ArrowRight wraps");
  assert.equal(manager.keydown(manager.saveTab, "ArrowLeft"), true);
  assert.equal(manager.controller.getActiveTabId(), "load", "ArrowLeft wraps");
  assert.equal(manager.keydown(manager.loadTab, "Home"), true);
  assert.equal(manager.controller.getActiveTabId(), "save");
  assert.equal(manager.keydown(manager.saveTab, "End"), true);
  assert.equal(manager.controller.getActiveTabId(), "load");
  assert.equal(manager.keydown(manager.loadTab, "Enter"), false);
});

test("document tab navigation validates indices and controller cleanup is idempotent", () => {
  assert.equal(nextDocumentTabIndex(0, 2, "ArrowLeft"), 1);
  assert.equal(nextDocumentTabIndex(1, 2, "ArrowRight"), 0);
  assert.throws(() => nextDocumentTabIndex(-1, 2, "Home"), RangeError);

  const manager = createHarness("markers");
  assert.equal(manager.controller.destroy(), true);
  assert.equal(manager.controller.destroy(), false);
  assert.equal(manager.hasListener("click"), false);
  assert.equal(manager.hasListener("keydown"), false);
});
