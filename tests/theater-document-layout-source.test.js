import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const sharedCss = readFileSync(new URL("../modules/document-manager.css", import.meta.url), "utf8");
const documentTabs = readFileSync(new URL("../modules/document-tabs.js", import.meta.url), "utf8");
const globalStatusCss = readFileSync(
  new URL("../modules/global-status.css", import.meta.url),
  "utf8"
);
const shellCss = readFileSync(new URL("../modules/top-bar/shell.css", import.meta.url), "utf8");
const paintCss = readFileSync(new URL("../modules/paint-tools.css", import.meta.url), "utf8");
const paintScript = readFileSync(new URL("../modules/paint-tools.js", import.meta.url), "utf8");
const markerCss = readFileSync(new URL("../modules/player-markers.css", import.meta.url), "utf8");
const markerScript = readFileSync(new URL("../modules/player-markers.js", import.meta.url), "utf8");
const prefsCss = readFileSync(new URL("../modules/user-prefs.css", import.meta.url), "utf8");

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source boundary: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

const paintPane = between(html, '<div id="pane-paint-tools"', "<!-- Player Markers Modal -->");
const markerPane = between(
  html,
  '<div id="pane-player-markers"',
  "<!-- User Preferences Modal -->"
);
const scenarioPane = between(html, '<div id="pane-user-prefs"', "<!-- Global Status Modal -->");
const globalStatusPane = between(
  html,
  '<div id="pane-global-status"',
  "<!-- Infamy Tracker Window -->"
);

test("wide account disclosure fits its contents while compact layouts remain bounded panels", () => {
  assert.match(
    shellCss,
    /#top-bar\[data-layout-class="wide"\] #topbar-account-panel\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?min-width:\s*max\(100%, 12rem\);[\s\S]*?max-width:\s*min\(18rem, calc\(100vw - 16px\)\);/
  );
  assert.match(
    shellCss,
    /#top-bar\[data-layout-class="standard"\] \.kimap-shell-disclosure,[\s\S]*?#top-bar\[data-layout-class="narrow"\] \.kimap-shell-disclosure\s*\{[\s\S]*?right:\s*8px;[\s\S]*?left:\s*8px;[\s\S]*?width:\s*auto;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*none;/
  );
});

test("shared document styling owns form geometry after legacy and theme styles", () => {
  const themeIndex = script.indexOf("import './modules/application-theme.css';");
  const sharedIndex = script.indexOf("import './modules/document-manager.css';");
  const shellIndex = script.indexOf("import './modules/top-bar/shell.css';");
  const workbenchIndex = script.indexOf("import './modules/viewport/workbench.css';");

  assert.ok(themeIndex >= 0);
  assert.ok(sharedIndex > themeIndex);
  assert.ok(shellIndex > sharedIndex);
  assert.ok(workbenchIndex > shellIndex);
  assert.equal(occurrences(script, /document-manager\.css/g), 1);
  assert.doesNotMatch(
    `${paintCss}\n${markerCss}\n${prefsCss}`,
    /\.(?:pm-section|pm-details|details-content|io-row|import-controls)\b/
  );
  assert.match(sharedCss, /--document-control-height:\s*3rem;/);
  assert.match(
    sharedCss,
    /\.document-form-row[\s\S]*?align-items:\s*stretch;[\s\S]*?margin:\s*1rem 0 0;/
  );
  assert.match(
    sharedCss,
    /height:\s*var\(--document-control-height\);[\s\S]*?min-height:\s*var\(--document-control-height\);[\s\S]*?margin:\s*0;/
  );
  assert.match(sharedCss, /white-space:\s*nowrap;/);
});

test("Scenario Documents offers file import and export", () => {
  assert.match(scenarioPane, /data-scenario-export/);
  assert.match(scenarioPane, /for="prefs-scenario-import"/);
  assert.match(scenarioPane, /data-scenario-import type="file"/);
});

test("Scenario Documents uses a compact status strip for anonymous readers", () => {
  assert.match(script, /createScenarioDocumentPresentation/);
  assert.match(
    script,
    /status\.closest\('\[data-scenario-document-state\]'\)\?\.setAttribute\([\s\S]*?'data-scenario-document-state',[\s\S]*?presentation\.state/
  );
  assert.match(
    scenarioPane,
    /class="prefs-session-strip" aria-label="Current session"[\s\S]*?id="prefs-manifest-id"[\s\S]*?data-scenario-document-state="new"[\s\S]*?class="prefs-session-status-dot" aria-hidden="true"[\s\S]*?id="prefs-loaded-save"[^>]*aria-live="polite"/
  );
  assert.doesNotMatch(scenarioPane, /Special:|prefs-account-link/);
  assert.match(
    prefsCss,
    /#prefs-content\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;/
  );
  assert.match(prefsCss, /#prefs-content\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto;/);
  assert.match(
    prefsCss,
    /\.prefs-session-strip\s*\{[\s\S]*?grid-template-columns:\s*minmax\(10rem, 0\.55fr\) minmax\(0, 1\.45fr\);[\s\S]*?min-height:\s*3\.5rem;/
  );
  assert.match(
    prefsCss,
    /\.prefs-account-links\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/
  );
  assert.match(
    prefsCss,
    /\.prefs-account-link\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?min-height:\s*4rem;/
  );
  assert.match(prefsCss, /@container user-prefs-pane \(max-width:\s*40rem\)/);
  assert.match(
    prefsCss,
    /@container user-prefs-pane \(max-width:\s*40rem\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/
  );
  assert.doesNotMatch(prefsCss, /@media\b/);
});

test("Paint and Marker managers share fixed activity strips and one tabbed document surface", () => {
  for (const [pane, prefix] of [
    [paintPane, "paint"],
    [markerPane, "pm"]
  ]) {
    assert.match(pane, /class="window-pane document-manager-pane"/);
    assert.match(pane, /class="document-manager"/);
    assert.match(
      pane,
      new RegExp(
        `document-manager__activity[\\s\\S]*?id="${prefix}-clear-all-btn"[\\s\\S]*?id="${prefix}-logger"`
      )
    );
    assert.match(
      pane,
      /document-manager__documents document-form-surface[\s\S]*?role="tablist"[^>]*aria-orientation="horizontal"[\s\S]*?data-document-tab="save"[\s\S]*?data-document-tab="load"[\s\S]*?document-manager__panel-deck/
    );
    assert.match(pane, new RegExp(`id="${prefix}-save-tab"[\\s\\S]*?aria-selected="true"`));
    assert.match(pane, new RegExp(`id="${prefix}-load-tab"[\\s\\S]*?aria-selected="false"`));
    assert.doesNotMatch(pane, /document-form-row--manager-save/);
    assert.match(pane, /document-form-row--manager-file/);
    assert.doesNotMatch(pane, /document-form-row--manager-load/);
    assert.doesNotMatch(pane, /<details\b|<summary\b/);
  }

  assert.match(
    sharedCss,
    /\.document-manager\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?overflow:\s*hidden;/
  );
  assert.match(
    sharedCss,
    /\.document-manager__io\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);/
  );
  assert.match(
    sharedCss,
    /\.document-manager__activity\s*\{[\s\S]*?grid-template-columns:\s*14rem minmax\(0, 1fr\);[\s\S]*?height:\s*5\.5rem;/
  );
  assert.match(
    sharedCss,
    /\.document-manager__clear\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/
  );
  assert.match(
    sharedCss,
    /\.document-manager__documents\s*\{[\s\S]*?grid-template-rows:\s*var\(--document-control-height\) minmax\(0, 1fr\);[\s\S]*?overflow:\s*hidden;/
  );
  assert.match(
    sharedCss,
    /\.document-manager__tablist\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    sharedCss,
    /\.document-manager__panel-deck\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-gutter:\s*stable;/
  );
});

test("manager stacking is pane-local and restores one outer scroll flow", () => {
  assert.doesNotMatch(sharedCss, /@media\b/);
  assert.match(sharedCss, /@container document-manager-pane \(max-width:\s*64rem\)/);
  assert.match(
    sharedCss,
    /\.document-manager__collection\s*\{\s*height:\s*clamp\(20rem, 55dvh, 32rem\);/
  );
  assert.match(
    sharedCss,
    /\.document-manager__io\s*\{[\s\S]*?grid-template-rows:\s*auto auto;[\s\S]*?min-height:\s*auto;[\s\S]*?overflow:\s*visible;/
  );
  assert.match(sharedCss, /\.document-manager__panel-deck\s*\{[\s\S]*?overflow:\s*visible;/);
});

test("document control identities, file associations, and Save-first tabs remain stable", () => {
  const ids = [
    "paint-clear-all-btn", "paint-file-export-btn", "paint-file-import-input",
    "pm-clear-all-btn", "pm-file-export-btn", "pm-file-import-input",
    "prefs-scenario-import", "import-history-file", "export-history-btn"
  ];

  for (const id of ids) {
    assert.equal(occurrences(html, new RegExp(`id="${id}"`, "g")), 1, `${id} must remain unique`);
  }

  assert.match(paintPane, /id="paint-export-section"[^>]*role="tabpanel"/);
  assert.match(paintPane, /id="paint-import-section"[^>]*role="tabpanel"[^>]*hidden/);
  assert.match(markerPane, /id="pm-export-section"[^>]*role="tabpanel"/);
  assert.match(markerPane, /id="pm-import-section"[^>]*role="tabpanel"[^>]*hidden/);
  assert.match(paintPane, /for="paint-file-import-input"/);
  assert.match(markerPane, /for="pm-file-import-input"/);
  assert.doesNotMatch(
    `${paintPane}\n${markerPane}\n${scenarioPane}`,
    /class="[^"]*\b(?:pm-section|pm-details|details-content|io-row|import-controls)\b/
  );
});

test("Export and Import panels describe local files", () => {
  for (const pane of [paintPane, markerPane]) {
    assert.equal(occurrences(pane, /class="document-manager__notice"/g), 1);
    assert.equal(occurrences(pane, /warning-text document-manager__notice/g), 1);
    assert.match(pane, /Ready for file import or export\./);
  }
  assert.match(
    sharedCss,
    /\.document-manager__notice\s*\{[\s\S]*?min-height:\s*3rem;[\s\S]*?font-size:\s*1rem;[\s\S]*?font-style:\s*normal;[\s\S]*?line-height:\s*1\.35;/
  );
  for (const source of [paintScript, markerScript]) assert.match(source, /Export JSON to keep a copy/);
});

test("document tabs initialize before map loading and retain local automatic keyboard state", () => {
  const controllerImport = script.indexOf("import { createDocumentTabController }");
  const controllerInit = script.indexOf("document.querySelectorAll('[data-document-tabs]')");
  const mapRequest = script.indexOf("const apiUrl = buildMapDataApiUrl(");

  assert.ok(controllerImport >= 0);
  assert.ok(controllerInit > controllerImport);
  assert.ok(mapRequest > controllerInit);
  assert.match(
    documentTabs,
    /["']ArrowLeft["'][\s\S]*?["']ArrowRight["'][\s\S]*?["']Home["'][\s\S]*?["']End["']/
  );
  assert.match(documentTabs, /entry\.panel\.hidden = !active/);
  assert.match(documentTabs, /entry\.tab\.tabIndex = active \? 0 : -1/);
  assert.match(documentTabs, /activate\(entries\[nextIndex\]\.id, \{ focus: true \}\)/);
  assert.doesNotMatch(documentTabs, /localStorage|sessionStorage|fetch\(/);
});

test("owner-published document artwork uses exact Worker masks and text-complete controls", () => {
  const version = "2026-07-13-1";
  const maskIcons = [
    "export-cloud-icon.svg",
    "import-cloud-icon.svg",
    "save-folder-icon.svg",
    "load-folder-icon.svg",
    "clear-data-icon.svg",
    "caravan-save-simple.svg",
    "caravan-save-as.svg",
    "caravan-download.svg",
    "marker-window-rename.svg",
    "marker-window-edit.svg",
    "marker-window-delete.svg",
    "paint-window-undo.svg",
    "paint-window-delete.svg"
  ];

  for (const file of maskIcons) {
    assert.match(
      sharedCss,
      new RegExp(
        `kim-asset:/icons/${file.replace(".", "\\.")}\\?v=${version}`
      )
    );
  }
  assert.match(sharedCss, /background:\s*currentcolor;/);
  assert.match(sharedCss, /mask:\s*var\(--kimap-document-icon-mask\)/);
  assert.doesNotMatch(`${html}\n${sharedCss}`, /save-disc-icon|kimap-document-icon--save-disc/);
  assert.equal(occurrences(html, /kimap-document-icon--save-simple/g), 0);
  assert.equal(occurrences(html, /kimap-document-icon--save-as/g), 0);
  assert.equal(occurrences(html, /kimap-document-icon--download/g), 0);
  for (const className of [
    "marker-rename",
    "marker-edit",
    "marker-delete",
    "paint-undo",
    "paint-delete"
  ]) {
    assert.equal(occurrences(html, new RegExp(`kimap-document-icon--${className}`, "g")), 1);
  }
  assert.match(scenarioPane, /Export scenario JSON/);
  assert.match(paintPane, /kimap-document-icon--paint-undo[\s\S]*?>Undo Last</);
  assert.match(paintPane, /kimap-document-icon--paint-delete[\s\S]*?>Delete Selected</);
  assert.match(markerPane, /kimap-document-icon--marker-rename[\s\S]*?>Rename</);
  assert.match(markerPane, /kimap-document-icon--marker-edit[\s\S]*?>Edit Notes</);
  assert.match(markerPane, /kimap-document-icon--marker-delete[\s\S]*?>Delete</);
  assert.equal(occurrences(`${paintPane}\n${markerPane}`, /kimap-document-icon--clear-data/g), 2);
  assert.match(paintPane, /kimap-document-icon--clear-data[\s\S]*?Clear All Drawings/);
  assert.match(markerPane, /kimap-document-icon--clear-data[\s\S]*?Clear All Markers/);
  assert.match(globalStatusPane, /kimap-document-icon--export-cloud[\s\S]*?Export Scenario JSON/);
  assert.match(globalStatusPane, /kimap-document-icon--import-cloud[\s\S]*?Import Scenario JSON/);
  assert.doesNotMatch(
    `${paintPane}\n${markerPane}\n${globalStatusPane}\n${sharedCss}`,
    /(?:src|url)=[("']*\.?\/?icons\/(?:export-cloud|import-cloud|load-folder|save-folder)-icon/
  );
});

test("file managers omit remote saved-document selectors", () => {
  assert.doesNotMatch(html, /id="(?:paint-import-select|pm-import-select|import-save-select)"/);
});

test("Global Status uses bounded rows and pane-local overflow fallbacks", () => {
  assert.match(
    globalStatusCss,
    /#pane-global-status\s*\{\s*container:\s*global-status-pane \/ size;/
  );
  assert.match(
    globalStatusCss,
    /#status-workspace\s*\{[\s\S]*?grid-template-rows:\s*minmax\(15rem, 1fr\) 14rem;[\s\S]*?overflow-x:\s*hidden;/
  );
  assert.match(
    globalStatusCss,
    /#status-footer\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 2fr\) minmax\(18rem, 1fr\);/
  );
  assert.match(globalStatusCss, /grid-template-rows:\s*auto repeat\(3, 3rem\);/);
  assert.match(globalStatusCss, /@container global-status-pane \(max-height:\s*30rem\)/);
  assert.match(globalStatusCss, /@container global-status-pane \(max-width:\s*48rem\)/);
  assert.match(
    globalStatusCss,
    /@container global-status-pane \(max-width:\s*36rem\)[\s\S]*?#status-workspace\s*\{[\s\S]*?grid-template-rows:\s*max-content max-content;[\s\S]*?#status-main-view\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?grid-template-rows:\s*repeat\(3, 16rem\);[\s\S]*?min-height:\s*50rem;/
  );
  assert.match(
    globalStatusCss,
    /#status-footer\s*\{[\s\S]*?grid-template-rows:\s*14rem 14rem;[\s\S]*?min-height:\s*calc\(29rem \+ 0\.75rem\);/
  );
  assert.doesNotMatch(globalStatusCss, /height:\s*250px/);
  assert.doesNotMatch(globalStatusCss, /@media\b/);
});

test("the current release changes only application bundle cache tags", () => {
  const tag = "2026-11-07-vanilla-r2-v1";
  assert.equal(occurrences(html, new RegExp(tag, "g")), 2);
  assert.match(html, new RegExp(`dist/bundle\\.css\\?v=${tag}`));
  assert.match(html, new RegExp(`dist/bundle\\.js\\?v=${tag}`));
});
