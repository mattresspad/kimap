import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { inspectPackage } from "./package.mjs";
import {
  annotation,
  checkCandidate,
  checkSource,
  live,
  singleActive,
  versionOrigin,
  worker
} from "./release-guards.mjs";
import { parseMapDataResponse } from "../modules/map-contract.js";
import { deriveBaselineKey } from "../modules/scenario/baseline.js";

const root = resolve(import.meta.dirname, "..");
const evidence = join(root, "artifacts/release");
const cf = join(root, "node_modules/cf/bin/cf");
const env = process.env;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function save(name, data) {
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, name), JSON.stringify(data, null, 2) + "\n");
}
const load = async (name) => JSON.parse(await readFile(join(evidence, name), "utf8"));
function cli(...args) {
  return execFileSync(process.execPath, [cf, ...args], {
    cwd: join(root, "worker"),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
}
const latest = () =>
  JSON.parse(cli("workers", "deployments", "list", "--worker", worker)).deployments[0];
const details = (id) => JSON.parse(cli("workers", "versions", "get", id, "--worker-id", worker));
async function currentCommit() {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const res = await fetch("https://api.github.com/repos/mattresspad/kimap/git/ref/heads/main", {
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + env.GITHUB_TOKEN },
    redirect: "error"
  });
  assert.ok(res.ok, "Read main ref: HTTP " + res.status);
  checkSource(env, commit, (await res.json()).object.sha);
  return commit;
}
async function response(url, method = "GET") {
  const res = await fetch(url, {
    redirect: "error",
    cache: "no-store",
    method,
    signal: AbortSignal.timeout(30000)
  });
  assert.equal(res.status, 200, url + " returned " + res.status);
  return res;
}
async function checkPublished(origin, receipt) {
  for (const { path, sha256 } of receipt.shell.filter((f) =>
    [
      "index.html",
      "dist/bundle.js",
      "dist/bundle.css",
      "libs/tga-codec-main/tga.js",
      "favicon.ico"
    ].includes(f.path)
  )) {
    const res = await response(origin + (path === "index.html" ? "/" : "/" + path));
    if (path === "index.html") assert.match(res.headers.get("cache-control"), /no-transform/);
    assert.equal(
      hash(Buffer.from(await res.arrayBuffer())),
      sha256,
      "Served bytes differ: " + path
    );
  }
  const bootstrap = await response(origin + "/map-data/vanilla.json");
  assert.equal(bootstrap.headers.get("x-kimap-source"), "r2");
  const bytes = Buffer.from(await bootstrap.arrayBuffer());
  const map = parseMapDataResponse(JSON.parse(bytes), { manifestDataOrigin: origin });
  const baseline = deriveBaselineKey(map);
  assert.match(baseline, /^vanilla:[a-f0-9]{64}$/);
  const town = new URL(map.datasets.townFcsData.url);
  assert.equal(town.origin, origin);
  assert.equal((await response(town.href, "HEAD")).headers.get("x-kimap-source"), "r2");
  const road = new URL(map.assets.roadNetwork.url);
  assert.equal(road.origin, "https://kim-assets.kenshi.wiki");
  assert.equal((await response(road.href, "HEAD")).headers.get("x-kenshi-asset-source"), "r2");
  return { baseline, bootstrapSha256: hash(bytes) };
}
async function stage() {
  assert.ok(
    env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID,
    "Configure the CLOUDFLARE_API_TOKEN Actions secret and CLOUDFLARE_ACCOUNT_ID variable before uploading a version."
  );
  const commit = await currentCommit();
  const { packageSha256, shell } = await inspectPackage();
  const before = latest();
  const previousVersion = singleActive(before);
  assert.equal(details(previousVersion).id, previousVersion, "Recovery version unavailable");
  const uploadResult = spawnSync(
    process.execPath,
    [
      cf,
      "workers",
      "versions",
      "create",
      "--prebuilt",
      "--tag",
      commit.slice(0, 12),
      "--message",
      annotation(commit, packageSha256)
    ],
    { cwd: join(root, "worker"), encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  if (uploadResult.error) throw uploadResult.error;
  const upload = (uploadResult.stdout || "") + (uploadResult.stderr || "");
  if (uploadResult.status !== 0)
    throw Error(
      "Inactive version upload failed: " + upload.replaceAll(env.CLOUDFLARE_API_TOKEN, "[redacted]")
    );
  const version = upload.match(/(?:Worker |Current )?Version ID:\s*([0-9a-f-]{36})/i)?.[1];
  assert.ok(version, "Version upload did not report its ID");
  const receipt = {
    worker,
    commit,
    packageSha256,
    version,
    origin: versionOrigin(version),
    previousVersion,
    previousDeployment: before.id,
    shell
  };
  checkCandidate(receipt, commit, latest(), details(version));
  await save("preview.json", receipt);
  await appendFile(env.GITHUB_OUTPUT, "origin=" + receipt.origin + "\n");
  await appendFile(
    env.GITHUB_STEP_SUMMARY,
    "## Inactive map version\n\n[Open preview](" +
      receipt.origin +
      ") · commit `" +
      commit +
      "` · version `" +
      version +
      "`\n"
  );
  receipt.data = await checkPublished(receipt.origin, receipt);
  await save("preview.json", receipt);
  await appendFile(
    env.GITHUB_STEP_SUMMARY,
    [
      "",
      `Shell and publication checks passed. Previous production version: ${previousVersion}.`,
      `Before approving production, run the Vanilla desktop and phone checks locally from commit ${commit}.`,
      "",
      "```sh",
      `node checks/published.mjs ${receipt.origin}`,
      "```",
      ""
    ].join("\n")
  );
}
async function promote() {
  const commit = await currentCommit();
  const receipt = await load("preview.json");
  assert.deepEqual(
    await checkPublished(receipt.origin, receipt),
    receipt.data,
    "Publication changed since preview"
  );
  assert.equal(details(receipt.previousVersion).id, receipt.previousVersion);
  // Read the branch and current traffic again immediately before the one traffic-changing call.
  await currentCommit();
  checkCandidate(receipt, commit, latest(), details(receipt.version));
  const versions = [{ version_id: receipt.version, percentage: 100 }];
  cli(
    "workers",
    "deployments",
    "create",
    "--worker",
    worker,
    "--strategy",
    "percentage",
    "--versions",
    JSON.stringify(versions)
  );
  const deployed = latest();
  await save("production.json", {
    ...receipt,
    deployment: deployed.id,
    versions: deployed.versions,
    liveVerified: false
  });
  assert.deepEqual(deployed.versions, versions);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      assert.deepEqual(await checkPublished(live, receipt), receipt.data);
      await save("production.json", {
        ...receipt,
        deployment: deployed.id,
        versions,
        liveVerified: true
      });
      await appendFile(
        env.GITHUB_STEP_SUMMARY,
        "## Published map\n\n[Live site](" +
          live +
          ") · version `" +
          receipt.version +
          "` · recovery version `" +
          receipt.previousVersion +
          "`.\n"
      );
      return;
    } catch (error) {
      if (attempt === 7) throw error;
      await sleep(5000);
    }
  }
}
const command = process.argv[2];
if (command === "stage") await stage();
else if (command === "promote") await promote();
else throw Error("Choose stage or promote.");
