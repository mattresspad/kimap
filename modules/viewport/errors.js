export class ViewportError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "ViewportError";
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}
