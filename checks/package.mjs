import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
export const buildOutput = join(root, "worker/.cloudflare/output");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function inventory(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) files.push(...(await inventory(directory, path + "/")));
    else {
      assert.ok(entry.isFile(), "Unexpected non-file: " + path);
      files.push({ path, sha256: digest(await readFile(join(directory, path))) });
    }
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
export async function inspectPackage() {
  const worker = join(buildOutput, "v0/workers/default");
  const config = JSON.parse(await readFile(join(worker, "worker.config.json"), "utf8"));
  assert.equal(config.name, "kim-data-store");
  assert.equal(config.compatibilityDate, "2026-11-04");
  assert.equal(config.assets.runWorkerFirst, true);
  assert.equal(config.previewUrls, true);
  assert.deepEqual(config.domains, ["map.kenshi.wiki"]);
  assert.deepEqual(config.env, {
    MAP_DATA: { type: "r2", name: "kim-data-store" },
    SHELL: { type: "assets" }
  });
  const shell = await inventory(join(worker, "assets"));
  assert.deepEqual(
    shell,
    await inventory(join(root, "dist/site")),
    "Package must contain the tested shell bytes"
  );
  for (const { path } of shell) {
    assert.match(
      path,
      /^(?:index\.html$|favicon\.ico$|dist\/(?:bundle\.(?:js|css)$|assets\/[^/]+\.woff2$)|libs\/tga-codec-main\/tga\.js$|vendor\/(?:d3|leaflet)\/|notices\/)/
    );
  }
  for (const file of [
    "index.html",
    "dist/bundle.js",
    "dist/bundle.css",
    "libs/tga-codec-main/tga.js",
    "notices/TGA-MIT.txt",
    "notices/Exo2-OFL.txt"
  ]) {
    assert.ok(
      shell.some((item) => item.path === file),
      "Missing " + file
    );
  }
  const html = await readFile(join(worker, "assets/index.html"), "utf8");
  assert.ok(html.includes("https://kim-assets.kenshi.wiki"));
  assert.ok(!html.includes("%KIM_ASSET_ORIGIN%") && !html.includes("127.0.0.1"));
  return { packageSha256: digest(JSON.stringify(await inventory(buildOutput))), shell };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { packageSha256, shell } = await inspectPackage();
  console.log("Verified", shell.length, "public shell files. Package SHA-256:", packageSha256);
}
