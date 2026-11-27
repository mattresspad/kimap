import assert from "node:assert/strict";
import test from "node:test";

import {
  CaravanDocumentClient,
  DocumentRecordState,
  KimapDocumentError,
  createMarkerSetDocument,
  createPaintPlanDocument,
  importDocumentTransaction,
  loadDocumentTransaction,
  normalizeMarkerSetDocument,
  normalizePaintPlanDocument,
  parseDocumentFileText,
  saveDocumentTransaction,
  serializeDocumentFile
} from "../modules/documents/index.js";
import {
  documentMetadata,
  markerSetDocument,
  paintPlanDocument
} from "./fixtures/document-fixture.js";

test("marker-set and paint-plan documents round-trip as normalized JSON objects", () => {
  const markerDocument = normalizeMarkerSetDocument(markerSetDocument());
  const paintDocument = normalizePaintPlanDocument(paintPlanDocument());

  assert.deepEqual(
    parseDocumentFileText(serializeDocumentFile(markerDocument), normalizeMarkerSetDocument),
    markerDocument
  );
  assert.deepEqual(
    parseDocumentFileText(serializeDocumentFile(paintDocument), normalizePaintPlanDocument),
    paintDocument
  );
  assert.ok(Object.isFrozen(markerDocument.markers[0]));
  assert.ok(Object.isFrozen(paintDocument.items[0].geometry));
});

test("portable documents reject legacy arrays, unknown schemas, duplicates, and malformed data", () => {
  assert.throws(
    () => normalizeMarkerSetDocument([]),
    (error) => error instanceof KimapDocumentError && error.code === "invalid_document"
  );
  assert.throws(
    () => normalizeMarkerSetDocument(markerSetDocument({ schemaVersion: 2 })),
    (error) => error.code === "invalid_document_version"
  );
  assert.throws(
    () => normalizeMarkerSetDocument(markerSetDocument({ updatedAt: "not-a-timestamp" })),
    (error) => error.code === "invalid_document"
  );
  assert.throws(
    () =>
      normalizeMarkerSetDocument(
        markerSetDocument({
          markers: [markerSetDocument().markers[0], markerSetDocument().markers[0]]
        })
      ),
    (error) => error.code === "duplicate_document_identity"
  );
  assert.throws(
    () =>
      normalizeMarkerSetDocument(
        markerSetDocument({ markers: [{ ...markerSetDocument().markers[0], lat: Number.NaN }] })
      ),
    (error) => error.code === "invalid_document"
  );
  assert.throws(
    () =>
      normalizeMarkerSetDocument(
        markerSetDocument({ markers: [{ ...markerSetDocument().markers[0], icon: "remote" }] })
      ),
    (error) => error.code === "invalid_document"
  );
  assert.throws(
    () =>
      normalizePaintPlanDocument(
        paintPlanDocument({
          items: [{ ...paintPlanDocument().items[0], geometry: [{ lat: 1, lng: 2 }] }]
        })
      ),
    (error) => error.code === "invalid_document"
  );
  assert.throws(
    () =>
      normalizePaintPlanDocument(
        paintPlanDocument({
          items: [
            {
              id: "bad-circle",
              type: "circle",
              geometry: { lat: 1, lng: 2 },
              properties: { color: "orange", radius: 0 },
              visible: true
            }
          ]
        })
      ),
    (error) => error.code === "invalid_document"
  );
  assert.throws(
    () =>
      normalizeMarkerSetDocument(
        markerSetDocument({
          markers: [{ ...markerSetDocument().markers[0], description: "x".repeat(4001) }]
        })
      ),
    (error) => error.code === "invalid_document"
  );
  assert.throws(
    () =>
      normalizePaintPlanDocument(
        paintPlanDocument({
          items: [
            {
              id: "bad-icon",
              type: "icon",
              geometry: { lat: 1, lng: 2 },
              properties: { iconType: "remote-code" },
              visible: true
            }
          ]
        })
      ),
    (error) => error.code === "invalid_document"
  );
});

test("portable constructors retain origin as informational metadata", () => {
  const origin = { manifestId: "mod-a", baselineKey: "manifest:mod-a" };
  assert.deepEqual(
    createMarkerSetDocument({ origin, markers: markerSetDocument().markers }).origin,
    origin
  );
  assert.deepEqual(
    createPaintPlanDocument({ origin, items: paintPlanDocument().items }).origin,
    origin
  );
});

test("record state tracks independent identity, revision, name, and dirty state", () => {
  const state = new DocumentRecordState("markerSet");
  assert.equal(state.getSnapshot().dirty, false);
  state.attach(documentMetadata());
  assert.equal(state.getSnapshot().revision, 1);
  state.markDirty();
  assert.equal(state.getSnapshot().dirty, true);
  state.markSaved(documentMetadata({ revision: 2, name: "Renamed" }));
  assert.deepEqual(state.getSnapshot(), {
    type: "markerSet",
    id: "0123456789abcdef0123456789abcdef",
    revision: 2,
    name: "Renamed",
    dirty: false
  });
  state.clear();
  assert.equal(state.getSnapshot().id, null);
});

function response(payload, ok = true, status = 200) {
  return { ok, status, json: async () => payload };
}

test("Caravan client uses typed metadata, tokens, and optimistic revisions", async () => {
  const calls = [];
  const metadata = documentMetadata();
  const client = new CaravanDocumentClient({
    apiUrl: "https://example.invalid/api.php",
    fetchImpl: async function (url, options = {}) {
      assert.equal(this, globalThis);
      calls.push({ url, options });
      const action =
        new URL(url).searchParams.get("action") ?? new URLSearchParams(options.body).get("action");
      if (action === "query") return response({ query: { tokens: { csrftoken: "token+\\" } } });
      if (action === "listkimapdocuments")
        return response({ listkimapdocuments: { documents: [metadata] } });
      if (action === "loadkimapdocument") {
        return response({
          loadkimapdocument: { document: { ...metadata, content: markerSetDocument() } }
        });
      }
      if (action === "savekimapdocument") {
        return response({ savekimapdocument: { document: { ...metadata, revision: 2 } } });
      }
      if (action === "deletekimapdocument") {
        return response({ deletekimapdocument: { deleted: true, id: metadata.id } });
      }
      throw new Error(`Unexpected action ${String(action)}`);
    }
  });

  assert.equal((await client.list({ documentType: "markerSet", scopeKey: "portable" })).length, 1);
  assert.equal((await client.load(metadata.id)).content.documentType, "markerSet");
  assert.equal(
    (
      await client.save({
        document: markerSetDocument(),
        name: metadata.name,
        scopeKey: "portable",
        originManifest: "vanilla",
        documentId: metadata.id,
        baseRevision: 1
      })
    ).revision,
    2
  );
  assert.deepEqual(await client.delete({ documentId: metadata.id, baseRevision: 2 }), {
    deleted: true,
    id: metadata.id
  });

  const saveCall = calls.find(
    (call) =>
      call.options.method === "POST" && String(call.options.body).includes("savekimapdocument")
  );
  assert.ok(saveCall);
  assert.equal(saveCall.options.credentials, "include");
  assert.match(String(saveCall.options.body), /baseRevision=1/);
  assert.match(String(saveCall.options.body), /token=token%2B%5C/);
  assert.ok(
    calls.some((call) => new URL(call.url).searchParams.get("documentType") === "markerSet")
  );
});

test("Caravan client preserves API error codes", async () => {
  const client = new CaravanDocumentClient({
    apiUrl: "https://example.invalid/api.php",
    fetchImpl: async () =>
      response({ error: { code: "documentconflict", info: "Changed elsewhere." } })
  });
  await assert.rejects(
    client.load("0123456789abcdef0123456789abcdef"),
    (error) => error instanceof KimapDocumentError && error.code === "documentconflict"
  );
});

test("failed server loads and malformed imports leave active document state untouched", async () => {
  const original = normalizeMarkerSetDocument(markerSetDocument());
  let active = original;
  const replace = (next) => {
    active = next;
  };

  await assert.rejects(
    loadDocumentTransaction({
      client: { load: async () => ({ ...documentMetadata(), content: [] }) },
      documentId: documentMetadata().id,
      expectedType: "markerSet",
      expectedScopeKey: "portable",
      normalize: normalizeMarkerSetDocument,
      replace
    }),
    (error) => error.code === "invalid_document"
  );
  assert.strictEqual(active, original);

  assert.throws(
    () =>
      importDocumentTransaction({
        document: paintPlanDocument(),
        normalize: normalizeMarkerSetDocument,
        replace
      }),
    (error) => error.code === "invalid_document_type"
  );
  assert.strictEqual(active, original);
});

test("Save As creates, Save updates by revision, and conflicts retain the attached record", async () => {
  const state = new DocumentRecordState("markerSet");
  const created = documentMetadata();
  const updated = documentMetadata({ revision: 2 });
  const calls = [];
  const client = {
    save: async (input) => {
      calls.push(input);
      return input.documentId ? updated : created;
    }
  };
  const document = markerSetDocument();

  await saveDocumentTransaction({
    client,
    state,
    document,
    name: "Field notes",
    scopeKey: "portable",
    originManifest: "vanilla",
    saveAs: true
  });
  assert.equal(calls[0].documentId, undefined);
  assert.equal(state.getSnapshot().revision, 1);

  state.markDirty();
  await saveDocumentTransaction({
    client,
    state,
    document,
    name: "Field notes",
    scopeKey: "portable",
    originManifest: "vanilla"
  });
  assert.equal(calls[1].documentId, created.id);
  assert.equal(calls[1].baseRevision, 1);
  assert.equal(state.getSnapshot().revision, 2);

  state.markDirty();
  const beforeConflict = state.getSnapshot();
  await assert.rejects(
    saveDocumentTransaction({
      client: {
        save: async () => {
          throw new KimapDocumentError("documentconflict", "Changed elsewhere.");
        }
      },
      state,
      document,
      name: "Field notes",
      scopeKey: "portable",
      originManifest: "vanilla"
    }),
    (error) => error.code === "documentconflict"
  );
  assert.deepEqual(state.getSnapshot(), beforeConflict);
});
