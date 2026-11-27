import { deepFreeze } from "../scenario/utils.js";
import { projectDiscoveryEntity } from "./projection.js";

function countBy(values, select) {
  const counts = new Map();
  for (const value of values) {
    const key = select(value) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => String(left).localeCompare(String(right)))
  );
}

/** Creates deterministic aggregate-only discovery findings. */
export function createDiscoveryAudit({
  catalog,
  snapshot = null,
  lenses = null,
  manifest = null
} = {}) {
  if (!catalog?.entities) throw new TypeError("Discovery audit requires a discovery catalog.");
  const projections = catalog.entities.map((entity) =>
    projectDiscoveryEntity({
      catalog,
      snapshot,
      lenses,
      target: { entityType: entity.entityType, entityId: entity.entityId }
    })
  );
  const appearances = projections.flatMap((projection) => projection.appearances ?? []);
  const bountyCandidates = projections.filter(
    (projection) =>
      projection.target.entityType === "character" &&
      Number(projection.facts.bounty?.amount ?? 0) > 0
  );
  const vendorEdges = catalog.edges.filter(
    ({ sourceKind, targetKind }) => sourceKind === "vendorList" || targetKind === "vendorList"
  );
  return deepFreeze({
    schemaVersion: 1,
    available: true,
    manifest: {
      id: manifest?.id ?? catalog.manifestId ?? null,
      title: manifest?.title ?? null
    },
    entities: {
      total: catalog.entities.length,
      byType: countBy(catalog.entities, ({ entityType }) => entityType),
      characterSubtypes: countBy(
        catalog.entities.filter(({ entityType }) => entityType === "character"),
        ({ subtype }) => subtype
      ),
      nestTemplates: catalog.entities.filter(({ entityType }) => entityType === "nest").length,
      mappedNestTemplates: new Set(
        catalog.mapOccurrences
          .filter(({ targetId }) => catalog.byType.nest?.[targetId])
          .map(({ targetId }) => targetId)
      ).size
    },
    relationships: {
      total: catalog.edges.length,
      resolved: catalog.edges.filter(({ resolution }) => resolution === "resolved").length,
      unresolved: catalog.edges.filter(({ resolution }) => resolution === "unresolved").length,
      ambiguous: catalog.edges.filter(({ resolution }) => resolution === "ambiguous").length,
      vendorProvenanceEdges: vendorEdges.length,
      itemProvenanceEdges: catalog.edges.filter(({ sourceKind, targetKind }) =>
        [sourceKind, targetKind].some((kind) =>
          ["item", "weapon", "crossbow", "armour", "mapItem", "nestItem"].includes(kind)
        )
      ).length
    },
    appearances: {
      total: appearances.length,
      byState: countBy(appearances, ({ state }) => state),
      disappearedCharacterCandidates: projections.filter(
        ({ target, appearances: values }) =>
          target.entityType === "character" && values.some(({ state }) => state === "disappeared")
      ).length,
      bountyCandidates: bountyCandidates.length
    },
    diagnostics: countBy(catalog.diagnostics, ({ code }) => code)
  });
}

export function formatDiscoveryAuditSummary(audit) {
  return [
    `Discovery evidence audit: ${audit.manifest.title ?? audit.manifest.id ?? "unknown manifest"}`,
    `Entities: ${String(audit.entities.total)} (${Object.entries(audit.entities.byType)
      .map(([type, count]) => `${type} ${String(count)}`)
      .join(", ")}).`,
    `Relationships: ${String(audit.relationships.resolved)} resolved, ${String(audit.relationships.unresolved)} unresolved, ${String(audit.relationships.ambiguous)} ambiguous.`,
    `Appearances: ${
      Object.entries(audit.appearances.byState)
        .map(([state, count]) => `${state} ${String(count)}`)
        .join(", ") || "none"
    }.`,
    `Candidates: ${String(audit.appearances.bountyCandidates)} authored bounties; ${String(audit.appearances.disappearedCharacterCandidates)} disappeared-character candidates.`
  ].join("\n");
}
