import { ViewportError } from "./errors.js";

export const WHEEL_ZOOM_DEFAULTS = Object.freeze({
  deltaThreshold: 60,
  inactivityResetMs: 200,
  minimumStepIntervalMs: 150,
  safetyUnlockMs: 1000
});

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new ViewportError("invalid_wheel_zoom_governor", `${label} must be a function.`);
  }
  return value;
}

function requireEventTarget(value, label) {
  if (
    !value ||
    typeof value.addEventListener !== "function" ||
    typeof value.removeEventListener !== "function"
  ) {
    throw new ViewportError(
      "invalid_wheel_zoom_governor",
      `${label} must support addEventListener and removeEventListener.`
    );
  }
  return value;
}

function requireMap(map) {
  if (!map || typeof map !== "object") {
    throw new ViewportError("invalid_wheel_zoom_governor", "map is required.");
  }
  for (const method of [
    "on",
    "off",
    "getZoom",
    "getMinZoom",
    "getMaxZoom",
    "mouseEventToContainerPoint",
    "setZoomAround"
  ]) {
    requireFunction(map[method], `map.${method}`);
  }
  return map;
}

function requirePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ViewportError(
      "invalid_wheel_zoom_governor",
      `${label} must be a positive finite number.`
    );
  }
  return value;
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function defaultSetTimer(callback, delay) {
  return globalThis.setTimeout(callback, delay);
}

function defaultClearTimer(handle) {
  globalThis.clearTimeout(handle);
}

export function createWheelZoomGovernor({
  map,
  element,
  focusTarget = null,
  normalizeDelta,
  now = defaultNow,
  setTimer = defaultSetTimer,
  clearTimer = defaultClearTimer,
  deltaThreshold = WHEEL_ZOOM_DEFAULTS.deltaThreshold,
  inactivityResetMs = WHEEL_ZOOM_DEFAULTS.inactivityResetMs,
  minimumStepIntervalMs = WHEEL_ZOOM_DEFAULTS.minimumStepIntervalMs,
  safetyUnlockMs = WHEEL_ZOOM_DEFAULTS.safetyUnlockMs
} = {}) {
  const mapAdapter = requireMap(map);
  const eventTarget = requireEventTarget(element, "element");
  if (focusTarget !== null) requireEventTarget(focusTarget, "focusTarget");
  const normalizeWheelDelta = requireFunction(normalizeDelta, "normalizeDelta");
  const readNow = requireFunction(now, "now");
  const scheduleTimer = requireFunction(setTimer, "setTimer");
  const cancelTimer = requireFunction(clearTimer, "clearTimer");
  const threshold = requirePositiveNumber(deltaThreshold, "deltaThreshold");
  const resetDelay = requirePositiveNumber(inactivityResetMs, "inactivityResetMs");
  const minimumDelay = requirePositiveNumber(minimumStepIntervalMs, "minimumStepIntervalMs");
  const safetyDelay = requirePositiveNumber(safetyUnlockMs, "safetyUnlockMs");
  if (safetyDelay < minimumDelay) {
    throw new ViewportError(
      "invalid_wheel_zoom_governor",
      "safetyUnlockMs must be greater than or equal to minimumStepIntervalMs."
    );
  }

  let enabled = false;
  let destroyed = false;
  let locked = false;
  let direction = 0;
  let accumulatedDelta = 0;
  let minimumElapsed = false;
  let zoomFinished = false;
  let inactivityTimer = null;
  let minimumTimer = null;
  let safetyTimer = null;
  let acceptedStepCount = 0;
  let discardedEventCount = 0;
  let lastAcceptedAt = null;

  const getSnapshot = () =>
    Object.freeze({
      enabled,
      destroyed,
      locked,
      direction,
      accumulatedDelta,
      acceptedStepCount,
      discardedEventCount,
      lastAcceptedAt
    });

  const clearTimerHandle = (name) => {
    const handle =
      name === "inactivity" ? inactivityTimer : name === "minimum" ? minimumTimer : safetyTimer;
    if (handle !== null) cancelTimer(handle);
    if (name === "inactivity") inactivityTimer = null;
    else if (name === "minimum") minimumTimer = null;
    else safetyTimer = null;
  };

  const clearAccumulation = () => {
    clearTimerHandle("inactivity");
    direction = 0;
    accumulatedDelta = 0;
  };

  const unlock = () => {
    clearTimerHandle("minimum");
    clearTimerHandle("safety");
    locked = false;
    minimumElapsed = false;
    zoomFinished = false;
  };

  const maybeUnlock = () => {
    if (locked && minimumElapsed && zoomFinished) unlock();
  };

  const scheduleAccumulationReset = () => {
    clearTimerHandle("inactivity");
    inactivityTimer = scheduleTimer(() => {
      inactivityTimer = null;
      direction = 0;
      accumulatedDelta = 0;
    }, resetDelay);
  };

  const beginLock = () => {
    locked = true;
    minimumElapsed = false;
    zoomFinished = false;
    lastAcceptedAt = readNow();
    minimumTimer = scheduleTimer(() => {
      minimumTimer = null;
      minimumElapsed = true;
      maybeUnlock();
    }, minimumDelay);
    safetyTimer = scheduleTimer(() => {
      safetyTimer = null;
      unlock();
    }, safetyDelay);
  };

  const stopWheelEvent = (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
  };

  const handleWheel = (event) => {
    if (!enabled || destroyed) return;
    const delta = Number(normalizeWheelDelta(event));
    if (!Number.isFinite(delta) || delta === 0) return;

    stopWheelEvent(event);
    if (locked) {
      discardedEventCount += 1;
      return;
    }

    const nextDirection = delta > 0 ? 1 : -1;
    if (direction !== 0 && direction !== nextDirection) clearAccumulation();
    direction = nextDirection;
    accumulatedDelta += Math.abs(delta);

    if (accumulatedDelta < threshold) {
      scheduleAccumulationReset();
      return;
    }

    const currentZoom = mapAdapter.getZoom();
    const targetZoom = Math.max(
      mapAdapter.getMinZoom(),
      Math.min(mapAdapter.getMaxZoom(), currentZoom + nextDirection)
    );
    clearAccumulation();
    if (targetZoom === currentZoom) return;

    const anchor = mapAdapter.mouseEventToContainerPoint(event);
    acceptedStepCount += 1;
    beginLock();
    try {
      mapAdapter.setZoomAround(anchor, targetZoom);
    } catch (error) {
      unlock();
      throw error;
    }
  };

  const handleZoomEnd = () => {
    if (!locked) {
      clearAccumulation();
      return;
    }
    zoomFinished = true;
    maybeUnlock();
  };

  const handleReset = () => {
    clearAccumulation();
  };

  const enable = () => {
    if (destroyed) {
      throw new ViewportError(
        "destroyed_wheel_zoom_governor",
        "A destroyed wheel zoom governor cannot be enabled."
      );
    }
    if (enabled) return false;
    enabled = true;
    eventTarget.addEventListener("wheel", handleWheel, { passive: false });
    eventTarget.addEventListener("pointerleave", handleReset);
    focusTarget?.addEventListener("blur", handleReset);
    mapAdapter.on("zoomend", handleZoomEnd);
    return true;
  };

  const disable = () => {
    if (!enabled) return false;
    enabled = false;
    eventTarget.removeEventListener("wheel", handleWheel, false);
    eventTarget.removeEventListener("pointerleave", handleReset, false);
    focusTarget?.removeEventListener("blur", handleReset, false);
    mapAdapter.off("zoomend", handleZoomEnd);
    clearAccumulation();
    unlock();
    return true;
  };

  const destroy = () => {
    if (destroyed) return false;
    disable();
    destroyed = true;
    return true;
  };

  return Object.freeze({ enable, disable, destroy, getSnapshot });
}
