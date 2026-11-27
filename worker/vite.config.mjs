import { resolve } from "node:path";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  publicDir: resolve(import.meta.dirname, "../dist/site"),
  build: { outDir: "dist/worker" },
  plugins: [cloudflare()]
});
