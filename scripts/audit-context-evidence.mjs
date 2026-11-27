import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import "../libs/tga-codec-main/tga.js";

import {
  loadLocalDiscoveryBundle,
  loadRemoteDiscoveryBundle,
  parseDiscoveryAuditArguments,
  restoreDiscoveryNpmArguments
} from "./audit-discovery-evidence.mjs";
import {
  createDiscoveryCatalog,
  createDiscoveryContextAudit,
  createDiscoveryContextCatalog,
  formatDiscoveryContextAuditSummary
} from "../modules/discovery/index.js";
import { createPoliticalAreaIndex } from "../modules/political/index.js";
import { createScenarioLensProjection, normalizeScenarioBaseline } from "../modules/scenario/index.js";
import { ScenarioSession } from "../stores/scenario-session.js";

export const parseContextAuditArguments = parseDiscoveryAuditArguments;
export const restoreContextNpmArguments = restoreDiscoveryNpmArguments;

function usage() {
  return [
    "Usage:",
    "  npm run audit:context -- --manifest-id <manifest-id>",
    "  npm run audit:context -- --bundle <directory-or-contract.json>"
  ].join("\n");
}

function decodeRaster(buffer) {
  if (typeof globalThis.tgaCodec?.decodeTga !== "function") {
    throw new Error("The project-owned TGA decoder is unavailable.");
  }
  return globalThis.tgaCodec.decodeTga(new Uint8Array(buffer));
}

async function fetchRaster(contract, fetchImpl) {
  const url = contract.assets?.areasMap?.url;
  if (!url) throw new Error(`Manifest '${contract.userData.manifestId}' has no areas raster.`);
  const response = await fetchImpl(url, { credentials: "omit" });
  if (!response?.ok) {
    throw new Error(`Areas raster request failed with HTTP ${String(response?.status ?? "unknown")}.`);
  }
  return response.arrayBuffer();
}

async function localRaster(inputPath, contract) {
  const absolute = resolve(inputPath);
  const details = await stat(absolute);
  const root = details.isDirectory() ? absolute : dirname(absolute);
  const assetUrl = contract.assets?.areasMap?.url;
  if (!assetUrl) throw new Error("Local bundle contract has no areas raster.");
  let pathname;
  try {
    pathname = new URL(assetUrl).pathname.replace(/^\/+/, "");
  } catch {
    pathname = String(assetUrl).replace(/^\/+/, "");
  }
  for (const path of [join(root, pathname), join(root, basename(pathname)), join(root, "areasmap.tga")]) {
    try {
      if ((await stat(path)).isFile()) return readFile(path);
    } catch {
      // Try the next deterministic local-bundle convention.
    }
  }
  throw new Error("Local bundle is missing the referenced areas raster.");
}

export function auditContextBundle({ contract, datasets, rasterBuffer }) {
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
  const discoveryCatalog = createDiscoveryCatalog({ datasets, baseline });
  const contextCatalog = createDiscoveryContextCatalog({
    discoveryCatalog,
    datasets,
    baseline
  });
  const areaIndex = createPoliticalAreaIndex({
    raster: decodeRaster(rasterBuffer),
    spawnAreas: baseline.spawnAreas
  });
  return createDiscoveryContextAudit({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    areaIndex,
    manifest: contract.manifest
  });
}

export async function runContextAudit(argv, { fetchImpl = globalThis.fetch } = {}) {
  const options = parseContextAuditArguments(argv);
  if (options.help) return { help: true, usage: usage(), audit: null, summary: null };
  const bundle = options.manifestId
    ? await loadRemoteDiscoveryBundle(options.manifestId, fetchImpl, ["weaponManufacturers"])
    : await loadLocalDiscoveryBundle(options.bundlePath, ["weaponManufacturers"]);
  bundle.rasterBuffer = options.manifestId
    ? await fetchRaster(bundle.contract, fetchImpl)
    : await localRaster(options.bundlePath, bundle.contract);
  const audit = auditContextBundle(bundle);
  return { help: false, usage: null, audit, summary: formatDiscoveryContextAuditSummary(audit) };
}

async function main() {
  try {
    const argv = restoreContextNpmArguments(process.argv.slice(2));
    const result = await runContextAudit(argv);
    if (result.help) {
      process.stdout.write(`${result.usage}\n`);
      return;
    }
    process.stderr.write(`${result.summary}\n`);
    process.stdout.write(`${JSON.stringify(result.audit, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Context audit failed: ${error.message}\n${usage()}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
