import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const start = script.indexOf("function initializeConfigurationLayerDescriptors()");
const end = script.indexOf("function applyViewportComposition(change)", start);
assert.ok(start >= 0 && end > start);
const setupSource = script.slice(start, end);

function controlsFixture() {
  const ids = [
    "map-container",
    "map-road-native-color",
    "map-road-custom-color",
    "map-border-color",
    "map-debug-grid-color",
    "map-road-match-btn",
    "map-road-highvis-btn",
    "map-road-reset-btn"
  ];
  const elements = new Map(
    ids.map((id) => [
      id,
      {
        value: "",
        listeners: new Map(),
        addEventListener(event, listener) {
          const listeners = this.listeners.get(event) ?? [];
          listeners.push(listener);
          this.listeners.set(event, listeners);
        }
      }
    ])
  );
  const colors = new Map();
  elements.get("map-container").style = {
    setProperty: (name, value) => colors.set(name, value),
    removeProperty: (name) => colors.delete(name)
  };
  elements.get("map-road-native-color").value = "#dfa959";
  elements.get("map-road-custom-color").value = "#ffaa00";
  elements.get("map-border-color").value = "#000000";
  const borderLayer = {};
  const gridLayer = {};
  const live = new Set([borderLayer]);
  const renderedBorders = [];
  const gridColors = [];
  const context = {
    document: { getElementById: (id) => elements.get(id) },
    map: { hasLayer: (layer) => live.has(layer) },
    roadLayer: {},
    spawnBorderLayer: borderLayer,
    debugGridLayer: gridLayer,
    debugGridController: { setColor: (color) => gridColors.push(color) },
    renderSpawnBorders: (color) => renderedBorders.push(color),
    renderLayerPresentation() {}
  };
  runInNewContext(
    `let layerConfigurationReady = false; let configurationLayerDescriptors = null; ${setupSource}
    setupLayerConfigurationControls(); setupLayerConfigurationControls();`,
    context
  );
  const fire = (id, event, value) => {
    const element = elements.get(id);
    if (value !== undefined) element.value = value;
    for (const listener of element.listeners.get(event) ?? []) listener({ target: element });
  };
  return { elements, colors, live, renderedBorders, gridLayer, gridColors, fire };
}

test("persistent color controls wire once and retain native/custom, match, high-visibility, and reset effects", () => {
  const { elements, colors, fire } = controlsFixture();
  for (const [id, element] of elements) {
    if (id === "map-container") continue;
    assert.equal([...element.listeners.values()].flat().length, 1, `${id} wires exactly once`);
  }
  fire("map-road-native-color", "input", "#112233");
  fire("map-road-custom-color", "input", "#445566");
  assert.equal(colors.get("--road-color-native"), "#112233");
  assert.equal(colors.get("--road-color-custom"), "#445566");
  fire("map-road-match-btn", "click");
  assert.equal(elements.get("map-road-custom-color").value, "#112233");
  assert.equal(colors.get("--road-color-custom"), "#112233");
  fire("map-road-highvis-btn", "click");
  assert.equal(colors.get("--road-color-native"), "#00ffff");
  assert.equal(colors.get("--road-color-custom"), "#ff00ff");
  fire("map-road-reset-btn", "click");
  assert.equal(elements.get("map-road-native-color").value, "#dfa959");
  assert.equal(elements.get("map-road-custom-color").value, "#ffaa00");
  assert.equal(colors.size, 0);
});

test("border color repaint uses the existing renderer only while the border layer is live", () => {
  const { live, renderedBorders, fire } = controlsFixture();
  fire("map-border-color", "input", "#336699");
  assert.deepEqual(renderedBorders, ["#336699"]);
  live.clear();
  fire("map-border-color", "input", "#ff0000");
  assert.deepEqual(renderedBorders, ["#336699"]);
});

test("grid picker reaches only the existing grid controller while its layer is active", () => {
  const { live, gridLayer, gridColors, renderedBorders, fire } = controlsFixture();
  fire("map-debug-grid-color", "input", "#445566");
  assert.deepEqual(gridColors, []);
  live.add(gridLayer);
  fire("map-debug-grid-color", "input", "#778899");
  assert.deepEqual(gridColors, ["#778899"]);
  assert.deepEqual(renderedBorders, []);
});
