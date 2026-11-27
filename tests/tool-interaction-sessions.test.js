import assert from "node:assert/strict";
import test from "node:test";

import { PaintStore } from "../stores/store-paint.js";
import { PlayerMarkerStore } from "../stores/store-placements.js";
import { PaintInteractionSession } from "../stores/tool-interaction-sessions.js";

test("marker placement is immutable, idempotent, and separate from marker document changes", () => {
  const store = new PlayerMarkerStore();
  const documentChanges = [];
  const interactionChanges = [];
  store.subscribe((markers) => documentChanges.push(markers));
  store.subscribePlacementInteraction((change) => interactionChanges.push(change));

  const initial = store.getPlacementInteractionState();
  assert.deepEqual(initial, { placementActive: false });
  assert.equal(Object.isFrozen(initial), true);
  assert.throws(() => (initial.placementActive = true), TypeError);

  assert.equal(store.activatePlacementMode().type, "startPlacement");
  assert.equal(store.activatePlacementMode(), false);
  assert.equal(store.isPlacementModeActive(), true);
  assert.equal(interactionChanges.length, 1);
  assert.equal(documentChanges.length, 0);
  assert.equal(Object.isFrozen(interactionChanges[0]), true);
  assert.equal(Object.isFrozen(interactionChanges[0].snapshot), true);

  store.addMarker({ lat: 10, lng: 20 }, { name: "Camp" });
  assert.equal(documentChanges.length, 1);
  assert.equal(interactionChanges.length, 1);

  assert.equal(store.deactivatePlacementMode().type, "cancelPlacement");
  assert.equal(store.deactivatePlacementMode(), false);
  assert.equal(store.isPlacementModeActive(), false);
  assert.equal(interactionChanges.length, 2);
  assert.equal(documentChanges.length, 1);
});

test("marker placement compatibility toggle uses the interaction boundary", () => {
  const store = new PlayerMarkerStore();
  const changes = [];
  const unsubscribe = store.subscribePlacementInteraction((change) => changes.push(change.type));

  assert.equal(store.togglePlacementMode(), true);
  assert.equal(store.togglePlacementMode(), false);
  unsubscribe();
  store.activatePlacementMode();

  assert.deepEqual(changes, ["startPlacement", "cancelPlacement"]);
});

test("Paint tools expose immutable open, tool, drawing, cancel, and close state", () => {
  const session = new PaintInteractionSession();
  const changes = [];
  session.subscribe((change) => changes.push(change));

  assert.deepEqual(session.getSnapshot(), {
    toolsOpen: false,
    toolState: "off",
    drawingMode: null,
    active: false,
    drawing: false,
    placing: false
  });
  assert.equal(Object.isFrozen(session.getSnapshot()), true);

  assert.equal(session.open().type, "openTools");
  assert.equal(session.open(), false);
  assert.equal(session.activate("draw", "box").type, "activateTool");
  assert.equal(session.open(), false);
  assert.equal(session.activate("draw", "box"), false);
  assert.deepEqual(session.getSnapshot(), {
    toolsOpen: true,
    toolState: "draw",
    drawingMode: "box",
    active: true,
    drawing: true,
    placing: false
  });

  assert.equal(session.cancel().type, "cancelInteraction");
  assert.equal(session.cancel(), false);
  assert.equal(session.getSnapshot().toolsOpen, true);
  assert.equal(session.getSnapshot().active, false);

  assert.equal(session.activate("place", "note").type, "activateTool");
  assert.equal(session.getSnapshot().placing, true);
  assert.equal(session.close().type, "closeTools");
  assert.equal(session.close(), false);
  assert.equal(session.getSnapshot().toolsOpen, false);
  assert.equal(changes.length, 5);
  assert.equal(
    changes.every((change) => Object.isFrozen(change)),
    true
  );
  assert.equal(
    changes.every((change) => Object.isFrozen(change.snapshot)),
    true
  );
});

test("Paint interaction notifications never notify the Paint document store", () => {
  const interaction = new PaintInteractionSession();
  const paintStore = new PaintStore();
  let documentNotifications = 0;
  let interactionNotifications = 0;
  paintStore.subscribe(() => documentNotifications++);
  interaction.subscribe(() => interactionNotifications++);

  interaction.open();
  interaction.activate("draw", "line");
  interaction.cancel();
  interaction.close();
  assert.equal(interactionNotifications, 4);
  assert.equal(documentNotifications, 0);

  paintStore.addItem("line", [
    { lat: 1, lng: 2 },
    { lat: 3, lng: 4 }
  ]);
  assert.equal(documentNotifications, 1);
  assert.equal(interactionNotifications, 4);
});

test("Paint interaction rejects incompatible tool and mode combinations atomically", () => {
  const session = new PaintInteractionSession();
  const original = session.getSnapshot();

  assert.throws(() => session.activate("draw", "note"), TypeError);
  assert.throws(() => session.activate("place", "box"), TypeError);
  assert.throws(() => session.activate("select", "line"), TypeError);
  assert.throws(() => session.activate("unknown"), TypeError);
  assert.strictEqual(session.getSnapshot(), original);
});
