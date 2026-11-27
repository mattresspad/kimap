import { cloneData, deepFreeze, stableObject } from "../scenario/utils.js";

export const DISCOVERY_ENTITY_TYPES = Object.freeze([
  "character",
  "squad",
  "faction",
  "nest",
  "item",
  "weapon",
  "crossbow",
  "armour",
  "mapItem",
  "nestItem"
]);

export const DISCOVERY_ITEM_TYPES = Object.freeze([
  "item",
  "weapon",
  "crossbow",
  "armour",
  "mapItem",
  "nestItem"
]);

const INTERNALS = new WeakMap();
const RELEVANT_UNRESOLVED_CATEGORY =
  /^(faction|bounty factions?|trade culture|illegal goods|forbidden items|leader|squad|squad2|secondary squad|animals?2?|housemates?|slaves?|prisoners?|choose\s*from(?: list)?|choosefrom(?: list)?|random(?: choice| members?)?|residents|bar squads|default resident|roaming squads|homeless spawns|nests|debris|items?|inventory|special items?|vendor(?: list)?s?)$/i;
const PLACEMENT_CATEGORY =
  /^(leader|squad|squad2|secondary squad|animals?2?|housemates?|slaves?|prisoners?|choose\s*from(?: list)?|choosefrom(?: list)?|random(?: choice| members?)?|residents|bar squads|default resident|roaming squads|homeless spawns|nests|debris|items?|inventory|special items?|vendor(?: list)?s?)$/i;

function recordId(record) {
  return typeof record?.StringId === "string" && record.StringId.trim() !== ""
    ? record.StringId
    : null;
}

function recordName(record, fallback) {
  return typeof record?.Name === "string" && record.Name.trim() !== "" ? record.Name : fallback;
}

function townType(record) {
  const value = record?.Values?.type ?? record?.Type ?? record?.type;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function rawEntries(datasets) {
  const definitions = [
    ["character", "Character", datasets.characters],
    ["character", "Animal", datasets.animals],
    ["squad", "Squad", datasets.squads],
    ["faction", "Faction", datasets.factions],
    ["item", "Item", datasets.items],
    ["weapon", "Weapon", datasets.weapons],
    ["crossbow", "Crossbow", datasets.crossbows],
    ["armour", "Armour", datasets.armours],
    ["mapItem", "Map Item", datasets.mapItems],
    ["nestItem", "Nest Item", datasets.nestItems]
  ];
  const entries = [];
  for (const [entityType, subtype, records] of definitions) {
    for (const [position, record] of (Array.isArray(records) ? records : []).entries()) {
      entries.push({ entityType, subtype, record, position, source: subtype });
    }
  }
  for (const [position, record] of (datasets.townFcsData ?? []).entries()) {
    if (townType(record) === 0) {
      entries.push({ entityType: "nest", subtype: "Nest", record, position, source: "Town" });
    }
  }
  return entries;
}

function diagnostic(code, message, context = {}) {
  return { level: "warning", code, message, context };
}

function entityKey(entityType, entityId) {
  return `${entityType}:${entityId}`;
}

function referenceEntries(record) {
  const categories = record?.ReferenceCategories;
  if (!categories || typeof categories !== "object" || Array.isArray(categories)) return [];
  return Object.entries(categories)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([category, references]) =>
      (Array.isArray(references) ? references : []).map((reference, position) => ({
        category,
        position,
        targetId: recordId(reference),
        targetName: recordName(reference, recordId(reference) ?? "Unknown"),
        value0: reference?.Value0 ?? null,
        value1: reference?.Value1 ?? null,
        value2: reference?.Value2 ?? null
      }))
    );
}

function detectCycles(forwardByKey, diagnostics) {
  const visiting = new Set();
  const visited = new Set();
  const emitted = new Set();
  const limit = Math.max(64, forwardByKey.size * 2);

  function visit(key, path) {
    if (path.length > limit) {
      diagnostics.push(
        diagnostic(
          "discovery_graph_depth_limit",
          `Discovery traversal from '${path[0]}' reached its safety limit.`,
          {
            root: path[0],
            limit
          }
        )
      );
      return;
    }
    if (visiting.has(key)) {
      const start = path.indexOf(key);
      const cycle = [...path.slice(Math.max(0, start)), key];
      const signature = cycle.join(" -> ");
      if (!emitted.has(signature)) {
        emitted.add(signature);
        diagnostics.push(
          diagnostic(
            "discovery_graph_cycle",
            `Discovery relationship graph contains a bounded cycle: ${signature}.`,
            {
              cycle
            }
          )
        );
      }
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const edge of forwardByKey.get(key) ?? []) {
      if (edge.targetKey && PLACEMENT_CATEGORY.test(edge.category)) {
        visit(edge.targetKey, [...path, key]);
      }
    }
    visiting.delete(key);
    visited.add(key);
  }

  for (const key of [...forwardByKey.keys()].sort()) visit(key, []);
}

/** Builds exact-ID discovery joins without owning scenario or presentation state. */
export function createDiscoveryCatalog({ datasets, baseline = null } = {}) {
  if (!datasets || typeof datasets !== "object" || Array.isArray(datasets)) {
    throw new TypeError("Discovery catalog requires a datasets object.");
  }

  const diagnostics = [];
  const candidates = rawEntries(datasets);
  const grouped = new Map();
  for (const candidate of candidates) {
    const id = recordId(candidate.record);
    if (!id) {
      diagnostics.push(
        diagnostic("discovery_missing_identity", `${candidate.subtype} record has no stable ID.`, {
          source: candidate.source,
          position: candidate.position
        })
      );
      continue;
    }
    const key = entityKey(candidate.entityType, id);
    (grouped.get(key) ?? grouped.set(key, []).get(key)).push({ ...candidate, id, key });
  }

  const entities = [];
  for (const [key, matches] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    const ordered = matches.sort(
      (left, right) =>
        left.subtype.localeCompare(right.subtype) ||
        recordName(left.record, left.id).localeCompare(recordName(right.record, right.id)) ||
        left.position - right.position
    );
    const selected = ordered[0];
    if (ordered.length > 1) {
      diagnostics.push(
        diagnostic(
          "discovery_duplicate_identity",
          `Multiple records share discovery identity '${key}'.`,
          {
            entityType: selected.entityType,
            entityId: selected.id,
            subtypes: ordered.map(({ subtype }) => subtype)
          }
        )
      );
    }
    entities.push({
      key,
      entityType: selected.entityType,
      entityId: selected.id,
      subtype: selected.subtype,
      name: recordName(selected.record, selected.id),
      raw: cloneData(selected.record),
      sourcePosition: selected.position
    });
  }

  const byKey = new Map(entities.map((entity) => [entity.key, entity]));
  const kindsById = new Map();
  for (const entity of entities) {
    const kinds = kindsById.get(entity.entityId) ?? [];
    kinds.push(entity.entityType);
    kindsById.set(entity.entityId, kinds);
  }
  for (const [id, kinds] of kindsById) {
    const uniqueKinds = [...new Set(kinds)].sort();
    kindsById.set(id, uniqueKinds);
    if (uniqueKinds.length > 1) {
      diagnostics.push(
        diagnostic(
          "discovery_ambiguous_record_kind",
          `Stable ID '${id}' resolves to multiple discovery kinds.`,
          {
            entityId: id,
            entityTypes: uniqueKinds
          }
        )
      );
    }
  }

  const townById = new Map(
    (datasets.townFcsData ?? [])
      .map((record) => [recordId(record), cloneData(record)])
      .filter(([id]) => id)
  );
  const spawnAreaById = new Map(
    (datasets.spawnAreas ?? [])
      .map((record) => [recordId(record), cloneData(record)])
      .filter(([id]) => id)
  );
  const vendorById = new Map(
    (datasets.vendorLists ?? [])
      .map((record) => [recordId(record), cloneData(record)])
      .filter(([id]) => id)
  );
  const tradeCultureById = new Map(
    (datasets.tradeCultures ?? [])
      .map((record) => [recordId(record), cloneData(record)])
      .filter(([id]) => id)
  );
  const sourceNodes = [
    ...entities.map((entity) => ({
      key: entity.key,
      kind: entity.entityType,
      id: entity.entityId,
      raw: entity.raw
    })),
    ...[...vendorById].map(([id, raw]) => ({
      key: `vendorList:${id}`,
      kind: "vendorList",
      id,
      raw
    })),
    ...[...tradeCultureById].map(([id, raw]) => ({
      key: `tradeCulture:${id}`,
      kind: "tradeCulture",
      id,
      raw
    })),
    ...[...townById]
      .filter(([, raw]) => townType(raw) !== 0)
      .map(([id, raw]) => ({ key: `town:${id}`, kind: "town", id, raw })),
    ...[...spawnAreaById].map(([id, raw]) => ({
      key: `spawnArea:${id}`,
      kind: "spawnArea",
      id,
      raw
    }))
  ];
  const resolvers = new Map();
  for (const entity of entities) {
    (
      resolvers.get(entity.entityId) ?? resolvers.set(entity.entityId, []).get(entity.entityId)
    ).push({
      key: entity.key,
      kind: entity.entityType
    });
  }
  for (const [id] of vendorById) {
    (resolvers.get(id) ?? resolvers.set(id, []).get(id)).push({
      key: `vendorList:${id}`,
      kind: "vendorList"
    });
  }
  for (const [id] of tradeCultureById) {
    (resolvers.get(id) ?? resolvers.set(id, []).get(id)).push({
      key: `tradeCulture:${id}`,
      kind: "tradeCulture"
    });
  }
  for (const [id, raw] of townById) {
    if (townType(raw) === 0) continue;
    (resolvers.get(id) ?? resolvers.set(id, []).get(id)).push({ key: `town:${id}`, kind: "town" });
  }
  for (const [id] of spawnAreaById) {
    (resolvers.get(id) ?? resolvers.set(id, []).get(id)).push({
      key: `spawnArea:${id}`,
      kind: "spawnArea"
    });
  }

  const edges = [];
  for (const source of sourceNodes.sort((left, right) => left.key.localeCompare(right.key))) {
    for (const reference of referenceEntries(source.raw)) {
      if (!reference.targetId) continue;
      const matches = resolvers.get(reference.targetId) ?? [];
      if (matches.length === 0) {
        if (!RELEVANT_UNRESOLVED_CATEGORY.test(reference.category)) continue;
        diagnostics.push(
          diagnostic(
            "discovery_unresolved_reference",
            `Reference '${source.key}' -> '${reference.targetId}' could not be resolved.`,
            {
              sourceKey: source.key,
              category: reference.category,
              position: reference.position,
              targetId: reference.targetId
            }
          )
        );
        edges.push({
          ...reference,
          sourceKey: source.key,
          sourceKind: source.kind,
          targetKey: null,
          targetKind: null,
          resolution: "unresolved"
        });
        continue;
      }
      if (matches.length > 1) {
        diagnostics.push(
          diagnostic(
            "discovery_ambiguous_reference",
            `Reference '${source.key}' -> '${reference.targetId}' has multiple exact-ID targets.`,
            {
              sourceKey: source.key,
              category: reference.category,
              position: reference.position,
              targetId: reference.targetId,
              targetKinds: matches.map(({ kind }) => kind).sort()
            }
          )
        );
        edges.push({
          ...reference,
          sourceKey: source.key,
          sourceKind: source.kind,
          targetKey: null,
          targetKind: null,
          resolution: "ambiguous"
        });
        continue;
      }
      edges.push({
        ...reference,
        sourceKey: source.key,
        sourceKind: source.kind,
        targetKey: matches[0].key,
        targetKind: matches[0].kind,
        resolution: "resolved"
      });
    }
  }
  edges.sort(
    (left, right) =>
      left.sourceKey.localeCompare(right.sourceKey) ||
      left.category.localeCompare(right.category) ||
      left.position - right.position ||
      String(left.targetId).localeCompare(String(right.targetId))
  );
  const forwardByKey = new Map();
  const reverseByKey = new Map();
  for (const edge of edges) {
    (
      forwardByKey.get(edge.sourceKey) ?? forwardByKey.set(edge.sourceKey, []).get(edge.sourceKey)
    ).push(edge);
    if (edge.targetKey) {
      (
        reverseByKey.get(edge.targetKey) ?? reverseByKey.set(edge.targetKey, []).get(edge.targetKey)
      ).push(edge);
    }
  }
  detectCycles(forwardByKey, diagnostics);

  const mapOccurrences = (datasets.mapData ?? [])
    .filter((record) => typeof record?.TargetId === "string" && record.TargetId !== "")
    .map((record, position) => ({
      occurrenceId:
        typeof record.InstanceId === "string" ? record.InstanceId : `map:${String(position)}`,
      targetId: record.TargetId,
      name: recordName(record, record.TargetId),
      x: Number.isFinite(Number(record.X)) ? Number(record.X) : null,
      z: Number.isFinite(Number(record.Z)) ? Number(record.Z) : null,
      position
    }))
    .sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId));
  const mapByTargetId = new Map();
  for (const occurrence of mapOccurrences) {
    (
      mapByTargetId.get(occurrence.targetId) ??
      mapByTargetId.set(occurrence.targetId, []).get(occurrence.targetId)
    ).push(occurrence);
  }

  const publicEntities = entities
    .map(({ raw, ...entity }) => ({ ...entity, authored: raw }))
    .sort(
      (left, right) =>
        left.entityType.localeCompare(right.entityType) ||
        left.name.localeCompare(right.name) ||
        left.entityId.localeCompare(right.entityId)
    );
  const publicCatalog = deepFreeze({
    schemaVersion: 1,
    manifestId: baseline?.manifestId ?? baseline?.manifest?.id ?? null,
    entities: publicEntities,
    byType: stableObject(
      DISCOVERY_ENTITY_TYPES.map((type) => [
        type,
        stableObject(
          publicEntities
            .filter(({ entityType }) => entityType === type)
            .map((entity) => [entity.entityId, entity])
        )
      ])
    ),
    edges: cloneData(edges),
    mapOccurrences: cloneData(mapOccurrences),
    diagnostics: diagnostics.sort(
      (left, right) =>
        left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
    )
  });
  INTERNALS.set(publicCatalog, {
    baseline,
    byKey,
    kindsById,
    townById,
    spawnAreaById,
    vendorById,
    tradeCultureById,
    forwardByKey,
    reverseByKey,
    mapByTargetId
  });
  return publicCatalog;
}

export function getDiscoveryCatalogInternals(catalog) {
  const internals = INTERNALS.get(catalog);
  if (!internals)
    throw new TypeError("A discovery catalog created by createDiscoveryCatalog is required.");
  return internals;
}

export function hasDiscoveryTarget(catalog, target) {
  return Boolean(catalog?.byType?.[target?.entityType]?.[target?.entityId]);
}
