import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { startArtwork } from "./artwork.mjs";
import { createPublication } from "./fixture.mjs";

const root = resolve(import.meta.dirname, "..");
export async function startFixture({ port = 0, artPort = 0 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "kimap-survey-"));
  let art;
  let runtime;
  async function close() {
    try {
      await runtime?.dispose();
    } finally {
      try {
        await art?.close();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
  try {
    art = await startArtwork(artPort);
    execFileSync(process.execPath, [join(root, "scripts/build-site.mjs")], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, KIM_SITE_DIR: directory, KIM_ASSET_ORIGIN: art.origin }
    });
    const worker = {
      name: "kim-data-store",
      modules: true,
      compatibilityDate: "2026-11-04",
      script: await readFile(join(root, "worker/index.mjs"), "utf8"),
      bindings: { ART_ORIGIN: art.origin },
      r2Buckets: { MAP_DATA: "sample-data" },
      assets: {
        directory,
        binding: "SHELL",
        run_worker_first: true,
        routerConfig: { has_user_worker: true },
        assetConfig: { not_found_handling: "none" }
      },
      outboundService: (request) => {
        throw Error("Unexpected fixture network request: " + request.url);
      }
    };
    runtime = new Miniflare(
      convertV4MiniflareOptions({ host: "127.0.0.1", port, cf: false, workers: [worker] })
    );
    const bucket = await runtime.getR2Bucket("MAP_DATA");
    const { map, objects } = createPublication(art.origin);
    for (const [path, object] of objects) {
      await bucket.put(path.slice(1), object.body, { httpMetadata: { contentType: object.type } });
    }
    return { origin: (await runtime.ready).origin, artwork: art.origin, map, bucket, close };
  } catch (error) {
    await close();
    throw error;
  }
}
