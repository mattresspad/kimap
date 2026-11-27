import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findResearchBoardNavigationTarget } from "../modules/research-tree.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const boardEntries = [
  { id: "core-0-a", categoryIndex: 0, levelIndex: 0, itemIndex: 0 },
  { id: "core-0-b", categoryIndex: 0, levelIndex: 0, itemIndex: 1 },
  { id: "core-2", categoryIndex: 0, levelIndex: 2, itemIndex: 0 },
  { id: "craft-1", categoryIndex: 1, levelIndex: 1, itemIndex: 0 },
  { id: "craft-3", categoryIndex: 1, levelIndex: 3, itemIndex: 0 }
];

test("Research board uses one deterministic spatial roving-focus route", () => {
  assert.equal(
    findResearchBoardNavigationTarget(boardEntries, "core-0-a", "ArrowDown"),
    "core-0-b"
  );
  assert.equal(findResearchBoardNavigationTarget(boardEntries, "core-0-b", "ArrowDown"), "craft-1");
  assert.equal(findResearchBoardNavigationTarget(boardEntries, "craft-3", "ArrowLeft"), "craft-1");
  assert.equal(findResearchBoardNavigationTarget(boardEntries, "core-0-b", "ArrowRight"), "core-2");
  assert.equal(findResearchBoardNavigationTarget(boardEntries, "core-2", "Home"), "core-0-a");
  assert.equal(findResearchBoardNavigationTarget(boardEntries, "core-0-a", "End"), "core-2");
  assert.equal(
    findResearchBoardNavigationTarget(boardEntries, "craft-1", "Home", { ctrlKey: true }),
    "core-0-a"
  );
  assert.equal(
    findResearchBoardNavigationTarget(boardEntries, "core-0-a", "End", { ctrlKey: true }),
    "craft-3"
  );
  assert.equal(findResearchBoardNavigationTarget(boardEntries, "missing", "ArrowRight"), null);
});

test("Research browser safely renders native exact-ID controls without using D3", () => {
  const source = read("../modules/research-tree.js");
  const model = read("../modules/research-tree-model.js");
  const routing = read("../modules/research-tree-routing.js");
  const script = read("../script.js");

  assert.match(source, /document\.createElement/u);
  assert.match(source, /document\.createElementNS/u);
  assert.match(source, /button\.type = "button"/u);
  assert.match(source, /aria-pressed/u);
  assert.match(source, /aria-describedby/u);
  assert.match(source, /!event\.isComposing/u);
  assert.match(source, /previousSnapshot\?\.selectedId !== snapshot\.selectedId/u);
  assert.match(source, /details\.scrollTop = 0/u);
  assert.match(source, /data-research-board-id/u);
  assert.match(source, /data-research-catalog-id/u);
  assert.match(source, /data-research-jump-category/u);
  assert.match(source, /data-research-jump-level/u);
  assert.match(source, /data-research-jump-submit/u);
  assert.match(source, /ResizeObserver/u);
  assert.match(source, /requestAnimationFrame/u);
  assert.match(source, /"ArrowLeft"[\s\S]*"ArrowRight"[\s\S]*"Home"[\s\S]*"End"/u);
  assert.match(source, /event\.ctrlKey/u);
  assert.match(source, /scroller\.scrollTo/u);
  assert.match(source, /setPointerCapture/u);
  assert.match(source, /BOARD_PAN_EXCLUSION_SELECTOR/u);
  assert.match(
    source,
    /const onBoardPointerDown[\s\S]*?event\.pointerType === "touch"[\s\S]*?BOARD_PAN_EXCLUSION_SELECTOR[\s\S]*?event\.preventDefault\(\)[\s\S]*?setPointerCapture/u
  );
  assert.match(source, /stickyCategoryWidth[\s\S]*?stickyLevelHeight[\s\S]*?scroller\.scrollTo/u);
  assert.match(source, /canvasRect\.width <= 0 \|\| canvasRect\.height <= 0[\s\S]*?return null/u);
  assert.match(source, /if \(input === null\) return \[\];/u);
  assert.doesNotMatch(source, /card\.scrollIntoView/u);
  assert.match(source, /fill", "context-stroke"/u);
  assert.match(
    source,
    /import\s*\{\s*routeResearchTreeEdges\s*\}\s*from\s*"\.\/research-tree-routing\.js"/u
  );
  assert.match(source, /routeResearchTreeEdges\(/u);
  assert.match(source, /const groups = node\.unlockGroups/u);
  assert.match(source, /disableResearchBrowser/u);
  assert.match(source, /windowManager\.setAvailability/u);
  assert.doesNotMatch(source, /innerHTML|d3\.|d3\(|\bzoom\b/iu);
  assert.doesNotMatch(source, /\[1,\s*2,\s*3,\s*4,\s*5,\s*6\]/u);
  assert.doesNotMatch(model, /document\.|window\.|d3\.|innerHTML|\bzoom\b/iu);
  assert.doesNotMatch(routing, /document\.|window\.|d3\.|innerHTML|\bzoom\b/iu);
  assert.match(routing, /export function routeResearchTreeEdges/u);
  assert.match(model, /"requirements"[\s\S]*"requires"/u);
  assert.match(model, /dependentIds/u);
  assert.match(model, /boardLevelKeys/u);
  assert.match(model, /diagnosticsOpen/u);
  assert.match(model, /deepFreeze/u);
  assert.match(script, /initResearchTreeModule\(windowManager, stagedDatasets\.research\)/u);
  assert.match(script, /selectIndexableResearchRecords\(data\)/u);
  assert.match(script, /research: researchDatabase/u);
});

test("Research theater keeps stable regions and pane-local responsive ownership", () => {
  const html = read("../index.html");
  const css = read("../modules/research-tree.css");

  for (const id of [
    "pane-research",
    "research-workspace",
    "research-info-panel",
    "research-jump-form",
    "research-jump-category",
    "research-jump-level",
    "research-jump-submit",
    "research-tree-container",
    "research-details-panel"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }
  assert.doesNotMatch(html, /<main id="research-main"/u);
  assert.match(html, /<section id="research-main"/u);
  assert.match(html, /data-research-jump-form aria-label="Jump to a research section"/u);
  assert.match(html, /data-research-jump-submit aria-controls="research-tree-container" disabled/u);
  assert.ok(html.indexOf('id="research-jump-form"') < html.indexOf('id="research-tree-container"'));
  assert.doesNotMatch(
    html,
    /id="research-(?:info-panel|details-panel|tree-container)"[^>]*aria-live/u
  );
  assert.match(html, /\/vendor\/d3\/d3\.min\.js/u);
  assert.match(css, /container: research-pane \/ inline-size/u);
  assert.match(css, /@container research-pane \(max-width: 72rem\)/u);
  assert.match(css, /@container research-pane \(max-width: 56rem\)/u);
  assert.match(css, /@container research-pane \(max-width: 32rem\)/u);
  assert.match(css, /grid-template-columns: 14rem minmax\(0, 1fr\) 18rem/u);
  assert.match(
    css,
    /@container research-pane \(max-width: 72rem\)[\s\S]*?grid-template-columns: 14rem minmax\(0, 1fr\)/u
  );
  assert.match(
    css,
    /@container research-pane \(max-width: 32rem\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?grid-column: 1 \/ -1/u
  );
  assert.match(css, /--research-category-column: 7\.5rem/u);
  assert.match(css, /--research-level-column: 10\.5rem/u);
  assert.match(css, /--research-route-gap-inline: 0\.875rem/u);
  assert.match(css, /--research-route-gap-block: 0\.75rem/u);
  assert.match(css, /--research-route-outer-rail: 1rem/u);
  assert.match(css, /column-gap: var\(--research-route-gap-inline\)/u);
  assert.match(css, /row-gap: var\(--research-route-gap-block\)/u);
  assert.match(css, /padding-right: var\(--research-route-outer-rail\)/u);
  assert.match(css, /padding-bottom: var\(--research-route-outer-rail\)/u);
  assert.match(css, /\.research-jump-toolbar[\s\S]*?min-height: 2\.75rem/u);
  assert.match(css, /\.research-card\s*\{[^}]*min-height: 2\.75rem/u);
  assert.match(css, /\.research-card__name\s*\{[^}]*font-size: 0\.82rem/u);
  assert.match(
    css,
    /\.research-card__id\s*\{[^}]*font-size: 0\.65rem[^}]*overflow-wrap: anywhere/u
  );
  assert.match(css, /\.research-connector-base-layer/u);
  assert.match(css, /\.research-connector-highlight-layer/u);
  assert.match(css, /\.research-bus-junction/u);
  assert.match(css, /\.research-connector-base-layer\s*\{[^}]*opacity: 0\.48/u);
  assert.match(
    css,
    /\.research-connector-highlight-layer \.research-connector\s*\{[^}]*stroke-width: 2\.5/u
  );
  assert.match(css, /cursor: grab/u);
  assert.match(css, /cursor: grabbing/u);
  assert.match(css, /touch-action: auto/u);
  assert.match(css, /\.research-board__scroller[\s\S]*overflow-x: auto/u);
  assert.match(css, /scrollbar-gutter: stable/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.doesNotMatch(
    sourceWithoutBoardObserver(read("../modules/research-tree.js")),
    /innerWidth|matchMedia/u
  );
  assert.doesNotMatch(css, /\bzoom\s*:|\bscale\(/iu);
});

test("Research visual polish keeps native summaries, bounded sticky labels, and ruled identity facts", () => {
  const source = read("../modules/research-tree.js");
  const css = read("../modules/research-tree.css");

  assert.match(
    css,
    /:is\(#research-sidebar, #research-details\) \.research-region__header\s*\{[^}]*justify-content: center[^}]*text-align: center/u
  );
  assert.match(
    css,
    /:is\(#research-sidebar, #research-details\) \.research-region__header h2\s*\{[^}]*color: var\(--research-accent-strong\)/u
  );

  assert.match(
    source,
    /createElement\("summary", "research-category__summary"\)[\s\S]*?createElement\("span", "research-category__name", category\.name\)[\s\S]*?"research-category__count"/u
  );
  assert.match(
    source,
    /`Count: \$\{String\(category\.count\)\} of \$\{String\(category\.totalCount\)\}`/u
  );
  assert.match(source, /`Count: \$\{String\(category\.totalCount\)\}`/u);
  assert.match(
    css,
    /\.research-category__summary\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) auto 1\.75rem[^}]*overflow: hidden/u
  );
  assert.match(
    css,
    /\.research-category__name\s*\{[^}]*color: var\(--research-accent-strong\)[^}]*font-size: 0\.9rem[^}]*font-weight: 750[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/u
  );
  assert.match(
    css,
    /\.research-category__count\s*\{[^}]*white-space: nowrap[^}]*border: 1px solid var\(--research-border\)[^}]*border-radius: var\(--research-radius\)/u
  );
  assert.match(
    css,
    /\.research-category__summary::after\s*\{[^}]*width: 1\.75rem[^}]*height: 1\.75rem[^}]*content: "\\203A"[^}]*border: 1px solid var\(--research-border\)[^}]*border-radius: var\(--research-radius\)/u
  );

  assert.match(
    source,
    /createElement\("div", "research-board__category"\)[\s\S]*?createElement\(\s*"h3",\s*"research-board__category-heading"/u
  );
  assert.match(
    css,
    /\.research-board__category\s*\{[^}]*position: sticky[^}]*left: 0[^}]*align-self: stretch/u
  );
  assert.match(
    css,
    /\.research-board__category-heading\s*\{[^}]*position: sticky[^}]*top: 2\.5rem[^}]*min-height: 2\.75rem/u
  );

  assert.match(source, /createElement\("div", "research-detail__identity"\)/u);
  assert.match(css, /\.research-detail__header\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(css, /\.research-detail__identity\s*\{[^}]*display: grid/u);
  assert.match(
    css,
    /\.research-detail__title\s*\{[^}]*border: 1px solid var\(--research-border\)[^}]*overflow-wrap: break-word[^}]*word-break: normal/u
  );
  assert.match(
    css,
    /\.research-detail__id\s*\{[^}]*border: 1px solid var\(--research-border\)[^}]*overflow-wrap: anywhere/u
  );
  assert.match(css, /\.research-detail__clear\s*\{[^}]*width: 100%[^}]*height: 2\.75rem/u);

  assert.match(source, /function appendFacts\(section, rows, \{ ruled = false \} = \{\}\)/u);
  assert.match(source, /ruled \? "research-facts research-facts--ruled" : "research-facts"/u);
  assert.match(source, /createElement\("div", "research-facts__row"\)/u);
  assert.match(
    source,
    /function createOverviewSection\(node\)[\s\S]*?\{ ruled: true \}[\s\S]*?node\.description/u
  );
  assert.match(
    css,
    /\.research-facts__row \+ \.research-facts__row\s*\{[^}]*border-top: 1px solid var\(--research-border\)/u
  );
  assert.match(
    css,
    /\.research-facts__row > dt\s*\{[^}]*border-right: 1px solid var\(--research-border\)/u
  );
});

test("Research milestone updates only the application bundle query tag", () => {
  const html = read("../index.html");
  const tag = "2026-11-07-vanilla-r2-v1";
  assert.equal(html.split(tag).length - 1, 2);
  assert.match(html, new RegExp(`dist/bundle\\.css\\?v=${tag}`));
  assert.match(html, new RegExp(`dist/bundle\\.js\\?v=${tag}`));
});

function sourceWithoutBoardObserver(source) {
  return source.replaceAll("ResizeObserver", "");
}
