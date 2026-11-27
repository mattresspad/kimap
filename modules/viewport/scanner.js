import { createScannerArtwork, createRibbonBox, describeRibbonBox } from "./scanner-ribbon.js";
import { formatResourceReading } from "./reporting-policy.js";

const GROUPS = Object.freeze(
  [
    [
      "coords",
      "Coords",
      [
        ["x", "X", "wt-coord-x"],
        ["z", "Z", "wt-coord-z"]
      ]
    ],
    ["spawn", "Spawn Area", null],
    ["biome", "Biome", null],
    [
      "fertility",
      "Farming",
      [
        ["arid", "Arid", "wt-arid"],
        ["green", "Green", "wt-green"],
        ["swamp", "Swamp", "wt-swamp"]
      ]
    ],
    [
      "resources",
      "Resources",
      [
        ["copper mult", "Copper", "wt-copper"],
        ["iron mult", "Iron", "wt-iron"],
        ["stone mult", "Stone", "wt-stone"],
        ["water mult", "Water", "wt-water"]
      ]
    ],
    [
      "ecosystem",
      "Ecosystem",
      [
        ["Acidic Ground", "Acidic Ground"],
        ["Acidic Water", "Acidic Water"]
      ]
    ],
    [
      "env",
      "Weather",
      [
        ["Gas", "Gas", "wt-gas"],
        ["Acid Rain", "Acid Rain"],
        ["Duststorm", "Duststorm", "wt-duststorm"],
        ["Burning", "Burning", "wt-burning"]
      ]
    ]
  ].map(([key, label, fields]) => Object.freeze({ key, label, fields: fields?.map(Object.freeze) }))
);

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(id, path) {
  const button = element("button", "wt-header-button");
  button.id = id;
  button.type = "button";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const shape = document.createElementNS(svg.namespaceURI, "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  button.append(svg);
  return button;
}

/** Presentation of resolved Scanner inputs; no geography or weather traversal lives here. */
export function createScannerReading({
  spawnArea = null,
  biome = null,
  resources = null,
  effects = []
} = {}) {
  const values = {};
  for (const key of [
    "arid",
    "green",
    "swamp",
    "copper mult",
    "iron mult",
    "stone mult",
    "water mult"
  ]) {
    const raw = resources?.Values?.[key];
    const farming = ["arid", "green", "swamp"].includes(key);
    values[key] = formatResourceReading(raw, farming);
  }
  for (const key of ["Acidic Ground", "Acidic Water", "Gas", "Acid Rain", "Duststorm", "Burning"]) {
    values[key] = Object.freeze({
      state: !spawnArea ? "unavailable" : effects.includes(key) ? "active" : "inactive",
      text: !spawnArea ? "Unavailable" : effects.includes(key) ? "Recorded" : "Not recorded"
    });
  }
  return Object.freeze({
    spawn: spawnArea?.Name ?? "None",
    biome: biome?.Name ?? "None",
    values: Object.freeze(values)
  });
}

/** Stable, passive cells. Updating a location never reconstructs the Scanner DOM. */
export function createScannerView(container) {
  container.classList.add("kimap-ui");
  container.dataset.mode = "scanner";
  const header = element("div", "wt-header");
  const mode = iconButton(
    "wt-mode",
    "M20 7h-5m5 0V2m0 5a9 9 0 0 0-15-2M4 17h5m-5 0v5m0-5a9 9 0 0 0 15 2"
  );
  mode.classList.add("wt-mode-switch");
  mode.hidden = true;
  const leftWing = element("div", "wt-wing wt-wing-left");
  const identities = element("span", "wt-identities");
  const heading = element("div", "wt-heading");
  const scannerIcon = createScannerArtwork("scanner-specs", "wt-identity wt-identity-scanner", "S");
  scannerIcon.title = "Scanner";
  const scorecardIcon = createScannerArtwork(
    "scorecard-swords",
    "wt-identity wt-identity-scorecard",
    "PS"
  );
  scorecardIcon.title = "Political Scorecard";
  const title = element("span", "wt-title", "Scanner");
  const summary = element("span", "wt-ribbon");
  summary.id = "wt-summary";
  const coordinateRow = element("span", "wt-ribbon-row wt-ribbon-coordinates");
  coordinateRow.setAttribute("role", "group");
  const summaryCoordinates = new Map();
  for (const key of ["x", "z"]) {
    const box = createRibbonBox("wt-ribbon-coordinate");
    const label = element("span", `wt-coord-${key}`, `${key.toUpperCase()}:`);
    const value = element("span", "wt-ribbon-coordinate-value", "—");
    box.append(label, value);
    summaryCoordinates.set(key, { box, value });
    coordinateRow.append(box);
  }
  const summaryArea = createRibbonBox("wt-ribbon-row wt-ribbon-primary wt-ribbon-area");
  const summaryAreaName = element("span", "wt-ribbon-name", "—");
  summaryArea.append(summaryAreaName);
  summary.append(coordinateRow, summaryArea);
  identities.append(scannerIcon, scorecardIcon);
  leftWing.append(mode, identities);
  heading.append(title, summary);
  const windowShortcut = element("button", "wt-header-button");
  windowShortcut.id = "wt-window";
  windowShortcut.type = "button";
  windowShortcut.disabled = true;
  windowShortcut.setAttribute("aria-label", "Open Environment Info");
  const anchor = iconButton("wt-anchor", "M4 7h16M4 7l4-4M4 7l4 4M20 17H4m16 0-4-4m4 4-4 4");
  anchor.setAttribute("aria-label", "Move widget to bottom left");
  const toggle = iconButton("wt-toggle", "M5 15l7-8 7 8Z");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Expand Scanner details");
  toggle.setAttribute("aria-controls", "wt-details");
  const rightWing = element("div", "wt-wing wt-wing-right");
  rightWing.append(windowShortcut, anchor, toggle);
  header.append(leftWing, heading, rightWing);
  const body = element("div", "");
  body.id = "wt-details";
  body.tabIndex = 0;
  body.setAttribute("role", "region");
  body.setAttribute("aria-label", "Scanner readings");
  const table = element("table", "");
  table.id = "wt-table";
  const rows = element("tbody", "");
  const cells = new Map();
  for (const group of GROUPS) {
    const row = element("tr", "");
    const label = element("th", "wt-label", group.label);
    label.scope = "row";
    const value = element("td", "wt-value");
    value.id = `wt-${group.key}`;
    if (!group.fields) value.textContent = "—";
    else {
      const boxes = element("div", `wt-boxes wt-boxes-${group.key}`);
      for (const [key, name, tone = "wt-highlight-bad"] of group.fields) {
        const box = element("span", "wt-reading");
        box.setAttribute("role", "group");
        box.dataset.reading = key;
        const hazard = group.key === "ecosystem" || group.key === "env";
        const labelNode = element("span", `wt-reading-label ${tone}`);
        labelNode.dataset.label = hazard ? name : `${name}:`;
        labelNode.append(element("span", "", labelNode.dataset.label));
        const number = element("span", "wt-reading-number", "—");
        if (hazard) box.classList.add("wt-reading-hazard");
        if (group.key === "ecosystem") {
          box.append(
            createScannerArtwork(
              key === "Acidic Ground" ? "caution-ground" : "caution-water",
              "wt-warning-artwork"
            )
          );
        }
        box.append(labelNode, number);
        boxes.append(box);
        cells.set(key, { box, number, name, hazard });
      }
      value.append(boxes);
    }
    row.append(label, value);
    rows.append(row);
  }
  table.append(rows);
  body.append(table);
  container.append(header, body);
  function setReading(key, data, reason = "Reading unavailable") {
    const cell = cells.get(key);
    const description = `${cell.name}: ${data.state === "unavailable" ? reason : data.text}`;
    if (
      cell.box.getAttribute("aria-label") === description &&
      cell.box.dataset.state === data.state
    )
      return;
    cell.box.dataset.state = data.state;
    cell.box.setAttribute("aria-label", description);
    cell.box.title = description;
    cell.number.textContent = cell.hazard ? "" : data.text;
  }
  const setText = (id, text) => {
    const node = container.querySelector(id);
    if (node.textContent !== text) node.textContent = text;
  };
  return {
    setCoordinates({ x, z, inBounds }) {
      for (const [key, value] of [
        ["x", x],
        ["z", z]
      ]) {
        const data = {
          state: inBounds ? "active" : "unavailable",
          text: inBounds ? String(Math.round(value)) : "—"
        };
        const reason =
          inBounds === false ? "Out of Bounds" : "Move across the map to read coordinates";
        setReading(key, data, reason);
        const coordinate = summaryCoordinates.get(key);
        if (coordinate.value.textContent !== data.text) coordinate.value.textContent = data.text;
        describeRibbonBox(coordinate.box, `${key.toUpperCase()}: ${inBounds ? data.text : reason}`);
      }
      describeRibbonBox(
        coordinateRow,
        [...summaryCoordinates.values()].map(({ box }) => box.title).join("; ")
      );
    },
    setArea(reading) {
      setText("#wt-spawn", reading.spawn);
      setText("#wt-biome", reading.biome);
      if (summaryAreaName.textContent !== reading.spawn)
        summaryAreaName.textContent = reading.spawn;
      describeRibbonBox(summaryArea, `Spawn Area: ${reading.spawn}`);
      for (const [key, value] of Object.entries(reading.values)) setReading(key, value);
    }
  };
}
