import { deepFreeze, diagnostic, stableObject } from "./utils.js";

const INDEX_CACHE = new WeakMap();

function conditionsMatch(conditions, worldStates) {
  return conditions.every((condition) => worldStates[condition.entityId] === condition.value);
}

function createBaseTownState(baseTown) {
  return {
    baseName: baseTown.name,
    name: baseTown.name,
    owner: baseTown.owner,
    ownerId: baseTown.ownerId,
    nodeId: baseTown.id,
    activeTownId: baseTown.id,
    path: [baseTown.id],
    transitions: [],
    ambiguous: false,
    cycle: false
  };
}

function indexTownNetwork(baseline, baseTownId) {
  const reachableTownIds = [];
  const relevantStateIds = new Set();
  const visited = new Set();
  const pending = [baseTownId];

  while (pending.length > 0) {
    const townId = pending.pop();
    if (visited.has(townId)) continue;
    visited.add(townId);
    const town = baseline.townById[townId];
    if (!town) continue;
    reachableTownIds.push(townId);
    for (const condition of town.conditions) relevantStateIds.add(condition.entityId);
    for (let index = town.overrideIds.length - 1; index >= 0; index -= 1) {
      pending.push(town.overrideIds[index]);
    }
  }

  return {
    baseTownId,
    reachableTownIds,
    relevantStateIds: [...relevantStateIds].sort()
  };
}

/**
 * Builds the immutable graph metadata used by deterministic town progression.
 * The result contains no session state and is safe to share across replays.
 */
export function createTownProgressionIndex(baseline) {
  const networks = baseline.mapTownIds.map((baseTownId) => [
    baseTownId,
    indexTownNetwork(baseline, baseTownId)
  ]);
  return deepFreeze({ byBaseTownId: stableObject(networks) });
}

export function getTownProgressionIndex(baseline) {
  let index = INDEX_CACHE.get(baseline);
  if (!index) {
    index = createTownProgressionIndex(baseline);
    INDEX_CACHE.set(baseline, index);
  }
  return index;
}

function selectEligibleTargets(baseline, town, worldStates) {
  return town.overrideIds
    .map((targetId, referencePosition) => ({
      targetId,
      referencePosition,
      target: baseline.townById[targetId]
    }))
    .filter((candidate) => conditionsMatch(candidate.target.conditions, worldStates))
    .map((candidate) => ({
      ...candidate,
      conditionCount: candidate.target.conditions.length
    }))
    .sort(
      (left, right) =>
        left.conditionCount - right.conditionCount ||
        left.referencePosition - right.referencePosition
    );
}

function updateLineage(path, targetId) {
  const existingIndex = path.lastIndexOf(targetId);
  return existingIndex >= 0 ? path.slice(0, existingIndex + 1) : [...path, targetId];
}

function hasRelevantStateChange(network, previousWorldStates, currentWorldStates) {
  return network.relevantStateIds.some(
    (stateId) => previousWorldStates[stateId] !== currentWorldStates[stateId]
  );
}

function advanceTown({
  baseline,
  network,
  priorTown,
  worldStates,
  phase,
  evaluationIndex,
  maxSteps: requestedMaxSteps = null
}) {
  let state = {
    ...priorTown,
    path: [...priorTown.path],
    transitions: [...priorTown.transitions]
  };
  let activeTown = baseline.townById[state.activeTownId];
  const visitedThisCascade = new Set([activeTown.id]);
  const transitions = [];
  const diagnostics = [];
  if (
    requestedMaxSteps !== null &&
    (!Number.isInteger(requestedMaxSteps) || requestedMaxSteps < 1)
  ) {
    throw new TypeError("Town progression maxSteps must be a positive integer when supplied.");
  }
  const maxSteps = requestedMaxSteps ?? Math.max(32, 2 * network.reachableTownIds.length);
  let stepCount = 0;
  let stopped = false;

  while (stepCount < maxSteps) {
    const eligible = selectEligibleTargets(baseline, activeTown, worldStates);
    if (eligible.length === 0) {
      stopped = true;
      break;
    }

    const selected = eligible[0];
    if (eligible.length > 1) {
      diagnostics.push(
        diagnostic(
          "warning",
          "town_override_ambiguity",
          `Town '${activeTown.id}' has multiple eligible overrides; condition weight and declared order selected '${selected.targetId}'.`,
          {
            baseTownId: network.baseTownId,
            townId: activeTown.id,
            evaluationIndex,
            eligibleOverrideIds: eligible.map((candidate) => candidate.targetId),
            selectedOverrideId: selected.targetId
          }
        )
      );
      state.ambiguous = true;
    }

    if (selected.targetId === activeTown.id || visitedThisCascade.has(selected.targetId)) {
      const cyclePath = [...visitedThisCascade, selected.targetId];
      diagnostics.push(
        diagnostic(
          "warning",
          "town_override_cycle",
          selected.targetId === activeTown.id
            ? `Town override resolution for '${network.baseTownId}' selected a stable self-reference at '${selected.targetId}'.`
            : `Town override resolution for '${network.baseTownId}' stopped before repeating '${selected.targetId}' in one evaluation cascade.`,
          {
            baseTownId: network.baseTownId,
            townId: activeTown.id,
            targetId: selected.targetId,
            evaluationIndex,
            path: cyclePath
          }
        )
      );
      state.cycle = true;
      stopped = true;
      break;
    }

    const transition = {
      sequence: state.transitions.length + 1,
      phase,
      evaluationIndex,
      baseTownId: network.baseTownId,
      sourceTownId: activeTown.id,
      targetTownId: selected.targetId,
      conditionCount: selected.conditionCount,
      referencePosition: selected.referencePosition
    };
    transitions.push(transition);
    state.transitions.push(transition);
    state.path = updateLineage(state.path, selected.targetId);
    activeTown = selected.target;
    visitedThisCascade.add(activeTown.id);
    state = {
      ...state,
      name: activeTown.name,
      owner: activeTown.owner,
      ownerId: activeTown.ownerId,
      nodeId: activeTown.id,
      activeTownId: activeTown.id
    };
    stepCount += 1;
  }

  if (!stopped && stepCount >= maxSteps) {
    const remaining = selectEligibleTargets(baseline, activeTown, worldStates);
    if (remaining.length > 0) {
      diagnostics.push(
        diagnostic(
          "warning",
          "town_override_pass_limit",
          `Town override resolution for '${network.baseTownId}' reached its step limit.`,
          { baseTownId: network.baseTownId, evaluationIndex, maxSteps }
        )
      );
      state.cycle = true;
    }
  }

  return { town: state, transitions, diagnostics };
}

/**
 * Evaluates all map-linked towns from their canonical base nodes against baseline truth.
 */
export function initializeTownProgression(
  baseline,
  index,
  worldStates,
  { evaluationIndex = 0, maxSteps = null } = {}
) {
  const towns = {};
  const transitions = [];
  const diagnostics = [];

  for (const baseTownId of baseline.mapTownIds) {
    const baseTown = baseline.townById[baseTownId];
    const result = advanceTown({
      baseline,
      network: index.byBaseTownId[baseTownId],
      priorTown: createBaseTownState(baseTown),
      worldStates,
      phase: "initialization",
      evaluationIndex,
      maxSteps
    });
    towns[baseTownId] = result.town;
    transitions.push(...result.transitions);
    diagnostics.push(...result.diagnostics);
  }

  return deepFreeze({
    progression: { towns: stableObject(Object.entries(towns)), diagnostics },
    transitions
  });
}

/**
 * Advances only networks whose referenced world-state truth changed since the prior command.
 */
export function advanceTownProgression(
  baseline,
  index,
  priorProgression,
  previousWorldStates,
  currentWorldStates,
  { evaluationIndex, maxSteps = null } = {}
) {
  const towns = {};
  const transitions = [];
  const diagnostics = [...priorProgression.diagnostics];

  for (const baseTownId of baseline.mapTownIds) {
    const network = index.byBaseTownId[baseTownId];
    const priorTown = priorProgression.towns[baseTownId];
    if (!hasRelevantStateChange(network, previousWorldStates, currentWorldStates)) {
      towns[baseTownId] = priorTown;
      continue;
    }

    const result = advanceTown({
      baseline,
      network,
      priorTown,
      worldStates: currentWorldStates,
      phase: "command",
      evaluationIndex,
      maxSteps
    });
    towns[baseTownId] = result.town;
    transitions.push(...result.transitions);
    diagnostics.push(...result.diagnostics);
  }

  return deepFreeze({
    progression: { towns: stableObject(Object.entries(towns)), diagnostics },
    transitions
  });
}

export function describeTownTransition(baseline, transition) {
  const baseTown = baseline.townById[transition.baseTownId];
  const sourceTown = baseline.townById[transition.sourceTownId];
  const targetTown = baseline.townById[transition.targetTownId];

  if (transition.targetTownId === transition.baseTownId) {
    return `[${targetTown.owner}] has restored standard administration in ${baseTown.name}.`;
  }
  if (sourceTown.owner !== targetTown.owner) {
    if (sourceTown.owner === "Unknown") {
      return `[${targetTown.owner}] has restored control of ${baseTown.name} (${targetTown.name}).`;
    }
    if (targetTown.owner === "Unknown") {
      return `[${sourceTown.owner}] has abandoned ${baseTown.name}.`;
    }
    return `[${sourceTown.owner}] has lost control of ${baseTown.name}. It has been taken over by [${targetTown.owner}].`;
  }
  if (sourceTown.name !== targetTown.name) {
    const variantName = targetTown.name.replace("(override)", "").replace(/\s\s+/g, " ").trim();
    return `Political shift in ${baseTown.name}: Control has transferred to [${variantName}] under [${targetTown.owner}].`;
  }
  return `Internal reorganization detected in ${baseTown.name} under [${targetTown.owner}].`;
}

export function createTownTransitionNarrative(baseline, transitions) {
  return transitions.map((transition) => describeTownTransition(baseline, transition));
}
