export const REPORT_SUBJECTS = Object.freeze([
  Object.freeze({ id: "political", label: "Political" }),
  Object.freeze({ id: "resources", label: "Resources" }),
  Object.freeze({ id: "weather", label: "Weather" }),
  Object.freeze({ id: "relations", label: "Relations" }),
  Object.freeze({ id: "squadPresence", label: "Squad Presence" })
]);

export const RELATION_REPORT_FILTERS = Object.freeze(["alliesEnemies", "includeNeutrals"]);

export const REPORT_SUBJECT_IDS = Object.freeze(REPORT_SUBJECTS.map(({ id }) => id));

/** Controller-local provenance also covers MouseEvents synthesized after a touch pointer. */
export function createReportingInputTracker() {
  let lastPointerType = "mouse";
  return Object.freeze({
    observe(event) {
      if (event?.pointerType) lastPointerType = event.pointerType;
    },
    kind(event) {
      if (event?.sourceCapabilities?.firesTouchEvents) return "touch";
      return event?.pointerType || lastPointerType;
    }
  });
}

/** Same numeric reading in the Scanner and cursor reports; units belong to the renderer. */
export function formatResourceReading(raw, farming = false) {
  const known = typeof raw === "number" && Number.isFinite(farming ? raw * 100 : raw) && raw >= 0;
  return Object.freeze({
    state: !known ? "unavailable" : raw > 0 ? "active" : "inactive",
    text: !known
      ? "—"
      : farming
        ? raw > 0 && raw * 100 < 0.5
          ? "<1"
          : String(Math.round(raw * 100))
        : raw > 0 && raw < 0.1
          ? "<0.1"
          : raw.toFixed(1)
  });
}
