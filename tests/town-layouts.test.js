import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTownLayoutViewport,
  createTownLayoutController
} from "../modules/town-layouts.js";

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
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
  constructor(ownerDocument = null, classes = []) {
    this.ownerDocument = ownerDocument;
    this.classList = new FakeClassList(...classes);
    this.clientWidth = 800;
    this.clientHeight = 600;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = "";
    this.className = "";
  }

  replaceChildren(...children) {
    this.children = children;
    if (children.length === 0) this.textContent = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ target: this });
  }
}

class FakeResizeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    this.disconnected = false;
    FakeResizeObserver.instances.push(this);
  }

  observe(target) {
    this.observed.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  emit(target, width, height) {
    this.callback([{ target, contentRect: { width, height } }]);
  }
}

function createElements() {
  const ownerDocument = {
    activeElement: null,
    createElement: () => new FakeElement(ownerDocument)
  };
  return {
    ownerDocument,
    backdrop: new FakeElement(ownerDocument, ["hidden"]),
    title: new FakeElement(ownerDocument),
    vizContainer: new FakeElement(ownerDocument),
    loader: new FakeElement(ownerDocument, ["hidden"]),
    resetButton: new FakeElement(ownerDocument)
  };
}

function createFrameHarness() {
  const frames = new Map();
  let nextFrame = 1;
  return {
    frames,
    requestFrame(callback) {
      const frameId = nextFrame++;
      frames.set(frameId, callback);
      return frameId;
    },
    cancelFrame(frameId) {
      frames.delete(frameId);
    },
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback();
    }
  };
}

test("town layout viewport preserves uniform scale across aspect ratios", () => {
  assert.deepEqual(calculateTownLayoutViewport(800, 400, 4000), {
    width: 800,
    height: 400,
    aspect: 2,
    visibleRadiusX: 8000,
    visibleRadiusZ: 4000
  });
  assert.deepEqual(calculateTownLayoutViewport(400, 800, 4000), {
    width: 400,
    height: 800,
    aspect: 0.5,
    visibleRadiusX: 4000,
    visibleRadiusZ: 8000
  });
  assert.throws(() => calculateTownLayoutViewport(0, 600), TypeError);
  assert.throws(() => calculateTownLayoutViewport(800, Number.NaN), TypeError);
  assert.throws(() => calculateTownLayoutViewport(800, 600, -1), TypeError);
});

test("town layout controller owns one observer, coalesces rerenders, and restores focus", async () => {
  FakeResizeObserver.instances.length = 0;
  const elements = createElements();
  const frames = createFrameHarness();
  const renders = [];
  let resets = 0;
  let fetches = 0;
  let focuses = 0;
  const launcher = { focus: () => (focuses += 1) };
  const buildings = [
    { X: 100, Z: 200, BuildingDefId: "house", BuildingName: "Unknown House" },
    { X: 110, Z: 210, BuildingDefId: "wall", BuildingName: "Wall" },
    { X: 9000, Z: 9000, BuildingDefId: "house", BuildingName: "Far House" }
  ];

  const controller = createTownLayoutController({
    ...elements,
    fetchImpl: async () => {
      fetches += 1;
      return { ok: true, json: async () => buildings };
    },
    ResizeObserverClass: FakeResizeObserver,
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    renderLayoutImpl: (_container, centerX, centerZ, localBuildings, radius, viewport) => {
      renders.push({ centerX, centerZ, localBuildings, radius, viewport });
      return () => (resets += 1);
    }
  });

  assert.equal(FakeResizeObserver.instances.length, 1);
  assert.deepEqual(FakeResizeObserver.instances[0].observed, [elements.vizContainer]);
  assert.equal(
    await controller.open({ Name: "Stack", Values: { X: 100, Z: 200 } }, "/buildings.json", {
      launcher
    }),
    true
  );
  assert.equal(controller.isOpen(), true);
  assert.equal(fetches, 1);
  assert.equal(elements.backdrop.classList.contains("hidden"), false);
  assert.equal(elements.loader.classList.contains("hidden"), true);
  assert.equal(elements.title.textContent, "Layout: Stack");
  assert.equal(renders.length, 1);
  assert.equal(renders[0].localBuildings.length, 1);
  assert.equal(renders[0].viewport.width, 800);

  FakeResizeObserver.instances[0].emit(elements.vizContainer, 900, 600);
  FakeResizeObserver.instances[0].emit(elements.vizContainer, 1000, 600);
  assert.equal(frames.frames.size, 1);
  frames.flush();
  assert.equal(renders.length, 2);
  assert.equal(renders[1].viewport.width, 1000);

  elements.resetButton.dispatch("click");
  assert.equal(resets, 1);
  assert.equal(controller.close(), true);
  assert.equal(controller.close(), false);
  assert.equal(controller.isOpen(), false);
  assert.equal(elements.backdrop.classList.contains("hidden"), true);
  assert.equal(focuses, 1);

  await controller.open({ Name: "Stack", Values: { X: 100, Z: 200 } }, "/buildings.json");
  assert.equal(fetches, 1);
  controller.close();
  assert.equal(controller.disconnect(), true);
  assert.equal(controller.disconnect(), false);
  assert.equal(FakeResizeObserver.instances[0].disconnected, true);
});

test("town layout loading failures clean up busy state without stale rendering", async () => {
  FakeResizeObserver.instances.length = 0;
  const elements = createElements();
  const frames = createFrameHarness();
  const failures = [];
  let renderCount = 0;
  const controller = createTownLayoutController({
    ...elements,
    fetchImpl: async () => {
      throw new Error("offline");
    },
    ResizeObserverClass: FakeResizeObserver,
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    renderLayoutImpl: () => {
      renderCount += 1;
    },
    onError: (error) => failures.push(error.message)
  });

  assert.equal(
    await controller.open({ Name: "Stack", Values: { X: 100, Z: 200 } }, "/missing.json"),
    false
  );
  assert.equal(controller.isOpen(), true);
  assert.equal(elements.loader.classList.contains("hidden"), true);
  assert.equal(elements.vizContainer.children.length, 1);
  assert.equal(
    elements.vizContainer.children[0].textContent,
    "Town layout data could not be displayed."
  );
  assert.deepEqual(failures, ["offline"]);
  assert.equal(renderCount, 0);
  assert.equal(controller.close(), true);
});

test("closing during loading prevents stale content from reopening the viewer", async () => {
  FakeResizeObserver.instances.length = 0;
  const elements = createElements();
  const frames = createFrameHarness();
  let resolveFetch;
  let renderCount = 0;
  let focusCount = 0;
  const controller = createTownLayoutController({
    ...elements,
    fetchImpl: () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    ResizeObserverClass: FakeResizeObserver,
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    renderLayoutImpl: () => {
      renderCount += 1;
    }
  });

  const opening = controller.open({ Name: "Stack", Values: { X: 100, Z: 200 } }, "/slow.json", {
    launcher: { focus: () => (focusCount += 1) }
  });
  assert.equal(elements.loader.classList.contains("hidden"), false);
  assert.equal(controller.close(), true);
  assert.equal(elements.loader.classList.contains("hidden"), true);
  assert.equal(focusCount, 1);

  resolveFetch({ ok: true, json: async () => [] });
  assert.equal(await opening, false);
  assert.equal(controller.isOpen(), false);
  assert.equal(renderCount, 0);
  assert.equal(elements.vizContainer.children.length, 0);
});
