import assert from "node:assert/strict";
import test from "node:test";
import { createScannerReading } from "../modules/viewport/scanner.js";
import { createRibbonRowFit } from "../modules/viewport/scanner-ribbon.js";
import { createScannerWorkspacePlacement } from "../modules/viewport/scanner-placement.js";
import { createLayersPopoverPlacement } from "../modules/viewport/anchored-popover.js";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";

test("Scanner keeps fixed zero, positive, unavailable and hazard readings distinct", () => {
  const input = {
    spawnArea: { Name: "<img> area" },
    biome: { Name: "Long biome" },
    resources: {
      Values: {
        arid: 1,
        green: 0,
        swamp: 0.25,
        "copper mult": 0.01,
        "iron mult": 1234567.8,
        "stone mult": -1,
        "water mult": NaN
      }
    },
    effects: ["Acidic Ground", "Gas", "Burning"]
  };
  const reading = createScannerReading(input);
  assert.equal(reading.spawn, "<img> area");
  assert.equal(reading.values.arid.text, "100");
  assert.deepEqual(reading.values.green, { text: "0", state: "inactive" });
  assert.equal(reading.values.swamp.text, "25");
  assert.equal(reading.values["copper mult"].text, "<0.1");
  assert.equal(reading.values["iron mult"].text, "1234567.8");
  assert.equal(reading.values["stone mult"].state, "unavailable");
  assert.equal(reading.values["water mult"].state, "unavailable");
  assert.equal(reading.values.Gas.text, "Recorded");
  assert.equal(reading.values["Acid Rain"].text, "Not recorded");
  assert.equal(reading.values["Acidic Ground"].text, "Recorded");
  assert.equal(createScannerReading({ spawnArea: {} }).values.Gas.text, "Not recorded");
  assert.equal(createScannerReading().values.Gas.state, "unavailable");
  assert.equal(createScannerReading().values.arid.text, "—");
  assert.equal(
    createScannerReading({ resources: { Values: { arid: 0.001 } } }).values.arid.text,
    "<1"
  );
  assert.equal(
    createScannerReading({ resources: { Values: { arid: Number.MAX_VALUE } } }).values.arid.state,
    "unavailable"
  );
  assert.throws(() => {
    reading.values.arid.text = "0";
  }, TypeError);
});

test("compact rows shorten independently and never lose protected coordinates or percentages", () => {
  const leader = { fullWidth: 214, minimumWidth: 90 };
  assert.equal(createRibbonRowFit({ ...leader, availableWidth: 214 }), "full");
  assert.equal(createRibbonRowFit({ ...leader, availableWidth: 213.9 }), "compact");
  assert.equal(createRibbonRowFit({ ...leader, availableWidth: 90 }), "compact");
  assert.equal(createRibbonRowFit({ ...leader, availableWidth: 89.9 }), "hidden");
  const coords = { fullWidth: 160, minimumWidth: 160 };
  assert.equal(createRibbonRowFit({ ...coords, availableWidth: 160 }), "full");
  assert.equal(createRibbonRowFit({ ...coords, availableWidth: 159.9 }), "hidden");
  assert.equal(createRibbonRowFit({ ...leader, availableWidth: 159.9 }), "compact");
});

test("the shared corner survives presentation changes and resets without domain state", () => {
  const session = new ViewportCompositionSession();
  let notifications = 0;
  session.subscribe(() => notifications++);
  assert.equal(session.setHudAnchor("right"), false);
  assert.equal(notifications, 0);
  session.setHudAnchor("left");
  session.setHudExpanded("scanner", true);
  session.activatePoliticalReports();
  session.setHudMode("scanner");
  session.enterFocusMap();
  session.exitFocusMap();
  session.setLayoutClass("narrow", true);
  assert.equal(session.getSnapshot().hudAnchor, "left");
  assert.equal(session.getSnapshot().scannerExpanded, true);
  assert.equal(session.getSnapshot().scorecardExpanded, true);
  const before = session.getSnapshot();
  assert.throws(() => session.setHudAnchor("top"));
  assert.equal(session.getSnapshot(), before);
  session.reset({ hudMode: "scorecard" });
  assert.equal(session.getSnapshot().hudAnchor, "right");
  assert.equal(session.getSnapshot().hudMode, "scorecard");
  assert.equal(session.getSnapshot().scorecardExpanded, false);
});

const place = (options) =>
  createScannerWorkspacePlacement({
    workspaceRect: { left: 320, top: 56, right: 1600, bottom: 1000 },
    hudWidth: 400,
    headerBlockSize: 40,
    bodyBlockSize: 300,
    controlsBlockSize: 214,
    expanded: true,
    ...options
  });

test("both corners align to usable map bounds, stacking controls only when necessary", () => {
  const right = place({});
  assert.equal(right.left + right.width, 1268);
  assert.equal(right.top + 40 + right.bodyHeight, 932);
  assert.equal(right.stacked, false);
  const left = place({ anchor: "left" });
  assert.equal(left.left, 12);
  assert.equal(left.stacked, true);
  assert.ok(left.controls.top + 214 + 8 <= left.top);
  const inspector = place({ usableRect: { left: 320, top: 56, right: 900, bottom: 1000 } });
  assert.equal(inspector.left + inspector.width, 568);
  assert.equal(inspector.stacked, true);
  assert.throws(() => place({ hudWidth: NaN }), TypeError);
});

test("narrow sheets reserve the complete Scanner and a scrolling control row", () => {
  const workspaceRect = { left: 0, top: 56, right: 390, bottom: 700 };
  for (const anchor of ["left", "right"]) {
    const options = { workspaceRect, hudWidth: 300, narrow: true, anchor };
    const reservation = place(options).minimumMapHeight;
    const result = place({
      ...options,
      usableRect: { ...workspaceRect, bottom: 56 + reservation }
    });
    assert.equal(result.bodyHeight, 300);
    assert.equal(result.controls.availableBlockSize, 48);
    assert.equal(result.controls.top + 48 + 8, result.top);
    assert.equal(result.top + 40 + 300 + 12, reservation);
  }
});

test("collapsed two-line headers reserve their full outer height above sheets and controls", () => {
  const workspaceRect = { left: 0, top: 56, right: 390, bottom: 700 };
  for (const anchor of ["left", "right"]) {
    const options = {
      workspaceRect,
      hudWidth: 300,
      narrow: true,
      anchor,
      expanded: false,
      headerBlockSize: 56
    };
    const reservation = place(options).minimumMapHeight;
    const result = place({
      ...options,
      usableRect: { ...workspaceRect, bottom: 56 + reservation }
    });
    assert.equal(result.bodyHeight, 0);
    assert.equal(result.top + 56 + 12, reservation);
    assert.equal(result.controls.top + 48 + 8, result.top);
  }
});

test("short sheets cannot push the widget or map controls beneath zoom and Plan controls", () => {
  const workspaceRect = { left: 0, top: 56, right: 390, bottom: 500 };
  const options = {
    workspaceRect,
    hudWidth: 300,
    narrow: true,
    topObstructions: [{ left: 334, top: 68, right: 378, bottom: 156 }]
  };
  const reservation = Math.min(place(options).minimumMapHeight, 444 - 48);
  const result = place({ ...options, usableRect: { ...workspaceRect, bottom: 56 + reservation } });
  assert.equal(result.bodyHeight, 180);
  assert.equal(result.controls.availableBlockSize, 48);
  assert.ok(result.controls.top + workspaceRect.top >= 164);
  assert.ok(result.top > result.controls.top + 48);
});

test("full table height has no arbitrary ceiling and only real bounds require scrolling", () => {
  assert.equal(place({ bodyBlockSize: 480 }).bodyHeight, 480);
  const clipped = place({ bodyBlockSize: 4000 });
  assert.equal(clipped.bodyHeight, 880);
  assert.equal(clipped.top, 12);
  const collapsed = place({ expanded: false, bodyBlockSize: 4000 });
  assert.equal(collapsed.bodyHeight, 0);
  assert.equal(collapsed.minimumMapHeight, 72);
});

test("anchoring changes chooser clearance without changing its ordinary bounded fallback", () => {
  const workspaceRect = { left: 0, top: 0, right: 1000, bottom: 800 };
  const chooser = (hud) =>
    createLayersPopoverPlacement({
      workspaceRect,
      anchorRect: { left: 12, top: 190, right: 252, bottom: 226 },
      surfaceBlockSize: 800,
      headerBlockSize: 40,
      optionBlockSize: 30,
      hudRects: [hud]
    });
  const right = chooser({ left: 588, top: 448, right: 988, bottom: 788 });
  const left = chooser({ left: 12, top: 448, right: 412, bottom: 788 });
  assert.equal(left.mode, "anchored");
  assert.equal(left.top + left.availableBlockSize, 440);
  assert.ok(right.availableBlockSize > left.availableBlockSize);
  const tight = chooser({ left: 12, top: 200, right: 412, bottom: 788 });
  assert.equal(tight.mode, "bounded");
});
