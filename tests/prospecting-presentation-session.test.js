import assert from "node:assert/strict";
import test from "node:test";

import {
  PROSPECTING_CONDITION_IDS,
  PROSPECTING_NUMERIC_IDS,
  ProspectingPresentationSession
} from "../stores/prospecting-presentation-session.js";

test("Prospecting criteria retain thresholds on deselection and search only narrows the list", () => {
  const session = new ProspectingPresentationSession();
  const initial = session.getSnapshot();
  assert.deepEqual(initial.selectedNumericIds, []);
  assert.deepEqual(initial.selectedConditionIds, []);
  assert.deepEqual(
    initial.minimumByNumericId,
    Object.fromEntries(PROSPECTING_NUMERIC_IDS.map((id) => [id, 0]))
  );
  assert.equal(initial.search, "");

  session.setNumericSelected("green", true);
  session.setConditionSelected("acidRain", true);
  session.setMinimum("green", 0.75);
  session.setSearch("Floodlands");
  assert.deepEqual(session.getSnapshot().selectedNumericIds, ["green"]);
  assert.deepEqual(session.getSnapshot().selectedConditionIds, ["acidRain"]);
  assert.equal(session.getSnapshot().minimumByNumericId.green, 0.75);
  assert.equal(session.getSnapshot().search, "Floodlands");

  session.setNumericSelected("green", false);
  assert.equal(session.getSnapshot().minimumByNumericId.green, 0.75);
  session.setNumericSelected("green", true);
  assert.equal(session.getSnapshot().minimumByNumericId.green, 0.75);

  session.clearCriteria();
  assert.deepEqual(session.getSnapshot().selectedNumericIds, []);
  assert.deepEqual(session.getSnapshot().selectedConditionIds, []);
  assert.equal(session.getSnapshot().minimumByNumericId.green, 0);
  assert.equal(session.getSnapshot().search, "Floodlands");
  assert.equal(session.clearCriteria(), false);
  session.restoreDefaults();
  assert.equal(session.getSnapshot().search, "");
  assert.equal(session.restoreDefaults(), false);
});

test("Prospecting session validates exact choices and finite nonnegative raw thresholds", () => {
  const session = new ProspectingPresentationSession();
  assert.deepEqual(PROSPECTING_NUMERIC_IDS, [
    "arid",
    "green",
    "swamp",
    "copper",
    "iron",
    "stone",
    "water"
  ]);
  assert.deepEqual(PROSPECTING_CONDITION_IDS, [
    "acidGround",
    "acidWater",
    "gas",
    "acidRain",
    "duststorm",
    "burning"
  ]);
  for (const id of PROSPECTING_NUMERIC_IDS) {
    session.setNumericSelected(id, true);
    session.setMinimum(id, 0.001);
  }
  for (const id of PROSPECTING_CONDITION_IDS) session.setConditionSelected(id, true);
  assert.deepEqual(session.getSnapshot().selectedNumericIds, PROSPECTING_NUMERIC_IDS);
  assert.deepEqual(session.getSnapshot().selectedConditionIds, PROSPECTING_CONDITION_IDS);

  assert.throws(() => session.setNumericSelected("meitou", true), /Unknown Prospecting numeric ID/);
  assert.throws(
    () => session.setConditionSelected("clear", true),
    /Unknown Prospecting condition ID/
  );
  assert.throws(() => session.setNumericSelected("green", 1), /must be a boolean/);
  assert.throws(() => session.setConditionSelected("gas", "true"), /must be a boolean/);
  assert.throws(() => session.setMinimum("green", -0.1), /finite nonnegative/);
  assert.throws(() => session.setMinimum("green", Number.NaN), /finite nonnegative/);
  assert.throws(() => session.setMinimum("green", Infinity), /finite nonnegative/);
  assert.throws(() => session.setMinimum("green", "1"), /finite nonnegative/);
  assert.throws(() => session.setSearch(null), /must be a string/);
});

test("Prospecting snapshots are immutable and no-op mutations do not notify", () => {
  const session = new ProspectingPresentationSession();
  const events = [];
  const unsubscribe = session.subscribe((event) => events.push(event));
  session.subscribe(() => {
    throw new Error("broken observer");
  });
  const initial = session.getSnapshot();

  assert.equal(session.setNumericSelected("water", false), false);
  assert.equal(session.setConditionSelected("gas", false), false);
  assert.equal(session.setMinimum("water", 0), false);
  assert.equal(session.setSearch(""), false);
  assert.equal(session.clearCriteria(), false);
  assert.equal(session.restoreDefaults(), false);
  assert.strictEqual(session.getSnapshot(), initial);
  assert.equal(events.length, 0);

  assert.equal(session.setNumericSelected("water", true).type, "setNumericSelected");
  assert.equal(session.setNumericSelected("water", true), false);
  assert.equal(session.setConditionSelected("gas", true).type, "setConditionSelected");
  assert.equal(session.setMinimum("water", 1.5).type, "setMinimum");
  assert.equal(session.setSearch("North").type, "setSearch");
  assert.equal(session.restoreDefaults().type, "restoreDefaults");
  assert.deepEqual(
    events.map((event) => event.type),
    ["setNumericSelected", "setConditionSelected", "setMinimum", "setSearch", "restoreDefaults"]
  );
  assert.equal(initial.minimumByNumericId.water, 0);
  assert.throws(() => session.getSnapshot().selectedNumericIds.push("green"), TypeError);
  assert.throws(() => {
    session.getSnapshot().minimumByNumericId.water = 9;
  }, TypeError);
  unsubscribe();
  session.setSearch("South");
  assert.equal(events.length, 5);
  assert.throws(() => session.subscribe(null), /Subscriber must be a function/);
});
