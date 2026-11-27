import { deepFreeze } from "../modules/scenario/utils.js";
import { SelectionError } from "../modules/selection/errors.js";
import { normalizeSelection, sameSelection } from "../modules/selection/selection.js";

const INTERNALS = new WeakMap();

function notify(session, type) {
  const internal = INTERNALS.get(session);
  const change = deepFreeze({ type, selection: internal.selection });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Selection commits remain successful even when a renderer fails.
    }
  }
  return change;
}

export class SelectionSession {
  constructor(catalog) {
    if (!catalog?.origin) {
      throw new SelectionError("invalid_selection_catalog", "A selection catalog is required.");
    }
    INTERNALS.set(this, { catalog, selection: null, subscribers: new Set() });
  }

  select(rawSelection) {
    const internal = INTERNALS.get(this);
    const selection = normalizeSelection(internal.catalog, rawSelection);
    if (sameSelection(selection, internal.selection)) return false;
    internal.selection = selection;
    return notify(this, "select");
  }

  clear() {
    const internal = INTERNALS.get(this);
    if (internal.selection === null) return false;
    internal.selection = null;
    return notify(this, "clear");
  }

  getSelection() {
    return INTERNALS.get(this).selection;
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
