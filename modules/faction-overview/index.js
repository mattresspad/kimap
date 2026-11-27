import { isGeographicArea } from "../selection/geographic-area-policy.js";
import { isKenshiPointInBounds } from "../selection/map-space.js";
import { createFactionEvidenceReportProjection } from "../scenario/power-report.js";
import { deepFreeze } from "../scenario/utils.js";

const CURRENT = new Set(["Default", "Active"]);
const CONDITIONAL = new Set(["Potential", "Distant"]);
const GOLD = [222, 165, 57];

function byNameAndId(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function idOf(record, key = "StringId") {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function diagnostic(kind, entityId, reason, detail = {}) {
  return { kind, entityId, reason, ...detail };
}

function indexRecords(records, key, kind, diagnostics) {
  const index = new Map();
  for (const record of records) {
    const id = idOf(record, key);
    if (!id) {
      diagnostics.push(diagnostic(kind, "(missing identity)", "Record has no exact identity."));
      continue;
    }
    if (index.has(id)) {
      diagnostics.push(
        diagnostic(kind, id, "Duplicate exact identity; the later record was omitted.")
      );
      continue;
    }
    index.set(id, record);
  }
  return index;
}

function references(record, category, kind, entityId, diagnostics) {
  const value = record?.ReferenceCategories?.[category];
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  diagnostics.push(diagnostic(kind, entityId, `Malformed '${category}' references.`));
  return [];
}

function factionOf(record, factionById, kind, entityId, diagnostics) {
  const links = references(record, "faction", kind, entityId, diagnostics);
  if (links.length === 0) return null;
  const ids = new Set();
  const unresolvedIds = new Set();
  for (const link of links) {
    const id = idOf(link);
    if (!id || !factionById.has(id)) unresolvedIds.add(id ?? "(missing identity)");
    else ids.add(id);
  }
  if (ids.size !== 1 || unresolvedIds.size > 0) {
    diagnostics.push(
      diagnostic(kind, entityId, "Faction reference is ambiguous or unresolved.", {
        candidateFactionIds: [...ids].sort(),
        unresolvedIds: [...unresolvedIds].sort()
      })
    );
    return null;
  }
  return [...ids][0];
}

function sourceRecords(datasets, baseline, key, baselineKey) {
  if (Array.isArray(datasets?.[key])) return datasets[key];
  return Array.isArray(baseline?.[baselineKey])
    ? baseline[baselineKey].map((entry) => entry.raw)
    : null;
}

function createUnavailableCatalog(reason, diagnostics = []) {
  return deepFreeze({
    available: false,
    reason,
    factions: [],
    spawnReferences: [],
    townOccurrences: [],
    exactTownOwnerById: {},
    conditionalTownIdsByFaction: {},
    conditionalTownTargetsByFaction: {},
    diagnostics
  });
}

/**
 * Builds a stable exact-ID roster from mapped baseline Squad spawns and reachable mapped-Town
 * ownership. Raw datasets keep the roster available when scenario normalization fails.
 */
export function createFactionOverviewCatalog({ datasets, baseline = null, snapshot = null } = {}) {
  const diagnostics = [];
  const rawFactions = sourceRecords(datasets, baseline, "factions", "factions");
  const rawSquads = sourceRecords(datasets, baseline, "squads", "squads");
  const rawAreas = sourceRecords(datasets, baseline, "spawnAreas", "spawnAreas");
  const rawTowns = sourceRecords(datasets, baseline, "townFcsData", "towns");
  const rawLocations = sourceRecords(datasets, baseline, "mapData", "mapLocations");
  if (
    [rawFactions, rawSquads, rawAreas, rawTowns, rawLocations].some(
      (value) => !Array.isArray(value)
    )
  ) {
    return createUnavailableCatalog("required-reference-data-unavailable");
  }

  const factionById = indexRecords(rawFactions, "StringId", "Faction", diagnostics);
  const squadById = indexRecords(rawSquads, "StringId", "Squad", diagnostics);
  const areaById = indexRecords(rawAreas, "StringId", "Spawn Area", diagnostics);
  const townById = indexRecords(rawTowns, "StringId", "Town", diagnostics);
  const locationById = indexRecords(rawLocations, "InstanceId", "Town Occurrence", diagnostics);
  const rosterIds = new Set();
  const spawnReferences = [];

  for (const [areaId, area] of areaById) {
    if (!isGeographicArea(areaId)) continue;
    const links = references(area, "homeless spawns", "Spawn Area", areaId, diagnostics);
    const counts = new Map();
    for (const link of links) {
      const squadId = idOf(link);
      const squad = squadById.get(squadId);
      if (!squad) {
        diagnostics.push(
          diagnostic("Spawn Squad", squadId ?? areaId, "Squad link is unresolved.", { areaId })
        );
        continue;
      }
      const factionId = factionOf(squad, factionById, "Spawn Squad", squadId, diagnostics);
      if (!factionId) continue;
      const baseOccurrenceId = `${areaId}:Squad:${squadId}`;
      const ordinal = (counts.get(baseOccurrenceId) ?? 0) + 1;
      counts.set(baseOccurrenceId, ordinal);
      const occurrenceId = ordinal === 1 ? baseOccurrenceId : `${baseOccurrenceId}:${ordinal}`;
      const status =
        snapshot?.baselineWorld?.spawns?.[areaId]?.entries?.[occurrenceId]?.status ?? null;
      if (snapshot?.baselineWorld && !CURRENT.has(status) && !CONDITIONAL.has(status)) {
        if (status === null) {
          diagnostics.push(
            diagnostic("Spawn Squad", squadId, "Baseline spawn classification is unavailable.", {
              areaId,
              occurrenceId
            })
          );
        }
        continue;
      }
      rosterIds.add(factionId);
      spawnReferences.push({ areaId, squadId, factionId, occurrenceId, baselineStatus: status });
    }
  }

  const mappedBaseIds = new Set();
  const townOccurrences = [];
  for (const [id, location] of locationById) {
    const baseTownId = idOf(location, "TargetId");
    if (!baseTownId || !townById.has(baseTownId)) continue;
    mappedBaseIds.add(baseTownId);
    const x = Number(location.X);
    const z = Number(location.Z);
    const coordinate =
      location.X !== undefined &&
      location.X !== null &&
      location.Z !== undefined &&
      location.Z !== null &&
      String(location.X).trim() !== "" &&
      String(location.Z).trim() !== "" &&
      isKenshiPointInBounds({ x, z })
        ? { x, z }
        : null;
    if (!coordinate) {
      diagnostics.push(
        diagnostic("Town Occurrence", id, "Town marker has no reliable map coordinate.", {
          baseTownId
        })
      );
    }
    townOccurrences.push({ id, baseTownId, name: location.Name ?? id, coordinate });
  }

  const conditionalTownIdsByFaction = new Map();
  const conditionalTownTargetsByFaction = new Map();
  const exactTownOwnerById = new Map();
  for (const baseTownId of [...mappedBaseIds].sort()) {
    const pending = [{ townId: baseTownId, depth: 0 }];
    const visited = new Set();
    while (pending.length > 0) {
      const { townId, depth } = pending.shift();
      if (visited.has(townId)) continue;
      if (visited.size >= 2048) {
        diagnostics.push(
          diagnostic("Town", baseTownId, "Override traversal reached its safety limit.")
        );
        break;
      }
      visited.add(townId);
      const town = townById.get(townId);
      if (!town) {
        diagnostics.push(
          diagnostic("Town", townId, "Reachable override town is unresolved.", { baseTownId })
        );
        continue;
      }
      const factionId = factionOf(town, factionById, "Town", townId, diagnostics);
      if (factionId) {
        exactTownOwnerById.set(townId, factionId);
        rosterIds.add(factionId);
        if (depth > 0) {
          const ids = conditionalTownIdsByFaction.get(factionId) ?? new Set();
          ids.add(baseTownId);
          conditionalTownIdsByFaction.set(factionId, ids);
          const targets = conditionalTownTargetsByFaction.get(factionId) ?? [];
          targets.push({ baseTownId, townId });
          conditionalTownTargetsByFaction.set(factionId, targets);
        }
      }
      for (const link of references(town, "override town", "Town", townId, diagnostics)) {
        const targetId = idOf(link);
        if (!targetId || !townById.has(targetId)) {
          diagnostics.push(
            diagnostic("Town", townId, "Override town link is unresolved.", { targetId })
          );
          continue;
        }
        if (visited.has(targetId)) continue;
        pending.push({ townId: targetId, depth: depth + 1 });
      }
    }
  }

  const factions = [...rosterIds]
    .map((id) => ({
      id,
      name: typeof factionById.get(id)?.Name === "string" ? factionById.get(id).Name : id
    }))
    .sort(byNameAndId);
  return deepFreeze({
    available: true,
    reason: null,
    factions,
    spawnReferences,
    townOccurrences: townOccurrences.sort((left, right) => left.id.localeCompare(right.id)),
    exactTownOwnerById: Object.fromEntries(
      [...exactTownOwnerById].sort(([left], [right]) => left.localeCompare(right))
    ),
    conditionalTownIdsByFaction: Object.fromEntries(
      [...conditionalTownIdsByFaction].map(([id, ids]) => [id, [...ids].sort()])
    ),
    conditionalTownTargetsByFaction: Object.fromEntries(
      [...conditionalTownTargetsByFaction].map(([id, targets]) => [
        id,
        targets.sort(
          (left, right) =>
            left.baseTownId.localeCompare(right.baseTownId) ||
            left.townId.localeCompare(right.townId)
        )
      ])
    ),
    diagnostics
  });
}

function hasReachableConditionalTown(factionId, catalog, baseline, snapshot) {
  const targets = catalog.conditionalTownTargetsByFaction[factionId] ?? [];
  for (const { baseTownId, townId } of targets) {
    const activeTownId = snapshot.world.towns?.[baseTownId]?.activeTownId;
    if (!activeTownId || activeTownId === townId) continue;
    const pending = [activeTownId];
    const visited = new Set();
    while (pending.length > 0 && visited.size < 2048) {
      const candidateId = pending.pop();
      if (visited.has(candidateId)) continue;
      visited.add(candidateId);
      if (candidateId === townId) return true;
      for (const nextId of baseline.townById[candidateId]?.overrideIds ?? []) {
        if (!visited.has(nextId)) pending.push(nextId);
      }
    }
  }
  return false;
}

/** Projects every roster faction, including factions without a territorial Power Ranks row. */
export function projectFactionOverview({ catalog, baseline = null, snapshot = null } = {}) {
  if (!catalog?.available) {
    return deepFreeze({
      available: false,
      reason: catalog?.reason ?? "catalog-unavailable",
      entries: [],
      diagnostics: catalog?.diagnostics ?? []
    });
  }
  if (!baseline || !snapshot?.world || !snapshot?.baselineWorld) {
    return deepFreeze({
      available: false,
      reason: "scenario-analysis-unavailable",
      entries: catalog.factions.map((faction) => ({
        ...faction,
        available: false,
        status: "unavailable",
        report: null,
        conditionalAreaIds: [],
        townOccurrences: []
      })),
      diagnostics: catalog.diagnostics
    });
  }

  const reports = createFactionEvidenceReportProjection(
    baseline,
    snapshot,
    catalog.factions.map(({ id }) => id)
  );
  const reportById = new Map(reports.entries.map((report) => [report.id, report]));
  const conditionalAreaIdsByFaction = new Map();
  for (const reference of catalog.spawnReferences) {
    const status =
      snapshot.world.spawns?.[reference.areaId]?.entries?.[reference.occurrenceId]?.status;
    if (!CONDITIONAL.has(status)) continue;
    const ids = conditionalAreaIdsByFaction.get(reference.factionId) ?? new Set();
    ids.add(reference.areaId);
    conditionalAreaIdsByFaction.set(reference.factionId, ids);
  }
  const occurrencesByBaseTownId = new Map();
  for (const occurrence of catalog.townOccurrences) {
    const entries = occurrencesByBaseTownId.get(occurrence.baseTownId) ?? [];
    entries.push(occurrence);
    occurrencesByBaseTownId.set(occurrence.baseTownId, entries);
  }

  const entries = catalog.factions.map((faction) => {
    const report = reportById.get(faction.id);
    const townControl = Object.fromEntries(
      ["current", "gained", "lost"].map((category) => [
        category,
        report.townControl[category].filter(
          (town) => catalog.exactTownOwnerById[town.id] === faction.id
        )
      ])
    );
    const exactReport = {
      ...report,
      townsOwned: townControl.current.length,
      townsGained: townControl.gained.length,
      townsLost: townControl.lost.length,
      change: townControl.gained.length - townControl.lost.length,
      townControl
    };
    const currentBaseTownIds = new Set(townControl.current.map(({ baseTownId }) => baseTownId));
    const townOccurrences = [...currentBaseTownIds]
      .flatMap((baseTownId) => occurrencesByBaseTownId.get(baseTownId) ?? [])
      .sort((left, right) => left.id.localeCompare(right.id));
    const conditionalAreaIds = [...(conditionalAreaIdsByFaction.get(faction.id) ?? [])].sort();
    const hasCurrent = report.spawnPresence.areaCount > 0 || exactReport.townsOwned > 0;
    const hasConditional =
      conditionalAreaIds.length > 0 ||
      hasReachableConditionalTown(faction.id, catalog, baseline, snapshot);
    return {
      ...faction,
      available: true,
      status: hasCurrent ? "current" : hasConditional ? "conditional" : "none",
      report: exactReport,
      conditionalAreaIds,
      townOccurrences
    };
  });
  return deepFreeze({
    available: true,
    reason: null,
    entries,
    diagnostics: [...catalog.diagnostics, ...reports.diagnostics]
  });
}

/** Creates one caller-copyable passive gold overlay from exact current Squad spawn area IDs. */
export function createFactionOverviewRaster({ areaIndex, areaIds = [] } = {}) {
  if (!areaIndex?.available) {
    return Object.freeze({
      available: false,
      reason: "raster-geography-unavailable",
      width: 0,
      height: 0,
      statusCounts: Object.freeze({ solid: 0, caution: 0 }),
      unmappedAreaIds: Object.freeze([]),
      copyRgba: () => new Uint8ClampedArray()
    });
  }
  const selected = new Set(areaIds.filter((id) => typeof id === "string" && isGeographicArea(id)));
  const unmappedAreaIds = [...selected]
    .filter((id) => {
      const geometry = areaIndex.getGeometryForAreaId(id);
      return !geometry || geometry.cellCount === 0;
    })
    .sort();
  const statusByColor = new Map();
  const statusCounts = { solid: 0, caution: 0 };
  for (const geometry of areaIndex.geometries) {
    const matching = geometry.areaIds.filter((id) => selected.has(id));
    if (matching.length === 0 || geometry.cellCount === 0) continue;
    const status =
      geometry.ambiguous || matching.length !== geometry.areaIds.length ? "caution" : "solid";
    statusByColor.set(geometry.colorIndex, status);
    statusCounts[status] += 1;
  }
  const colors = areaIndex.copyColorIndexes();
  const pixels = new Uint8ClampedArray(areaIndex.width * areaIndex.height * 4);
  for (let y = 0; y < areaIndex.height; y += 1) {
    for (let x = 0; x < areaIndex.width; x += 1) {
      const index = y * areaIndex.width + x;
      const status = statusByColor.get(colors[index]);
      if (!status) continue;
      const offset = index * 4;
      pixels[offset] = GOLD[0];
      pixels[offset + 1] = GOLD[1];
      pixels[offset + 2] = GOLD[2];
      pixels[offset + 3] = status === "solid" ? 143 : (x + y) % 7 <= 2 ? 218 : 56;
    }
  }
  return Object.freeze({
    available: true,
    reason: null,
    width: areaIndex.width,
    height: areaIndex.height,
    statusCounts: Object.freeze(statusCounts),
    unmappedAreaIds: Object.freeze(unmappedAreaIds),
    copyRgba: () => new Uint8ClampedArray(pixels)
  });
}
