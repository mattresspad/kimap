import { deepFreeze } from "../modules/scenario/utils.js";

const INTERNALS = new WeakMap();

function requireFactionId(internal, id) {
  if (id === null) return null;
  if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
    throw new TypeError("Faction Overview selection must be an exact nonempty faction ID or null.");
  }
  if (internal.allowedIds && !internal.allowedIds.has(id)) {
    throw new TypeError(`Unknown Faction Overview faction ID '${id}'.`);
  }
  return id;
}

function createAllowedIds(ids) {
  if (ids === null || ids === undefined) return null;
  if (typeof ids === "string" || typeof ids?.[Symbol.iterator] !== "function") {
    throw new TypeError("Faction Overview allowed IDs must be an iterable of exact IDs.");
  }
  const allowed = new Set();
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
      throw new TypeError("Faction Overview allowed IDs must contain exact nonempty strings.");
    }
    allowed.add(id);
  }
  return allowed;
}

function createSnapshot(internal) {
  return deepFreeze({ selectedFactionId: internal.selectedFactionId, search: internal.search });
}

function notify(session, type) {
  const internal = INTERNALS.get(session);
  internal.snapshot = createSnapshot(internal);
  const change = deepFreeze({ type, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Presentation observers cannot roll back an already committed selection.
    }
  }
  return change;
}

export class FactionOverviewPresentationSession {
  constructor({ allowedIds = null } = {}) {
    const internal = {
      allowedIds: createAllowedIds(allowedIds),
      selectedFactionId: null,
      search: "",
      subscribers: new Set(),
      snapshot: null
    };
    internal.snapshot = createSnapshot(internal);
    INTERNALS.set(this, internal);
  }

  setSelectedFactionId(id) {
    const internal = INTERNALS.get(this);
    const normalized = requireFactionId(internal, id);
    if (internal.selectedFactionId === normalized) return false;
    internal.selectedFactionId = normalized;
    return notify(this, "setSelectedFactionId");
  }

  setSearch(text) {
    if (typeof text !== "string") {
      throw new TypeError("Faction Overview search text must be a string.");
    }
    const internal = INTERNALS.get(this);
    if (internal.search === text) return false;
    internal.search = text;
    return notify(this, "setSearch");
  }

  restoreDefaults() {
    const internal = INTERNALS.get(this);
    if (internal.selectedFactionId === null && internal.search === "") return false;
    internal.selectedFactionId = null;
    internal.search = "";
    return notify(this, "restoreDefaults");
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") throw new TypeError("Subscriber must be a function.");
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}
