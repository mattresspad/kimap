export const CHOOSER_AUTO_HIDE_DELAY = 1200;

/** A timer owns no presentation state: eligibility is read again at expiry. */
export function createChooserAutoHide({
  readState,
  onDismiss,
  setTimer = globalThis.setTimeout.bind(globalThis),
  clearTimer = globalThis.clearTimeout.bind(globalThis)
}) {
  let timer = null;
  let generation = 0;
  let previousPresented = false;
  let previousPinned = false;
  const eligible = (state) =>
    state.presented &&
    !state.pinned &&
    state.pointerEligible &&
    !state.pointerInside &&
    !state.keyboardInside;
  const cancel = () => {
    generation++;
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const refresh = () => {
    const state = readState();
    if (state.presented !== previousPresented || state.pinned !== previousPinned) cancel();
    previousPresented = state.presented;
    previousPinned = state.pinned;
    if (!eligible(state)) {
      cancel();
      return;
    }
    if (timer !== null) return;
    const token = ++generation;
    timer = setTimer(() => {
      if (generation !== token) return;
      timer = null;
      if (eligible(readState())) onDismiss();
    }, CHOOSER_AUTO_HIDE_DELAY);
  };
  return { refresh, cancel };
}

/** The launcher frame and panel are separate DOM hosts but one pointer/focus region. */
export function bindChooserAutoHide({ launcherFrame, panel, isPresented, isPinned, onDismiss }) {
  const doc = panel.ownerDocument;
  let point = null;
  let pointerEligible = false;
  let modality = "unknown";
  const contains = (node) =>
    Boolean(node && (launcherFrame?.contains(node) || panel.contains(node)));
  const over = (element) => {
    if (!point || !element || element.getClientRects().length === 0) return false;
    const rect = element.getBoundingClientRect();
    return (
      point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
    );
  };
  const controller = createChooserAutoHide({
    readState: () => {
      const presented = isPresented();
      return {
        presented,
        pinned: isPinned(),
        pointerEligible,
        // Hidden choosers track input provenance without measuring layout on map movement.
        pointerInside: presented && (over(launcherFrame) || over(panel)),
        keyboardInside: presented && modality === "keyboard" && contains(doc.activeElement)
      };
    },
    onDismiss
  });
  const pointer = (event) => {
    modality = event.pointerType === "touch" ? "touch" : "pointer";
    pointerEligible = event.pointerType !== "touch";
    point = { x: event.clientX, y: event.clientY };
    controller.refresh();
  };
  const leave = () => {
    point = null;
    controller.refresh();
  };
  const keyboard = (event) => {
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    modality = "keyboard";
    controller.refresh();
  };
  const focus = () => queueMicrotask(controller.refresh);
  const listeners = [
    ["pointermove", pointer],
    ["pointerdown", pointer],
    ["pointerleave", leave],
    ["keydown", keyboard],
    ["focusin", focus],
    ["focusout", focus]
  ];
  for (const [name, handler] of listeners) {
    doc.addEventListener(name, handler, { capture: name !== "pointerleave", passive: true });
  }
  return {
    refresh: controller.refresh,
    destroy() {
      controller.cancel();
      for (const [name, handler] of listeners) {
        doc.removeEventListener(name, handler, name !== "pointerleave");
      }
    }
  };
}
