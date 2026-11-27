import assert from "node:assert/strict";
import test from "node:test";

import { WHEEL_ZOOM_DEFAULTS, createWheelZoomGovernor } from "../modules/viewport/wheel-zoom.js";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from "../modules/selection/map-space.js";

function createEventTarget() {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    }
  };
}

function createClock() {
  let currentTime = 0;
  let nextHandle = 1;
  const timers = new Map();

  const nextDueTimer = (limit) =>
    [...timers.entries()]
      .filter(([, timer]) => timer.due <= limit)
      .sort((left, right) => left[1].due - right[1].due || left[0] - right[0])[0] ?? null;

  return {
    now: () => currentTime,
    setTimer(callback, delay) {
      const handle = nextHandle;
      nextHandle += 1;
      timers.set(handle, { callback, due: currentTime + delay });
      return handle;
    },
    clearTimer(handle) {
      timers.delete(handle);
    },
    advance(milliseconds) {
      const target = currentTime + milliseconds;
      let entry = nextDueTimer(target);
      while (entry) {
        const [handle, timer] = entry;
        timers.delete(handle);
        currentTime = timer.due;
        timer.callback();
        entry = nextDueTimer(target);
      }
      currentTime = target;
    },
    pendingCount() {
      return timers.size;
    }
  };
}

function createMap({ zoom = -3, minZoom = MAP_MIN_ZOOM, maxZoom = MAP_MAX_ZOOM } = {}) {
  const listeners = new Map();
  const calls = [];

  return {
    calls,
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    off(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
    getZoom() {
      return zoom;
    },
    getMinZoom() {
      return minZoom;
    },
    getMaxZoom() {
      return maxZoom;
    },
    mouseEventToContainerPoint(event) {
      return Object.freeze({ x: event.x, y: event.y });
    },
    setZoomAround(anchor, nextZoom) {
      calls.push({ anchor, zoom: nextZoom });
      zoom = nextZoom;
    }
  };
}

function createWheelEvent(delta, x = 100, y = 200) {
  return {
    delta,
    x,
    y,
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    }
  };
}

function createHarness(mapOptions = {}) {
  const map = createMap(mapOptions);
  const element = createEventTarget();
  const focusTarget = createEventTarget();
  const clock = createClock();
  const governor = createWheelZoomGovernor({
    map,
    element,
    focusTarget,
    normalizeDelta: (event) => event.delta,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });
  return { map, element, focusTarget, clock, governor };
}

test("a conventional wheel notch produces one cursor-anchored zoom step", () => {
  const { map, element, clock, governor } = createHarness();
  assert.equal(governor.enable(), true);
  assert.equal(governor.enable(), false);

  const event = createWheelEvent(60, 17, 29);
  element.dispatch("wheel", event);

  assert.deepEqual(map.calls, [{ anchor: { x: 17, y: 29 }, zoom: -2 }]);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(governor.getSnapshot(), {
    enabled: true,
    destroyed: false,
    locked: true,
    direction: 0,
    accumulatedDelta: 0,
    acceptedStepCount: 1,
    discardedEventCount: 0,
    lastAcceptedAt: 0
  });
  assert.equal(Object.isFrozen(governor.getSnapshot()), true);

  map.emit("zoomend");
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs - 1);
  assert.equal(governor.getSnapshot().locked, true);
  clock.advance(1);
  assert.equal(governor.getSnapshot().locked, false);
});

test("precision deltas accumulate while a large burst remains one step", () => {
  const { map, element, clock, governor } = createHarness();
  governor.enable();

  element.dispatch("wheel", createWheelEvent(20));
  element.dispatch("wheel", createWheelEvent(20));
  assert.equal(map.calls.length, 0);
  assert.equal(governor.getSnapshot().accumulatedDelta, 40);
  element.dispatch("wheel", createWheelEvent(20));
  assert.equal(map.calls.length, 1);

  map.emit("zoomend");
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs);
  element.dispatch("wheel", createWheelEvent(600));
  element.dispatch("wheel", createWheelEvent(600));
  assert.equal(map.calls.length, 2);
  assert.equal(governor.getSnapshot().discardedEventCount, 1);

  map.emit("zoomend");
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs);
  assert.equal(map.calls.length, 2);
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);
});

test("sustained scrolling cannot outrun zoom completion and the minimum cadence", () => {
  const { map, element, clock, governor } = createHarness();
  governor.enable();

  element.dispatch("wheel", createWheelEvent(60));
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs);
  element.dispatch("wheel", createWheelEvent(60));
  assert.equal(map.calls.length, 1);

  map.emit("zoomend");
  assert.equal(governor.getSnapshot().locked, false);
  element.dispatch("wheel", createWheelEvent(60));
  assert.equal(map.calls.length, 2);

  map.emit("zoomend");
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs);
  assert.deepEqual(
    map.calls.map((call) => call.zoom),
    [-2, -1]
  );
});

test("direction reversal and inactivity clear partial wheel intent", () => {
  const { map, element, focusTarget, clock, governor } = createHarness({ zoom: 0 });
  governor.enable();

  element.dispatch("wheel", createWheelEvent(30));
  element.dispatch("wheel", createWheelEvent(-30));
  assert.equal(governor.getSnapshot().direction, -1);
  assert.equal(governor.getSnapshot().accumulatedDelta, 30);
  element.dispatch("wheel", createWheelEvent(-30));
  assert.deepEqual(
    map.calls.map((call) => call.zoom),
    [-1]
  );

  map.emit("zoomend");
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs);
  element.dispatch("wheel", createWheelEvent(30));
  clock.advance(WHEEL_ZOOM_DEFAULTS.inactivityResetMs);
  assert.equal(governor.getSnapshot().direction, 0);
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);

  element.dispatch("wheel", createWheelEvent(30));
  element.dispatch("pointerleave");
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);
  element.dispatch("wheel", createWheelEvent(-30));
  focusTarget.dispatch("blur");
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);
});

test("a non-wheel zoom completion clears stale partial wheel intent", () => {
  const { map, element, governor } = createHarness();
  governor.enable();

  element.dispatch("wheel", createWheelEvent(30));
  assert.equal(governor.getSnapshot().accumulatedDelta, 30);
  map.emit("zoomend");
  assert.equal(governor.getSnapshot().direction, 0);
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);
});

test("zoom bounds consume wheel intent without entering a lock", () => {
  for (const [mapOptions, delta] of [
    [{ zoom: 2 }, 60],
    [{ zoom: -4 }, -60]
  ]) {
    const { map, element, governor } = createHarness(mapOptions);
    governor.enable();
    const event = createWheelEvent(delta);
    element.dispatch("wheel", event);
    assert.equal(event.prevented, true);
    assert.equal(map.calls.length, 0);
    assert.equal(governor.getSnapshot().locked, false);
    assert.equal(governor.getSnapshot().accumulatedDelta, 0);
  }
});

test("the whole-map overview is one outward step and never queues input beyond its limit", () => {
  const { map, element, clock, governor } = createHarness({ zoom: -3 });
  governor.enable();
  element.dispatch("wheel", createWheelEvent(-60, 17, 29));
  assert.deepEqual(map.calls, [{ anchor: { x: 17, y: 29 }, zoom: -4 }]);

  map.emit("zoomend");
  clock.advance(WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs);
  for (let index = 0; index < 5; index += 1) {
    const event = createWheelEvent(-60);
    element.dispatch("wheel", event);
    assert.equal(event.prevented, true);
  }
  assert.equal(map.calls.length, 1);
  assert.equal(governor.getSnapshot().locked, false);
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);
  assert.equal(clock.pendingCount(), 0);

  element.dispatch("wheel", createWheelEvent(60, 31, 43));
  assert.deepEqual(map.calls[1], { anchor: { x: 31, y: 43 }, zoom: -3 });
});

test("disable and destroy remove listeners, timers, and transient state", () => {
  const { map, element, focusTarget, clock, governor } = createHarness();
  governor.enable();
  element.dispatch("wheel", createWheelEvent(30));
  assert.equal(clock.pendingCount(), 1);
  assert.equal(element.listenerCount("wheel"), 1);
  assert.equal(element.listenerCount("pointerleave"), 1);
  assert.equal(focusTarget.listenerCount("blur"), 1);
  assert.equal(map.listenerCount("zoomend"), 1);

  assert.equal(governor.disable(), true);
  assert.equal(governor.disable(), false);
  assert.equal(clock.pendingCount(), 0);
  assert.equal(element.listenerCount("wheel"), 0);
  assert.equal(element.listenerCount("pointerleave"), 0);
  assert.equal(focusTarget.listenerCount("blur"), 0);
  assert.equal(map.listenerCount("zoomend"), 0);
  assert.equal(governor.getSnapshot().accumulatedDelta, 0);

  assert.equal(governor.destroy(), true);
  assert.equal(governor.destroy(), false);
  assert.throws(
    () => governor.enable(),
    (error) => error.code === "destroyed_wheel_zoom_governor"
  );
});

test("the safety timeout releases a lock when zoomend is missing", () => {
  const { element, clock, governor } = createHarness();
  governor.enable();
  element.dispatch("wheel", createWheelEvent(60));

  clock.advance(WHEEL_ZOOM_DEFAULTS.safetyUnlockMs - 1);
  assert.equal(governor.getSnapshot().locked, true);
  clock.advance(1);
  assert.equal(governor.getSnapshot().locked, false);
  assert.equal(clock.pendingCount(), 0);
});
