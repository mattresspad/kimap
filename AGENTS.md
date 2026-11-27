# Working on KiMap

Use the Node version in .node-version. Install with npm ci. The contributor preview runs the real map shell against an original survey dataset and local artwork. Use npm run check and npm run test:browser before a pull request.

The browser owns scenario mutation through ScenarioSession and geographic selection through SelectionSession. Render from immutable projections. Validate the entire v3 dataset set before mutating stores. Preserve schema-v1 document semantics, exact entity IDs, and baseline-qualified scenario and shared-view identity.

The serving Worker reads SHELL and MAP_DATA and redirects artwork to the separate asset origin. Keep production exports and artwork in their respective publications. Build the shell explicitly from its entry points. Preserve the in-page initialization error when a required dataset fails.

Before reporting a stable Worker icon or overlay as absent from R2, use npm run check:worker-assets with the asset path. Exit code 2 is inconclusive, never proof of absence.

Production promotion requires Prd's protected GitHub environment approval. Keep credentials, personal paths, raw datasets, local state, private records and historic server configs out of this repository.
