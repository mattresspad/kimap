import {
  COMMAND_TYPES,
  SCENARIO_SCHEMA_VERSION,
  normalizeScenarioCommand
} from "../modules/scenario/commands.js";
import { ScenarioError } from "../modules/scenario/errors.js";
import {
  calculatePowerStatistics,
  deriveWorldSnapshot,
  generateWorldNarrative
} from "../modules/scenario/selectors.js";
import { solveWorldStates } from "../modules/scenario/solver.js";
import {
  advanceTownProgression,
  createTownTransitionNarrative,
  getTownProgressionIndex,
  initializeTownProgression
} from "../modules/scenario/town-progression.js";
import {
  asTimestamp,
  cloneData,
  deepFreeze,
  isRecord,
  stableObject
} from "../modules/scenario/utils.js";

const SESSION_INTERNALS = new WeakMap();
const STATUS_NAMES = Object.freeze({ 0: "Dead", 1: "Alive", 2: "Imprisoned" });
const ALLY_THRESHOLD = 60;

function initialMutableState(baseline) {
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

function selectWorld(baseline, mutable, solved, townProgression) {
  const world = deriveWorldSnapshot(baseline, {
    worldStates: solved.states,
    characters: mutable.characters,
    townProgression
  });
  return { solved, world };
}

function createTimelineEvent({
  id,
  commandId = null,
  occurredAt = null,
  type,
  message,
  townTransition = null
}) {
  return {
    id,
    commandId,
    occurredAt,
    type,
    message,
    ...(townTransition ? { townTransition } : {})
  };
}

function thresholdConsequences(baseline, factionId, from, to) {
  const faction = baseline.factionById[factionId];
  const messages = [];
  const wasAlly = from >= ALLY_THRESHOLD;
  const isAlly = to >= ALLY_THRESHOLD;
  const wasEnemy = from <= faction.enemyThreshold;
  const isEnemy = to <= faction.enemyThreshold;

  if (!wasAlly && isAlly) messages.push(`You are now an ally of ${faction.name}.`);
  if (wasAlly && !isAlly) messages.push(`You are no longer an ally of ${faction.name}.`);
  if (!wasEnemy && isEnemy) messages.push(`You are now an enemy of ${faction.name}.`);
  if (wasEnemy && !isEnemy) messages.push(`You are no longer an enemy of ${faction.name}.`);
  return messages;
}

function isExactNoOp(state, command) {
  if (command.type === COMMAND_TYPES.SET_CHARACTER_STATUS) {
    const { characterId, status, playerInvolved } = command.payload;
    return (
      state.characters[characterId] === status &&
      state.characterProvenance[characterId] === playerInvolved
    );
  }

  const { factionId, value, playerInvolved } = command.payload;
  return (
    state.relations[factionId] === value && state.relationProvenance[factionId] === playerInvolved
  );
}

function rejectNoChange(command) {
  const identityKey =
    command.type === COMMAND_TYPES.SET_CHARACTER_STATUS ? "characterId" : "factionId";
  throw new ScenarioError("scenario_no_change", "The command would not change the scenario.", {
    commandId: command.id,
    [identityKey]: command.payload[identityKey]
  });
}

function applyCommand(mutable, baseline, command, { retainNoOp = false } = {}) {
  const playerInvolved = command.payload.playerInvolved;

  if (command.type === COMMAND_TYPES.SET_CHARACTER_STATUS) {
    const { characterId, status } = command.payload;
    const from = mutable.characters[characterId];
    const fromPlayerInvolved = mutable.characterProvenance[characterId];
    if (from === 0 && status !== 0) {
      throw new ScenarioError(
        "character_death_is_permanent",
        `Character '${characterId}' cannot change after death.`,
        { commandId: command.id, characterId, from, to: status }
      );
    }
    const character = baseline.characterById[characterId];
    if (from === status && fromPlayerInvolved === playerInvolved) {
      if (!retainNoOp) rejectNoChange(command);
      return {
        noOp: true,
        entityId: characterId,
        from,
        to: status,
        fromPlayerInvolved,
        toPlayerInvolved: playerInvolved,
        summary: `Retained command made no change: ${character.name} was already ${STATUS_NAMES[status]} with player involvement ${playerInvolved ? "enabled" : "disabled"}.`,
        consequences: []
      };
    }

    mutable.characters[characterId] = status;
    mutable.characterProvenance[characterId] = playerInvolved;
    return {
      noOp: false,
      entityId: characterId,
      from,
      to: status,
      fromPlayerInvolved,
      toPlayerInvolved: playerInvolved,
      summary:
        from === status
          ? `${character.name}'s player involvement was changed.`
          : `${character.name}'s status changed from ${STATUS_NAMES[from]} to ${STATUS_NAMES[status]}.`,
      consequences: []
    };
  }

  const { factionId, value } = command.payload;
  const from = mutable.relations[factionId];
  const fromPlayerInvolved = mutable.relationProvenance[factionId];
  const faction = baseline.factionById[factionId];
  if (from === value && fromPlayerInvolved === playerInvolved) {
    if (!retainNoOp) rejectNoChange(command);
    return {
      noOp: true,
      entityId: factionId,
      from,
      to: value,
      fromPlayerInvolved,
      toPlayerInvolved: playerInvolved,
      summary: `Retained command made no change: your relation with ${faction.name} was already ${String(value)} with player involvement ${playerInvolved ? "enabled" : "disabled"}.`,
      consequences: []
    };
  }

  mutable.relations[factionId] = value;
  mutable.relationProvenance[factionId] = playerInvolved;
  return {
    noOp: false,
    entityId: factionId,
    from,
    to: value,
    fromPlayerInvolved,
    toPlayerInvolved: playerInvolved,
    summary:
      from === value
        ? `${faction.name}'s player involvement was changed.`
        : `Your relation with ${faction.name} changed from ${String(from)} to ${String(value)}.`,
    consequences: thresholdConsequences(baseline, factionId, from, value)
  };
}

export function replayScenario(baseline, rawCommands = [], { scenarioCreatedAt = null } = {}) {
  if (!Array.isArray(rawCommands)) {
    throw new ScenarioError("invalid_scenario_document", "Scenario commands must be an array.");
  }
  const initializationOccurredAt =
    scenarioCreatedAt === null
      ? null
      : asTimestamp(scenarioCreatedAt, "scenarioCreatedAt", "invalid_scenario_document");

  const commands = [];
  const commandIds = new Set();
  for (const rawCommand of rawCommands) {
    const command = normalizeScenarioCommand(rawCommand, baseline);
    if (commandIds.has(command.id)) {
      throw new ScenarioError(
        "duplicate_scenario_command",
        `Scenario command id '${command.id}' is duplicated.`,
        { commandId: command.id }
      );
    }
    commandIds.add(command.id);
    commands.push(command);
  }

  const mutable = initialMutableState(baseline);
  const townIndex = getTownProgressionIndex(baseline);
  const baselineSolved = solveWorldStates(baseline, mutable);
  const initializedTowns = initializeTownProgression(baseline, townIndex, baselineSolved.states);
  let townProgression = initializedTowns.progression;
  const baselineResult = selectWorld(baseline, mutable, baselineSolved, townProgression);
  let currentResult = baselineResult;
  const journal = [];
  const initializationNarrative = createTownTransitionNarrative(
    baseline,
    initializedTowns.transitions
  );
  const timeline = initializedTowns.transitions.map((transition, index) =>
    createTimelineEvent({
      id: `initialization:${transition.baseTownId}:${String(transition.sequence)}`,
      occurredAt: initializationOccurredAt,
      type: "town-transition",
      message: initializationNarrative[index],
      townTransition: transition
    })
  );

  for (const [commandIndex, command] of commands.entries()) {
    const primary = applyCommand(mutable, baseline, command, { retainNoOp: true });
    const nextSolved = solveWorldStates(baseline, mutable);
    const advancedTowns = advanceTownProgression(
      baseline,
      townIndex,
      townProgression,
      currentResult.solved.states,
      nextSolved.states,
      { evaluationIndex: commandIndex + 1 }
    );
    townProgression = advancedTowns.progression;
    const nextWorld = deriveWorldSnapshot(baseline, {
      worldStates: nextSolved.states,
      characters: mutable.characters,
      townProgression
    });
    const nextResult = { solved: nextSolved, world: nextWorld };
    const townNarrative = createTownTransitionNarrative(baseline, advancedTowns.transitions);
    const consequences = [
      ...primary.consequences,
      ...generateWorldNarrative(currentResult.world, nextResult.world, townNarrative)
    ];
    const journalEntry = {
      id: command.id,
      type: command.type,
      occurredAt: command.occurredAt,
      command,
      entityId: primary.entityId,
      from: primary.from,
      to: primary.to,
      fromPlayerInvolved: primary.fromPlayerInvolved,
      toPlayerInvolved: primary.toPlayerInvolved,
      noOp: primary.noOp,
      summary: primary.summary,
      consequences,
      townTransitions: advancedTowns.transitions
    };
    journal.push(journalEntry);
    timeline.push(
      createTimelineEvent({
        id: `${command.id}:0`,
        commandId: command.id,
        occurredAt: command.occurredAt,
        type: "command-summary",
        message: primary.summary
      })
    );
    consequences.forEach((message, consequenceIndex) => {
      const townTransitionIndex = consequenceIndex - primary.consequences.length;
      const townTransition = advancedTowns.transitions[townTransitionIndex] ?? null;
      timeline.push(
        createTimelineEvent({
          id: `${command.id}:${String(consequenceIndex + 1)}`,
          commandId: command.id,
          occurredAt: command.occurredAt,
          type: townTransition ? "town-transition" : "command-consequence",
          message,
          townTransition
        })
      );
    });
    currentResult = nextResult;
  }

  const diagnostics = [...baseline.diagnostics, ...currentResult.world.diagnostics];
  const snapshot = deepFreeze({
    baseline: {
      contractVersion: baseline.contractVersion,
      manifestId: baseline.manifestId,
      key: baseline.key
    },
    commandCount: commands.length,
    characters: stableObject(Object.entries(mutable.characters)),
    characterProvenance: stableObject(Object.entries(mutable.characterProvenance)),
    relations: stableObject(Object.entries(mutable.relations)),
    relationProvenance: stableObject(Object.entries(mutable.relationProvenance)),
    worldStates: stableObject(Object.entries(currentResult.solved.states)),
    worldStateProvenance: stableObject(Object.entries(currentResult.solved.provenance)),
    solver: {
      passes: currentResult.solved.passes,
      passLimit: currentResult.solved.passLimit
    },
    world: {
      towns: currentResult.world.towns,
      spawns: currentResult.world.spawns
    },
    baselineWorld: {
      towns: baselineResult.world.towns,
      spawns: baselineResult.world.spawns
    },
    powerStatistics: calculatePowerStatistics(currentResult.world, baselineResult.world),
    narrative: [
      ...initializationNarrative,
      ...journal.flatMap((entry) => [entry.summary, ...entry.consequences])
    ],
    diagnostics
  });

  return deepFreeze({ commands, snapshot, journal, timeline });
}

function validateEnvelopeBaseline(envelopeBaseline, baseline) {
  if (!isRecord(envelopeBaseline)) {
    throw new ScenarioError(
      "invalid_scenario_envelope",
      "Scenario envelope baseline must be an object."
    );
  }
  if (
    envelopeBaseline.contractVersion !== baseline.contractVersion ||
    envelopeBaseline.manifestId !== baseline.manifestId ||
    envelopeBaseline.key !== baseline.key
  ) {
    throw new ScenarioError(
      "scenario_baseline_mismatch",
      "The saved scenario belongs to a different manifest baseline.",
      {
        expected: {
          contractVersion: baseline.contractVersion,
          manifestId: baseline.manifestId,
          key: baseline.key
        },
        actual: cloneData(envelopeBaseline)
      }
    );
  }
}

export function parseScenarioEnvelope(baseline, envelope) {
  if (
    !isRecord(envelope) ||
    envelope.documentType !== "scenario" ||
    envelope.schemaVersion !== SCENARIO_SCHEMA_VERSION
  ) {
    throw new ScenarioError(
      "invalid_scenario_envelope",
      `Scenario documents require documentType 'scenario' and schemaVersion ${String(SCENARIO_SCHEMA_VERSION)}.`
    );
  }
  validateEnvelopeBaseline(envelope.baseline, baseline);
  const createdAt = asTimestamp(
    envelope.createdAt,
    "envelope.createdAt",
    "invalid_scenario_envelope"
  );
  const updatedAt = asTimestamp(
    envelope.updatedAt,
    "envelope.updatedAt",
    "invalid_scenario_envelope"
  );
  const replayed = replayScenario(baseline, envelope.commands, { scenarioCreatedAt: createdAt });
  return deepFreeze({ createdAt, updatedAt, commands: replayed.commands });
}

function notify(session, type) {
  const internal = SESSION_INTERNALS.get(session);
  const change = deepFreeze({
    type,
    snapshot: internal.result.snapshot,
    journal: internal.result.journal,
    timeline: internal.result.timeline,
    canUndo: internal.commands.length > 0,
    canRedo: internal.redo.length > 0
  });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (error) {
      void error;
    }
  }
  return change;
}

export class ScenarioSession {
  constructor(baseline, document = null) {
    const now = new Date().toISOString();
    const parsed =
      document === null
        ? { commands: [], createdAt: now, updatedAt: now }
        : parseScenarioEnvelope(baseline, document);
    const result = replayScenario(baseline, parsed.commands, {
      scenarioCreatedAt: parsed.createdAt
    });
    SESSION_INTERNALS.set(this, {
      baseline,
      commands: [...result.commands],
      redo: [],
      result,
      subscribers: new Set(),
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt
    });
  }

  dispatch(rawCommand) {
    const internal = SESSION_INTERNALS.get(this);
    const command = normalizeScenarioCommand(rawCommand, internal.baseline);
    if (internal.commands.some((existing) => existing.id === command.id)) {
      throw new ScenarioError(
        "duplicate_scenario_command",
        `Scenario command id '${command.id}' is duplicated.`,
        { commandId: command.id }
      );
    }
    if (isExactNoOp(internal.result.snapshot, command)) rejectNoChange(command);

    const commands = [...internal.commands, command];
    const result = replayScenario(internal.baseline, commands, {
      scenarioCreatedAt: internal.createdAt
    });
    internal.commands = [...result.commands];
    internal.redo = [];
    internal.result = result;
    internal.updatedAt = new Date().toISOString();
    return notify(this, "dispatch");
  }

  undo() {
    const internal = SESSION_INTERNALS.get(this);
    if (internal.commands.length === 0) return false;

    const commands = [...internal.commands];
    const undone = commands.pop();
    const result = replayScenario(internal.baseline, commands, {
      scenarioCreatedAt: internal.createdAt
    });
    internal.commands = commands;
    internal.redo.push(undone);
    internal.result = result;
    internal.updatedAt = new Date().toISOString();
    return notify(this, "undo");
  }

  redo() {
    const internal = SESSION_INTERNALS.get(this);
    if (internal.redo.length === 0) return false;

    const redo = [...internal.redo];
    const command = redo.pop();
    const commands = [...internal.commands, command];
    const result = replayScenario(internal.baseline, commands, {
      scenarioCreatedAt: internal.createdAt
    });
    internal.commands = commands;
    internal.redo = redo;
    internal.result = result;
    internal.updatedAt = new Date().toISOString();
    return notify(this, "redo");
  }

  replaceDocument(document) {
    const internal = SESSION_INTERNALS.get(this);
    const parsed = parseScenarioEnvelope(internal.baseline, document);
    const result = replayScenario(internal.baseline, parsed.commands, {
      scenarioCreatedAt: parsed.createdAt
    });
    internal.commands = [...result.commands];
    internal.redo = [];
    internal.result = result;
    internal.createdAt = parsed.createdAt;
    internal.updatedAt = parsed.updatedAt;
    return notify(this, "replaceDocument");
  }

  getSnapshot() {
    return SESSION_INTERNALS.get(this).result.snapshot;
  }

  getJournal() {
    return SESSION_INTERNALS.get(this).result.journal;
  }

  getTimeline() {
    return SESSION_INTERNALS.get(this).result.timeline;
  }

  canUndo() {
    return SESSION_INTERNALS.get(this).commands.length > 0;
  }

  canRedo() {
    return SESSION_INTERNALS.get(this).redo.length > 0;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") {
      throw new ScenarioError(
        "invalid_scenario_subscriber",
        "Scenario subscriber must be a function."
      );
    }
    const subscribers = SESSION_INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}

export function serializeScenarioEnvelope(sessionOrBaseline, rawCommands, metadata = {}) {
  let baseline = sessionOrBaseline;
  let commands = rawCommands;
  let createdAt = metadata.createdAt;
  let updatedAt = metadata.updatedAt;

  if (SESSION_INTERNALS.has(sessionOrBaseline)) {
    const internal = SESSION_INTERNALS.get(sessionOrBaseline);
    baseline = internal.baseline;
    commands = internal.commands;
    createdAt = internal.createdAt;
    updatedAt = internal.updatedAt;
  }

  const now = new Date().toISOString();
  const normalizedCreatedAt = asTimestamp(
    createdAt ?? now,
    "envelope.createdAt",
    "invalid_scenario_envelope"
  );
  const normalizedUpdatedAt = asTimestamp(
    updatedAt ?? now,
    "envelope.updatedAt",
    "invalid_scenario_envelope"
  );
  const replayed = replayScenario(baseline, commands ?? [], {
    scenarioCreatedAt: normalizedCreatedAt
  });
  return deepFreeze({
    documentType: "scenario",
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    baseline: {
      contractVersion: baseline.contractVersion,
      manifestId: baseline.manifestId,
      key: baseline.key
    },
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
    commands: replayed.commands.map(cloneData)
  });
}

export function createScenarioAdapters(session) {
  const internal = SESSION_INTERNALS.get(session);
  if (!internal) {
    throw new ScenarioError("invalid_scenario_session", "A ScenarioSession is required.");
  }
  const baseline = internal.baseline;

  const relationAdapter = Object.freeze({
    getFaction(factionId) {
      return baseline.factionById[factionId]?.raw;
    },
    getAllFactions() {
      return baseline.factions.map((faction) => faction.raw);
    },
    getRelation(factionId) {
      return session.getSnapshot().relations[factionId] ?? 0;
    },
    isAlly(factionId) {
      return this.getRelation(factionId) >= ALLY_THRESHOLD;
    },
    isEnemy(factionId) {
      const faction = baseline.factionById[factionId];
      return faction ? this.getRelation(factionId) <= faction.enemyThreshold : false;
    }
  });

  const characterAdapter = Object.freeze({
    getCharacter(characterId) {
      const character = baseline.characterById[characterId];
      if (!character) return undefined;
      return deepFreeze({
        ...(character.raw ?? {}),
        Name: character.name,
        StringId: character.id,
        name: character.name,
        stringId: character.id,
        status: session.getSnapshot().characters[characterId]
      });
    },
    getAllCharacters() {
      return baseline.characters
        .map((character) => this.getCharacter(character.id))
        .sort((left, right) => left.Name.localeCompare(right.Name));
    }
  });

  const worldStateData = deepFreeze(baseline.worldStates.map((state) => state.raw));
  const worldStateAdapter = Object.freeze({
    worldStateData,
    getState(stateId) {
      return session.getSnapshot().worldStates[stateId] ?? 0;
    }
  });

  const historyAdapter = Object.freeze({
    getHistory() {
      return session.getJournal();
    },
    getTimeline() {
      return session.getTimeline();
    },
    canUndo() {
      return session.canUndo();
    },
    canRedo() {
      return session.canRedo();
    }
  });

  return Object.freeze({
    relationsStore: relationAdapter,
    characterStore: characterAdapter,
    worldStateStore: worldStateAdapter,
    historyStore: historyAdapter
  });
}
