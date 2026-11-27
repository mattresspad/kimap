import assert from "node:assert/strict";
import test from "node:test";
import {
  KENSHI_ASSET_VERSION,
  isMutableManifestAssetPath,
  kenshiAssetUrl
} from "../modules/asset-url.js";

test("mutable vanilla and custom manifest assets always bypass kim-worker", () => {

  assert.equal(
    kenshiAssetUrl("/data/vanilla/hash/building_locations.json"),
    "data/vanilla/hash/building_locations.json"
  );
  assert.equal(
    kenshiAssetUrl("https://map.kenshi.wiki/data/mod-manifests/test/test-areasmap.tga"),
    "https://map.kenshi.wiki/data/mod-manifests/test/test-areasmap.tga"
  );
  assert.equal(isMutableManifestAssetPath("/data/mod-manifests/test/road.svg"), true);
});

test("stable icons and overlays retain versioned kim-worker routing", () => {

  const icon = new URL(kenshiAssetUrl("icons/world-status.svg"));
  const overlay = new URL(kenshiAssetUrl("data/overlays/Kenshi_Map.webp"));

  assert.equal(icon.origin, "https://kim-assets.kenshi.wiki");
  assert.equal(icon.searchParams.get("v"), KENSHI_ASSET_VERSION);
  assert.equal(overlay.origin, "https://kim-assets.kenshi.wiki");
  assert.equal(overlay.searchParams.get("v"), KENSHI_ASSET_VERSION);
});
