import { cloneData, deepFreeze } from "../scenario/utils.js";
import { getDiscoveryCatalogInternals, hasDiscoveryTarget } from "./catalog.js";
import { findDiscoveryPlacementPaths } from "./paths.js";
import { isGeographicArea } from "../selection/geographic-area-policy.js";

const CURRENT_SPAWN_STATUSES = new Set(["Default", "Active"]);
const CONDITIONAL_SPAWN_STATUSES = new Set(["Potential", "Distant"]);
const SCENARIO_APPEARANCE_CACHE = new WeakMap();
const STATIC_APPEARANCE_CACHE = new WeakMap();

function targetKey(target) {
  return `${target.entityType}:${target.entityId}`;
}

function titleForKey(catalog, key) {
  const [entityType, ...idParts] = key.split(":");
  const entityId = idParts.join(":");
  const entity = catalog.byType?.[entityType]?.[entityId];
  return entity?.name ?? entityId;
}

function titleForResolvedKey(catalog, internals, key, kind, entityId) {
  const discovered = catalog.byType?.[kind]?.[entityId];
  if (discovered) return discovered.name;
  const record =
    kind === "vendorList"
      ? internals.vendorById.get(entityId)
      : kind === "tradeCulture"
        ? internals.tradeCultureById.get(entityId)
        : kind === "town"
          ? internals.townById.get(entityId)
          : kind === "spawnArea"
            ? internals.spawnAreaById.get(entityId)
            : null;
  return record?.Name ?? (key ? titleForKey(catalog, key) : entityId);
}

function relationship(edge, catalog, internals, direction) {
  const key = direction === "outgoing" ? edge.targetKey : edge.sourceKey;
  const kind = direction === "outgoing" ? edge.targetKind : edge.sourceKind;
  const entityId = key ? key.slice(key.indexOf(":") + 1) : edge.targetId;
  return {
    direction,
    category: edge.category,
    position: edge.position,
    value0: edge.value0,
    value1: edge.value1,
    value2: edge.value2,
    resolution: edge.resolution,
    entityType: kind,
    entityId,
    name: key ? titleForResolvedKey(catalog, internals, key, kind, entityId) : edge.targetName,
    navigable: Boolean(key && catalog.byType?.[kind]?.[entityId]),
    provenanceOnly: kind === "vendorList" || kind === "tradeCulture"
  };
}

function scenarioTownStates(internals, snapshot, lenses) {
  const results = [];
  for (const [townId, occurrences] of internals.mapByTargetId) {
    const town = internals.townById.get(townId);
    if (!town) continue;
    if (Number(town?.Values?.type ?? town?.Type ?? town?.type) === 0) {
      for (const occurrence of occurrences) {
        results.push({
          rootKey: `nest:${townId}`,
          baseRootKey: `nest:${townId}`,
          state: "current",
          parentType: "town",
          parentId: townId,
          effectiveParentId: townId,
          occurrenceId: occurrence.occurrenceId,
          name: occurrence.name,
          coordinates:
            occurrence.x === null || occurrence.z === null
              ? null
              : { x: occurrence.x, z: occurrence.z },
          provenance: [townId]
        });
      }
      continue;
    }
    const authoritative = snapshot?.world?.towns?.[townId];
    const activeTownId = authoritative?.activeTownId ?? townId;
    for (const occurrence of occurrences) {
      results.push({
        rootKey: `town:${activeTownId}`,
        baseRootKey: `town:${townId}`,
        state: "current",
        parentType: "town",
        parentId: townId,
        effectiveParentId: activeTownId,
        occurrenceId: occurrence.occurrenceId,
        name: occurrence.name,
        coordinates:
          occurrence.x === null || occurrence.z === null
            ? null
            : { x: occurrence.x, z: occurrence.z },
        provenance: authoritative?.path ? [...authoritative.path] : [townId]
      });
    }
    const network = lenses?.townOverrides?.byBaseTownId?.[townId] ?? null;
    const activeIds = new Set(authoritative?.path ?? [activeTownId]);
    for (const node of network?.nodes ?? []) {
      if (node.id === activeTownId || activeIds.has(node.id)) continue;
      const incoming = (network.edges ?? []).filter(({ targetId }) => targetId === node.id);
      const permanentlyLocked =
        incoming.length > 0 && incoming.every(({ status }) => status === "locked");
      for (const occurrence of occurrences) {
        results.push({
          rootKey: `town:${node.id}`,
          baseRootKey: `town:${townId}`,
          state: permanentlyLocked ? "eliminated" : "conditional",
          parentType: "town",
          parentId: townId,
          effectiveParentId: node.id,
          occurrenceId: occurrence.occurrenceId,
          name: node.name ?? node.id,
          coordinates:
            occurrence.x === null || occurrence.z === null
              ? null
              : { x: occurrence.x, z: occurrence.z },
          provenance: [townId, node.id]
        });
      }
    }
    for (const candidateId of authoritative?.path ?? []) {
      if (candidateId !== activeTownId) {
        for (const occurrence of occurrences) {
          results.push({
            rootKey: `town:${candidateId}`,
            baseRootKey: `town:${townId}`,
            state: "eliminated",
            formerCurrent: true,
            parentType: "town",
            parentId: townId,
            effectiveParentId: candidateId,
            occurrenceId: occurrence.occurrenceId,
            name: occurrence.name,
            coordinates:
              occurrence.x === null || occurrence.z === null
                ? null
                : { x: occurrence.x, z: occurrence.z },
            provenance: [...(authoritative?.path ?? [])]
          });
        }
      }
    }
  }
  return results;
}

function scenarioSpawnStates(internals, snapshot) {
  const results = [];
  for (const [areaId, area] of internals.spawnAreaById) {
    if (!isGeographicArea(areaId)) continue;
    const entries = snapshot?.world?.spawns?.[areaId]?.entries;
    if (!entries) continue;
    for (const entry of Object.values(entries)) {
      let state = "unattributed";
      if (CURRENT_SPAWN_STATUSES.has(entry.status)) state = "current";
      else if (CONDITIONAL_SPAWN_STATUSES.has(entry.status)) state = "conditional";
      else if (entry.status === "Eliminated") state = "eliminated";
      const entityType = entry.type === "Nest" ? "nest" : "squad";
      results.push({
        rootKey: `${entityType}:${entry.entityId}`,
        state,
        parentType: "spawnArea",
        parentId: areaId,
        effectiveParentId: areaId,
        occurrenceId: entry.occurrenceId,
        name: area?.Name ?? areaId,
        coordinates: null,
        authoredStatus: entry.status,
        provenance: [areaId, entry.entityId]
      });
    }
  }
  return results;
}

function staticRoots(internals) {
  const roots = [];
  for (const [townId, occurrences] of internals.mapByTargetId) {
    const type = Number(
      internals.townById.get(townId)?.Values?.type ??
        internals.townById.get(townId)?.Type ??
        internals.townById.get(townId)?.type
    );
    for (const occurrence of occurrences) {
      roots.push({
        rootKey: `${type === 0 ? "nest" : "town"}:${townId}`,
        state: "unavailable",
        parentType: "town",
        parentId: townId,
        effectiveParentId: townId,
        occurrenceId: occurrence.occurrenceId,
        name: occurrence.name,
        coordinates:
          occurrence.x === null || occurrence.z === null
            ? null
            : { x: occurrence.x, z: occurrence.z },
        provenance: [townId]
      });
    }
  }
  for (const [areaId, area] of internals.spawnAreaById) {
    if (!isGeographicArea(areaId)) continue;
    for (const edge of internals.forwardByKey.get(`spawnArea:${areaId}`) ?? []) {
      if (edge.targetKind !== "squad" && edge.targetKind !== "nest") continue;
      roots.push({
        rootKey: edge.targetKey,
        state: "unavailable",
        parentType: "spawnArea",
        parentId: areaId,
        effectiveParentId: areaId,
        occurrenceId: `${areaId}:${edge.targetKind}:${edge.targetId}:${String(edge.position)}`,
        name: area?.Name ?? areaId,
        coordinates: null,
        authoredStatus: "Unavailable",
        provenance: [areaId, edge.targetId]
      });
    }
  }
  return roots;
}

/**
 * Returns the immutable geographic roots used by discovery projection without traversing them.
 * Context subjects that need exhaustive provenance can perform their own bounded typed walk while
 * sharing the same scenario and reference-only root semantics as ordinary discovery.
 */
export function createDiscoveryAppearanceRoots({ catalog, snapshot = null, lenses = null } = {}) {
  if (!catalog) throw new TypeError("A discovery catalog is required.");
  const internals = getDiscoveryCatalogInternals(catalog);
  const roots =
    snapshot && lenses
      ? [
          ...scenarioTownStates(internals, snapshot, lenses),
          ...scenarioSpawnStates(internals, snapshot)
        ]
      : staticRoots(internals);
  return deepFreeze(
    roots
      .map((root) => cloneData(root))
      .sort(
        (left, right) =>
          String(left.parentType).localeCompare(String(right.parentType)) ||
          String(left.parentId).localeCompare(String(right.parentId)) ||
          String(left.occurrenceId).localeCompare(String(right.occurrenceId)) ||
          String(left.state).localeCompare(String(right.state)) ||
          String(left.rootKey).localeCompare(String(right.rootKey))
      )
  );
}

function createAppearanceIndex(catalog, snapshot, lenses) {
  const internals = getDiscoveryCatalogInternals(catalog);
  const roots = createDiscoveryAppearanceRoots({ catalog, snapshot, lenses });
  const byTargetKey = new Map();
  const factionSignatures = new Set();
  for (const root of roots) {
    for (const [key, path] of findDiscoveryPlacementPaths(internals, root.rootKey)) {
      const values = byTargetKey.get(key) ?? [];
      values.push({ ...root, path });
      byTargetKey.set(key, values);
      for (const factionEdge of (internals.forwardByKey.get(key) ?? []).filter(
        (edge) => edge.category.toLowerCase() === "faction" && edge.targetKind === "faction"
      )) {
        const signature = `${factionEdge.targetKey}:${root.state}:${root.parentType}:${root.parentId}:${root.occurrenceId}`;
        if (factionSignatures.has(signature)) continue;
        factionSignatures.add(signature);
        const factionValues = byTargetKey.get(factionEdge.targetKey) ?? [];
        factionValues.push({ ...root, path: [...path, factionEdge.targetKey] });
        byTargetKey.set(factionEdge.targetKey, factionValues);
      }
    }
  }
  return byTargetKey;
}

function getAppearanceIndex(catalog, snapshot, lenses) {
  if (!snapshot || !lenses) {
    let index = STATIC_APPEARANCE_CACHE.get(catalog);
    if (!index) {
      index = createAppearanceIndex(catalog, null, lenses);
      STATIC_APPEARANCE_CACHE.set(catalog, index);
    }
    return index;
  }
  let bySnapshot = SCENARIO_APPEARANCE_CACHE.get(catalog);
  if (!bySnapshot) {
    bySnapshot = new WeakMap();
    SCENARIO_APPEARANCE_CACHE.set(catalog, bySnapshot);
  }
  let index = bySnapshot.get(snapshot);
  if (!index) {
    index = createAppearanceIndex(catalog, snapshot, lenses);
    bySnapshot.set(snapshot, index);
  }
  return index;
}

function appearancesFor(catalog, target, snapshot, lenses) {
  const internals = getDiscoveryCatalogInternals(catalog);
  const key = targetKey(target);
  const appearances = (getAppearanceIndex(catalog, snapshot, lenses).get(key) ?? []).map(
    (appearance) => ({ ...appearance, path: [...appearance.path] })
  );
  const direct = [
    ...(internals.forwardByKey.get(key) ?? []),
    ...(internals.reverseByKey.get(key) ?? [])
  ];
  if (appearances.length === 0 && direct.length > 0) {
    appearances.push({
      state: direct.some(({ resolution }) => resolution !== "resolved")
        ? "unattributed"
        : "unmapped",
      parentType: null,
      parentId: null,
      effectiveParentId: null,
      occurrenceId: null,
      name: "No mapped parent",
      coordinates: null,
      provenance: direct
        .map(
          ({ sourceKey, targetKey: edgeTarget }) => `${sourceKey}->${edgeTarget ?? "unresolved"}`
        )
        .sort(),
      path: []
    });
  }
  const entity = catalog.byType[target.entityType][target.entityId];
  const characterStatus =
    target.entityType === "character" ? (snapshot?.characters?.[target.entityId] ?? null) : null;
  if (
    target.entityType === "character" &&
    characterStatus !== 0 &&
    appearances.some(({ state, formerCurrent }) => state === "eliminated" && formerCurrent) &&
    !appearances.some(({ state }) => state === "current" || state === "conditional")
  ) {
    for (const appearance of appearances) {
      if (appearance.state === "eliminated" && appearance.formerCurrent) {
        appearance.state = "disappeared";
      }
    }
  }
  return { appearances, characterStatus, entity };
}

function bountyFacts(entity) {
  const values = entity.authored?.Values ?? {};
  return {
    amount: values["bounty amount"] ?? values.bounty ?? 0,
    chance: values["bounty chance"] ?? 0,
    fuzz: values["bounty amount fuzz"] ?? 0
  };
}

/** Projects one curated reference record from immutable exact-ID joins. */
export function projectDiscoveryEntity({ catalog, snapshot = null, lenses = null, target } = {}) {
  if (!hasDiscoveryTarget(catalog, target)) {
    return deepFreeze({
      available: false,
      reason: "unknown-reference-target",
      target: cloneData(target ?? null)
    });
  }
  const internals = getDiscoveryCatalogInternals(catalog);
  const key = targetKey(target);
  const entity = catalog.byType[target.entityType][target.entityId];
  const scenarioAvailable = Boolean(snapshot && lenses);
  const outgoing = (internals.forwardByKey.get(key) ?? []).map((edge) =>
    relationship(edge, catalog, internals, "outgoing")
  );
  const incoming = (internals.reverseByKey.get(key) ?? []).map((edge) =>
    relationship(edge, catalog, internals, "incoming")
  );
  const { appearances, characterStatus } = appearancesFor(catalog, target, snapshot, lenses);
  const relation =
    target.entityType === "faction"
      ? (lenses?.relations?.byFactionId?.[target.entityId] ?? null)
      : null;
  const values = entity.authored?.Values ?? {};
  return deepFreeze({
    available: true,
    target: { entityType: target.entityType, entityId: target.entityId },
    identity: { name: entity.name, subtype: entity.subtype, stableId: entity.entityId },
    scenario: {
      available: scenarioAvailable,
      characterLifeStatus: characterStatus,
      factionRelation: relation
        ? { value: relation.value, classification: relation.classification }
        : null
    },
    facts: {
      bounty: target.entityType === "character" ? bountyFacts(entity) : null,
      value: values.value ?? null,
      weight: values.weight ?? null
    },
    authoredConditions: referenceEntriesFor(entity.authored, "world state"),
    relationships: [...outgoing, ...incoming].sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.name.localeCompare(right.name) ||
        String(left.entityId).localeCompare(String(right.entityId))
    ),
    appearances: appearances.sort(
      (left, right) =>
        left.state.localeCompare(right.state) ||
        String(left.name).localeCompare(String(right.name)) ||
        String(left.occurrenceId).localeCompare(String(right.occurrenceId))
    ),
    diagnostics: catalog.diagnostics.filter(
      ({ context }) =>
        [context.entityId, context.sourceKey, context.targetId].includes(target.entityId) ||
        context.sourceKey === key
    )
  });
}

function referenceEntriesFor(record, category) {
  return (record?.ReferenceCategories?.[category] ?? []).map((reference, position) => ({
    entityId: reference?.StringId ?? null,
    name: reference?.Name ?? reference?.StringId ?? "Unknown",
    position,
    value0: reference?.Value0 ?? null,
    value1: reference?.Value1 ?? null
  }));
}
