import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createDevRequestHandler } from "../scripts/dev-server-lib.mjs";
import { BASE_MAP_IMAGES, baseMapPreviewPath } from "../modules/viewport/base-map-resolution.js";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

async function withServer(fetchImpl, callback) {
  const root = mkdtempSync(join(tmpdir(), "kimap-static-"));
  const image = join(root, BASE_MAP_IMAGES[0].path);
  mkdirSync(dirname(image), { recursive: true });
  copyFileSync(new URL("../preview/art/survey.webp", import.meta.url), image);
  const server = createServer(createDevRequestHandler({ root, fetchImpl }));

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    rmSync(root, { recursive: true, force: true });
  }
}

test("base-map preview serves only registered local images without an upstream fallback", async () => {
  await withServer(
    () => assert.fail("preview must not fetch production"),
    async (origin) => {
      const record = BASE_MAP_IMAGES[0];
      const response = await fetch(origin + baseMapPreviewPath(record));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/webp");
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        readFileSync(new URL("../preview/art/survey.webp", import.meta.url))
      );
      assert.equal((await fetch(origin + "/__dev/base-map/unknown.webp")).status, 404);
      assert.equal(
        (await fetch(origin + baseMapPreviewPath(record), { method: "POST" })).status,
        405
      );
    }
  );
});

test("a missing local API or Vanilla object cannot reach a production origin", async () => {
  await withServer(
    () => assert.fail("external access"),
    async (origin) => {
      for (const path of ["/api.php", "/data/vanilla/absent/file.json"]) {
        assert.equal((await fetch(origin + path)).status, 404);
      }
    }
  );
});
