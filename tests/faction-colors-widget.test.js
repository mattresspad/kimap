import assert from "node:assert/strict";
import test from "node:test";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";
import { createEscapeCoordinator } from "../modules/viewport/dismissal.js";
import { createFactionColorsWidgetPlacement as fit } from "../modules/viewport/faction-colors-widget-placement.js";

test("faction widget choices are session-only, no-op aware, retained across surfaces, and reset together", () => {
  const session = new ViewportCompositionSession();
  let notifications = 0;
  session.subscribe(() => notifications++);
  assert.equal(session.setFactionColorsWidgetOpen(false), false);
  assert.equal(session.setFactionColorsWidgetSearchOpen(false), false);
  assert.equal(notifications, 0);
  session.setFactionColorsWidgetOpen(true);
  session.setFactionColorsWidgetSearch("48791-Dialogue.mod");
  const snapshot = session.getSnapshot();
  assert.equal(session.setFactionColorsWidgetSearch("48791-Dialogue.mod"), false);
  assert.equal(session.getSnapshot(), snapshot);
  assert.throws(() => session.setFactionColorsWidgetSearch(null));
  assert.throws(() => session.setFactionColorsWidgetOpen("true"));
  assert.throws(() => session.setFactionColorsWidgetSearchOpen(1));
  session.activatePoliticalReports();
  session.enterFocusMap();
  session.exitFocusMap();
  session.openTransientSurface("cursorControls");
  session.setLayoutClass("narrow", true);
  session.showInspector();
  assert.equal(session.getSnapshot().factionColorsWidgetOpen, true);
  assert.equal(session.getSnapshot().factionColorsWidgetSearch, "48791-Dialogue.mod");
  session.setFactionColorsWidgetOpen(false);
  session.setFactionColorsWidgetOpen(true);
  assert.equal(session.getSnapshot().factionColorsWidgetSearchOpen, true);
  session.setFactionColorsWidgetSearchOpen(false);
  assert.equal(session.getSnapshot().factionColorsWidgetSearch, "");
  session.setFactionColorsWidgetSearch("Holy");
  session.reset();
  assert.equal(session.getSnapshot().factionColorsWidgetOpen, false);
  assert.equal(session.getSnapshot().factionColorsWidgetSearchOpen, false);
  assert.equal(session.getSnapshot().factionColorsWidgetSearch, "");
});

const options = {
  bounds: { left: 0, top: 0, right: 1000, bottom: 700 },
  anchorRect: { left: 952, right: 988, top: 12, bottom: 160 },
  chromeHeight: 30,
  bodyHeight: 1044,
  foldedHeight: 30,
  foldedMinimumWidth: 84
};
test("the list fits content, shrinks width around controls, folds, and hides only as a last resort", () => {
  assert.deepEqual(fit(options), {
    mode: "normal",
    left: 744,
    top: 12,
    width: 200,
    height: 148,
    bodyHeight: 104
  });
  assert.equal(fit({ ...options, bodyHeight: 24 }).height, 54);
  const obstruction = Object.freeze({ left: 720, right: 790, top: 10, bottom: 150 });
  assert.deepEqual(fit({ ...options, obstructions: [obstruction] }), {
    mode: "shrunk",
    left: 804,
    top: 12,
    width: 140,
    height: 104,
    bodyHeight: 64
  });
  const full = { left: 700, right: 988, top: 56, bottom: 300 };
  assert.equal(fit({ ...options, obstructions: [full] }).mode, "folded");
  assert.equal(fit({ ...options, obstructions: [{ ...full, top: 40 }] }).mode, "hidden");
  // Starting from the same higher-priority rectangles always returns the same fit.
  assert.deepEqual(fit(options), fit(options));
  assert.deepEqual(obstruction, { left: 720, right: 790, top: 10, bottom: 150 });
});

test("normal height follows the navigation stack and reserves complete rows with or without search", () => {
  const anchorRect = { ...options.anchorRect, bottom: options.anchorRect.top + 146 };
  for (const chromeHeight of [30, 60]) {
    const placement = fit({ ...options, anchorRect, chromeHeight });
    assert.equal(placement.top + placement.height, anchorRect.bottom);
    assert.equal((placement.bodyHeight - 4) % 20, 0);
    assert.ok(placement.bodyHeight + chromeHeight <= placement.height);
  }
  assert.equal(fit({ ...options, anchorRect, bodyHeight: 44 }).height, 74);
});
test("fitting honors usable bounds, search chrome, narrow header space, and non-overlapping reports", () => {
  const narrow = { ...options, bounds: { ...options.bounds, left: 830 } };
  assert.equal(fit(narrow).mode, "folded");
  assert.equal(fit({ ...narrow, bounds: { ...narrow.bounds, left: 870 } }).mode, "hidden");
  assert.equal(fit({ ...options, bounds: { ...options.bounds, bottom: 65 } }).mode, "folded");
  assert.equal(
    fit({
      ...options,
      chromeHeight: 60,
      obstructions: [{ left: 700, right: 988, top: 80, bottom: 300 }]
    }).mode,
    "folded"
  );
  assert.equal(
    fit({ ...options, obstructions: [{ left: 0, right: 500, top: 0, bottom: 700 }] }).mode,
    "normal"
  );
  assert.equal(
    fit({ ...options, obstructions: [{ left: 700, right: 944, top: 132, bottom: 600 }] }).height,
    112
  );
});
test("focused widget Escape follows theaters/transients but leaves unrelated popup handling intact", () => {
  const active = { theater: true, transient: true, focusedHud: true, popup: true };
  const coordinator = createEscapeCoordinator(
    Object.fromEntries(
      Object.keys(active).map((key) => [
        key,
        {
          isActive: () => active[key],
          dismiss: () => {
            active[key] = false;
          }
        }
      ])
    )
  );
  assert.equal(coordinator.dismiss(), "theater");
  assert.equal(coordinator.dismiss(), "transient");
  assert.equal(coordinator.dismiss(), "focusedHud");
  assert.equal(active.popup, true);
  assert.equal(coordinator.dismiss(), "popup");
});
