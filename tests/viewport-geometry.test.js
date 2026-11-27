import assert from "node:assert/strict";
import test from "node:test";
import { createViewportGeometryScheduler } from "../modules/viewport/geometry-scheduler.js";
import { createLocationReportingController } from "../modules/viewport/location-reporting.js";

function clock() {
  const frames = new Map();
  let id = 0;
  return {
    request: (fn) => {
      frames.set(++id, fn);
      return id;
    },
    cancel: (key) => frames.delete(key),
    drain() {
      let count = 0;
      while (frames.size) {
        assert.ok(++count < 10, "geometry work must settle without a frame loop");
        const batch = [...frames.values()];
        frames.clear();
        batch.forEach((fn) => fn());
      }
    },
    get pending() {
      return frames.size;
    }
  };
}

test("one geometry frame orders viewport before widget and absorbs report invalidation", () => {
  const raf = clock(),
    calls = [];
  const scheduler = createViewportGeometryScheduler({
    requestFrame: raf.request,
    positionViewport() {
      calls.push("viewport");
      scheduler.requestWidget();
    },
    positionWidget() {
      calls.push("widget");
    }
  });
  scheduler.requestWidget();
  scheduler.requestViewport();
  scheduler.requestViewport();
  raf.drain();
  assert.deepEqual(calls, ["viewport", "widget"]);
  calls.length = 0;
  scheduler.requestWidget();
  scheduler.requestWidget();
  raf.drain();
  assert.deepEqual(calls, ["widget"], "passive fitting cannot refit its upstream surfaces");
  assert.equal(raf.pending, 0);
});

const rect = (left = 0, top = 0, width = 290, height = 200) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON() {
    return { left, top, right: this.right, bottom: this.bottom, width, height };
  }
});

function reportingFixture(t, { widgetOpen = true, placement = "anchored", held = true } = {}) {
  const raf = clock(),
    events = new Map();
  const counts = { viewport: 0, widget: 0, popup: 0, bounds: 0, cap: 0, reports: 0 };
  class Node {
    constructor() {
      this.children = [];
      this.hidden = false;
      this.isConnected = true;
      this.dataset = {};
      this.style = {
        removeProperty(key) {
          delete this[key];
        }
      };
      this.scrollTop = 0;
      this.scrollHeight = 600;
      this.open = false;
    }
    setAttribute() {}
    addEventListener() {}
    focus() {}
    closest() {
      return null;
    }
    append(...items) {
      for (const item of items) {
        if (item.parentElement)
          item.parentElement.children = item.parentElement.children.filter((n) => n !== item);
        item.parentElement = this;
        this.children.push(item);
      }
    }
    replaceChildren(...items) {
      this.children = [];
      this.append(...items);
    }
    contains(other) {
      return other === this || this.children.some((n) => n.contains(other));
    }
    getBoundingClientRect() {
      return rect();
    }
  }
  const globals = {
    Element: Node,
    document: { createElement: () => new Node(), addEventListener() {}, activeElement: null },
    window: { addEventListener() {} },
    requestAnimationFrame: raf.request,
    cancelAnimationFrame: raf.cancel
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]
    );
  }
  const workspace = new Node(),
    mapNode = new Node(),
    content = new Node(),
    slot = new Node(),
    popupNode = new Node();
  content.append(slot);
  workspace.getBoundingClientRect = () => rect(0, 0, 1600, 1000);
  let pan = 0,
    opened = false,
    controller,
    lastBounds;
  const map = {
    getContainer: () => mapNode,
    on(names, fn) {
      for (const name of names.split(" ")) {
        if (!events.has(name)) events.set(name, []);
        events.get(name).push(fn);
      }
    }
  };
  const emit = (name, data = {}) => (events.get(name) ?? []).forEach((fn) => fn(data));
  const popup = {
    options: { offset: [0, 7], autoPan: true },
    isOpen: () => opened,
    getElement: () => popupNode,
    on() {},
    setContent() {},
    openOn() {
      opened = true;
    },
    remove() {
      opened = false;
    },
    update() {
      counts.popup++;
    }
  };
  popupNode.getBoundingClientRect = () => {
    counts.bounds++;
    return rect(600 + pan + popup.options.offset[0], 350 + popup.options.offset[1], 290, 320);
  };
  const state = {
    pointProbeSubject: "political",
    tooltipSubject: "political",
    politicalProbeExpanded: true,
    politicalTooltipMode: "hidden",
    pointProbePlacement: placement,
    focusMap: false
  };
  const scheduler = createViewportGeometryScheduler({
    requestFrame: raf.request,
    positionViewport() {
      counts.viewport++;
      controller.position();
    },
    positionWidget() {
      if (widgetOpen) {
        counts.widget++;
        lastBounds = controller.getVisibleBounds();
      }
    }
  });
  const report = { geometryKey: "test" };
  controller = createLocationReportingController({
    map,
    workspace,
    session: { getSnapshot: () => state },
    subjects: {
      political: {
        label: "Political",
        getState: () => ({ enabled: true, available: true }),
        getReportAtPoint: () => {
          counts.reports++;
          return report;
        },
        render: () => new Node()
      }
    },
    toPoint: (p) => p,
    getBounds: () => rect(0, 0, 1600, 1000),
    getProbeHeightCap: () => {
      counts.cap++;
      return 320;
    },
    isSuppressed: () => false,
    onGeometryChange: scheduler.requestViewport,
    onVisibleBoundsChange: () => {
      if (widgetOpen) scheduler.requestWidget();
    }
  });
  if (held) {
    controller.attachProbe(popup, { x: 1, z: 2 }, slot, { content });
    controller.presentProbe();
  }
  raf.drain();
  const body = held ? slot.children[0].children[1] : null;
  if (body) body.scrollTop = 123;
  for (const key of Object.keys(counts)) counts[key] = 0;
  return {
    counts,
    raf,
    controller,
    scheduler,
    body,
    slot,
    popup,
    emit,
    bounds: () => lastBounds,
    move() {
      pan += 3;
      emit("move");
      emit("zoom"); // Both notifications in one frame must still sample once.
      emit("mousemove", {
        originalEvent: { target: mapNode, clientX: 800, clientY: 700, pointerType: "mouse" },
        latlng: { x: 1, z: 2 }
      });
      raf.drain();
    }
  };
}

for (const widgetOpen of [false, true]) {
  for (const placement of ["anchored", "bottomCenter"]) {
    test(`panning with ${placement} probe, widget ${widgetOpen ? "open" : "closed"}, never refits the popup`, (t) => {
      const f = reportingFixture(t, { widgetOpen, placement });
      f.emit("movestart");
      for (let i = 0; i < 30; i++) f.move();
      assert.equal(f.counts.viewport, 0);
      assert.equal(f.counts.popup, 0, "the former 90 popup updates are eliminated");
      assert.equal(f.counts.cap, 0, "no hidden Scanner measurement during movement");
      assert.equal(f.counts.reports, 0, "movement never reads report evidence");
      const samples = widgetOpen && placement === "anchored" ? 30 : 0;
      assert.equal(f.counts.widget, samples);
      assert.equal(
        f.counts.bounds,
        samples,
        "bounds are read once per frame, only by a visible consumer"
      );
      const count = f.counts.widget;
      for (let i = 0; i < 30; i++) f.controller.hideHover(true);
      f.raf.drain();
      assert.equal(
        f.counts.widget,
        count,
        "repeated hidden-tooltip suppression does not invalidate probe bounds"
      );
      f.emit("moveend");
      f.emit("zoomend");
      f.raf.drain();
      assert.equal(f.counts.viewport, 1, "settling events share a final geometry pass");
      assert.equal(f.counts.popup, placement === "anchored" ? 3 : 0);
      assert.equal(f.counts.cap, 1);
      assert.equal(f.slot.children[0].children[1], f.body);
      assert.equal(f.body.scrollTop, 123);
      assert.equal(f.popup.options.autoPan, true);
      assert.equal(f.raf.pending, 0);
      f.controller.dismissProbe();
      f.raf.drain();
      if (widgetOpen) assert.deepEqual(f.bounds(), [], "closing a probe releases its obstruction");
    });
  }
}

test("a structural layout request during a drag preserves Leaflet's floating probe transport", (t) => {
  const f = reportingFixture(t);
  f.emit("movestart");
  f.scheduler.requestViewport();
  f.raf.drain();
  assert.equal(f.counts.popup, 0);
  assert.equal(f.counts.cap, 0);
  f.emit("moveend");
  f.raf.drain();
  assert.equal(f.counts.popup, 3);
});

test("widget-only and neither-surface pans do not schedule report geometry", (t) => {
  const f = reportingFixture(t, { held: false });
  f.emit("movestart");
  for (let i = 0; i < 30; i++) f.move();
  assert.deepEqual(f.counts, { viewport: 0, widget: 0, popup: 0, bounds: 0, cap: 0, reports: 0 });
  assert.equal(f.raf.pending, 0);
});
