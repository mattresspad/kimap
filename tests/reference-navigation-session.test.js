import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERENCE_ENTITY_TYPES,
  ReferenceNavigationSession
} from "../stores/reference-navigation-session.js";

test("reference navigation exposes the locked immutable entity-type vocabulary", () => {
  assert.deepEqual(REFERENCE_ENTITY_TYPES, [
    "character",
    "squad",
    "faction",
    "nest",
    "item",
    "weapon",
    "crossbow",
    "armour",
    "mapItem",
    "nestItem"
  ]);
  assert.ok(Object.isFrozen(REFERENCE_ENTITY_TYPES));
});

test("reference navigation replaces roots, pushes links, and retains non-consecutive revisits", () => {
  const session = new ReferenceNavigationSession();
  assert.equal(session.replace({ entityType: "character", entityId: "a" }).type, "replace");
  assert.equal(session.push({ entityType: "squad", entityId: "s" }).type, "push");
  assert.equal(session.push({ entityType: "character", entityId: "a" }).type, "push");
  assert.deepEqual(
    session.getSnapshot().stack.map(({ entityType, entityId }) => `${entityType}:${entityId}`),
    ["character:a", "squad:s", "character:a"]
  );
  assert.equal(session.replace({ entityType: "faction", entityId: "f" }).type, "replace");
  assert.equal(session.getSnapshot().depth, 1);
});

test("reference navigation is no-op aware and supports geographic hot swapping", () => {
  const session = new ReferenceNavigationSession();
  session.replace({ entityType: "character", entityId: "a" });
  assert.equal(session.push({ entityType: "character", entityId: "a" }), false);
  assert.equal(session.showReference(), false);
  assert.equal(session.showGeographic().type, "showGeographic");
  assert.equal(session.showGeographic(), false);
  assert.equal(session.showReference().type, "showReference");
  assert.equal(session.back(), false);
});

test("reference navigation snapshots are immutable and clear is a session reset", () => {
  const session = new ReferenceNavigationSession();
  const changes = [];
  const unsubscribe = session.subscribe((change) => changes.push(change.type));
  session.replace({ entityType: "nest", entityId: "n" });
  session.push({ entityType: "item", entityId: "i" });
  assert.equal(session.back().type, "back");
  assert.ok(Object.isFrozen(session.getSnapshot()));
  assert.ok(Object.isFrozen(session.getSnapshot().stack));
  assert.equal(session.clear().type, "clear");
  assert.equal(session.clear(), false);
  unsubscribe();
  assert.deepEqual(changes, ["replace", "push", "back", "clear"]);
});

test("reference navigation validates exact target type and identity", () => {
  const session = new ReferenceNavigationSession({
    hasTarget: ({ entityType, entityId }) => entityType === "character" && entityId === "known"
  });
  assert.throws(() => session.replace({ entityType: "town", entityId: "known" }), /Unsupported/);
  assert.throws(() => session.replace({ entityType: "character", entityId: "missing" }), /Unknown/);
  assert.throws(() => session.replace({ entityType: "character", entityId: "" }), /non-empty/);
});

test("landmark visits retain the exact reference trail and one return point", () => {
  const session = new ReferenceNavigationSession({
    hasLandmark: (id) => ["one", "two"].includes(id)
  });
  session.replace({ entityType: "item", entityId: "first" });
  session.push({ entityType: "squad", entityId: "second" });
  const trail = session.getSnapshot().stack;
  session.openLandmark("one", { hasGeographic: true });
  assert.equal(session.getSnapshot().returnSurface, "reference");
  assert.equal(session.openLandmark("one"), false);
  session.openLandmark("two");
  assert.deepEqual(session.getSnapshot().stack, trail);
  assert.equal(session.getSnapshot().returnSurface, "reference");
  assert.equal(session.back().type, "closeLandmark");
  assert.equal(session.getSnapshot().surface, "reference");
  assert.deepEqual(session.getSnapshot().stack, trail);
  assert.equal(session.closeLandmark(), false);
});

test("landmark visits preserve geographic surface even with a retained reference trail", () => {
  const session = new ReferenceNavigationSession();
  session.replace({ entityType: "item", entityId: "first" });
  session.showGeographic();
  session.openLandmark("one", { hasGeographic: true });
  assert.equal(session.getSnapshot().returnSurface, "geographic");
  session.closeLandmark();
  assert.equal(session.getSnapshot().surface, "geographic");
  assert.equal(session.getSnapshot().depth, 1);
});

test("standalone visits, ordinary destinations, resets and invalid IDs are atomic", () => {
  const session = new ReferenceNavigationSession({ hasLandmark: (id) => id === "valid" });
  session.openLandmark("valid");
  assert.equal(session.getSnapshot().returnSurface, null);
  const before = session.getSnapshot();
  assert.throws(() => session.openLandmark("unknown"), /known landmark/);
  assert.equal(session.getSnapshot(), before);
  for (const replace of [
    () => session.replace({ entityType: "squad", entityId: "s" }),
    () => session.push({ entityType: "squad", entityId: "s" }),
    () => session.showGeographic(),
    () => session.clear()
  ]) {
    session.openLandmark("valid");
    replace();
    assert.equal(session.getSnapshot().hasLandmark, false);
    assert.equal(session.getSnapshot().landmarkId, null);
  }
  session.clear();
  assert.equal(session.clear(), false);
});

test("landmark navigation remains available when discovery targets are unavailable", () => {
  const session = new ReferenceNavigationSession({
    hasTarget: () => false,
    hasLandmark: (id) => id === "static-occurrence"
  });
  session.openLandmark("static-occurrence");
  assert.equal(session.getSnapshot().hasLandmark, true);
  const before = session.getSnapshot();
  assert.throws(() => session.replace({ entityType: "item", entityId: "missing" }), /Unknown/);
  assert.equal(session.getSnapshot(), before);
  session.closeLandmark();
  assert.equal(session.getSnapshot().surface, "geographic");
});
