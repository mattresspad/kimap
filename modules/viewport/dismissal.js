import { ViewportError } from "./errors.js";

export const ESCAPE_SURFACES = Object.freeze([
  "theater",
  "transient",
  "focusedHud",
  "tool",
  "reference",
  "popup"
]);

function normalizeHandler(surface, handler) {
  if (handler === undefined || handler === null) return null;
  if (typeof handler !== "object") {
    throw new ViewportError(
      "invalid_escape_handler",
      `Escape handler '${surface}' must be an object.`
    );
  }
  const isActive = handler.isActive ?? handler.isOpen;
  if (typeof isActive !== "function" || typeof handler.dismiss !== "function") {
    throw new ViewportError(
      "invalid_escape_handler",
      `Escape handler '${surface}' requires isActive (or isOpen) and dismiss functions.`
    );
  }
  return Object.freeze({
    isActive: isActive.bind(handler),
    dismiss: handler.dismiss.bind(handler)
  });
}

export function createEscapeCoordinator(handlers = {}) {
  if (handlers === null || typeof handlers !== "object" || Array.isArray(handlers)) {
    throw new ViewportError("invalid_escape_handlers", "Escape handlers must be an object.");
  }

  const normalized = Object.fromEntries(
    ESCAPE_SURFACES.map((surface) => [surface, normalizeHandler(surface, handlers[surface])])
  );

  const dismiss = () => {
    for (const surface of ESCAPE_SURFACES) {
      const handler = normalized[surface];
      if (handler?.isActive()) {
        handler.dismiss();
        return surface;
      }
    }
    return null;
  };

  const handleKeydown = (event) => {
    if (!event || event.key !== "Escape" || event.defaultPrevented) return false;
    const surface = dismiss();
    if (surface === null) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    return surface;
  };

  return Object.freeze({ dismiss, handleKeydown });
}
