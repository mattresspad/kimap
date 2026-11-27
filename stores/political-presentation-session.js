import { deepFreeze } from "../modules/scenario/utils.js";

const INTERNALS = new WeakMap();
const MINIMUM_OPACITY = 0.35;
const MAXIMUM_OPACITY = 1;

function requireColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/iu.test(value)) {
    throw new TypeError("Political colors must use #rrggbb notation.");
  }
  return value.toLowerCase();
}

function requireOpacity(value) {
  if (!Number.isFinite(value) || value < MINIMUM_OPACITY || value > MAXIMUM_OPACITY) {
    throw new TypeError("Political opacity must be between 0.35 and 1.");
  }
  return value;
}

function createSnapshot(internal) {
  return deepFreeze({
    participantIds: [...internal.participantIds].sort(),
    colorsByFactionId: { ...internal.colorsByFactionId },
    defaultsByFactionId: internal.defaultsByFactionId,
    opacity: internal.opacity
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
      // Presentation subscribers cannot roll back an already committed configuration change.
    }
  }
  return change;
}

function requireFaction(internal, id) {
  if (typeof id !== "string" || !Object.hasOwn(internal.defaultsByFactionId, id)) {
    throw new TypeError(`Unknown political faction ID '${String(id)}'.`);
  }
  return id;
}

export class PoliticalPresentationSession {
  constructor({ defaultsByFactionId, participantIds, opacity = 0.7 } = {}) {
    if (!defaultsByFactionId || typeof defaultsByFactionId !== "object") {
      throw new TypeError("Political presentation requires faction color defaults.");
    }
    if (!Array.isArray(participantIds)) {
      throw new TypeError("Political presentation requires participant IDs.");
    }
    const defaults = {};
    for (const [id, entry] of Object.entries(defaultsByFactionId)) {
      defaults[id] = deepFreeze({
        color: requireColor(entry?.color),
        source: entry?.source === "authored" ? "authored" : "generated",
        paletteId: typeof entry?.paletteId === "string" ? entry.paletteId : null
      });
    }
    const participants = new Set();
    for (const id of participantIds) {
      if (!Object.hasOwn(defaults, id)) throw new TypeError(`Unknown participant ID '${id}'.`);
      participants.add(id);
    }
    const initialOpacity = requireOpacity(opacity);
    const internal = {
      defaultsByFactionId: deepFreeze(defaults),
      defaultParticipantIds: Object.freeze([...participants].sort()),
      defaultOpacity: initialOpacity,
      participantIds: participants,
      colorsByFactionId: Object.fromEntries(
        Object.entries(defaults).map(([id, entry]) => [id, entry.color])
      ),
      opacity: initialOpacity,
      subscribers: new Set(),
      snapshot: null
    };
    internal.snapshot = createSnapshot(internal);
    INTERNALS.set(this, internal);
  }

  includeFaction(id) {
    const internal = INTERNALS.get(this);
    requireFaction(internal, id);
    if (internal.participantIds.has(id)) return false;
    internal.participantIds.add(id);
    return notify(this, "includeFaction");
  }

  include(id) {
    return this.includeFaction(id);
  }

  hideFaction(id) {
    const internal = INTERNALS.get(this);
    requireFaction(internal, id);
    if (!internal.participantIds.has(id)) return false;
    internal.participantIds.delete(id);
    return notify(this, "hideFaction");
  }

  hide(id) {
    return this.hideFaction(id);
  }

  setFactionColor(id, color) {
    const internal = INTERNALS.get(this);
    requireFaction(internal, id);
    const normalized = requireColor(color);
    if (internal.colorsByFactionId[id] === normalized) return false;
    internal.colorsByFactionId[id] = normalized;
    return notify(this, "setFactionColor");
  }

  setColor(id, color) {
    return this.setFactionColor(id, color);
  }

  resetFactionColor(id) {
    const internal = INTERNALS.get(this);
    requireFaction(internal, id);
    const color = internal.defaultsByFactionId[id].color;
    if (internal.colorsByFactionId[id] === color) return false;
    internal.colorsByFactionId[id] = color;
    return notify(this, "resetFactionColor");
  }

  resetColor(id) {
    return this.resetFactionColor(id);
  }

  setOpacity(opacity) {
    const internal = INTERNALS.get(this);
    const normalized = requireOpacity(opacity);
    if (internal.opacity === normalized) return false;
    internal.opacity = normalized;
    return notify(this, "setOpacity");
  }

  restoreDefaults() {
    const internal = INTERNALS.get(this);
    const participants = new Set(internal.defaultParticipantIds);
    const colors = Object.fromEntries(
      Object.entries(internal.defaultsByFactionId).map(([id, entry]) => [id, entry.color])
    );
    const unchanged =
      internal.opacity === internal.defaultOpacity &&
      internal.participantIds.size === participants.size &&
      [...participants].every((id) => internal.participantIds.has(id)) &&
      Object.entries(colors).every(([id, color]) => internal.colorsByFactionId[id] === color);
    if (unchanged) return false;
    internal.participantIds = participants;
    internal.colorsByFactionId = colors;
    internal.opacity = internal.defaultOpacity;
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

export const POLITICAL_OPACITY_RANGE = Object.freeze({
  minimum: MINIMUM_OPACITY,
  maximum: MAXIMUM_OPACITY,
  defaultValue: 0.7
});
