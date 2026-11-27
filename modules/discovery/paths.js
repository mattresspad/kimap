const ITEM_KINDS = new Set(["item", "weapon", "crossbow", "armour", "mapItem", "nestItem"]);

const TOWN_SQUAD_CATEGORIES = new Set([
  "residents",
  "bar squads",
  "default resident",
  "roaming squads"
]);
const NEST_SQUAD_CATEGORIES = new Set(["residents", "roaming squads"]);
const SPAWN_CATEGORIES = new Map([
  ["homeless spawns", "squad"],
  ["nests", "nest"]
]);
const SQUAD_CHARACTER_CATEGORIES = new Set([
  "leader",
  "squad",
  "squad2",
  "secondary squad",
  "choosefrom list",
  "choose from list",
  "choosefrom",
  "choose from",
  "random",
  "random choice",
  "random members"
]);
const SQUAD_SQUAD_CATEGORIES = new Set([
  "housemates",
  "housemate",
  "slaves",
  "slave",
  "prisoners",
  "prisoner",
  "choosefrom list",
  "choose from list",
  "choosefrom",
  "choose from"
]);
const ANIMAL_CATEGORIES = new Set(["animal", "animals", "animal2", "animals2"]);
const ITEM_CATEGORIES = new Set(["item", "items", "inventory", "special item", "special items"]);
const VENDOR_CATEGORIES = new Set(["vendor", "vendors", "vendor list", "vendor lists"]);

export function normalizeDiscoveryCategory(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ");
}

export function hasPositiveStructuralCapacity(edge) {
  return [edge?.value0, edge?.value1].some((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  });
}

/** Exact, type-aware paths that may carry geographic appearance evidence. */
export function canTraverseDiscoveryPlacement(edge) {
  if (!edge?.targetKey || edge.resolution !== "resolved") return false;
  const category = normalizeDiscoveryCategory(edge.category);

  if (edge.sourceKind === "spawnArea") {
    return SPAWN_CATEGORIES.get(category) === edge.targetKind;
  }
  if (edge.sourceKind === "town" && edge.targetKind === "squad") {
    return TOWN_SQUAD_CATEGORIES.has(category);
  }
  if (edge.sourceKind === "nest") {
    if (edge.targetKind === "squad") return NEST_SQUAD_CATEGORIES.has(category);
    if (edge.targetKind === "nestItem") {
      return category === "debris" && hasPositiveStructuralCapacity(edge);
    }
  }
  if (edge.sourceKind === "squad") {
    if (edge.targetKind === "character") {
      if (ANIMAL_CATEGORIES.has(category)) return hasPositiveStructuralCapacity(edge);
      return SQUAD_CHARACTER_CATEGORIES.has(category) && hasPositiveStructuralCapacity(edge);
    }
    if (edge.targetKind === "squad") return SQUAD_SQUAD_CATEGORIES.has(category);
    if (edge.targetKind === "nest") return category === "nest";
  }
  if (ITEM_KINDS.has(edge.targetKind)) return ITEM_CATEGORIES.has(category);
  if (edge.targetKind === "vendorList") return VENDOR_CATEGORIES.has(category);
  if (edge.sourceKind === "vendorList" && ITEM_KINDS.has(edge.targetKind)) {
    return ITEM_CATEGORIES.has(category) || VENDOR_CATEGORIES.has(category);
  }
  return false;
}

export function findDiscoveryPlacementPaths(internals, rootKey) {
  const queue = [{ key: rootKey, path: [rootKey] }];
  const visited = new Set();
  const paths = new Map();
  const limit = Math.max(64, internals.forwardByKey.size * 2);
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current.key) || current.path.length > limit) continue;
    visited.add(current.key);
    paths.set(current.key, current.path);
    const adjacent = (internals.forwardByKey.get(current.key) ?? [])
      .filter(canTraverseDiscoveryPlacement)
      .map((edge) => edge.targetKey)
      .filter(Boolean)
      .sort();
    for (const next of adjacent) {
      if (!visited.has(next)) queue.push({ key: next, path: [...current.path, next] });
    }
  }
  return paths;
}

export const DISCOVERY_CONTEXT_PATHS = Object.freeze({
  townToSquad: Object.freeze([...TOWN_SQUAD_CATEGORIES]),
  nestToSquad: Object.freeze([...NEST_SQUAD_CATEGORIES]),
  squadToSquad: Object.freeze([...SQUAD_SQUAD_CATEGORIES]),
  squadToAnimal: Object.freeze([...ANIMAL_CATEGORIES]),
  nestToItem: Object.freeze(["debris"])
});
