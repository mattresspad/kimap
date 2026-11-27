import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { KENSHI_ASSET_VERSION, KENSHI_CDN_BASE } from "../modules/asset-url.js";

export const DEFAULT_WORKER_ASSET_CONTROL = "icons/ecosystem/wiki-icon.svg";

const ACTIVE_WORKER_ROOTS = Object.freeze(["icons/", "data/overlays/"]);
const PROBE_PARAMETER = "kimap-check";
const DEFAULT_TIMEOUT_MS = 10_000;

const CONTENT_TYPES_BY_EXTENSION = Object.freeze({
  ".css": Object.freeze(["text/css"]),
  ".gif": Object.freeze(["image/gif"]),
  ".ico": Object.freeze(["image/x-icon", "image/vnd.microsoft.icon"]),
  ".jpeg": Object.freeze(["image/jpeg"]),
  ".jpg": Object.freeze(["image/jpeg"]),
  ".js": Object.freeze(["application/javascript", "text/javascript"]),
  ".json": Object.freeze(["application/json"]),
  ".png": Object.freeze(["image/png"]),
  ".svg": Object.freeze(["image/svg+xml"]),
  ".tga": Object.freeze(["image/x-tga", "image/tga", "application/octet-stream"]),
  ".webp": Object.freeze(["image/webp"]),
  ".woff": Object.freeze(["font/woff", "application/font-woff"]),
  ".woff2": Object.freeze(["font/woff2", "application/font-woff2"])
});

function usage() {
  return [
    "Usage:",
    "  npm run check:worker-assets -- <asset> [<asset> ...]",
    "",
    "Assets may be active Worker paths such as icons/name.svg or data/overlays/name.webp.",
    "A bare filename is resolved beneath icons/. Full URLs must use the configured Worker origin.",
    "",
    "Options:",
    `  --control <asset>  Known-good R2 control (default: ${DEFAULT_WORKER_ASSET_CONTROL})`,
    "  --no-control       Skip the known-good endpoint control",
    `  --timeout <ms>     Per-request timeout (default: ${String(DEFAULT_TIMEOUT_MS)})`,
    "  --help             Show this help"
  ].join("\n");
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    throw new TypeError(`Worker asset path has invalid URL encoding: ${pathname}`);
  }
}

export function normalizeWorkerAssetPath(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) throw new TypeError("Worker asset path cannot be empty.");

  let candidate = rawValue;
  if (!candidate.includes("/") && !candidate.includes("\\")) candidate = `icons/${candidate}`;
  candidate = candidate.replace(/\\/g, "/");

  let url;
  try {
    url = new URL(candidate, `${KENSHI_CDN_BASE}/`);
  } catch {
    throw new TypeError(`Worker asset path is not a valid URL: ${rawValue}`);
  }

  if (url.origin !== new URL(KENSHI_CDN_BASE).origin) {
    throw new TypeError(`Worker asset URL must use ${KENSHI_CDN_BASE}: ${rawValue}`);
  }

  const decodedPath = decodePathname(url.pathname).replace(/^\/+/, "");
  const rawPath = candidate.split(/[?#]/, 1)[0];
  const decodedRawPath = decodePathname(rawPath);
  if (decodedRawPath.split("/").some((segment) => segment === "..")) {
    throw new TypeError(`Worker asset path cannot contain '..': ${rawValue}`);
  }
  if (!ACTIVE_WORKER_ROOTS.some((root) => decodedPath.startsWith(root))) {
    throw new TypeError(
      `Worker asset path must use an active KiMap root (${ACTIVE_WORKER_ROOTS.join(", ")}): ${rawValue}`
    );
  }
  if (decodedPath.endsWith("/")) {
    throw new TypeError(`Worker asset path must identify a file: ${rawValue}`);
  }

  return Object.freeze({ assetPath: decodedPath, search: url.search });
}

export function buildWorkerAssetUrls(
  value,
  { version = KENSHI_ASSET_VERSION, probeToken = "manual" } = {}
) {
  const asset = normalizeWorkerAssetPath(value);
  const publicUrl = new URL(`${KENSHI_CDN_BASE}/${asset.assetPath}`);
  publicUrl.search = asset.search;
  if (version && !publicUrl.searchParams.has("v")) publicUrl.searchParams.set("v", version);

  const probeUrl = new URL(publicUrl);
  probeUrl.searchParams.set(PROBE_PARAMETER, String(probeToken));

  return Object.freeze({
    assetPath: asset.assetPath,
    publicUrl: publicUrl.toString(),
    probeUrl: probeUrl.toString()
  });
}

export function parseWorkerAssetArguments(argv) {
  const options = {
    assets: [],
    control: DEFAULT_WORKER_ASSET_CONTROL,
    help: false,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--no-control") {
      options.control = null;
      continue;
    }
    if (argument === "--control") {
      const value = argv[index + 1];
      if (!value) throw new TypeError("--control requires an asset path.");
      options.control = value;
      index += 1;
      continue;
    }
    if (argument === "--timeout") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 100 || value > 120_000) {
        throw new TypeError("--timeout must be an integer from 100 to 120000 milliseconds.");
      }
      options.timeoutMs = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) throw new TypeError(`Unknown option: ${argument}`);
    options.assets.push(argument);
  }

  options.assets = [...new Set(options.assets)];
  return Object.freeze({
    ...options,
    assets: Object.freeze(options.assets)
  });
}

function header(response, name) {
  return response?.headers?.get?.(name)?.trim() ?? "";
}

function expectedContentTypes(assetPath) {
  return CONTENT_TYPES_BY_EXTENSION[extname(assetPath).toLowerCase()] ?? Object.freeze([]);
}

function matchesContentType(assetPath, contentType) {
  const actual = contentType.split(";", 1)[0].trim().toLowerCase();
  const expected = expectedContentTypes(assetPath);
  return expected.length === 0
    ? Boolean(actual) && actual !== "text/html"
    : expected.includes(actual);
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function failure(urls, outcome, details = {}) {
  return Object.freeze({ ...urls, ok: false, outcome, ...details });
}

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error.cause : null;
  const causeMessage =
    cause && typeof cause === "object"
      ? [cause.code, cause.message].filter(Boolean).join(" ")
      : cause
        ? String(cause)
        : "";
  return causeMessage && causeMessage !== message ? `${message} (${causeMessage})` : message;
}

export async function checkWorkerAsset(
  value,
  {
    fetchImpl = globalThis.fetch,
    probeToken = "manual",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    version = KENSHI_ASSET_VERSION
  } = {}
) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const urls = buildWorkerAssetUrls(value, { version, probeToken });

  let probe;
  try {
    probe = await fetchWithTimeout(
      fetchImpl,
      urls.probeUrl,
      { method: "HEAD", redirect: "manual" },
      timeoutMs
    );
  } catch (error) {
    return failure(urls, "inconclusive", {
      phase: "probe",
      message: describeError(error)
    });
  }

  const probeSource = header(probe, "x-kenshi-asset-source").toLowerCase();
  const r2Key = header(probe, "x-kenshi-r2-key");
  const expectedR2Key = `kimap/${urls.assetPath}`;
  if (!probe.ok) {
    return failure(urls, probe.status === 404 || probe.status === 410 ? "missing" : "http-error", {
      phase: "probe",
      httpStatus: probe.status,
      source: probeSource,
      r2Key
    });
  }

  let delivery;
  try {
    delivery = await fetchWithTimeout(
      fetchImpl,
      urls.publicUrl,
      { method: "GET", redirect: "manual" },
      timeoutMs
    );
  } catch (error) {
    return failure(urls, "inconclusive", {
      phase: "delivery",
      httpStatus: probe.status,
      source: probeSource,
      r2Key,
      message: describeError(error)
    });
  }

  const deliverySource = header(delivery, "x-kenshi-asset-source").toLowerCase();
  const contentType = header(delivery, "content-type");
  if (!delivery.ok) {
    return failure(
      urls,
      delivery.status === 404 || delivery.status === 410 ? "missing" : "http-error",
      {
        phase: "delivery",
        httpStatus: delivery.status,
        source: probeSource,
        deliverySource,
        r2Key,
        contentType
      }
    );
  }

  let body;
  try {
    body = await delivery.arrayBuffer();
  } catch (error) {
    return failure(urls, "inconclusive", {
      phase: "delivery-body",
      httpStatus: delivery.status,
      source: probeSource,
      deliverySource,
      r2Key,
      contentType,
      message: describeError(error)
    });
  }

  const bytes = body.byteLength;
  if (bytes === 0) {
    return failure(urls, "empty", {
      phase: "delivery-body",
      httpStatus: delivery.status,
      source: probeSource,
      deliverySource,
      r2Key,
      contentType,
      bytes
    });
  }
  if (!matchesContentType(urls.assetPath, contentType)) {
    return failure(urls, "invalid-content-type", {
      phase: "delivery",
      httpStatus: delivery.status,
      source: probeSource,
      deliverySource,
      r2Key,
      contentType,
      bytes,
      expectedContentTypes: expectedContentTypes(urls.assetPath)
    });
  }
  if (probeSource !== "r2") {
    return failure(urls, probeSource === "origin" ? "origin-fallback" : "unverified-source", {
      phase: "probe",
      httpStatus: probe.status,
      source: probeSource,
      deliverySource,
      r2Key,
      contentType,
      bytes
    });
  }
  if (r2Key !== expectedR2Key) {
    return failure(urls, "unverified-source", {
      phase: "probe",
      httpStatus: probe.status,
      source: probeSource,
      deliverySource,
      r2Key,
      expectedR2Key,
      contentType,
      bytes
    });
  }

  return Object.freeze({
    ...urls,
    ok: true,
    outcome: "delivered-from-r2",
    httpStatus: delivery.status,
    source: probeSource,
    deliverySource,
    r2Key,
    contentType,
    bytes
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "unknown size";
  if (bytes < 1024) return `${String(bytes)} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export function formatWorkerAssetResult(result, role = "asset") {
  const status = result.ok ? "PASS" : result.outcome === "inconclusive" ? "INCONCLUSIVE" : "FAIL";
  const details = result.ok
    ? `R2; ${String(result.httpStatus)} ${result.contentType}; ${formatBytes(result.bytes)}`
    : [
        result.outcome,
        result.httpStatus ? `HTTP ${String(result.httpStatus)}` : "",
        result.source ? `source=${result.source}` : "",
        result.contentType || "",
        Number.isFinite(result.bytes) ? formatBytes(result.bytes) : "",
        result.message || ""
      ]
        .filter(Boolean)
        .join("; ");
  return `[${status}] ${role} ${result.assetPath} — ${details}`;
}

export async function runWorkerAssetChecks(
  options,
  {
    fetchImpl = globalThis.fetch,
    probeToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    write = () => {}
  } = {}
) {
  const check = async (value, role) => {
    const urls = buildWorkerAssetUrls(value, { probeToken });
    write(`\nChecking ${role}: ${urls.assetPath}`);
    write(`Public URL: ${urls.publicUrl}`);
    write(`Fresh R2 probe: ${urls.probeUrl}`);
    const result = await checkWorkerAsset(value, {
      fetchImpl,
      probeToken,
      timeoutMs: options.timeoutMs
    });
    write(formatWorkerAssetResult(result, role));
    return result;
  };

  const controlResult = options.control ? await check(options.control, "control") : null;
  const results = [];
  for (const asset of options.assets) results.push(await check(asset, "asset"));

  const passing = results.filter((result) => result.ok).length;
  const inconclusive = results.filter((result) => result.outcome === "inconclusive").length;
  const failing = results.length - passing - inconclusive;
  const controlFailed = Boolean(controlResult && !controlResult.ok);
  const exitCode = controlFailed || inconclusive > 0 ? 2 : failing > 0 ? 1 : 0;
  write(
    `\nSummary: ${String(passing)} delivered from R2, ${String(failing)} failed, ${String(inconclusive)} inconclusive.`
  );
  if (controlFailed) {
    write(
      "The known-good control did not pass, so target failures are not sufficient evidence that an R2 object is absent."
    );
  }

  return Object.freeze({
    control: controlResult,
    results: Object.freeze(results),
    exitCode
  });
}

async function main() {
  try {
    const options = parseWorkerAssetArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    if (options.assets.length === 0) throw new TypeError("Provide at least one Worker asset path.");
    const result = await runWorkerAssetChecks(options, {
      write: (line) => process.stdout.write(`${line}\n`)
    });
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`Worker asset check could not run: ${error.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
