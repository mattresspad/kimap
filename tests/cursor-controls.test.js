import assert from "node:assert/strict";
import test from "node:test";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";
import { createCursorControlsPlacement } from "../modules/viewport/cursor-controls-placement.js";

test("Cursor Controls shares settings, retains its view and makes exact no-ops", () => {
  const session = new ViewportCompositionSession();
  assert.equal(session.getSnapshot().cursorControlsView, "tooltips");
  assert.equal(session.setCursorControlsView("tooltips"), false);
  assert.throws(() => session.setCursorControlsView("paintPlan"));
  assert.throws(() => new ViewportCompositionSession({ cursorControlsView: "unknown" }));
  session.openTransientSurface("worldViews");
  session.openTransientSurface("cursorControls");
  session.setCursorControlsView("pointProbe");
  session.setPoliticalTooltipMode("hidden");
  session.setPoliticalProbeExpanded(false);
  session.setHudAnchor("left");
  session.setHudExpanded("scanner", true);
  const before = session.getSnapshot();
  assert.equal(session.openTransientSurface("cursorControls"), false);
  session.openTransientSurface("paintIcons");
  assert.equal(session.getSnapshot().transientSurface, "paintIcons");
  session.openTransientSurface("cursorControls");
  session.enterFocusMap();
  const focused = session.getSnapshot();
  assert.equal(focused.transientSurface, null);
  for (const key of [
    "cursorControlsView",
    "politicalTooltipMode",
    "politicalProbeExpanded",
    "hudAnchor",
    "scannerExpanded"
  ])
    assert.equal(focused[key], before[key]);
  session.exitFocusMap();
  session.reset();
  const reset = session.getSnapshot();
  assert.equal(reset.cursorControlsView, "tooltips");
  assert.equal(reset.transientSurface, null);
  assert.equal(reset.politicalTooltipMode, "reduced");
  assert.equal(reset.politicalProbeExpanded, true);
});

test("Cursor Controls uses the narrow sheet handoff on opening and resize", () => {
  const session = new ViewportCompositionSession({ layoutClass: "narrow", inspectorOpen: true });
  session.openTransientSurface("cursorControls");
  assert.equal(session.getSnapshot().narrowActiveSheet, null);
  assert.equal(session.getSnapshot().dockOpen, false);
  assert.equal(session.getSnapshot().inspectorOpen, false);
  session.showDock();
  assert.equal(session.getSnapshot().transientSurface, null);
  session.setLayoutClass("wide", false);
  session.openTransientSurface("cursorControls");
  session.setLayoutClass("narrow", true);
  assert.equal(session.getSnapshot().narrowActiveSheet, null);
  assert.equal(session.getSnapshot().transientSurface, "cursorControls");
  session.showInspector();
  assert.equal(session.getSnapshot().transientSurface, null);
});

const workspaceRect = { left: 332, right: 1366, top: 56, bottom: 768 };
const anchorRect = { left: 1310, right: 1348, top: 166, bottom: 204 };
const input = { workspaceRect, anchorRect, surfaceBlockSize: 240, chromeBlockSize: 90 };

test("subjects retain independent detail without redirecting Political's synchronized setters", () => {
  const session = new ViewportCompositionSession();
  assert.equal(session.getSnapshot().tooltipSubject, "political");
  assert.equal(session.getSnapshot().pointProbeSubject, "political");
  assert.equal(session.setReportingSubject("tooltips", "political"), false);
  session.setReportingSubject("tooltips", "resources");
  session.setReportingSubject("pointProbe", "weather");
  session.setReportTooltipMode("resources", "full");
  session.setReportTooltipMode("weather", "hidden");
  session.setReportProbeExpanded("weather", false);
  session.setPoliticalTooltipMode("hidden");
  session.setPoliticalProbeExpanded(false);
  assert.equal(session.setReportTooltipMode("political", "hidden"), false);
  assert.equal(session.setReportProbeExpanded("political", false), false);
  const before = session.getSnapshot();
  assert.equal(session.setReportingSubject("tooltips", "resources"), false);
  assert.equal(session.setReportTooltipMode("resources", "full"), false);
  assert.equal(session.setReportTooltipMode("weather", "hidden"), false);
  assert.equal(session.setReportProbeExpanded("weather", false), false);
  assert.equal(session.getSnapshot(), before);
  assert.equal(before.tooltipSubject, "resources");
  assert.equal(before.pointProbeSubject, "weather");
  for (const change of [
    () => session.enterFocusMap(),
    () => session.exitFocusMap(),
    () => session.activatePoliticalReports()
  ]) {
    change();
    for (const field of [
      "tooltipSubject",
      "pointProbeSubject",
      "resourcesTooltipMode",
      "weatherTooltipMode",
      "weatherProbeExpanded",
      "politicalTooltipMode"
    ])
      assert.equal(session.getSnapshot()[field], before[field]);
  }
  session.setReportingSubject("tooltips", "weather");
  session.setReportingSubject("tooltips", "resources");
  assert.equal(session.getSnapshot().resourcesTooltipMode, "full");
  assert.throws(() => session.setReportingSubject("tooltips", "unreleased"));
  assert.throws(() => session.setReportingSubject("other", "weather"));
  assert.throws(() => session.setReportTooltipMode("resources", "bad"));
  assert.throws(() => session.setReportProbeExpanded("weather", "false"));
  assert.equal(session.getSnapshot().resourcesTooltipMode, "full");
  session.reset();
  const reset = session.getSnapshot();
  assert.equal(reset.tooltipSubject, "political");
  assert.equal(reset.pointProbeSubject, "political");
  for (const subject of ["political", "resources", "weather"]) {
    assert.equal(reset[`${subject}TooltipMode`], "reduced");
    assert.equal(reset[`${subject}ProbeExpanded`], true);
  }
});

test("manager remains right aligned below launcher and does not grow to fill space", () => {
  const result = createCursorControlsPlacement(input);
  assert.equal(result.width, 400);
  assert.equal(result.left + workspaceRect.left + result.width, workspaceRect.right - 12);
  assert.equal(result.top + workspaceRect.top, anchorRect.bottom + 8);
  assert.equal(result.availableBlockSize, 240);
  assert.equal(result.mode, "anchored");
  const leftHud = { left: 344, right: 744, top: 230, bottom: 750 };
  assert.deepEqual(createCursorControlsPlacement({ ...input, obstructions: [leftHud] }), result);
});

test("manager avoids an overlapping widget or controls until bounded fallback is necessary", () => {
  const obstruction = { left: 950, right: 1354, top: 420, bottom: 756 };
  const result = createCursorControlsPlacement({ ...input, obstructions: [obstruction] });
  assert.equal(result.mode, "anchored");
  assert.equal(result.availableBlockSize, 200);
  const blocked = createCursorControlsPlacement({
    ...input,
    obstructions: [{ ...obstruction, top: 380 }]
  });
  assert.equal(blocked.mode, "bounded");
  assert.equal(blocked.top, 8);
  assert.equal(blocked.availableBlockSize, 240);
  assert.deepEqual(input.workspaceRect, workspaceRect);
});

test("manager respects narrow usable space, sheets and short-height scrolling", () => {
  const narrow = createCursorControlsPlacement({ ...input, narrow: true });
  assert.equal(narrow.width, 300);
  const workspace = { left: 0, right: 290, top: 56, bottom: 270 };
  const result = createCursorControlsPlacement({
    ...input,
    workspaceRect: workspace,
    usableRect: { ...workspace, bottom: 250 },
    narrow: true,
    anchorRect: { left: 230, right: 268, top: 166, bottom: 204 }
  });
  assert.equal(result.width, 274);
  assert.equal(result.left, 8);
  assert.equal(result.mode, "bounded");
  assert.equal(result.top, 8);
  assert.equal(result.availableBlockSize, 178);
  assert.throws(() => createCursorControlsPlacement({ ...input, chromeBlockSize: NaN }));
});
