export class SelectionError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "SelectionError";
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}
