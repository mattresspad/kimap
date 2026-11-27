import { DOCUMENT_TYPES, isRecord } from "./codecs.js";
import { KimapDocumentError } from "./errors.js";

const TYPES = new Set(Object.values(DOCUMENT_TYPES));
const DOCUMENT_ID = /^[0-9a-f]{32}$/;

function validateDocumentId(value) {
  if (typeof value !== "string" || !DOCUMENT_ID.test(value)) {
    throw new KimapDocumentError("invalid_document_record", "A valid document id is required.");
  }
  return value;
}

function apiError(data, fallback) {
  if (isRecord(data?.error)) {
    return new KimapDocumentError(
      String(data.error.code ?? "caravan_document_error"),
      String(data.error.info ?? fallback),
      data.error
    );
  }
  return new KimapDocumentError("caravan_document_error", fallback);
}

function record(value) {
  if (!isRecord(value)) {
    throw new KimapDocumentError(
      "invalid_document_record",
      "Caravan returned an invalid document record."
    );
  }
  const revision = Number(value.revision);
  const bytes = Number(value.bytes);
  if (
    typeof value.id !== "string" ||
    !DOCUMENT_ID.test(value.id) ||
    !TYPES.has(value.type) ||
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    value.schemaVersion !== 1 ||
    typeof value.scopeKey !== "string" ||
    value.scopeKey.length === 0 ||
    (value.originManifest !== null &&
      value.originManifest !== undefined &&
      typeof value.originManifest !== "string") ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    !Number.isInteger(bytes) ||
    bytes < 0
  ) {
    throw new KimapDocumentError(
      "invalid_document_record",
      "Caravan returned invalid document metadata."
    );
  }
  return Object.freeze({
    id: value.id,
    type: value.type,
    name: value.name,
    schemaVersion: value.schemaVersion,
    scopeKey: value.scopeKey,
    originManifest: value.originManifest ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    revision,
    bytes
  });
}

export class CaravanDocumentClient {
  constructor({ apiUrl, fetchImpl = globalThis.fetch } = {}) {
    if (typeof apiUrl !== "string" || apiUrl.length === 0) {
      throw new KimapDocumentError("invalid_document_client", "A Caravan API URL is required.");
    }
    if (typeof fetchImpl !== "function") {
      throw new KimapDocumentError(
        "invalid_document_client",
        "A fetch implementation is required."
      );
    }
    this.apiUrl = apiUrl;
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async #json(response, fallback) {
    if (!response.ok) {
      throw new KimapDocumentError("caravan_document_http_error", fallback, {
        status: response.status
      });
    }
    const data = await response.json();
    if (data?.error) throw apiError(data, fallback);
    return data;
  }

  async #token() {
    const url = new URL(this.apiUrl);
    url.search = new URLSearchParams({
      action: "query",
      meta: "tokens",
      format: "json",
      formatversion: "2"
    });
    const response = await this.fetchImpl(url, { credentials: "include" });
    const data = await this.#json(response, "Could not obtain a CSRF token.");
    const token = data?.query?.tokens?.csrftoken;
    if (typeof token !== "string" || token.length === 0) {
      throw new KimapDocumentError("missing_csrf_token", "Caravan did not return a CSRF token.");
    }
    return token;
  }

  async list({ documentType, scopeKey } = {}) {
    if (documentType !== undefined && !TYPES.has(documentType)) {
      throw new KimapDocumentError("invalid_document_type", "Unknown document type filter.");
    }
    const url = new URL(this.apiUrl);
    const query = {
      action: "listkimapdocuments",
      format: "json",
      formatversion: "2"
    };
    if (documentType) query.documentType = documentType;
    if (scopeKey) query.scopeKey = scopeKey;
    url.search = new URLSearchParams(query);
    const response = await this.fetchImpl(url, { credentials: "include" });
    const data = await this.#json(response, "Could not list KiMap documents.");
    const documents = data?.listkimapdocuments?.documents;
    if (!Array.isArray(documents)) {
      throw new KimapDocumentError(
        "invalid_document_record",
        "Caravan returned an invalid document list."
      );
    }
    return documents.map(record);
  }

  async load(documentId) {
    validateDocumentId(documentId);
    const url = new URL(this.apiUrl);
    url.search = new URLSearchParams({
      action: "loadkimapdocument",
      format: "json",
      formatversion: "2",
      documentId
    });
    const response = await this.fetchImpl(url, { credentials: "include" });
    const data = await this.#json(response, "Could not load the KiMap document.");
    const loaded = data?.loadkimapdocument?.document;
    const metadata = record(loaded);
    if (!isRecord(loaded.content)) {
      throw new KimapDocumentError(
        "invalid_document",
        "Caravan returned invalid document content."
      );
    }
    return Object.freeze({ ...metadata, content: loaded.content });
  }

  async save({ name, scopeKey, originManifest, document, documentId, baseRevision }) {
    if (!isRecord(document)) {
      throw new KimapDocumentError("invalid_document", "A KiMap document object is required.");
    }
    if (!TYPES.has(document.documentType) || document.schemaVersion !== 1) {
      throw new KimapDocumentError(
        "invalid_document",
        "A supported KiMap document type and schema version are required."
      );
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new KimapDocumentError("invalid_document", "A document name is required.");
    }
    if (typeof scopeKey !== "string" || scopeKey.length === 0) {
      throw new KimapDocumentError("invalid_document", "A document scope is required.");
    }
    if (documentId !== undefined) validateDocumentId(documentId);
    if (
      (documentId === undefined && baseRevision !== undefined) ||
      (documentId !== undefined && (!Number.isInteger(baseRevision) || baseRevision < 1))
    ) {
      throw new KimapDocumentError(
        "invalid_document_record",
        "Updates require a valid document id and base revision."
      );
    }
    const token = await this.#token();
    const params = {
      action: "savekimapdocument",
      format: "json",
      formatversion: "2",
      documentName: name,
      scopeKey,
      documentJson: JSON.stringify(document),
      token
    };
    if (originManifest) params.originManifest = originManifest;
    if (documentId) params.documentId = documentId;
    if (baseRevision !== undefined) params.baseRevision = String(baseRevision);
    const response = await this.fetchImpl(this.apiUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params)
    });
    const data = await this.#json(response, "Could not save the KiMap document.");
    return record(data?.savekimapdocument?.document);
  }

  async delete({ documentId, baseRevision }) {
    validateDocumentId(documentId);
    if (!Number.isInteger(baseRevision) || baseRevision < 1) {
      throw new KimapDocumentError(
        "invalid_document_record",
        "Delete requires a positive base revision."
      );
    }
    const token = await this.#token();
    const response = await this.fetchImpl(this.apiUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "deletekimapdocument",
        format: "json",
        formatversion: "2",
        documentId,
        baseRevision: String(baseRevision),
        token
      })
    });
    const data = await this.#json(response, "Could not delete the KiMap document.");
    return data?.deletekimapdocument ?? {};
  }
}
