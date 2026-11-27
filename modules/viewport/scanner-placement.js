import { createMapControlsPlacement } from "./anchored-popover.js";
import { createRibbonRowFit } from "./scanner-ribbon.js";

/** Layout only: the widget never changes the remembered expansion or anchor preferences. */
export function createScannerWorkspacePlacement({
  workspaceRect,
  usableRect = workspaceRect,
  hudWidth,
  headerBlockSize,
  bodyBlockSize,
  controlsBlockSize,
  topObstructions = [],
  expanded,
  anchor = "right",
  narrow = false
}) {
  for (const value of [hudWidth, headerBlockSize, bodyBlockSize, controlsBlockSize]) {
    if (!Number.isFinite(value) || value < 0)
      throw new TypeError("Scanner sizes must be finite and nonnegative.");
  }
  if (!["left", "right"].includes(anchor)) throw new TypeError("Unknown Scanner anchor.");
  const initialControls = createMapControlsPlacement({
    workspaceRect,
    usableRect,
    contentBlockSize: controlsBlockSize,
    narrow
  });
  const width = Math.min(hudWidth, Math.max(0, usableRect.right - usableRect.left - 24));
  const left =
    (anchor === "left" ? usableRect.left + 12 : usableRect.right - 12 - width) - workspaceRect.left;
  const stacked =
    left < initialControls.left + initialControls.width + 8 &&
    left + width + 8 > initialControls.left;
  const clearTop = (x, size) =>
    Math.max(
      usableRect.top,
      ...topObstructions
        .filter(
          (rect) =>
            x + workspaceRect.left < rect.right + 8 && x + workspaceRect.left + size + 8 > rect.left
        )
        .map((rect) => rect.bottom - 4)
    );
  let hudTop = clearTop(left, width);
  let controlsTopEdge = clearTop(initialControls.left, initialControls.width);
  if (stacked) hudTop = controlsTopEdge = Math.max(hudTop, controlsTopEdge);
  const availableHeight = Math.max(0, usableRect.bottom - hudTop - 24);
  const controlsMinimum = Math.min(48, controlsBlockSize);
  const bodyHeight = expanded
    ? Math.min(
        bodyBlockSize,
        Math.max(0, availableHeight - headerBlockSize - (stacked ? controlsMinimum + 8 : 0))
      )
    : 0;
  const hudHeight = headerBlockSize + bodyHeight;
  const top = usableRect.bottom - workspaceRect.top - 12 - hudHeight;
  const controlsMaximum = Math.max(
    0,
    usableRect.bottom - controlsTopEdge - 24 - (stacked ? hudHeight + 8 : 0)
  );
  const controlsHeight = Math.min(controlsBlockSize, controlsMaximum);
  const controlsTop = narrow
    ? (stacked ? top - 8 : usableRect.bottom - workspaceRect.top - 12) - controlsHeight
    : controlsTopEdge - workspaceRect.top + 12;
  return Object.freeze({
    left,
    top,
    width,
    bodyHeight,
    stacked,
    // Height needed for the complete Scanner and a reachable control row above a sheet.
    minimumMapHeight:
      24 +
      (stacked
        ? hudTop -
          usableRect.top +
          headerBlockSize +
          (expanded ? bodyBlockSize : 0) +
          controlsMinimum +
          8
        : Math.max(
            hudTop - usableRect.top + headerBlockSize + (expanded ? bodyBlockSize : 0),
            controlsTopEdge - usableRect.top + controlsMinimum
          )),
    controls: Object.freeze({
      ...initialControls,
      top: controlsTop,
      availableBlockSize: controlsMaximum
    })
  });
}

const pixels = (element, property, value) => {
  const text = `${Math.max(0, value)}px`;
  if (element.style.getPropertyValue(property) !== text) element.style.setProperty(property, text);
};

function fitRibbon(container) {
  if (container.dataset.expanded === "true") return;
  const ribbon = container.querySelector(
    container.dataset.mode === "scorecard" ? ".wt-score-summary" : "#wt-summary"
  );
  const inlineWidth = (node) => {
    const children = [...node.children].filter(
      (child) => getComputedStyle(child).display !== "none"
    );
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    return (
      children.reduce((sum, child) => sum + Math.ceil(child.scrollWidth), 0) +
      Math.max(0, children.length - 1) * gap
    );
  };
  for (const row of ribbon.children) {
    row.dataset.fit = "full";
    const style = getComputedStyle(row);
    const availableWidth =
      row.clientWidth -
      (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0);
    let fullWidth;
    let minimumWidth;
    if (row.classList.contains("wt-ribbon-coordinates")) {
      fullWidth =
        Math.max(...[...row.children].map(inlineWidth)) * 2 + (parseFloat(style.columnGap) || 0);
      minimumWidth = fullWidth;
    } else {
      fullWidth = inlineWidth(row);
      row.dataset.fit = "compact";
      minimumWidth = inlineWidth(row);
      const name = row.querySelector(".wt-ribbon-name");
      if (name) minimumWidth -= Math.max(0, name.scrollWidth - 40);
    }
    row.dataset.fit = createRibbonRowFit({ availableWidth, fullWidth, minimumWidth });
  }
}

/** Synchronous intrinsic measurement, restored before paint; never changes session preferences. */
export function measureExpandedScannerHeight(container, hud) {
  if (!container || !hud) return 0;
  const expanded = container.dataset.expanded;
  const style = hud.getAttribute("style");
  try {
    hud.style.setProperty("display", "block", "important");
    hud.style.visibility = "hidden";
    container.dataset.expanded = "true";
    const borders = getComputedStyle(container);
    return Math.ceil(
      container.querySelector(".wt-header").getBoundingClientRect().height +
        container.querySelector("#wt-table").getBoundingClientRect().height +
        (parseFloat(borders.borderTopWidth) || 0) +
        (parseFloat(borders.borderBottomWidth) || 0)
    );
  } finally {
    container.dataset.expanded = expanded;
    if (style === null) hud.removeAttribute("style");
    else hud.setAttribute("style", style);
  }
}

/** Shares the application's observed geometry pass with chooser positioning. */
export function positionScannerWorkspace({
  workspace,
  root,
  hud,
  container,
  cluster,
  state,
  getUsableBounds
}) {
  const workspaceRect = workspace.getBoundingClientRect();
  const narrow = state.layoutClass === "narrow";
  if (!container || state.focusMap) {
    pixels(root, "--workbench-map-reserve", 60);
    const placement = createMapControlsPlacement({
      workspaceRect,
      usableRect: getUsableBounds(),
      contentBlockSize: cluster.scrollHeight,
      narrow
    });
    for (const key of ["left", "top", "width"]) pixels(cluster, key, placement[key]);
    pixels(cluster, "max-block-size", placement.availableBlockSize);
    return;
  }
  const expanded = container.dataset.expanded === "true";
  const desiredWidth = narrow ? 300 : 400;
  const usable = getUsableBounds();
  const width = Math.min(desiredWidth, Math.max(0, usable.right - usable.left - 24));
  pixels(container, "width", width);
  fitRibbon(container);
  const header = container.querySelector(".wt-header");
  const containerStyle = getComputedStyle(container);
  const headerSize =
    header.getBoundingClientRect().height +
    (parseFloat(containerStyle.borderTopWidth) || 0) +
    (parseFloat(containerStyle.borderBottomWidth) || 0);
  const tableHeight = container.querySelector("#wt-table").getBoundingClientRect().height;
  const input = {
    workspaceRect,
    hudWidth: width,
    headerBlockSize: headerSize,
    bodyBlockSize: Math.ceil(tableHeight),
    controlsBlockSize: cluster.scrollHeight,
    topObstructions: [...workspace.querySelectorAll("#map-navigation-stack, #map-tool-shelf")]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0),
    expanded,
    anchor: state.hudAnchor,
    narrow
  };
  const reservation = createScannerWorkspacePlacement({ ...input, usableRect: workspaceRect });
  const sheetHeaderSelector = state.effective.dockVisible
    ? "#dock-header"
    : state.effective.inspectorVisible
      ? "#info-panel-header"
      : null;
  const sheetHeader =
    narrow && sheetHeaderSelector ? root.querySelector(sheetHeaderSelector) : null;
  // Even in the emergency scrolling case, the sheet's minimize controls must stay reachable.
  const sheetMinimum = sheetHeader ? Math.ceil(sheetHeader.getBoundingClientRect().height) + 2 : 0;
  pixels(
    root,
    "--workbench-map-reserve",
    narrow
      ? Math.max(
          0,
          Math.min(Math.max(60, reservation.minimumMapHeight), workspaceRect.height - sheetMinimum)
        )
      : 60
  );
  // Reading after the reservation incorporates any sheet-height change in this same pass.
  const placement = createScannerWorkspacePlacement({ ...input, usableRect: getUsableBounds() });
  for (const key of ["left", "top", "width"]) pixels(hud, key, placement[key]);
  pixels(container, "--scanner-body-height", placement.bodyHeight);
  for (const key of ["left", "top", "width"]) pixels(cluster, key, placement.controls[key]);
  pixels(cluster, "max-block-size", placement.controls.availableBlockSize);
}
