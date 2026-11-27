import assert from "node:assert/strict";
import test from "node:test";
import { createDebugGridController } from "../modules/viewport/debug-grid.js";

function fixture() {
  const frames = [];
  const panes = new Map();
  const images = [];
  const live = new Set();
  const layer = {
    children: [],
    addLayer(image) {
      this.children.push(image);
    }
  };
  const map = {
    hasLayer: (candidate) => live.has(candidate),
    getPane: (name) => panes.get(name),
    createPane(name) {
      const pane = { style: {} };
      panes.set(name, pane);
      return pane;
    }
  };
  const controller = createDebugGridController({
    map,
    layer,
    width: 8192,
    height: 8192,
    requestFrame: (callback) => frames.push(callback),
    leaflet: {
      imageOverlay(url, bounds, options) {
        const image = {
          url,
          bounds,
          options,
          updates: 0,
          setUrl(value) {
            this.url = value;
            this.updates++;
          }
        };
        images.push(image);
        return image;
      }
    }
  });
  const flush = () => {
    for (const callback of frames.splice(0)) callback();
  };
  const svg = () => decodeURIComponent(images[0].url.split(",")[1]);
  return { controller, map, layer, frames, images, panes, live, flush, svg };
}

test("grid preserves its geometry, passive pane and one image through recoloring and reactivation", () => {
  const f = fixture();
  f.live.add(f.layer);
  f.controller.ensureOverlay();
  const original = f.svg();
  assert.match(original, /stroke="#00ffff"/);
  assert.equal((original.match(/<line /g) ?? []).length, 514);
  assert.equal((original.match(/stroke-width="4" opacity="0.6"/g) ?? []).length, 514);
  assert.match(original, /x1="32" y1="0" x2="32" y2="8192"/);
  assert.deepEqual(f.images[0].bounds, [
    [0, 0],
    [8192, 8192]
  ]);
  assert.deepEqual(f.images[0].options, { pane: "debugGridPane", interactive: false });
  assert.deepEqual(f.panes.get("debugGridPane").style, { zIndex: 550, pointerEvents: "none" });
  for (const color of ["#123456", "#778899", "#AABBCC"]) f.controller.setColor(color);
  assert.equal(f.frames.length, 1);
  assert.equal(f.images[0].updates, 0);
  f.flush();
  assert.equal(f.images[0].updates, 1);
  assert.equal(f.svg().replace("#aabbcc", "#00ffff"), original);
  assert.equal(f.controller.setColor("#AABBCC"), false);
  assert.equal(f.frames.length, 0);
  f.live.clear();
  f.controller.setColor("#223344");
  assert.equal(f.frames.length, 0);
  f.live.add(f.layer);
  f.controller.ensureOverlay();
  f.controller.ensureOverlay();
  assert.equal(f.images.length, 1);
  assert.deepEqual(f.layer.children, f.images);
  assert.equal(f.images[0].updates, 2);
  assert.match(f.svg(), /stroke="#223344"/);
});

test("grid drops a pending inactive paint and retains the latest valid color without SVG injection", () => {
  const f = fixture();
  f.live.add(f.layer);
  f.controller.ensureOverlay();
  f.controller.setColor("#123456");
  f.live.clear();
  f.flush();
  assert.equal(f.images[0].updates, 0);
  for (const invalid of [null, "cyan", "#fff", '#123456" onload="alert(1)']) {
    assert.equal(f.controller.setColor(invalid), false);
  }
  f.live.add(f.layer);
  f.controller.ensureOverlay();
  assert.match(f.svg(), /stroke="#123456"/);
  assert.equal(f.images[0].updates, 1);
});
