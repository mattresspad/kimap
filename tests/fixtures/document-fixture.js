export const DOCUMENT_TIMESTAMP = "2026-08-23T12:00:00.000Z";

export function markerSetDocument(overrides = {}) {
  return {
    documentType: "markerSet",
    schemaVersion: 1,
    origin: { manifestId: "vanilla", baselineKey: "vanilla:fixture-hash" },
    createdAt: DOCUMENT_TIMESTAMP,
    updatedAt: DOCUMENT_TIMESTAMP,
    markers: [
      {
        id: "marker-one",
        lat: 12.5,
        lng: -44.25,
        name: "Safe camp",
        description: "A portable marker.",
        icon: "default"
      }
    ],
    ...overrides
  };
}

export function paintPlanDocument(overrides = {}) {
  return {
    documentType: "paintPlan",
    schemaVersion: 1,
    origin: { manifestId: "test-manifest", baselineKey: "manifest:test-manifest" },
    createdAt: DOCUMENT_TIMESTAMP,
    updatedAt: DOCUMENT_TIMESTAMP,
    items: [
      {
        id: "paint-one",
        type: "line",
        geometry: [
          { lat: 1, lng: 2 },
          { lat: 3, lng: 4 }
        ],
        properties: { color: "#ff8800" },
        visible: true
      },
      {
        id: "paint-two",
        type: "note",
        geometry: { lat: 5, lng: 6 },
        properties: { text: "Hold here." },
        visible: false
      }
    ],
    ...overrides
  };
}

export function documentMetadata(overrides = {}) {
  return {
    id: "0123456789abcdef0123456789abcdef",
    type: "markerSet",
    name: "Field notes",
    schemaVersion: 1,
    scopeKey: "portable",
    originManifest: "vanilla",
    createdAt: DOCUMENT_TIMESTAMP,
    updatedAt: DOCUMENT_TIMESTAMP,
    revision: 1,
    bytes: 512,
    ...overrides
  };
}
