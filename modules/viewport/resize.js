import { ViewportError } from "./errors.js";
import { classifyViewportLayout, VIEWPORT_WORKBENCH_TOKENS } from "./layout.js";

const ACTIVE_ADAPTERS = new WeakMap();

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new ViewportError("invalid_viewport_resize_adapter", `${label} must be a function.`);
  }
  return value;
}

function requireElement(value, label) {
  if (!value || typeof value !== "object") {
    throw new ViewportError("invalid_viewport_resize_adapter", `${label} is required.`);
  }
  return value;
}

function boundGlobalFunction(name) {
  const value = globalThis[name];
  return typeof value === "function" ? value.bind(globalThis) : null;
}

export function hasPhoneSizedTouchScreen(view = globalThis.window) {
  const screenWidth = view?.screen?.width;
  const screenHeight = view?.screen?.height;
  return view?.matchMedia?.("(any-pointer: coarse)")?.matches === true &&
    Number.isFinite(screenWidth) && screenWidth > 0 &&
    Number.isFinite(screenHeight) && screenHeight > 0 &&
    Math.min(screenWidth, screenHeight) <= VIEWPORT_WORKBENCH_TOKENS.phoneMaximumWidth;
}

export function createViewportResizeAdapter({
  session,
  map,
  workbenchElement,
  mapElement = workbenchElement,
  phoneLandscapeScreen = () => hasPhoneSizedTouchScreen(),
  ResizeObserverClass = globalThis.ResizeObserver,
  requestFrame = boundGlobalFunction("requestAnimationFrame"),
  cancelFrame = boundGlobalFunction("cancelAnimationFrame")
} = {}) {
  if (
    !session ||
    typeof session.setLayoutClass !== "function" ||
    typeof session.subscribe !== "function"
  ) {
    throw new ViewportError(
      "invalid_viewport_resize_adapter",
      "A ViewportCompositionSession is required."
    );
  }
  if (ACTIVE_ADAPTERS.has(session)) {
    throw new ViewportError(
      "viewport_resize_adapter_exists",
      "This viewport composition session already has an active resize adapter."
    );
  }
  if (!map || typeof map.invalidateSize !== "function") {
    throw new ViewportError(
      "invalid_viewport_resize_adapter",
      "A Leaflet-compatible map is required."
    );
  }

  requireElement(workbenchElement, "workbenchElement");
  requireElement(mapElement, "mapElement");
  requireFunction(ResizeObserverClass, "ResizeObserverClass");
  requireFunction(requestFrame, "requestFrame");
  requireFunction(phoneLandscapeScreen, "phoneLandscapeScreen");
  if (cancelFrame !== null) requireFunction(cancelFrame, "cancelFrame");

  let disconnected = false;
  let frameId = null;

  const schedule = () => {
    if (disconnected || frameId !== null) return false;
    frameId = requestFrame(() => {
      frameId = null;
      if (!disconnected) map.invalidateSize({ pan: false, animate: false });
    });
    return true;
  };

  const applyDimensions = (width, height) => {
    const classification = classifyViewportLayout(width, height, {
      phoneLandscapeEligible: phoneLandscapeScreen()
    });
    session.setLayoutClass(classification.layoutClass, classification.short, classification.phone);
    return classification;
  };

  const refresh = () => {
    if (disconnected) return false;
    if (typeof workbenchElement.getBoundingClientRect !== "function") {
      throw new ViewportError(
        "invalid_viewport_resize_adapter",
        "workbenchElement.getBoundingClientRect must be a function."
      );
    }
    const rect = workbenchElement.getBoundingClientRect();
    const classification = applyDimensions(rect.width, rect.height);
    schedule();
    return classification;
  };

  const observer = new ResizeObserverClass((entries) => {
    if (disconnected) return;
    for (const entry of entries) {
      if (entry.target === workbenchElement) {
        applyDimensions(entry.contentRect.width, entry.contentRect.height);
      }
    }
    schedule();
  });

  const unsubscribe = session.subscribe(schedule);
  let adapter;
  const disconnect = () => {
    if (disconnected) return false;
    disconnected = true;
    unsubscribe();
    observer.disconnect();
    if (frameId !== null && cancelFrame !== null) cancelFrame(frameId);
    frameId = null;
    if (ACTIVE_ADAPTERS.get(session) === adapter) ACTIVE_ADAPTERS.delete(session);
    return true;
  };

  adapter = Object.freeze({ schedule, refresh, disconnect });
  ACTIVE_ADAPTERS.set(session, adapter);

  try {
    observer.observe(workbenchElement);
    if (mapElement !== workbenchElement) observer.observe(mapElement);
    refresh();
  } catch (error) {
    disconnect();
    throw error;
  }

  return adapter;
}
