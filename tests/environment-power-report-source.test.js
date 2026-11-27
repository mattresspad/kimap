import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Environment Info uses safe delegated rendering, accessible area buttons, and curated details", () => {
  const source = read("../modules/environment-info.js");
  const model = read("../modules/environment-info-model.js");
  const html = read("../index.html");

  assert.doesNotMatch(source, /innerHTML|JSON\.stringify/u);
  assert.match(source, /document\.createElement/u);
  assert.match(source, /\.textContent = text/u);
  assert.match(source, /replaceChildren/u);
  assert.match(source, /paneElement\.addEventListener\("click"/u);
  assert.match(source, /closest\("\[data-environment-area-id\]"\)/u);
  assert.match(source, /button\.type = "button"/u);
  assert.match(source, /aria-pressed/u);
  assert.match(source, /let selectedAreaId = null/u);
  assert.match(source, /"Area Profile"/u);
  assert.match(source, /"Environment"/u);
  assert.match(source, /"Resources & Fertility"/u);
  assert.match(source, /createElement\("div", "environment-details__fact-row"\)/u);
  assert.match(source, /row\.append\(createElement\("dt"[\s\S]*createElement\("dd"/u);
  assert.doesNotMatch(source, /"Homeless-spawn amount"|"Nest count"|"Fixed-marker behavior"/u);
  assert.match(model, /homelessSpawnAmount: finiteValue/u);
  assert.match(model, /nestCount: finiteValue/u);
  assert.match(model, /fixedMarkersOnly: booleanValue/u);
  assert.match(model, /2: "Acid Rain"/u);
  assert.match(model, /exactIndex/u);
  assert.match(html, /id="env-details-list" class="env-list" aria-live="polite"/u);
  assert.doesNotMatch(html, /inspect raw data/u);
});

test("Environment and Power Ranks use pane-local overflow rules without responsive JavaScript", () => {
  const environmentCss = read("../modules/environment-info.css");
  const powerCss = read("../modules/power-ranks.css");
  const environmentSource = read("../modules/environment-info.js");
  const powerSource = read("../modules/power-ranks.js");

  assert.match(environmentCss, /container: environment-pane \/ inline-size/u);
  assert.match(environmentCss, /@container environment-pane \(max-width: 56rem\)/u);
  assert.match(environmentCss, /#environment-content li::marker[\s\S]*content: ""/u);
  assert.match(environmentCss, /overflow-x: hidden/u);
  assert.match(environmentCss, /\.env-list \{[\s\S]*overflow: visible/u);
  assert.match(
    environmentCss,
    /\.environment-details__fact-row \{[\s\S]*grid-template-columns: minmax\(6\.5rem, 0\.9fr\) minmax\(0, 1\.1fr\)/u
  );
  assert.match(
    environmentCss,
    /\.environment-details__fact-row \+ \.environment-details__fact-row \{[\s\S]*border-top:/u
  );
  assert.match(
    environmentCss,
    /\.environment-details__fact-row dt \{[\s\S]*overflow-wrap: anywhere;[\s\S]*border-right:/u
  );
  assert.match(
    environmentCss,
    /\.environment-details__fact-row dd \{[\s\S]*overflow-wrap: anywhere/u
  );
  assert.match(powerCss, /container: power-ranks-pane \/ inline-size/u);
  assert.match(powerCss, /@container power-ranks-pane \(max-width: 48rem\)/u);
  assert.match(powerCss, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(powerCss, /\.power-rank-report[\s\S]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.doesNotMatch(
    `${environmentSource}\n${powerSource}`,
    /matchMedia|innerWidth|clientWidth|ResizeObserver/u
  );
});

test("Power Ranks renders retained native disclosures and keeps territorial calculation separate", () => {
  const source = read("../modules/power-ranks.js");
  const report = read("../modules/scenario/power-report.js");
  const affiliation = read("../modules/scenario/character-affiliation.js");
  const selectors = read("../modules/scenario/selectors.js");
  const lenses = read("../modules/scenario/lenses.js");

  assert.match(source, /createElement\("details", "power-rank-entry"\)/u);
  assert.match(source, /createElement\("summary", "power-rank-summary"\)/u);
  assert.match(source, /content\.addEventListener\("toggle", onToggle, true\)/u);
  assert.match(source, /content\.addEventListener\("focusin", onFocusIn\)/u);
  assert.match(source, /summary\.setAttribute\("autofocus", ""\)/u);
  assert.match(source, /summary\?\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(source, /createPowerRanksViewState/u);
  assert.match(source, /"Spawn Presence"/u);
  assert.match(source, /"World-State Characters"/u);
  assert.match(source, /"Town Control"/u);
  assert.match(source, /power-rank-diagnostics/u);
  assert.doesNotMatch(source, /innerHTML/u);
  assert.match(report, /CURRENT_SPAWN_STATUSES = new Set\(\["Default", "Active"\]\)/u);
  assert.match(report, /GUARANTEED_MEMBER_CATEGORIES/u);
  assert.match(report, /resolveCharacterAffiliations/u);
  assert.match(affiliation, /MAX_AFFILIATION_SQUAD_VISITS = 512/u);
  assert.match(affiliation, /DEFAULT_AFFILIATION_CACHE = new WeakMap/u);
  assert.match(
    read("../modules/power-ranks.css"),
    /\.power-rank-summary::after[\s\S]*display: none/u
  );
  assert.match(lenses, /createPowerRankReportProjection\(baseline, snapshot\)/u);
  assert.doesNotMatch(selectors, /power-report/u);
});

test("application bundle tag advances to the current presentation milestone", () => {
  const html = read("../index.html");
  const tag = "2026-11-07-vanilla-r2-v1";
  assert.equal(html.split(tag).length - 1, 2);
  assert.match(html, new RegExp(`dist/bundle\\.css\\?v=${tag}`));
  assert.match(html, new RegExp(`dist/bundle\\.js\\?v=${tag}`));
});
