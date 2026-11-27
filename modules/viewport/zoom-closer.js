import { deepFreeze } from "../scenario/utils.js";

function finiteDimension(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function createZoomCloserPlan({
  currentZoom,
  maxZoom,
  workspaceRect,
  occlusionRects = [],
  gap = 12,
  reducedMotion = false
}) {
  if (!Number.isFinite(currentZoom) || !Number.isFinite(maxZoom)) {
    throw new TypeError("Zoom Closer requires finite current and maximum zoom levels.");
  }
  const targetZoom = Math.min(Math.floor(currentZoom) + 1, maxZoom);
  return createPanelAwarePlan({
    enabled: targetZoom > currentZoom,
    targetZoom,
    workspaceRect,
    occlusionRects,
    gap,
    reducedMotion
  });
}

export function createAreaZoomPlan({
  minZoom,
  maxZoom,
  targetZoom = 0,
  workspaceRect,
  occlusionRects = [],
  gap = 12,
  reducedMotion = false
}) {
  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom) || !Number.isFinite(targetZoom)) {
    throw new TypeError("Area Zoom requires finite minimum, maximum, and target zoom levels.");
  }
  if (minZoom > maxZoom) {
    throw new TypeError("Area Zoom minimum cannot exceed its maximum.");
  }
  return createPanelAwarePlan({
    enabled: true,
    targetZoom: Math.min(Math.max(Math.trunc(targetZoom), minZoom), maxZoom),
    workspaceRect,
    occlusionRects,
    gap,
    reducedMotion
  });
}

function createPanelAwarePlan({
  enabled,
  targetZoom,
  workspaceRect,
  occlusionRects,
  gap,
  reducedMotion
}) {
  const workspace = workspaceRect ?? { left: 0, top: 0, right: 0, bottom: 0 };
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;

  for (const rect of occlusionRects) {
    if (!rect) continue;
    const overlapsVertically = rect.bottom > workspace.top && rect.top < workspace.bottom;
    const overlapsHorizontally = rect.right > workspace.left && rect.left < workspace.right;
    const candidates = [];
    if (overlapsVertically && rect.left <= workspace.left) {
      candidates.push(["left", finiteDimension(rect.right - workspace.left)]);
    }
    if (overlapsVertically && rect.right >= workspace.right) {
      candidates.push(["right", finiteDimension(workspace.right - rect.left)]);
    }
    if (overlapsHorizontally && rect.top <= workspace.top) {
      candidates.push(["top", finiteDimension(rect.bottom - workspace.top)]);
    }
    if (overlapsHorizontally && rect.bottom >= workspace.bottom) {
      candidates.push(["bottom", finiteDimension(workspace.bottom - rect.top)]);
    }
    const nearestEdge = candidates
      .filter(([, amount]) => amount > 0)
      .sort((leftCandidate, rightCandidate) => leftCandidate[1] - rightCandidate[1])[0];
    if (nearestEdge) {
      if (nearestEdge[0] === "left") left = Math.max(left, nearestEdge[1]);
      if (nearestEdge[0] === "right") right = Math.max(right, nearestEdge[1]);
      if (nearestEdge[0] === "top") top = Math.max(top, nearestEdge[1]);
      if (nearestEdge[0] === "bottom") bottom = Math.max(bottom, nearestEdge[1]);
    }
  }

  return deepFreeze({
    enabled,
    targetZoom,
    animate: !reducedMotion,
    paddingTopLeft: { x: left + gap, y: top + gap },
    paddingBottomRight: { x: right + gap, y: bottom + gap }
  });
}
