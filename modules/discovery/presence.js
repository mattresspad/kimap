import { deepFreeze } from "../scenario/utils.js";
import { resolveFactionReference } from "../scenario/character-affiliation.js";
import { composeEffectiveTown } from "../selection/effective-town.js";
import { isGeographicArea } from "../selection/geographic-area-policy.js";
import { getDiscoveryCatalogInternals } from "./catalog.js";
import {
  canTraverseDiscoveryPlacement,
  DISCOVERY_CONTEXT_PATHS,
  normalizeDiscoveryCategory
} from "./paths.js";

const CURRENT = new Set(["Default", "Active"]);
const ROLE_LABELS = {
  residents: "Residents",
  "default resident": "Default template",
  "bar squads": "Bar squads",
  "roaming squads": "Roaming squads",
  "homeless spawns": "Homeless squads",
  nests: "Nests"
};
const ATTITUDE_ORDER = { enemy: 0, ally: 1, neutral: 2, unavailable: 3 };
const nameAndId = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export function isPresenceTownType(type) {
  return Number(type) !== 0 && Number(type) !== 8;
}

/** Shared current authored sources, not a live population or a second scenario evaluator. */
export function createPresenceProjection({ catalog, snapshot, lenses }) {
  if (!snapshot?.world || !lenses?.relations) {
    return deepFreeze({ available: false, reason: "Current presence requires scenario analysis." });
  }
  const internals = getDiscoveryCatalogInternals(catalog);
  const townById = Object.fromEntries(internals.townById);
  const factionIndex = { factionById: catalog.byType.faction };
  const walkCache = new Map();
  const relation = (id) => {
    const attitude = lenses.relations.byFactionId[id];
    return {
      id,
      name: catalog.byType.faction[id]?.name ?? id,
      classification: attitude?.classification ?? "unavailable",
      value: attitude?.value ?? null
    };
  };
  const rawFor = (kind, id) => catalog.byType[kind]?.[id]?.authored;

  function walk(kind, id) {
    const key = `${kind}:${id}`;
    if (walkCache.has(key)) return walkCache.get(key);
    const facts = [];
    const populationPaths = [];
    const warnings = new Set();
    let visits = 0;
    let traversedEdges = 0;
    function visit(currentKind, currentId, references, ancestors) {
      const currentKey = `${currentKind}:${currentId}`;
      const provenance = { kind: currentKind, id: currentId, references };
      populationPaths.push(provenance);
      if (ancestors.has(currentKey)) {
        provenance.stopped = "cycle";
        warnings.add("A linked population cycle was stopped.");
        return;
      }
      if (++visits > 512 || references.length > 64) {
        provenance.stopped = "limit";
        warnings.add("Some linked population paths exceed the reporting limit.");
        return;
      }
      const raw = rawFor(currentKind, currentId);
      if (!raw) {
        provenance.stopped = "unresolved";
        warnings.add("Some population references could not be resolved.");
        return;
      }
      const faction = resolveFactionReference(raw, factionIndex);
      provenance.attribution = faction;
      if (faction.state === "resolved") {
        facts.push({
          ...relation(faction.factionId),
          path: references.map(({ category }) => category),
          references,
          sourceId: currentId
        });
      } else {
        warnings.add("Some population faction attribution is missing or ambiguous.");
      }
      const nextAncestors = new Set([...ancestors, currentKey]);
      const supported = new Set(
        currentKind === "nest"
          ? DISCOVERY_CONTEXT_PATHS.nestToSquad
          : [...DISCOVERY_CONTEXT_PATHS.squadToSquad, "nest"]
      );
      for (const edge of internals.forwardByKey.get(currentKey) ?? []) {
        if (!supported.has(normalizeDiscoveryCategory(edge.category))) continue;
        if (++traversedEdges > 512) {
          warnings.add("Some linked population paths exceed the reporting limit.");
          break;
        }
        if (edge.resolution !== "resolved") {
          populationPaths.push({
            references: [...references, { ...edge }],
            stopped: edge.resolution
          });
          warnings.add("Some linked population references are unresolved or ambiguous.");
          continue;
        }
        if (!["squad", "nest"].includes(edge.targetKind) || !canTraverseDiscoveryPlacement(edge))
          continue;
        visit(edge.targetKind, edge.targetId, [...references, { ...edge }], nextAncestors);
      }
    }
    visit(kind, id, [], new Set());
    const result = { facts, populationPaths, warnings: [...warnings] };
    walkCache.set(key, result);
    return result;
  }

  function build({ id, name, kind, ownerRecord = null, roots, warnings = [] }) {
    const diagnostics = new Set(warnings);
    const factions = new Map();
    const groups = new Map();
    let owner = null;
    function addFaction(fact, source) {
      const row = factions.get(fact.id) ?? { ...relation(fact.id), sources: [] };
      row.sources.push(source);
      factions.set(fact.id, row);
      if (row.classification === "unavailable")
        diagnostics.add("Some faction attitudes are unavailable.");
    }
    if (ownerRecord) {
      const resolved = resolveFactionReference(ownerRecord, factionIndex);
      if (resolved.state === "resolved") {
        owner = relation(resolved.factionId);
        addFaction(owner, {
          role: "Owner",
          occurrenceId: id,
          sourceId: ownerRecord.StringId,
          path: []
        });
      } else diagnostics.add("Town ownership is missing or ambiguous.");
    }
    for (const root of roots) {
      const groupId = root.role === "default resident" ? "residents" : root.role;
      const group = groups.get(groupId) ?? {
        id: groupId,
        label: ROLE_LABELS[groupId],
        rows: new Map()
      };
      const key = `${root.kind}:${root.id}:${root.role}`;
      const entity = catalog.byType[root.kind]?.[root.id];
      const row = group.rows.get(key) ?? {
        key,
        id: root.id,
        entityType: root.kind,
        name: entity?.name ?? root.name ?? root.id,
        role: ROLE_LABELS[root.role],
        template: root.role === "default resident",
        navigable: Boolean(entity),
        occurrences: [],
        factions: [],
        sources: []
      };
      row.occurrences.push({
        id: root.occurrenceId,
        value0: root.value0 ?? null,
        value1: root.value1 ?? null,
        value2: root.value2 ?? null
      });
      const linked = walk(root.kind, root.id);
      row.populationPaths = linked.populationPaths;
      for (const warning of linked.warnings) diagnostics.add(warning);
      for (const fact of linked.facts) {
        const source = {
          role: ROLE_LABELS[root.role],
          occurrenceId: root.occurrenceId,
          sourceId: fact.sourceId,
          path: fact.path,
          references: fact.references
        };
        addFaction(fact, source);
        row.sources.push({ factionId: fact.id, ...source });
        if (!row.factions.some(({ id: factionId }) => factionId === fact.id))
          row.factions.push(relation(fact.id));
      }
      group.rows.set(key, row);
      groups.set(groupId, group);
    }
    const order =
      kind === "town"
        ? ["residents", "bar squads", "roaming squads"]
        : ["homeless spawns", "nests"];
    return deepFreeze({
      id,
      name,
      kind,
      owner,
      entryCount: roots.length,
      groups: order.map((groupId) => ({
        id: groupId,
        label: ROLE_LABELS[groupId],
        rows: [...(groups.get(groupId)?.rows.values() ?? [])].sort(nameAndId)
      })),
      factions: [...factions.values()].sort(
        (a, b) =>
          ATTITUDE_ORDER[a.classification] - ATTITUDE_ORDER[b.classification] || nameAndId(a, b)
      ),
      diagnostics: [...diagnostics]
    });
  }

  const areas = {};
  for (const [id, area] of internals.spawnAreaById) {
    if (!isGeographicArea(id)) continue;
    const entries = snapshot.world.spawns?.[id]?.entries;
    const authored = new Map();
    for (const [role, type] of [
      ["homeless spawns", "Squad"],
      ["nests", "Nest"]
    ]) {
      for (const ref of area.ReferenceCategories?.[role] ?? []) {
        const key = `${type}:${ref.StringId}`;
        const refs = authored.get(key) ?? [];
        refs.push(ref);
        authored.set(key, refs);
      }
    }
    const offsets = new Map();
    const roots = Object.values(entries ?? {}).flatMap((entry) => {
      const key = `${entry.type}:${entry.entityId}`;
      const offset = offsets.get(key) ?? 0;
      offsets.set(key, offset + 1);
      const ref = authored.get(key)?.[offset];
      return CURRENT.has(entry.status)
        ? [
            {
              id: entry.entityId,
              kind: entry.type === "Nest" ? "nest" : "squad",
              role: entry.type === "Nest" ? "nests" : "homeless spawns",
              occurrenceId: entry.occurrenceId,
              name: entry.name,
              value0: ref?.Value0,
              value1: ref?.Value1,
              value2: ref?.Value2
            }
          ]
        : [];
    });
    areas[id] = build({
      id,
      name: area.Name ?? id,
      kind: "area",
      warnings: entries ? [] : ["Current area occurrence data is unavailable."],
      roots
    });
  }
  const towns = {};
  const occurrences = {};
  for (const [baseId, mapped] of internals.mapByTargetId) {
    const state = snapshot.world.towns?.[baseId];
    const town = composeEffectiveTown(townById, baseId, state);
    if (!town || !isPresenceTownType(town.Values?.type)) continue;
    const roots = [];
    const warnings = [];
    for (const role of DISCOVERY_CONTEXT_PATHS.townToSquad) {
      const refs = town.ReferenceCategories?.[role] ?? [];
      if (!Array.isArray(refs)) {
        warnings.push(`The ${ROLE_LABELS[role]} references are malformed.`);
        continue;
      }
      refs.forEach((ref, position) => {
        if (typeof ref?.StringId !== "string" || !ref.StringId) {
          warnings.push("Some population references have no exact identity.");
          return;
        }
        roots.push({
          id: ref.StringId,
          name: ref.Name,
          kind: "squad",
          role,
          occurrenceId: `${town.StringId}:${role}:${position}`,
          value0: ref.Value0,
          value1: ref.Value1,
          value2: ref.Value2
        });
      });
    }
    const report = build({
      id: baseId,
      name: town.Name ?? baseId,
      kind: "town",
      ownerRecord: town,
      roots,
      warnings
    });
    towns[baseId] = report;
    for (const mappedTown of mapped) {
      occurrences[mappedTown.occurrenceId] = deepFreeze({
        baseTownId: baseId,
        activeTownId: town.StringId,
        instanceId: mappedTown.occurrenceId,
        report
      });
    }
  }
  return deepFreeze({ available: true, areas, towns, occurrences });
}
