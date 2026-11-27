import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, script, css] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../script.js", import.meta.url), "utf8"),
  readFile(new URL("../modules/viewport/workbench.css", import.meta.url), "utf8")
]);

function occurrences(source, expression) {
  return [...source.matchAll(expression)].length;
}

test("Browse owns one Context/Content switch and seven dashboard routes in policy order", () => {
  assert.match(html, /id="browse-mode-context-btn"[^>]*>Context</u);
  assert.match(html, /id="browse-mode-content-btn"[^>]*>Content</u);
  assert.equal(occurrences(html, /data-context-subject=/gu), 9);
  const keyCharacters = html.indexOf('data-context-subject="keyCharacters"');
  const bountyTargets = html.indexOf('data-context-subject="bountyTargets"');
  const deadlyAnimals = html.indexOf('data-context-subject="deadlyAnimals"');
  const treasureHunting = html.indexOf('data-context-route="treasureHunting"');
  const shoppingList = html.indexOf('data-context-route="shoppingList"');
  const prospecting = html.indexOf('data-context-route="prospecting"');
  const factionOverview = html.indexOf('data-context-route="factionOverview"');
  assert.ok(
    keyCharacters < bountyTargets &&
      bountyTargets < deadlyAnimals &&
      deadlyAnimals < treasureHunting &&
      treasureHunting < shoppingList &&
      shoppingList < prospecting &&
      prospecting < factionOverview
  );
  assert.match(html, /data-context-subject="prospecting"/u);
  assert.match(html, /data-context-subject="factionOverview"/u);
  assert.match(html, /data-context-collection-route="treasureHunting"/u);
  assert.match(html, /data-context-subject="treasureSpots"/u);
  assert.match(html, /data-context-subject="nestTreasures"/u);
  assert.match(html, /data-context-subject="fancyWeaponWielders"/u);
  assert.match(html, /data-context-collection-route="shoppingList"/u);
  assert.match(html, /data-context-subject="narcotics"/u);
  assert.doesNotMatch(html, /Important Characters|Shopping Lists/u);
});

test("subject routes pin one original search control while the introduction remains in the scroll flow", () => {
  assert.equal(occurrences(html, /id="browse-context-search-input"/gu), 1);
  assert.match(html, /id="browse-context-chrome"/u);
  assert.match(html, /id="browse-context-help-btn"[^>]*>How this list works<\/button>/u);
  assert.match(html, /href="#guide-context-lists"/u);
  assert.match(script, /function syncContextChrome\(\)/u);
  assert.match(script, /route\.scrollTop >= 84/u);
  assert.match(css, /\.browse-context-chrome\[data-subject-open="true"\][\s\S]*position: sticky/u);
});

test("Content separates Characters and used Animals without narrowing Quick Search", () => {
  const characters = script.indexOf("createSection('Characters'");
  const animals = script.indexOf("createSection('Animals'");
  const equipment = script.indexOf("itemsSummary.textContent = 'Items & Equipment'");
  assert.ok(characters >= 0 && characters < animals && animals < equipment);
  assert.match(script, /usedCharacterIds\.has\(character\.StringId\)/u);
  assert.match(script, /usedAnimalIds\.has\(animal\.StringId\)/u);
  assert.match(script, /discoverySearchDatabase\('character'\)/u);
  assert.match(script, /'animals-list': 'character'/u);
});

test("Context controls are once-wired and route exact references through the inspector", () => {
  assert.equal(occurrences(script, /browse-context-results'\)\?\.addEventListener\('click'/gu), 1);
  assert.equal(occurrences(script, /browse-context-results'\)\?\.addEventListener\('change'/gu), 1);
  assert.match(
    script,
    /showReferenceRoot\(control\.dataset\.entityType, control\.dataset\.entityId/u
  );
  assert.match(script, /discoveryPresentation\?\.showMany/u);
  assert.match(script, /discoveryPresentation\?\.clearSubject/u);
  assert.match(script, /discoveryPresentation\?\.toggleCharacter/u);
  assert.match(script, /lifeStatusLabel/u);
  assert.match(script, /Wanted by/u);
  assert.match(script, /toggleTreasureTown/u);
  assert.match(script, /toggleNarcotic/u);
});

test("one stable Context indicator layer uses the dedicated pane and safe DOM popups", () => {
  assert.equal(occurrences(script, /const contextIndicatorLayer = L\.layerGroup\(\)/gu), 1);
  assert.equal(occurrences(script, /contextIndicatorLayer\.addTo\(map\)/gu), 1);
  assert.match(script, /createPane\('contextIndicatorPane'\)/u);
  assert.match(script, /getPane\('contextIndicatorPane'\)\.style\.zIndex = 590/u);
  assert.match(script, /contextIndicatorLayer\.clearLayers\(\)/u);
  assert.match(script, /entry\.instanceId \?\? null,\s*'context'\s*\)/u);
  assert.doesNotMatch(script, /['"]contextIndicator['"]/u);
  assert.match(script, /spawnAreaAnchorIndex\.getComponents\(appearance\.parentId\)/u);
  assert.match(script, /townMarkersByInstanceId\.get\(appearance\.occurrenceId\)/u);
  assert.match(script, /document\.createElement\('ul'\)/u);
  assert.doesNotMatch(script, /contextIndicatorSvg\([^)]*name/u);
  assert.match(css, /\.context-map-indicator\.is-conditional[\s\S]*border-style: dashed/u);
});

test("Narcotic prohibition uses one passive stable overlay above politics and below roads", () => {
  assert.equal(occurrences(script, /const narcoticProhibitionLayer = L\.layerGroup\(\)/gu), 1);
  assert.equal(occurrences(script, /narcoticProhibitionLayer\.addTo\(map\)/gu), 1);
  assert.match(script, /createPane\('prohibitionPane'\)/u);
  assert.match(script, /getPane\('prohibitionPane'\)\.style\.zIndex = 415/u);
  assert.match(script, /getPane\('prohibitionPane'\)\.style\.pointerEvents = 'none'/u);
  assert.match(script, /narcoticProhibitionImageOverlay\.setUrl/u);
  assert.match(script, /narcoticProhibitionLayer\.hasLayer\(narcoticProhibitionImageOverlay\)/u);
  assert.match(script, /setNarcoticProhibition/u);
  assert.match(css, /\.narcotic-prohibition-overlay/u);
});

test("Context marker rendering is latest-only and isolated from domain layers", () => {
  assert.match(script, /discoveryContextGeneration \+= 1/u);
  assert.match(script, /cancelAnimationFrame\(discoveryContextRenderFrame\)/u);
  assert.match(script, /generation !== discoveryContextGeneration/u);
  const renderer = script.slice(
    script.indexOf("function renderDiscoveryContextIndicators"),
    script.indexOf("function scheduleDiscoveryContextIndicators")
  );
  assert.doesNotMatch(
    renderer,
    /townLayer\.(?:add|remove|clear)|spawnLabelLayer\.(?:add|remove|clear)/u
  );
  assert.doesNotMatch(renderer, /selectionSession\.(?:select|clear)/u);
});

test("Context initialization failure cannot remove the discovery inspector or Quick Search", () => {
  const discoveryStart = script.indexOf("// 3G. Discovery is an exact-ID, read-only projection");
  const contextStart = script.indexOf("if (discoveryCatalog) {", discoveryStart);
  const searchStart = script.indexOf("const discoverySearchDatabase", contextStart);
  const discoveryBlock = script.slice(discoveryStart, contextStart);
  const contextBlock = script.slice(contextStart, searchStart);
  assert.match(discoveryBlock, /createDiscoveryCatalog/u);
  assert.match(script.slice(0, discoveryStart), /const referenceNavigation = new ReferenceNavigationSession/u);
  assert.doesNotMatch(discoveryBlock, /referenceNavigation = null/u);
  assert.match(discoveryBlock, /setupReferenceInspector/u);
  assert.doesNotMatch(discoveryBlock, /createDiscoveryContextCatalog/u);
  assert.match(contextBlock, /catch \(error\)[\s\S]*?baseline: null/u);
  assert.match(script.slice(searchStart), /discoverySearchDatabase\('character'\)/u);
});
