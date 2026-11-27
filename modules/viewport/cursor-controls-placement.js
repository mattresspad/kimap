/** Right-side settings use their own space; only the emergency fallback may cover the HUD. */
export function createCursorControlsPlacement({
  workspaceRect,
  usableRect = workspaceRect,
  anchorRect,
  surfaceBlockSize,
  chromeBlockSize,
  obstructions = [],
  narrow = false
}) {
  for (const rect of [workspaceRect, usableRect, anchorRect, ...obstructions]) {
    if (
      !rect ||
      ![rect.top, rect.right, rect.bottom, rect.left].every(Number.isFinite) ||
      rect.right < rect.left ||
      rect.bottom < rect.top
    )
      throw new TypeError("Cursor Controls needs finite, ordered rectangles.");
  }
  if (![surfaceBlockSize, chromeBlockSize].every((value) => Number.isFinite(value) && value >= 0))
    throw new TypeError("Cursor Controls sizes must be finite and nonnegative.");
  const width = Math.min(narrow ? 300 : 400, Math.max(0, usableRect.right - usableRect.left - 16));
  const left = Math.max(usableRect.left + 8, usableRect.right - 12 - width);
  let top = Math.max(usableRect.top + 8, anchorRect.bottom + 8);
  let bottom = usableRect.bottom - 8;
  // Top controls occupy the beginning of this column, not its lower boundary.
  for (const obstacle of [...obstructions].sort((a, b) => a.top - b.top)) {
    if (obstacle.right <= left || obstacle.left >= left + width || obstacle.bottom <= top) continue;
    if (obstacle.top <= top + 8) top = obstacle.bottom + 8;
    else bottom = Math.min(bottom, obstacle.top - 8);
  }
  const bounded = top < usableRect.top + 8 || bottom - top < chromeBlockSize + 96;
  if (bounded) {
    top = usableRect.top + 8;
    bottom = usableRect.bottom - 8;
  }
  return Object.freeze({
    mode: bounded ? "bounded" : "anchored",
    placement: bounded ? "bounded" : "below",
    left: left - workspaceRect.left,
    top: top - workspaceRect.top,
    width,
    availableBlockSize: Math.max(0, Math.min(surfaceBlockSize, bottom - top))
  });
}
