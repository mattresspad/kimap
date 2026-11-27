import { deepFreeze } from "../modules/scenario/utils.js";

export const REFERENCE_ENTITY_TYPES = Object.freeze([
  "character",
  "squad",
  "faction",
  "nest",
  "item",
  "weapon",
  "crossbow",
  "armour",
  "mapItem",
  "nestItem"
]);

const ENTITY_TYPES = new Set(REFERENCE_ENTITY_TYPES);
const INTERNALS = new WeakMap();

function normalizeTarget(rawTarget, hasTarget) {
  if (rawTarget === null || typeof rawTarget !== "object" || Array.isArray(rawTarget)) {
    throw new TypeError("A reference target object is required.");
  }
  const entityType = rawTarget.entityType;
  const entityId = rawTarget.entityId;
  if (!ENTITY_TYPES.has(entityType)) {
    throw new TypeError(`Unsupported reference entity type '${String(entityType)}'.`);
  }
  if (typeof entityId !== "string" || entityId.trim() === "") {
    throw new TypeError("Reference entityId must be a non-empty string.");
  }
  const target = { entityType, entityId };
  if (hasTarget && !hasTarget(target)) {
    throw new TypeError(`Unknown reference target '${entityType}:${entityId}'.`);
  }
  return deepFreeze(target);
}

function sameTarget(left, right) {
  return Boolean(
    left && right && left.entityType === right.entityType && left.entityId === right.entityId
  );
}

function sameState(left, right) {
  return (
    left.surface === right.surface &&
    left.landmarkId === right.landmarkId &&
    left.returnSurface === right.returnSurface &&
    left.stack.length === right.stack.length &&
    left.stack.every((target, index) => sameTarget(target, right.stack[index]))
  );
}

function createSnapshot(state) {
  return deepFreeze({
    surface: state.surface,
    landmarkId: state.landmarkId ?? null,
    returnSurface: state.returnSurface ?? null,
    hasLandmark: state.surface === "landmark",
    stack: state.stack.map((target) => ({ ...target })),
    current: state.stack.at(-1) ? { ...state.stack.at(-1) } : null,
    depth: state.stack.length,
    hasReference: state.stack.length > 0
  });
}

function commit(session, type, reducer) {
  const internal = INTERNALS.get(session);
  const next = reducer(internal.state);
  if (sameState(internal.state, next)) return false;
  internal.state = next;
  internal.snapshot = createSnapshot(next);
  const change = deepFreeze({ type, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Navigation remains committed when a presentation subscriber fails.
    }
  }
  return change;
}

export class ReferenceNavigationSession {
  constructor({ hasTarget = null, hasLandmark = null } = {}) {
    if (hasTarget !== null && typeof hasTarget !== "function") {
      throw new TypeError("hasTarget must be a function when provided.");
    }
    if (hasLandmark !== null && typeof hasLandmark !== "function") {
      throw new TypeError("hasLandmark must be a function when provided.");
    }
    const state = { surface: "geographic", stack: [] };
    INTERNALS.set(this, {
      hasTarget,
      hasLandmark,
      state,
      snapshot: createSnapshot(state),
      subscribers: new Set()
    });
  }

  replace(rawTarget) {
    const internal = INTERNALS.get(this);
    const target = normalizeTarget(rawTarget, internal.hasTarget);
    return commit(this, "replace", () => ({ surface: "reference", stack: [target] }));
  }

  push(rawTarget) {
    const internal = INTERNALS.get(this);
    const target = normalizeTarget(rawTarget, internal.hasTarget);
    return commit(this, "push", (state) => {
      if (sameTarget(state.stack.at(-1), target)) {
        return state.surface === "reference" ? state : { surface: "reference", stack: state.stack };
      }
      return { surface: "reference", stack: [...state.stack, target] };
    });
  }

  back() {
    if (this.getSnapshot().hasLandmark) return this.closeLandmark();
    return commit(this, "back", (state) =>
      state.stack.length <= 1 ? state : { surface: "reference", stack: state.stack.slice(0, -1) }
    );
  }

  showReference() {
    return commit(this, "showReference", (state) =>
      state.stack.length === 0 ? state : { surface: "reference", stack: state.stack }
    );
  }

  showGeographic() {
    return commit(this, "showGeographic", (state) => ({
      surface: "geographic",
      stack: state.stack
    }));
  }

  openLandmark(id, { hasGeographic = false } = {}) {
    const { hasLandmark } = INTERNALS.get(this);
    if (typeof id !== "string" || !id.trim() || (hasLandmark && !hasLandmark(id))) {
      throw new TypeError("A known landmark occurrence is required.");
    }
    return commit(this, "openLandmark", (state) => ({
      surface: "landmark",
      stack: state.stack,
      landmarkId: id,
      returnSurface:
        state.surface === "landmark"
          ? state.returnSurface
          : state.surface === "reference" && state.stack.length
            ? "reference"
            : hasGeographic
              ? "geographic"
              : null
    }));
  }

  closeLandmark() {
    return commit(this, "closeLandmark", (state) =>
      state.surface !== "landmark"
        ? state
        : {
            surface: state.returnSurface ?? "geographic",
            stack: state.stack
          }
    );
  }

  clear() {
    return commit(this, "clear", () => ({ surface: "geographic", stack: [] }));
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") {
      throw new TypeError("Reference navigation subscriber must be a function.");
    }
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}
