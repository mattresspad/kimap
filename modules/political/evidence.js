import { deepFreeze, diagnostic } from "../scenario/utils.js";
import { isGeographicArea } from "../selection/geographic-area-policy.js";

export const CURRENT_SPAWN_STATUSES = Object.freeze(["Active", "Default"]);
export const CONDITIONAL_SPAWN_STATUSES = Object.freeze(["Distant", "Potential"]);

const CURRENT_STATUS_SET = new Set(CURRENT_SPAWN_STATUSES);
const CONDITIONAL_STATUS_SET = new Set(CONDITIONAL_SPAWN_STATUSES);
const OCCUPANT_CATEGORIES = Object.freeze([
  "leader",
  "squad",
  "squad2",
  "animals",
  "animals2",
  "housemates",
  "choosefrom list",
  "random character"
]);

function compareIds(left, right) {
  return left.id.localeCompare(right.id);
}

function compareEvidence(left, right) {
  return (
    String(left.geometryKey ?? "").localeCompare(String(right.geometryKey ?? "")) ||
    left.areaId.localeCompare(right.areaId) ||
    left.occurrenceId.localeCompare(right.occurrenceId)
  );
}

function referenceId(reference) {
  return typeof reference?.StringId === "string" && reference.StringId.trim() !== ""
    ? reference.StringId
    : null;
}

function references(record, category) {
  const value = record?.ReferenceCategories?.[category];
  return Array.isArray(value) ? value : [];
}

function numericDetail(value, { zeroAsOne = false } = {}) {
  if (!Number.isFinite(value) || value < 0) {
    return deepFreeze({ valid: false, value: null, authored: value ?? null });
  }
  return deepFreeze({
    valid: true,
    value: zeroAsOne && value === 0 ? 1 : value,
    authored: value
  });
}

function areaScalar(area, name) {
  return numericDetail(area.raw?.Values?.[name]);
}

function structuralMembers(rawSquad) {
  const members = [];
  for (const category of OCCUPANT_CATEGORIES) {
    for (const [position, reference] of references(rawSquad, category).entries()) {
      const id = referenceId(reference);
      const value0 = reference?.Value0;
      const value1 = reference?.Value1;
      const qualifies =
        category === "leader" ||
        (Number.isFinite(value0) && value0 > 0) ||
        (Number.isFinite(value1) && value1 > 0);
      members.push({
        category,
        position,
        entityId: id,
        value0: Number.isFinite(value0) ? value0 : null,
        value1: Number.isFinite(value1) ? value1 : null,
        qualifies
      });
    }
  }
  return members;
}

function factionLinks(raw, factionIds) {
  const rawReferences = references(raw, "faction");
  const referencedIds = rawReferences.map(referenceId).filter(Boolean);
  const resolvedIds = [...new Set(referencedIds.filter((id) => factionIds.has(id)))].sort();
  const unresolvedIds = [...new Set(referencedIds.filter((id) => !factionIds.has(id)))].sort();
  return deepFreeze({
    referencedIds: [...new Set(referencedIds)].sort(),
    resolvedIds,
    unresolvedIds,
    attributionId: resolvedIds.length === 1 && unresolvedIds.length === 0 ? resolvedIds[0] : null,
    ambiguous: resolvedIds.length + unresolvedIds.length > 1
  });
}

function paletteLinks(raw) {
  const categories = raw?.ReferenceCategories ?? {};
  return [
    ...new Set(
      Object.entries(categories)
        .filter(
          ([category]) => category.toLowerCase() === "color" || /colou?r.*scheme/i.test(category)
        )
        .flatMap(([, entries]) => (Array.isArray(entries) ? entries : []))
        .map(referenceId)
        .filter(Boolean)
    )
  ].sort();
}

function createResidentProfile(town, squadById, factionIds, diagnostics) {
  const residentReferences = references(town.raw, "residents");
  const qualifying = [];
  const unresolved = [];
  let placementTotal = 0;
  let placementValid = true;

  for (const [position, reference] of residentReferences.entries()) {
    const squadId = referenceId(reference);
    const squad = squadId ? squadById[squadId] : null;
    if (!squad) {
      unresolved.push({ position, squadId });
      diagnostics.push(
        diagnostic(
          "warning",
          "political_resident_squad_unresolved",
          `Town '${town.id}' has an unresolved resident squad reference.`,
          { townId: town.id, position, squadId }
        )
      );
      continue;
    }

    const members = structuralMembers(squad.raw);
    if (!members.some(({ qualifies }) => qualifies)) continue;

    const multiplicity = numericDetail(reference?.Value0, { zeroAsOne: true });
    if (!multiplicity.valid) {
      placementValid = false;
      diagnostics.push(
        diagnostic(
          "error",
          "political_resident_multiplicity_invalid",
          `Town '${town.id}' has invalid resident multiplicity for squad '${squadId}'.`,
          { townId: town.id, squadId, position, value: reference?.Value0 ?? null }
        )
      );
    } else {
      placementTotal += multiplicity.value;
    }

    qualifying.push({
      position,
      squadId,
      squadName: squad.name,
      multiplicity,
      tenantFactions: factionLinks(squad.raw, factionIds),
      memberRanges: members
    });
  }

  const unresolvedCount = unresolved.length;
  return deepFreeze({
    townId: town.id,
    residentReferenceCount: residentReferences.length,
    qualifyingReferenceCount: qualifying.length,
    inhabited: qualifying.length > 0,
    residentReferencesValid: unresolvedCount === 0,
    residentPlacementsValid: unresolvedCount === 0 && placementValid,
    residentPlacementTotal: unresolvedCount === 0 && placementValid ? placementTotal : null,
    qualifying,
    unresolved
  });
}

function createUnavailableCatalog(reason, diagnostics = []) {
  return deepFreeze({
    available: false,
    reason,
    manifestId: null,
    factions: [],
    towns: [],
    townOccurrences: [],
    spawnAreas: [],
    diagnostics
  });
}

function rawSpawnReferences(area, type) {
  return references(area.raw, type === "Squad" ? "homeless spawns" : "nests");
}

function createSpawnArea(area, baseline, areaIndex, factionIds, diagnostics) {
  const geometry = areaIndex.getGeometryForAreaId(area.id);
  const typePositions = { Squad: 0, Nest: 0 };
  const occurrences = area.occurrences.map((occurrence) => {
    const position = typePositions[occurrence.type];
    typePositions[occurrence.type] += 1;
    const reference = rawSpawnReferences(area, occurrence.type)[position];
    const entity =
      occurrence.type === "Squad"
        ? baseline.squadById[occurrence.entityId]
        : baseline.townById[occurrence.entityId];
    const weight = numericDetail(reference?.Value0);
    if (!weight.valid) {
      diagnostics.push(
        diagnostic(
          "error",
          "political_spawn_weight_invalid",
          `Spawn occurrence '${occurrence.occurrenceId}' has invalid relative weight.`,
          {
            areaId: area.id,
            occurrenceId: occurrence.occurrenceId,
            value: reference?.Value0 ?? null
          }
        )
      );
    }
    const factions = factionLinks(entity?.raw, factionIds);
    if (!entity) {
      diagnostics.push(
        diagnostic(
          "error",
          "political_spawn_entity_unresolved",
          `Spawn occurrence '${occurrence.occurrenceId}' has no normalized entity.`,
          { areaId: area.id, occurrenceId: occurrence.occurrenceId }
        )
      );
    } else if (factions.attributionId === null) {
      diagnostics.push(
        diagnostic(
          factions.ambiguous ? "warning" : "info",
          factions.ambiguous
            ? "political_spawn_faction_ambiguous"
            : "political_spawn_faction_unattributed",
          `Spawn occurrence '${occurrence.occurrenceId}' has no single resolved faction.`,
          {
            areaId: area.id,
            occurrenceId: occurrence.occurrenceId,
            factionIds: factions.referencedIds
          }
        )
      );
    }
    return {
      ...occurrence,
      areaId: area.id,
      position,
      relativeWeight: weight,
      factions
    };
  });

  const homelessSpawnAmount = areaScalar(area, "homeless spawn amount");
  const numNests = areaScalar(area, "num nests");
  for (const [channel, scalar] of [
    ["homeless", homelessSpawnAmount],
    ["nests", numNests]
  ]) {
    if (!scalar.valid) {
      diagnostics.push(
        diagnostic(
          "error",
          "political_area_scalar_invalid",
          `Spawn area '${area.id}' has an invalid ${channel} pressure scalar.`,
          { areaId: area.id, channel, value: scalar.authored }
        )
      );
    }
  }

  if (!geometry) {
    diagnostics.push(
      diagnostic(
        "warning",
        "political_area_geometry_unresolved",
        `Spawn area '${area.id}' has no raster geometry.`,
        { areaId: area.id }
      )
    );
  }

  return {
    id: area.id,
    name: area.name,
    geometryKey: geometry?.key ?? null,
    cellCount: geometry?.cellCount ?? null,
    geometryExcluded: geometry?.excluded ?? false,
    geometryIndeterminate: geometry?.indeterminate ?? true,
    homelessSpawnAmount,
    numNests,
    occurrences
  };
}

/** Precomputes immutable joins without retaining or mutating ScenarioSession state. */
export function createPoliticalEvidenceCatalog({ baseline, areaIndex } = {}) {
  if (!baseline) return createUnavailableCatalog("scenario-baseline-unavailable");
  if (!areaIndex?.available) return createUnavailableCatalog("raster-geography-unavailable");

  const diagnostics = [...areaIndex.diagnostics];
  const factionIds = new Set(baseline.factions.map(({ id }) => id));
  const factions = baseline.factions
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      notReal: faction.raw?.Values?.["not real"] === true,
      paletteIds: paletteLinks(faction.raw)
    }))
    .sort(compareIds);

  const towns = baseline.towns
    .map((town) => ({
      id: town.id,
      name: town.name,
      ownerId: town.ownerId,
      residents: createResidentProfile(town, baseline.squadById, factionIds, diagnostics)
    }))
    .sort(compareIds);
  const residentByTownId = new Map(towns.map((town) => [town.id, town.residents]));

  const townOccurrences = baseline.mapLocations
    .filter((location) => baseline.townById[location.targetId])
    .map((location) => {
      const coordinate = { x: location.raw?.X, z: location.raw?.Z };
      const geometry = areaIndex.getGeometryAtKenshi(coordinate);
      const component = areaIndex.getComponentAtKenshi(coordinate);
      if (!geometry) {
        diagnostics.push(
          diagnostic(
            "warning",
            "political_town_geometry_unresolved",
            `Map occurrence '${location.instanceId}' cannot be joined to raster geography.`,
            { occurrenceId: location.instanceId, townId: location.targetId, coordinate }
          )
        );
      }
      return {
        id: location.instanceId,
        baseTownId: location.targetId,
        name: location.name,
        coordinate,
        geometryKey: geometry?.key ?? null,
        componentId: component?.id ?? null,
        geometryExcluded: geometry?.excluded ?? false,
        geometryIndeterminate: geometry?.indeterminate ?? true
      };
    })
    .sort(compareIds);

  const spawnAreas = baseline.spawnAreas
    .filter((area) => isGeographicArea(area.id))
    .map((area) => createSpawnArea(area, baseline, areaIndex, factionIds, diagnostics))
    .sort(compareIds);

  return deepFreeze({
    available: true,
    reason: null,
    manifestId: baseline.manifestId,
    factions,
    towns,
    residentByTownId: Object.fromEntries(
      [...residentByTownId.entries()].sort(([left], [right]) => left.localeCompare(right))
    ),
    townOccurrences,
    spawnAreas,
    geometries: areaIndex.geometries,
    diagnostics
  });
}

function createUnavailableProjection(reason, catalog) {
  return deepFreeze({
    available: false,
    reason,
    manifestId: catalog?.manifestId ?? null,
    factions: catalog?.factions ?? [],
    geometries: [],
    towns: [],
    homelessSpawns: [],
    nests: [],
    unattributed: [],
    conditional: [],
    excluded: [],
    diagnostics: catalog?.diagnostics ?? []
  });
}

function destinationFor(record) {
  if (record.exclusionReason) return "excluded";
  if (record.state === "conditional") return "conditional";
  if (record.state !== "current") return "excluded";
  if (record.factionId === null) return "unattributed";
  if (record.kind === "town") return "towns";
  return record.kind === "homelessSpawn" ? "homelessSpawns" : "nests";
}

function projectTownOccurrence(occurrence, catalog, snapshot, factionIds, diagnostics) {
  const state = snapshot.world?.towns?.[occurrence.baseTownId];
  if (!state || typeof state.activeTownId !== "string") {
    diagnostics.push(
      diagnostic(
        "error",
        "political_town_state_unavailable",
        `Map occurrence '${occurrence.id}' has no effective scenario town state.`,
        { occurrenceId: occurrence.id, baseTownId: occurrence.baseTownId }
      )
    );
    return {
      id: `town:${occurrence.id}`,
      occurrenceId: occurrence.id,
      areaId: "",
      geometryKey: occurrence.geometryKey,
      componentId: occurrence.componentId,
      kind: "town",
      state: "current",
      factionId: null,
      exclusionReason: "scenario-town-unavailable",
      evidenceIndeterminate: true,
      metrics: null,
      activeTownId: null,
      activeTownName: null,
      ownerName: null,
      tenantFactionIds: []
    };
  }

  const activeTown = catalog.towns.find(({ id }) => id === state.activeTownId);
  const residents = catalog.residentByTownId[state.activeTownId];
  if (!activeTown || !residents) {
    diagnostics.push(
      diagnostic(
        "error",
        "political_effective_town_unresolved",
        `Effective town '${state.activeTownId}' cannot be joined to its evidence profile.`,
        { occurrenceId: occurrence.id, baseTownId: occurrence.baseTownId }
      )
    );
  }
  const factionId =
    typeof state.ownerId === "string" && factionIds.has(state.ownerId) ? state.ownerId : null;
  if (residents?.inhabited && factionId === null) {
    diagnostics.push(
      diagnostic(
        "warning",
        "political_town_owner_unattributed",
        `Populated town occurrence '${occurrence.id}' has no resolved owner faction.`,
        { occurrenceId: occurrence.id, ownerId: state.ownerId ?? null }
      )
    );
  }

  const tenantFactionIds = [
    ...new Set(
      (residents?.qualifying ?? []).flatMap(({ tenantFactions }) => tenantFactions.resolvedIds)
    )
  ].sort();
  const metrics = residents
    ? {
        inhabitedOccurrences: {
          value: residents.inhabited ? 1 : 0,
          valid: residents.inhabited || residents.residentReferencesValid
        },
        residentReferences: {
          value: residents.qualifyingReferenceCount,
          valid: residents.residentReferencesValid
        },
        residentPlacements: {
          value: residents.residentPlacementTotal,
          valid: residents.residentPlacementsValid
        }
      }
    : null;

  let exclusionReason = null;
  if (occurrence.geometryKey === null) exclusionReason = "unmapped-occurrence";
  else if (occurrence.geometryIndeterminate) exclusionReason = "indeterminate-geography";
  else if (occurrence.geometryExcluded) exclusionReason = "excluded-geography";
  else if (!metrics) exclusionReason = "effective-town-unresolved";

  return {
    id: `town:${occurrence.id}`,
    occurrenceId: occurrence.id,
    areaId: "",
    geometryKey: occurrence.geometryKey,
    componentId: occurrence.componentId,
    kind: "town",
    state: "current",
    factionId,
    exclusionReason,
    evidenceIndeterminate: !metrics,
    metrics,
    activeTownId: state.activeTownId,
    activeTownName: state.name ?? activeTown?.name ?? state.activeTownId,
    ownerName: state.owner ?? null,
    tenantFactionIds
  };
}

function projectSpawnOccurrence(area, occurrence, status, diagnostics) {
  const kind = occurrence.type === "Squad" ? "homelessSpawn" : "nest";
  let state = "eliminated";
  if (CURRENT_STATUS_SET.has(status)) state = "current";
  else if (CONDITIONAL_STATUS_SET.has(status)) state = "conditional";
  else if (status !== "Eliminated") {
    diagnostics.push(
      diagnostic(
        "error",
        "political_spawn_status_unknown",
        `Spawn occurrence '${occurrence.occurrenceId}' has an unknown status.`,
        { areaId: area.id, occurrenceId: occurrence.occurrenceId, status: status ?? null }
      )
    );
    state = "unknown";
  }

  let exclusionReason = null;
  if (area.geometryKey === null) exclusionReason = "unmapped-area";
  else if (area.geometryIndeterminate) exclusionReason = "indeterminate-geography";
  else if (area.geometryExcluded) exclusionReason = "excluded-geography";
  else if (state === "eliminated") exclusionReason = "eliminated";
  else if (state === "unknown") exclusionReason = "unknown-status";

  return {
    id: `${kind}:${occurrence.occurrenceId}`,
    occurrenceId: occurrence.occurrenceId,
    areaId: area.id,
    geometryKey: area.geometryKey,
    componentId: null,
    kind,
    state,
    status,
    factionId: occurrence.factions.attributionId,
    factionIds: occurrence.factions.referencedIds,
    exclusionReason,
    evidenceIndeterminate: state === "unknown",
    relativeWeight: occurrence.relativeWeight,
    areaScalar: kind === "homelessSpawn" ? area.homelessSpawnAmount : area.numNests
  };
}

/** Selects effective scenario facts while leaving ScenarioSession and its snapshot untouched. */
export function projectPoliticalEvidence({ catalog, snapshot } = {}) {
  if (!catalog?.available) {
    return createUnavailableProjection(catalog?.reason ?? "evidence-catalog-unavailable", catalog);
  }
  if (!snapshot?.world?.towns || !snapshot?.world?.spawns) {
    return createUnavailableProjection("scenario-snapshot-unavailable", catalog);
  }

  const diagnostics = [...catalog.diagnostics];
  const factionIds = new Set(catalog.factions.map(({ id }) => id));
  const records = catalog.townOccurrences.map((occurrence) =>
    projectTownOccurrence(occurrence, catalog, snapshot, factionIds, diagnostics)
  );

  for (const area of catalog.spawnAreas) {
    const state = snapshot.world.spawns[area.id];
    for (const occurrence of area.occurrences) {
      const status = state?.entries?.[occurrence.occurrenceId]?.status;
      if (!status) {
        diagnostics.push(
          diagnostic(
            "error",
            "political_spawn_state_unavailable",
            `Spawn occurrence '${occurrence.occurrenceId}' has no scenario status.`,
            { areaId: area.id, occurrenceId: occurrence.occurrenceId }
          )
        );
      }
      records.push(projectSpawnOccurrence(area, occurrence, status, diagnostics));
    }
  }

  records.sort(compareEvidence);
  const channels = {
    towns: [],
    homelessSpawns: [],
    nests: [],
    unattributed: [],
    conditional: [],
    excluded: []
  };
  for (const record of records) channels[destinationFor(record)].push(record);

  const recordsByGeometry = new Map(catalog.geometries.map(({ key }) => [key, []]));
  for (const record of records) {
    if (record.geometryKey && recordsByGeometry.has(record.geometryKey)) {
      recordsByGeometry.get(record.geometryKey).push(record);
    }
  }
  const geometries = catalog.geometries.map((geometry) => ({
    ...geometry,
    records: recordsByGeometry.get(geometry.key) ?? []
  }));

  return deepFreeze({
    available: true,
    reason: null,
    manifestId: catalog.manifestId,
    factions: catalog.factions,
    geometries,
    ...channels,
    diagnostics
  });
}
