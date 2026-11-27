/** Client-coordinate geometry shared by fixed and Leaflet-hosted location reports. */
const clamp = (value, low, high) => Math.max(low, Math.min(value, Math.max(low, high)));
export function intersects(a, b, gap = 0) {
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  );
}
const rectangle = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height
});

export function createBottomCenterPlacement({
  bounds,
  width,
  height,
  minimumHeight = 0,
  hudRect = null
}) {
  width = Math.min(width, Math.max(0, bounds.right - bounds.left - 16));
  const left = (bounds.left + bounds.right - width) / 2;
  const topEdge = bounds.top + 8;
  const bottom = bounds.bottom - 12;
  let availableHeight = Math.max(0, bottom - topEdge);
  let edge = bottom;
  if (
    hudRect &&
    intersects(
      rectangle(
        left,
        bottom - Math.min(height, availableHeight),
        width,
        Math.min(height, availableHeight)
      ),
      hudRect,
      8
    )
  ) {
    const above = Math.max(0, hudRect.top - 8 - topEdge);
    if (above >= minimumHeight) {
      edge = hudRect.top - 8;
      availableHeight = above;
    }
    // Emergency overlap remains centered and bounded; the HUD's state never changes.
  }
  const fittedHeight = Math.min(height, availableHeight);
  const rect = rectangle(left, Math.max(topEdge, edge - fittedHeight), width, fittedHeight);
  return Object.freeze({
    ...rect,
    availableHeight,
    overlap: Boolean(hudRect && intersects(rect, hudRect))
  });
}

/** Recompute from the point's natural popup rectangle, never from a previous correction. */
export function createFloatingProbePlacement({
  bounds,
  anchorRect,
  heightCap,
  chromeHeight,
  obstructions = []
}) {
  const width = Math.min(anchorRect.width, Math.max(0, bounds.right - bounds.left - 16));
  const minHeight = chromeHeight + Math.min(32, Math.max(0, anchorRect.height - chromeHeight));
  const height = Math.max(
    minHeight,
    Math.min(anchorRect.height, heightCap, bounds.bottom - bounds.top - 16)
  );
  const rect = rectangle(
    clamp(anchorRect.left, bounds.left + 8, bounds.right - width - 8),
    clamp(anchorRect.bottom - height, bounds.top + 8, bounds.bottom - height - 8),
    width,
    height
  );
  if (!obstructions.some((obstacle) => intersects(rect, obstacle)))
    return Object.freeze({ ...rect, bodyHeight: Math.max(0, rect.height - chromeHeight) });
  const fitColumn = (left) => {
    const obstacles = obstructions
      .filter((o) => o.right + 8 > left && o.left - 8 < left + width)
      .sort((a, b) => a.top - b.top);
    const gaps = [];
    let top = bounds.top + 8;
    for (const obstacle of obstacles) {
      const bottom = Math.min(bounds.bottom - 8, obstacle.top - 8);
      if (bottom > top) gaps.push({ top, bottom });
      top = Math.max(top, obstacle.bottom + 8);
    }
    if (top < bounds.bottom - 8) gaps.push({ top, bottom: bounds.bottom - 8 });
    return (
      gaps
        .filter((gap) => gap.bottom - gap.top >= minHeight)
        .map((gap) => {
          const size = Math.min(
            height,
            gap.bottom - gap.top,
            Math.max(minHeight, rect.bottom - gap.top)
          );
          const bottom = clamp(rect.bottom, gap.top + size, gap.bottom);
          const candidate = rectangle(left, bottom - size, width, size);
          return { ...candidate, cost: Math.abs(rect.bottom - bottom) * 2 + height - size };
        })
        .sort((a, b) => a.cost - b.cost || a.top - b.top)[0] ?? null
    );
  };
  let fitted = fitColumn(rect.left);
  if (!fitted) {
    // Sideways movement is the last usable-space choice; recheck the complete column so moving
    // away from one control cannot put the report into a previously cleared control.
    const alternatives = [
      ...new Set(obstructions.flatMap((o) => [o.left - width - 8, o.right + 8]))
    ]
      .filter((left) => left >= bounds.left + 8 && left + width <= bounds.right - 8)
      .sort((a, b) => Math.abs(a - rect.left) - Math.abs(b - rect.left));
    for (const left of alternatives) {
      fitted = fitColumn(left);
      if (fitted) break;
    }
  }
  const result = fitted ?? rect;
  return Object.freeze({
    ...rectangle(result.left, result.top, width, result.height),
    bodyHeight: Math.max(0, result.height - chromeHeight)
  });
}
