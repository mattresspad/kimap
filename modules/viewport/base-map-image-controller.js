import { LEGACY_BASE_MAP, selectBaseMapImage } from "./base-map-resolution.js";

export function loadBaseMapImage(
  url,
  size,
  { createImage = () => new Image(), signal, timeoutMs = 15000 } = {}
) {
  return new Promise((resolve, reject) => {
    const image = createImage();
    let settled = false;
    let decoding = false;
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    const finish = (error, imageStatus = "loaded") => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        image.removeAttribute("src");
        reject(error);
      } else {
        resolve({ image, imageStatus, size, url });
      }
    };
    const valid = () => image.naturalWidth === size && image.naturalHeight === size;
    const failed = () => finish(new Error(`Base-map image failed: ${url}`));
    const aborted = () => finish(new Error("Base-map image preparation cancelled."));
    const loaded = async () => {
      if (settled || decoding) return;
      if (!valid()) return failed();
      decoding = true;
      let status = "loaded";
      if (typeof image.decode === "function") {
        try {
          await image.decode();
          status = "decoded";
        } catch {
          // A successful load can remain usable when decode() is unavailable/rejected.
        }
      }
      if (!valid()) return failed();
      finish(null, status);
    };
    image.alt = "";
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.addEventListener("load", loaded);
    image.addEventListener("error", failed);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) return aborted();
    timer = setTimeout(failed, timeoutMs);
    image.src = url;
    if (image.complete) {
      if (valid()) void loaded();
      else failed();
    }
  });
}

// Leaflet owns movement; this controller owns only bounded image resources.
export function createBaseMapImageController({
  getZoom,
  getPixelRatio = () => globalThis.devicePixelRatio ?? 1,
  resolveUrls,
  createOverlay,
  loadImage = loadBaseMapImage,
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (handle) => cancelAnimationFrame(handle),
  onChange = () => {},
  onError = () => {}
}) {
  let active = null;
  let candidate = null;
  let retiring = null;
  let pending = null;
  let frame = null;
  let initialPromise = null;
  let desired = null;
  let moving = false;
  let enabled = false;
  let destroyed = false;
  const abort = new AbortController();
  const failedUrls = new Set();
  const failedSizes = new Set();
  const notify = (callback, value) => {
    try {
      callback(value);
    } catch {
      /* Diagnostics never interrupt map navigation. */
    }
  };
  const currentRecord = () => selectBaseMapImage(getZoom(), getPixelRatio());

  const prepare = async (record) => {
    let failure = new Error("No usable base-map source.");
    for (const url of new Set(resolveUrls(record))) {
      if (destroyed) throw new Error("Base-map controller destroyed.");
      if (failedUrls.has(url)) continue;
      try {
        return await loadImage(url, record.size, { signal: abort.signal });
      } catch (error) {
        if (destroyed) throw error;
        failedUrls.add(url);
        failure = error;
      }
    }
    throw failure;
  };

  const publish = () =>
    notify(
      onChange,
      Object.freeze({
        size: active.size,
        url: active.url,
        imageStatus: active.imageStatus,
        degraded: Boolean(active.degraded)
      })
    );

  const schedule = () => {
    if (destroyed || !enabled || frame !== null || moving || !active || pending) return;
    frame = requestFrame(() => {
      frame = null;
      if (destroyed) return;
      if (retiring) {
        retiring.remove();
        retiring = null;
      }
      if (moving) return;
      desired = currentRecord();
      if (candidate?.size !== desired.size) candidate = null;
      if (active.size === desired.size || failedSizes.has(desired.size)) return;
      if (candidate) {
        let overlay;
        try {
          overlay = createOverlay(candidate.image);
        } catch (error) {
          failedSizes.add(candidate.size);
          candidate = null;
          notify(onError, error);
          return;
        }
        retiring = active.overlay;
        active = { ...candidate, overlay };
        candidate = null;
        publish();
        schedule();
        return;
      }
      const requested = desired;
      pending = prepare(requested)
        .then((prepared) => {
          if (!destroyed && currentRecord().size === requested.size) candidate = prepared;
        })
        .catch((error) => {
          if (!destroyed) {
            failedSizes.add(requested.size);
            notify(onError, error);
          }
        })
        .finally(() => {
          pending = null;
          schedule();
        });
    });
  };

  const prepareInitial = (zoom) => {
    if (destroyed) return Promise.reject(new Error("Base-map controller destroyed."));
    if (initialPromise) return initialPromise;
    const record = selectBaseMapImage(zoom, getPixelRatio());
    initialPromise = prepare(record).catch(async (error) => {
      if (destroyed) throw error;
      failedSizes.add(record.size);
      notify(onError, error);
      const legacy = await prepare(LEGACY_BASE_MAP);
      return { ...legacy, degraded: true };
    });
    return initialPromise;
  };

  const mountInitial = (prepared) => {
    if (destroyed || active) return false;
    active = { ...prepared, overlay: createOverlay(prepared.image) };
    // Release the fulfilled promise's retained image after mounting.
    initialPromise = null;
    publish();
    return true;
  };

  return Object.freeze({
    prepareInitial,
    mountInitial,
    enable() {
      enabled = true;
      schedule();
    },
    reconcile() {
      schedule();
    },
    setMovementActive(value) {
      moving = value;
      if (!moving) schedule();
    },
    getSnapshot() {
      return Object.freeze({
        size: active?.size ?? null,
        preparing: pending !== null,
        stagedSize: candidate?.size ?? null,
        destroyed
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      if (frame !== null) cancelFrame(frame);
      frame = null;
      active?.overlay.remove();
      retiring?.remove();
      active = candidate = retiring = initialPromise = null;
    }
  });
}
