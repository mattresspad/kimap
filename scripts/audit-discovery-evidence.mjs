import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createDiscoveryAudit,
  createDiscoveryCatalog,
  formatDiscoveryAuditSummary
} from "../modules/discovery/index.js";
import { parseMapDataResponse } from "../modules/map-contract.js";
import {
  createScenarioLensProjection,
  normalizeScenarioBaseline
} from "../modules/scenario/index.js";
import { ScenarioSession } from "../stores/scenario-session.js";

const CARAVAN_API_URL = "https://kenshi.wiki/api.php";
const MANIFEST_DATA_ORIGIN = "https://map.kenshi.wiki";
const DISCOVERY_DATASET_KEYS = Object.freeze([
  "animals",
  "armours",
  "characters",
  "crossbows",
  "factionCampaigns",
  "factions",
  "items",
  "mapData",
  "mapItems",
  "nestItems",
  "spawnAreas",
  "squads",
  "townFcsData",
  "tradeCultures",
  "vendorLists",
  "weapons",
  "worldStates"
]);

export function parseDiscoveryAuditArguments(argv) {
  let manifestId = null;
  let bundlePath = null;
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") help = true;
    else if (argument === "--manifest-id") {
      manifestId = argv[index + 1] ?? null;
      index += 1;
    } else if (argument === "--bundle") {
      bundlePath = argv[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--manifest-id=")) {
      manifestId = argument.slice("--manifest-id=".length);
    } else if (argument.startsWith("--bundle=")) {
      bundlePath = argument.slice("--bundle=".length);
    } else {
      throw new TypeError(`Unknown argument '${argument}'.`);
    }
  }
  if (help) return Object.freeze({ help: true, manifestId: null, bundlePath: null });
  if (Boolean(manifestId) === Boolean(bundlePath)) {
    throw new TypeError("Specify exactly one of --manifest-id or --bundle.");
  }
  if (manifestId !== null && manifestId.trim() === "") {
    throw new TypeError("--manifest-id requires a non-empty value.");
  }
  if (bundlePath !== null && bundlePath.trim() === "") {
    throw new TypeError("--bundle requires a path.");
  }
  return Object.freeze({ help: false, manifestId, bundlePath });
}

export function restoreDiscoveryNpmArguments(argv, environment = process.env) {
  if (argv.some((argument) => argument.startsWith("--"))) return argv;
  for (const [name, key] of [
    ["--manifest-id", "npm_config_manifest_id"],
    ["--bundle", "npm_config_bundle"]
  ]) {
    const configured = environment[key];
    if (!configured) continue;
    if (configured === "true" && argv.length === 1) return [name, argv[0]];
    if (configured !== "true" && argv.length === 0) return [name, configured];
  }
  return argv;
}

function usage() {
  return [
    "Usage:",
    "  npm run audit:discovery -- --manifest-id <manifest-id>",
    "  npm run audit:discovery -- --bundle <directory-or-contract.json>"
  ].join("\n");
}

function apiEnvelope(value) {
  return value?.getmapdata ? value : { getmapdata: value };
}

function parseContract(value) {
  return parseMapDataResponse(apiEnvelope(value), { manifestDataOrigin: MANIFEST_DATA_ORIGIN });
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { credentials: "omit" });
  if (!response?.ok) {
    throw new Error(`Request failed with HTTP ${String(response?.status ?? "unknown")}: ${url}`);
  }
  return response.json();
}

export async function loadRemoteDiscoveryBundle(
  manifestId,
  fetchImpl = globalThis.fetch,
  extraDatasetKeys = []
) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable.");
  const url = new URL(CARAVAN_API_URL);
  url.searchParams.set("action", "getmapdata");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("manifestId", manifestId);
  const contract = parseContract(await fetchJson(url.toString(), fetchImpl));
  if (contract.userData.manifestId !== manifestId) {
    throw new Error(
      `Caravan resolved manifest '${contract.userData.manifestId}' instead of requested '${manifestId}'.`
    );
  }
  const entries = await Promise.all(
    [...new Set([...DISCOVERY_DATASET_KEYS, ...extraDatasetKeys])].map(async (key) => {
      const descriptor = contract.datasets[key];
      if (!descriptor?.url) throw new Error(`Manifest '${manifestId}' has no '${key}' dataset.`);
      return [key, await fetchJson(descriptor.url, fetchImpl)];
    })
  );
  return { contract, datasets: Object.fromEntries(entries) };
}

async function firstReadable(paths) {
  for (const path of paths) {
    try {
      if ((await stat(path)).isFile()) return path;
    } catch {
      // Try the next deterministic bundle convention.
    }
  }
  return null;
}

function descriptorCandidates(root, descriptor, fallbackName) {
  let pathname = "";
  try {
    pathname = new URL(descriptor.url, MANIFEST_DATA_ORIGIN).pathname.replace(/^\/+/, "");
  } catch {
    pathname = String(descriptor?.url ?? "").replace(/^\/+/, "");
  }
  return [join(root, pathname), join(root, basename(pathname)), join(root, fallbackName)];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadLocalDiscoveryBundle(inputPath, extraDatasetKeys = []) {
  const absolute = resolve(inputPath);
  const details = await stat(absolute);
  const root = details.isDirectory() ? absolute : dirname(absolute);
  const contractPath = details.isDirectory()
    ? await firstReadable([
        join(root, "contract.json"),
        join(root, "getmapdata.json"),
        join(root, "map-contract.json")
      ])
    : absolute;
  if (!contractPath) {
    throw new Error("Local bundle has no contract.json, getmapdata.json, or map-contract.json.");
  }
  const rawContract = await readJson(contractPath);
  const contract = parseContract(rawContract);
  const rawResult = apiEnvelope(rawContract).getmapdata;
  const entries = [];
  for (const key of new Set([...DISCOVERY_DATASET_KEYS, ...extraDatasetKeys])) {
    const descriptor = rawResult.datasets?.[key];
    if (!descriptor?.url) throw new Error(`Local bundle contract has no '${key}' dataset.`);
    const path = await firstReadable(descriptorCandidates(root, descriptor, `${key}.json`));
    if (!path) throw new Error(`Local bundle is missing dataset '${key}'.`);
    entries.push([key, await readJson(path)]);
  }
  return { contract, datasets: Object.fromEntries(entries) };
}

export function auditDiscoveryBundle({ contract, datasets }) {
  const baseline = normalizeScenarioBaseline({ contract, datasets });
  const session = new ScenarioSession(baseline);
  const snapshot = session.getSnapshot();
  const lenses = createScenarioLensProjection({
    baseline,
    snapshot,
    journal: session.getJournal(),
    timeline: session.getTimeline(),
    campaigns: datasets.factionCampaigns,
    characters: datasets.characters
  });
  const catalog = createDiscoveryCatalog({ datasets, baseline });
  return createDiscoveryAudit({ catalog, snapshot, lenses, manifest: contract.manifest });
}

export async function runDiscoveryAudit(argv, { fetchImpl = globalThis.fetch } = {}) {
  const options = parseDiscoveryAuditArguments(argv);
  if (options.help) return { help: true, usage: usage(), audit: null, summary: null };
  const bundle = options.manifestId
    ? await loadRemoteDiscoveryBundle(options.manifestId, fetchImpl)
    : await loadLocalDiscoveryBundle(options.bundlePath);
  const audit = auditDiscoveryBundle(bundle);
  return { help: false, usage: null, audit, summary: formatDiscoveryAuditSummary(audit) };
}

async function main() {
  try {
    const argv = restoreDiscoveryNpmArguments(process.argv.slice(2));
    const result = await runDiscoveryAudit(argv);
    if (result.help) {
      process.stdout.write(`${result.usage}\n`);
      return;
    }
    process.stderr.write(`${result.summary}\n`);
    process.stdout.write(`${JSON.stringify(result.audit, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Discovery audit failed: ${error.message}\n${usage()}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
