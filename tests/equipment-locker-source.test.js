import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const occurrences = (value, pattern) => value.match(pattern)?.length ?? 0;

test("Equipment Locker keeps its theater boundary and consumes untouched staged datasets", () => {
  const html = read("../index.html");
  const script = read("../script.js");

  for (const id of [
    "pane-equipment",
    "equipment-locker-content",
    "equipment-list-column",
    "equipment-simulation-column"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }

  assert.match(script, /initEquipmentLockerModule\(windowManager,\s*\{/u);
  for (const dataset of [
    "weapons",
    "crossbows",
    "armours",
    "bags",
    "limbReplacements",
    "items",
    "mapItems",
    "nestItems",
    "characters",
    "weaponManufacturers"
  ]) {
    assert.match(
      script,
      new RegExp(`${dataset}:\\s*stagedDatasets\\.${dataset}`, "u"),
      `expected raw staged ${dataset} wiring`
    );
  }
  assert.doesNotMatch(
    script,
    /const lockerPayload\s*=|initEquipmentLockerModule\(windowManager, lockerPayload\)/u
  );
});

test("Equipment Locker builds one safe delegated native-control surface", () => {
  const source = read("../modules/equipment-locker.js");

  assert.match(source, /document\.createElement/u);
  assert.match(source, /\.textContent\s*=/u);
  assert.match(source, /\.replaceChildren\(/u);
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML/u);

  for (const property of [
    "lockerTab",
    "lockerPanel",
    "lockerSearch",
    "lockerRemovedToggle",
    "lockerCategory",
    "lockerCatalogKind",
    "lockerCharacterId",
    "lockerCandidateKind",
    "lockerAction",
    "lockerTarget",
    "lockerSlot",
    "lockerOccurrenceId",
    "lockerGridItem"
  ]) {
    assert.match(source, new RegExp(`dataset\\.${property}`, "u"), `expected ${property}`);
  }

  for (const action of [
    "storage-toggle",
    "add-storage",
    "equip",
    "move-storage",
    "remove",
    "clear-request",
    "clear-confirm",
    "clear-cancel"
  ]) {
    assert.match(source, new RegExp(`"${action}"`, "u"));
  }

  assert.match(source, /createElement\("button"/u);
  assert.match(source, /\.type\s*=\s*"button"/u);
  assert.match(source, /createElement\("details"/u);
  assert.match(source, /createElement\("summary"/u);
  assert.match(source, /\.type\s*=\s*"checkbox"/u);
  assert.match(source, /setAttribute\("role",\s*"tablist"\)/u);
  assert.match(source, /setAttribute\("role",\s*"tab"\)/u);
  assert.match(source, /setAttribute\("role",\s*"tabpanel"\)/u);
  assert.match(source, /setAttribute\("role",\s*"status"\)/u);
  assert.match(source, /setAttribute\("aria-live",\s*"polite"\)/u);
  assert.match(source, /closest\?\.\("\[data-locker-/u);
  assert.match(source, /addEventListener\("click"/u);
});

test("Equipment and Storage expose one retained keyboard grid route", () => {
  const source = read("../modules/equipment-locker.js");

  assert.match(source, /\[data-locker-grid-item\]/u);
  assert.match(source, /"ArrowLeft"[\s\S]*"ArrowRight"[\s\S]*"ArrowUp"[\s\S]*"ArrowDown"/u);
  assert.match(source, /"Home"[\s\S]*"End"/u);
  assert.match(source, /event\.ctrlKey/u);
  assert.match(source, /\.tabIndex\s*=\s*snapshot\.roving[^?]*\?\s*0\s*:\s*-1/u);
  assert.match(source, /createButton\("equipment-locker-(?:slot|tile)"/u);
});

test("Locker presentation remains authored, text-complete, and read-only for Character templates", () => {
  const source = read("../modules/equipment-locker.js");

  assert.match(source, /Authored Loadout Template/u);
  assert.match(source, /Show removed records/u);
  assert.match(source, /Equipment Summary/u);
  assert.match(source, /Clear Locker/u);
  assert.match(source, /No authored loadout evidence/u);
  assert.match(source, /Value0/u);
  assert.match(source, /Value1/u);
  assert.match(source, /Value2/u);
  for (const authoredKey of [
    "accuracy deviation at 0 skill",
    "accuracy perfect skill",
    "reload time min",
    "reload time max",
    "skill mod",
    "storage size width",
    "storage size height",
    "encumbrance effect",
    "HP",
    "strength mult"
  ]) {
    assert.match(source, new RegExp(`"${authoredKey}"`, "u"));
  }
  assert.match(source, /appendDataNotes\(container, character\.diagnostics\)/u);
  assert.match(source, /session\.setQuery\("items", ""\)/u);
  assert.match(source, /session\.setCategoryOpen\("items", target\.categoryKey, true\)/u);
  assert.doesNotMatch(source, /Apply (?:Character|Loadout)|data-locker-action[^\n]+apply/u);
  assert.doesNotMatch(source, /fetch\(|\.src\s*=|backgroundImage|\.dds\b|\\data\\|\/data\/items/iu);
});

test("Locker category and Storage disclosures remain singular, native, and keyboard-safe", () => {
  const source = read("../modules/equipment-locker.js");
  const css = read("../modules/equipment-locker.css");

  assert.equal(
    occurrences(css, /\.equipment-locker-category-summary::after\s*\{[^}]*content:\s*"›"/gu),
    1
  );
  assert.match(
    css,
    /\.equipment-locker-category-summary::after\s*\{[^}]*background-image:\s*none[^}]*transform:\s*rotate\(0deg\)/u
  );
  assert.match(
    css,
    /\.equipment-locker-category-summary::-webkit-details-marker\s*\{[^}]*display:\s*none/u
  );
  assert.match(css, /\.equipment-locker-category-summary::marker\s*\{[^}]*content:\s*""/u);

  assert.match(source, /toggle\.id\s*=\s*"equipment-locker-storage-toggle"/u);
  assert.match(
    source,
    /createButton\(\s*"equipment-locker-storage-toggle",\s*"Locker Storage",\s*"storage-toggle"\s*\)/u
  );
  assert.match(
    source,
    /toggle\.setAttribute\("aria-expanded",\s*String\(snapshot\.storageExpanded\)\)/u
  );
  assert.match(
    source,
    /toggle\.setAttribute\("aria-controls",\s*"equipment-locker-storage-body"\)/u
  );
  assert.match(source, /body\.id\s*=\s*"equipment-locker-storage-body"/u);
  assert.match(source, /body\.hidden\s*=\s*!snapshot\.storageExpanded/u);
  assert.match(css, /\.equipment-locker-storage-body\[hidden\]\s*\{[^}]*display:\s*none/u);
  assert.match(
    source,
    /case "storage-toggle":\s*session\.setStorageExpanded\(!session\.getSnapshot\(\)\.storageExpanded\)/u
  );
  assert.match(
    css,
    /\.equipment-locker-storage__empty\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*grid-row:\s*1\s*\/\s*-1/u
  );
});

test("Equipment uses the compact schematic while Preview, Details, and Storage stay text-complete", () => {
  const source = read("../modules/equipment-locker.js");
  const css = read("../modules/equipment-locker.css");
  const equipmentRenderer = source.slice(
    source.indexOf("function renderEquipment("),
    source.indexOf("function detailSection(")
  );

  assert.match(
    css,
    /\.equipment-locker-equipment-board\s*\{[^}]*grid-template-columns:\s*repeat\(5,[^}]*grid-template-rows:\s*repeat\(4,/u
  );
  assert.doesNotMatch(css, /grid-template-(?:columns|rows):\s*repeat\((?:22|17),/u);
  assert.match(css, /\.equipment-locker-slot\s*\{[^}]*min-height:\s*2\.75rem/u);
  assert.match(equipmentRenderer, /equipment-locker-slot__item-name/u);
  assert.doesNotMatch(equipmentRenderer, /createFootprintTile/u);
  assert.match(
    equipmentRenderer,
    /record\s*\?\s*`\$\{slot\.label\}: \$\{record\.name\}, \$\{record\.id\}`\s*:\s*`\$\{slot\.label\}: Empty`/u
  );

  assert.match(source, /equipment-locker-preview-name/u);
  assert.match(source, /equipment-locker-preview-id/u);
  assert.match(source, /equipment-locker-preview-kind/u);
  assert.equal(occurrences(source, /description\.tabIndex\s*=\s*0/gu), 2);
  assert.match(
    css,
    /\.equipment-locker-description\s*\{[^}]*max-height:\s*6\.5rem[^}]*overflow-y:\s*auto/u
  );
  assert.match(source, /equipment-locker-summary-list/u);
  assert.match(source, /equipment-locker-summary-row__slot/u);
  assert.match(source, /equipment-locker-summary-row__name/u);
  assert.match(source, /equipment-locker-summary-row__id/u);
  assert.match(source, /equipment-locker-summary-row__effects/u);
  assert.match(css, /--locker-storage-cell-size:\s*1\.5rem/u);
  assert.match(
    css,
    /\.equipment-locker-storage-body\s*\{[^}]*height:\s*12rem[^}]*max-height:\s*12rem/u
  );
});

test("Equipment Locker layout is pane-local and leaves responsive authority in CSS", () => {
  const source = read("../modules/equipment-locker.js");
  const css = read("../modules/equipment-locker.css");

  assert.match(css, /#pane-equipment\s*\{[^}]*container:\s*equipment-pane \/ inline-size/u);
  assert.match(css, /grid-template-columns:\s*15rem minmax\(0, 1fr\)/u);
  assert.match(
    css,
    /\.equipment-locker-workbench\s*\{[^}]*grid-template-areas:\s*"preview equipment details"\s*"preview storage details"[^}]*grid-template-columns:\s*13rem minmax\(23rem, 1\.2fr\) minmax\(18rem, 1fr\)/u
  );
  assert.match(css, /@container equipment-pane \(max-width:\s*72rem\)/u);
  assert.match(
    css,
    /@container equipment-pane \(max-width:\s*72rem\)[\s\S]*?grid-template-columns:\s*14rem minmax\(0, 1fr\)/u
  );
  assert.match(
    css,
    /@container equipment-pane \(max-width:\s*72rem\)[\s\S]*?\.equipment-locker-workbench\s*\{[^}]*grid-template-areas:\s*"preview details"\s*"equipment equipment"\s*"storage storage"[^}]*grid-template-columns:\s*minmax\(14rem, 0\.8fr\) minmax\(18rem, 1\.2fr\)/u
  );
  assert.match(css, /@container equipment-pane \(max-width:\s*56rem\)/u);
  assert.match(
    css,
    /@container equipment-pane \(max-width:\s*56rem\)[\s\S]*?\.equipment-locker-workbench\s*\{[^}]*grid-template-areas:\s*"preview"\s*"details"\s*"equipment"\s*"storage"/u
  );
  assert.match(css, /scrollbar-gutter:\s*stable/u);
  assert.match(
    css,
    /\.equipment-locker-equipment-scroll,\s*#pane-equipment \.equipment-locker-storage-scroll\s*\{[^}]*overflow-x:\s*auto/u
  );
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/u);
  assert.doesNotMatch(css, /@media\s*\([^)]*(?:width|height)/u);
  assert.doesNotMatch(source, /innerWidth|innerHeight|matchMedia|ResizeObserver/u);
});

test("the current release changes only application bundle cache tags", () => {
  const html = read("../index.html");
  const tag = "2026-11-07-vanilla-r2-v1";

  assert.equal(occurrences(html, new RegExp(tag, "g")), 2);
  assert.match(html, new RegExp(`dist/bundle\\.css\\?v=${tag}`, "u"));
  assert.match(html, new RegExp(`dist/bundle\\.js\\?v=${tag}`, "u"));
});
