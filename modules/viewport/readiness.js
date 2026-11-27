import { ViewportError } from "./errors.js";

export const MAP_IMAGE_READINESS = Object.freeze({
  NOT_REQUESTED: "not-requested",
  DECODED: "decoded",
  LOADED: "loaded",
  ERROR: "error",
  UNAVAILABLE: "unavailable"
});

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new ViewportError("invalid_map_readiness_coordinator", `${label} must be a function.`);
  }
  return value;
}

function requireCancelHook(value, label) {
  if (value !== null) requireFunction(value, label);
  return value;
}

function boundGlobalFunction(name) {
  const value = globalThis[name];
  return typeof value === "function" ? value.bind(globalThis) : null;
}

function fallbackRequestFrame(callback) {
  return globalThis.setTimeout(() => callback(Date.now()), 0);
}

function fallbackCancelFrame(handle) {
  globalThis.clearTimeout(handle);
}

function fallbackRequestIdle(callback) {
  return globalThis.setTimeout(
    () => callback(Object.freeze({ didTimeout: true, timeRemaining: () => 0 })),
    0
  );
}

function fallbackCancelIdle(handle) {
  globalThis.clearTimeout(handle);
}

function resolveRequestHook(injected, globalName, fallback, label) {
  if (injected !== undefined) {
    return { hook: requireFunction(injected, label), injected: true };
  }
  return { hook: boundGlobalFunction(globalName) ?? fallback, injected: false };
}

function resolveCancelHook(injected, requestWasInjected, globalName, fallback, label) {
  if (injected !== undefined) return requireCancelHook(injected, label);
  if (requestWasInjected) return null;
  return boundGlobalFunction(globalName) ?? fallback;
}

function observeImageReadiness(image, onReady) {
  if (!image || typeof image !== "object") {
    onReady(MAP_IMAGE_READINESS.NOT_REQUESTED);
    return () => {};
  }

  let settled = false;
  const supportsEvents =
    typeof image.addEventListener === "function" && typeof image.removeEventListener === "function";

  const removeListeners = () => {
    if (!supportsEvents) return;
    image.removeEventListener("load", handleLoad);
    image.removeEventListener("error", handleError);
  };

  const finish = (status) => {
    if (settled) return;
    settled = true;
    removeListeners();
    onReady(status);
  };

  const decodeLoadedImage = () => {
    if (typeof image.decode !== "function") {
      finish(MAP_IMAGE_READINESS.LOADED);
      return;
    }
    Promise.resolve()
      .then(() => image.decode())
      .then(
        () => finish(MAP_IMAGE_READINESS.DECODED),
        () => finish(MAP_IMAGE_READINESS.LOADED)
      );
  };

  function handleLoad() {
    decodeLoadedImage();
  }

  function handleError() {
    finish(MAP_IMAGE_READINESS.ERROR);
  }

  if (supportsEvents) {
    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
  }

  if (image.complete === true) {
    if (Number.isFinite(image.naturalWidth) && image.naturalWidth === 0) {
      finish(MAP_IMAGE_READINESS.ERROR);
    } else {
      decodeLoadedImage();
    }
  } else if (!supportsEvents) {
    if (typeof image.decode === "function") {
      Promise.resolve()
        .then(() => image.decode())
        .then(
          () => finish(MAP_IMAGE_READINESS.DECODED),
          () => finish(MAP_IMAGE_READINESS.UNAVAILABLE)
        );
    } else {
      finish(MAP_IMAGE_READINESS.UNAVAILABLE);
    }
  }

  return removeListeners;
}

function validateJob(job) {
  if (!job || typeof job !== "object") {
    throw new ViewportError(
      "invalid_map_readiness_job",
      "An optional readiness job descriptor is required."
    );
  }
  if (typeof job.id !== "string" || job.id.trim() === "") {
    throw new ViewportError(
      "invalid_map_readiness_job",
      "An optional readiness job requires a non-empty string ID."
    );
  }
  requireFunction(job.run, "job.run");
  const priority = job.priority ?? 0;
  if (!Number.isFinite(priority)) {
    throw new ViewportError(
      "invalid_map_readiness_job",
      "An optional readiness job priority must be finite."
    );
  }
  return Object.freeze({ id: job.id.trim(), priority, run: job.run });
}

export function createMapReadinessCoordinator({
  image = null,
  prepareImage,
  onInitialStabilize,
  onOptionalJobError = () => {},
  requestFrame,
  cancelFrame,
  requestIdle,
  cancelIdle,
  idleTimeout = 1000
} = {}) {
  requireFunction(onInitialStabilize, "onInitialStabilize");
  requireFunction(onOptionalJobError, "onOptionalJobError");
  if (prepareImage !== undefined) requireFunction(prepareImage, "prepareImage");
  if (!Number.isFinite(idleTimeout) || idleTimeout < 0) {
    throw new ViewportError(
      "invalid_map_readiness_coordinator",
      "idleTimeout must be a non-negative finite number."
    );
  }

  const frameRequest = resolveRequestHook(
    requestFrame,
    "requestAnimationFrame",
    fallbackRequestFrame,
    "requestFrame"
  );
  const idleRequest = resolveRequestHook(
    requestIdle,
    "requestIdleCallback",
    fallbackRequestIdle,
    "requestIdle"
  );
  const effectiveCancelFrame = resolveCancelHook(
    cancelFrame,
    frameRequest.injected,
    "cancelAnimationFrame",
    fallbackCancelFrame,
    "cancelFrame"
  );
  const effectiveCancelIdle = resolveCancelHook(
    cancelIdle,
    idleRequest.injected,
    "cancelIdleCallback",
    fallbackCancelIdle,
    "cancelIdle"
  );

  let started = false;
  let destroyed = false;
  let stabilized = false;
  let stabilizationFailed = false;
  let movementActive = false;
  let imageStatus = MAP_IMAGE_READINESS.NOT_REQUESTED;
  let preparedImage = null;
  let frameHandle = null;
  let idleHandle = null;
  let imageCleanup = null;
  let runningJob = null;
  let nextSequence = 0;
  let startPromise = null;
  let resolveStart = null;
  let rejectStart = null;
  const jobs = new Map();

  const result = (status) => Object.freeze({ status, imageStatus });

  const notifyJobError = (error, job) => {
    try {
      onOptionalJobError(error, Object.freeze({ id: job.id, priority: job.priority }));
    } catch (_error) {
      // Optional error reporting must never stop the remaining readiness work.
    }
  };

  const pendingJobs = () =>
    [...jobs.values()]
      .filter((job) => job.status === "pending")
      .sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);

  const scheduleOptionalJob = () => {
    if (
      destroyed ||
      !stabilized ||
      movementActive ||
      runningJob !== null ||
      idleHandle !== null ||
      pendingJobs().length === 0
    ) {
      return false;
    }

    let invokedSynchronously = false;
    const callback = () => {
      invokedSynchronously = true;
      idleHandle = null;
      if (destroyed || movementActive || runningJob !== null) return;

      const job = pendingJobs()[0];
      if (!job) return;
      job.status = "running";
      runningJob = job;

      Promise.resolve()
        .then(() => job.run(Object.freeze({ id: job.id, priority: job.priority })))
        .then(
          () => {
            job.status = "completed";
          },
          (error) => {
            job.status = "failed";
            notifyJobError(error, job);
          }
        )
        .finally(() => {
          if (runningJob === job) runningJob = null;
          scheduleOptionalJob();
        });
    };

    const handle = idleRequest.hook(callback, { timeout: idleTimeout });
    idleHandle = invokedSynchronously ? null : handle;
    return true;
  };

  const completeStabilization = () => {
    if (destroyed) return;
    preparedImage = null;
    stabilized = true;
    resolveStart?.(result("ready"));
    resolveStart = null;
    rejectStart = null;
    scheduleOptionalJob();
  };

  const failStabilization = (error) => {
    if (destroyed) return;
    preparedImage = null;
    stabilizationFailed = true;
    rejectStart?.(error);
    resolveStart = null;
    rejectStart = null;
  };

  const scheduleStabilization = () => {
    if (destroyed || frameHandle !== null) return false;
    let invokedSynchronously = false;
    const callback = () => {
      invokedSynchronously = true;
      frameHandle = null;
      if (destroyed) return;

      let stabilization;
      try {
        stabilization = onInitialStabilize(
          Object.freeze(prepareImage ? { imageStatus, preparedImage } : { imageStatus })
        );
      } catch (error) {
        failStabilization(error);
        return;
      }
      Promise.resolve(stabilization).then(completeStabilization, failStabilization);
    };

    try {
      const handle = frameRequest.hook(callback);
      frameHandle = invokedSynchronously ? null : handle;
      return true;
    } catch (error) {
      failStabilization(error);
      return false;
    }
  };

  const handleImageReady = (status) => {
    if (destroyed) return;
    imageStatus = status;
    imageCleanup = null;
    scheduleStabilization();
  };

  const start = () => {
    if (startPromise !== null) return startPromise;
    if (destroyed) {
      startPromise = Promise.resolve(result("destroyed"));
      return startPromise;
    }

    started = true;
    startPromise = new Promise((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    if (prepareImage) {
      Promise.resolve()
        .then(prepareImage)
        .then((prepared) => {
          if (destroyed) return;
          if (
            !prepared?.image ||
            ![MAP_IMAGE_READINESS.LOADED, MAP_IMAGE_READINESS.DECODED].includes(
              prepared.imageStatus
            )
          ) {
            throw new Error("The Kenshi base-map image could not be loaded.");
          }
          preparedImage = prepared;
          handleImageReady(prepared.imageStatus);
        })
        .catch(failStabilization);
    } else {
      imageCleanup = observeImageReadiness(image, handleImageReady);
    }
    return startPromise;
  };

  const addOptionalJob = (descriptor) => {
    if (destroyed) return false;
    const job = validateJob(descriptor);
    if (jobs.has(job.id)) return false;
    jobs.set(job.id, {
      ...job,
      sequence: nextSequence,
      status: "pending"
    });
    nextSequence += 1;
    scheduleOptionalJob();
    return true;
  };

  const setMovementActive = (active) => {
    if (typeof active !== "boolean") {
      throw new ViewportError(
        "invalid_map_readiness_movement",
        "Movement activity must be a boolean."
      );
    }
    if (destroyed || movementActive === active) return false;
    movementActive = active;

    if (movementActive && idleHandle !== null && effectiveCancelIdle !== null) {
      effectiveCancelIdle(idleHandle);
      idleHandle = null;
    } else if (!movementActive) {
      scheduleOptionalJob();
    }
    return true;
  };

  const getSnapshot = () => {
    const values = [...jobs.values()];
    return Object.freeze({
      started,
      destroyed,
      stabilized,
      stabilizationFailed,
      movementActive,
      imageStatus,
      pendingJobCount: values.filter((job) => job.status === "pending").length,
      completedJobCount: values.filter((job) => job.status === "completed").length,
      failedJobCount: values.filter((job) => job.status === "failed").length,
      runningJobId: runningJob?.id ?? null
    });
  };

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    preparedImage = null;
    imageCleanup?.();
    imageCleanup = null;

    if (frameHandle !== null && effectiveCancelFrame !== null) {
      effectiveCancelFrame(frameHandle);
    }
    frameHandle = null;
    if (idleHandle !== null && effectiveCancelIdle !== null) {
      effectiveCancelIdle(idleHandle);
    }
    idleHandle = null;

    for (const job of jobs.values()) {
      if (job.status === "pending") job.status = "cancelled";
    }
    if (resolveStart !== null) resolveStart(result("destroyed"));
    resolveStart = null;
    rejectStart = null;
    return true;
  };

  return Object.freeze({
    start,
    addOptionalJob,
    setMovementActive,
    getSnapshot,
    destroy
  });
}
