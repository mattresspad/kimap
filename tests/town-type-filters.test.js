import assert from "node:assert/strict";
import test from "node:test";

import {
  TOWN_TYPE_FILTERS,
  createTownTypeFilterProjection,
  getTownTypeFilterKey,
  isNestMarkerTownType
} from "../modules/viewport/index.js";

test("town filters expose one stable Towns-routed list and exclude Nest Marker type 8", () => {
  assert.deepEqual(
    TOWN_TYPE_FILTERS.map(({ key }) => key),
    ["1", "2", "3", "4", "5", "6", "7", "9", "10", "0", "unknown"]
  );
  assert.equal(isNestMarkerTownType(8), true);
  assert.equal(isNestMarkerTownType("8"), true);
  assert.equal(getTownTypeFilterKey(8), null);
  assert.equal(getTownTypeFilterKey("7"), "7");
  assert.equal(getTownTypeFilterKey(22), "unknown");
  assert.equal(getTownTypeFilterKey(undefined), "unknown");
});

test("town filter projection counts loaded occurrences and retains zero-count rows", () => {
  const enabled = new Set(TOWN_TYPE_FILTERS.map(({ key }) => key));
  const projection = createTownTypeFilterProjection({
    occurrenceTypes: [0, "1", 8, 9, 10, 22, null, "custom"],
    isEnabled: (key) => enabled.has(key)
  });

  assert.equal(projection.rows.length, 11);
  assert.equal(projection.occurrenceCount, 7);
  assert.equal(projection.rows.find(({ key }) => key === "0").count, 1);
  assert.equal(projection.rows.find(({ key }) => key === "2").count, 0);
  assert.equal(projection.rows.find(({ key }) => key === "unknown").count, 3);
  assert.equal(projection.enabledCount, 11);
  assert.equal(projection.allEnabled, true);
  assert.deepEqual(
    projection.presentRows.map(({ key }) => key),
    ["1", "9", "10", "0", "unknown"]
  );
  assert.equal(projection.presentTypeCount, 5);
  assert.equal(projection.enabledPresentCount, 5);
  assert.equal(projection.allPresentEnabled, true);
  assert.throws(() => (projection.rows[0].count = 99), TypeError);
  assert.throws(() => projection.presentRows.pop(), TypeError);
});

test("town filter projection retains hidden filter state as scenario counts change", () => {
  const enabled = new Set(["2", "7"]);
  let occurrenceTypes = [2, 2, 7];
  const read = () =>
    createTownTypeFilterProjection({
      occurrenceTypes,
      isEnabled: (key) => enabled.has(key)
    });

  assert.equal(read().enabledCount, 2);
  assert.equal(read().allEnabled, false);
  assert.equal(read().presentTypeCount, 2);
  assert.equal(read().enabledPresentCount, 2);
  assert.equal(read().allPresentEnabled, true);

  enabled.delete("7");
  assert.equal(read().enabledPresentCount, 1);
  assert.equal(read().allPresentEnabled, false);

  occurrenceTypes = [2, 2];
  assert.equal(read().presentTypeCount, 1);
  assert.equal(read().enabledPresentCount, 1);
  assert.equal(read().allPresentEnabled, true);

  occurrenceTypes = [2, 2, 7];
  assert.equal(read().presentTypeCount, 2);
  assert.equal(read().enabledPresentCount, 1);
  assert.equal(read().allPresentEnabled, false);
  assert.equal(read().occurrenceCount, 3);
});

test("town filter projection treats an all-zero manifest as fully enabled present state", () => {
  const projection = createTownTypeFilterProjection({
    occurrenceTypes: [],
    isEnabled: () => false
  });

  assert.deepEqual(projection.presentRows, []);
  assert.equal(projection.presentTypeCount, 0);
  assert.equal(projection.enabledPresentCount, 0);
  assert.equal(projection.allPresentEnabled, true);
  assert.equal(projection.allEnabled, false);
});

test("town filter projection rejects non-array occurrences and missing live state readers", () => {
  assert.throws(
    () => createTownTypeFilterProjection({ occurrenceTypes: new Set(), isEnabled: () => true }),
    /occurrenceTypes must be an array/
  );
  assert.throws(() => createTownTypeFilterProjection(), /live enabled-state reader/);
});
