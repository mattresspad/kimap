import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Political View consumes the Stage B foundation without adding persistence or a HUD", async () => {
  const [script, markup, packageJson, store] = await Promise.all([
    source("script.js"),
    source("index.html"),
    source("package.json"),
    source("stores/political-presentation-session.js")
  ]);
  assert.match(script, /from '.\/modules\/political\/index\.js'/);
  assert.match(script, /PoliticalPresentationSession/);
  assert.match(script, /name: 'Political View'/);
  assert.match(markup, /id="faction-colors-panel"/);
  assert.match(markup, /Local Authored Balance/);
  assert.doesNotMatch(store, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(markup, /political-(?:hud|widget)/i);
  assert.match(packageJson, /"audit:political":\s*"node scripts\/audit-political-evidence\.mjs"/);
});

test("political package exports read-only evidence, palette, and raster projections", async () => {
  const [entry, area, evidence, influence, palette, raster, cli] = await Promise.all([
    source("modules/political/index.js"),
    source("modules/political/area-index.js"),
    source("modules/political/evidence.js"),
    source("modules/political/influence.js"),
    source("modules/political/palette.js"),
    source("modules/political/raster.js"),
    source("scripts/audit-political-evidence.mjs")
  ]);
  for (const name of [
    "createPoliticalAreaIndex",
    "createPoliticalEvidenceCatalog",
    "projectPoliticalEvidence",
    "evaluatePoliticalInfluence",
    "createPoliticalPaletteDefaults",
    "createPoliticalRasterProjection"
  ]) {
    assert.match(entry, new RegExp(name));
  }
  assert.match(area, /18003-gamedata\.base/);
  assert.doesNotMatch(area, /51(?:px|\s*pixel)/i);
  assert.doesNotMatch(
    `${area}\n${evidence}\n${influence}\n${palette}\n${raster}`,
    /localStorage|sessionStorage|indexedDB/
  );
  assert.doesNotMatch(cli, /writeFile|appendFile|createWriteStream/);
  assert.doesNotMatch(cli, /Reactive World|ea3e345e/i);
});

test("runtime repainting retains one Leaflet overlay and rejects stale generations", async () => {
  const script = await source("script.js");
  const commit = script.slice(
    script.indexOf("function commitPoliticalRaster("),
    script.indexOf("function refreshPoliticalProjection()")
  );
  assert.match(commit, /generation !== politicalRenderGeneration/);
  assert.match(commit, /!isPoliticalViewActive\(\)/);
  assert.match(commit, /if \(!politicalImageOverlay\)/);
  assert.match(commit, /politicalImageOverlay\.setUrl\(url\)/);
  assert.equal((commit.match(/L\.imageOverlay\(/g) ?? []).length, 1);
  assert.match(script, /politicalViewLayer = L\.layerGroup\(\)/);
  assert.match(script, /pane: 'politicalPane'/);
  assert.match(script, /pane: 'referencePane'/);
  const grid = await source("modules/viewport/debug-grid.js");
  assert.match(grid, /pane: "debugGridPane"/);
  assert.match(grid, /pane\.style\.zIndex = 550/);
});

test("Faction Colors controls use one delegated listener set and direct opacity updates", async () => {
  const script = await source("script.js");
  const view = await source("modules/viewport/faction-colors.js");
  const setup = script.slice(
    script.indexOf("function setupFactionColorsControls()"),
    script.indexOf("function applyViewportComposition(change)")
  );
  assert.match(setup, /if \(factionColorsReady\) return/);
  assert.equal((setup.match(/political-faction-list'\);/g) ?? []).length, 1);
  assert.match(setup, /createFactionColorList/);
  assert.equal((view.match(/list\.addEventListener\("input"/g) ?? []).length, 1);
  assert.equal((view.match(/list\.addEventListener\("click"/g) ?? []).length, 1);
  assert.match(setup, /setOpacity\(Number\(event\.target\.value\) \/ 100\)/);
  assert.doesNotMatch(setup, /activateWorldSurface/);
});

test("external Leaflet surface changes preserve exclusivity and block late default replacement", async () => {
  const script = await source("script.js");
  const synchronization = script.slice(
    script.indexOf("function setupLayerSynchronization()"),
    script.indexOf("function updateProjectZoomControls()")
  );
  const activation = script.slice(
    script.indexOf("function activateWorldSurface("),
    script.indexOf("function setOverlayLayerActive(")
  );
  assert.match(synchronization, /const addedSurface =/);
  assert.match(synchronization, /if \(!applyingWorldSurfaceChoice\) surfaceChoiceTouched = true/);
  assert.match(synchronization, /candidate\.layer !== e\.layer/);
  assert.match(synchronization, /map\.removeLayer\(candidate\.layer\)/);
  assert.match(activation, /applyingWorldSurfaceChoice = true/);
  assert.match(activation, /finally \{\s*applyingWorldSurfaceChoice = false/);
});
