import { createBottomCenterPlacement, createFloatingProbePlacement } from "./report-placement.js";
import { createReportingInputTracker } from "./reporting-policy.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shared passive hover and held-point presentation. Subjects supply cached, read-only facts. */
export function createLocationReportingController({
  map,
  workspace,
  session,
  subjects,
  toPoint,
  getBounds,
  getObstructions = () => [],
  getHudRect = () => null,
  getProbeHeightCap = () => 320,
  onGeometryChange = null,
  onVisibleBoundsChange = null,
  isSuppressed,
  onPointer = () => {}
}) {
  const tooltip = element("div", "location-hover kimap-ui");
  tooltip.id = "location-hover-report";
  tooltip.hidden = true;
  tooltip.setAttribute("role", "tooltip");
  workspace.append(tooltip);
  const fixedHost = element("div", "location-probe-fixed kimap-ui");
  fixedHost.hidden = true;
  workspace.append(fixedHost);
  for (const type of ["click", "dblclick", "pointerdown", "mousedown", "wheel"])
    fixedHost.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
  let pointer = null;
  let moving = false;
  let hoverFrame = null;
  let dismissedKey = null;
  let hoverContent = null;
  let probe = null;
  let renderedProbe = null;
  let geometryFrame = null;
  const townTargets = new WeakMap();
  const input = createReportingInputTracker();
  const isProbePresented = () =>
    Boolean(probe && (probe.placement === "bottomCenter" || probe.popup.isOpen()));

  function getVisibleBounds() {
    const nodes = [];
    if (!tooltip.hidden) nodes.push(tooltip);
    if (isProbePresented())
      nodes.push(probe.placement === "bottomCenter" ? fixedHost : probe.popup.getElement());
    return nodes
      .filter((node) => node?.isConnected && !node.hidden)
      .map((node) => {
        const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
        return { left, top, right, bottom, width, height };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0);
  }
  function publishBounds() {
    // Invalidate only the passive consumer. It samples once in the shared geometry frame;
    // reading here would force layout for every pointer/movement event.
    onVisibleBoundsChange?.();
  }

  function notifyPointer(point) {
    try {
      onPointer(point);
    } catch {
      /* Widget failure must not disable location reports. */
    }
  }

  function readSubject(id, target, inputKind = "mouse", view = "tooltips") {
    const subject = subjects[id];
    try {
      const state = { ...subject.getState(target) };
      if (target.kind === "town" && !subject.supportsTowns) state.enabled = false;
      if (subject.nonTouchOnly && inputKind === "touch") {
        state.available = false;
        state.reason = `${subject.label} reports currently support a mouse or pointing device. Touch reports are deferred.`;
      }
      const report =
        state.enabled !== false && state.available
          ? target.kind === "town"
            ? subject.getReportForTown(target)
            : subject.getReportAtPoint(target.point)
          : null;
      const filter =
        id === "relations"
          ? session.getSnapshot()[
              view === "tooltips" ? "relationsTooltipFilter" : "relationsProbeFilter"
            ]
          : null;
      return {
        ...state,
        subject,
        report,
        filter,
        key: `${id}:${report?.geometryKey ?? (target.kind === "town" ? target.instanceId : "unavailable")}`
      };
    } catch {
      return {
        subject,
        enabled: true,
        available: false,
        report: null,
        key: `${id}:unavailable`,
        reason: `${subject.label} reporting is unavailable.`
      };
    }
  }

  function renderReading(reading, options) {
    try {
      if (reading.available)
        return reading.subject.render(reading.report, {
          ...options,
          filter: reading.filter ?? undefined,
          appearance: reading.appearance
        });
    } catch {
      /* Keep the report host and its actions operational. */
    }
    return element(
      "p",
      "location-report-note",
      reading.reason || `${reading.subject.label} reporting is unavailable.`
    );
  }

  function hideHover(clearPointer = false) {
    const wasVisible = !tooltip.hidden;
    tooltip.hidden = true;
    if (clearPointer) {
      pointer = null;
      notifyPointer(null);
    }
    if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
    hoverFrame = null;
    if (wasVisible) publishBounds();
  }

  function refreshHover() {
    hoverFrame = null;
    const state = session.getSnapshot();
    if (!pointer || moving || isProbePresented() || state.focusMap || isSuppressed())
      return hideHover(true);
    const bounds = getBounds();
    if (
      pointer.x < bounds.left ||
      pointer.x > bounds.right ||
      pointer.y < bounds.top ||
      pointer.y > bounds.bottom
    )
      return hideHover(true);
    notifyPointer(pointer.target.kind === "town" ? null : pointer.target.point);
    const id = state.tooltipSubject;
    const reading = readSubject(id, pointer.target);
    const detail = state[`${id}TooltipMode`];
    if (reading.key !== dismissedKey) dismissedKey = null;
    if (reading.enabled === false || detail === "hidden" || reading.key === dismissedKey)
      return hideHover();
    // Preserve Political's existing passive-hover failure behavior.
    if (id === "political" && !reading.report) return hideHover();
    const workspaceRect = workspace.getBoundingClientRect();
    const maxWidth = Math.max(0, bounds.right - bounds.left - 16);
    const pinned = state.tooltipPlacement === "bottomCenter";
    const width = Math.min(detail === "full" ? 380 : 290, maxWidth);
    const pinnedPlacement = pinned
      ? createBottomCenterPlacement({
          bounds,
          width,
          height: bounds.bottom - bounds.top,
          hudRect: getHudRect()
        })
      : null;
    const maxHeight =
      pinnedPlacement?.availableHeight ?? Math.max(0, bounds.bottom - bounds.top - 16);
    const completeHint =
      pointer.target.kind === "town"
        ? state.layoutClass === "narrow"
          ? "Click the town, then Open Context for faction and population details."
          : "Click the town for faction and population details in the Inspector."
        : state.pointProbeSubject === id
          ? "Click the map for the complete report."
          : `Select ${reading.subject.label} for Point Probe to read the complete report.`;
    tooltip.dataset.subject = id;
    tooltip.style.width = `${width}px`;
    tooltip.dataset.placement = pinned ? "bottomCenter" : "anchored";
    tooltip.hidden = false;
    if (
      !hoverContent ||
      hoverContent.id !== id ||
      hoverContent.report !== reading.report ||
      hoverContent.appearance !== reading.appearance ||
      hoverContent.reason !== reading.reason ||
      hoverContent.filter !== reading.filter ||
      hoverContent.mode !== detail ||
      hoverContent.width !== maxWidth ||
      hoverContent.height !== maxHeight ||
      hoverContent.completeHint !== completeHint
    ) {
      let mode = detail;
      let limit = reading.subject.hoverLimit?.(reading.report, mode) ?? 0;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        tooltip.replaceChildren(renderReading(reading, { mode, limit, hover: true, completeHint }));
        if (mode !== detail)
          tooltip.append(
            element(
              "p",
              "location-report-note",
              `Compact reading to fit this view. ${completeHint}`
            )
          );
        if (tooltip.getBoundingClientRect().height <= maxHeight) break;
        if (limit > 0) {
          limit -= 1;
          continue;
        }
        if (mode === "full") {
          mode = "reduced";
          continue;
        }
        return hideHover();
      }
      hoverContent = {
        id,
        report: reading.report,
        appearance: reading.appearance,
        reason: reading.reason,
        filter: reading.filter,
        mode: detail,
        width: maxWidth,
        height: maxHeight,
        completeHint
      };
    }
    const rect = tooltip.getBoundingClientRect();
    if (rect.height > maxHeight || width < 80) return hideHover();
    if (pinned) {
      const placement = createBottomCenterPlacement({
        bounds,
        width,
        height: rect.height,
        hudRect: getHudRect()
      });
      tooltip.style.left = `${placement.left - workspaceRect.left}px`;
      tooltip.style.top = `${placement.top - workspaceRect.top}px`;
      publishBounds();
      return;
    }
    let left = pointer.x + 18;
    let top = pointer.y + 18;
    if (left + rect.width > bounds.right - 8) left = pointer.x - rect.width - 18;
    if (top + rect.height > bounds.bottom - 8) top = pointer.y - rect.height - 18;
    tooltip.style.left = `${Math.max(bounds.left + 8, Math.min(left, bounds.right - rect.width - 8)) - workspaceRect.left}px`;
    tooltip.style.top = `${Math.max(bounds.top + 8, Math.min(top, bounds.bottom - rect.height - 8)) - workspaceRect.top}px`;
    publishBounds();
  }

  function scheduleHover() {
    if (hoverFrame === null)
      hoverFrame = requestAnimationFrame(() => {
        try {
          refreshHover();
        } catch {
          hideHover(true);
        }
      });
  }

  function blockedTarget(target) {
    if (townTarget(target) && subjects[session.getSnapshot().tooltipSubject]?.supportsTowns)
      return false;
    return (
      !(target instanceof Element) ||
      !map.getContainer().contains(target) ||
      Boolean(
        target.closest(
          ".leaflet-interactive, .leaflet-marker-icon, .leaflet-control, .leaflet-popup, button, input, select, a"
        )
      )
    );
  }
  function townTarget(target) {
    if (!(target instanceof Element) || !map.getContainer().contains(target)) return null;
    return townTargets.get(target.closest(".leaflet-marker-icon")) ?? null;
  }
  function trackTown(event, target) {
    input.observe(event);
    if (
      input.kind(event) === "touch" ||
      !subjects[session.getSnapshot().tooltipSubject]?.supportsTowns
    )
      return hideHover(true);
    pointer = { target, x: event.clientX, y: event.clientY };
    notifyPointer(null);
    scheduleHover();
  }
  map.on("mousemove", (event) => {
    const source = event.originalEvent;
    if (!source || input.kind(source) === "touch" || blockedTarget(source.target))
      return hideHover(true);
    const point = toPoint(event.latlng);
    if (!point) return hideHover(true);
    pointer = {
      target: townTarget(source.target) ?? { kind: "point", point },
      x: source.clientX,
      y: source.clientY
    };
    scheduleHover();
  });
  map.on("movestart zoomstart", () => {
    moving = true;
    hideHover(true);
  });
  map.on("moveend zoomend", () => {
    moving = false;
  });
  map.on("move zoom", () => {
    if (isProbePresented() && probe.placement !== "bottomCenter") publishBounds();
  });
  map.on("popupopen", () => hideHover(true));
  map.on("mouseout", () => hideHover(true));
  document.addEventListener(
    "pointermove",
    (event) => {
      input.observe(event);
      if (input.kind(event) === "touch" || blockedTarget(event.target)) hideHover(true);
    },
    true
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      input.observe(event);
      hideHover(true);
    },
    true
  );
  window.addEventListener("blur", () => hideHover(true));

  function updatePopup() {
    if (!probe?.popup.isOpen()) return;
    const autoPan = probe.popup.options.autoPan;
    const active = probe.content.contains(document.activeElement) ? document.activeElement : null;
    const scroll = probe.body.scrollTop;
    try {
      probe.popup.options.autoPan = false;
      probe.popup.update();
      active?.focus({ preventScroll: true });
      probe.body.scrollTop = scroll;
    } finally {
      probe.popup.options.autoPan = autoPan;
    }
  }

  function requestGeometry() {
    if (onGeometryChange) return onGeometryChange();
    if (geometryFrame !== null) return;
    geometryFrame = requestAnimationFrame(() => {
      geometryFrame = null;
      position();
    });
  }
  map.on("moveend zoomend resize", requestGeometry);

  function dismissProbe({ notify = true } = {}) {
    if (!probe) return false;
    const previous = probe;
    probe = null;
    renderedProbe = null;
    fixedHost.hidden = true;
    fixedHost.replaceChildren();
    if (previous.popup.isOpen()) previous.popup.remove();
    if (notify) previous.onDismiss();
    hideHover(true);
    publishBounds();
    return true;
  }

  function transferProbe({ initial = false } = {}) {
    if (!probe) return;
    const state = session.getSnapshot();
    const placement = state.phone ? "bottomCenter" : state.pointProbePlacement ?? "anchored";
    if (probe.placement === placement) return;
    const active = probe.content.contains(document.activeElement) ? document.activeElement : null;
    const scroll = probe.body.scrollTop;
    probe.transferring = true;
    try {
      if (placement === "bottomCenter") {
        // Detach the retained content before removing its Leaflet host.
        fixedHost.append(probe.content);
        fixedHost.hidden = false;
        if (probe.popup.isOpen()) probe.popup.remove();
      } else {
        fixedHost.hidden = true;
        probe.popup.setContent(probe.content);
        const autoPan = probe.popup.options.autoPan;
        try {
          probe.popup.options.autoPan = initial && autoPan !== false;
          probe.popup.openOn(map);
        } finally {
          probe.popup.options.autoPan = autoPan;
        }
      }
      probe.placement = placement;
      probe.content.dataset.placement = placement;
      active?.focus({ preventScroll: true });
      probe.body.scrollTop = scroll;
    } finally {
      probe.transferring = false;
    }
    hideHover(true);
    publishBounds();
  }

  function position() {
    if (!probe) {
      if (pointer) scheduleHover();
      return;
    }
    const pinned = probe.placement === "bottomCenter";
    if (!pinned && !probe.popup.isOpen()) return;
    // Leaflet transports a floating popup during pan/zoom. Refit once movement settles,
    // instead of repeatedly resetting its offset and competing with that transport.
    if (moving && !pinned) return;
    const node = pinned ? fixedHost : probe.popup.getElement();
    if (!node || (!pinned && !probe.popup.isOpen())) return;
    const bounds = getBounds();
    const workspaceRect = workspace.getBoundingClientRect();
    const scroll = probe.body.scrollTop;
    // Measuring from a fresh natural offset prevents cumulative sideways drift.
    if (!pinned) {
      probe.popup.options.offset = [...probe.baseOffset];
      updatePopup();
    }
    let rect = node.getBoundingClientRect();
    const hasBody = !probe.slot.hidden && probe.details.open;
    const chrome = rect.height - (hasBody ? probe.body.getBoundingClientRect().height : 0);
    const heightCap = getProbeHeightCap();
    const desiredHeight = Math.max(
      chrome,
      Math.min(heightCap, chrome + (hasBody ? probe.body.scrollHeight : 0))
    );
    const minimumHeight = chrome + (hasBody ? Math.min(32, probe.body.scrollHeight) : 0);
    let placement;
    if (pinned) {
      placement = createBottomCenterPlacement({
        bounds,
        width: rect.width,
        height: desiredHeight,
        minimumHeight,
        hudRect: getHudRect()
      });
      if (hasBody) probe.body.style.maxHeight = `${Math.max(0, placement.height - chrome)}px`;
      const height = node.getBoundingClientRect().height;
      placement = createBottomCenterPlacement({
        bounds,
        width: rect.width,
        height,
        minimumHeight,
        hudRect: getHudRect()
      });
      fixedHost.style.left = `${placement.left - workspaceRect.left}px`;
      fixedHost.style.top = `${placement.top - workspaceRect.top}px`;
      fixedHost.dataset.overlap = String(placement.overlap);
    } else {
      placement = createFloatingProbePlacement({
        bounds,
        anchorRect: { ...rect.toJSON(), height: desiredHeight, top: rect.bottom - desiredHeight },
        heightCap,
        chromeHeight: chrome,
        obstructions: getObstructions()
      });
      if (hasBody) probe.body.style.maxHeight = `${placement.bodyHeight}px`;
      updatePopup();
      rect = node.getBoundingClientRect();
      probe.popup.options.offset = [
        probe.baseOffset[0] + placement.left - rect.left,
        probe.baseOffset[1] + placement.top - rect.top
      ];
      updatePopup();
    }
    probe.body.scrollTop = scroll;
    publishBounds();
  }

  function renderProbe() {
    if (!probe) return;
    const state = session.getSnapshot();
    const id = state.pointProbeSubject;
    const reading = readSubject(
      id,
      { kind: "point", point: probe.point },
      probe.inputKind,
      "pointProbe"
    );
    const subjectChanged = renderedProbe?.id !== id;
    const wasHidden = probe.slot.hidden;
    probe.slot.hidden =
      reading.enabled === false || (id === "relations" && state.relationsProbeHidden);
    probe.slot.inert = probe.slot.hidden;
    if (probe.slot.hidden && probe.slot.contains(document.activeElement)) {
      probe.content.querySelector("button")?.focus({ preventScroll: true });
    }
    probe.slot.dataset.subject = id;
    probe.summary.textContent = `${reading.subject.label} report`;
    probe.body.setAttribute("aria-label", `Local ${reading.subject.label.toLowerCase()} report`);
    const expanded = state[`${id}ProbeExpanded`];
    const openChanged = probe.details.open !== expanded;
    if (openChanged) probe.details.open = expanded;
    if (
      subjectChanged ||
      renderedProbe.report !== reading.report ||
      renderedProbe.appearance !== reading.appearance ||
      renderedProbe.reason !== reading.reason ||
      renderedProbe.filter !== reading.filter
    ) {
      const scroll = subjectChanged ? 0 : probe.body.scrollTop;
      probe.body.replaceChildren(renderReading(reading, { mode: "full", hover: false }));
      probe.body.scrollTop = scroll;
      renderedProbe = {
        id,
        report: reading.report,
        appearance: reading.appearance,
        reason: reading.reason,
        filter: reading.filter
      };
      updatePopup();
    }
    if (wasHidden !== probe.slot.hidden || openChanged) updatePopup();
  }

  function refresh() {
    renderProbe();
    if (probe?.placement) transferProbe();
    requestGeometry();
    if (isProbePresented() || session.getSnapshot().focusMap || isSuppressed() || !pointer)
      hideHover(true);
    else scheduleHover();
  }

  return Object.freeze({
    refresh,
    position,
    dismissProbe,
    isProbePresented,
    getVisibleBounds,
    getProbeInputKind: (event) => input.kind(event),
    registerTownTarget(node, target) {
      if (!node || townTargets.has(node)) return;
      const retained = Object.freeze({
        kind: "town",
        entityId: target.entityId,
        instanceId: target.instanceId
      });
      townTargets.set(node, retained);
      const move = (event) => trackTown(event, retained);
      const leave = () => {
        if (pointer?.target === retained) hideHover(true);
      };
      node.addEventListener("pointermove", move);
      node.addEventListener("mousemove", move);
      node.addEventListener("mouseleave", leave);
      return () => {
        leave();
        townTargets.delete(node);
        node.removeEventListener("pointermove", move);
        node.removeEventListener("mousemove", move);
        node.removeEventListener("mouseleave", leave);
      };
    },
    presentProbe() {
      if (!probe) return;
      // Measure the actual retained view before Leaflet's first opening pan. The fixed host is
      // invisible only during this synchronous measurement; it is never a suppression sentinel.
      fixedHost.style.visibility = "hidden";
      fixedHost.hidden = false;
      fixedHost.append(probe.content);
      if (!probe.slot.hidden && probe.details.open) {
        const chrome =
          fixedHost.getBoundingClientRect().height - probe.body.getBoundingClientRect().height;
        probe.body.style.maxHeight = `${Math.max(0, getProbeHeightCap() - chrome)}px`;
      }
      fixedHost.hidden = true;
      fixedHost.style.removeProperty("visibility");
      transferProbe({ initial: true });
      position();
    },
    hideHover,
    isHoverVisible: () => !tooltip.hidden,
    dismissHover() {
      dismissedKey = pointer
        ? readSubject(session.getSnapshot().tooltipSubject, pointer.target).key
        : null;
      hideHover();
    },
    reset() {
      dismissProbe();
      dismissedKey = null;
      hideHover(true);
    },
    attachProbe(
      popup,
      point,
      slot,
      { content = slot.parentElement, onDismiss = () => {}, inputKind = "mouse" } = {}
    ) {
      // A replacement can have the same coordinates; disposal must not clear its point session.
      dismissProbe({ notify: false });
      const details = element("details", "location-probe-report");
      const summary = element("summary");
      const body = element("div", "location-probe-body");
      body.tabIndex = 0;
      body.setAttribute("role", "region");
      details.append(summary, body);
      slot.replaceChildren(details);
      const offset = popup.options.offset ?? [0, 7];
      probe = {
        popup,
        point,
        slot,
        details,
        summary,
        body,
        content,
        inputKind,
        onDismiss,
        baseOffset: [offset.x ?? offset[0] ?? 0, offset.y ?? offset[1] ?? 0],
        placement: null,
        transferring: false
      };
      renderedProbe = null;
      details.addEventListener("toggle", () => {
        if (probe?.popup !== popup) return;
        const state = session.getSnapshot();
        if (details.open !== state[`${state.pointProbeSubject}ProbeExpanded`])
          session.setReportProbeExpanded(state.pointProbeSubject, details.open);
        updatePopup();
        requestGeometry();
      });
      body.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
      popup.on("remove", () => {
        if (probe?.popup === popup && !probe.transferring) dismissProbe();
      });
      popup.on("add", requestGeometry);
      refresh();
    }
  });
}
