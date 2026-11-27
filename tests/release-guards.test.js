import assert from "node:assert/strict";
import test from "node:test";
import {
  annotation,
  checkCandidate,
  checkSource,
  versionOrigin
} from "../checks/release-guards.mjs";

const commit = "a".repeat(40);
const version = "1808f51a-a35c-4d05-8860-fea1542f2701";
const previousVersion = "67334b11-3803-4f8c-9b2f-42041db53643";
const current = {
  id: "5521d582-47f9-4717-a0d8-fa690cb62463",
  versions: [{ version_id: previousVersion, percentage: 100 }]
};
const receipt = {
  worker: "kim-data-store",
  commit,
  version,
  previousVersion,
  previousDeployment: current.id,
  origin: versionOrigin(version),
  packageSha256: "b".repeat(64)
};
const details = {
  id: version,
  urls: [receipt.origin],
  annotations: { "workers/message": annotation(commit, receipt.packageSha256) }
};
test("release requires the current trusted main commit", () => {
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "mattresspad/kimap",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "push",
    GITHUB_SHA: commit,
    EXPECTED_SHA: commit
  };
  checkSource(env, commit, commit);
  assert.throws(() => checkSource({ ...env, GITHUB_EVENT_NAME: "pull_request" }, commit, commit));
  assert.throws(() => checkSource(env, commit, "c".repeat(40)));
});
test("promotion binds the candidate to its receipt and the previous active deployment", () => {
  checkCandidate(receipt, commit, current, details);
  assert.throws(() =>
    checkCandidate({ ...receipt, packageSha256: "a".repeat(64) }, commit, current, details)
  );
  assert.throws(() => checkCandidate(receipt, commit, { ...current, id: version }, details));
  assert.throws(() =>
    checkCandidate(receipt, commit, current, {
      ...details,
      urls: ["https://kim-data-store.prds.workers.dev"]
    })
  );
  assert.throws(() =>
    checkCandidate(
      receipt,
      commit,
      { ...current, versions: [{ version_id: version, percentage: 100 }] },
      details
    )
  );
});
