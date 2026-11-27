const ALIGNMENTS = Object.freeze(["start", "center", "end"]);
const PLACEMENTS = Object.freeze(["above", "below"]);

function requireFinite(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

function normalizeRect(rect, label) {
  if (!rect || typeof rect !== "object") {
    throw new TypeError(`${label} must be a rectangle.`);
  }

  const left = requireFinite(rect.left, `${label}.left`);
  const top = requireFinite(rect.top, `${label}.top`);
  const right = requireFinite(rect.right, `${label}.right`);
  const bottom = requireFinite(rect.bottom, `${label}.bottom`);
  if (right < left || bottom < top) {
    throw new TypeError(`${label} bounds are inverted.`);
  }

  return Object.freeze({ left, top, right, bottom });
}

function normalizeSize(size) {
  if (!size || typeof size !== "object") {
    throw new TypeError("surfaceSize must be an object.");
  }
  const width = requireFinite(size.width, "surfaceSize.width");
  const height = requireFinite(size.height, "surfaceSize.height");
  if (width < 0 || height < 0) {
    throw new TypeError("surfaceSize dimensions cannot be negative.");
  }
  return Object.freeze({ width, height });
}

function clamp(value, minimum, maximum) {
  if (maximum < minimum) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

export function createAnchoredPopoverPlacement({
  anchorRect,
  workspaceRect,
  surfaceSize,
  preferredPlacement = "below",
  alignment = "end",
  gap = 8,
  padding = 8
}) {
  const anchor = normalizeRect(anchorRect, "anchorRect");
  const workspace = normalizeRect(workspaceRect, "workspaceRect");
  const surface = normalizeSize(surfaceSize);
  if (!PLACEMENTS.includes(preferredPlacement)) {
    throw new TypeError(`preferredPlacement must be one of: ${PLACEMENTS.join(", ")}.`);
  }
  if (!ALIGNMENTS.includes(alignment)) {
    throw new TypeError(`alignment must be one of: ${ALIGNMENTS.join(", ")}.`);
  }
  requireFinite(gap, "gap");
  requireFinite(padding, "padding");
  if (gap < 0 || padding < 0) {
    throw new TypeError("gap and padding cannot be negative.");
  }

  const workspaceTop = workspace.top + padding;
  const workspaceBottom = workspace.bottom - padding;
  const availableBelow = Math.max(0, workspaceBottom - anchor.bottom - gap);
  const availableAbove = Math.max(0, anchor.top - gap - workspaceTop);
  const preferredAvailable = preferredPlacement === "below" ? availableBelow : availableAbove;
  const alternateAvailable = preferredPlacement === "below" ? availableAbove : availableBelow;
  const placement =
    preferredAvailable >= surface.height || preferredAvailable >= alternateAvailable
      ? preferredPlacement
      : preferredPlacement === "below"
        ? "above"
        : "below";
  const availableBlockSize = placement === "below" ? availableBelow : availableAbove;
  const renderedHeight = Math.min(surface.height, availableBlockSize);

  let viewportLeft;
  if (alignment === "start") viewportLeft = anchor.left;
  else if (alignment === "center") {
    viewportLeft = anchor.left + (anchor.right - anchor.left - surface.width) / 2;
  } else viewportLeft = anchor.right - surface.width;

  viewportLeft = clamp(
    viewportLeft,
    workspace.left + padding,
    workspace.right - padding - surface.width
  );
  const viewportTop =
    placement === "below"
      ? anchor.bottom + gap
      : Math.max(workspaceTop, anchor.top - gap - renderedHeight);

  return Object.freeze({
    placement,
    left: viewportLeft - workspace.left,
    top: viewportTop - workspace.top,
    availableBlockSize
  });
}

/** Largest remaining rectangle after structural panels occlude the workspace. */
export function createUsableMapBounds({ workspaceRect, occlusions = [] }) {
  let bounds = normalizeRect(workspaceRect, "workspaceRect");
  for (const rect of occlusions) {
    const panel = normalizeRect(rect, "occlusion");
    const left = Math.max(bounds.left, panel.left);
    const right = Math.min(bounds.right, panel.right);
    const top = Math.max(bounds.top, panel.top);
    const bottom = Math.min(bounds.bottom, panel.bottom);
    if (left >= right || top >= bottom) continue;
    const candidates = [
      { ...bounds, right: left },
      { ...bounds, left: right },
      { ...bounds, bottom: top },
      { ...bounds, top: bottom }
    ];
    const area = (candidate) =>
      (candidate.right - candidate.left) * (candidate.bottom - candidate.top);
    bounds = candidates.reduce((best, candidate) =>
      area(candidate) > area(best) ? candidate : best
    );
  }
  return Object.freeze(bounds);
}

/** Clamp the complete flow cluster; very short free space scrolls, never shrinks its rows. */
export function createMapControlsPlacement({
  workspaceRect,
  usableRect = workspaceRect,
  contentBlockSize,
  narrow = false
}) {
  const workspace = normalizeRect(workspaceRect, "workspaceRect");
  const usable = normalizeRect(usableRect, "usableRect");
  requireFinite(contentBlockSize, "contentBlockSize");
  if (contentBlockSize < 0) throw new TypeError("contentBlockSize cannot be negative.");
  const availableWidth = Math.max(0, usable.right - usable.left);
  const availableHeight = Math.max(0, usable.bottom - usable.top);
  const inlinePadding = Math.min(12, availableWidth / 2);
  const blockPadding = Math.min(12, Math.max(0, (availableHeight - 48) / 2));
  const width = Math.min(240, availableWidth - inlinePadding * 2);
  const availableBlockSize = Math.max(0, availableHeight - blockPadding * 2);
  const height = Math.min(contentBlockSize, availableBlockSize);
  return Object.freeze({
    left:
      (narrow ? usable.right - inlinePadding - width : usable.left + inlinePadding) -
      workspace.left,
    top:
      (narrow ? usable.bottom - blockPadding - height : usable.top + blockPadding) - workspace.top,
    width,
    availableBlockSize
  });
}

/** Layers may use the whole usable map when an anchored header and three rows cannot fit. */
export function createLayersPopoverPlacement({
  anchorRect,
  workspaceRect,
  usableRect = workspaceRect,
  surfaceBlockSize,
  headerBlockSize,
  optionBlockSize,
  hudRects = [],
  narrow = false
}) {
  const workspace = normalizeRect(workspaceRect, "workspaceRect");
  const usable = normalizeRect(usableRect, "usableRect");
  const anchor = normalizeRect(anchorRect, "anchorRect");
  for (const [name, value] of Object.entries({
    surfaceBlockSize,
    headerBlockSize,
    optionBlockSize
  })) {
    requireFinite(value, name);
    if (value < 0) throw new TypeError(`${name} cannot be negative.`);
  }
  const width = Math.min(240, Math.max(0, usable.right - usable.left - 16));
  const placeWithin = (bounds) =>
    createAnchoredPopoverPlacement({
      anchorRect: anchor,
      workspaceRect: bounds,
      surfaceSize: { width, height: surfaceBlockSize },
      preferredPlacement: narrow ? "above" : "below",
      alignment: narrow ? "end" : "start",
      gap: 8,
      padding: 8
    });
  const containsAnchor = (bounds) =>
    anchor.top >= bounds.top &&
    anchor.bottom <= bounds.bottom &&
    anchor.left >= bounds.left &&
    anchor.right <= bounds.right;
  const overlaps = (first, second) =>
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top;
  const panelRect = (placement, bounds) => ({
    left: bounds.left + placement.left,
    right: bounds.left + placement.left + width,
    top: bounds.top + placement.top,
    bottom: bounds.top + placement.top + Math.min(surfaceBlockSize, placement.availableBlockSize)
  });
  const minimumBlockSize = headerBlockSize + optionBlockSize * 3 + 12;
  const initial = placeWithin(usable);
  let bounds = usable;
  let anchored = initial;
  let bounded = !containsAnchor(bounds) || anchored.availableBlockSize < minimumBlockSize;
  const huds = hudRects.map((rect) => normalizeRect(rect, "hudRect"));
  if (!bounded) {
    // Preserve inline alignment; shorten or flip the list around an overlapping Scanner.
    for (const hud of huds) {
      if (!overlaps(panelRect(anchored, bounds), hud)) continue;
      if (hud.top >= anchor.bottom)
        bounds = { ...bounds, bottom: Math.min(bounds.bottom, hud.top) };
      else if (hud.bottom <= anchor.top)
        bounds = { ...bounds, top: Math.max(bounds.top, hud.bottom) };
      else {
        bounded = true;
        break;
      }
      anchored = placeWithin(bounds);
      bounded = !containsAnchor(bounds) || anchored.availableBlockSize < minimumBlockSize;
      if (bounded) break;
    }
    bounded ||= huds.some((hud) => overlaps(panelRect(anchored, bounds), hud));
  }
  return Object.freeze({
    mode: bounded ? "bounded" : "anchored",
    placement: bounded ? "bounded" : anchored.placement,
    left: bounded
      ? initial.left + usable.left - workspace.left
      : anchored.left + bounds.left - workspace.left,
    top: bounded ? 8 + usable.top - workspace.top : anchored.top + bounds.top - workspace.top,
    width,
    availableBlockSize: bounded
      ? Math.max(0, usable.bottom - usable.top - 16)
      : anchored.availableBlockSize
  });
}
