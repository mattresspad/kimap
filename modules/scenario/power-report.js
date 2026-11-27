import {
  GUARANTEED_MEMBER_CATEGORIES,
  resolveCharacterAffiliations,
  resolveFactionReference
} from "./character-affiliation.js";
import { deepFreeze } from "./utils.js";
import { isGeographicArea } from "../selection/geographic-area-policy.js";

const CURRENT_SPAWN_STATUSES = new Set(["Default", "Active"]);
const CHARACTER_STATUS_LABELS = Object.freeze({ 0: "Dead", 1: "Alive", 2: "Imprisoned" });

function nameAndId(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function createFactionAccumulator(stat, rank) {
  return {
    ...stat,
    rank,
    change: stat.townsGained - stat.townsLost,
    spawnAreas: new Map(),
    spawnSquads: new Map(),
    characters: [],
    currentTowns: [],
    gainedTowns: [],
    lostTowns: []
  };
}

function addSpawnEvidence(accumulators, baseline, snapshot, diagnostics) {
  const diagnosticBySquadId = new Map();
  for (const [areaId, area] of Object.entries(snapshot.world?.spawns ?? {}).sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    if (!isGeographicArea(areaId)) continue;
    for (const entry of Object.values(area.entries ?? {})) {
      if (entry.type !== "Squad" || !CURRENT_SPAWN_STATUSES.has(entry.status)) continue;
      const squad = baseline.squadById[entry.entityId];
      const resolution = resolveFactionReference(squad?.raw, baseline);
      if (resolution.state !== "resolved") {
        if (!diagnosticBySquadId.has(entry.entityId)) {
          diagnosticBySquadId.set(entry.entityId, {
            id: `spawn:${entry.entityId}`,
            kind: "Spawn Squad",
            entityId: entry.entityId,
            name: entry.name,
            tier: "spawn",
            reason:
              resolution.state === "ambiguous"
                ? "Current spawn evidence reaches more than one faction."
                : resolution.state === "none"
                  ? "Current spawn squad has no exact faction evidence."
                  : "Current spawn faction evidence is malformed or unresolved.",
            candidateFactionIds: resolution.candidateIds,
            unresolvedIds: resolution.unresolvedIds,
            areaIds: new Set()
          });
        }
        diagnosticBySquadId.get(entry.entityId).areaIds.add(areaId);
        continue;
      }

      const accumulator = accumulators.get(resolution.factionId);
      if (!accumulator) continue;
      accumulator.spawnAreas.set(areaId, { id: areaId, name: area.name });
      accumulator.spawnSquads.set(entry.entityId, { id: entry.entityId, name: entry.name });
    }
  }

  for (const entry of diagnosticBySquadId.values()) {
    diagnostics.push({ ...entry, areaIds: [...entry.areaIds].sort() });
  }
}

function addCharacterEvidence(accumulators, baseline, snapshot, affiliations, diagnostics) {
  diagnostics.push(...affiliations.diagnostics);
  for (const character of baseline.characters) {
    const assignment = affiliations.byCharacterId[character.id];
    if (!assignment) continue;
    const accumulator = accumulators.get(assignment.factionId);
    if (!accumulator) continue;
    const status = snapshot.characters?.[character.id];
    accumulator.characters.push({
      id: character.id,
      name: character.name,
      status,
      statusLabel: CHARACTER_STATUS_LABELS[status] ?? "Unavailable",
      affiliationSource: assignment.source
    });
  }
}

function townEntry(baseTownId, state) {
  return {
    id: state.activeTownId,
    baseTownId,
    name: state.name
  };
}

function addTownEvidence(accumulators, baseline, snapshot) {
  for (const baseTownId of baseline.mapTownIds) {
    const current = snapshot.world?.towns?.[baseTownId];
    const initial = snapshot.baselineWorld?.towns?.[baseTownId];
    if (!current || !initial) continue;
    const currentOwner =
      current.owner !== "Unknown" &&
      typeof current.ownerId === "string" &&
      current.ownerId.length > 0
        ? current.ownerId
        : null;
    const initialOwner =
      initial.owner !== "Unknown" &&
      typeof initial.ownerId === "string" &&
      initial.ownerId.length > 0
        ? initial.ownerId
        : null;

    if (currentOwner && accumulators.has(currentOwner)) {
      const accumulator = accumulators.get(currentOwner);
      accumulator.currentTowns.push(townEntry(baseTownId, current));
      if (initialOwner && initialOwner !== currentOwner) {
        accumulator.gainedTowns.push(townEntry(baseTownId, current));
      }
    }
    if (initialOwner && initialOwner !== currentOwner && accumulators.has(initialOwner)) {
      accumulators.get(initialOwner).lostTowns.push(townEntry(baseTownId, initial));
    }
  }
}

function finalizeEntry(accumulator) {
  const characters = accumulator.characters.sort(nameAndId);
  const currentTowns = accumulator.currentTowns.sort(nameAndId);
  const gainedTowns = accumulator.gainedTowns.sort(nameAndId);
  const lostTowns = accumulator.lostTowns.sort(nameAndId);
  return {
    id: accumulator.id,
    name: accumulator.name,
    rank: accumulator.rank,
    townsOwned: accumulator.townsOwned,
    townsGained: accumulator.townsGained,
    townsLost: accumulator.townsLost,
    change: accumulator.change,
    spawnPresence: {
      areas: [...accumulator.spawnAreas.values()].sort(nameAndId),
      squads: [...accumulator.spawnSquads.values()].sort(nameAndId),
      areaCount: accumulator.spawnAreas.size,
      squadCount: accumulator.spawnSquads.size
    },
    worldStateCharacters: {
      entries: characters,
      aliveCount: characters.filter((character) => character.status === 1).length,
      totalCount: characters.length
    },
    townControl: {
      current: currentTowns,
      gained: gainedTowns,
      lost: lostTowns
    }
  };
}

/**
 * Adds read-only evidence to the existing territorial ranking without altering its faction set or
 * ordering.
 */
function createReportProjection(baseline, snapshot, statistics) {
  const accumulators = new Map(
    statistics.map((stat, index) => [
      stat.id,
      createFactionAccumulator(stat, stat.rank === null ? null : (stat.rank ?? index + 1))
    ])
  );
  const diagnostics = [];
  const affiliations = resolveCharacterAffiliations({
    baseline,
    baselineWorld: snapshot.baselineWorld
  });

  addSpawnEvidence(accumulators, baseline, snapshot, diagnostics);
  addCharacterEvidence(accumulators, baseline, snapshot, affiliations, diagnostics);
  addTownEvidence(accumulators, baseline, snapshot);

  return deepFreeze({
    entries: [...accumulators.values()].map(finalizeEntry),
    diagnostics: diagnostics.sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name) ||
        left.entityId.localeCompare(right.entityId)
    )
  });
}

export function createPowerRankReportProjection(baseline, snapshot) {
  return createReportProjection(baseline, snapshot, snapshot.powerStatistics ?? []);
}

/**
 * Uses the Power Ranks evidence rules for an explicit faction roster, including factions with no
 * territorial rank. This does not change the ranked projection or ScenarioSession statistics.
 */
export function createFactionEvidenceReportProjection(baseline, snapshot, factionIds) {
  if (!Array.isArray(factionIds)) throw new TypeError("Faction IDs must be an array.");
  const ranked = new Map(
    (snapshot.powerStatistics ?? []).map((entry, index) => [
      entry.id,
      { ...entry, rank: index + 1 }
    ])
  );
  const statistics = [...new Set(factionIds)].map((id) => {
    const faction = baseline.factionById[id];
    if (!faction) throw new TypeError(`Unknown faction '${id}'.`);
    return (
      ranked.get(id) ?? {
        id,
        name: faction.name,
        rank: null,
        townsOwned: 0,
        townsGained: 0,
        townsLost: 0
      }
    );
  });
  return createReportProjection(baseline, snapshot, statistics);
}

export { CHARACTER_STATUS_LABELS, CURRENT_SPAWN_STATUSES, GUARANTEED_MEMBER_CATEGORIES };
