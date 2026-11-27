import { deepFreeze } from "../modules/scenario/utils.js";
import { SelectionError } from "../modules/selection/errors.js";
import { normalizeSelection, sameSelection } from "../modules/selection/selection.js";

const INTERNALS = new WeakMap();

function notify(session, type) {
  const internal = INTERNALS.get(session);
  const change = deepFreeze({ type, probe: internal.probe });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // A transient presentation subscriber cannot roll back an accepted probe.
    }
  }
  return change;
}

export class PointProbeSession {
  constructor(catalog) {
    if (!catalog?.origin) {
      throw new SelectionError("invalid_selection_catalog", "A selection catalog is required.");
    }
    INTERNALS.set(this, { catalog, probe: null, subscribers: new Set() });
  }

  set(rawSelection) {
    const internal = INTERNALS.get(this);
    const probe = normalizeSelection(internal.catalog, rawSelection);
    if (probe.kind !== "point") {
      throw new SelectionError(
        "invalid_point_probe",
        "A point probe must be a map-point selection."
      );
    }
    if (sameSelection(probe, internal.probe)) return false;
    internal.probe = probe;
    return notify(this, "set");
  }

  clear() {
    const internal = INTERNALS.get(this);
    if (internal.probe === null) return false;
    internal.probe = null;
    return notify(this, "clear");
  }

  getProbe() {
    return INTERNALS.get(this).probe;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") {
      throw new SelectionError("invalid_selection_subscriber", "Subscriber must be a function.");
    }
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}
