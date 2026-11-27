import assert from "node:assert/strict";
import test from "node:test";

import { FactionOverviewPresentationSession } from "../stores/faction-overview-presentation-session.js";

test("Faction Overview retains one explicit exact-ID selection independently of search", () => {
  const ids = ["a-rebirth.mod", "b-gamedata.base"];
  const session = new FactionOverviewPresentationSession({ allowedIds: ids });
  ids.length = 0;

  assert.deepEqual(session.getSnapshot(), { selectedFactionId: null, search: "" });
  session.setSelectedFactionId("a-rebirth.mod");
  session.setSearch("other faction");
  assert.deepEqual(session.getSnapshot(), {
    selectedFactionId: "a-rebirth.mod",
    search: "other faction"
  });

  session.setSelectedFactionId("b-gamedata.base");
  assert.equal(session.getSnapshot().selectedFactionId, "b-gamedata.base");
  session.setSelectedFactionId(null);
  assert.equal(session.getSnapshot().selectedFactionId, null);
  assert.equal(session.getSnapshot().search, "other faction");
  session.restoreDefaults();
  assert.deepEqual(session.getSnapshot(), { selectedFactionId: null, search: "" });
});

test("Faction Overview validates exact choices without requiring a catalog at construction", () => {
  const constrained = new FactionOverviewPresentationSession({ allowedIds: ["known-id"] });
  assert.throws(
    () => constrained.setSelectedFactionId("other-id"),
    /Unknown Faction Overview faction ID/
  );
  assert.throws(() => constrained.setSelectedFactionId(" known-id"), /exact nonempty faction ID/);
  assert.throws(() => constrained.setSelectedFactionId(""), /exact nonempty faction ID/);
  assert.throws(() => constrained.setSelectedFactionId(undefined), /exact nonempty faction ID/);
  assert.throws(() => constrained.setSearch(null), /must be a string/);
  assert.throws(
    () => new FactionOverviewPresentationSession({ allowedIds: "known-id" }),
    /iterable/
  );
  assert.throws(() => new FactionOverviewPresentationSession({ allowedIds: [""] }), /nonempty/);

  const catalogCheckedByCaller = new FactionOverviewPresentationSession();
  catalogCheckedByCaller.setSelectedFactionId("modded-id");
  assert.equal(catalogCheckedByCaller.getSnapshot().selectedFactionId, "modded-id");
});

test("Faction Overview snapshots are immutable and unchanged operations do not notify", () => {
  const session = new FactionOverviewPresentationSession({ allowedIds: ["one"] });
  const events = [];
  const unsubscribe = session.subscribe((event) => events.push(event));
  session.subscribe(() => {
    throw new Error("observer failure");
  });
  const initial = session.getSnapshot();

  assert.equal(session.setSelectedFactionId(null), false);
  assert.equal(session.setSearch(""), false);
  assert.equal(session.restoreDefaults(), false);
  assert.strictEqual(session.getSnapshot(), initial);
  assert.equal(events.length, 0);

  assert.equal(session.setSelectedFactionId("one").type, "setSelectedFactionId");
  assert.equal(session.setSelectedFactionId("one"), false);
  assert.equal(session.setSearch("one").type, "setSearch");
  assert.equal(session.restoreDefaults().type, "restoreDefaults");
  assert.deepEqual(
    events.map((event) => event.type),
    ["setSelectedFactionId", "setSearch", "restoreDefaults"]
  );
  assert.equal(initial.selectedFactionId, null);
  assert.throws(() => {
    session.getSnapshot().search = "changed";
  }, TypeError);
  unsubscribe();
  session.setSearch("after unsubscribe");
  assert.equal(events.length, 3);
  assert.throws(() => session.subscribe(null), /Subscriber must be a function/);
});
