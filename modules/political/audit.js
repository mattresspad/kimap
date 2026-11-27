import { deepFreeze } from "../scenario/utils.js";
import {
  POLITICAL_CONFIDENCE_RULES,
  POLITICAL_SOURCE_MIXES,
  POLITICAL_TOWN_METRICS,
  evaluatePoliticalInfluence
} from "./influence.js";

function countBy(values, select) {
  const counts = new Map();
  for (const value of values) {
    const key = select(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function factionRecord(faction) {
  return {
    id: faction.id,
    name: faction.name,
    notReal: faction.notReal,
    paletteLinked: faction.paletteIds.length > 0
  };
}

function createParticipantRecommendation(projection) {
  const townIds = new Set(
    projection.towns
      .filter(({ metrics }) => metrics?.inhabitedOccurrences?.value > 0)
      .map(({ factionId }) => factionId)
      .filter(Boolean)
  );
  const spawnIds = new Set(
    [...projection.homelessSpawns, ...projection.nests]
      .filter(({ relativeWeight }) => relativeWeight?.value > 0)
      .map(({ factionId }) => factionId)
      .filter(Boolean)
  );
  const factions = new Map(projection.factions.map((faction) => [faction.id, faction]));
  const asRecords = (ids) =>
    [...ids]
      .map((id) => factions.get(id))
      .filter(Boolean)
      .map(factionRecord)
      .sort(
        (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      );
  const realTown = new Set([...townIds].filter((id) => factions.get(id)?.notReal === false));
  const realSpawn = new Set([...spawnIds].filter((id) => factions.get(id)?.notReal === false));
  const both = new Set([...realTown].filter((id) => realSpawn.has(id)));
  const townOnly = new Set([...realTown].filter((id) => !realSpawn.has(id)));
  const currentSpawnOnly = new Set([...realSpawn].filter((id) => !realTown.has(id)));
  const notReal = new Set(
    [...new Set([...townIds, ...spawnIds])].filter((id) => factions.get(id)?.notReal === true)
  );
  const participantIds = [...new Set([...townOnly, ...currentSpawnOnly, ...both])].sort();

  return {
    participantIds,
    groups: {
      townOnly: asRecords(townOnly),
      currentSpawnOnly: asRecords(currentSpawnOnly),
      both: asRecords(both),
      manifestNotReal: asRecords(notReal)
    }
  };
}

function summarizePolicies(projection, participantIds) {
  const policies = [];
  const variantsByGeometry = new Map(
    projection.geometries.map((geometry) => [geometry.key, new Map()])
  );

  for (const townMetric of POLITICAL_TOWN_METRICS) {
    for (const sourceMix of POLITICAL_SOURCE_MIXES) {
      for (const confidenceRule of POLITICAL_CONFIDENCE_RULES) {
        const evaluated = evaluatePoliticalInfluence({
          projection,
          participantIds,
          townMetric,
          sourceMix,
          confidenceRule
        });
        policies.push({
          townMetric,
          sourceMix,
          confidenceRule,
          outcomes: countBy(evaluated.areas, ({ status }) => status)
        });
        for (const area of evaluated.areas) {
          const key = `${area.status}:${area.winnerId ?? ""}`;
          const variants = variantsByGeometry.get(area.geometryKey);
          variants.set(key, (variants.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const geometryByKey = new Map(projection.geometries.map((geometry) => [geometry.key, geometry]));
  const geometryStability = [...variantsByGeometry]
    .map(([geometryKey, variants]) => {
      const geometry = geometryByKey.get(geometryKey);
      const outcomes = [...variants]
        .map(([outcome, count]) => {
          const separator = outcome.indexOf(":");
          return {
            status: outcome.slice(0, separator),
            winnerId: outcome.slice(separator + 1) || null,
            count
          };
        })
        .sort(
          (left, right) =>
            left.status.localeCompare(right.status) ||
            String(left.winnerId ?? "").localeCompare(String(right.winnerId ?? ""))
        );
      return {
        geometryKey,
        areaIds: geometry.areaIds,
        cellCount: geometry.cellCount,
        stable: outcomes.length === 1,
        outcomes
      };
    })
    .sort((left, right) => left.geometryKey.localeCompare(right.geometryKey));

  return {
    evaluatedPolicyCount: policies.length,
    policies,
    stableGeometryCount: geometryStability.filter(({ stable }) => stable).length,
    sensitiveGeometryCount: geometryStability.filter(({ stable }) => !stable).length,
    sensitiveGeometries: geometryStability.filter(({ stable }) => !stable),
    stableGeometries: geometryStability.filter(({ stable }) => stable)
  };
}

function uniqueAreaIds(records) {
  return [...new Set(records.map(({ areaId }) => areaId).filter(Boolean))].sort();
}

/** Produces aggregate-only, deterministic audit findings from an immutable projection. */
export function createPoliticalAudit({ projection, manifest = null } = {}) {
  if (!projection?.available) {
    return deepFreeze({
      schemaVersion: 1,
      available: false,
      reason: projection?.reason ?? "political-evidence-unavailable",
      manifest: manifest
        ? { id: manifest.id ?? projection?.manifestId ?? null, title: manifest.title ?? null }
        : { id: projection?.manifestId ?? null, title: null }
    });
  }

  const recommendation = createParticipantRecommendation(projection);
  const policyStability = summarizePolicies(projection, recommendation.participantIds);
  const allCurrent = [
    ...projection.towns,
    ...projection.homelessSpawns,
    ...projection.nests,
    ...projection.unattributed
  ];
  const townRecords = allCurrent.filter(({ kind }) => kind === "town");
  const currentSpawnRecords = allCurrent.filter(({ kind }) => kind !== "town");
  const excludedTownRecords = projection.excluded.filter(({ kind }) => kind === "town");
  const loadedTownRecords = [...townRecords, ...excludedTownRecords];
  const factionEvidenceIds = new Set(
    [
      ...townRecords.filter(({ metrics }) => metrics?.inhabitedOccurrences?.value > 0),
      ...currentSpawnRecords.filter(({ relativeWeight }) => relativeWeight?.value > 0)
    ]
      .map(({ factionId }) => factionId)
      .filter(Boolean)
  );
  const paletteEligible = projection.factions.filter(({ id }) => factionEvidenceIds.has(id));

  return deepFreeze({
    schemaVersion: 1,
    available: true,
    manifest: {
      id: manifest?.id ?? projection.manifestId,
      title: manifest?.title ?? null
    },
    geography: {
      rasterGeometryCount: projection.geometries.length,
      rasterComponentCount: projection.geometries.reduce(
        (sum, { componentCount }) => sum + (componentCount ?? 0),
        0
      ),
      singleCellComponentCount: projection.geometries.reduce(
        (sum, { components = [] }) =>
          sum + components.filter(({ cellCount }) => cellCount === 1).length,
        0
      ),
      rasterCellCount: projection.geometries.reduce((sum, { cellCount }) => sum + cellCount, 0),
      eligibleGeometryCount: projection.geometries.filter(
        ({ excluded, indeterminate }) => !excluded && !indeterminate
      ).length,
      excludedGeometryCount: projection.geometries.filter(({ excluded }) => excluded).length,
      indeterminateGeometryCount: projection.geometries.filter(({ indeterminate }) => indeterminate)
        .length,
      sharedRasterColors: projection.geometries
        .filter(({ ambiguous }) => ambiguous)
        .map(({ key, areaIds, cellCount, mixedExclusion }) => ({
          colorKey: key,
          areaIds,
          cellCount,
          mixedExclusion
        }))
    },
    evidenceCoverage: {
      loadedTownOccurrences: loadedTownRecords.length,
      eligibleTownOccurrences: townRecords.length,
      scoredTownOccurrences: projection.towns.length,
      inhabitedTownOccurrences: townRecords.filter(
        ({ metrics }) => metrics?.inhabitedOccurrences?.value > 0
      ).length,
      qualifyingResidentReferences: townRecords.reduce(
        (sum, { metrics }) => sum + (metrics?.residentReferences?.value ?? 0),
        0
      ),
      authoredResidentMultiplicity: townRecords.reduce(
        (sum, { metrics }) => sum + (metrics?.residentPlacements?.value ?? 0),
        0
      ),
      loadedInhabitedTownOccurrences: loadedTownRecords.filter(
        ({ metrics }) => metrics?.inhabitedOccurrences?.value > 0
      ).length,
      loadedQualifyingResidentReferences: loadedTownRecords.reduce(
        (sum, { metrics }) => sum + (metrics?.residentReferences?.value ?? 0),
        0
      ),
      loadedAuthoredResidentMultiplicity: loadedTownRecords.reduce(
        (sum, { metrics }) => sum + (metrics?.residentPlacements?.value ?? 0),
        0
      ),
      scoredHomelessOccurrences: projection.homelessSpawns.length,
      scoredNestOccurrences: projection.nests.length,
      unattributedCurrentOccurrences: projection.unattributed.length,
      unattributedCurrentByKind: countBy(projection.unattributed, ({ kind }) => kind),
      unattributedPressureByKind: countBy(
        projection.unattributed.filter((record) =>
          record.kind === "town"
            ? record.metrics?.inhabitedOccurrences?.value > 0
            : record.relativeWeight?.value > 0
        ),
        ({ kind }) => kind
      ),
      conditionalOccurrences: projection.conditional.length,
      excludedOccurrences: projection.excluded.length,
      excludedOccurrencesByKind: countBy(projection.excluded, ({ kind }) => kind),
      currentEvidenceFactionCount: factionEvidenceIds.size,
      currentEvidenceAreaCount: uniqueAreaIds(allCurrent).length,
      exclusionReasons: countBy(projection.excluded, ({ exclusionReason }) => exclusionReason),
      conditionalStatuses: countBy(projection.conditional, ({ status }) => status)
    },
    unattributedRecords: projection.unattributed.map(
      ({ id, kind, areaId, geometryKey, factionIds }) => ({
        id,
        kind,
        areaId,
        geometryKey,
        factionIds: factionIds ?? []
      })
    ),
    participantRecommendation: recommendation,
    paletteLinkCoverage: {
      evidenceFactionCount: paletteEligible.length,
      linkedEvidenceFactionCount: paletteEligible.filter(({ paletteIds }) => paletteIds.length > 0)
        .length,
      recommendedParticipantCount: recommendation.participantIds.length,
      linkedRecommendedParticipantCount: recommendation.participantIds.filter(
        (id) => projection.factions.find((faction) => faction.id === id)?.paletteIds.length > 0
      ).length
    },
    policyStability,
    diagnosticCounts: countBy(projection.diagnostics, ({ code }) => code)
  });
}

export function formatPoliticalAuditSummary(audit) {
  if (!audit.available) {
    return `Political audit unavailable for ${audit.manifest.id ?? "unknown manifest"}: ${audit.reason}.`;
  }
  return [
    `Political evidence audit: ${audit.manifest.title ?? audit.manifest.id}`,
    `Geography: ${String(audit.geography.eligibleGeometryCount)} eligible, ${String(audit.geography.excludedGeometryCount)} excluded, ${String(audit.geography.indeterminateGeometryCount)} indeterminate.`,
    `Current channels: ${String(audit.evidenceCoverage.scoredTownOccurrences)} attributed town nodes (${String(audit.evidenceCoverage.inhabitedTownOccurrences)} inhabited across all attributions), ${String(audit.evidenceCoverage.scoredHomelessOccurrences)} homeless spawns, ${String(audit.evidenceCoverage.scoredNestOccurrences)} nests, ${String(audit.evidenceCoverage.unattributedCurrentOccurrences)} unattributed records.`,
    `Sensitivity: ${String(audit.policyStability.evaluatedPolicyCount)} policies; ${String(audit.policyStability.stableGeometryCount)} stable and ${String(audit.policyStability.sensitiveGeometryCount)} sensitive geometries.`,
    `Recommended participants: ${String(audit.participantRecommendation.participantIds.length)} (audit recommendation only).`
  ].join("\n");
}
