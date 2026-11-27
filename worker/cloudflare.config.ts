import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./index.mjs" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "kim-data-store",
    compatibilityDate: "2026-11-04",
    entrypoint,
    workersDev: true,
    domains: ["map.kenshi.wiki"],
    previewUrls: true,
    assets: { runWorkerFirst: true },
    observability: { enabled: true },
    env: { MAP_DATA: bindings.r2({ name: "kim-data-store" }), SHELL: bindings.assets() }
  }
});
