import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BASE_MAP_IMAGES,
  BASE_MAP_REVISION,
  baseMapPreviewPath,
  isBaseMapLocalPreview,
  selectBaseMapImage
} from "../modules/viewport/base-map-resolution.js";
import {
  createBaseMapImageController,
  loadBaseMapImage
} from "../modules/viewport/base-map-image-controller.js";
import { parseMapViewport } from "../modules/selection/deep-link.js";

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test("base-image resolution follows fractional zoom and density without changing map limits", () => {
  assert.deepEqual(
    [-4, -3, -2, -1, 0, 1, 2].map((z) => selectBaseMapImage(z).size),
    [512, 1024, 2048, 4096, 8192, 8192, 8192]
  );
  assert.deepEqual(
    [-4, -3, -2, -1].map((z) => selectBaseMapImage(z, 2).size),
    [1024, 2048, 4096, 8192]
  );
  assert.equal(selectBaseMapImage(-2.5).size, 2048);
  for (const ratio of [NaN, Infinity, 0, -1]) assert.equal(selectBaseMapImage(-4, ratio).size, 512);
  assert.equal(selectBaseMapImage(-100).size, 512);
  assert.equal(selectBaseMapImage(100).size, 8192);
  assert.equal(selectBaseMapImage(undefined).size, 512);
  assert.ok(Object.isFrozen(BASE_MAP_IMAGES[0]));
});

test("early shared viewport hints use existing v1 validation without a catalog", () => {
  assert.deepEqual(parseMapViewport("#view=1&cx=0&cz=0&zoom=-2.5"), {
    center: { x: 0, z: 0 },
    zoom: -2.5
  });
  for (const fragment of [
    "",
    "#view=2&cx=0&cz=0&zoom=-4",
    "#view=1&cx=0&cz=0&zoom=-5",
    "#view=1&cx=999999&cz=0&zoom=-4",
    "#view=1&cx=&cz=0&zoom=0",
    "#view=1&" + "x".repeat(2048)
  ]) {
    assert.equal(parseMapViewport(fragment), null);
  }
});

test("preview resolution is loopback-only and uses registered files", () => {
  assert.equal(
    isBaseMapLocalPreview({ hostname: "127.0.0.1", search: "?baseMapPreview=local" }),
    true
  );
  assert.equal(
    isBaseMapLocalPreview({ hostname: "map.kenshi.wiki", search: "?baseMapPreview=local" }),
    false
  );
  assert.equal(isBaseMapLocalPreview({ hostname: "localhost", search: "" }), false);
  assert.equal(
    baseMapPreviewPath(BASE_MAP_IMAGES[0]),
    `/__dev/base-map/${BASE_MAP_REVISION}/Kenshi_Map_512.webp`
  );
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<link[^>]+rel=["']preload["'][^>]+Kenshi_Map/);
});

function harness() {
  let zoom = -4,
    ratio = 1,
    next = 0;
  const frames = new Map(),
    requests = [],
    overlays = [],
    errors = [];
  const controller = createBaseMapImageController({
    getZoom: () => zoom,
    getPixelRatio: () => ratio,
    resolveUrls: (r) => ["edge/" + r.path, "origin/" + r.path],
    loadImage: (url, size, { signal }) =>
      new Promise((resolve, reject) => {
        requests.push({
          url,
          size,
          signal,
          resolve: () => resolve({ image: { size }, size, url, imageStatus: "decoded" }),
          reject
        });
      }),
    createOverlay: (image) => {
      const overlay = {
        size: image.size,
        removed: false,
        remove() {
          this.removed = true;
        }
      };
      overlays.push(overlay);
      return overlay;
    },
    requestFrame: (fn) => {
      frames.set(++next, fn);
      return next;
    },
    cancelFrame: (id) => frames.delete(id),
    onError: (e) => errors.push(e)
  });
  return {
    controller,
    requests,
    overlays,
    frames,
    errors,
    zoom: (z) => {
      zoom = z;
      controller.reconcile();
    },
    ratio: (r) => {
      ratio = r;
      controller.reconcile();
    },
    frame: () => {
      const entry = frames.entries().next().value;
      if (entry) {
        frames.delete(entry[0]);
        entry[1]();
      }
    },
    async initial(z = -4) {
      zoom = z;
      const promise = controller.prepareInitial(z);
      requests.at(-1).resolve();
      controller.mountInitial(await promise);
      controller.enable();
      this.frame();
    }
  };
}

test("initial shared image is retained through intermediate fitting until navigation is ready", async () => {
  const h = harness();
  const prepared = h.controller.prepareInitial(-1);
  h.requests[0].resolve();
  h.controller.mountInitial(await prepared);
  h.zoom(-4);
  h.frame();
  assert.equal(h.requests.length, 1);
  h.zoom(-1);
  h.controller.enable();
  h.frame();
  assert.equal(h.requests.length, 1);
  assert.equal(h.controller.getSnapshot().size, 4096);
  h.controller.destroy();
});

test("one displayed image remains until decoded replacement; no work during motion or same-size pans", async () => {
  const h = harness();
  await h.initial();
  assert.equal(h.requests.length, 1);
  h.controller.reconcile();
  h.frame();
  assert.equal(h.requests.length, 1);
  h.controller.setMovementActive(true);
  h.zoom(-3);
  h.frame();
  assert.equal(h.requests.length, 1);
  h.controller.setMovementActive(false);
  h.frame();
  assert.equal(h.requests.length, 2);
  assert.equal(h.overlays[0].removed, false);
  h.requests[1].resolve();
  await settle();
  assert.equal(h.controller.getSnapshot().size, 512);
  h.frame();
  assert.equal(h.controller.getSnapshot().size, 1024);
  assert.equal(h.overlays[0].removed, false);
  h.frame();
  assert.equal(h.overlays[0].removed, true);
  assert.equal(h.overlays.filter((o) => !o.removed).length, 1);
  h.controller.destroy();
});

test("latest direction wins while preparation is in flight and commit waits for movement", async () => {
  const h = harness();
  await h.initial();
  h.zoom(-3);
  h.frame();
  h.zoom(-2);
  h.frame();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve();
  await settle();
  h.frame();
  assert.equal(h.overlays.length, 1);
  assert.equal(h.requests.at(-1).size, 2048);
  h.controller.setMovementActive(true);
  h.requests.at(-1).resolve();
  await settle();
  h.frame();
  assert.equal(h.overlays.length, 1);
  h.controller.setMovementActive(false);
  h.frame();
  assert.equal(h.controller.getSnapshot().size, 2048);
  h.frame();
  h.controller.destroy();
});

test("failed replacement tries origin once, retains image, and does not retry on pans", async () => {
  const h = harness();
  await h.initial();
  h.zoom(-3);
  h.frame();
  h.requests[1].reject(new Error("edge failure"));
  await settle();
  assert.ok(h.requests[2].url.startsWith("origin/"));
  h.requests[2].reject(new Error("origin failure"));
  await settle();
  h.frame();
  for (let i = 0; i < 3; i++) {
    h.controller.reconcile();
    h.frame();
  }
  assert.equal(h.requests.length, 3);
  assert.equal(h.controller.getSnapshot().size, 512);
  assert.equal(h.overlays[0].removed, false);
  h.controller.destroy();
});

test("initial fallback is bounded and can mount the retained legacy image", async () => {
  const h = harness();
  const ready = h.controller.prepareInitial(-4);
  h.requests[0].reject(new Error("missing"));
  await settle();
  h.requests[1].reject(new Error("missing"));
  await settle();
  assert.equal(h.requests[2].url, "edge/data/overlays/Kenshi_Map.webp");
  h.requests[2].resolve();
  const prepared = await ready;
  assert.equal(prepared.degraded, true);
  h.controller.mountInitial(prepared);
  h.controller.enable();
  h.frame();
  assert.equal(h.requests.length, 3);
  h.controller.destroy();
});

test("DPR changes reconcile without navigation and destruction ignores late preparation", async () => {
  const h = harness();
  await h.initial();
  h.ratio(2);
  h.frame();
  assert.equal(h.requests[1].size, 1024);
  h.controller.destroy();
  assert.equal(h.requests[1].signal.aborted, true);
  h.requests[1].resolve();
  await settle();
  h.frame();
  assert.equal(h.overlays.length, 1);
  assert.ok(h.overlays.every((o) => o.removed));
  assert.equal(h.frames.size, 0);
});

function fakeImage() {
  const listeners = new Map();
  return {
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
    src: "",
    addEventListener: (t, f) => listeners.set(t, f),
    removeEventListener: (t, f) => {
      if (listeners.get(t) === f) listeners.delete(t);
    },
    removeAttribute() {
      this.src = "";
    },
    emit(t) {
      listeners.get(t)?.();
    },
    listeners,
    decode: async () => {}
  };
}
test("image loader waits for decode, validates dimensions, and cleans listeners", async () => {
  const image = fakeImage();
  let decode;
  image.decode = () => new Promise((resolve) => (decode = resolve));
  const ready = loadBaseMapImage("image", 512, { createImage: () => image });
  assert.equal(image.crossOrigin, "anonymous");
  image.naturalWidth = image.naturalHeight = 512;
  image.emit("load");
  assert.equal(image.listeners.size, 2);
  decode();
  assert.equal((await ready).imageStatus, "decoded");
  assert.equal(image.listeners.size, 0);
  const wrong = fakeImage();
  const failure = loadBaseMapImage("wrong", 512, { createImage: () => wrong });
  wrong.naturalWidth = 1024;
  wrong.naturalHeight = 1024;
  wrong.emit("load");
  await assert.rejects(failure);
  assert.equal(wrong.src, "");
});
test("image loader handles rejected decode, cancellation, and bounded timeout", async () => {
  const image = fakeImage();
  image.decode = async () => {
    throw new Error("decode");
  };
  const ready = loadBaseMapImage("image", 512, { createImage: () => image });
  image.naturalWidth = image.naturalHeight = 512;
  image.emit("load");
  assert.equal((await ready).imageStatus, "loaded");
  const abort = new AbortController(),
    cancelled = fakeImage();
  const promise = loadBaseMapImage("cancelled", 512, {
    createImage: () => cancelled,
    signal: abort.signal
  });
  abort.abort();
  await assert.rejects(promise, /cancelled/);
  assert.equal(cancelled.listeners.size, 0);
  await assert.rejects(loadBaseMapImage("timeout", 512, { createImage: fakeImage, timeoutMs: 1 }));
});
