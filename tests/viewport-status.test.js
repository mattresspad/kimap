import assert from "node:assert/strict";
import test from "node:test";

import {
  CHARACTER_STATUS_OPTIONS,
  normalizeCharacterStatus,
  normalizeFactionRelation
} from "../modules/viewport/simulation-editors.js";
import { createTimedStatusController } from "../modules/viewport/timed-status.js";

test("compact simulation editors expose semantic character states and bounded relations", () => {
  assert.deepEqual(
    CHARACTER_STATUS_OPTIONS.map((option) => [option.value, option.label]),
    [
      [1, "Alive"],
      [2, "Imprisoned"],
      [0, "Dead"]
    ]
  );
  assert.equal(normalizeCharacterStatus("2"), 2);
  assert.equal(normalizeFactionRelation("-100"), -100);
  assert.equal(normalizeFactionRelation(100), 100);
  assert.throws(() => normalizeCharacterStatus(3), /Alive, Imprisoned, or Dead/);
  assert.throws(() => normalizeFactionRelation(101), /between -100 and 100/);
});

test("five-second point warning expiry is cancellable and cannot erase a newer message", () => {
  const renders = [];
  const timers = new Map();
  let nextTimer = 0;
  const status = createTimedStatusController({
    render(message, level) {
      renders.push({ message, level });
    },
    setTimer(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    }
  });

  let expired = false;
  assert.equal(
    status.show("Map point coordinates must be finite and inside the Kenshi world bounds.", {
      timeout: 5000,
      onExpire() {
        expired = true;
      }
    }),
    true
  );
  const [{ callback, delay }] = timers.values();
  assert.equal(delay, 5000);

  status.show("Manifest mismatch.", { level: "error" });
  callback();
  assert.equal(expired, false);
  assert.deepEqual(renders.at(-1), { message: "Manifest mismatch.", level: "error" });

  status.clear();
  assert.deepEqual(renders.at(-1), { message: "", level: "info" });
});
