import assert from "node:assert/strict";
import test from "node:test";

import { createShellTransientAdapter } from "../modules/top-bar/index.js";

test("shell transient adapter exposes active state, dismissal, and current trigger resolution", () => {
  const calls = [];
  const trigger = Object.freeze({ id: "navigation" });
  const controller = {
    isTransientActive: () => true,
    closeTransient(options) {
      calls.push(["close", options]);
      return true;
    },
    dismissTransient(options) {
      calls.push(options);
      return true;
    },
    getVisibleTrigger(key) {
      calls.push(key);
      return trigger;
    }
  };
  const adapter = createShellTransientAdapter(controller);

  assert.equal(adapter.isActive(), true);
  assert.equal(adapter.dismiss({ restoreFocus: true }), true);
  assert.strictEqual(adapter.resolveVisibleTrigger("navigation"), trigger);
  assert.deepEqual(calls, [{ restoreFocus: true }, "navigation"]);
  assert.equal(Object.isFrozen(adapter), true);
});

test("shell transient adapter preserves legacy close-only owners", () => {
  const calls = [];
  const adapter = createShellTransientAdapter({
    isTransientActive: () => true,
    closeTransient(options) {
      calls.push(options);
      return true;
    },
    getVisibleTrigger: () => null
  });

  assert.equal(adapter.dismiss({ restoreFocus: false }), true);
  assert.deepEqual(calls, [{ restoreFocus: false }]);
});

test("shell transient adapter rejects owners without the complete boundary", () => {
  assert.throws(() => createShellTransientAdapter(null), TypeError);
  assert.throws(
    () =>
      createShellTransientAdapter({
        isTransientActive() {},
        closeTransient() {}
      }),
    TypeError
  );
});
