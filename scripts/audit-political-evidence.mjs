import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import "../libs/tga-codec-main/tga.js";
import { parseMapDataResponse } from "../modules/map-contract.js";
import {
  createPoliticalAreaIndex,
  createPoliticalAudit,
  createPoliticalEvidenceCatalog,
  formatPoliticalAuditSummary,
  projectPoliticalEvidence
} from "../modules/political/index.js";
import { normalizeScenarioBaseline } from "../modules/scenario/index.js";
import { ScenarioSession } from "../stores/scenario-session.js";

const CARAVAN_API_URL = "https://kenshi.wiki/api.php";
const MANIFEST_DATA_ORIGIN = "https://map.kenshi.wiki";
const POLITICAL_DATASET_KEYS = Object.freeze([
  "characters",
  "factions",
  "worldStates",
  "townFcsData",
  "spawnAreas",
  "squads",
  "mapData",
  "colourSchemes"
]);

export function parseAuditArguments(argv) {
  let manifestId = null;
  let bundlePath = null;
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--manifest-id") {
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

export function restoreNpmForwardedArguments(argv, environment = process.env) {
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
    "  npm run audit:political -- --manifest-id <manifest-id>",
    "  npm run audit:political -- --bundle <directory-or-contract.json>"
  ].join("\n");
}

function apiEnvelope(value) {
  return value?.getmapdata ? value : { getmapdata: value };
}

async function fetchOk(url, responseType, fetchImpl) {
  const response = await fetchImpl(url, { credentials: "omit" });
  if (!response?.ok) {
    throw new Error(`Request failed with HTTP ${String(response?.status ?? "unknown")}: ${url}`);
  }
  return responseType === "json" ? response.json() : response.arrayBuffer();
}

function parseContract(value) {
  return parseMapDataResponse(apiEnvelope(value), { manifestDataOrigin: MANIFEST_DATA_ORIGIN });
}

export async function loadRemotePoliticalBundle(manifestId, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable.");
  const url = new URL(CARAVAN_API_URL);
  url.searchParams.set("action", "getmapdata");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("manifestId", manifestId);
  const response = await fetchOk(url.toString(), "json", fetchImpl);
  const contract = parseContract(response);
  if (contract.userData.manifestId !== manifestId) {
    throw new Error(
      `Caravan resolved manifest '${contract.userData.manifestId}' instead of requested '${manifestId}'.`
    );
  }
  if (!contract.assets.areasMap.url) {
    throw new Error(`Manifest '${manifestId}' has no areas raster.`);
  }
  const entries = await Promise.all(
    POLITICAL_DATASET_KEYS.map(async (key) => [
      key,
      await fetchOk(contract.datasets[key].url, "json", fetchImpl)
    ])
  );
  const rasterBuffer = await fetchOk(contract.assets.areasMap.url, "arrayBuffer", fetchImpl);
  return { contract, datasets: Object.fromEntries(entries), rasterBuffer };
}

async function firstReadable(paths) {
  for (const path of paths) {
    try {
      const details = await stat(path);
      if (details.isFile()) return path;
    } catch {
      // Try the next deterministic local-bundle convention.
    }
  }
  return null;
}

function descriptorCandidates(root, descriptor, fallbackName) {
  let pathname = "";
  try {
    pathname = new URL(descriptor.url, MANIFEST_DATA_ORIGIN).pathname.replace(/^\/+/, "");
  } catch {
    pathname = String(descriptor.url ?? "").replace(/^\/+/, "");
  }
  return [join(root, pathname), join(root, basename(pathname)), join(root, fallbackName)];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadLocalPoliticalBundle(inputPath) {
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
  for (const key of POLITICAL_DATASET_KEYS) {
    const descriptor = rawResult.datasets[key];
    const path = await firstReadable(descriptorCandidates(root, descriptor, `${key}.json`));
    if (!path) throw new Error(`Local bundle is missing dataset '${key}'.`);
    entries.push([key, await readJson(path)]);
  }

  const rawAsset = rawResult.assets.areasMap;
  if (!rawAsset?.url) throw new Error("Local bundle contract has no areas raster.");
  const rasterPath = await firstReadable(
    descriptorCandidates(root, rawAsset, basename(String(rawAsset.url)))
  );
  if (!rasterPath) throw new Error("Local bundle is missing the referenced areas raster.");
  const rasterBuffer = await readFile(rasterPath);
  return { contract, datasets: Object.fromEntries(entries), rasterBuffer };
}

function decodeRaster(buffer) {
  if (typeof globalThis.tgaCodec?.decodeTga !== "function") {
    throw new Error("The project-owned TGA decoder is unavailable.");
  }
  return globalThis.tgaCodec.decodeTga(new Uint8Array(buffer));
}

export function auditPoliticalBundle({ contract, datasets, rasterBuffer }) {
  const baseline = normalizeScenarioBaseline({ contract, datasets });
  const snapshot = new ScenarioSession(baseline).getSnapshot();
  const areaIndex = createPoliticalAreaIndex({
    raster: decodeRaster(rasterBuffer),
    spawnAreas: baseline.spawnAreas
  });
  const catalog = createPoliticalEvidenceCatalog({ baseline, areaIndex });
  const projection = projectPoliticalEvidence({ catalog, snapshot });
  return createPoliticalAudit({ projection, manifest: contract.manifest });
}

export async function runPoliticalAudit(argv, { fetchImpl = globalThis.fetch } = {}) {
  const options = parseAuditArguments(argv);
  if (options.help) return { help: true, usage: usage(), audit: null, summary: null };
  const bundle = options.manifestId
    ? await loadRemotePoliticalBundle(options.manifestId, fetchImpl)
    : await loadLocalPoliticalBundle(options.bundlePath);
  const audit = auditPoliticalBundle(bundle);
  return {
    help: false,
    usage: null,
    audit,
    summary: formatPoliticalAuditSummary(audit)
  };
}

async function main() {
  try {
    const argv = restoreNpmForwardedArguments(process.argv.slice(2));
    const result = await runPoliticalAudit(argv);
    if (result.help) {
      process.stdout.write(`${result.usage}\n`);
      return;
    }
    process.stderr.write(`${result.summary}\n`);
    process.stdout.write(`${JSON.stringify(result.audit, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Political audit failed: ${error.message}\n${usage()}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
