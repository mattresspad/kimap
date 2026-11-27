import { ScenarioError } from "./errors.js";

const ALLY_THRESHOLD = 60;
const BASELINE_STATE_CACHE = new WeakMap();

function evaluateCondition(condition, context) {
  const { baseline, characters, characterProvenance, relations, relationProvenance } = context;

  if (condition.category === "NPC is" || condition.category === "NPC is NOT") {
    const current = characters[condition.entityId];
    const matches =
      condition.category === "NPC is" ? current === condition.value : current !== condition.value;
    return { matches, provenance: characterProvenance[condition.entityId] === true };
  }

  if (condition.category === "player ally" || condition.category === "player enemy") {
    const relation = relations[condition.entityId];
    const faction = baseline.factionById[condition.entityId];
    const predicate =
      condition.category === "player ally"
        ? relation >= ALLY_THRESHOLD
        : relation <= faction.enemyThreshold;
    return {
      matches: predicate === (condition.value === 1),
      provenance: relationProvenance[condition.entityId] === true
    };
  }

  if (condition.category === "world state") {
    return {
      matches: context.priorStates[condition.entityId] === condition.value,
      provenance: context.priorProvenance[condition.entityId] === true
    };
  }

  throw new ScenarioError(
    "unsupported_condition_category",
    `Unsupported normalized condition '${condition.category}'.`,
    { category: condition.category }
  );
}

function vectorKey(ids, states, provenance) {
  return ids
    .map((id) => `${states[id] === 1 ? "1" : "0"}${provenance[id] === true ? "p" : "n"}`)
    .join("");
}

function selectCausalEvaluations(state, evaluations, baseline, characters) {
  const changedCharacterEvaluations = evaluations.filter((_evaluation, index) => {
    const condition = state.conditions[index];
    if (condition.category !== "NPC is" && condition.category !== "NPC is NOT") return false;
    return (
      characters[condition.entityId] !== baseline.characterById[condition.entityId].initialStatus
    );
  });
  return changedCharacterEvaluations.length > 0 ? changedCharacterEvaluations : evaluations;
}

function solveStateVector(
  baseline,
  { characters, characterProvenance, relations, relationProvenance },
  { baselineStates = null, ignorePlayerInvolvement = false } = {}
) {
  const stateIds = baseline.worldStates.map((state) => state.id);
  let priorStates = Object.fromEntries(stateIds.map((id) => [id, 0]));
  let priorProvenance = Object.fromEntries(stateIds.map((id) => [id, false]));
  const seenVectors = new Set([vectorKey(stateIds, priorStates, priorProvenance)]);
  const passLimit = Math.max(32, 2 * stateIds.length);

  for (let pass = 1; pass <= passLimit; pass += 1) {
    const nextStates = {};
    const nextProvenance = {};

    for (const state of baseline.worldStates) {
      if (!state.active) {
        nextStates[state.id] = 0;
        nextProvenance[state.id] = false;
        continue;
      }

      const evaluations = state.conditions.map((condition) =>
        evaluateCondition(condition, {
          baseline,
          characters,
          characterProvenance,
          relations,
          relationProvenance,
          priorStates,
          priorProvenance
        })
      );
      const ordinaryConditionsMet = evaluations.every((result) => result.matches);
      const causalEvaluations = selectCausalEvaluations(state, evaluations, baseline, characters);
      const trueProvenance = causalEvaluations.some(
        (result) => result.matches && result.provenance
      );
      const falseProvenance = causalEvaluations.some(
        (result) => !result.matches && result.provenance
      );
      const involvementSatisfied =
        ignorePlayerInvolvement ||
        !state.playerInvolvementRequired ||
        baselineStates?.[state.id] === 1 ||
        trueProvenance;
      const resolvedTrue = ordinaryConditionsMet && involvementSatisfied;

      nextStates[state.id] = resolvedTrue ? 1 : 0;
      nextProvenance[state.id] = resolvedTrue
        ? trueProvenance
        : ordinaryConditionsMet
          ? false
          : falseProvenance;
    }

    const priorKey = vectorKey(stateIds, priorStates, priorProvenance);
    const nextKey = vectorKey(stateIds, nextStates, nextProvenance);
    if (nextKey === priorKey) {
      return {
        states: nextStates,
        provenance: nextProvenance,
        passes: pass,
        passLimit
      };
    }

    if (seenVectors.has(nextKey)) {
      throw new ScenarioError(
        "world_state_nonconvergence",
        "World-state evaluation entered a repeated state vector.",
        { pass, passLimit, repeatedVector: nextKey }
      );
    }

    seenVectors.add(nextKey);
    priorStates = nextStates;
    priorProvenance = nextProvenance;
  }

  throw new ScenarioError(
    "world_state_pass_limit",
    `World-state evaluation did not settle within ${String(passLimit)} passes.`,
    { passLimit, worldStateCount: stateIds.length }
  );
}

function initialConditionContext(baseline) {
  return {
    characters: Object.fromEntries(
      baseline.characters.map((character) => [character.id, character.initialStatus])
    ),
    characterProvenance: Object.fromEntries(
      baseline.characters.map((character) => [character.id, false])
    ),
    relations: { ...baseline.initialRelations },
    relationProvenance: Object.fromEntries(baseline.factions.map((faction) => [faction.id, false]))
  };
}

function getBaselineStates(baseline) {
  const cached = BASELINE_STATE_CACHE.get(baseline);
  if (cached) return cached;

  const solved = solveStateVector(baseline, initialConditionContext(baseline), {
    ignorePlayerInvolvement: true
  });
  const baselineStates = Object.freeze({ ...solved.states });
  BASELINE_STATE_CACHE.set(baseline, baselineStates);
  return baselineStates;
}

export function solveWorldStates(
  baseline,
  { characters, characterProvenance, relations, relationProvenance }
) {
  return solveStateVector(
    baseline,
    { characters, characterProvenance, relations, relationProvenance },
    { baselineStates: getBaselineStates(baseline) }
  );
}
