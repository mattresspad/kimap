import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, script, legacyCss, workbenchCss, paint] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../script.js", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../modules/viewport/workbench.css", import.meta.url), "utf8"),
  readFile(new URL("../modules/paint-tools.js", import.meta.url), "utf8")
]);

test("legacy content panel and dormant cleanup paths are completely absent", () => {
  for (const source of [html, script, legacyCss, workbenchCss]) {
    assert.doesNotMatch(source, /content-panel/);
  }
  assert.doesNotMatch(script, /showContentPanel|activeSpawnAreaIds|getClassifiedSpawnData/);
  assert.doesNotMatch(paint, /close-paint-manager-btn|paint-manager-backdrop/);
  assert.match(script, /windowManager\.open\('paint'\)/);
});

test("reference inspector owns safe curated markup and one delegated action route", () => {
  assert.match(html, /id="info-panel-reference-content"/);
  assert.match(html, /id="info-panel-reference-back-btn"/);
  assert.match(html, /id="info-panel-map-context-btn"/);
  assert.match(html, /id="info-panel-return-reference-btn"/);
  assert.doesNotMatch(html, /id="info-panel-title"[^>]*x-text/);
  assert.match(script, /createReferenceInspector/);
  assert.match(script, /new ReferenceNavigationSession/);
  assert.match(script, /let pendingReferenceFocus = \[\]/);
  assert.match(script, /referenceLinkKey/);
  assert.match(script, /referenceVisible \? 'Reference context' : 'Selected map context'/);
  assert.doesNotMatch(html, /id="open-favorites-btn"/);
  assert.doesNotMatch(script, /innerHTML\s*=\s*`[\s\S]*JSON\.stringify/);
});

test("Browse and Quick Search expose the exact Stage D reference families", () => {
  const browseOrder = [
    "createSection('Spawn Areas'",
    "'Towns',",
    "'Nests',",
    "createSection('Squads'",
    "createSection('Factions'",
    "createSection('Characters'",
    "itemsSummary.textContent = 'Items & Equipment'"
  ].map((needle) => script.indexOf(needle));
  assert.ok(browseOrder.every((position) => position >= 0));
  assert.deepEqual(
    browseOrder,
    [...browseOrder].sort((left, right) => left - right)
  );
  for (const [listId, entityType] of [
    ["nests-list", "nest"],
    ["squads-list", "squad"],
    ["characters-list", "character"],
    ["factions-list", "faction"],
    ["items-list", "item"],
    ["weapons-list", "weapon"],
    ["crossbows-list", "crossbow"],
    ["armour-list", "armour"],
    ["map-items-list", "mapItem"],
    ["nest-items-list", "nestItem"]
  ]) {
    assert.match(script, new RegExp(`'${listId}': '${entityType}'`));
    assert.match(
      script,
      new RegExp(`'${entityType}': discoverySearchDatabase\\('${entityType}'\\)`)
    );
  }
  assert.match(script, /topBarController\.setSearchRecords\(searchDatabases\)/);
  assert.match(script, /createSearchActivationRoute\(record\)/);
  assert.match(
    script,
    /return showReferenceRoot\([\s\S]*?activation\.entityType,[\s\S]*?activation\.entityId/
  );
  assert.match(script, /event\.key !== 'Enter'/);
  assert.match(script, /event\.target\.tagName === 'OPTION'/);
});

test("geographic population links push exact Squad and Nest identities", () => {
  assert.match(html, /showReference\(squad\.entityType, squad\.entityId, \$el\)/);
  assert.match(html, /showReference\(res\.entityType, res\.entityId, \$el\)/);
  assert.match(script, /occurrence\.type === 'Nest' \? 'nest' : 'squad'/);
});

test("application shell cache tag changes only the application CSS and JavaScript references", () => {
  assert.match(html, /dist\/bundle\.css\?v=2026-11-07-vanilla-r2-v1/);
  assert.match(html, /dist\/bundle\.js\?v=2026-11-07-vanilla-r2-v1/);
  assert.match(script, /@picocss\/pico/);
  assert.match(workbenchCss, /reference-relationship-row/);
});
