import { deepFreeze, diagnostic } from "../scenario/utils.js";

const GENERATED_SATURATION = 70;
const GENERATED_LIGHTNESS = Object.freeze([48, 58, 42]);
const GOLDEN_ANGLE = 137.508;
const MINIMUM_RGB_DISTANCE = 72;
const MAXIMUM_GENERATION_ATTEMPTS = 24;

function stableId(value, label) {
  const id = value?.id ?? value?.StringId;
  if (typeof id !== "string" || id.trim() === "") {
    throw new TypeError(`${label} requires a stable ID.`);
  }
  return id;
}

function packedColorToHex(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffff) return null;
  return `#${numeric.toString(16).padStart(6, "0")}`;
}

function hexToRgb(value) {
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function hueToRgb(p, q, t) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb(hue, saturation, lightness) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)].map(
    (value) => value * 255
  );
}

function colorDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function generatedColor(id, assigned) {
  const hash = fnv1a(id);
  const baseHue = hash % 360;
  let best = null;
  for (let attempt = 0; attempt < MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const hue = baseHue + attempt * GOLDEN_ANGLE;
    const lightness = GENERATED_LIGHTNESS[((hash >>> 8) + attempt) % GENERATED_LIGHTNESS.length];
    const rgb = hslToRgb(hue, GENERATED_SATURATION, lightness);
    const minimum =
      assigned.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...assigned.map((candidate) => colorDistance(rgb, candidate)));
    const entry = { rgb, minimum };
    if (!best || entry.minimum > best.minimum) best = entry;
    if (minimum >= MINIMUM_RGB_DISTANCE) return rgbToHex(rgb);
  }
  return rgbToHex(best.rgb);
}

function normalizePaletteIds(faction) {
  const values = Array.isArray(faction.paletteIds) ? faction.paletteIds : [];
  return [...new Set(values.filter((id) => typeof id === "string" && id.trim() !== ""))].sort();
}

/** Builds deterministic defaults for every faction in one manifest. */
export function createPoliticalPaletteDefaults({ factions, colourSchemes, participantIds } = {}) {
  if (!Array.isArray(factions) || !Array.isArray(colourSchemes) || !Array.isArray(participantIds)) {
    throw new TypeError("Political palette inputs must be arrays.");
  }

  const diagnostics = [];
  const factionRows = factions
    .map((faction) => ({ ...faction, id: stableId(faction, "Faction") }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const factionIds = new Set();
  for (const faction of factionRows) {
    if (factionIds.has(faction.id)) throw new TypeError(`Duplicate faction ID '${faction.id}'.`);
    factionIds.add(faction.id);
  }

  const schemeById = new Map();
  for (const scheme of colourSchemes) {
    const id = stableId(scheme, "Colour scheme");
    if (schemeById.has(id)) throw new TypeError(`Duplicate colour-scheme ID '${id}'.`);
    schemeById.set(id, scheme.raw ?? scheme);
  }

  const defaults = {};
  const assigned = [];
  for (const faction of factionRows) {
    const linked = normalizePaletteIds(faction).map((paletteId) => ({
      paletteId,
      color: packedColorToHex(schemeById.get(paletteId)?.Values?.["color 1"])
    }));
    const valid = linked.filter(({ color }) => color !== null);
    const invalid = linked.filter(({ color }) => color === null).map(({ paletteId }) => paletteId);
    if (invalid.length > 0) {
      diagnostics.push(
        diagnostic(
          "warning",
          "political_palette_link_invalid",
          `Faction '${faction.id}' has linked palettes without a valid packed color.`,
          { factionId: faction.id, paletteIds: invalid }
        )
      );
    }
    if (valid.length > 0) {
      defaults[faction.id] = {
        color: valid[0].color,
        source: "authored",
        paletteId: valid[0].paletteId
      };
      assigned.push(hexToRgb(valid[0].color));
      if (valid.length > 1) {
        diagnostics.push(
          diagnostic(
            "info",
            "political_palette_multiple_authored",
            `Faction '${faction.id}' has multiple valid authored palettes; the first stable ID was selected.`,
            { factionId: faction.id, paletteIds: valid.map(({ paletteId }) => paletteId) }
          )
        );
      }
    }
  }

  for (const faction of factionRows) {
    if (defaults[faction.id]) continue;
    const color = generatedColor(faction.id, assigned);
    defaults[faction.id] = { color, source: "generated", paletteId: null };
    assigned.push(hexToRgb(color));
  }

  const resolvedParticipantIds = [...new Set(participantIds)]
    .filter((id) => factionIds.has(id))
    .sort();
  const missingParticipantIds = [...new Set(participantIds)]
    .filter((id) => !factionIds.has(id))
    .sort();
  if (missingParticipantIds.length > 0) {
    diagnostics.push(
      diagnostic(
        "info",
        "political_default_participant_missing",
        "Some exact-ID default participants are not present in this manifest.",
        { factionIds: missingParticipantIds }
      )
    );
  }

  return deepFreeze({
    defaultsByFactionId: defaults,
    resolvedParticipantIds,
    missingParticipantIds,
    diagnostics
  });
}
