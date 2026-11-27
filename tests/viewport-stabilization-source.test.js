import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const legacyCss = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const workbenchCss = readFileSync(
  new URL("../modules/viewport/workbench.css", import.meta.url),
  "utf8"
);
const paintModule = readFileSync(new URL("../modules/paint-tools.js", import.meta.url), "utf8");
const paintCss = readFileSync(new URL("../modules/paint-tools.css", import.meta.url), "utf8");
const markerModule = readFileSync(new URL("../modules/player-markers.js", import.meta.url), "utf8");
const viewportSession = readFileSync(
  new URL("../stores/viewport-composition-session.js", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")
);
const css = `${legacyCss}\n${workbenchCss}`;

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

test("viewport CSS does not restore the obsolete 1024px adaptive utility belt", () => {
  assert.doesNotMatch(css, /@media\s*\([^)]*max-width\s*:\s*1024px/i);
});

test("Workbench presentation is imported after every legacy module stylesheet", () => {
  const cssImports = [...script.matchAll(/^import ['"]([^'"]+\.css)['"];$/gm)].map(
    (match) => match[1]
  );
  const picoImport = script.indexOf("import '@picocss/pico/css/pico.min.css';");
  const projectCssImport = script.indexOf("import './style.css';");
  const workbenchImport = script.indexOf("import './modules/viewport/workbench.css';");
  const lastLegacyImport = script.indexOf("import './modules/world-history.css';");
  assert.equal(cssImports[0], "@picocss/pico/css/pico.min.css");
  assert.equal(cssImports.at(-1), "./modules/viewport/workbench.css");
  assert.ok(picoImport >= 0);
  assert.ok(projectCssImport > picoImport);
  assert.ok(workbenchImport > lastLegacyImport);
  assert.match(html, /id=["']unified-dock["'][^>]*class=["'][^"']*kimap-ui/);
  assert.match(workbenchCss, /\.kimap-ui\s*\{/);
  assert.doesNotMatch(workbenchCss, /--pico-/);
});

test("application release cache-busts bundles without changing font assets", () => {
  assert.equal(occurrences(html, /2026-11-07-vanilla-r2-v1/g), 2);
  assert.match(html, /dist\/bundle\.css\?v=2026-11-07-vanilla-r2-v1/);
  assert.match(html, /dist\/bundle\.js\?v=2026-11-07-vanilla-r2-v1/);
  assert.match(
    legacyCss,
    /\.\/libs\/Exo2\/Exo2-VariableFont_wght\.woff2\?v=2026-08-31-workbench-typography-labelled-controls-v1/
  );
  assert.match(packageJson.scripts.build, /scripts\/build-site\.mjs/);
  const build = readFileSync(new URL("../scripts/build-site.mjs", import.meta.url), "utf8");
  assert.match(build, /assets\/\[name\]-\[hash\]/);
});

test("one curated upright Exo 2 variable WOFF2 owns Workbench display typography", () => {
  const fontDirectory = new URL("../libs/Exo2/", import.meta.url);
  const files = readdirSync(fontDirectory).sort();
  assert.deepEqual(files, ["Exo2-VariableFont_wght.woff2", "OFL.txt", "README.md"]);

  const font = readFileSync(new URL("Exo2-VariableFont_wght.woff2", fontDirectory));
  assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2");
  assert.ok(font.length > 0);
  assert.match(readFileSync(new URL("OFL.txt", fontDirectory), "utf8"), /SIL OPEN FONT LICENSE/);
  assert.match(
    readFileSync(new URL("README.md", fontDirectory), "utf8"),
    /FontTools 4\.63\.0 with Brotli 1\.2\.0/
  );

  assert.match(legacyCss, /@font-face\s*\{[\s\S]*?font-family:\s*"Exo 2"/);
  assert.match(legacyCss, /font-weight:\s*100 900/);
  assert.match(legacyCss, /font-style:\s*normal/);
  assert.match(legacyCss, /font-display:\s*swap/);
  assert.match(workbenchCss, /--workbench-font-display:/);
  assert.doesNotMatch(workbenchCss, /\.kimap-ui\s*\{[^}]*var\(--workbench-font-display\)/s);
  assert.match(workbenchCss, /\.sim-section-heading\s*\{[\s\S]*?var\(--workbench-font-display\)/);
  assert.doesNotMatch(workbenchCss, /\.workbench-control-label\s*\{[^}]*workbench-font-display/s);
  assert.doesNotMatch(
    `${script}\n${legacyCss}\n${workbenchCss}`,
    /Exo2-unreleased|\.ttf(?:[?'"\s)]|$)|Exo2[^\n"')]*Italic/i
  );
});

test("Pico is an exact local build input while the Workbench quarantine remains last", () => {
  assert.equal(packageJson.dependencies["@picocss/pico"], "2.1.1");
  assert.equal(packageLock.packages["node_modules/@picocss/pico"].version, "2.1.1");
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/@picocss\/pico/i);
  assert.equal(occurrences(script, /@picocss\/pico\/css\/pico\.min\.css/g), 1);
  assert.doesNotMatch(workbenchCss, /--pico-/);
});

test("Simulate editors are static, precede one bounded recent-history feed, and keep its footer", () => {
  const simulate = between(html, 'id="dock-section-simulation"', 'id="relations-journal-panel"');
  const faction = simulate.indexOf('id="faction-relations-title"');
  const character = simulate.indexOf('id="character-status-title"');
  const history = simulate.indexOf('id="scenario-recent-journal"');
  assert.ok(faction < character && character < history);
  assert.match(simulate, /<h2 id="faction-relations-title" class="sim-section-heading">/);
  assert.match(simulate, /<h2 id="character-status-title" class="sim-section-heading">/);
  assert.match(simulate, /id="log-entries" tabindex="0" aria-label="Recent scenario history"/);
  assert.ok(
    simulate.indexOf('id="log-entries"') < simulate.indexOf('class="scenario-journal-links"')
  );
  assert.doesNotMatch(simulate, /data-target=|sim-toggle|aria-expanded="true"/);
  assert.doesNotMatch(script, /sim-header\[data-target\]|hidden-sub/);
  assert.match(
    workbenchCss,
    /#log-entries\s*\{[\s\S]*?max-block-size:\s*clamp\(120px, 24vh, 220px\)/
  );
  assert.match(workbenchCss, /#log-entries\s*\{[\s\S]*?overscroll-behavior:\s*contain/);
});

test("the labelled controller rail exposes four ordered actions with truthful dynamic wording", () => {
  const rail = between(html, 'id="workbench-map-controls"', 'id="map-layer-family-launchers"');
  const ids = [
    "workbench-dock-toggle-btn",
    "workbench-focus-map-btn",
    "reset-panel-btn",
    "workbench-inspector-toggle-btn"
  ];
  for (let index = 1; index < ids.length; index += 1) {
    assert.ok(rail.indexOf(`id="${ids[index - 1]}"`) < rail.indexOf(`id="${ids[index]}"`));
  }
  assert.equal(occurrences(rail, /class="workbench-control-label"/g), 4);
  assert.equal(occurrences(rail, /class="workbench-control-icon"/g), 4);
  assert.match(rail, /aria-orientation="vertical"/);
  assert.doesNotMatch(rail, /<svg[^>]*>[\s\S]*?<text\b/);
  assert.match(script, /dockPresented \? 'Hide Map Tasks' : 'Open Map Tasks'/);
  assert.match(script, /state\.focusMap \? 'Exit Focus Map' : 'Focus Map Mode'/);
  assert.match(script, /`Hide \$\{navigation.hasLandmark \? 'Landmark' : referenceVisible \? 'Reference' : 'Selected'\} Context`/);
  assert.match(script, /`Open \$\{navigation.hasLandmark \? 'Landmark' : referenceVisible \? 'Reference' : 'Selected'\} Context`/);
  assert.match(script, /const dockPresented = state\.effective\.dockVisible/);
  assert.match(script, /const inspectorPresented = state\.effective\.inspectorVisible/);
  assert.match(script, /visibleLabel\.textContent = label/);
  assert.match(
    workbenchCss,
    /#workbench-map-controls,\s*\.map-layer-family-launchers\s*\{[\s\S]*?display:\s*grid/
  );
  assert.match(
    workbenchCss,
    /#map-control-cluster \.ui-control-btn\s*\{[\s\S]*?min-height:\s*36px/
  );
  assert.match(
    workbenchCss,
    /\.workbench-control-icon\s*\{[\s\S]*?width:\s*20px[\s\S]*?height:\s*20px/
  );
  assert.match(
    workbenchCss,
    /#workbench-map-controls #workbench-dock-toggle-btn,[\s\S]*?#workbench-map-controls #workbench-inspector-toggle-btn\s*\{\s*display:\s*none/
  );
  assert.match(script, /inspectorToggle\.disabled = !hasSelection/);
  assert.match(
    workbenchCss,
    /\[data-focus-map="true"\][\s\S]*?#workbench-dock-toggle-btn,[\s\S]*?#workbench-inspector-toggle-btn\s*\{\s*display:\s*none !important/
  );
});

test("dock and inspector title controls share centered 32px SVG geometry and visible borders", () => {
  const dockControl = between(html, 'id="dock-minimize-btn"', 'id="workbench-task-tabs"');
  const inspectorHeader = between(
    html,
    'id="info-panel-title-ribbon"',
    'id="info-panel-utility-ribbon"'
  );
  assert.match(html, /id="dock-minimize-btn"[\s\S]*?class="workbench-control-glyph"/);
  assert.match(html, /id="info-panel-minimize-btn"[\s\S]*?class="workbench-control-glyph"/);
  assert.match(html, /id="info-panel-clear-btn"[\s\S]*?class="workbench-control-glyph"/);
  assert.equal(occurrences(html, /class="workbench-control-glyph"/g), 3);
  assert.match(
    workbenchCss,
    /\.kimap-ui \.workbench-title-control\s*\{[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center[\s\S]*?width:\s*32px[\s\S]*?height:\s*32px/
  );
  assert.match(
    workbenchCss,
    /\.kimap-ui \.workbench-title-control\s*\{[\s\S]*?border:\s*1px solid var\(--workbench-border-strong\)/
  );
  assert.doesNotMatch(`${dockControl}\n${inspectorHeader}`, /&(?:minus|times);|[−×]/);
});

test("Workbench and inspector titles use compact decorative controller identifiers", () => {
  const dockHeader = between(html, 'id="dock-header"', 'id="workbench-task-tabs"');
  const browseHeader = between(html, 'class="workbench-route-header"', '</header>');
  const inspectorHeader = between(
    html,
    'id="info-panel-title-ribbon"',
    'id="info-panel-utility-ribbon"'
  );

  assert.match(dockHeader, /id="dock-title">Your Workbench</);
  assert.match(browseHeader, /Explore map content/);
  assert.doesNotMatch(`${dockHeader}\n${browseHeader}`, /KiMap Workbench|Explore the manifest/);
  assert.equal(occurrences(html, /class="workbench-panel-identity"/g), 2);
  assert.equal(occurrences(html, /class="workbench-panel-identity-icon"/g), 2);
  assert.match(dockHeader, /aria-hidden="true" focusable="false"[\s\S]*?M4 5\.5h12M4 10h12M4 14\.5h12/);
  assert.match(inspectorHeader, /aria-hidden="true" focusable="false"[\s\S]*?<circle cx="10" cy="10" r="6\.5"/);
  assert.match(
    workbenchCss,
    /\.workbench-panel-identity-icon\s*\{[\s\S]*?width:\s*18px[\s\S]*?height:\s*18px[\s\S]*?color:\s*var\(--workbench-text\)/
  );
  assert.match(workbenchCss, /#dock-title\s*\{[\s\S]*?font-size:\s*0\.74rem/);
  assert.match(workbenchCss, /#info-panel-title\s*\{[\s\S]*?font-size:\s*0\.84rem/);
  assert.match(workbenchCss, /#info-panel-title-ribbon\s*\{[\s\S]*?gap:\s*5px/);
});

test("compact Simulate controls retain inset involvement and baseline inspection", () => {
  assert.match(html, /id=["']copy-scenario-baseline-btn["']/);
  assert.match(workbenchCss, /\.player-involvement-control\s*\{[\s\S]*?width:\s*100%/);
  assert.match(workbenchCss, /\.character-status-choices\s*\{[\s\S]*?repeat\(3,/);
  assert.match(workbenchCss, /#dock-section-simulation\s*\{[\s\S]*?padding:\s*9px/);
  assert.match(script, /const abbreviatedKey/);
  assert.match(script, /getElementById\('copy-scenario-baseline-btn'\)/);
});

test("one segmented launcher frame owns the two project layer-family choosers", () => {
  const launchers = between(html, 'id="map-layer-family-launchers"', 'id="map-popover-host"');
  assert.equal(occurrences(html, /id=["']map-content-btn["']/g), 1);
  assert.equal(occurrences(html, /id=["']world-views-btn["']/g), 1);
  assert.ok(launchers.indexOf('id="map-content-btn"') < launchers.indexOf('id="world-views-btn"'));
  assert.match(launchers, /id="map-content-btn"[\s\S]*?aria-controls="map-content-control"/);
  assert.match(launchers, /id="world-views-btn"[\s\S]*?aria-controls="world-views-control"/);
  assert.doesNotMatch(html, /id=["']map-layers-btn["']/);
  assert.doesNotMatch(script, /L\.Control\.PinnedLayers|new\s+L\.Control\.(?:LayerToggle|UnifiedControls)/);
  assert.equal(occurrences(script, /new\s+PinnedLayerChooser\s*\(/g), 2);
  assert.equal(occurrences(script, /name: 'Political View'/g), 1);
  assert.doesNotMatch(`${html}\n${script}`, /Faction Influence/i);
});

test("one workspace popover host owns mutually exclusive layer-family and Paint choices", () => {
  assert.equal(occurrences(html, /id=["']map-popover-host["']/g), 1);
  assert.match(script, /for \(const surface of LAYER_CHOOSER_SURFACES\)[\s\S]*?popoverHost\.appendChild\(container\)/);
  assert.match(paintModule, /popoverHost\.appendChild\(iconPopover\)/);
  assert.match(script, /viewportComposition\.openTransientSurface\(surface\)/);
  assert.match(viewportSession, /["']mapContent["']/);
  assert.match(viewportSession, /["']worldViews["']/);
  assert.match(script, /viewportComposition\.toggleTransientSurface\('paintIcons'\)/);
  assert.match(
    workbenchCss,
    /#map-popover-host\s*\{[\s\S]*?z-index:\s*var\(--z-popover\)[\s\S]*?pointer-events:\s*none/
  );
  assert.match(
    workbenchCss,
    /#map-popover-host > \.map-anchored-popover\s*\{[\s\S]*?pointer-events:\s*auto/
  );
});

test("layer families share a labelled launcher frame, fixed headers, and scroll-owned options", () => {
  assert.match(
    script,
    /isLayerChooserSurface\(surface\)[\s\S]*?anchor:\s*document\.getElementById\('map-layer-family-launchers'\)[\s\S]*?alignment:\s*'start'/
  );
  assert.match(script, /gap:\s*8/);
  assert.match(script, /this\._options\.className = 'layers-control-options'/);
  assert.match(script, /this\._container\.append\(header, this\._options\)/);
  const navigation = between(html, 'id="map-navigation-controls"', 'id="map-popover-host"');
  assert.doesNotMatch(navigation, /map-(?:content|layers)-btn|world-views-btn/);
  assert.match(script, /const action = active \? `Close \$\{name\}` : `Open \$\{name\}`/);
  assert.match(script, /positionMapControlCluster\(\)/);
  assert.match(script, /createLayersPopoverPlacement\(\{/);
  assert.match(script, /popoverResizeObserver\.observe\(element\)/);
  assert.match(script, /popoverResizeObserver\?\.observe\(container\)/);
  assert.match(script, /this\._options\.tabIndex = 0/);
  assert.match(
    workbenchCss,
    /\.map-layer-control \.layers-control-header\s*\{[\s\S]*?flex:\s*0 0 auto/
  );
  assert.match(
    workbenchCss,
    /\.map-layer-control \.layers-control-options\s*\{[\s\S]*?overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain/
  );
});

test("layer-family pinning survives outside clicks but explicit dismissals close and unpin", () => {
  assert.match(script, /respectPinned && isLayerChooserSurface\(active\) && layerControls\[active\]\?\.isPinned\(\)/);
  assert.match(script, /document\.addEventListener\('pointerdown'[\s\S]*?respectPinned:\s*true/);
  assert.match(script, /forceCollapse\(\)\s*\{[\s\S]*?this\._isPinned = false/);
  assert.match(
    script,
    /for \(const surface of \['mapContent', 'worldViews'\]\)[\s\S]*?layerControls\[surface\]\?\.expand\(\)[\s\S]*?layerControls\[surface\]\?\.forceCollapse/
  );
  assert.match(viewportSession, /enterFocusMap\(\)[\s\S]*?transientSurface:\s*null/);
  assert.match(viewportSession, /reset\(defaults = \{\}\)[\s\S]*?transientSurface:\s*null/);
});

test("Map Content and World Views have one exact, ordered capability partition", () => {
  const worldViews = between(
    script,
    "function buildWorldViewsOptions(options)",
    "function createTownTypeDisclosure()"
  );
  const mapContent = between(
    script,
    "function buildMapContentOptions(options)",
    "function syncLayerChoiceRow(row)"
  );
  const orderedWorldIds = [
    "none",
    "political",
    "debugGrid"
  ];
  for (let index = 1; index < orderedWorldIds.length; index += 1) {
    assert.ok(
      worldViews.indexOf(`'${orderedWorldIds[index - 1]}'`) <
        worldViews.indexOf(`'${orderedWorldIds[index]}'`)
    );
  }
  assert.match(worldViews, /for \(const group of WORLD_VIEW_GROUPS\)/);
  assert.match(worldViews, /radio: getLayerDescriptor\(choice.id\)\?\.kind === 'surface'/);
  for (const id of ["towns", "nests", "regionLabels", "landmarks", "roads", "relations"]) {
    assert.match(mapContent, new RegExp(`['"]${id}['"]`));
    assert.doesNotMatch(worldViews, new RegExp(`['"]${id}['"]`));
  }
  for (const id of orderedWorldIds) {
    assert.doesNotMatch(mapContent, new RegExp(`['"]${id}['"]`));
  }
  const descriptors = between(
    script,
    "function refreshLayerDescriptors()",
    "function getLayerDescriptor(id)"
  );
  assert.match(descriptors, /content\('regionLabels', 'Region Names'/);
  assert.match(descriptors, /content\('relations', 'Player Relations'/);
  assert.doesNotMatch(descriptors, /Relations Overlay|Region Labels/);
  assert.match(descriptors, /id: 'political',[\s\S]*?name: 'Political View'/);
  assert.match(worldViews, /badge\.textContent = 'Experimental'|political/);
  assert.doesNotMatch(`${html}\n${script}`, /Political View.*(?:placeholder|coming soon)/i);
});

test("town markers retain stable type groups across scenario-driven regrouping", () => {
  const groups = between(script, "const TOWN_TYPE_CONFIG", "let playerMarkerLayer");
  assert.match(groups, /for \(const \{ key \} of TOWN_TYPE_FILTERS\)/);
  assert.match(groups, /townTypeLayers\.set\(key, layer\)/);
  assert.match(groups, /townLayer\.addLayer\(layer\)/);
  const draw = between(script, "function drawTownMarkers(locations)", "function createDebugGridLayer()");
  assert.match(draw, /getCurrentTownData\(townData\.StringId\)/);
  assert.match(draw, /activeTownData\.Values\?\.type \?\? townData\.Values\?\.type/);
  assert.doesNotMatch(draw, /activeTownData\.Values\?\.type \?\? townData\.Values\?\.type \?\? 10/);
  assert.match(draw, /for \(const layer of townTypeLayers\.values\(\)\) layer\.clearLayers\(\)/);
  assert.doesNotMatch(draw, /townLayer\.clearLayers\(\)/);
  assert.match(draw, /isNestMarkerTownType\(typeId\)/);
  assert.match(draw, /isHiddenNest \? nestLayer : townTypeLayers\.get\(townTypeKey\)/);
  assert.match(draw, /townTypeOccurrenceTypes = Object\.freeze\(occurrenceTypes\)/);
  assert.match(draw, /marker\.on\('add',[\s\S]*?selection-map-marker/);
  const filters = between(
    script,
    "function createTownTypeDisclosure()",
    "function buildMapContentOptions(options)"
  );
  assert.match(filters, /document\.createElement\('details'\)/);
  assert.doesNotMatch(filters, /details\.open\s*=|setAttribute\(['"]open/);
  assert.match(filters, /townLayer\.(?:addLayer|removeLayer)\(layer\)/);
});

test("Town type chooser hides zero rows and summarizes only present filters", () => {
  const synchronization = between(
    script,
    "function syncMapContentOptions(options)",
    "function initializeLayerControls()"
  );
  const planProjection = between(
    script,
    "function renderLayerPresentation()",
    "function focusPlanRouteElement("
  );

  assert.match(synchronization, /disclosure\.hidden = projection\.presentTypeCount === 0/);
  assert.match(
    synchronization,
    /summary\.textContent = `\$\{projection\.enabledPresentCount\} of \$\{projection\.presentTypeCount\}`/
  );
  assert.match(synchronization, /row\.hidden = rowProjection\.count === 0/);
  assert.match(synchronization, /input\.checked = rowProjection\.enabled/);
  assert.match(planProjection, /townTypeProjection: townTypes/);
  assert.doesNotMatch(synchronization, /row\.remove\(|replaceChildren/);
});

test("late or failed raster loading updates World Views in place without blocking Map Content", () => {
  const initialization = between(
    script,
    "function initializeLayerControls()",
    "function setSpawnRasterStatus(status)"
  );
  assert.match(initialization, /spawnRasterStatus === 'ready' && !surfaceChoiceTouched/);
  assert.match(initialization, /activateWorldSurface\(getLayerDescriptor\('spawnAreas'\)\)/);
  assert.equal(occurrences(initialization, /new PinnedLayerChooser/g), 2);
  const status = between(script, "function setSpawnRasterStatus(status)", "function renderDataOverlay(id)");
  assert.match(status, /refreshLayerDescriptors\(\)/);
  assert.match(status, /status === 'ready' && !surfaceChoiceTouched/);
  assert.match(status, /map\.hasLayer\(spawnLabelLayer\).*renderSpawnLabels\(\)/s);
  assert.match(status, /map\.hasLayer\(spawnBorderLayer\)[\s\S]*?renderSpawnBorders/);
  assert.doesNotMatch(status, /new PinnedLayerChooser/);
  const loader = between(
    script,
    "async function loadAndProcessSpawnMap(url)",
    "function renderSpawnOverlay(tgaData)"
  );
  assert.equal(occurrences(loader, /setSpawnRasterStatus\('unavailable'\)/g), 3);
  assert.equal(occurrences(loader, /setSpawnRasterStatus\('ready'\)/g), 1);
  assert.match(
    loader,
    /try \{[\s\S]*?renderSpawnOverlay\(tgaData\)[\s\S]*?catch \(error\) \{[\s\S]*?Spawn Areas could not be initialized[\s\S]*?\}/
  );
  assert.match(loader, /discoveryContextAreaIndex = createPoliticalAreaIndex/u);
  assert.match(loader, /initializePoliticalFoundation\(tgaData, discoveryContextAreaIndex\)/u);
  assert.match(script, /loadBiomeMap\(\);\s*initializeLayerControls\(\)/);
});

test("the duplicate Map Overlays theater and synchronization surface are retired", () => {
  assert.equal(existsSync(new URL("../modules/overlay-manager.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../modules/overlay-manager.css", import.meta.url)), false);
  assert.equal(existsSync(new URL("../content/overlay-content.js", import.meta.url)), false);
  const releaseSources = `${html}\n${script}\n${legacyCss}\n${workbenchCss}`;
  assert.doesNotMatch(
    releaseSources,
    /open-overlay-manager-btn|pane-overlay-manager|initOverlayManager|om-toggle-|overlay-manager\.css/
  );
});

test("Paint icon choices leave the toolbar scroller and preserve the two-stage Escape path", () => {
  const replaceIndex = paintModule.indexOf("host.replaceChildren(container)");
  const popoverIndex = paintModule.indexOf("const iconPopover = document.createElement('div')");
  const hostIndex = paintModule.indexOf("popoverHost.appendChild(iconPopover)");
  assert.ok(replaceIndex >= 0 && replaceIndex < popoverIndex && popoverIndex < hostIndex);
  assert.doesNotMatch(paintModule, /icon-grid-popup/);
  assert.doesNotMatch(paintCss, /icon-grid-popup/);
  assert.match(paintModule, /requestIconPopoverClose\(\{ restoreFocus:\s*true \}\)/);
  assert.match(script, /pendingTransientFocusReturn[\s\S]*?tool-btn-icon-main/);
  assert.match(
    script,
    /transient:\s*\{[\s\S]*?dismiss:\s*dismissWorkbenchTransientSurface[\s\S]*?tool:\s*\{/
  );
  assert.match(workbenchCss, /\.paint-icon-popover\s*\{[\s\S]*?grid-template-columns:/);
});

test("persistent Plan configuration replaces map chrome while retaining every styling control", () => {
  for (const id of [
    "plan-overlay-card",
    "layer-configuration-panel",
    "faction-colors-panel",
    "map-road-native-color",
    "map-road-custom-color",
    "map-road-match-btn",
    "map-road-highvis-btn",
    "map-road-reset-btn",
    "map-border-color"
  ]) {
    assert.equal(occurrences(html, new RegExp(`id=["']${id}["']`, "g")), 1);
  }
  assert.match(
    script,
    /createLayerPresentationProjection\(\{[\s\S]*?hasLayer: layer => map\.hasLayer\(layer\)/
  );
  const plan = between(html, 'id="workbench-route-plan"', 'id="map-workspace"');
  assert.ok(plan.indexOf('id="plan-paint-card"') < plan.indexOf('id="plan-overlay-card"'));
  assert.match(plan, /id="plan-layer-world-view"/);
  assert.match(plan, /id="plan-layer-map-content"/);
  assert.match(plan, /id="plan-layer-reference"/);
  assert.ok(
    plan.indexOf('id="plan-layer-configuration-btn"') <
      plan.indexOf('id="plan-faction-colors-btn"')
  );
  assert.ok(
    plan.indexOf('id="plan-faction-colors-btn"') < plan.indexOf('class="plan-layer-summary"')
  );
  assert.equal(occurrences(plan, /<fieldset[^>]*disabled/g), 4);
  assert.match(script, /section\.disabled = !enabled/);
  assert.doesNotMatch(
    between(script, "function renderLayerPresentation()", "function focusPlanRouteElement("),
    /replaceChildren|\.value\s*=/
  );
  assert.match(workbenchCss, /#map-popover-host\s*\{[\s\S]*?var\(--z-popover\)/);
  assert.match(legacyCss, /#town-layout-backdrop\s*\{[\s\S]*?var\(--z-transient/);
  assert.match(
    workbenchCss,
    /\.plan-layer-summary dt\s*\{[\s\S]*?color:\s*var\(--workbench-text\)[\s\S]*?border-bottom:[\s\S]*?font-weight:\s*700/
  );
  assert.match(workbenchCss, /\.town-type-filter-disclosure\s*\{[\s\S]*?margin:\s*1px 4px 4px;/);
  assert.doesNotMatch(workbenchCss, /town-type-filter-disclosure[\s\S]{0,100}27px/);
});

test("configuration cleanup removes the widget, disclosure, injected legacy shifters, and drag wiring", () => {
  const releaseSources = `${script}\n${html}\n${workbenchCss}\n${paintCss}\n${legacyCss}`;
  assert.doesNotMatch(releaseSources, /road-color-shifter|border-color-shifter|border-color-input/);
  assert.doesNotMatch(script, /initRoadColorShifter|initBorderColorShifter/);
  assert.doesNotMatch(script, /document\.createElement\(['"]style['"]\)/);
  assert.doesNotMatch(
    `${releaseSources}\n${viewportSession}`,
    /map-appearance|MapAppearance|mapAppearance/
  );
  const appearance = between(
    script,
    "function setupLayerConfigurationControls()",
    "function applyViewportComposition(change)"
  );
  assert.doesNotMatch(appearance, /makeElementDraggable|document\.body|z-index:\s*\d{4}/);
  assert.doesNotMatch(workbenchCss, /#map-popover-host[\s\S]{0,500}z-index:\s*\d{4}/);
});

test("cog handoffs close and unpin before focusing Plan destinations without a launcher race", () => {
  const overview = between(
    script,
    "function openOverlayControls()",
    "function openLayerConfigurationView("
  );
  const configuration = between(
    script,
    "function openLayerConfigurationView(",
    "function setupLayerConfigurationControls()"
  );
  for (const handoff of [overview, configuration]) {
    assert.match(handoff, /pendingTransientFocusReturn = null/);
    assert.match(handoff, /closeActiveTransientSurface\(\)/);
    assert.doesNotMatch(
      handoff,
      /respectPinned: true|restoreFocus: true|map\.(addLayer|removeLayer|setView)|selectionSession/
    );
  }
  assert.match(overview, /setTask\('plan'\)/);
  assert.match(overview, /focusPlanRouteElement\('plan-overlay-title'\)/);
  assert.match(configuration, /openSubview\('layerConfiguration', target\)/);
  assert.match(configuration, /openSubview\('factionColors'\)/);
  assert.match(
    script,
    /getElementById\('layer-configuration-back-btn'\)[\s\S]*?viewportComposition\.back\(\)[\s\S]*?focusPlanRouteElement\('plan-layer-configuration-btn'\)/
  );
  assert.match(
    script,
    /getElementById\('faction-colors-back-btn'\)[\s\S]*?viewportComposition\.back\(\)[\s\S]*?focusPlanRouteElement\('plan-faction-colors-btn'\)/
  );
});

test("configuration gears are stable row siblings and follow live layer truth", () => {
  const row = between(script, "function createLayerChoiceRow(", "function appendLayerChoiceGroup(");
  assert.match(row, /row\.append\(label\)/);
  assert.match(row, /'layers-row-settings-btn'/);
  assert.match(row, /event\.preventDefault\(\)/);
  assert.match(row, /event\.stopPropagation\(\)/);
  assert.match(row, /if \(!current\.layer \|\| !map\.hasLayer\(current\.layer\)\) return/);
  assert.match(row, /row\.append\(button\)/);
  assert.match(script, /settings\.disabled = !configurationReady/);
  assert.match(script, /id: 'debugGrid', name: 'Debug Grid', layer: debugGridLayer/);
  assert.match(script, /id: 'roads',[\s\S]*?name: 'Road Network',[\s\S]*?layer: roadLayer/);
  assert.match(script, /id: 'spawnBorders',[\s\S]*?name: 'Spawn Borders',[\s\S]*?layer: spawnBorderLayer/);
  assert.match(script, /configurationTarget === 'borders'/);
  assert.match(script, /configurationTarget === 'roads'/);
  assert.match(script, /configurationTarget === 'debugGrid'/);
  assert.match(script, /'layers-settings-btn', 'Open Overlay Controls'/);
  assert.match(
    script,
    /closeActiveTransientSurface\(\{ expected: surface, restoreFocus: true \}\)/
  );
});

test("inspector title controls distinguish minimization from explicit selection clearing", () => {
  const titleRibbon = between(
    html,
    'id="info-panel-title-ribbon"',
    'id="info-panel-utility-ribbon"'
  );

  assert.match(titleRibbon, /id=["']info-panel-title["']/);
  assert.ok(
    titleRibbon.indexOf('id="info-panel-title"') <
      titleRibbon.indexOf('id="info-panel-minimize-btn"')
  );
  assert.ok(
    titleRibbon.indexOf('id="info-panel-minimize-btn"') <
      titleRibbon.indexOf('id="info-panel-clear-btn"')
  );
  assert.match(
    script,
    /getElementById\('info-panel-minimize-btn'\)[\s\S]*?viewportComposition\.hideInspector\(\)/
  );
  assert.match(
    script,
    /getElementById\('info-panel-clear-btn'\)[\s\S]*?executeGeographicAction\('clear'/
  );
  assert.match(
    script,
    /if \(actionId === 'clear'[\s\S]*?selectionSession\.clear\(\)[\s\S]*?map\.closePopup\(\)/
  );
});

test("inspector utility ribbon follows the contextual action grammar without More", () => {
  const primaryActions = between(
    html,
    'id="info-panel-primary-actions"',
    'id="info-panel-identity-actions"'
  );
  const identityActions = between(html, 'id="info-panel-identity-actions"', "</div>");
  const orderedPrimaryIds = [
    "info-panel-point-toggle-btn",
    "info-panel-zoom-btn",
    "info-panel-layout-btn",
    "info-panel-copy-view-btn"
  ];
  for (let index = 1; index < orderedPrimaryIds.length; index += 1) {
    assert.ok(
      primaryActions.indexOf(`id="${orderedPrimaryIds[index - 1]}"`) <
        primaryActions.indexOf(`id="${orderedPrimaryIds[index]}"`)
    );
  }
  assert.match(primaryActions, /info-panel-point-toggle-btn[\s\S]*?hasContainingSpawn/);
  assert.match(primaryActions, /info-panel-zoom-btn[\s\S]*?zoomActionId\(\)/);
  assert.match(primaryActions, /info-panel-layout-btn[\s\S]*?type === 'town'/);
  assert.match(primaryActions, /info-panel-copy-view-btn[\s\S]*?Copy exact point view/);
  assert.ok(
    identityActions.indexOf('id="info-panel-fav-btn"') <
      identityActions.indexOf('id="info-panel-wiki-btn"')
  );
  assert.match(identityActions, /id="info-panel-wiki-btn"[\s\S]*?disabled/);
  assert.match(workbenchCss, /#info-panel-utility-ribbon\s*\{[\s\S]*?padding:\s*5px 8px 5px 3px;/);
  assert.ok(
    workbenchCss.indexOf("#info-panel-utility-ribbon .context-primary-text-action") >
      workbenchCss.indexOf("#info-panel-utility-ribbon .header-action-btn {")
  );
  assert.match(
    workbenchCss,
    /#info-panel-utility-ribbon \.context-primary-text-action\s*\{[\s\S]*?width:\s*auto;[\s\S]*?min-width:\s*70px;[\s\S]*?white-space:\s*nowrap;/
  );
  assert.doesNotMatch(html, /info-panel-overflow|context-action-menu|More actions/);
  assert.doesNotMatch(script, /selectContainingSpawn|info-panel-overflow|context-action-menu/);
  assert.doesNotMatch(workbenchCss, /context-action-menu|context-menu-caret/);
});

test("Copy View and invalid point feedback share cancellable five-second expiry", () => {
  const copyView = between(
    script,
    "async function copyCurrentMapView",
    "function executeGeographicAction"
  );
  const pointProbe = between(script, "function setPointProbe(", "function pointProbeKey(");
  assert.match(script, /const TRANSIENT_STATUS_TIMEOUT_MS = 5000/);
  assert.match(
    copyView,
    /setSelectionStatus\(['"]View link copied\.["'],\s*['"]success['"],\s*\{[\s\S]*?timeout:\s*TRANSIENT_STATUS_TIMEOUT_MS/
  );
  assert.match(pointProbe, /catch \(error\)[\s\S]*?timeout:\s*TRANSIENT_STATUS_TIMEOUT_MS/);
  assert.match(copyView, /feedbackLabel\.textContent\s*=\s*['"]Copied['"]/);
  assert.match(copyView, /feedbackLabel\.textContent\s*=\s*activeCopyFeedback\.originalLabel/);
});

test("Scanner delegates stable boxed summaries and suppresses tracking while expanded", () => {
  const scanner = between(
    script,
    "function initWorldTracker(map)",
    "function setupLayerSynchronization()"
  );

  assert.match(scanner, /createScannerReading/);
  assert.match(scanner, /scannerView\.setCoordinates/);
  assert.match(scanner, /scannerView\.setArea/);
  assert.doesNotMatch(script, /renderWorldTrackerSummary/);
  assert.doesNotMatch(scanner, /innerHTML|insertAdjacentHTML/);
  assert.match(workbenchCss, /--workbench-coordinate-x:\s*#69a2ff/);
  assert.match(workbenchCss, /--workbench-coordinate-z:\s*#65dc72/);
  assert.match(workbenchCss, /--workbench-scanner-expanded-width:\s*400px/);
  assert.match(
    workbenchCss,
    /#world-tracker\[data-expanded="true"\] \.wt-ribbon,[\s\S]*?display:\s*none/
  );
  assert.match(workbenchCss, /#wt-details\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(workbenchCss, /#wt-toggle\[aria-expanded="true"\] svg/);
  assert.doesNotMatch(workbenchCss, /#viewport-workbench:not\(\[data-layout-class="wide"\]\) #wt-summary/);
});

test("point probe uses equal coordinate boxes with the Scanner coordinate tokens", () => {
  const popup = between(script, "function openPointProbePopup(", "function showInfoPanel(");

  assert.match(
    popup,
    /for \(const \[axis, value\] of \[\['X', probe\.point\.x\], \['Z', probe\.point\.z\]\]\)/
  );
  assert.match(popup, /point-probe-coordinate-axis is-\$\{axis\.toLocaleLowerCase\(\)\}/);
  assert.doesNotMatch(popup, /coordinates\.textContent\s*=\s*`X/);
  assert.match(
    workbenchCss,
    /\.point-probe-coordinates\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    workbenchCss,
    /\.point-probe-coordinate-axis\.is-x\s*\{[\s\S]*?var\(--workbench-coordinate-x\)/
  );
  assert.match(
    workbenchCss,
    /\.point-probe-coordinate-axis\.is-z\s*\{[\s\S]*?var\(--workbench-coordinate-z\)/
  );
});

test("Faction Colors separates roster tools from generated rows without another listener surface", () => {
  const roster = between(
    html,
    'class="faction-colors-roster"',
    'id="political-faction-list"'
  );
  const setup = between(
    script,
    "function setupFactionColorsControls()",
    "function applyViewportComposition(change)"
  );

  assert.match(roster, /class="faction-colors-roster-tools"/);
  assert.ok(
    roster.indexOf('id="faction-colors-roster-title"') <
      roster.indexOf('id="political-faction-count"')
  );
  assert.match(
    workbenchCss,
    /\.faction-colors-list\s*\{[\s\S]*?padding-top:\s*10px[\s\S]*?border-top:\s*1px solid var\(--workbench-border\)/
  );
  assert.match(
    workbenchCss,
    /\.faction-color-row > header\s*\{[\s\S]*?border:\s*1px solid var\(--workbench-border-strong\)/
  );
  assert.equal(occurrences(setup, /createFactionColorList\(/g), 1);
  assert.doesNotMatch(setup, /list\?\.addEventListener/);
});

test("Plan tools use one shared shelf and suppress the legacy marker launcher", () => {
  assert.equal(occurrences(html, /id=["']map-tool-shelf["']/g), 1);
  assert.match(html, /id=["']map-tool-marker-place-btn["']/);
  assert.match(html, /id=["']map-tool-shelf-paint-slot["']/);
  assert.match(html, /id=["']map-tool-marker-tab["'][\s\S]*?id=["']map-tool-paint-tab["']/);
  assert.match(
    paintModule,
    /function mountPaintToolShelf\(host, popoverHost\)[\s\S]*?host\.replaceChildren\(container\)/
  );
  assert.doesNotMatch(paintModule, /L\.Control\.PaintTools/);
  assert.doesNotMatch(markerModule, /L\.Control\.PlayerMarkerHub/);
  assert.match(script, /Cancel Placement[\s\S]*?Place Marker/);
  assert.match(script, /Stop Drawing[\s\S]*?Start Drawing/);
  assert.doesNotMatch(html, /id=["']player-marker-hub-container["']/);
  assert.match(script, /setToolShelfTab\(tab\)/);
});

test("inspector combines point and spawn facts with a fallback-only Overview media slot", () => {
  const inspector = between(html, 'id="info-panel"', "<!-- End of Viewport Workbench -->");
  assert.match(inspector, /id=["']info-panel-title-ribbon["']/);
  assert.match(inspector, /id=["']info-panel-utility-ribbon["']/);
  assert.match(inspector, /class=["']inspector-fact-list["']/);
  assert.ok(
    inspector.indexOf('id="inspector-section-point"') <
      inspector.indexOf('id="inspector-section-overview"')
  );
  assert.match(
    inspector,
    /inspector-section-point[\s\S]*?hasContainingSpawn \|\| \$store\.infoPanel\.pointContextVisible/
  );
  assert.match(
    inspector,
    /inspector-section-overview[\s\S]*?data\.hasContainingSpawn[\s\S]*?<dt>Spawns<\/dt>/
  );
  const mediaSlot = between(inspector, 'class="inspector-media-slot"', "</div>");
  assert.match(mediaSlot, /unfound\.svg/);
  assert.doesNotMatch(mediaSlot, /<a\b|<button\b/);
  assert.match(
    workbenchCss,
    /\.inspector-media-slot\s*\{[\s\S]*?width:\s*56px[\s\S]*?height:\s*56px/
  );
  assert.match(
    workbenchCss,
    /data-point-context-visible="false"[\s\S]*?\.selection-point-marker[\s\S]*?display:\s*none/
  );
});

test("spawn labels and inspector navigation share the same indexed component anchors", () => {
  assert.equal(occurrences(script, /createSpawnAreaAnchorIndex\s*\(/g), 1);
  assert.match(
    script,
    /getContainingAnchor\(latLng, spawnAreaId\)[\s\S]*?getPrimaryAnchor\(spawnAreaId\)/
  );
  const labels = between(script, "function renderSpawnLabels()", "function loadRoadNetwork()");
  assert.match(labels, /spawnAreaAnchorIndex\.components/);
  assert.match(labels, /component\.leafletAnchor/);
  assert.doesNotMatch(labels, /new Uint8Array|flood|sumX|sumY/);
  const areaZoom = between(script, "function zoomToSpawnArea", "function openPointProbePopup");
  assert.match(areaZoom, /createAreaZoomPlan/);
  assert.match(areaZoom, /visibleWorkbenchOcclusions\(\)/);
  assert.match(areaZoom, /prefers-reduced-motion/);
  assert.match(areaZoom, /map\.setView\(anchor, plan\.targetZoom/);
});

test("point presentation resets at identity boundaries while exact-point Copy View stays canonical", () => {
  assert.match(
    script,
    /selectionSession\.subscribe\(change => \{[\s\S]*?change\.type === 'select' \|\| change\.type === 'clear'[\s\S]*?showPointContext\(\)/
  );
  assert.match(
    script,
    /function promotePointProbe\(\)[\s\S]*?showPointContext\(\)[\s\S]*?selectionSession\.select\(probe\)/
  );
  assert.match(script, /viewportComposition\.reset\(\{\s*hasSelection:/);
  assert.match(script, /root\.dataset\.pointContextVisible = String\(state\.pointContextVisible\)/);

  const copyView = between(
    script,
    "async function copyCurrentMapView",
    "function executeGeographicAction"
  );
  assert.match(copyView, /selectionSession\?\.getSelection\(\) \?\? null/);
  assert.doesNotMatch(copyView, /pointContextVisible/);
});

test("ordinary map clicks create an isolated probe and promote only through Open Context", () => {
  const clicks = between(script, "function setupEventListeners()", "// Main Menu Things");
  assert.match(clicks, /setPointProbe\(e\.latlng\)/);
  assert.doesNotMatch(clicks, /selectionSession\.select/);
  assert.match(script, /function promotePointProbe\(\)[\s\S]*?selectionSession\.select\(probe\)/);
  assert.match(script, /copyCurrentMapView\(copy, probe\)/);
  assert.match(script, /onDismiss: \(\) =>[\s\S]*?pointProbeSession\.clear\(\)/);
});

test("character editor wiring uses semantic statuses instead of a numeric slider", () => {
  const editor = between(
    script,
    "function updateCharacterControlUI",
    '/**\n * Populates the "Manifest"'
  );
  assert.match(script, /CHARACTER_STATUS_OPTIONS/);
  assert.match(editor, /for\s*\(const option of CHARACTER_STATUS_OPTIONS\)/);
  assert.match(editor, /document\.createElement\(['"]fieldset['"]\)/);
  assert.match(editor, /legend\.textContent\s*=\s*['"]Status['"]/);
  assert.match(editor, /input\.type\s*=\s*['"]radio['"]/);
  assert.match(editor, /input\.name\s*=\s*['"]character-status['"]/);
  assert.match(editor, /involvementInput\.id\s*=\s*['"]character-player-involved['"]/);
  assert.doesNotMatch(editor, /type\s*=\s*['"]range['"]|character-status-(?:slider|input)/);
  assert.match(script, /normalizeCharacterStatus\(selectedStatus\?\.value\)/);
});

test("a failed base-map image cannot advance the workspace to interactive readiness", () => {
  const readinessSetup = between(
    script,
    "mapReadinessCoordinator = createMapReadinessCoordinator",
    "townLayoutController = createTownLayoutController"
  );
  const successfulInitialization = between(
    script,
    ".then(async apiResponse => {",
    "}) // Enact 1C"
  );

  assert.match(readinessSetup, /imageStatus\s*===\s*MAP_IMAGE_READINESS\.ERROR/);
  assert.match(
    readinessSetup,
    /throw new Error\(['"]The Kenshi base-map image could not be loaded\./
  );
  assert.match(successfulInitialization, /completeMapReadiness\(\);/);
  assert.doesNotMatch(readinessSetup, /completeMapReadiness\(\);/);
});

test("one governed wheel adapter replaces Leaflet burst accumulation after readiness", () => {
  const mapSetup = between(script, "map = L.map", "townLayer.addTo(map)");
  const controls = between(
    script,
    "function setupProjectMapControls()",
    "// Layer family controls."
  );

  assert.match(mapSetup, /scrollWheelZoom:\s*false/);
  assert.equal(occurrences(script, /createWheelZoomGovernor\s*\(/g), 1);
  assert.equal(occurrences(script, /wheelZoomGovernor\.enable\(\)/g), 1);
  assert.match(mapSetup, /normalizeDelta:\s*event\s*=>\s*L\.DomEvent\.getWheelDelta\(event\)/);
  assert.doesNotMatch(script, /map\.scrollWheelZoom/);
  assert.match(controls, /map\.zoomIn\(\)/);
  assert.match(controls, /map\.zoomOut\(\)/);
});
