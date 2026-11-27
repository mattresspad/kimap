const PRESENTATION_STATES = Object.freeze({
  NEW: "new",
  UNSAVED: "unsaved",
  SAVED: "saved",
  MODIFIED: "modified"
});

function freezePresentation(state, label) {
  return Object.freeze({ state, label });
}

/**
 * Projects Scenario document identity and dirty state into compact, text-complete UI status.
 */
export function createScenarioDocumentPresentation(snapshot) {
  const stored = typeof snapshot?.id === "string" && snapshot.id.length > 0;
  const dirty = snapshot?.dirty === true;

  if (!stored) {
    return dirty
      ? freezePresentation(PRESENTATION_STATES.UNSAVED, "New scenario — unsaved changes.")
      : freezePresentation(PRESENTATION_STATES.NEW, "New scenario.");
  }

  const name = snapshot.name;
  const revision = String(snapshot.revision);
  return dirty
    ? freezePresentation(
        PRESENTATION_STATES.MODIFIED,
        `Modified — ${name}, revision ${revision}; unsaved changes.`
      )
    : freezePresentation(
        PRESENTATION_STATES.SAVED,
        `Saved — ${name}, revision ${revision}.`
      );
}
