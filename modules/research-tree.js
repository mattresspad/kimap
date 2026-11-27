import {
  ResearchBrowserPresentationSession,
  createResearchBrowserView,
  createResearchGraph
} from "./research-tree-model.js";
import { routeResearchTreeEdges } from "./research-tree-routing.js";
import { getTheaterDestination } from "./top-bar/model.js";

const BOARD_NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End"
]);
const BOARD_PAN_EXCLUSION_SELECTOR =
  "button, input, select, textarea, a, summary, label, [contenteditable='true']";
const BOARD_PAN_THRESHOLD = 4;

function createElement(tagName, className = "", text = null) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== null) element.textContent = text;
  return element;
}

function formatNumber(value) {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatCats(value) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} Cats`;
}

function appendBadge(container, text, modifier) {
  container.appendChild(createElement("span", `research-badge research-badge--${modifier}`, text));
}

function appendNodeBadges(container, node) {
  if (node.internalReasons.includes("removed")) appendBadge(container, "Removed", "removed");
  if (node.internalReasons.includes("template")) appendBadge(container, "Template", "template");
  if (node.internal) appendBadge(container, "Internal", "internal");
  if (node.level === null) appendBadge(container, "Unclassified", "unclassified");
  if (node.behavior.blueprintOnly === true) appendBadge(container, "Blueprint", "blueprint");
  if (node.behavior.isLevelUpgrade === true) appendBadge(container, "Level upgrade", "level-up");
  if ((node.behavior.repeats ?? 0) > 0) appendBadge(container, "Repeatable", "repeatable");
}

function createCatalogItem(node, selected) {
  const button = createElement("button", "research-catalog-item");
  button.type = "button";
  button.dataset.researchCatalogId = node.id;
  button.setAttribute("aria-pressed", String(selected));
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-internal", node.internal);
  button.append(
    createElement("span", "research-catalog-item__name", node.name),
    createElement("span", "research-catalog-item__meta", `${node.id} · ${node.levelLabel}`)
  );
  const badges = createElement("span", "research-badges");
  appendNodeBadges(badges, node);
  if (badges.childElementCount > 0) button.appendChild(badges);
  return button;
}

function createBoardCard(node, snapshot, { categoryHeadingId, levelHeadingId }) {
  const button = createElement("button", "research-card");
  button.type = "button";
  button.dataset.researchBoardId = node.id;
  button.dataset.researchCategory = node.category;
  button.dataset.researchLevel = node.levelKey;
  button.setAttribute("aria-pressed", String(snapshot.selectedId === node.id));
  button.setAttribute("aria-describedby", `${categoryHeadingId} ${levelHeadingId}`);
  button.classList.toggle("is-internal", node.internal);
  button.tabIndex = snapshot.rovingId === node.id ? 0 : -1;
  button.append(
    createElement("span", "research-card__name", node.name),
    createElement("span", "research-card__id", node.id)
  );
  const badges = createElement("span", "research-card__badges research-badges");
  appendNodeBadges(badges, node);
  if (badges.childElementCount > 0) button.appendChild(badges);
  return button;
}

function normalizeNavigationEntries(entries) {
  return entries
    .filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        Number.isInteger(entry.categoryIndex) &&
        Number.isInteger(entry.levelIndex) &&
        Number.isInteger(entry.itemIndex)
    )
    .sort(
      (left, right) =>
        left.categoryIndex - right.categoryIndex ||
        left.levelIndex - right.levelIndex ||
        left.itemIndex - right.itemIndex ||
        left.id.localeCompare(right.id)
    );
}

/** Returns the exact board ID reached by one spatial roving-focus command. */
export function findResearchBoardNavigationTarget(
  entries,
  currentId,
  key,
  { ctrlKey = false } = {}
) {
  const ordered = normalizeNavigationEntries(entries);
  const current = ordered.find((entry) => entry.id === currentId);
  if (!current || !BOARD_NAVIGATION_KEYS.has(key)) return null;
  if (ctrlKey && key === "Home") return ordered[0]?.id ?? null;
  if (ctrlKey && key === "End") return ordered.at(-1)?.id ?? null;

  const lane = ordered.filter((entry) => entry.categoryIndex === current.categoryIndex);
  if (key === "Home") return lane[0]?.id ?? null;
  if (key === "End") return lane.at(-1)?.id ?? null;

  if (key === "ArrowLeft" || key === "ArrowRight") {
    const direction = key === "ArrowLeft" ? -1 : 1;
    const levels = [...new Set(lane.map(({ levelIndex }) => levelIndex))]
      .filter((levelIndex) =>
        direction < 0 ? levelIndex < current.levelIndex : levelIndex > current.levelIndex
      )
      .sort((left, right) => (direction < 0 ? right - left : left - right));
    const targetLevel = levels[0];
    if (targetLevel === undefined) return current.id;
    const candidates = lane.filter(({ levelIndex }) => levelIndex === targetLevel);
    return (
      candidates.sort(
        (left, right) =>
          Math.abs(left.itemIndex - current.itemIndex) -
            Math.abs(right.itemIndex - current.itemIndex) || left.itemIndex - right.itemIndex
      )[0]?.id ?? current.id
    );
  }

  const direction = key === "ArrowUp" ? -1 : 1;
  const inCell = lane.filter(({ levelIndex }) => levelIndex === current.levelIndex);
  const adjacentInCell = inCell.find(
    ({ itemIndex }) => itemIndex === current.itemIndex + direction
  );
  if (adjacentInCell) return adjacentInCell.id;

  const categoryIndexes = [...new Set(ordered.map(({ categoryIndex }) => categoryIndex))]
    .filter((index) =>
      direction < 0 ? index < current.categoryIndex : index > current.categoryIndex
    )
    .sort((left, right) => (direction < 0 ? right - left : left - right));
  for (const categoryIndex of categoryIndexes) {
    const candidates = ordered.filter((entry) => entry.categoryIndex === categoryIndex);
    if (candidates.length === 0) continue;
    return candidates.sort(
      (left, right) =>
        Math.abs(left.levelIndex - current.levelIndex) -
          Math.abs(right.levelIndex - current.levelIndex) ||
        Math.abs(left.itemIndex - current.itemIndex) -
          Math.abs(right.itemIndex - current.itemIndex) ||
        left.levelIndex - right.levelIndex ||
        left.itemIndex - right.itemIndex
    )[0].id;
  }
  return current.id;
}

function createEmptyInspector() {
  const empty = createElement("div", "research-details-empty");
  empty.tabIndex = -1;
  empty.dataset.researchInspectorEmpty = "";
  empty.append(
    createElement("h3", "", "Explore the Research graph"),
    createElement(
      "p",
      "",
      "Choose a record from the catalog or progression board to inspect its authored prerequisites, costs, effects, and unlock references."
    )
  );
  return empty;
}

function appendFacts(section, rows, { ruled = false } = {}) {
  const list = createElement(
    "dl",
    ruled ? "research-facts research-facts--ruled" : "research-facts"
  );
  for (const [label, value] of rows) {
    const term = createElement("dt", "", label);
    const description = createElement("dd", "", value);
    if (ruled) {
      const row = createElement("div", "research-facts__row");
      row.append(term, description);
      list.appendChild(row);
    } else {
      list.append(term, description);
    }
  }
  section.appendChild(list);
}

function createDetailSection(title) {
  const section = createElement("section", "research-detail__section");
  section.appendChild(createElement("h4", "", title));
  return section;
}

function appendReferenceIdentity(container, reference) {
  container.append(
    createElement("span", "research-static-reference__name", reference.name),
    createElement("span", "research-static-reference__id", reference.id ?? "Missing identity")
  );
}

function createStaticReference(
  reference,
  note = "",
  { value0Label = "Value0", showMissingValue0 = false } = {}
) {
  const row = createElement("li", "research-static-reference");
  appendReferenceIdentity(row, reference);
  if (reference.value0 !== null || showMissingValue0) {
    row.appendChild(
      createElement(
        "span",
        "research-static-reference__value",
        `${value0Label}: ${formatNumber(reference.value0)}`
      )
    );
  }
  if (note) row.appendChild(createElement("span", "research-static-reference__note", note));
  return row;
}

function appendRelationshipGroup(
  section,
  title,
  ids,
  graph,
  showInternal,
  emptyText = "None authored"
) {
  const group = createElement("div", "research-detail__group");
  group.appendChild(createElement("h5", "", title));
  if (ids.length === 0) {
    group.appendChild(createElement("p", "research-empty", emptyText));
    section.appendChild(group);
    return;
  }
  const list = createElement("ul", "research-list");
  for (const id of ids) {
    const related = graph.nodesById[id];
    if (related && (showInternal || !related.internal)) {
      const item = createElement("li", "");
      const button = createElement("button", "research-relationship");
      button.type = "button";
      button.dataset.researchRelationshipId = id;
      button.append(
        createElement("span", "research-relationship__name", related.name),
        createElement("span", "research-relationship__id", related.id)
      );
      item.appendChild(button);
      list.appendChild(item);
    } else if (related) {
      const row = createStaticReference({ name: related.name, id: related.id, value0: null });
      row.appendChild(
        createElement(
          "span",
          "research-static-reference__note",
          "Enable “Show removed and template records” to navigate to this record."
        )
      );
      list.appendChild(row);
    } else {
      list.appendChild(
        createStaticReference({ name: id, id, value0: null }, "Research target unavailable")
      );
    }
  }
  group.appendChild(list);
  section.appendChild(group);
}

function createOverviewSection(node) {
  const section = createDetailSection("Overview");
  appendFacts(
    section,
    [
      ["Name", node.name],
      ["Stable ID", node.id],
      ["Category", node.category],
      ["Level", node.levelLabel]
    ],
    { ruled: true }
  );
  section.appendChild(
    createElement(
      "p",
      node.description ? "research-detail__description" : "research-empty",
      node.description || "No description authored."
    )
  );
  return section;
}

function createProgressionSection(node, graph, showInternal, hiddenRelatedIds) {
  const section = createDetailSection("Progression");
  appendRelationshipGroup(
    section,
    "Prerequisite Research",
    node.prerequisiteIds,
    graph,
    showInternal,
    node.unresolvedPrerequisites.length > 0 ? "No resolved prerequisite records." : "None authored"
  );
  appendRelationshipGroup(
    section,
    "Direct Dependents",
    node.dependentIds,
    graph,
    showInternal,
    "None derived"
  );
  if (node.unresolvedPrerequisites.length > 0) {
    const group = createElement("div", "research-detail__group");
    group.appendChild(createElement("h5", "", "Unavailable Prerequisites"));
    const list = createElement("ul", "research-list");
    for (const reference of node.unresolvedPrerequisites) {
      list.appendChild(createStaticReference(reference, `Status: ${reference.status}`));
    }
    group.appendChild(list);
    section.appendChild(group);
  }
  const directIds = new Set([...node.prerequisiteIds, ...node.dependentIds]);
  const hiddenTransitiveIds = hiddenRelatedIds.filter((id) => !directIds.has(id));
  if (hiddenTransitiveIds.length > 0) {
    const group = createElement("div", "research-detail__group");
    group.appendChild(createElement("h5", "", "Hidden Related Path Records"));
    group.appendChild(
      createElement(
        "p",
        "research-detail__note",
        "Enable “Show removed and template records” to reveal these records on the progression board."
      )
    );
    const list = createElement("ul", "research-list");
    for (const id of hiddenTransitiveIds) {
      const related = graph.nodesById[id];
      list.appendChild(createStaticReference({ name: related?.name ?? id, id, value0: null }));
    }
    group.appendChild(list);
    section.appendChild(group);
  }
  return section;
}

function createCostsSection(node) {
  const section = createDetailSection("Research Costs");
  const facts = [["Research time", formatNumber(node.behavior.time)]];
  if ((node.behavior.money ?? 0) > 0) facts.push(["Money", formatCats(node.behavior.money)]);
  appendFacts(section, facts);
  if (node.costs.length === 0) {
    section.appendChild(createElement("p", "research-empty", "No authored item costs."));
  } else {
    const list = createElement("ul", "research-list");
    for (const reference of node.costs) {
      list.appendChild(
        createStaticReference(reference, "", {
          value0Label: "Quantity (Value0)",
          showMissingValue0: true
        })
      );
    }
    section.appendChild(list);
  }
  return section;
}

function meaningfulBehaviorRows(node) {
  const behavior = node.behavior;
  const rows = [];
  if (behavior.blueprintOnly === true) rows.push(["Blueprint only", "Yes"]);
  if (behavior.isLevelUpgrade === true) rows.push(["Level upgrade", "Yes"]);
  if ((behavior.repeats ?? 0) > 0) rows.push(["Repeats", formatNumber(behavior.repeats)]);
  if (behavior.repeatMultiplier !== null && behavior.repeatMultiplier !== 1) {
    rows.push(["Repeat multiplier", formatNumber(behavior.repeatMultiplier)]);
  }
  if (behavior.productionMultiplier !== null && behavior.productionMultiplier !== 1) {
    rows.push(["Production multiplier", formatNumber(behavior.productionMultiplier)]);
  }
  if (behavior.powerIncrease !== null && behavior.powerIncrease !== 0) {
    rows.push(["Power increase", formatNumber(behavior.powerIncrease)]);
  }
  if (behavior.powerCapacityIncrease !== null && behavior.powerCapacityIncrease !== 0) {
    rows.push(["Power capacity increase", formatNumber(behavior.powerCapacityIncrease)]);
  }
  return rows;
}

function createBehaviorSection(node) {
  const section = createDetailSection("Behavior & Effects");
  const rows = meaningfulBehaviorRows(node);
  if (rows.length === 0) {
    section.appendChild(
      createElement("p", "research-empty", "No meaningful behavior or effect values apply.")
    );
  } else appendFacts(section, rows);
  return section;
}

function createUnlocksSection(node) {
  const section = createDetailSection("Unlocks");
  const groups = node.unlockGroups;
  if (groups.length === 0) {
    section.appendChild(createElement("p", "research-empty", "No authored unlock references."));
    return section;
  }
  for (const group of groups) {
    const container = createElement("div", "research-detail__group");
    const heading = group.known ? group.label : `Unknown category: ${group.label}`;
    container.appendChild(createElement("h5", "", heading));
    if (group.references.length === 0) {
      container.appendChild(
        createElement("p", "research-empty", "No exact references authored in this category.")
      );
      section.appendChild(container);
      continue;
    }
    const list = createElement("ul", "research-list");
    for (const reference of group.references) list.appendChild(createStaticReference(reference));
    container.appendChild(list);
    section.appendChild(container);
  }
  return section;
}

function createNotesSection(node) {
  const section = createDetailSection("Data Notes");
  if (node.recordDiagnostics.length === 0) {
    section.appendChild(createElement("p", "research-empty", "No record-specific data notes."));
    return section;
  }
  const list = createElement("ul", "research-list");
  for (const diagnostic of node.recordDiagnostics) {
    const item = createElement("li", "research-diagnostic");
    item.append(
      createElement("strong", "", diagnostic.code.replaceAll("_", " ")),
      document.createTextNode(` — ${diagnostic.message}`)
    );
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

function renderInspector(container, graph, snapshot, view) {
  const node = graph.nodesById[snapshot.selectedId];
  if (!node) {
    container.replaceChildren(createEmptyInspector());
    return;
  }
  const detail = createElement("article", "research-detail");
  const header = createElement("header", "research-detail__header");
  const identity = createElement("div", "research-detail__identity");
  identity.append(
    createElement("h3", "research-detail__title", node.name),
    createElement("p", "research-detail__id", node.id)
  );
  const clear = createElement(
    "button",
    "secondary outline research-detail__clear",
    "Clear Selection"
  );
  clear.type = "button";
  clear.dataset.researchClearSelection = "";
  header.append(identity, clear);
  detail.append(
    header,
    createOverviewSection(node),
    createProgressionSection(node, graph, snapshot.showInternal, view.hiddenRelatedIds),
    createCostsSection(node),
    createBehaviorSection(node),
    createUnlocksSection(node),
    createNotesSection(node)
  );
  container.replaceChildren(detail);
}

function createGlobalDiagnostics(diagnostics, open) {
  const disclosure = createElement("details", "research-diagnostics");
  disclosure.dataset.researchDiagnostics = "";
  disclosure.open = open;
  const summary = createElement(
    "summary",
    "research-diagnostics__summary",
    `${String(diagnostics.length)} data ${diagnostics.length === 1 ? "note" : "notes"}`
  );
  const list = createElement("ul", "research-list");
  for (const entry of diagnostics) {
    const item = createElement("li", "research-diagnostic");
    item.appendChild(createElement("strong", "", entry.code.replaceAll("_", " ")));
    item.appendChild(document.createTextNode(` — ${entry.message}`));
    if (entry.recordId) {
      item.appendChild(createElement("span", "research-diagnostic__id", entry.recordId));
    }
    list.appendChild(item);
  }
  disclosure.append(summary, list);
  return disclosure;
}

function boardEntries(graph, visibleIds) {
  const visible = new Set(visibleIds);
  const categories = graph.categories.filter(({ nodeIds }) =>
    nodeIds.some((id) => visible.has(id))
  );
  const levels = graph.levels.filter(({ key }) =>
    visibleIds.some((id) => graph.nodesById[id].levelKey === key)
  );
  const categoryIndexes = new Map(categories.map(({ name }, index) => [name, index]));
  const levelIndexes = new Map(levels.map(({ key }, index) => [key, index]));
  const itemIndexes = new Map();
  for (const category of categories) {
    for (const level of levels) {
      const ids = category.nodeIds.filter(
        (id) => visible.has(id) && graph.nodesById[id].levelKey === level.key
      );
      ids.forEach((id, index) => itemIndexes.set(`${category.name}\0${level.key}\0${id}`, index));
    }
  }
  return visibleIds.map((id) => {
    const node = graph.nodesById[id];
    return {
      id,
      categoryIndex: categoryIndexes.get(node.category),
      levelIndex: levelIndexes.get(node.levelKey),
      itemIndex: itemIndexes.get(`${node.category}\0${node.levelKey}\0${id}`)
    };
  });
}

function createConnectorSvg() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("research-connectors");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const definitions = document.createElementNS(namespace, "defs");
  const marker = document.createElementNS(namespace, "marker");
  marker.id = "research-connector-arrow";
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "5");
  marker.setAttribute("markerHeight", "5");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = document.createElementNS(namespace, "path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrow.setAttribute("fill", "context-stroke");
  arrow.setAttribute("stroke", "none");
  marker.appendChild(arrow);
  definitions.appendChild(marker);
  const baseLayer = document.createElementNS(namespace, "g");
  baseLayer.classList.add("research-connector-base-layer");
  const highlightLayer = document.createElementNS(namespace, "g");
  highlightLayer.classList.add("research-connector-highlight-layer");
  svg.append(definitions, baseLayer, highlightLayer);
  return svg;
}

function relativeRect(element, containerRect) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - containerRect.left,
    right: rect.right - containerRect.left,
    top: rect.top - containerRect.top,
    bottom: rect.bottom - containerRect.top
  };
}

function coordinate(value) {
  return String(Math.round(value * 100) / 100);
}

function pointToward(origin, destination, distance) {
  if (origin.x === destination.x) {
    return { x: origin.x, y: origin.y + Math.sign(destination.y - origin.y) * distance };
  }
  return { x: origin.x + Math.sign(destination.x - origin.x) * distance, y: origin.y };
}

function roundedOrthogonalPath(points, cornerRadius = 4) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const commands = [`M ${coordinate(points[0].x)} ${coordinate(points[0].y)}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incoming = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const outgoing = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const radius = Math.min(cornerRadius, incoming / 2, outgoing / 2);
    const before = pointToward(current, previous, radius);
    const after = pointToward(current, next, radius);
    commands.push(
      `L ${coordinate(before.x)} ${coordinate(before.y)}`,
      `Q ${coordinate(current.x)} ${coordinate(current.y)} ${coordinate(after.x)} ${coordinate(after.y)}`
    );
  }
  const last = points.at(-1);
  commands.push(`L ${coordinate(last.x)} ${coordinate(last.y)}`);
  return commands.join(" ");
}

function connectorRoutingInput(canvas, graph, visibleIds, entries) {
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
  const visible = new Set(visibleIds);
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const cards = [...canvas.querySelectorAll("[data-research-board-id]")].flatMap((card) => {
    const id = card.dataset.researchBoardId;
    const entry = entriesById.get(id);
    if (!entry || !visible.has(id)) return [];
    const rect = relativeRect(card, canvasRect);
    if (rect.left >= rect.right || rect.top >= rect.bottom) return [];
    return [
      {
        id,
        categoryIndex: entry.categoryIndex,
        levelIndex: entry.levelIndex,
        rect
      }
    ];
  });
  const cells = [...canvas.querySelectorAll(".research-board__cell")];
  const levelOrder = [...new Set(entries.map(({ levelIndex }) => levelIndex))].sort(
    (left, right) => left - right
  );
  const categoryOrder = [...new Set(entries.map(({ categoryIndex }) => categoryIndex))].sort(
    (left, right) => left - right
  );
  const levelKeys = new Map();
  const categoryNames = new Map();
  for (const entry of entries) {
    const node = graph.nodesById[entry.id];
    if (!node) continue;
    levelKeys.set(entry.levelIndex, node.levelKey);
    categoryNames.set(entry.categoryIndex, node.category);
  }
  const columns = levelOrder.flatMap((levelIndex) => {
    const levelKey = levelKeys.get(levelIndex);
    const cell = cells.find((candidate) => candidate.dataset.researchLevel === levelKey);
    if (!cell) return [];
    const rect = relativeRect(cell, canvasRect);
    return [{ levelIndex, left: rect.left, right: rect.right }];
  });
  const rows = categoryOrder.flatMap((categoryIndex) => {
    const category = categoryNames.get(categoryIndex);
    const categoryCells = cells.filter(
      (candidate) => candidate.dataset.researchCategory === category
    );
    if (categoryCells.length === 0) return [];
    const rectangles = categoryCells.map((cell) => relativeRect(cell, canvasRect));
    return [
      {
        categoryIndex,
        top: Math.min(...rectangles.map(({ top }) => top)),
        bottom: Math.max(...rectangles.map(({ bottom }) => bottom))
      }
    ];
  });
  if (
    cards.length !== visible.size ||
    columns.length !== levelOrder.length ||
    rows.length !== categoryOrder.length
  )
    return null;

  const inlineGap = columns.length > 1 ? Math.max(2, columns[1].left - columns[0].right) : 10;
  const blockGap = rows.length > 1 ? Math.max(2, rows[1].top - rows[0].bottom) : 8;
  const verticalXs = [
    columns[0].left - inlineGap / 2,
    ...columns.slice(1).map((column, index) => (columns[index].right + column.left) / 2),
    columns.at(-1).right + inlineGap / 2
  ];
  const topRailY = Math.max(0, rows[0].top - blockGap / 2);
  const horizontalYs = [
    topRailY,
    ...rows.slice(1).map((row, index) => (rows[index].bottom + row.top) / 2),
    rows.at(-1).bottom + blockGap / 2
  ];
  const width = Math.max(canvas.scrollWidth, canvas.clientWidth);
  const height = Math.max(canvas.scrollHeight, canvas.clientHeight, horizontalYs.at(-1) + blockGap);
  const vertical = verticalXs.map((x, index) => ({
    id: `vertical-${String(index)}`,
    x,
    top: 0,
    bottom: height
  }));
  const horizontal = [
    {
      id: "outer-return",
      y: topRailY,
      left: verticalXs[0],
      right: verticalXs.at(-1),
      outer: true
    },
    ...horizontalYs.map((y, index) => ({
      id: `horizontal-${String(index)}`,
      y,
      left: verticalXs[0],
      right: verticalXs.at(-1),
      outer: false
    }))
  ];
  return {
    cards,
    edges: graph.edges.filter(
      ({ sourceId, targetId }) => visible.has(sourceId) && visible.has(targetId)
    ),
    channels: { vertical, horizontal },
    clearance: 4,
    width,
    height
  };
}

function renderConnectorGeometry(canvas, graph, visibleIds, entries) {
  const svg = canvas.querySelector(".research-connectors");
  if (!svg) return [];
  const namespace = "http://www.w3.org/2000/svg";
  const baseLayer = svg.querySelector(".research-connector-base-layer");
  const highlightLayer = svg.querySelector(".research-connector-highlight-layer");
  if (!baseLayer || !highlightLayer) return [];
  const input = connectorRoutingInput(canvas, graph, visibleIds, entries);
  if (input === null) return [];
  baseLayer.replaceChildren();
  highlightLayer.replaceChildren();
  const { width = Math.max(canvas.scrollWidth, canvas.clientWidth) } = input;
  const { height = Math.max(canvas.scrollHeight, canvas.clientHeight) } = input;
  svg.setAttribute("viewBox", `0 0 ${String(width)} ${String(height)}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  const result = routeResearchTreeEdges(input);
  for (const route of result.routes) {
    const path = document.createElementNS(namespace, "path");
    path.classList.add("research-connector");
    path.dataset.researchSourceId = route.sourceId;
    path.dataset.researchTargetId = route.targetId;
    path.dataset.researchEdgeKey = route.edgeKey;
    path.setAttribute("d", roundedOrthogonalPath(route.points));
    path.setAttribute("marker-end", "url(#research-connector-arrow)");
    baseLayer.appendChild(path);
  }
  for (const bus of result.buses) {
    const junctionPoint = bus.kind === "egress" ? bus.points.at(-1) : bus.points[0];
    const junction = document.createElementNS(namespace, "circle");
    junction.classList.add("research-bus-junction");
    junction.dataset.researchBusKind = bus.kind;
    junction.dataset.researchBusNodeId = bus.nodeId;
    junction.setAttribute("cx", coordinate(junctionPoint.x));
    junction.setAttribute("cy", coordinate(junctionPoint.y));
    junction.setAttribute("r", "2.5");
    baseLayer.appendChild(junction);
  }
  return result.omitted;
}

function applyBoardState(canvas, view, snapshot) {
  const matching = new Set(view.matchingIds);
  const subdued = new Set(view.subduedIds);
  const ancestors = new Set(view.ancestorIds);
  const dependents = new Set(view.dependentIds);
  for (const card of canvas.querySelectorAll("[data-research-board-id]")) {
    const id = card.dataset.researchBoardId;
    const selected = id === view.selectedId;
    card.setAttribute("aria-pressed", String(selected));
    card.tabIndex = id === snapshot.rovingId ? 0 : -1;
    card.classList.toggle("is-selected", selected);
    card.classList.toggle("is-related", ancestors.has(id) || dependents.has(id));
    card.classList.toggle("is-prerequisite", ancestors.has(id));
    card.classList.toggle("is-dependent", dependents.has(id));
    card.classList.toggle("is-search-match", view.searchActive && matching.has(id));
    card.classList.toggle("is-search-dimmed", subdued.has(id));
  }
  const highlightLayer = canvas.querySelector(".research-connector-highlight-layer");
  highlightLayer?.replaceChildren();
  const baseConnectors = canvas.querySelectorAll(
    ".research-connector-base-layer .research-connector"
  );
  for (const connector of baseConnectors) {
    const sourceId = connector.dataset.researchSourceId;
    const targetId = connector.dataset.researchTargetId;
    const prerequisiteEdge =
      view.selectedId !== null &&
      ancestors.has(sourceId) &&
      (ancestors.has(targetId) || targetId === view.selectedId);
    const dependentEdge =
      view.selectedId !== null &&
      dependents.has(targetId) &&
      (dependents.has(sourceId) || sourceId === view.selectedId);
    if (!highlightLayer || (!prerequisiteEdge && !dependentEdge)) continue;
    const highlighted = connector.cloneNode(false);
    highlighted.classList.add("is-highlighted");
    highlighted.classList.toggle("is-prerequisite", prerequisiteEdge);
    highlighted.classList.toggle("is-dependent", dependentEdge);
    highlightLayer.appendChild(highlighted);
  }
}

function renderBoard(container, graph, snapshot, view) {
  const board = createElement("div", "research-board");
  const scroller = createElement("div", "research-board__scroller");
  scroller.dataset.researchBoardScroller = "";
  if (view.boardNodeIds.length === 0) {
    scroller.appendChild(
      createElement(
        "p",
        "research-empty",
        "No Research records are visible. Enable “Show removed and template records” to reveal internal records."
      )
    );
    board.appendChild(scroller);
    container.replaceChildren(board);
    return { scroller, canvas: null, entries: [] };
  }
  const canvas = createElement("div", "research-board__canvas");
  try {
    canvas.appendChild(createConnectorSvg());
  } catch (error) {
    console.warn(
      "Research connectors are unavailable; cards and relationships remain usable.",
      error
    );
  }
  const grid = createElement("div", "research-board__grid");
  const visible = new Set(view.boardNodeIds);
  const visibleLevelKeys = new Set(view.boardLevelKeys);
  const visibleCategoryNames = new Set(view.boardCategoryNames);
  const levels = graph.levels.filter(({ key }) => visibleLevelKeys.has(key));
  const categories = graph.categories.filter(({ name }) => visibleCategoryNames.has(name));
  grid.style.setProperty("--research-level-count", String(levels.length));
  grid.appendChild(createElement("div", "research-board__corner", "Category"));
  for (const [levelIndex, level] of levels.entries()) {
    const heading = createElement("div", "research-board__level", level.label);
    heading.id = `research-board-level-${String(levelIndex)}`;
    heading.dataset.researchLevel = level.key;
    grid.appendChild(heading);
  }

  for (const [categoryIndex, category] of categories.entries()) {
    const categoryIds = category.nodeIds.filter((id) => visible.has(id));
    if (categoryIds.length === 0) continue;
    const lane = createElement("section", "research-board__lane");
    lane.dataset.researchCategory = category.name;
    const categoryHeadingId = `research-board-category-${String(categoryIndex)}`;
    const categoryTrack = createElement("div", "research-board__category");
    const categoryHeading = createElement("h3", "research-board__category-heading", category.name);
    categoryHeading.id = categoryHeadingId;
    lane.setAttribute("aria-labelledby", categoryHeadingId);
    categoryTrack.appendChild(categoryHeading);
    lane.appendChild(categoryTrack);
    for (const [levelIndex, level] of levels.entries()) {
      const cell = createElement("div", "research-board__cell");
      cell.dataset.researchCategory = category.name;
      cell.dataset.researchLevel = level.key;
      for (const id of categoryIds) {
        const node = graph.nodesById[id];
        if (node.levelKey === level.key) {
          cell.appendChild(
            createBoardCard(node, snapshot, {
              categoryHeadingId,
              levelHeadingId: `research-board-level-${String(levelIndex)}`
            })
          );
        }
      }
      lane.appendChild(cell);
    }
    grid.appendChild(lane);
  }
  canvas.appendChild(grid);
  scroller.appendChild(canvas);
  board.appendChild(scroller);
  container.replaceChildren(board);
  applyBoardState(canvas, view, snapshot);
  return { scroller, canvas, entries: boardEntries(graph, view.boardNodeIds) };
}

function renderJumpToolbar(controls, snapshot, view) {
  const { category, level, submit } = controls;
  const sections = view.jumpSections ?? [];
  if (sections.length === 0) {
    const unavailable = createElement("option", "", "No visible sections");
    unavailable.value = "";
    category.replaceChildren(unavailable);
    level.replaceChildren(createElement("option", "", "No populated levels"));
    category.disabled = true;
    level.disabled = true;
    submit.disabled = true;
    return;
  }

  category.disabled = false;
  level.disabled = false;
  submit.disabled = false;
  const target = snapshot.jumpTarget ?? {
    category: sections[0].category,
    levelKey: sections[0].levels[0].key
  };
  const targetSection =
    sections.find((section) => section.category === target.category) ?? sections[0];
  const targetLevel =
    targetSection.levels.find(({ key }) => key === target.levelKey) ?? targetSection.levels[0];

  category.replaceChildren(
    ...sections.map((section) => {
      const option = createElement("option", "", section.category);
      option.value = section.category;
      return option;
    })
  );
  category.value = targetSection.category;
  level.replaceChildren(
    ...targetSection.levels.map((entry) => {
      const option = createElement(
        "option",
        "",
        `${entry.label} (${String(entry.nodeIds.length)})`
      );
      option.value = entry.key;
      return option;
    })
  );
  level.value = targetLevel.key;
}

function createCatalogControls(snapshot) {
  const controls = createElement("div", "research-catalog-controls");
  const searchLabel = createElement("label", "research-search-label");
  searchLabel.appendChild(createElement("span", "", "Search Research"));
  const search = createElement("input");
  search.type = "search";
  search.className = "research-search";
  search.value = snapshot.query;
  search.placeholder = "Name or full stable ID…";
  search.autocomplete = "off";
  search.dataset.researchSearch = "";
  searchLabel.appendChild(search);

  const toggleLabel = createElement("label", "research-internal-toggle");
  const toggle = createElement("input");
  toggle.type = "checkbox";
  toggle.checked = snapshot.showInternal;
  toggle.dataset.researchInternalToggle = "";
  toggleLabel.append(toggle, document.createTextNode("Show removed and template records"));
  controls.append(searchLabel, toggleLabel);
  return controls;
}

function renderCatalog(container, graph, snapshot, view) {
  const active = document.activeElement;
  const activeId = active?.dataset?.researchCatalogId ?? null;
  const searchActive = active?.matches?.("[data-research-search]") ?? false;
  const toggleActive = active?.matches?.("[data-research-internal-toggle]") ?? false;
  const diagnosticsActive = active?.matches?.(".research-diagnostics__summary") ?? false;
  const activeCategory = active?.matches?.(".research-category__summary")
    ? (active.parentElement?.dataset?.researchCategory ?? null)
    : null;
  const searchStart = searchActive ? active.selectionStart : null;
  const searchEnd = searchActive ? active.selectionEnd : null;
  const fragment = document.createDocumentFragment();
  fragment.appendChild(createCatalogControls(snapshot));
  const resultCount = view.catalogCategories.reduce((sum, category) => sum + category.count, 0);
  const status = createElement(
    "p",
    "research-catalog-status",
    view.searchActive
      ? `${String(resultCount)} matching ${resultCount === 1 ? "record" : "records"}`
      : `${String(view.boardNodeIds.length)} Research records`
  );
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  fragment.appendChild(status);

  const list = createElement("div", "research-category-list");
  if (resultCount === 0) {
    list.appendChild(
      createElement(
        "p",
        "research-empty",
        view.searchActive
          ? "No Research records match this search."
          : "No Research records are visible. Enable “Show removed and template records” to reveal internal records."
      )
    );
  } else {
    for (const category of view.catalogCategories) {
      if (view.searchActive && category.count === 0) continue;
      const disclosure = createElement("details", "research-category");
      disclosure.dataset.researchCategory = category.name;
      disclosure.open = category.open;
      const summary = createElement("summary", "research-category__summary");
      summary.append(
        createElement("span", "research-category__name", category.name),
        createElement(
          "span",
          "research-category__count",
          view.searchActive
            ? `Count: ${String(category.count)} of ${String(category.totalCount)}`
            : `Count: ${String(category.totalCount)}`
        )
      );
      const items = createElement("div", "research-category__items");
      for (const id of category.nodeIds) {
        items.appendChild(createCatalogItem(graph.nodesById[id], snapshot.selectedId === id));
      }
      disclosure.append(summary, items);
      list.appendChild(disclosure);
    }
  }
  fragment.appendChild(list);
  if (graph.diagnostics.length > 0) {
    fragment.appendChild(createGlobalDiagnostics(graph.diagnostics, snapshot.diagnosticsOpen));
  }
  container.replaceChildren(fragment);

  if (searchActive) {
    const search = container.querySelector("[data-research-search]");
    search?.focus({ preventScroll: true });
    if (searchStart !== null && searchEnd !== null)
      search?.setSelectionRange(searchStart, searchEnd);
  } else if (toggleActive) {
    container.querySelector("[data-research-internal-toggle]")?.focus({ preventScroll: true });
  } else if (diagnosticsActive) {
    container
      .querySelector("[data-research-diagnostics] > summary")
      ?.focus({ preventScroll: true });
  } else if (activeCategory) {
    const disclosure = [...container.querySelectorAll("details[data-research-category]")].find(
      (candidate) => candidate.dataset.researchCategory === activeCategory
    );
    disclosure?.querySelector("summary")?.focus({ preventScroll: true });
  } else if (activeId) {
    const button = [...container.querySelectorAll("[data-research-catalog-id]")].find(
      (candidate) => candidate.dataset.researchCatalogId === activeId
    );
    button?.focus({ preventScroll: true });
  }
}

function findFocusTarget(pane, identity) {
  if (!identity) return null;
  if (identity.surface === "catalog-search") {
    return pane.querySelector("[data-research-search]");
  }
  if (identity.surface === "catalog-toggle") {
    return pane.querySelector("[data-research-internal-toggle]");
  }
  if (identity.surface === "catalog-category") {
    const disclosure = [...pane.querySelectorAll("details[data-research-category]")].find(
      (candidate) => candidate.dataset.researchCategory === identity.id
    );
    return disclosure?.querySelector("summary") ?? null;
  }
  if (identity.surface === "catalog-diagnostics") {
    return pane.querySelector("[data-research-diagnostics] > summary");
  }
  if (identity.surface === "catalog") {
    if (identity.id === null) return pane.querySelector("[data-research-search]");
    return [...pane.querySelectorAll("[data-research-catalog-id]")].find(
      (candidate) => candidate.dataset.researchCatalogId === identity.id
    );
  }
  if (identity.surface === "board-jump-category") {
    return pane.querySelector("[data-research-jump-category]");
  }
  if (identity.surface === "board-jump-level") {
    return pane.querySelector("[data-research-jump-level]");
  }
  if (identity.surface === "board-jump-submit") {
    return pane.querySelector("[data-research-jump-submit]");
  }
  if (identity.surface === "board") {
    return [...pane.querySelectorAll("[data-research-board-id]")].find(
      (candidate) => candidate.dataset.researchBoardId === identity.id
    );
  }
  if (identity.surface === "inspector") {
    if (identity.id === null) return pane.querySelector("[data-research-clear-selection]");
    return [...pane.querySelectorAll("[data-research-relationship-id]")].find(
      (candidate) => candidate.dataset.researchRelationshipId === identity.id
    );
  }
  if (identity.surface === "inspector-empty") {
    return pane.querySelector("[data-research-inspector-empty]");
  }
  return null;
}

function revealBoardCard(pane, id, { focus = false } = {}) {
  const card = [...pane.querySelectorAll("[data-research-board-id]")].find(
    (candidate) => candidate.dataset.researchBoardId === id
  );
  if (!card) return false;
  const scroller = card.closest("[data-research-board-scroller]");
  if (scroller) {
    const cardRect = card.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const stickyCategoryWidth =
      scroller.querySelector(".research-board__corner")?.getBoundingClientRect().width ?? 0;
    const stickyLevelHeight =
      scroller.querySelector(".research-board__level")?.getBoundingClientRect().height ?? 0;
    const usableWidth = Math.max(cardRect.width, scrollerRect.width - stickyCategoryWidth);
    const usableHeight = Math.max(cardRect.height, scrollerRect.height - stickyLevelHeight);
    scroller.scrollTo({
      left: Math.max(
        0,
        scroller.scrollLeft +
          cardRect.left -
          scrollerRect.left -
          stickyCategoryWidth -
          (usableWidth - cardRect.width) / 2
      ),
      top: Math.max(
        0,
        scroller.scrollTop +
          cardRect.top -
          scrollerRect.top -
          stickyLevelHeight -
          (usableHeight - cardRect.height) / 2
      ),
      behavior: "auto"
    });
  }
  if (focus) card.focus({ preventScroll: true });
  if (focus) {
    card.closest("#research-main")?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest"
    });
  }
  return true;
}

function frameScheduler(callback) {
  let frame = null;
  return {
    schedule() {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        callback();
      });
    },
    cancel() {
      if (frame === null) return;
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}

/** Initializes the structured, session-retained Research browser. */
export function initResearchTreeModule(windowManager, researchData) {
  const pane = document.getElementById("pane-research");
  const catalog = document.getElementById("research-info-panel");
  const boardHost = document.getElementById("research-tree-container");
  const details = document.getElementById("research-details-panel");
  const jumpForm = document.getElementById("research-jump-form");
  const jumpCategory = document.getElementById("research-jump-category");
  const jumpLevel = document.getElementById("research-jump-level");
  const jumpSubmit = document.getElementById("research-jump-submit");
  if (
    !pane ||
    !catalog ||
    !boardHost ||
    !details ||
    !jumpForm ||
    !jumpCategory ||
    !jumpLevel ||
    !jumpSubmit
  ) {
    console.error("Research browser: required pane elements were not found.");
    try {
      windowManager.setAvailability(
        "research",
        false,
        "Research Tree is unavailable because its browser interface could not be initialized."
      );
    } catch (error) {
      console.error("Research browser availability could not be updated.", error);
    }
    return null;
  }

  let graph;
  let projectionFailed = false;
  try {
    graph = createResearchGraph(researchData);
  } catch (error) {
    projectionFailed = true;
    console.error(
      "Research browser projection failed; ordinary map exploration remains active.",
      error
    );
    graph = createResearchGraph([]);
  }

  let session;
  try {
    session = new ResearchBrowserPresentationSession({ graph });
  } catch (error) {
    console.error(
      "Research browser state initialization failed; ordinary map exploration remains active.",
      error
    );
    windowManager.setAvailability(
      "research",
      false,
      "Research Tree is unavailable because its browser state could not be initialized."
    );
    return null;
  }
  let rendered = false;
  let board = null;
  let connectorObserver = null;
  let unsubscribe = null;
  let previousSnapshot = null;
  let boardPan = null;
  const reportedConnectorOmissions = new Set();

  const scheduleGeometry = frameScheduler(() => {
    if (!board?.canvas?.isConnected) return;
    try {
      const snapshot = session.getSnapshot();
      const view = createResearchBrowserView(graph, snapshot);
      const omitted = renderConnectorGeometry(
        board.canvas,
        graph,
        view.boardNodeIds,
        board.entries
      );
      for (const entry of omitted) {
        if (reportedConnectorOmissions.has(entry.edgeKey)) continue;
        reportedConnectorOmissions.add(entry.edgeKey);
        console.warn(
          `Research connector '${entry.sourceId}' → '${entry.targetId}' was omitted (${entry.reason}); inspector relationships remain available.`
        );
      }
      applyBoardState(board.canvas, view, snapshot);
    } catch (error) {
      console.warn(
        "Research connector redraw failed; cards and relationships remain usable.",
        error
      );
    }
  });

  const disconnectConnectors = () => {
    connectorObserver?.disconnect();
    connectorObserver = null;
    scheduleGeometry.cancel();
  };

  let runtimeFailed = false;
  const disableResearchBrowser = (error) => {
    if (runtimeFailed) return;
    runtimeFailed = true;
    disconnectConnectors();
    console.error(
      "Research browser rendering failed; ordinary map exploration remains active.",
      error
    );
    const message =
      "Research Tree is unavailable because its presentation could not be rendered safely.";
    try {
      catalog.replaceChildren(createElement("p", "research-empty", message));
      boardHost.replaceChildren(createElement("p", "research-empty", message));
      details.replaceChildren(createElement("p", "research-details-empty", message));
      jumpCategory.disabled = true;
      jumpLevel.disabled = true;
      jumpSubmit.disabled = true;
    } catch (renderError) {
      console.error("Research browser failure notice could not be rendered.", renderError);
    }
    try {
      windowManager.setAvailability("research", false, message);
    } catch (availabilityError) {
      console.error("Research browser availability could not be updated.", availabilityError);
    }
  };

  const observeConnectors = () => {
    disconnectConnectors();
    scheduleGeometry.schedule();
    if (typeof ResizeObserver !== "function" || !board?.canvas) return;
    try {
      connectorObserver = new ResizeObserver(() => scheduleGeometry.schedule());
      connectorObserver.observe(board.canvas);
      for (const card of board.canvas.querySelectorAll("[data-research-board-id]")) {
        connectorObserver.observe(card);
      }
    } catch (error) {
      connectorObserver = null;
      console.warn(
        "Research connector observation is unavailable; the current geometry remains usable.",
        error
      );
    }
  };

  const render = (snapshot, changeType = "initial") => {
    if (
      changeType === "setBoardPosition" ||
      changeType === "setFocusIdentity" ||
      changeType === "setDiagnosticsOpen"
    ) {
      previousSnapshot = snapshot;
      return;
    }
    const view = createResearchBrowserView(graph, snapshot);
    renderJumpToolbar(
      { category: jumpCategory, level: jumpLevel, submit: jumpSubmit },
      snapshot,
      view
    );
    const rebuildBoard = !rendered || previousSnapshot?.showInternal !== snapshot.showInternal;
    const rebuildCatalog =
      !rendered ||
      changeType === "setQuery" ||
      changeType === "setShowInternal" ||
      changeType === "setCategoryOpen" ||
      previousSnapshot?.selectedId !== snapshot.selectedId;
    const rebuildInspector =
      !rendered ||
      previousSnapshot?.selectedId !== snapshot.selectedId ||
      previousSnapshot?.showInternal !== snapshot.showInternal;

    if (rebuildCatalog) renderCatalog(catalog, graph, snapshot, view);
    if (rebuildBoard) {
      board = renderBoard(boardHost, graph, snapshot, view);
      board.scroller.scrollTo({
        left: snapshot.boardPosition.left,
        top: snapshot.boardPosition.top,
        behavior: "auto"
      });
      observeConnectors();
    } else if (board?.canvas) applyBoardState(board.canvas, view, snapshot);
    if (rebuildInspector) {
      renderInspector(details, graph, snapshot, view);
      if (previousSnapshot?.selectedId !== snapshot.selectedId) details.scrollTop = 0;
    }

    rendered = true;
    previousSnapshot = snapshot;
  };

  const renderSafely = (snapshot, changeType = "initial") => {
    if (runtimeFailed) return false;
    try {
      render(snapshot, changeType);
      return true;
    } catch (error) {
      disableResearchBrowser(error);
      return false;
    }
  };

  unsubscribe = session.subscribe(({ type, snapshot }) => renderSafely(snapshot, type));

  const onInput = (event) => {
    if (event.target.matches("[data-research-search]") && !event.isComposing) {
      session.setQuery(event.target.value);
    }
  };
  const onChange = (event) => {
    if (event.target.matches("[data-research-jump-category]")) {
      const snapshot = session.getSnapshot();
      const view = createResearchBrowserView(graph, snapshot);
      const section = view.jumpSections.find(({ category }) => category === event.target.value);
      if (section?.levels[0]) session.setJumpTarget(section.category, section.levels[0].key);
      return;
    }
    if (event.target.matches("[data-research-jump-level]")) {
      session.setJumpTarget(jumpCategory.value, event.target.value);
      return;
    }
    if (event.target.matches("[data-research-internal-toggle]")) {
      session.setShowInternal(event.target.checked);
    }
  };
  const onToggle = (event) => {
    const diagnosticsDisclosure = event.target.closest?.("details[data-research-diagnostics]");
    if (diagnosticsDisclosure && catalog.contains(diagnosticsDisclosure)) {
      session.setDiagnosticsOpen(diagnosticsDisclosure.open);
      return;
    }
    const disclosure = event.target.closest?.("details[data-research-category]");
    if (!disclosure || !catalog.contains(disclosure)) return;
    if (session.getSnapshot().query.trim() !== "") {
      if (!disclosure.open) requestAnimationFrame(() => (disclosure.open = true));
      return;
    }
    session.setCategoryOpen(disclosure.dataset.researchCategory, disclosure.open);
  };
  const onClick = (event) => {
    const catalogButton = event.target.closest?.("[data-research-catalog-id]");
    if (catalogButton && catalog.contains(catalogButton)) {
      const id = catalogButton.dataset.researchCatalogId;
      session.setSelectedId(id);
      requestAnimationFrame(() => revealBoardCard(pane, id));
      return;
    }
    const boardButton = event.target.closest?.("[data-research-board-id]");
    if (boardButton && boardHost.contains(boardButton)) {
      const id = boardButton.dataset.researchBoardId;
      session.setRovingId(id);
      session.setSelectedId(id);
      return;
    }
    const relationship = event.target.closest?.("[data-research-relationship-id]");
    if (relationship && details.contains(relationship)) {
      const id = relationship.dataset.researchRelationshipId;
      session.setRovingId(id);
      session.setSelectedId(id);
      requestAnimationFrame(() => revealBoardCard(pane, id, { focus: true }));
      return;
    }
    const clear = event.target.closest?.("[data-research-clear-selection]");
    if (clear && details.contains(clear)) {
      session.clearSelection();
      requestAnimationFrame(() => {
        details.querySelector("[data-research-inspector-empty]")?.focus({ preventScroll: true });
      });
    }
  };
  const onBoardKeyDown = (event) => {
    const button = event.target.closest?.("[data-research-board-id]");
    if (!button || !boardHost.contains(button) || !BOARD_NAVIGATION_KEYS.has(event.key)) return;
    const targetId = findResearchBoardNavigationTarget(
      board?.entries ?? [],
      button.dataset.researchBoardId,
      event.key,
      { ctrlKey: event.ctrlKey }
    );
    if (!targetId) return;
    event.preventDefault();
    session.setRovingId(targetId);
    requestAnimationFrame(() => revealBoardCard(pane, targetId, { focus: true }));
  };
  const onSubmit = (event) => {
    if (!event.target.matches?.("[data-research-jump-form]")) return;
    event.preventDefault();
    const targetId = session.getJumpTargetNodeId();
    if (targetId === null) return;
    session.setRovingId(targetId);
    requestAnimationFrame(() => revealBoardCard(pane, targetId, { focus: true }));
  };
  const onFocusIn = (event) => {
    if (event.target.matches?.("[data-research-jump-category]")) {
      session.setFocusIdentity("board-jump-category");
      return;
    }
    if (event.target.matches?.("[data-research-jump-level]")) {
      session.setFocusIdentity("board-jump-level");
      return;
    }
    if (event.target.matches?.("[data-research-jump-submit]")) {
      session.setFocusIdentity("board-jump-submit");
      return;
    }
    const catalogButton = event.target.closest?.("[data-research-catalog-id]");
    if (catalogButton) {
      session.setFocusIdentity("catalog", catalogButton.dataset.researchCatalogId);
      return;
    }
    if (event.target.matches?.("[data-research-search]")) {
      session.setFocusIdentity("catalog-search");
      return;
    }
    if (event.target.matches?.("[data-research-internal-toggle]")) {
      session.setFocusIdentity("catalog-toggle");
      return;
    }
    if (event.target.matches?.(".research-category__summary")) {
      const disclosure = event.target.parentElement;
      session.setFocusIdentity("catalog-category", disclosure.dataset.researchCategory);
      return;
    }
    if (event.target.matches?.(".research-diagnostics__summary")) {
      session.setFocusIdentity("catalog-diagnostics");
      return;
    }
    const boardButton = event.target.closest?.("[data-research-board-id]");
    if (boardButton) {
      session.setRovingId(boardButton.dataset.researchBoardId);
      session.setFocusIdentity("board", boardButton.dataset.researchBoardId);
      return;
    }
    const relationship = event.target.closest?.("[data-research-relationship-id]");
    if (relationship) {
      session.setFocusIdentity("inspector", relationship.dataset.researchRelationshipId);
      return;
    }
    if (event.target.matches?.("[data-research-clear-selection]")) {
      session.setFocusIdentity("inspector", null);
      return;
    }
    if (event.target.matches?.("[data-research-inspector-empty]")) {
      session.setFocusIdentity("inspector-empty");
    }
  };
  const onBoardScroll = (event) => {
    if (!event.target.matches?.("[data-research-board-scroller]")) return;
    session.setBoardPosition(event.target.scrollLeft, event.target.scrollTop);
  };
  const finishBoardPan = (pointerId = null) => {
    if (!boardPan || (pointerId !== null && boardPan.pointerId !== pointerId)) return;
    const { pointerId: activePointerId, scroller } = boardPan;
    boardPan = null;
    scroller.classList.remove("is-grab-panning", "is-panning");
    if (scroller.hasPointerCapture?.(activePointerId)) {
      scroller.releasePointerCapture(activePointerId);
    }
  };
  const onBoardPointerDown = (event) => {
    const scroller = event.target.closest?.("[data-research-board-scroller]");
    if (
      !scroller ||
      event.button !== 0 ||
      event.isPrimary === false ||
      event.pointerType === "touch" ||
      event.target.closest?.(BOARD_PAN_EXCLUSION_SELECTOR)
    ) {
      return;
    }
    event.preventDefault();
    finishBoardPan();
    boardPan = {
      pointerId: event.pointerId,
      scroller,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: scroller.scrollLeft,
      startTop: scroller.scrollTop,
      moved: false
    };
    scroller.classList.add("is-grab-panning");
    scroller.setPointerCapture?.(event.pointerId);
  };
  const onBoardPointerMove = (event) => {
    if (!boardPan || boardPan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - boardPan.startX;
    const deltaY = event.clientY - boardPan.startY;
    if (!boardPan.moved && Math.hypot(deltaX, deltaY) < BOARD_PAN_THRESHOLD) return;
    boardPan.moved = true;
    boardPan.scroller.classList.add("is-panning");
    event.preventDefault();
    boardPan.scroller.scrollTo({
      left: Math.max(0, boardPan.startLeft - deltaX),
      top: Math.max(0, boardPan.startTop - deltaY),
      behavior: "auto"
    });
  };
  const onBoardPointerEnd = (event) => finishBoardPan(event.pointerId);

  pane.addEventListener("input", onInput);
  pane.addEventListener("change", onChange);
  pane.addEventListener("toggle", onToggle, true);
  pane.addEventListener("click", onClick);
  pane.addEventListener("keydown", onBoardKeyDown);
  pane.addEventListener("submit", onSubmit);
  pane.addEventListener("focusin", onFocusIn);
  pane.addEventListener("scroll", onBoardScroll, true);
  pane.addEventListener("pointerdown", onBoardPointerDown);
  pane.addEventListener("pointermove", onBoardPointerMove);
  pane.addEventListener("pointerup", onBoardPointerEnd);
  pane.addEventListener("pointercancel", onBoardPointerEnd);
  pane.addEventListener("lostpointercapture", onBoardPointerEnd);

  const onShow = () => {
    if (!rendered && !renderSafely(session.getSnapshot())) return;
    const snapshot = session.getSnapshot();
    try {
      if (board?.scroller) {
        board.scroller.scrollTo({
          left: snapshot.boardPosition.left,
          top: snapshot.boardPosition.top,
          behavior: "auto"
        });
      }
      scheduleGeometry.schedule();
      requestAnimationFrame(() => {
        findFocusTarget(pane, snapshot.focusIdentity)?.focus({ preventScroll: true });
      });
    } catch (error) {
      disableResearchBrowser(error);
    }
  };

  try {
    windowManager.register("research", getTheaterDestination("research")?.label, pane, onShow);
    windowManager.setAvailability(
      "research",
      graph.available,
      graph.available
        ? ""
        : projectionFailed
          ? "Research Tree is unavailable because its manifest data could not be projected safely."
          : "Research Tree is unavailable because the manifest contains no valid Research records."
    );
  } catch (error) {
    disableResearchBrowser(error);
  }

  return Object.freeze({
    graph,
    session,
    refreshConnectors: () => scheduleGeometry.schedule(),
    cleanup() {
      disconnectConnectors();
      unsubscribe?.();
      unsubscribe = null;
      pane.removeEventListener("input", onInput);
      pane.removeEventListener("change", onChange);
      pane.removeEventListener("toggle", onToggle, true);
      pane.removeEventListener("click", onClick);
      pane.removeEventListener("keydown", onBoardKeyDown);
      pane.removeEventListener("submit", onSubmit);
      pane.removeEventListener("focusin", onFocusIn);
      pane.removeEventListener("scroll", onBoardScroll, true);
      pane.removeEventListener("pointerdown", onBoardPointerDown);
      pane.removeEventListener("pointermove", onBoardPointerMove);
      pane.removeEventListener("pointerup", onBoardPointerEnd);
      pane.removeEventListener("pointercancel", onBoardPointerEnd);
      pane.removeEventListener("lostpointercapture", onBoardPointerEnd);
      finishBoardPan();
    }
  });
}
