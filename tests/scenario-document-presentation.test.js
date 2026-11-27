import assert from "node:assert/strict";
import test from "node:test";

import { createScenarioDocumentPresentation } from "../modules/documents/scenario-presentation.js";

test("Scenario document presentation distinguishes all four retained record states", () => {
  assert.deepEqual(
    createScenarioDocumentPresentation({ id: null, name: null, revision: null, dirty: false }),
    {
      state: "new",
      label: "New scenario."
    }
  );
  assert.deepEqual(
    createScenarioDocumentPresentation({ id: null, name: null, revision: null, dirty: true }),
    {
      state: "unsaved",
      label: "New scenario — unsaved changes."
    }
  );
  assert.deepEqual(
    createScenarioDocumentPresentation({
      id: "scenario-1",
      name: "Bast",
      revision: 4,
      dirty: false
    }),
    {
      state: "saved",
      label: "Saved — Bast, revision 4."
    }
  );
  assert.deepEqual(
    createScenarioDocumentPresentation({
      id: "scenario-1",
      name: "Bast",
      revision: 4,
      dirty: true
    }),
    {
      state: "modified",
      label: "Modified — Bast, revision 4; unsaved changes."
    }
  );
});

test("Scenario document presentation returns an immutable value without mutating its snapshot", () => {
  const snapshot = Object.freeze({
    id: "scenario-1",
    name: "The Great Desert",
    revision: 7,
    dirty: false
  });
  const presentation = createScenarioDocumentPresentation(snapshot);

  assert.equal(Object.isFrozen(presentation), true);
  assert.deepEqual(snapshot, {
    id: "scenario-1",
    name: "The Great Desert",
    revision: 7,
    dirty: false
  });
});
