import { ScenarioError } from "./errors.js";

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!isRecord(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;

  seen.add(value);
  for (const entry of Object.values(value)) deepFreeze(entry, seen);
  return Object.freeze(value);
}

export function asNonEmptyString(value, label, code = "invalid_scenario_data") {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ScenarioError(code, `${label} must be a non-empty string.`);
  }

  return value;
}

export function asInteger(value, label, minimum, maximum, code = "invalid_scenario_data") {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ScenarioError(
      code,
      `${label} must be an integer from ${String(minimum)} through ${String(maximum)}.`
    );
  }

  return value;
}

export function asTimestamp(value, label, code = "invalid_scenario_document") {
  if (typeof value !== "string" || value.trim() === "" || Number.isNaN(Date.parse(value))) {
    throw new ScenarioError(code, `${label} must be a valid timestamp.`);
  }

  return value;
}

export function stableObject(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

export function diagnostic(level, code, message, context = {}) {
  return deepFreeze({ level, code, message, context: { ...context } });
}
