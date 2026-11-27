import { KimapDocumentError } from "./errors.js";

export const DOCUMENT_SCHEMA_VERSION = 1;
export const DOCUMENT_TYPES = Object.freeze({
  SCENARIO: "scenario",
  MARKER_SET: "markerSet",
  PAINT_PLAN: "paintPlan"
});
export const PORTABLE_SCOPE_KEY = "portable";

const PAINT_TYPES = new Set(["box", "line", "arrow", "circle", "icon", "note"]);
const PAINT_ICON_TYPES = new Set([
  "skull",
  "swords",
  "check-mark",
  "pickaxe",
  "star",
  "target",
  "fire",
  "warning",
  "prison"
]);
const MARKER_ICON_TYPES = new Set(["default"]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function fail(code, message, context = {}) {
  throw new KimapDocumentError(code, message, context);
}

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cloneData(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function stringValue(value, label, { allowEmpty = false, maximum = 255 } = {}) {
  if (typeof value !== "string") fail("invalid_document", `${label} must be a string.`);
  const normalized = value.trim();
  if (!allowEmpty && normalized.length === 0) {
    fail("invalid_document", `${label} must not be empty.`);
  }
  if (normalized.length > maximum) {
    fail("invalid_document", `${label} must not exceed ${String(maximum)} characters.`);
  }
  return normalized;
}

function timestamp(value, label) {
  const normalized = stringValue(value, label, { maximum: 64 });
  if (!Number.isFinite(Date.parse(normalized))) {
    fail("invalid_document", `${label} must be a valid timestamp.`);
  }
  return normalized;
}

function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("invalid_document", `${label} must be a finite number.`);
  }
  return value;
}

function point(value, label) {
  if (!isRecord(value)) fail("invalid_document", `${label} must be a coordinate object.`);
  return {
    lat: finiteNumber(value.lat, `${label}.lat`),
    lng: finiteNumber(value.lng, `${label}.lng`)
  };
}

function header(document, expectedType) {
  if (!isRecord(document)) fail("invalid_document", "A KiMap document must be a JSON object.");
  if (document.documentType !== expectedType) {
    fail("invalid_document_type", `Expected documentType '${expectedType}'.`, {
      actual: document.documentType
    });
  }
  if (document.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    fail(
      "invalid_document_version",
      `Document schemaVersion must be ${String(DOCUMENT_SCHEMA_VERSION)}.`,
      { actual: document.schemaVersion }
    );
  }
  return {
    documentType: expectedType,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    createdAt: timestamp(document.createdAt, "createdAt"),
    updatedAt: timestamp(document.updatedAt, "updatedAt")
  };
}

function origin(value) {
  if (!isRecord(value)) fail("invalid_document", "origin must be an object.");
  return {
    manifestId: stringValue(value.manifestId, "origin.manifestId", { maximum: 255 }),
    baselineKey: stringValue(value.baselineKey, "origin.baselineKey", { maximum: 255 })
  };
}

function uniqueId(value, label, seen) {
  const id = stringValue(value, label, { maximum: 128 });
  if (seen.has(id)) fail("duplicate_document_identity", `${label} '${id}' is duplicated.`, { id });
  seen.add(id);
  return id;
}

export function normalizeMarkerSetDocument(document) {
  const normalizedHeader = header(document, DOCUMENT_TYPES.MARKER_SET);
  if (!Array.isArray(document.markers)) {
    fail("invalid_document", "markers must be an array.");
  }

  const seen = new Set();
  const markers = document.markers.map((marker, index) => {
    if (!isRecord(marker)) fail("invalid_document", `markers[${String(index)}] must be an object.`);
    const icon = stringValue(marker.icon ?? "default", `markers[${String(index)}].icon`, {
      maximum: 64
    });
    if (!MARKER_ICON_TYPES.has(icon)) {
      fail("invalid_document", `markers[${String(index)}].icon is not supported.`, { icon });
    }
    return {
      id: uniqueId(marker.id, `markers[${String(index)}].id`, seen),
      lat: finiteNumber(marker.lat, `markers[${String(index)}].lat`),
      lng: finiteNumber(marker.lng, `markers[${String(index)}].lng`),
      name: stringValue(marker.name, `markers[${String(index)}].name`, { maximum: 200 }),
      description: stringValue(marker.description ?? "", `markers[${String(index)}].description`, {
        allowEmpty: true,
        maximum: 4000
      }),
      icon
    };
  });

  return deepFreeze({
    ...normalizedHeader,
    origin: origin(document.origin),
    markers
  });
}

function paintGeometry(type, geometry, label) {
  if (type === "box" || type === "line" || type === "arrow") {
    if (!Array.isArray(geometry) || geometry.length !== 2) {
      fail("invalid_document", `${label} must contain exactly two coordinates.`);
    }
    return geometry.map((entry, index) => point(entry, `${label}[${String(index)}]`));
  }
  return point(geometry, label);
}

function paintProperties(type, properties, label) {
  if (!isRecord(properties)) fail("invalid_document", `${label} must be an object.`);

  if (["box", "line", "arrow", "circle"].includes(type)) {
    const color = stringValue(properties.color, `${label}.color`, { maximum: 7 });
    if (!HEX_COLOR.test(color)) fail("invalid_document", `${label}.color must be a hex color.`);
    if (type === "circle") {
      const radius = finiteNumber(properties.radius, `${label}.radius`);
      if (radius <= 0 || radius > 1_000_000) {
        fail("invalid_document", `${label}.radius must be between 0 and 1,000,000.`);
      }
      return { color, radius };
    }
    return { color };
  }

  if (type === "icon") {
    const iconType = stringValue(properties.iconType, `${label}.iconType`, { maximum: 32 });
    if (!PAINT_ICON_TYPES.has(iconType)) {
      fail("invalid_document", `${label}.iconType is not supported.`, { iconType });
    }
    return { iconType };
  }

  return {
    text: stringValue(properties.text ?? "", `${label}.text`, {
      allowEmpty: true,
      maximum: 4000
    })
  };
}

export function normalizePaintPlanDocument(document) {
  const normalizedHeader = header(document, DOCUMENT_TYPES.PAINT_PLAN);
  if (!Array.isArray(document.items)) fail("invalid_document", "items must be an array.");

  const seen = new Set();
  const items = document.items.map((item, index) => {
    const label = `items[${String(index)}]`;
    if (!isRecord(item)) fail("invalid_document", `${label} must be an object.`);
    const type = stringValue(item.type, `${label}.type`, { maximum: 32 });
    if (!PAINT_TYPES.has(type)) {
      fail("invalid_document", `${label}.type is not supported.`, { type });
    }
    if (typeof item.visible !== "boolean") {
      fail("invalid_document", `${label}.visible must be a boolean.`);
    }
    return {
      id: uniqueId(item.id, `${label}.id`, seen),
      type,
      geometry: paintGeometry(type, item.geometry, `${label}.geometry`),
      properties: paintProperties(type, item.properties, `${label}.properties`),
      visible: item.visible
    };
  });

  return deepFreeze({
    ...normalizedHeader,
    origin: origin(document.origin),
    items
  });
}

export function createMarkerSetDocument({ origin: rawOrigin, markers, createdAt, updatedAt }) {
  const now = new Date().toISOString();
  return normalizeMarkerSetDocument({
    documentType: DOCUMENT_TYPES.MARKER_SET,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    origin: rawOrigin,
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? now,
    markers
  });
}

export function createPaintPlanDocument({ origin: rawOrigin, items, createdAt, updatedAt }) {
  const now = new Date().toISOString();
  return normalizePaintPlanDocument({
    documentType: DOCUMENT_TYPES.PAINT_PLAN,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    origin: rawOrigin,
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? now,
    items
  });
}

export function normalizePortableDocument(document) {
  if (!isRecord(document)) fail("invalid_document", "A KiMap document must be a JSON object.");
  if (document.documentType === DOCUMENT_TYPES.MARKER_SET) {
    return normalizeMarkerSetDocument(document);
  }
  if (document.documentType === DOCUMENT_TYPES.PAINT_PLAN) {
    return normalizePaintPlanDocument(document);
  }
  fail("invalid_document_type", "Expected a markerSet or paintPlan document.", {
    actual: document.documentType
  });
}
