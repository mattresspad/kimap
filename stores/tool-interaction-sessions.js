const PAINT_TOOL_STATES = Object.freeze(["off", "select", "move", "draw", "place"]);
const PAINT_DRAWING_MODES = Object.freeze(["box", "line", "arrow", "circle"]);
const PAINT_PLACEMENT_MODES = Object.freeze(["icon", "note"]);
const INTERNALS = new WeakMap();

function freezeSnapshot(state) {
  return Object.freeze({
    ...state,
    active: state.toolState !== "off",
    drawing: state.toolState === "draw",
    placing: state.toolState === "place"
  });
}

function notify(session, type) {
  const change = Object.freeze({ type, snapshot: session.getSnapshot() });
  for (const subscriber of [...INTERNALS.get(session).subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Presentation subscribers cannot roll back a committed interaction change.
    }
  }
  return change;
}

function requireSubscriber(subscriber) {
  if (typeof subscriber !== "function") {
    throw new TypeError("Interaction subscriber must be a function.");
  }
}

function normalizePaintTool(toolState, drawingMode) {
  if (!PAINT_TOOL_STATES.includes(toolState)) {
    throw new TypeError(`Unsupported Paint tool state: ${String(toolState)}.`);
  }

  if (toolState === "draw" && !PAINT_DRAWING_MODES.includes(drawingMode)) {
    throw new TypeError(`Unsupported Paint drawing mode: ${String(drawingMode)}.`);
  }
  if (toolState === "place" && !PAINT_PLACEMENT_MODES.includes(drawingMode)) {
    throw new TypeError(`Unsupported Paint placement mode: ${String(drawingMode)}.`);
  }
  if (toolState !== "draw" && toolState !== "place" && drawingMode !== null) {
    throw new TypeError(`Paint tool '${toolState}' cannot have a drawing mode.`);
  }

  return { toolState, drawingMode };
}

export class PlayerMarkerInteractionSession {
  constructor() {
    INTERNALS.set(this, {
      subscribers: new Set(),
      snapshot: Object.freeze({ placementActive: false })
    });
  }

  startPlacement() {
    const internal = INTERNALS.get(this);
    if (internal.snapshot.placementActive) return false;
    internal.snapshot = Object.freeze({ placementActive: true });
    return notify(this, "startPlacement");
  }

  cancelPlacement() {
    const internal = INTERNALS.get(this);
    if (!internal.snapshot.placementActive) return false;
    internal.snapshot = Object.freeze({ placementActive: false });
    return notify(this, "cancelPlacement");
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    requireSubscriber(subscriber);
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}

export class PaintInteractionSession {
  constructor() {
    INTERNALS.set(this, {
      subscribers: new Set(),
      snapshot: freezeSnapshot({
        toolsOpen: false,
        toolState: "off",
        drawingMode: null
      })
    });
  }

  open(options = null) {
    const internal = INTERNALS.get(this);
    if (options === null && internal.snapshot.toolsOpen) return false;
    const { toolState = "off", drawingMode = null } = options ?? {};
    const tool = normalizePaintTool(toolState, drawingMode);
    const next = freezeSnapshot({ toolsOpen: true, ...tool });
    if (
      internal.snapshot.toolsOpen === next.toolsOpen &&
      internal.snapshot.toolState === next.toolState &&
      internal.snapshot.drawingMode === next.drawingMode
    ) {
      return false;
    }
    const type = internal.snapshot.toolsOpen ? "activateTool" : "openTools";
    internal.snapshot = next;
    return notify(this, type);
  }

  activate(toolState, drawingMode = null) {
    return this.open({ toolState, drawingMode });
  }

  cancel() {
    const internal = INTERNALS.get(this);
    if (!internal.snapshot.active) return false;
    internal.snapshot = freezeSnapshot({
      toolsOpen: internal.snapshot.toolsOpen,
      toolState: "off",
      drawingMode: null
    });
    return notify(this, "cancelInteraction");
  }

  close() {
    const internal = INTERNALS.get(this);
    if (!internal.snapshot.toolsOpen && !internal.snapshot.active) return false;
    internal.snapshot = freezeSnapshot({
      toolsOpen: false,
      toolState: "off",
      drawingMode: null
    });
    return notify(this, "closeTools");
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    requireSubscriber(subscriber);
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}

export const PAINT_INTERACTION = Object.freeze({
  toolStates: PAINT_TOOL_STATES,
  drawingModes: PAINT_DRAWING_MODES,
  placementModes: PAINT_PLACEMENT_MODES
});
