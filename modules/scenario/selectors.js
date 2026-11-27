import { getTownProgressionIndex, initializeTownProgression } from "./town-progression.js";

function isPermanentlyEliminated(baseline, conditions, characters) {
  return conditions.some((condition) => {
    if (condition.value !== 1) return false;
    const worldState = baseline.worldStateById[condition.entityId];
    return worldState.conditions.some(
      (stateCondition) =>
        stateCondition.category === "NPC is" &&
        stateCondition.value === 1 &&
        characters[stateCondition.entityId] === 0
    );
  });
}

function classifySpawn(baseline, entity, worldStates, characters) {
  if (entity.conditions.length === 0) return "Default";
  if (isPermanentlyEliminated(baseline, entity.conditions, characters)) return "Eliminated";

  const unmet = entity.conditions.filter(
    (condition) => worldStates[condition.entityId] !== condition.value
  ).length;
  if (unmet === 0) return "Active";
  if (unmet === 1) return "Potential";
  return "Distant";
}

export function deriveWorldSnapshot(baseline, { worldStates, characters, townProgression = null }) {
  const progression =
    townProgression ??
    initializeTownProgression(baseline, getTownProgressionIndex(baseline), worldStates).progression;
  const towns = progression.towns;
  const diagnostics = [...progression.diagnostics];

  const spawns = {};
  for (const area of baseline.spawnAreas) {
    const entries = {};
    for (const occurrence of area.occurrences) {
      const entity =
        occurrence.type === "Squad"
          ? baseline.squadById[occurrence.entityId]
          : baseline.townById[occurrence.entityId];
      entries[occurrence.occurrenceId] = {
        occurrenceId: occurrence.occurrenceId,
        entityId: occurrence.entityId,
        name: entity.name,
        type: occurrence.type,
        status: classifySpawn(baseline, entity, worldStates, characters)
      };
    }
    spawns[area.id] = { name: area.name, entries };
  }

  return { towns, spawns, diagnostics };
}

export function generateWorldNarrative(previous, current, townNarrative = []) {
  if (!previous || !current) return [];
  const messages = [...townNarrative];

  for (const [areaId, priorArea] of Object.entries(previous.spawns)) {
    const currentArea = current.spawns[areaId];
    if (!currentArea) continue;
    for (const [occurrenceId, priorEntry] of Object.entries(priorArea.entries)) {
      const currentEntry = currentArea.entries[occurrenceId];
      if (!currentEntry) continue;
      if (priorEntry.status === "Active" && currentEntry.status === "Eliminated") {
        messages.push(
          `Threat eliminated: ${currentEntry.name} patrols have ceased in ${priorArea.name}.`
        );
      } else if (priorEntry.status === "Eliminated" && currentEntry.status === "Active") {
        messages.push(
          `Threat resurfaced: ${currentEntry.name} patrols detected in ${priorArea.name}.`
        );
      }
    }
  }

  return messages;
}

export function calculatePowerStatistics(currentWorld, baselineWorld) {
  const stats = {};
  const getEntry = (id, name) => {
    stats[id] ??= {
      id,
      name,
      townsOwned: 0,
      townsGained: 0,
      townsLost: 0
    };
    return stats[id];
  };

  for (const [townId, town] of Object.entries(currentWorld.towns)) {
    const initialTown = baselineWorld.towns[townId];
    const hasCurrentOwner = town.owner !== "Unknown" && Boolean(town.ownerId);
    const hasInitialOwner = initialTown?.owner !== "Unknown" && Boolean(initialTown?.ownerId);

    if (hasCurrentOwner) {
      const entry = getEntry(town.ownerId, town.owner);
      entry.townsOwned += 1;
      if (hasInitialOwner && initialTown.ownerId !== town.ownerId) {
        entry.townsGained += 1;
      }
    }

    if (hasInitialOwner && initialTown.ownerId !== town.ownerId) {
      getEntry(initialTown.ownerId, initialTown.owner).townsLost += 1;
    }
  }

  return Object.values(stats).sort(
    (left, right) =>
      right.townsOwned - left.townsOwned ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
  );
}
