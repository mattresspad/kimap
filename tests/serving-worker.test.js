import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.mjs";

const request = (path, method = "GET") => new Request("https://map.example" + path, { method });
test("art redirects keep the query, and unsupported operations cannot reach storage", async () => {
  const result = await worker.fetch(request("/icons/example.svg?v=1"), {});
  assert.equal(result.status, 307);
  assert.equal(
    result.headers.get("location"),
    "https://kim-assets.kenshi.wiki/icons/example.svg?v=1"
  );
  assert.equal((await worker.fetch(request("/map-data/vanilla.json", "POST"), {})).status, 405);
  assert.equal((await worker.fetch(request("/api.php"), {})).status, 404);
});
test("bootstrap revalidates, datasets are immutable and missing reads are identified", async () => {
  const seen = [];
  const item = {
    body: "{}",
    size: 2,
    httpEtag: '"sample"',
    writeHttpMetadata: (h) => h.set("Content-Type", "application/json")
  };
  const binding = {
    get: async (key) => {
      seen.push(key);
      return item;
    },
    head: async () => item
  };
  const bootstrap = await worker.fetch(request("/map-data/vanilla.json"), { MAP_DATA: binding });
  assert.equal(bootstrap.headers.get("cache-control"), "no-cache");
  assert.deepEqual(seen, ["map-data/vanilla.json"]);
  const data = await worker.fetch(request("/data/vanilla/sample/1/towns.json", "HEAD"), {
    MAP_DATA: binding
  });
  assert.equal(await data.text(), "");
  assert.equal(data.headers.get("x-kimap-source"), "r2");
  assert.match(data.headers.get("cache-control"), /immutable/);
  const miss = await worker.fetch(request("/map-data/vanilla.json"), {
    MAP_DATA: { get: async () => null }
  });
  assert.equal(miss.status, 404);
  assert.equal(miss.headers.get("x-kimap-source"), "r2-miss");
  assert.equal(miss.headers.get("cache-control"), "no-store");
});
