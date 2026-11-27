/** Low-priority HUD fitting in client coordinates. No higher-priority surface consumes its result. */
export function createFactionColorsWidgetPlacement({
  bounds,
  anchorRect,
  obstructions = [],
  chromeHeight,
  bodyHeight,
  minimumBodyHeight = 24,
  rowHeight = 20,
  bodyPadding = 4,
  foldedHeight,
  foldedMinimumWidth
}) {
  const right = Math.min(anchorRect.left - 8, bounds.right - 8);
  const top = Math.max(anchorRect.top, bounds.top + 8);
  const roomWidth = Math.max(0, right - bounds.left - 8);
  const fit = (width, cap) => {
    let height = Math.min(cap, anchorRect.bottom - top, bounds.bottom - 8 - top);
    for (const rect of obstructions) {
      if (rect.right + 8 <= right - width || rect.left - 8 >= right || rect.bottom + 8 <= top)
        continue;
      height = Math.min(height, rect.top - 8 - top);
    }
    return Math.max(0, height);
  };
  for (const [mode, width, cap] of [
    ["normal", 200, anchorRect.bottom - top],
    ["shrunk", 140, 104]
  ]) {
    if (width > roomWidth) continue;
    const height = fit(width, cap);
    if (height >= chromeHeight + Math.min(minimumBodyHeight, bodyHeight)) {
      const outerHeight = Math.min(height, chromeHeight + bodyHeight);
      const completeRows = Math.floor(
        Math.max(0, outerHeight - chromeHeight - bodyPadding + 0.001) / rowHeight
      );
      return {
        mode,
        left: right - width,
        top,
        width,
        height: outerHeight,
        bodyHeight: Math.min(bodyHeight, completeRows * rowHeight + bodyPadding)
      };
    }
  }
  const width = Math.min(140, roomWidth);
  if (width >= foldedMinimumWidth && fit(width, foldedHeight) >= foldedHeight)
    return { mode: "folded", left: right - width, top, width, height: foldedHeight };
  return { mode: "hidden" };
}
