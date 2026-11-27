import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_IMAGE_READINESS,
  createMapReadinessCoordinator
} from "../modules/viewport/readiness.js";

function createScheduler() {
  let nextHandle = 1;
  const frames = new Map();
  const idleCallbacks = new Map();
  const cancelledFrames = [];
  const cancelledIdle = [];

  const takeFirst = (queue) => {
    const entry = queue.entries().next().value;
    if (!entry) return false;
    const [handle, callback] = entry;
    queue.delete(handle);
    callback();
    return true;
  };

  return {
    frames,
    idleCallbacks,
    cancelledFrames,
    cancelledIdle,
    requestFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      cancelledFrames.push(handle);
      frames.delete(handle);
    },
    requestIdle(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      idleCallbacks.set(handle, callback);
      return handle;
    },
    cancelIdle(handle) {
      cancelledIdle.push(handle);
      idleCallbacks.delete(handle);
    },
    flushFrame() {
      return takeFirst(frames);
    },
    flushIdle() {
      const entry = idleCallbacks.entries().next().value;
      if (!entry) return false;
      const [handle, callback] = entry;
      idleCallbacks.delete(handle);
      callback({ didTimeout: false, timeRemaining: () => 10 });
      return true;
    }
  };
}

function createImage({ complete = false, naturalWidth = 100, decode } = {}) {
  const listeners = new Map();
  return {
    complete,
    naturalWidth,
    decode,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    emit(type) {
      listeners.get(type)?.();
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

async function settleMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("prepared base image gates stabilization and rejected preparation cannot mark readiness", async () => {
  const scheduler = createScheduler();
  let resolveImage;
  const prepared = { image: createImage({ complete: true }), imageStatus: "decoded" };
  let observed;
  const coordinator = createMapReadinessCoordinator({
    prepareImage: () =>
      new Promise((resolve) => {
        resolveImage = resolve;
      }),
    onInitialStabilize: (context) => {
      observed = context.preparedImage;
    },
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame
  });
  const ready = coordinator.start();
  await settleMicrotasks();
  assert.equal(scheduler.frames.size, 0);
  resolveImage(prepared);
  await settleMicrotasks();
  scheduler.flushFrame();
  assert.equal((await ready).imageStatus, "decoded");
  assert.strictEqual(observed, prepared);
  coordinator.destroy();

  const rejected = createMapReadinessCoordinator({
    prepareImage: async () => {
      throw new Error("image unavailable");
    },
    onInitialStabilize: () => assert.fail("must not stabilize")
  });
  await assert.rejects(rejected.start(), /image unavailable/);
  assert.equal(rejected.getSnapshot().stabilizationFailed, true);
  rejected.destroy();
});

test("image load and rejected decode safely reach one initial stabilization frame", async () => {
  const scheduler = createScheduler();
  const image = createImage({ decode: () => Promise.reject(new Error("decode unavailable")) });
  const stabilizationCalls = [];
  const coordinator = createMapReadinessCoordinator({
    image,
    onInitialStabilize: (context) => stabilizationCalls.push(context),
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    requestIdle: scheduler.requestIdle,
    cancelIdle: scheduler.cancelIdle
  });

  const firstStart = coordinator.start();
  assert.strictEqual(coordinator.start(), firstStart);
  assert.equal(image.listenerCount(), 2);
  assert.equal(scheduler.frames.size, 0);

  image.emit("load");
  await settleMicrotasks();
  assert.equal(image.listenerCount(), 0);
  assert.equal(scheduler.frames.size, 1);
  scheduler.flushFrame();
  assert.deepEqual(await firstStart, {
    status: "ready",
    imageStatus: MAP_IMAGE_READINESS.LOADED
  });
  assert.deepEqual(stabilizationCalls, [{ imageStatus: MAP_IMAGE_READINESS.LOADED }]);
  assert.strictEqual(coordinator.start(), firstStart);
});

test("broken and unavailable images do not block initial stabilization", async () => {
  for (const [image, expectedStatus] of [
    [createImage({ complete: true, naturalWidth: 0 }), MAP_IMAGE_READINESS.ERROR],
    [{ complete: false }, MAP_IMAGE_READINESS.UNAVAILABLE],
    [null, MAP_IMAGE_READINESS.NOT_REQUESTED]
  ]) {
    const scheduler = createScheduler();
    const calls = [];
    const coordinator = createMapReadinessCoordinator({
      image,
      onInitialStabilize: (context) => calls.push(context),
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      requestIdle: scheduler.requestIdle,
      cancelIdle: scheduler.cancelIdle
    });

    const ready = coordinator.start();
    assert.equal(scheduler.flushFrame(), true);
    assert.equal((await ready).imageStatus, expectedStatus);
    assert.deepEqual(calls, [{ imageStatus: expectedStatus }]);
    coordinator.destroy();
  }
});

test("optional jobs are keyed, stable, prioritized, and isolated from job failures", async () => {
  const scheduler = createScheduler();
  const order = [];
  const errors = [];
  const coordinator = createMapReadinessCoordinator({
    onInitialStabilize: () => order.push("stabilize"),
    onOptionalJobError: (error, job) => errors.push([error.message, job.id]),
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    requestIdle: scheduler.requestIdle,
    cancelIdle: scheduler.cancelIdle
  });

  assert.equal(
    coordinator.addOptionalJob({ id: "low", priority: 1, run: () => order.push("low") }),
    true
  );
  assert.equal(
    coordinator.addOptionalJob({ id: "high", priority: 10, run: () => order.push("high") }),
    true
  );
  assert.equal(
    coordinator.addOptionalJob({
      id: "high",
      priority: 100,
      run: () => order.push("duplicate")
    }),
    false
  );
  assert.equal(
    coordinator.addOptionalJob({
      id: "middle",
      priority: 5,
      run: () => {
        order.push("middle");
        throw new Error("optional failure");
      }
    }),
    true
  );

  const ready = coordinator.start();
  scheduler.flushFrame();
  await ready;
  assert.deepEqual(order, ["stabilize"]);

  scheduler.flushIdle();
  await settleMicrotasks();
  scheduler.flushIdle();
  await settleMicrotasks();
  scheduler.flushIdle();
  await settleMicrotasks();

  assert.deepEqual(order, ["stabilize", "high", "middle", "low"]);
  assert.deepEqual(errors, [["optional failure", "middle"]]);
  assert.deepEqual(coordinator.getSnapshot(), {
    started: true,
    destroyed: false,
    stabilized: true,
    stabilizationFailed: false,
    movementActive: false,
    imageStatus: MAP_IMAGE_READINESS.NOT_REQUESTED,
    pendingJobCount: 0,
    completedJobCount: 2,
    failedJobCount: 1,
    runningJobId: null
  });
});

test("active map movement cancels pending idle work and resumes it once", async () => {
  const scheduler = createScheduler();
  const runs = [];
  const coordinator = createMapReadinessCoordinator({
    onInitialStabilize: () => {},
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    requestIdle: scheduler.requestIdle,
    cancelIdle: scheduler.cancelIdle
  });
  coordinator.addOptionalJob({ id: "labels", priority: 1, run: () => runs.push("labels") });

  const ready = coordinator.start();
  scheduler.flushFrame();
  await ready;
  assert.equal(scheduler.idleCallbacks.size, 1);
  assert.equal(coordinator.setMovementActive(true), true);
  assert.equal(coordinator.setMovementActive(true), false);
  assert.equal(scheduler.cancelledIdle.length, 1);
  assert.equal(scheduler.idleCallbacks.size, 0);
  assert.deepEqual(runs, []);

  assert.equal(coordinator.setMovementActive(false), true);
  assert.equal(scheduler.idleCallbacks.size, 1);
  scheduler.flushIdle();
  await settleMicrotasks();
  assert.deepEqual(runs, ["labels"]);
  assert.equal(coordinator.setMovementActive(false), false);
  assert.equal(scheduler.idleCallbacks.size, 0);
});

test("cleanup detaches image listeners, cancels scheduled hooks, and prevents duplicate starts", async () => {
  const scheduler = createScheduler();
  const pendingImage = createImage();
  let stabilizations = 0;
  const pending = createMapReadinessCoordinator({
    image: pendingImage,
    onInitialStabilize: () => (stabilizations += 1),
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    requestIdle: scheduler.requestIdle,
    cancelIdle: scheduler.cancelIdle
  });

  const start = pending.start();
  assert.strictEqual(pending.start(), start);
  assert.equal(pendingImage.listenerCount(), 2);
  assert.equal(pending.destroy(), true);
  assert.equal(pending.destroy(), false);
  assert.equal(pendingImage.listenerCount(), 0);
  pendingImage.emit("load");
  assert.deepEqual(await start, {
    status: "destroyed",
    imageStatus: MAP_IMAGE_READINESS.NOT_REQUESTED
  });
  assert.equal(stabilizations, 0);
  assert.strictEqual(pending.start(), start);
  assert.equal(
    pending.addOptionalJob({ id: "after-destroy", run: () => (stabilizations += 1) }),
    false
  );

  const frameImage = createImage({ complete: true });
  const framePending = createMapReadinessCoordinator({
    image: frameImage,
    onInitialStabilize: () => (stabilizations += 1),
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    requestIdle: scheduler.requestIdle,
    cancelIdle: scheduler.cancelIdle
  });
  const frameStart = framePending.start();
  assert.equal(scheduler.frames.size, 1);
  assert.equal(framePending.destroy(), true);
  assert.equal(scheduler.cancelledFrames.length, 1);
  assert.equal(scheduler.frames.size, 0);
  assert.equal((await frameStart).status, "destroyed");
  assert.equal(stabilizations, 0);
});

test("coordinator validates injected hooks, jobs, movement, and stabilization failures", async () => {
  assert.throws(
    () => createMapReadinessCoordinator(),
    (error) => error.code === "invalid_map_readiness_coordinator"
  );

  const scheduler = createScheduler();
  const failure = new Error("stabilization failed");
  const coordinator = createMapReadinessCoordinator({
    onInitialStabilize: () => {
      throw failure;
    },
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    requestIdle: scheduler.requestIdle,
    cancelIdle: scheduler.cancelIdle
  });
  assert.throws(
    () => coordinator.addOptionalJob({ id: "", run: () => {} }),
    (error) => error.code === "invalid_map_readiness_job"
  );
  assert.throws(
    () => coordinator.setMovementActive("yes"),
    (error) => error.code === "invalid_map_readiness_movement"
  );

  const start = coordinator.start();
  scheduler.flushFrame();
  await assert.rejects(start, failure);
  assert.equal(coordinator.getSnapshot().stabilizationFailed, true);
  assert.equal(scheduler.idleCallbacks.size, 0);
});
