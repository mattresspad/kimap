import { ScenarioError } from "./errors.js";
import { asInteger, asNonEmptyString, asTimestamp, deepFreeze, isRecord } from "./utils.js";

export const SCENARIO_SCHEMA_VERSION = 1;
export const CHARACTER_STATUSES = Object.freeze([0, 1, 2]);
export const COMMAND_TYPES = Object.freeze({
  SET_CHARACTER_STATUS: "SetCharacterStatus",
  SET_FACTION_RELATION: "SetFactionRelation"
});

let fallbackCommandSequence = 0;

export function createCommandId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  fallbackCommandSequence += 1;
  return `scenario-${Date.now().toString(36)}-${fallbackCommandSequence.toString(36)}`;
}

export function createScenarioCommand(type, payload, options = {}) {
  return {
    id: options.id ?? createCommandId(),
    type,
    payload: {
      ...payload,
      playerInvolved: payload?.playerInvolved === undefined ? true : payload.playerInvolved
    },
    occurredAt: options.occurredAt ?? new Date().toISOString()
  };
}

export function normalizeScenarioCommand(rawCommand, baseline) {
  if (!isRecord(rawCommand)) {
    throw new ScenarioError("invalid_scenario_command", "Scenario command must be an object.");
  }
  const id = asNonEmptyString(rawCommand.id, "command.id", "invalid_scenario_command");
  const type = asNonEmptyString(rawCommand.type, "command.type", "invalid_scenario_command");
  const occurredAt = asTimestamp(
    rawCommand.occurredAt,
    "command.occurredAt",
    "invalid_scenario_command"
  );
  if (!isRecord(rawCommand.payload)) {
    throw new ScenarioError(
      "invalid_scenario_command",
      `Command '${id}' payload must be an object.`,
      { commandId: id }
    );
  }
  const playerInvolved =
    rawCommand.payload.playerInvolved === undefined ? true : rawCommand.payload.playerInvolved;
  if (typeof playerInvolved !== "boolean") {
    throw new ScenarioError(
      "invalid_scenario_command",
      `Command '${id}' playerInvolved must be a boolean.`,
      { commandId: id }
    );
  }

  if (type === COMMAND_TYPES.SET_CHARACTER_STATUS) {
    const characterId = asNonEmptyString(
      rawCommand.payload.characterId,
      "payload.characterId",
      "invalid_scenario_command"
    );
    if (!baseline.characterById[characterId]) {
      throw new ScenarioError(
        "unknown_scenario_entity",
        `Command '${id}' references unknown character '${characterId}'.`,
        { commandId: id, characterId }
      );
    }
    const status = asInteger(
      rawCommand.payload.status,
      "payload.status",
      0,
      2,
      "invalid_scenario_command"
    );
    return deepFreeze({
      id,
      type,
      payload: { characterId, status, playerInvolved },
      occurredAt
    });
  }

  if (type === COMMAND_TYPES.SET_FACTION_RELATION) {
    const factionId = asNonEmptyString(
      rawCommand.payload.factionId,
      "payload.factionId",
      "invalid_scenario_command"
    );
    if (!baseline.factionById[factionId]) {
      throw new ScenarioError(
        "unknown_scenario_entity",
        `Command '${id}' references unknown faction '${factionId}'.`,
        { commandId: id, factionId }
      );
    }
    const value = asInteger(
      rawCommand.payload.value,
      "payload.value",
      -100,
      100,
      "invalid_scenario_command"
    );
    return deepFreeze({
      id,
      type,
      payload: { factionId, value, playerInvolved },
      occurredAt
    });
  }

  throw new ScenarioError("unknown_scenario_command", `Unknown scenario command type '${type}'.`, {
    commandId: id,
    type
  });
}
