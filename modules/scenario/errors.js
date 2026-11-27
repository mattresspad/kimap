export class ScenarioError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "ScenarioError";
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}

export function scenarioInvariant(condition, code, message, context = {}) {
  if (!condition) {
    throw new ScenarioError(code, message, context);
  }
}
