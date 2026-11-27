import { KimapDocumentError } from "./errors.js";

export function documentFileName(name, type) {
  const safeName =
    String(name || "kimap-document")
      .trim()
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "kimap-document";
  return `${safeName}.${type}.json`;
}

export function serializeDocumentFile(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function parseDocumentFileText(text, normalize) {
  if (typeof normalize !== "function") {
    throw new KimapDocumentError("invalid_document_import", "A document normalizer is required.");
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new KimapDocumentError("invalid_document_json", "The selected file is not valid JSON.", {
      cause: error.message
    });
  }
  return normalize(parsed);
}

export function downloadDocumentFile(document, name) {
  const blob = new Blob([serializeDocumentFile(document)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = documentGlobal().createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function documentGlobal() {
  if (!globalThis.document) {
    throw new KimapDocumentError("document_download_unavailable", "File download is unavailable.");
  }
  return globalThis.document;
}
