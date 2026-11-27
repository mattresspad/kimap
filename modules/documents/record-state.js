import { deepFreeze } from "./codecs.js";
import { KimapDocumentError } from "./errors.js";

export class DocumentRecordState {
  #type;
  #record = null;
  #dirty = false;

  constructor(type) {
    if (typeof type !== "string" || type.length === 0) {
      throw new KimapDocumentError("invalid_document_record", "A document type is required.");
    }
    this.#type = type;
  }

  attach(record) {
    if (!record || typeof record !== "object" || typeof record.id !== "string") {
      throw new KimapDocumentError(
        "invalid_document_record",
        "A stored document record is required."
      );
    }
    if (record.type !== this.#type) {
      throw new KimapDocumentError(
        "invalid_document_record",
        `Expected stored document type '${this.#type}'.`
      );
    }
    if (!Number.isInteger(record.revision) || record.revision < 1) {
      throw new KimapDocumentError(
        "invalid_document_record",
        "A stored document revision must be a positive integer."
      );
    }
    this.#record = deepFreeze(structuredClone(record));
    this.#dirty = false;
    return this.getSnapshot();
  }

  clear({ dirty = true } = {}) {
    this.#record = null;
    this.#dirty = dirty;
    return this.getSnapshot();
  }

  markDirty() {
    this.#dirty = true;
    return this.getSnapshot();
  }

  markSaved(record) {
    return this.attach(record);
  }

  getSnapshot() {
    return deepFreeze({
      type: this.#type,
      id: this.#record?.id ?? null,
      revision: this.#record?.revision ?? null,
      name: this.#record?.name ?? null,
      dirty: this.#dirty
    });
  }
}
