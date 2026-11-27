import { startFixture } from "./runtime.mjs";

const preview = await startFixture({
  port: Number(process.env.PORT || 8797),
  artPort: Number(process.env.KIM_ASSET_PORT || 8798)
});
console.log("Open the Survey Station map at " + preview.origin);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => preview.close());
