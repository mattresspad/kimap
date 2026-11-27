import { deepFreeze } from "../scenario/utils.js";
import { ViewportError } from "./errors.js";

export const VIEWPORT_LAYOUTS = Object.freeze(["wide", "standard", "narrow"]);

export const VIEWPORT_WORKBENCH_TOKENS = deepFreeze({
  leftDockWidth: 320,
  rightInspectorWidth: 360,
  minimumWideMapWidth: 640,
  minimumStandardMapWidth: 560,
  structuralGap: 0,
  wideMinimumWidth: 1320,
  standardMinimumWidth: 880,
  phoneMaximumWidth: 599,
  phoneLandscapeMaximumWidth: 1024,
  shortHeightThreshold: 620
});

function requireDimension(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ViewportError(
      "invalid_viewport_dimension",
      `${label} must be a finite, non-negative number.`,
      { [label]: value }
    );
  }
  return value;
}

export function classifyViewportLayout(width, height, { phoneLandscapeEligible = false } = {}) {
  requireDimension(width, "width");
  requireDimension(height, "height");

  const phone = width <= VIEWPORT_WORKBENCH_TOKENS.phoneMaximumWidth || (
    phoneLandscapeEligible === true &&
    width > height &&
    width <= VIEWPORT_WORKBENCH_TOKENS.phoneLandscapeMaximumWidth &&
    height <= VIEWPORT_WORKBENCH_TOKENS.phoneMaximumWidth
  );
  let layoutClass = "narrow";
  if (!phone && width >= VIEWPORT_WORKBENCH_TOKENS.wideMinimumWidth) {
    layoutClass = "wide";
  } else if (!phone && width >= VIEWPORT_WORKBENCH_TOKENS.standardMinimumWidth) {
    layoutClass = "standard";
  }

  return deepFreeze({
    layoutClass,
    phone,
    short: height < VIEWPORT_WORKBENCH_TOKENS.shortHeightThreshold
  });
}
