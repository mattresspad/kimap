function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label} must be a function.`);
  return value;
}

export function createTimedStatusController({
  render,
  setTimer = globalThis.setTimeout.bind(globalThis),
  clearTimer = globalThis.clearTimeout.bind(globalThis)
} = {}) {
  requireFunction(render, "render");
  requireFunction(setTimer, "setTimer");
  requireFunction(clearTimer, "clearTimer");

  let timer = null;
  let generation = 0;

  const cancelPending = () => {
    generation += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const clear = () => {
    cancelPending();
    render("", "info");
  };

  const show = (message, { level = "info", timeout = 0, onExpire = null } = {}) => {
    if (typeof message !== "string") throw new TypeError("Status message must be a string.");
    if (typeof level !== "string" || level === "") {
      throw new TypeError("Status level must be a non-empty string.");
    }
    if (!Number.isFinite(timeout) || timeout < 0) {
      throw new TypeError("Status timeout must be a non-negative finite number.");
    }
    if (onExpire !== null) requireFunction(onExpire, "onExpire");

    cancelPending();
    render(message, level);
    if (!message || timeout === 0) return false;

    const activeGeneration = generation;
    timer = setTimer(() => {
      if (activeGeneration !== generation) return;
      timer = null;
      render("", "info");
      onExpire?.();
    }, timeout);
    return true;
  };

  const destroy = () => {
    cancelPending();
  };

  return Object.freeze({ show, clear, destroy });
}
