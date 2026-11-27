import assert from "node:assert/strict";

export const worker = "kim-data-store";
export const live = "https://map.kenshi.wiki";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export function versionOrigin(id) {
  assert.match(id, uuid);
  return "https://" + id.slice(0, 8) + "-kim-data-store.prds.workers.dev";
}
export function singleActive(deployment) {
  assert.match(deployment.id, uuid);
  assert.equal(deployment.versions.length, 1, "Expected one fully deployed Worker version");
  const version = deployment.versions[0];
  assert.equal(version.percentage, 100);
  assert.match(version.version_id, uuid);
  return version.version_id;
}
export function checkSource(env, commit, main) {
  assert.equal(env.GITHUB_ACTIONS, "true");
  assert.equal(env.GITHUB_REPOSITORY, "mattresspad/kimap");
  assert.equal(env.GITHUB_REF, "refs/heads/main");
  assert.ok(["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME));
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(env.GITHUB_SHA, commit);
  assert.equal(env.EXPECTED_SHA, commit);
  assert.equal(main, commit, "main advanced after this release started");
}
export const annotation = (commit, hash) => "KiMap " + commit + " package " + hash;
export function checkCandidate(receipt, commit, current, version) {
  assert.equal(receipt.commit, commit);
  assert.equal(receipt.worker, worker);
  assert.match(receipt.packageSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.origin, versionOrigin(receipt.version));
  assert.equal(current.id, receipt.previousDeployment, "Active deployment changed since preview");
  assert.equal(singleActive(current), receipt.previousVersion);
  assert.equal(version.id, receipt.version);
  assert.ok(version.urls.some((url) => new URL(url).href === receipt.origin + "/"));
  assert.equal(version.annotations?.["workers/message"], annotation(commit, receipt.packageSha256));
}
