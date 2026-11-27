import assert from "node:assert/strict";
import test from "node:test";
import { createChooserAutoHide } from "../modules/viewport/chooser-auto-hide.js";
import {
  WORLD_VIEW_GROUPS,
  WORLD_VIEW_GROUP_DEFAULTS
} from "../modules/viewport/layer-chooser-groups.js";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";

function fixture() {
  let now = 0;
  let next = 0;
  let dismissals = 0;
  const timers = new Map();
  const callbacks = [];
  const state = {
    presented: true,
    pinned: false,
    pointerEligible: true,
    pointerInside: true,
    keyboardInside: false
  };
  const policy = createChooserAutoHide({
    readState: () => state,
    onDismiss: () => {
      dismissals++;
    },
    setTimer(callback, delay) {
      const id = next++;
      timers.set(id, { callback, at: now + delay });
      callbacks.push(callback);
      return id;
    },
    clearTimer: (id) => timers.delete(id)
  });
  return {
    state,
    callbacks,
    timers,
    policy,
    get dismissals() {
      return dismissals;
    },
    update(changes = {}) {
      Object.assign(state, changes);
      policy.refresh();
    },
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    }
  };
}

test("chooser waits 1200ms after leaving, without restarting on unrelated refreshes", () => {
  const f = fixture();
  f.update();
  assert.equal(f.timers.size, 0);
  f.update({ pointerInside: false });
  f.tick(600);
  f.update();
  f.tick(599);
  assert.equal(f.dismissals, 0);
  f.tick(1);
  assert.equal(f.dismissals, 1);
});

test("returning to either region cancels closure and starts a fresh grace on departure", () => {
  const f = fixture();
  f.update({ pointerInside: false });
  f.tick(1000);
  f.update({ pointerInside: true });
  f.callbacks[0]();
  assert.equal(f.dismissals, 0);
  f.tick(5000);
  assert.equal(f.dismissals, 0);
  f.update({ pointerInside: false });
  f.tick(1200);
  assert.equal(f.dismissals, 1);
});

test("keyboard engagement and touch suppress auto-hide, then mouse departure resumes it", () => {
  const f = fixture();
  f.update({ pointerInside: false });
  f.update({ keyboardInside: true });
  f.tick(2000);
  assert.equal(f.dismissals, 0);
  f.update({ keyboardInside: false, pointerEligible: false });
  f.tick(2000);
  assert.equal(f.dismissals, 0);
  f.update({ pointerEligible: true });
  f.tick(1200);
  assert.equal(f.dismissals, 1);
});

test("pin/unpin and close/reopen invalidate callbacks even if cancellation races", () => {
  for (const transition of [{ pinned: true }, { presented: false }]) {
    const f = fixture();
    f.update({ pointerInside: false });
    const stale = f.callbacks[0];
    f.update(transition);
    f.update({ presented: true, pinned: false });
    stale();
    assert.equal(f.dismissals, 0);
    f.tick(1199);
    assert.equal(f.dismissals, 0);
    f.tick(1);
    assert.equal(f.dismissals, 1);
  }
});

test("expiry rechecks live surface, pin, pointer and keyboard without requiring another event", () => {
  for (const changes of [
    { presented: false },
    { pinned: true },
    { pointerInside: true },
    { keyboardInside: true },
    { pointerEligible: false }
  ]) {
    const f = fixture();
    f.update({ pointerInside: false });
    Object.assign(f.state, changes);
    f.tick(1200);
    assert.equal(f.dismissals, 0);
  }
});

test("sibling handoff cancels the old chooser without affecting the new one", () => {
  const old = fixture();
  const next = fixture();
  old.update({ pointerInside: false });
  old.update({ presented: false });
  next.update();
  old.callbacks[0]();
  old.tick(2000);
  next.tick(2000);
  assert.equal(old.dismissals + next.dismissals, 0);
});

test("group expansion is independently immutable, no-op aware and retained across presentation changes", () => {
  const session = new ViewportCompositionSession();
  const initial = session.getSnapshot();
  assert.deepEqual(initial.worldViewGroupsExpanded, WORLD_VIEW_GROUP_DEFAULTS);
  const events = [];
  session.subscribe((event) => events.push(event));
  assert.equal(session.setWorldViewGroupExpanded("geography", true), false);
  assert.equal(session.getSnapshot(), initial);
  assert.equal(events.length, 0);
  session.setWorldViewGroupExpanded("resources", true);
  session.setWorldViewGroupExpanded("weather", true);
  assert.equal(initial.worldViewGroupsExpanded.resources, false);
  assert.throws(() => {
    initial.worldViewGroupsExpanded.resources = true;
  }, TypeError);
  session.openTransientSurface("worldViews");
  session.openTransientSurface("mapContent");
  session.closeTransientSurface();
  session.setLayoutClass("narrow", true);
  session.enterFocusMap();
  session.exitFocusMap();
  assert.deepEqual(session.getSnapshot().worldViewGroupsExpanded, {
    geography: true,
    fertility: false,
    resources: true,
    weather: true
  });
  session.reset();
  assert.deepEqual(session.getSnapshot().worldViewGroupsExpanded, WORLD_VIEW_GROUP_DEFAULTS);
});

test("group defaults and setters validate internal inputs", () => {
  const session = new ViewportCompositionSession({ worldViewGroupsExpanded: { geography: false } });
  assert.equal(session.getSnapshot().worldViewGroupsExpanded.geography, false);
  assert.throws(() => session.setWorldViewGroupExpanded("unknown", true));
  assert.throws(() => session.setWorldViewGroupExpanded("fertility", 1));
  assert.throws(
    () => new ViewportCompositionSession({ worldViewGroupsExpanded: { unknown: true } })
  );
});

test("declarative World Views groups preserve exact ordering and contain each grouped layer once", () => {
  assert.deepEqual(
    WORLD_VIEW_GROUPS.map(({ title }) => title),
    ["Geography", "Fertility", "Mining & Resources", "Weather & Hazards"]
  );
  const ids = WORLD_VIEW_GROUPS.flatMap(({ choices }) => choices.map(({ id }) => id));
  assert.deepEqual(ids, [
    "spawnAreas",
    "spawnBorders",
    "biomes",
    "arid",
    "green",
    "swamp",
    "copper",
    "iron",
    "stone",
    "water",
    "acidGround",
    "acidRain",
    "acidWater",
    "burning",
    "duststorm",
    "gas"
  ]);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => {
    WORLD_VIEW_GROUPS[0].choices[0].id = "roads";
  }, TypeError);
});
