import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const legacyCss = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const shellScript = readFileSync(new URL("../modules/top-bar/shell.js", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("../modules/top-bar/shell.css", import.meta.url), "utf8");
const windowManager = readFileSync(
  new URL("../modules/window-manager.js", import.meta.url),
  "utf8"
);
const unifiedCss = readFileSync(new URL("../modules/unified-window.css", import.meta.url), "utf8");
const helpScript = readFileSync(new URL("../modules/help-guide.js", import.meta.url), "utf8");
const helpContent = readFileSync(new URL("../content/help-content.js", import.meta.url), "utf8");

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source boundary: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex + end.length);
}

function attributesOf(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1], match[2]])
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const topBar = between(html, '<header id="top-bar"', "</header>");

test("one application shell replaces the legacy top-bar and owns no map-layer controls", () => {
  assert.equal(occurrences(html, /id=["']top-bar["']/g), 1);
  assert.equal(occurrences(topBar, /id=["']quick-search["']/g), 1);
  assert.equal(occurrences(topBar, /id=["']theme-toggle["']/g), 1);
  assert.equal(occurrences(topBar, /id=["']user-menu-button["']/g), 0);
  assert.match(topBar, /class=["'][^"']*kimap-shell/);
  assert.match(topBar, /href=["']\/["']/);
  assert.doesNotMatch(
    topBar,
    /top-bar-button-group|return-logo|open-overlay-manager-btn|pane-overlay-manager|data-layer/
  );
  assert.doesNotMatch(topBar, />\s*(?:Map Content|World Views)\s*</i);
});

test("the binary theme action swaps its SVG glyph with the active theme", () => {
  assert.equal(occurrences(topBar, /data-theme-icon=["']sun["']/g), 1);
  assert.equal(occurrences(topBar, /data-theme-icon=["']moon["']/g), 1);
  assert.match(topBar, /data-theme-icon=["']moon["'][^>]*\shidden(?:\s|>)/);
  assert.match(
    shellScript,
    /icon\.toggleAttribute\(["']hidden["'], icon\.dataset\.themeIcon !== presentation\.icon\)/
  );
  assert.doesNotMatch(shellScript, /icon\.hidden\s*=/);
});

test("fatal map initialization leaves the independent application shell operable", () => {
  const errorRegion = html.match(
    /<section\b[^>]*id=["']initialization-error-overlay["'][^>]*>/
  )?.[0];
  assert.ok(errorRegion);
  assert.equal(attributesOf(errorRegion).role, "region");
  assert.equal(attributesOf(errorRegion)["aria-modal"], undefined);
  assert.match(legacyCss, /\.initialization-error-overlay\s*\{[\s\S]*?inset:\s*56px 0 0;/);
});

test("shell event ownership survives browser back-forward cache restoration", () => {
  assert.match(
    script,
    /addEventListener\('pagehide', event => \{\s*if \(event\.persisted\) return;\s*topBarController\.destroy\(\);/
  );
});

test("shell disclosures and Quick Search expose complete button and combobox semantics", () => {
  const disclosureTags = [
    ...topBar.matchAll(/<button\b[^>]*data-shell-trigger=["'][^"']+["'][^>]*>/g)
  ].map((match) => match[0]);
  assert.equal(disclosureTags.length, 5);

  for (const tag of disclosureTags) {
    const attributes = attributesOf(tag);
    assert.equal(attributes.type, "button");
    assert.equal(attributes["aria-expanded"], "false");
    assert.ok(attributes["aria-controls"]);
    assert.match(topBar, new RegExp(`id=["']${escapeRegExp(attributes["aria-controls"])}["']`));
    assert.match(
      topBar,
      new RegExp(`data-shell-panel=["']${escapeRegExp(attributes["data-shell-trigger"])}["']`)
    );
  }

  assert.doesNotMatch(topBar, /data-account-trigger/);

  const launcherTag = topBar.match(/<button\b[^>]*data-search-launcher[^>]*>/)?.[0];
  assert.ok(launcherTag);
  assert.equal(attributesOf(launcherTag)["aria-expanded"], "false");
  assert.equal(attributesOf(launcherTag)["aria-controls"], "quick-search-surface");

  const comboboxTag = topBar.match(/<input\b[^>]*id=["']quick-search-input["'][^>]*>/)?.[0];
  assert.ok(comboboxTag);
  assert.deepEqual(
    {
      role: attributesOf(comboboxTag).role,
      autocomplete: attributesOf(comboboxTag)["aria-autocomplete"],
      popup: attributesOf(comboboxTag)["aria-haspopup"],
      expanded: attributesOf(comboboxTag)["aria-expanded"],
      controls: attributesOf(comboboxTag)["aria-controls"]
    },
    {
      role: "combobox",
      autocomplete: "list",
      popup: "listbox",
      expanded: "false",
      controls: "quick-search-results"
    }
  );
  assert.match(topBar, /id=["']quick-search-results["'][^>]*role=["']listbox["']/);
  assert.match(
    topBar,
    /id=["']quick-search-status["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/
  );
  const filterTag = topBar.match(/<button\b[^>]*data-search-filter-trigger[^>]*>/)?.[0];
  assert.ok(filterTag);
  assert.deepEqual(
    {
      expanded: attributesOf(filterTag)["aria-expanded"],
      controls: attributesOf(filterTag)["aria-controls"],
      label: attributesOf(filterTag)["aria-label"]
    },
    {
      expanded: "false",
      controls: "quick-search-filter-panel",
      label: "Searchable records are loading"
    }
  );
  assert.match(
    topBar,
    /id=["']quick-search-filter-panel["'][\s\S]*?<fieldset>[\s\S]*?<legend>Search record types<\/legend>/
  );
  assert.doesNotMatch(topBar, /role=["']menu(?:itemcheckbox)?["']/);
  assert.match(shellScript, /option\.role = ["']option["']/);
  assert.match(shellScript, /option\.dataset\.searchResultKey = getSearchRecordKey\(record\)/);
  assert.doesNotMatch(shellScript, /option\.append\(button\)/);
  assert.doesNotMatch(shellCss, /\.kimap-quick-search__option\s*>\s*button/);
  assert.match(shellScript, /setAttribute\(["']aria-activedescendant["']/);
  assert.match(shellScript, /event\.key === ["']ArrowDown["'] \|\| event\.key === ["']ArrowUp["']/);
  assert.match(
    shellScript,
    /this\.activeSurface === ["']search["'][\s\S]*?closeTransient\(\{ restoreFocus: true \}\)/
  );
  assert.match(shellScript, /this\.suppressSearchFocusOpen = surface === ["']search["']/);
});

test("wide and compact ecosystem routes use the exact same-tab destinations", () => {
  const destinations = [
    "https://kenshi.wiki/",
    "https://talk.kenshi.wiki/",
    "https://kenshidb.wiki/",
    "https://web-fcs.kenshi.wiki/"
  ];

  for (const destination of destinations) {
    const anchorPattern = new RegExp(
      `<a\\b[^>]*href=["']${escapeRegExp(destination)}["'][^>]*>`,
      "g"
    );
    const anchors = [...topBar.matchAll(anchorPattern)].map((match) => match[0]);
    assert.equal(
      anchors.length,
      2,
      `${destination} should appear once per responsive presentation`
    );
    for (const anchor of anchors) {
      assert.equal(attributesOf(anchor).target, undefined, `${destination} must remain same-tab`);
    }
  }
});

test("branded ecosystem icons use verified Worker masks while functional glyphs stay inline", () => {
  const brandedIcons = {
    wiki: "wiki-icon.svg",
    forums: "chat-icon.svg",
    database: "database-icon.svg"
  };

  for (const [name, file] of Object.entries(brandedIcons)) {
    assert.equal(occurrences(topBar, new RegExp(`kimap-ecosystem-icon--${name}`, "g")), 2);
    assert.match(
      shellCss,
      new RegExp(
        `kim-asset:/icons/ecosystem/${escapeRegExp(file)}\\?v=2026-07-13-1`
      )
    );
  }

  assert.equal(occurrences(topBar, /M4 5h16v14H4Z/g), 2, "Web FCS keeps its inline glyph");
  assert.equal(occurrences(topBar, /class=["']kimap-ecosystem-web-fcs-icon["']/g), 2);
  assert.match(
    shellCss,
    /\.kimap-ecosystem-web-fcs-icon\s*\{[\s\S]*?transform:\s*scale\(1\.2\);[\s\S]*?transform-origin:\s*center;/
  );
  assert.doesNotMatch(
    `${topBar}\n${shellCss}`,
    /ecosystem\/(?:map|sun|moon|not-applicable)-icon\.svg/
  );
  assert.match(shellCss, /\.kimap-ecosystem-icon\s*\{[\s\S]*?background:\s*currentcolor;/);
  assert.match(shellCss, /mask-image:\s*var\(--kimap-ecosystem-mask\)/);
});

test("the anonymous shell omits remote account destinations", () => {
  assert.doesNotMatch(html, /Special:(?:MapPreferences|MapMemoryCard|CaravanCrate)|data-account-trigger/);
});

test("Quick Search renders full stable IDs on a dedicated wrapping metadata row", () => {
  assert.match(shellScript, /meta\.className = ["']kimap-quick-search__meta["']/);
  assert.match(shellScript, /kind\.className = ["']kimap-quick-search__kind["']/);
  assert.match(shellScript, /stableId\.className = ["']kimap-quick-search__id["']/);
  assert.match(shellScript, /stableId\.textContent = record\.id/);
  assert.match(
    shellCss,
    /\.kimap-quick-search__option\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/
  );
  assert.match(shellCss, /\.kimap-quick-search__id\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
  assert.doesNotMatch(
    between(shellCss, ".kimap-quick-search__id {", "}"),
    /text-overflow:\s*ellipsis|max-width:\s*45%/
  );
});

test("Quick Search filtering stays inside the search transient and preserves record routing", () => {
  assert.match(shellScript, /this\.enabledSearchFilterGroupIds = createSearchFilterSelection\(\)/);
  assert.match(shellScript, /this\.searchFilterOpen = false/);
  assert.match(
    shellScript,
    /filterSearchRecords\(\s*this\.searchIndex,\s*this\.enabledSearchFilterGroupIds\s*\)[\s\S]*?searchRecords\(filteredRecords, this\.searchInput\.value\)/
  );
  assert.match(shellScript, /Select at least one record type\./);
  assert.match(
    shellScript,
    /event\.key === ["']Escape["'][\s\S]*?event\.stopPropagation\(\)[\s\S]*?closeSearchFilter\(\{ focus: true \}\)/
  );
  assert.match(shellScript, /event\.key === ["']Tab["'][\s\S]*?focusElement\(firstCheckbox\)/);
  assert.match(shellScript, /this\.searchFilterOpen = false;[\s\S]*?this\.updateSearchResults\(\)/);
  assert.match(
    shellScript,
    /dismissTransient\(\{ restoreFocus = true \} = \{\}\)\s*\{[\s\S]*?this\.searchFilterOpen[\s\S]*?closeSearchFilter\(\{ focus: restoreFocus \}\)[\s\S]*?closeTransient\(\{ restoreFocus \}\)/
  );
  assert.match(
    shellScript,
    /typeof controller\.dismissTransient === ["']function["'][\s\S]*?controller\.dismissTransient\(options\)[\s\S]*?controller\.closeTransient\(options\)/
  );
  assert.match(
    shellCss,
    /kim-asset:\/icons\/search-filter\.svg\?v=2026-07-13-1/
  );
  assert.match(
    shellCss,
    /\.kimap-quick-search__filter-options\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.doesNotMatch(`${topBar}\n${shellScript}`, /recent search|result count|shortcut help/i);
});

test("Help uses registry-rendered utility entries and current Worker-routed document guidance", () => {
  assert.equal(occurrences(topBar, /data-destination-group=["']utility["']/g), 2);
  assert.doesNotMatch(topBar, /data-theater-id=["']help["']/);
  assert.match(helpScript, /rewriteElementAssetUrls\(article, \{ forceCdn: true \}\)/);
  assert.match(helpContent, /alt=["']Document management illustration["']/);
  assert.match(helpContent, /exact manifest baseline/i);
  assert.match(helpContent, /Scenario Documents/);
  assert.match(helpContent, /marker-set|marker set|Marker Sets/);
  assert.match(helpContent, /paint-plan|Paint Plans/);
  assert.doesNotMatch(
    helpContent,
    /Export accordion|Export Set|clear your current board|snapshots of the entire map state/i
  );
});

test("the shared theater header separates parent browsing from active pane semantics", () => {
  assert.match(html, /id=["']unified-groups["'][^>]*aria-label=["']Theater sections["']/);
  assert.match(html, /id=["']unified-tabs["'][^>]*aria-label=["']Theater destinations["']/);
  assert.match(html, /id=["']unified-help-btn["']/);
  assert.match(html, /id=["']unified-current-title["']/);
  assert.match(
    script,
    /windowManager\.configureNavigation\(\{[\s\S]*?THEATER_DESTINATION_GROUPS[\s\S]*?THEATER_DESTINATIONS[\s\S]*?utilityDestinationId:\s*['"]help['"]/
  );
  assert.match(windowManager, /this\.browsedGroupId/);
  assert.match(windowManager, /browseGroup\(groupId/);
  assert.match(windowManager, /getBrowsedGroupId\(\)/);
  assert.match(windowManager, /setAttribute\(["']role["'], ["']toolbar["']\)/);
  assert.match(windowManager, /pane\.element\.setAttribute\(["']role["'], ["']region["']\)/);
  assert.match(windowManager, /setAttribute\(["']aria-current["'], ["']page["']\)/);
  assert.doesNotMatch(windowManager, /setAttribute\(["']role["'], ["']tab(?:list|panel)?["']\)/);
  assert.doesNotMatch(windowManager, /setAttribute\(["']aria-selected["']/);
  assert.match(unifiedCss, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(
    unifiedCss,
    /#unified-tabs\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-auto-columns:\s*minmax\(180px, 1fr\);[\s\S]*?grid-auto-flow:\s*column;[\s\S]*?padding:\s*0 8px;/
  );
  assert.match(
    unifiedCss,
    /\.theater-destination-btn\s*\{[\s\S]*?width:\s*100%;[\s\S]*?white-space:\s*nowrap;/
  );
  assert.match(windowManager, /const isOverflowing = scrollWidth > clientWidth/);
  assert.doesNotMatch(unifiedCss, /@media\s*\([^)]*(?:max-width|min-width)/);
  assert.match(unifiedCss, /body:has\(#viewport-workbench\[data-phone="true"\]\) #unified-shell/);
});

test("wide navigation and standard Sites disclosures fit content while narrow panels stay full width", () => {
  assert.match(
    shellCss,
    /\.kimap-shell__navigation \.kimap-shell-disclosure\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?min-width:\s*max\(100%, 12rem\);[\s\S]*?max-width:\s*min\(22rem, calc\(100vw - 16px\)\);/
  );
  assert.match(
    shellCss,
    /\.kimap-shell__navigation \.kimap-destination-button > span\s*\{[\s\S]*?white-space:\s*nowrap;/
  );
  assert.match(
    shellCss,
    /\.kimap-shell__navigation \.kimap-destination-button:disabled::after\s*\{[\s\S]*?contain:\s*inline-size;/
  );
  assert.match(
    shellCss,
    /data-layout-class="standard"\] \.kimap-shell-disclosure,[\s\S]*?data-layout-class="narrow"\] \.kimap-shell-disclosure\s*\{[\s\S]*?width:\s*auto;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*none;/
  );
  assert.match(
    shellCss,
    /#top-bar\[data-layout-class="standard"\] #topbar-sites-panel\s*\{[\s\S]*?left:\s*auto;[\s\S]*?width:\s*max-content;[\s\S]*?min-width:\s*12rem;[\s\S]*?max-width:\s*min\(18rem, calc\(100vw - 16px\)\);/
  );
  assert.doesNotMatch(
    shellCss,
    /#top-bar\[data-layout-class="narrow"\] #topbar-sites-panel[\s\S]*?width:\s*max-content/
  );
});

test("the registry-rendered inline Help launcher uses one centered track", () => {
  assert.match(
    shellCss,
    /\.kimap-destination-list--inline \.kimap-destination-button\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?place-items:\s*center;[\s\S]*?width:\s*40px;/
  );
});

test("click-owned shell transients replace hover-only menus and the legacy command palette", () => {
  assert.match(shellScript, /this\.root\.addEventListener\(["']click["']/);
  assert.match(shellScript, /document\.addEventListener\(["']click["']/);
  assert.match(shellScript, /document\.addEventListener\(["']keydown["']/);
  assert.match(shellScript, /trigger\.setAttribute\(["']aria-expanded["'], ["']true["']\)/);
  assert.match(shellScript, /trigger\?\.setAttribute\(["']aria-expanded["'], ["']false["']\)/);
  assert.doesNotMatch(shellScript, /mouseenter|mouseleave|mouseover|mouseout/);
  assert.doesNotMatch(
    `${legacyCss}\n${shellCss}`,
    /\.(?:kimap-disclosure|kimap-account|theme-selector|user-menu):hover\b/
  );

  assert.doesNotMatch(html, /command-palette|x-data=["']commandPalette\(\)["']/i);
  assert.doesNotMatch(script, /commandPalette\s*\(|paletteComponent/);
  assert.doesNotMatch(
    `${html}\n${script}\n${legacyCss}`,
    /theme-selector|theme-dropdown|user-dropdown|top-bar-button-group/
  );
});

test("header and viewport transients share one mutually exclusive dismissal boundary", () => {
  assert.match(script, /createShellTransientAdapter\(topBarController\)/);
  assert.match(
    script,
    /onBeforeOpenTransient\(\)\s*\{[\s\S]*?closeActiveTransientSurface\(\{ restoreFocus: false \}\)/
  );
  assert.match(
    script,
    /topBarController\.closeTransient\(\{ restoreFocus: false \}\);\s*viewportComposition\.openTransientSurface\(surface\)/
  );
  assert.match(
    script,
    /shellTransientAdapter\.isActive\(\)[\s\S]*?shellTransientAdapter\.dismiss\(\{ restoreFocus: true \}\)/
  );
});

test("CSS ownership loads Pico first, shared document chrome after theme, and Workbench last", () => {
  const cssImports = [...script.matchAll(/^import ["']([^"']+\.css)["'];$/gm)].map(
    (match) => match[1]
  );
  const themeIndex = cssImports.indexOf("./modules/application-theme.css");
  const documentManagerIndex = cssImports.indexOf("./modules/document-manager.css");
  const shellIndex = cssImports.indexOf("./modules/top-bar/shell.css");
  const workbenchIndex = cssImports.indexOf("./modules/viewport/workbench.css");

  assert.equal(cssImports[0], "@picocss/pico/css/pico.min.css");
  assert.ok(themeIndex > 0);
  assert.equal(documentManagerIndex, themeIndex + 1);
  assert.equal(shellIndex, documentManagerIndex + 1);
  assert.equal(workbenchIndex, shellIndex + 1);
  assert.equal(workbenchIndex, cssImports.length - 1);
  assert.equal(occurrences(script, /modules\/application-theme\.css/g), 1);
  assert.equal(occurrences(script, /modules\/document-manager\.css/g), 1);
  assert.equal(occurrences(script, /modules\/top-bar\/shell\.css/g), 1);
  assert.equal(occurrences(script, /modules\/viewport\/workbench\.css/g), 1);
});
