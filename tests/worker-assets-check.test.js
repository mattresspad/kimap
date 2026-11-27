import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildWorkerAssetUrls,
  checkWorkerAsset,
  normalizeWorkerAssetPath,
  parseWorkerAssetArguments,
  runWorkerAssetChecks
} from "../scripts/check-worker-assets.mjs";

function mockResponse({
  body = "<svg></svg>",
  contentType = "image/svg+xml",
  r2Key = "kimap/icons/example.svg",
  source = "r2",
  status = 200
} = {}) {
  const bytes = new TextEncoder().encode(body);
  const headers = new Headers({
    "content-type": contentType,
    "x-kenshi-asset-source": source
  });
  if (r2Key) headers.set("x-kenshi-r2-key", r2Key);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    async arrayBuffer() {
      return bytes.buffer;
    }
  };
}

test("worker asset paths use active KiMap roots and bare filenames resolve to icons", () => {
  assert.deepEqual(normalizeWorkerAssetPath("example.svg"), {
    assetPath: "icons/example.svg",
    search: ""
  });
  assert.equal(
    normalizeWorkerAssetPath("data/overlays/base-map/example.webp").assetPath,
    "data/overlays/base-map/example.webp"
  );
  assert.throws(() => normalizeWorkerAssetPath("data/vanilla/example.json"), /active KiMap root/);
  assert.throws(() => normalizeWorkerAssetPath("icons/../secret.svg"), /cannot contain/);
  assert.throws(
    () => normalizeWorkerAssetPath("https://example.com/icons/example.svg"),
    /must use/
  );
});

test("worker asset URLs preserve explicit versions and isolate the fresh R2 probe", () => {
  const generated = buildWorkerAssetUrls("icons/example.svg", { probeToken: "test-token" });
  const publicUrl = new URL(generated.publicUrl);
  const probeUrl = new URL(generated.probeUrl);
  assert.equal(publicUrl.searchParams.get("v"), "2026-07-13-1");
  assert.equal(publicUrl.searchParams.has("kimap-check"), false);
  assert.equal(probeUrl.searchParams.get("v"), "2026-07-13-1");
  assert.equal(probeUrl.searchParams.get("kimap-check"), "test-token");

  const explicit = new URL(
    buildWorkerAssetUrls("icons/example.svg?v=owner-revision", { probeToken: "test-token" })
      .publicUrl
  );
  assert.equal(explicit.searchParams.get("v"), "owner-revision");
});

test("argument parsing retains a control, deduplicates assets, and validates timeout", () => {
  assert.deepEqual(
    parseWorkerAssetArguments([
      "--control",
      "icons/control.svg",
      "--timeout",
      "2500",
      "example.svg",
      "example.svg"
    ]),
    {
      assets: ["example.svg"],
      control: "icons/control.svg",
      help: false,
      timeoutMs: 2500
    }
  );
  assert.throws(() => parseWorkerAssetArguments(["--timeout", "soon"]), /integer/);
  assert.throws(() => parseWorkerAssetArguments(["--unknown"]), /Unknown option/);
});

test("a fresh R2 HEAD plus readable versioned GET passes", async () => {
  const requests = [];
  const result = await checkWorkerAsset("example.svg", {
    probeToken: "unit",
    fetchImpl: async (url, options) => {
      requests.push({ url, method: options.method });
      return mockResponse();
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "delivered-from-r2");
  assert.equal(result.bytes, 11);
  assert.deepEqual(
    requests.map(({ method }) => method),
    ["HEAD", "GET"]
  );
  assert.equal(new URL(requests[0].url).searchParams.get("kimap-check"), "unit");
  assert.equal(new URL(requests[1].url).searchParams.has("kimap-check"), false);
});

test("origin fallback is readable but does not count as an R2 publication", async () => {
  const result = await checkWorkerAsset("example.svg", {
    fetchImpl: async () => mockResponse({ source: "origin", r2Key: "" })
  });

  assert.equal(result.ok, false);
  assert.equal(result.outcome, "origin-fallback");
  assert.equal(result.bytes, 11);
});

test("an R2 source header with the wrong key is not accepted", async () => {
  const result = await checkWorkerAsset("example.svg", {
    fetchImpl: async () => mockResponse({ r2Key: "kimap/icons/different.svg" })
  });

  assert.equal(result.ok, false);
  assert.equal(result.outcome, "unverified-source");
  assert.equal(result.expectedR2Key, "kimap/icons/example.svg");
});

test("HTTP absence and transport failure remain distinguishable", async () => {
  const missing = await checkWorkerAsset("example.svg", {
    fetchImpl: async () => mockResponse({ status: 404, source: "origin", r2Key: "" })
  });
  assert.equal(missing.outcome, "missing");

  const unavailable = await checkWorkerAsset("example.svg", {
    fetchImpl: async () => {
      throw new Error("network disabled");
    }
  });
  assert.equal(unavailable.outcome, "inconclusive");
  assert.match(unavailable.message, /network disabled/);
});

test("content validation rejects empty or mislabeled successful responses", async () => {
  const empty = await checkWorkerAsset("example.svg", {
    fetchImpl: async (_url, options) =>
      options.method === "HEAD" ? mockResponse() : mockResponse({ body: "" })
  });
  assert.equal(empty.outcome, "empty");

  const mislabeled = await checkWorkerAsset("example.svg", {
    fetchImpl: async () => mockResponse({ contentType: "text/html" })
  });
  assert.equal(mislabeled.outcome, "invalid-content-type");
});

test("a failed known-good control makes an otherwise missing run inconclusive", async () => {
  const output = [];
  const result = await runWorkerAssetChecks(
    {
      assets: ["missing.svg"],
      control: "control.svg",
      timeoutMs: 1000
    },
    {
      probeToken: "unit",
      write: (line) => output.push(line),
      fetchImpl: async () => {
        throw new Error("network disabled");
      }
    }
  );

  assert.equal(result.exitCode, 2);
  assert.equal(result.control.outcome, "inconclusive");
  assert.equal(result.results[0].outcome, "inconclusive");
  assert.match(output.join("\n"), /not sufficient evidence/);
});

test("the package and project guidance expose the durable Worker check", async () => {
  const [packageSource, readme, agents] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8")
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.scripts["check:worker-assets"], "node scripts/check-worker-assets.mjs");
  assert.match(readme, /npm run check:worker-assets -- icons\/caravan-save-simple\.svg/);
  assert.match(readme, /Exit code `2` means .* inconclusive/);
  assert.match(agents, /Before reporting a stable Worker icon or overlay as absent from R2/);
  assert.match(agents, /Exit code 2 is inconclusive, never proof of absence/);
});
