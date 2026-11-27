export class KimapDocumentError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "KimapDocumentError";
    this.code = code;
    this.context = context;
  }
}
