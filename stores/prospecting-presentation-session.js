import { deepFreeze } from "../modules/scenario/utils.js";

export const PROSPECTING_NUMERIC_IDS = Object.freeze([
  "arid",
  "green",
  "swamp",
  "copper",
  "iron",
  "stone",
  "water"
]);

export const PROSPECTING_CONDITION_IDS = Object.freeze([
  "acidGround",
  "acidWater",
  "gas",
  "acidRain",
  "duststorm",
  "burning"
]);

const INTERNALS = new WeakMap();
const NUMERIC_ID_SET = new Set(PROSPECTING_NUMERIC_IDS);
const CONDITION_ID_SET = new Set(PROSPECTING_CONDITION_IDS);

function requireId(id, allowed, kind) {
  if (!allowed.has(id)) {
    throw new TypeError(`Unknown Prospecting ${kind} ID '${String(id)}'.`);
  }
  return id;
}

function requireSelected(selected) {
  if (typeof selected !== "boolean") {
    throw new TypeError("Prospecting selection must be a boolean.");
  }
  return selected;
}

function createMinimums() {
  return Object.fromEntries(PROSPECTING_NUMERIC_IDS.map((id) => [id, 0]));
}

function hasCriteria(internal) {
  return (
    internal.selectedNumericIds.size > 0 ||
    internal.selectedConditionIds.size > 0 ||
    PROSPECTING_NUMERIC_IDS.some((id) => internal.minimumByNumericId[id] !== 0)
  );
}

function createSnapshot(internal) {
  return deepFreeze({
    selectedNumericIds: PROSPECTING_NUMERIC_IDS.filter((id) => internal.selectedNumericIds.has(id)),
    selectedConditionIds: PROSPECTING_CONDITION_IDS.filter((id) =>
      internal.selectedConditionIds.has(id)
    ),
    minimumByNumericId: { ...internal.minimumByNumericId },
    search: internal.search
  });
}

function notify(session, type) {
  const internal = INTERNALS.get(session);
  internal.snapshot = createSnapshot(internal);
  const change = deepFreeze({ type, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Presentation observers cannot roll back an already committed change.
    }
  }
  return change;
}

export class ProspectingPresentationSession {
  constructor() {
    const internal = {
      selectedNumericIds: new Set(),
      selectedConditionIds: new Set(),
      minimumByNumericId: createMinimums(),
      search: "",
      subscribers: new Set(),
      snapshot: null
    };
    internal.snapshot = createSnapshot(internal);
    INTERNALS.set(this, internal);
  }

  setNumericSelected(id, selected) {
    requireId(id, NUMERIC_ID_SET, "numeric");
    requireSelected(selected);
    const internal = INTERNALS.get(this);
    if (internal.selectedNumericIds.has(id) === selected) return false;
    if (selected) internal.selectedNumericIds.add(id);
    else internal.selectedNumericIds.delete(id);
    return notify(this, "setNumericSelected");
  }

  setConditionSelected(id, selected) {
    requireId(id, CONDITION_ID_SET, "condition");
    requireSelected(selected);
    const internal = INTERNALS.get(this);
    if (internal.selectedConditionIds.has(id) === selected) return false;
    if (selected) internal.selectedConditionIds.add(id);
    else internal.selectedConditionIds.delete(id);
    return notify(this, "setConditionSelected");
  }

  setMinimum(id, value) {
    requireId(id, NUMERIC_ID_SET, "numeric");
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new TypeError("Prospecting minimum must be a finite nonnegative number.");
    }
    const internal = INTERNALS.get(this);
    if (internal.minimumByNumericId[id] === value) return false;
    internal.minimumByNumericId[id] = value;
    return notify(this, "setMinimum");
  }

  setSearch(text) {
    if (typeof text !== "string") throw new TypeError("Prospecting search text must be a string.");
    const internal = INTERNALS.get(this);
    if (internal.search === text) return false;
    internal.search = text;
    return notify(this, "setSearch");
  }

  clearCriteria() {
    const internal = INTERNALS.get(this);
    if (!hasCriteria(internal)) return false;
    internal.selectedNumericIds.clear();
    internal.selectedConditionIds.clear();
    internal.minimumByNumericId = createMinimums();
    return notify(this, "clearCriteria");
  }

  restoreDefaults() {
    const internal = INTERNALS.get(this);
    if (internal.search === "" && !hasCriteria(internal)) return false;
    internal.selectedNumericIds.clear();
    internal.selectedConditionIds.clear();
    internal.minimumByNumericId = createMinimums();
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
