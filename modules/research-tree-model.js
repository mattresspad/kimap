import { deepFreeze } from "./scenario/utils.js";

const INTERNALS = new WeakMap();
const UNCLASSIFIED_LEVEL_KEY = "unclassified";
const UNCATEGORIZED = "Uncategorized";
const FOCUS_SURFACES = new Set([
  "catalog",
  "catalog-search",
  "catalog-toggle",
  "catalog-category",
  "catalog-diagnostics",
  "board",
  "board-jump-category",
  "board-jump-level",
  "board-jump-submit",
  "inspector",
  "inspector-empty"
]);
const IDLESS_FOCUS_SURFACES = new Set([
  "catalog-search",
  "catalog-toggle",
  "catalog-diagnostics",
  "board-jump-category",
  "board-jump-level",
  "board-jump-submit",
  "inspector-empty"
]);
const RECORD_FOCUS_SURFACES = new Set(["catalog", "board", "inspector"]);

export const RESEARCH_UNLOCK_GROUPS = deepFreeze([
  { category: "enable buildings", key: "buildings", label: "Buildings" },
  { category: "improve buildings", key: "improvements", label: "Building Improvements" },
  { category: "enable item", key: "items", label: "Items" },
  { category: "enable armour", key: "armour", label: "Armour" },
  { category: "enable robotics", key: "robotics", label: "Robotics" },
  { category: "enable crossbow", key: "crossbows", label: "Crossbows" },
  { category: "enable weapon type", key: "weaponTypes", label: "Weapon Types" },
  { category: "enable weapon model", key: "weaponModels", label: "Weapon Models" },
  { category: "blueprint item", key: "blueprintItems", label: "Blueprint Items" }
]);

const UNLOCK_BY_CATEGORY = new Map(RESEARCH_UNLOCK_GROUPS.map((group) => [group.category, group]));
const UNLOCK_ORDER = new Map(
  RESEARCH_UNLOCK_GROUPS.map(({ category }, index) => [category, index])
);
const CONTROL_REFERENCE_CATEGORIES = new Set(["requirements", "requires", "cost"]);

function exactId(value) {
  return typeof value === "string" && value !== "" && value.trim() === value ? value : null;
}

function compareNameAndId(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareReferences(left, right) {
  return (
    left.name.localeCompare(right.name) ||
    (left.id ?? "").localeCompare(right.id ?? "") ||
    (left.value0 ?? Number.NEGATIVE_INFINITY) - (right.value0 ?? Number.NEGATIVE_INFINITY) ||
    (left.value1 ?? Number.NEGATIVE_INFINITY) - (right.value1 ?? Number.NEGATIVE_INFINITY) ||
    (left.value2 ?? Number.NEGATIVE_INFINITY) - (right.value2 ?? Number.NEGATIVE_INFINITY)
  );
}

function compareDiagnostics(left, right) {
  return (
    (left.recordId ?? "").localeCompare(right.recordId ?? "") ||
    left.code.localeCompare(right.code) ||
    (left.relatedId ?? "").localeCompare(right.relatedId ?? "") ||
    left.message.localeCompare(right.message)
  );
}

function diagnostic(code, message, { recordId = null, relatedId = null, detail = null } = {}) {
  return {
    severity: "warning",
    code,
    message,
    recordId,
    relatedId,
    detail
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function structurallyEqual(left, right, seen = new WeakMap()) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;

  let paired = seen.get(left);
  if (paired?.has(right)) return true;
  if (!paired) {
    paired = new WeakSet();
    seen.set(left, paired);
  }
  paired.add(right);

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    if (!structurallyEqual(left[leftKeys[index]], right[rightKeys[index]], seen)) return false;
  }
  return true;
}

function sourceRecords(records) {
  if (Array.isArray(records)) return records;
  if (isRecord(records)) return Object.values(records);
  return [];
}

/** Returns exact-ID object records safe for the legacy exhaustive reference index. */
export function selectIndexableResearchRecords(records = []) {
  return Object.freeze(
    sourceRecords(records).filter((record) => isRecord(record) && exactId(record.StringId) !== null)
  );
}

function finiteValue(record, key, addDiagnostic) {
  const value = record?.Values?.[key];
  if (value === undefined) return null;
  if (Number.isFinite(value)) return value;
  addDiagnostic(
    diagnostic("invalid_numeric_value", `Research value '${key}' is not a finite number.`)
  );
  return null;
}

function booleanValue(record, key, addDiagnostic) {
  const value = record?.Values?.[key];
  if (value === undefined) return null;
  if (typeof value === "boolean") return value;
  addDiagnostic(diagnostic("invalid_boolean_value", `Research value '${key}' is not a boolean.`));
  return null;
}

function normalizeReference(reference, addDiagnostic = () => {}, category = "reference") {
  const id = exactId(reference?.StringId);
  let name;
  if (reference?.Name === undefined) {
    name = id ?? "Missing identity";
  } else if (typeof reference.Name === "string" && reference.Name.trim() !== "") {
    name = reference.Name.trim();
  } else {
    addDiagnostic(
      diagnostic(
        "invalid_reference_name",
        `Research reference category '${category}' contains a non-text or empty name.`
      )
    );
    name = id ?? "Missing identity";
  }

  const readValue = (key) => {
    const value = reference?.[key];
    if (value === undefined) return null;
    if (Number.isFinite(value)) return value;
    addDiagnostic(
      diagnostic(
        "invalid_reference_value",
        `Research reference category '${category}' contains a non-finite ${key}.`
      )
    );
    return null;
  };
  return {
    id,
    name,
    value0: readValue("Value0"),
    value1: readValue("Value1"),
    value2: readValue("Value2")
  };
}

function referenceList(record, category, addDiagnostic) {
  if (!isRecord(record?.ReferenceCategories)) return [];
  const references = record?.ReferenceCategories?.[category];
  if (references === undefined) return [];
  if (Array.isArray(references)) return references;
  addDiagnostic(
    diagnostic(
      "malformed_reference_category",
      `Research reference category '${category}' is not an array.`
    )
  );
  return [];
}

function normalizeReferences(record, category, addDiagnostic) {
  return referenceList(record, category, addDiagnostic)
    .map((reference) => {
      const normalized = normalizeReference(reference, addDiagnostic, category);
      if (normalized.id === null) {
        addDiagnostic(
          diagnostic(
            "malformed_reference",
            `Research reference category '${category}' contains an entry without an exact ID.`
          )
        );
      }
      return normalized;
    })
    .sort(compareReferences);
}

function normalizeCategory(record, addDiagnostic) {
  const value = record?.Values?.category;
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  addDiagnostic(
    diagnostic("missing_category", `Research has no usable category and uses '${UNCATEGORIZED}'.`)
  );
  return UNCATEGORIZED;
}

function normalizeName(record, id, addDiagnostic) {
  if (typeof record?.Name === "string" && record.Name.trim() !== "") {
    return record.Name.trim();
  }
  addDiagnostic(diagnostic("missing_name", "Research has no usable name and uses its exact ID."));
  return id;
}

function normalizeDescription(record, addDiagnostic) {
  const value = record?.Values?.description;
  if (value === undefined) return "";
  if (typeof value === "string") return value.trim();
  addDiagnostic(
    diagnostic("invalid_description", "Research description is not a text value and was omitted.")
  );
  return "";
}

function normalizeLevel(record, addDiagnostic) {
  const value = record?.Values?.level;
  if (Number.isInteger(value) && value >= 0) {
    return {
      level: value,
      levelKey: String(value),
      levelLabel: value === 0 ? "Starting Unlocks" : `Level ${String(value)}`
    };
  }
  addDiagnostic(
    diagnostic("unclassified_level", "Research has no usable nonnegative integer level.")
  );
  return { level: null, levelKey: UNCLASSIFIED_LEVEL_KEY, levelLabel: "Unclassified" };
}

function normalizeBehavior(record, addDiagnostic) {
  return {
    blueprintOnly: booleanValue(record, "blueprint only", addDiagnostic),
    isLevelUpgrade: booleanValue(record, "is level upgrade", addDiagnostic),
    time: finiteValue(record, "time", addDiagnostic),
    money: finiteValue(record, "money", addDiagnostic),
    repeats: finiteValue(record, "repeats", addDiagnostic),
    repeatMultiplier: finiteValue(record, "repeat mult", addDiagnostic),
    productionMultiplier: finiteValue(record, "production mult", addDiagnostic),
    powerIncrease: finiteValue(record, "power increase", addDiagnostic),
    powerCapacityIncrease: finiteValue(record, "power capacity increase", addDiagnostic)
  };
}

function normalizeUnlockGroups(record, addDiagnostic) {
  const categories = isRecord(record?.ReferenceCategories)
    ? Object.keys(record.ReferenceCategories).sort()
    : [];
  const groups = [];

  for (const category of categories) {
    if (CONTROL_REFERENCE_CATEGORIES.has(category)) continue;
    const known = UNLOCK_BY_CATEGORY.get(category);
    const references = normalizeReferences(record, category, addDiagnostic);
    if (references.length === 0 && known) continue;
    groups.push({
      category,
      key: known?.key ?? `unknown:${category}`,
      label: known?.label ?? category,
      known: Boolean(known),
      references
    });
  }

  return groups.sort(
    (left, right) =>
      Number(right.known) - Number(left.known) ||
      (UNLOCK_ORDER.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
        (UNLOCK_ORDER.get(right.category) ?? Number.MAX_SAFE_INTEGER) ||
      left.label.localeCompare(right.label) ||
      left.category.localeCompare(right.category)
  );
}

function indexUniqueRecords(records, diagnostics, diagnosticsById) {
  const grouped = new Map();

  for (const entry of sourceRecords(records)) {
    if (!isRecord(entry)) {
      diagnostics.push(
        diagnostic("malformed_record", "Research dataset contains a non-object record.")
      );
      continue;
    }
    const id = exactId(entry.StringId);
    if (id === null) {
      diagnostics.push(
        diagnostic("missing_identity", "Research record has no exact nonempty StringId.")
      );
      continue;
    }
    const entries = grouped.get(id) ?? [];
    entries.push(entry);
    grouped.set(id, entries);
  }

  const unique = new Map();
  for (const [id, entries] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    const [representative, ...duplicates] = entries;
    if (duplicates.some((entry) => !structurallyEqual(representative, entry))) {
      diagnostics.push(
        diagnostic(
          "conflicting_duplicate",
          "Research ID has conflicting duplicate records and was omitted.",
          { recordId: id }
        )
      );
      continue;
    }
    unique.set(id, representative);
    for (const _duplicate of duplicates) {
      const duplicateDiagnostic = diagnostic(
        "identical_duplicate",
        "Identical duplicate Research record was collapsed.",
        { recordId: id }
      );
      diagnostics.push(duplicateDiagnostic);
      const recordDiagnostics = diagnosticsById.get(id) ?? [];
      recordDiagnostics.push(duplicateDiagnostic);
      diagnosticsById.set(id, recordDiagnostics);
    }
  }
  return unique;
}

function findCyclicComponents(draftsById) {
  let nextIndex = 0;
  const componentStack = [];
  const onStack = new Set();
  const indexById = new Map();
  const lowLinkById = new Map();
  const components = [];

  for (const id of [...draftsById.keys()].sort()) {
    if (indexById.has(id)) continue;
    const traversal = [
      {
        id,
        parentId: null,
        nextNeighbor: 0,
        neighbors: draftsById.get(id).prerequisiteIds
      }
    ];

    while (traversal.length > 0) {
      const frame = traversal.at(-1);
      if (!indexById.has(frame.id)) {
        indexById.set(frame.id, nextIndex);
        lowLinkById.set(frame.id, nextIndex);
        nextIndex += 1;
        componentStack.push(frame.id);
        onStack.add(frame.id);
      }

      if (frame.nextNeighbor < frame.neighbors.length) {
        const requirementId = frame.neighbors[frame.nextNeighbor];
        frame.nextNeighbor += 1;
        if (!draftsById.has(requirementId)) continue;
        if (!indexById.has(requirementId)) {
          traversal.push({
            id: requirementId,
            parentId: frame.id,
            nextNeighbor: 0,
            neighbors: draftsById.get(requirementId).prerequisiteIds
          });
        } else if (onStack.has(requirementId)) {
          lowLinkById.set(
            frame.id,
            Math.min(lowLinkById.get(frame.id), indexById.get(requirementId))
          );
        }
        continue;
      }

      traversal.pop();
      if (frame.parentId !== null) {
        lowLinkById.set(
          frame.parentId,
          Math.min(lowLinkById.get(frame.parentId), lowLinkById.get(frame.id))
        );
      }
      if (lowLinkById.get(frame.id) !== indexById.get(frame.id)) continue;
      const component = [];
      let member;
      do {
        member = componentStack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== frame.id);
      if (component.length > 1) components.push(component.sort());
    }
  }
  return components.sort((left, right) => left[0].localeCompare(right[0]));
}

function attachDiagnostic(draft, entry) {
  draft.recordDiagnostics.push(entry);
}

function resolveRequirements(draft, record, draftsById, diagnostics) {
  const authored = [];
  const seenIds = new Set();
  const addRequirementDiagnostic = (entry) => {
    const contextual = { ...entry, recordId: entry.recordId ?? draft.id };
    diagnostics.push(contextual);
    attachDiagnostic(draft, contextual);
  };
  const references = [
    ...referenceList(record, "requirements", addRequirementDiagnostic).map((reference) => ({
      category: "requirements",
      reference
    })),
    ...referenceList(record, "requires", addRequirementDiagnostic).map((reference) => ({
      category: "requires",
      reference
    }))
  ];

  for (const { category, reference } of references) {
    const normalized = normalizeReference(reference, addRequirementDiagnostic, category);
    if (normalized.id === null) {
      const entry = diagnostic(
        "malformed_prerequisite",
        "Research prerequisite has no exact nonempty ID.",
        { recordId: draft.id }
      );
      diagnostics.push(entry);
      attachDiagnostic(draft, entry);
      authored.push({ ...normalized, status: "malformed" });
      continue;
    }
    if (seenIds.has(normalized.id)) continue;
    seenIds.add(normalized.id);

    if (normalized.id === draft.id) {
      const entry = diagnostic("self_prerequisite", "Research requires itself.", {
        recordId: draft.id,
        relatedId: normalized.id
      });
      diagnostics.push(entry);
      attachDiagnostic(draft, entry);
      authored.push({ ...normalized, status: "self" });
      continue;
    }

    const target = draftsById.get(normalized.id);
    if (!target) {
      const entry = diagnostic(
        "unresolved_prerequisite",
        "Research prerequisite does not resolve to one unique Research record.",
        { recordId: draft.id, relatedId: normalized.id }
      );
      diagnostics.push(entry);
      attachDiagnostic(draft, entry);
      authored.push({ ...normalized, status: "unresolved" });
      continue;
    }

    draft.prerequisiteIds.push(normalized.id);
    target.dependentIds.push(draft.id);
    authored.push({ ...normalized, name: target.name, status: "resolved" });
  }

  draft.prerequisiteIds.sort();
  draft.requirements = authored.sort(compareReferences);
  draft.unresolvedPrerequisites = draft.requirements.filter(({ status }) => status !== "resolved");
}

function finalizeGraph(draftsById, diagnostics) {
  for (const componentIds of findCyclicComponents(draftsById)) {
    const entry = diagnostic(
      "cyclic_prerequisites",
      "Research prerequisite graph contains a cycle.",
      { recordId: componentIds[0], detail: { recordIds: componentIds } }
    );
    diagnostics.push(entry);
    for (const id of componentIds) attachDiagnostic(draftsById.get(id), entry);
  }

  const nodes = [...draftsById.values()]
    .map((draft) => ({
      ...draft,
      dependentIds: [...new Set(draft.dependentIds)].sort(),
      recordDiagnostics: [...draft.recordDiagnostics].sort(compareDiagnostics)
    }))
    .sort(compareNameAndId);
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const categories = [...new Set(nodes.map(({ category }) => category))].sort().map((name) => ({
    name,
    nodeIds: nodes.filter((node) => node.category === name).map(({ id }) => id)
  }));
  const numericLevels = [...new Set(nodes.map(({ level }) => level).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
  const levels = numericLevels.map((value) => ({
    key: String(value),
    value,
    label: value === 0 ? "Starting Unlocks" : `Level ${String(value)}`
  }));
  if (nodes.some(({ level }) => level === null)) {
    levels.push({ key: UNCLASSIFIED_LEVEL_KEY, value: null, label: "Unclassified" });
  }
  const edges = nodes
    .flatMap((node) => node.prerequisiteIds.map((sourceId) => ({ sourceId, targetId: node.id })))
    .sort(
      (left, right) =>
        left.sourceId.localeCompare(right.sourceId) || left.targetId.localeCompare(right.targetId)
    );

  return { nodes, nodesById, categories, levels, edges };
}

/**
 * Builds an immutable, exact-ID Research graph without reading DOM or application state.
 */
export function createResearchGraph(records = []) {
  const diagnostics = [];
  const diagnosticsById = new Map();
  if (!Array.isArray(records) && !isRecord(records)) {
    diagnostics.push(
      diagnostic("invalid_dataset", "Research dataset must be an array or record collection.")
    );
  }
  const uniqueRecords = indexUniqueRecords(records, diagnostics, diagnosticsById);
  const draftsById = new Map();

  for (const [id, record] of [...uniqueRecords].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const recordDiagnostics = [...(diagnosticsById.get(id) ?? [])];
    const addDiagnostic = (entry) => {
      const contextual = { ...entry, recordId: entry.recordId ?? id };
      diagnostics.push(contextual);
      recordDiagnostics.push(contextual);
    };
    if (record.Values !== undefined && !isRecord(record.Values)) {
      addDiagnostic(
        diagnostic("malformed_values", "Research Values must be a keyed record when present.")
      );
    }
    if (record.ReferenceCategories !== undefined && !isRecord(record.ReferenceCategories)) {
      addDiagnostic(
        diagnostic(
          "malformed_reference_categories",
          "Research ReferenceCategories must be a keyed record when present."
        )
      );
    }
    const level = normalizeLevel(record, addDiagnostic);
    const internalReasons = [];
    if (record?.Values?.REMOVED === true) internalReasons.push("removed");
    if (record?.Values?.REMOVED !== undefined && typeof record?.Values?.REMOVED !== "boolean") {
      addDiagnostic(
        diagnostic("invalid_removed_flag", "Research REMOVED flag is not a boolean value.")
      );
    }
    if (id === "RESEARCH_TEMPLATE") internalReasons.push("template");

    draftsById.set(id, {
      id,
      name: normalizeName(record, id, addDiagnostic),
      category: normalizeCategory(record, addDiagnostic),
      ...level,
      description: normalizeDescription(record, addDiagnostic),
      internal: internalReasons.length > 0,
      internalReasons,
      prerequisiteIds: [],
      dependentIds: [],
      requirements: [],
      unresolvedPrerequisites: [],
      costs: normalizeReferences(record, "cost", addDiagnostic),
      unlockGroups: normalizeUnlockGroups(record, addDiagnostic),
      behavior: normalizeBehavior(record, addDiagnostic),
      recordDiagnostics
    });
  }

  for (const [id, record] of uniqueRecords) {
    const draft = draftsById.get(id);
    if (draft) resolveRequirements(draft, record, draftsById, diagnostics);
  }

  const finalized = finalizeGraph(draftsById, diagnostics);
  const validCount = finalized.nodes.length;
  return deepFreeze({
    available: validCount > 0,
    reason: validCount > 0 ? null : "no-valid-research-records",
    ...finalized,
    diagnostics: diagnostics.sort(compareDiagnostics),
    validCount
  });
}

function walkResearchGraph(graph, startId, relationship) {
  const visited = new Set();
  const pending = [...(graph.nodesById[startId]?.[relationship] ?? [])];
  while (pending.length > 0 && visited.size < graph.validCount) {
    const id = pending.pop();
    if (id === startId || visited.has(id) || !graph.nodesById[id]) continue;
    visited.add(id);
    pending.push(...graph.nodesById[id][relationship]);
  }
  return [...visited].sort();
}

/** Returns the complete bounded prerequisite ancestry and dependent descendants for one exact ID. */
export function collectResearchPath(graph, id) {
  if (!graph?.nodesById?.[id]) {
    return deepFreeze({ ancestorIds: [], dependentIds: [], relatedIds: [] });
  }
  const ancestorIds = walkResearchGraph(graph, id, "prerequisiteIds");
  const dependentIds = walkResearchGraph(graph, id, "dependentIds");
  return deepFreeze({
    ancestorIds,
    dependentIds,
    relatedIds: [...new Set([...ancestorIds, ...dependentIds])].sort()
  });
}

function matchesQuery(node, query) {
  const normalized = query.trim().toLowerCase();
  return (
    normalized === "" ||
    node.name.toLowerCase().includes(normalized) ||
    node.id.toLowerCase().includes(normalized)
  );
}

function createJumpSections(graph, eligibleIds) {
  return graph.categories.flatMap(({ name, nodeIds }) => {
    const levels = graph.levels.flatMap(({ key, label }) => {
      const populatedNodeIds = nodeIds.filter(
        (id) => eligibleIds.has(id) && graph.nodesById[id]?.levelKey === key
      );
      return populatedNodeIds.length === 0 ? [] : [{ key, label, nodeIds: populatedNodeIds }];
    });
    return levels.length === 0 ? [] : [{ category: name, levels }];
  });
}

/** Derives catalog filtering and board emphasis without changing graph topology. */
export function createResearchBrowserView(graph, snapshot = {}) {
  const query = typeof snapshot.query === "string" ? snapshot.query : "";
  const showInternal = snapshot.showInternal === true;
  const eligibleNodes = graph.nodes.filter((node) => showInternal || !node.internal);
  const eligibleIds = new Set(eligibleNodes.map(({ id }) => id));
  const searchActive = query.trim() !== "";
  const matchingIds = eligibleNodes.filter((node) => matchesQuery(node, query)).map(({ id }) => id);
  const matchingIdSet = new Set(matchingIds);
  const selectedId = eligibleIds.has(snapshot.selectedId) ? snapshot.selectedId : null;
  const path = collectResearchPath(graph, selectedId);
  const authoritativeIds = new Set(
    selectedId === null ? [] : [selectedId, ...path.ancestorIds, ...path.dependentIds]
  );
  const openCategoryIds = new Set(
    Array.isArray(snapshot.openCategoryIds) ? snapshot.openCategoryIds : []
  );
  const catalogCategories = graph.categories
    .map((category) => {
      const visibleIds = category.nodeIds.filter(
        (id) => eligibleIds.has(id) && matchingIdSet.has(id)
      );
      const totalCount = category.nodeIds.filter((id) => eligibleIds.has(id)).length;
      return {
        name: category.name,
        nodeIds: visibleIds,
        count: visibleIds.length,
        totalCount,
        open: searchActive ? visibleIds.length > 0 : openCategoryIds.has(category.name)
      };
    })
    .filter(({ count, totalCount }) => totalCount > 0 && (!searchActive || count > 0));
  const boardNodeIds = eligibleNodes.map(({ id }) => id);
  const subduedIds = searchActive
    ? boardNodeIds.filter((id) => !matchingIdSet.has(id) && !authoritativeIds.has(id))
    : [];
  const hiddenRelatedIds = path.relatedIds.filter((id) => !eligibleIds.has(id));
  const boardLevelKeys = graph.levels
    .filter(({ key }) => eligibleNodes.some(({ levelKey }) => levelKey === key))
    .map(({ key }) => key);
  const boardCategoryNames = graph.categories
    .filter(({ nodeIds }) => nodeIds.some((id) => eligibleIds.has(id)))
    .map(({ name }) => name);
  const jumpSections = createJumpSections(graph, eligibleIds);

  return deepFreeze({
    query,
    searchActive,
    showInternal,
    selectedId,
    catalogCategories,
    boardNodeIds,
    boardLevelKeys,
    boardCategoryNames,
    jumpSections,
    matchingIds,
    subduedIds,
    ancestorIds: path.ancestorIds.filter((id) => eligibleIds.has(id)),
    dependentIds: path.dependentIds.filter((id) => eligibleIds.has(id)),
    hiddenRelatedIds
  });
}

function requireExactChoice(internal, id, label, { nullable = true, visible = false } = {}) {
  if (id === null && nullable) return null;
  if (exactId(id) === null || !internal.allowedIds.has(id)) {
    throw new TypeError(`Unknown Research ${label} ID '${String(id)}'.`);
  }
  if (visible && !internal.showInternal && internal.internalIds.has(id)) {
    throw new TypeError(`Research ${label} ID '${id}' is hidden by the internal-record filter.`);
  }
  return id;
}

function jumpCellNodeIds(internal, target) {
  if (target === null) return [];
  return internal.nodes
    .filter(
      (node) =>
        node.category === target.category &&
        node.levelKey === target.levelKey &&
        (internal.showInternal || !node.internal)
    )
    .map(({ id }) => id);
}

function jumpTargetForNode(internal, id) {
  const node = id === null ? null : internal.nodesById[id];
  if (!node || (!internal.showInternal && node.internal)) return null;
  return { category: node.category, levelKey: node.levelKey };
}

function firstJumpTargetInCategory(internal, category) {
  if (category === null) return null;
  for (const { key } of internal.levels) {
    const target = { category, levelKey: key };
    if (jumpCellNodeIds(internal, target).length > 0) return target;
  }
  return null;
}

function normalizeJumpTarget(internal) {
  if (jumpCellNodeIds(internal, internal.jumpTarget).length > 0) return;
  internal.jumpTarget =
    firstJumpTargetInCategory(internal, internal.jumpTarget?.category ?? null) ??
    jumpTargetForNode(internal, internal.rovingId);
}

function createPresentationSnapshot(internal) {
  return deepFreeze({
    query: internal.query,
    showInternal: internal.showInternal,
    diagnosticsOpen: internal.diagnosticsOpen,
    selectedId: internal.selectedId,
    openCategoryIds: [...internal.openCategoryIds].sort(),
    rovingId: internal.rovingId,
    jumpTarget: internal.jumpTarget === null ? null : { ...internal.jumpTarget },
    focusIdentity: internal.focusIdentity,
    boardPosition: { ...internal.boardPosition }
  });
}

function notify(session, type) {
  const internal = INTERNALS.get(session);
  internal.snapshot = createPresentationSnapshot(internal);
  const change = deepFreeze({ type, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Presentation observers cannot roll back an already committed browser-state change.
    }
  }
  return change;
}

/** Session-local Research browser presentation state; it never owns Research data. */
export class ResearchBrowserPresentationSession {
  constructor({ graph } = {}) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.categories)) {
      throw new TypeError("Research browser presentation requires a Research graph.");
    }
    const allowedIds = new Set(graph.nodes.map(({ id }) => id));
    const internalIds = new Set(graph.nodes.filter(({ internal }) => internal).map(({ id }) => id));
    const categoryIds = new Set(graph.categories.map(({ name }) => name));
    const levelKeys = new Set(graph.levels.map(({ key }) => key));
    const defaultVisibleCategoryIds = new Set(
      graph.nodes.filter(({ internal }) => !internal).map(({ category }) => category)
    );
    const defaultCategory = defaultVisibleCategoryIds.has("Core")
      ? "Core"
      : (graph.categories.find(({ name }) => defaultVisibleCategoryIds.has(name))?.name ?? null);
    const defaultRovingId = graph.nodes.find(({ internal }) => !internal)?.id ?? null;
    const defaultJumpTarget =
      defaultRovingId === null
        ? null
        : {
            category: graph.nodesById[defaultRovingId].category,
            levelKey: graph.nodesById[defaultRovingId].levelKey
          };
    const internal = {
      allowedIds,
      internalIds,
      categoryIds,
      levelKeys,
      nodes: graph.nodes,
      nodesById: graph.nodesById,
      levels: graph.levels,
      defaultOpenCategoryIds: new Set(defaultCategory === null ? [] : [defaultCategory]),
      firstCategoryId: graph.categories[0]?.name ?? null,
      defaultRovingId,
      defaultJumpTarget,
      firstRovingId: graph.nodes[0]?.id ?? null,
      query: "",
      showInternal: false,
      diagnosticsOpen: false,
      selectedId: null,
      openCategoryIds: new Set(defaultCategory === null ? [] : [defaultCategory]),
      rovingId: defaultRovingId,
      jumpTarget: defaultJumpTarget === null ? null : { ...defaultJumpTarget },
      focusIdentity: null,
      boardPosition: { left: 0, top: 0 },
      subscribers: new Set(),
      snapshot: null
    };
    internal.snapshot = createPresentationSnapshot(internal);
    INTERNALS.set(this, internal);
  }

  setQuery(query) {
    if (typeof query !== "string") throw new TypeError("Research query must be a string.");
    const internal = INTERNALS.get(this);
    if (internal.query === query) return false;
    internal.query = query;
    return notify(this, "setQuery");
  }

  setShowInternal(showInternal) {
    if (typeof showInternal !== "boolean") {
      throw new TypeError("Research internal-record visibility must be a boolean.");
    }
    const internal = INTERNALS.get(this);
    if (internal.showInternal === showInternal) return false;
    internal.showInternal = showInternal;
    if (showInternal && internal.rovingId === null) {
      internal.rovingId = internal.firstRovingId;
      if (internal.openCategoryIds.size === 0 && internal.firstCategoryId !== null) {
        internal.openCategoryIds.add(internal.firstCategoryId);
      }
    } else if (!showInternal) {
      if (internal.internalIds.has(internal.selectedId)) internal.selectedId = null;
      if (internal.internalIds.has(internal.rovingId)) internal.rovingId = internal.defaultRovingId;
      if (
        RECORD_FOCUS_SURFACES.has(internal.focusIdentity?.surface) &&
        internal.internalIds.has(internal.focusIdentity?.id)
      ) {
        internal.focusIdentity = null;
      }
    }
    normalizeJumpTarget(internal);
    return notify(this, "setShowInternal");
  }

  setDiagnosticsOpen(open) {
    if (typeof open !== "boolean") {
      throw new TypeError("Research diagnostics disclosure state must be boolean.");
    }
    const internal = INTERNALS.get(this);
    if (internal.diagnosticsOpen === open) return false;
    internal.diagnosticsOpen = open;
    return notify(this, "setDiagnosticsOpen");
  }

  setSelectedId(id) {
    const internal = INTERNALS.get(this);
    const normalized = requireExactChoice(internal, id, "selection", { visible: true });
    if (internal.selectedId === normalized) return false;
    internal.selectedId = normalized;
    return notify(this, "setSelectedId");
  }

  clearSelection() {
    return this.setSelectedId(null);
  }

  setCategoryOpen(category, open) {
    if (typeof category !== "string" || !INTERNALS.get(this).categoryIds.has(category)) {
      throw new TypeError(`Unknown Research category '${String(category)}'.`);
    }
    if (typeof open !== "boolean") throw new TypeError("Research category state must be boolean.");
    const internal = INTERNALS.get(this);
    if (internal.openCategoryIds.has(category) === open) return false;
    if (open) internal.openCategoryIds.add(category);
    else internal.openCategoryIds.delete(category);
    return notify(this, "setCategoryOpen");
  }

  setRovingId(id) {
    const internal = INTERNALS.get(this);
    const normalized = requireExactChoice(internal, id, "roving focus", { visible: true });
    if (internal.rovingId === normalized) return false;
    internal.rovingId = normalized;
    return notify(this, "setRovingId");
  }

  setJumpTarget(category, levelKey) {
    const internal = INTERNALS.get(this);
    if (typeof category !== "string" || !internal.categoryIds.has(category)) {
      throw new TypeError(`Unknown Research jump category '${String(category)}'.`);
    }
    if (typeof levelKey !== "string" || !internal.levelKeys.has(levelKey)) {
      throw new TypeError(`Unknown Research jump level '${String(levelKey)}'.`);
    }
    const target = { category, levelKey };
    if (jumpCellNodeIds(internal, target).length === 0) {
      throw new TypeError(
        `Research jump target '${category}' / '${levelKey}' is not a populated visible board section.`
      );
    }
    if (internal.jumpTarget?.category === category && internal.jumpTarget?.levelKey === levelKey) {
      return false;
    }
    internal.jumpTarget = target;
    return notify(this, "setJumpTarget");
  }

  getJumpTargetNodeId() {
    const internal = INTERNALS.get(this);
    const nodeIds = jumpCellNodeIds(internal, internal.jumpTarget);
    return nodeIds.includes(internal.rovingId) ? internal.rovingId : (nodeIds[0] ?? null);
  }

  setFocusIdentity(surface, id = null) {
    if (surface === null) {
      const internal = INTERNALS.get(this);
      if (internal.focusIdentity === null) return false;
      internal.focusIdentity = null;
      return notify(this, "setFocusIdentity");
    }
    if (!FOCUS_SURFACES.has(surface)) {
      throw new TypeError(`Unknown Research focus surface '${String(surface)}'.`);
    }
    const internal = INTERNALS.get(this);
    let normalizedId;
    if (IDLESS_FOCUS_SURFACES.has(surface)) {
      if (id !== null) throw new TypeError(`Research focus surface '${surface}' has no record ID.`);
      normalizedId = null;
    } else if (surface === "catalog-category") {
      if (typeof id !== "string" || !internal.categoryIds.has(id)) {
        throw new TypeError(`Unknown Research focus category '${String(id)}'.`);
      }
      normalizedId = id;
    } else {
      normalizedId = requireExactChoice(internal, id, "focus", { visible: true });
    }
    if (
      internal.focusIdentity?.surface === surface &&
      internal.focusIdentity?.id === normalizedId
    ) {
      return false;
    }
    internal.focusIdentity = { surface, id: normalizedId };
    return notify(this, "setFocusIdentity");
  }

  setBoardPosition(left, top) {
    if (!Number.isFinite(left) || left < 0 || !Number.isFinite(top) || top < 0) {
      throw new TypeError("Research board position must use nonnegative finite coordinates.");
    }
    const internal = INTERNALS.get(this);
    if (internal.boardPosition.left === left && internal.boardPosition.top === top) return false;
    internal.boardPosition = { left, top };
    return notify(this, "setBoardPosition");
  }

  restoreDefaults() {
    const internal = INTERNALS.get(this);
    const unchanged =
      internal.query === "" &&
      internal.showInternal === false &&
      internal.diagnosticsOpen === false &&
      internal.selectedId === null &&
      internal.rovingId === internal.defaultRovingId &&
      internal.jumpTarget?.category === internal.defaultJumpTarget?.category &&
      internal.jumpTarget?.levelKey === internal.defaultJumpTarget?.levelKey &&
      internal.focusIdentity === null &&
      internal.boardPosition.left === 0 &&
      internal.boardPosition.top === 0 &&
      internal.openCategoryIds.size === internal.defaultOpenCategoryIds.size &&
      [...internal.defaultOpenCategoryIds].every((id) => internal.openCategoryIds.has(id));
    if (unchanged) return false;
    internal.query = "";
    internal.showInternal = false;
    internal.diagnosticsOpen = false;
    internal.selectedId = null;
    internal.rovingId = internal.defaultRovingId;
    internal.jumpTarget =
      internal.defaultJumpTarget === null ? null : { ...internal.defaultJumpTarget };
    internal.focusIdentity = null;
    internal.boardPosition = { left: 0, top: 0 };
    internal.openCategoryIds = new Set(internal.defaultOpenCategoryIds);
    return notify(this, "restoreDefaults");
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") throw new TypeError("Subscriber must be a function.");
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}

export const RESEARCH_UNCLASSIFIED_LEVEL_KEY = UNCLASSIFIED_LEVEL_KEY;
