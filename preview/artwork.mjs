import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { BASE_MAP_IMAGES, LEGACY_BASE_MAP } from "../modules/viewport/base-map-resolution.js";
import { sampleLandmarks } from "./fixture.mjs";

export async function startArtwork(port) {
  const asset = (name) => readFile(new URL("./art/" + name, import.meta.url));
  const [survey, compass, bitmapIcon, biome] = await Promise.all(
    ["survey.webp", "compass.svg", "compass.png", "biome.png"].map(asset)
  );
  const files = new Map(
    [...BASE_MAP_IMAGES, LEGACY_BASE_MAP].map(({ path }) => ["/" + path, ["image/webp", survey]])
  );
  for (const [name, value] of Object.entries({
    features_refined: sampleLandmarks.features,
    fog_features_clean: sampleLandmarks.fog,
    landmarks_whitelist: sampleLandmarks.whitelist
  }))
    files.set("/data/overlays/" + name + ".json", ["application/json", JSON.stringify(value)]);
  files.set("/data/overlays/biomemap.png", ["image/png", biome]);
  files.set("/data/overlays/Vanilla_RoadNetwork.svg", [
    "image/svg+xml",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M32 390 192 310 256 256 330 245 470 150" fill="none" stroke="#f0c979" stroke-width="3"/></svg>'
  ]);
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
    if (request.method === "OPTIONS") {
      response.writeHead(204, headers).end();
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, headers).end();
      return;
    }
    let file = files.get(path);
    // The miniature world uses one original symbol throughout its icon palette.
    if (/^\/icons\/.+\.svg$/.test(path)) file = ["image/svg+xml", compass];
    if (/^\/icons\/.+\.png$/.test(path)) file = ["image/png", bitmapIcon];
    if (!file) {
      response.writeHead(404, headers).end();
      return;
    }
    response.writeHead(200, { ...headers, "Content-Type": file[0] });
    response.end(request.method === "HEAD" ? undefined : file[1]);
  });
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(port, "127.0.0.1", resolve)
  );
  return {
    origin: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
