import assert from "node:assert/strict";
import test from "node:test";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";
import { createCursorControlsPlacement } from "../modules/viewport/cursor-controls-placement.js";
import {
  createBottomCenterPlacement,
  createFloatingProbePlacement,
  intersects
} from "../modules/viewport/report-placement.js";

test("placements are independent, no-op aware and retained until workspace reset", () => {
  const session = new ViewportCompositionSession();
  assert.equal(session.setReportPlacement("tooltips", "anchored"), false);
  session.setReportPlacement("tooltips", "bottomCenter");
  assert.equal(session.getSnapshot().pointProbePlacement, "anchored");
  session.setReportPlacement("pointProbe", "bottomCenter");
  session.setReportingSubject("pointProbe", "resources");
  session.activatePoliticalReports();
  session.enterFocusMap();
  session.exitFocusMap();
  session.showInspector();
  session.setLayoutClass("narrow", true);
  assert.equal(session.getSnapshot().tooltipPlacement, "bottomCenter");
  assert.equal(session.getSnapshot().pointProbePlacement, "bottomCenter");
  const held = session.getSnapshot();
  assert.equal(session.setReportPlacement("pointProbe", "bottomCenter"), false);
  assert.equal(session.getSnapshot(), held);
  assert.throws(() => session.setReportPlacement("tooltips", "elsewhere"));
  assert.throws(() => session.setReportPlacement("paint", "anchored"));
  assert.throws(() => new ViewportCompositionSession({ tooltipPlacement: "unknown" }));
  session.reset();
  assert.equal(session.getSnapshot().tooltipPlacement, "anchored");
  assert.equal(session.getSnapshot().pointProbePlacement, "anchored");
});

const bounds = { left: 332, right: 1544, top: 56, bottom: 964 };
test("a small top-control overlap moves Cursor Controls down, including after inspector resizing", () => {
  for (const right of [1544, 1366]) {
    const usable = { ...bounds, right };
    const result = createCursorControlsPlacement({
      workspaceRect: bounds,
      usableRect: usable,
      anchorRect: { left: right - 55, right: right - 7, top: 204, bottom: 252 },
      surfaceBlockSize: 360,
      chromeBlockSize: 96,
      obstructions: [{ left: 709, right: 1170, top: 68, bottom: 261 }]
    });
    assert.equal(result.mode, "anchored");
    assert.equal(result.top + bounds.top, 269);
    assert.equal(result.availableBlockSize, 360);
  }
});
test("bottom reports remain centered, stack above either HUD corner, and respect sheets", () => {
  for (const right of [1544, 1000])
    for (const anchor of ["left", "right"]) {
      const usable = { ...bounds, right, bottom: 760 };
      const hudRect = {
        left: anchor === "left" ? 344 : right - 412,
        right: anchor === "left" ? 744 : right - 12,
        top: 400,
        bottom: 748
      };
      const p = createBottomCenterPlacement({
        bounds: usable,
        width: 290,
        height: 320,
        minimumHeight: 180,
        hudRect
      });
      assert.equal(p.left + p.width / 2, (usable.left + right) / 2);
      assert.ok(p.bottom <= usable.bottom - 12);
      assert.ok(!intersects(p, hudRect));
      if (right === 1000) assert.equal(p.bottom, hudRect.top - 8);
    }
});
test("short pinned reports use bounded centered overlap without changing the HUD", () => {
  const hudRect = { left: 32, right: 432, top: 80, bottom: 348 };
  const original = { ...hudRect };
  const p = createBottomCenterPlacement({
    bounds: { left: 0, right: 480, top: 56, bottom: 360 },
    width: 290,
    height: 300,
    minimumHeight: 180,
    hudRect
  });
  assert.equal(p.overlap, true);
  assert.equal(p.left, 95);
  assert.equal(p.top, 64);
  assert.equal(p.bottom, 348);
  assert.deepEqual(hudRect, original);
});
test("floating fit uses actual intersections, caps whole height and recomputes from anchor", () => {
  const input = {
    bounds,
    anchorRect: { left: 720, right: 1010, top: 400, bottom: 900, width: 290, height: 500 },
    heightCap: 320,
    chromeHeight: 180
  };
  const plain = createFloatingProbePlacement(input);
  assert.equal(plain.height, 320);
  assert.equal(plain.bodyHeight, 140);
  const above = { left: 710, right: 1170, top: 68, bottom: 261 };
  assert.deepEqual(createFloatingProbePlacement({ ...input, obstructions: [above] }), plain);
  const intersecting = { left: 710, right: 1170, top: 400, bottom: 600 };
  const fit = createFloatingProbePlacement({ ...input, obstructions: [intersecting] });
  assert.equal(fit.left, plain.left);
  assert.equal(fit.top, 608);
  assert.ok(!intersects(fit, intersecting));
  assert.deepEqual(createFloatingProbePlacement({ ...input, obstructions: [intersecting] }), fit);
});

test("floating clearance never reenters an earlier obstacle while avoiding a later one", () => {
  const obstacles = [
    { left: 710, right: 1170, top: 68, bottom: 261 },
    { left: 710, right: 1170, top: 450, bottom: 956 }
  ];
  const p = createFloatingProbePlacement({
    bounds,
    anchorRect: { left: 720, right: 1010, top: 235, bottom: 550, width: 290, height: 315 },
    heightCap: 320,
    chromeHeight: 180,
    obstructions: obstacles
  });
  assert.ok(obstacles.every((o) => !intersects(p, o)));
  assert.ok(p.height <= 320);
});
