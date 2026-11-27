import { KimapDocumentError } from "./errors.js";

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new KimapDocumentError("invalid_document_transaction", `${label} must be a function.`);
  }
  return value;
}

export function importDocumentTransaction({ document, normalize, replace }) {
  const normalized = requireFunction(normalize, "normalize")(document);
  requireFunction(replace, "replace")(normalized);
  return normalized;
}

export async function saveDocumentTransaction({
  client,
  state,
  document,
  name,
  scopeKey,
  originManifest,
  saveAs = false
}) {
  if (!client || typeof client.save !== "function" || !state?.getSnapshot) {
    throw new KimapDocumentError(
      "invalid_document_transaction",
      "A document client and record state are required."
    );
  }
  const current = state.getSnapshot();
  if (!saveAs && !current.id) {
    throw new KimapDocumentError(
      "document_save_as_required",
      "Save As is required before updating this document."
    );
  }
  const saved = await client.save({
    name,
    scopeKey,
    originManifest,
    document,
    documentId: saveAs ? undefined : current.id,
    baseRevision: saveAs ? undefined : current.revision
  });
  state.markSaved(saved);
  return saved;
}

export async function loadDocumentTransaction({
  client,
  documentId,
  expectedType,
  expectedScopeKey,
  normalize,
  replace
}) {
  if (!client || typeof client.load !== "function") {
    throw new KimapDocumentError("invalid_document_transaction", "A document client is required.");
  }
  const loaded = await client.load(documentId);
  if (loaded.type !== expectedType) {
    throw new KimapDocumentError("invalid_document_type", `Expected a '${expectedType}' document.`);
  }
  if (expectedScopeKey !== undefined && loaded.scopeKey !== expectedScopeKey) {
    throw new KimapDocumentError(
      "document_scope_mismatch",
      "The selected document does not belong to this scope."
    );
  }

  const normalized = requireFunction(normalize, "normalize")(loaded.content);
  requireFunction(replace, "replace")(normalized);
  return Object.freeze({ metadata: loaded, document: normalized });
}
