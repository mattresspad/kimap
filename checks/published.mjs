/* global window, document, Image */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { parseMapDataResponse } from "../modules/map-contract.js";
import { deriveBaselineKey } from "../modules/scenario/baseline.js";
import { createLandmarkCatalog } from "../modules/landmark-catalog.js";

const origin = new URL(process.argv[2]).origin;
assert.ok(
  /^https:\/\/(?:[a-f0-9]{8}-kim-data-store\.prds\.workers\.dev|map\.kenshi\.wiki)$/.test(origin)
);
const artwork = "https://kim-assets.kenshi.wiki";
const bootstrapKey = "map-data/vanilla.json";
const response = await fetch(origin + "/" + bootstrapKey, { redirect: "error" });
assert.equal(response.status, 200);
assert.equal(response.headers.get("x-kimap-source"), "r2");
const raw = await response.json();
const contract = parseMapDataResponse(raw, { manifestDataOrigin: origin });
const map = raw.getmapdata;
assert.equal(map.manifest.id, "vanilla");
assert.equal(map.userData.isLoggedIn, false);
assert.equal(map.manifest.kenshiVersion, "1.0.68");
const baselineKey = deriveBaselineKey(contract);
assert.match(baselineKey, /^vanilla:[a-f0-9]{64}$/);

// Validate the live, separately published landmark inventory without distributing it in Git.
const [features, fog, whitelist] = await Promise.all(
  ["features_refined", "fog_features_clean", "landmarks_whitelist"].map(async (name) => {
    const response = await fetch(artwork + "/data/overlays/" + name + ".json", {
      redirect: "error"
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-kenshi-asset-source"), "r2");
    return response.json();
  })
);
const landmarks = createLandmarkCatalog({ features, fog, whitelist }).occurrences;
assert.equal(landmarks.length, 27);
assert.equal(landmarks.filter((row) => row.name === "Ancient Marker").length, 4);
assert.equal(
  landmarks.find((row) => row.name === "Satellite Wreckage")?.description,
  "The Eye, fallen from the sky."
);

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  async function coldPage(url, check) {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 960 },
      serviceWorkers: "block"
    });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    const external = [],
      errors = [],
      requests = new Map();
    await ctx.route(/^https?:/, (route) => {
      if ([origin, artwork].includes(new URL(route.request().url()).origin))
        return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    await ctx.addInitScript(() => {
      window.previewPolicyViolations = [];
      window.addEventListener("securitypolicyviolation", (event) =>
        window.previewPolicyViolations.push(event.blockedURI)
      );
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (response) => {
      const path = response.url();
      requests.set(path, {
        status: response.status(),
        source: response.headers()["x-kimap-source"] || response.headers()["x-kenshi-asset-source"]
      });
    });
    try {
      const navigation = await page.goto(url, { waitUntil: "domcontentloaded" });
      assert.match(
        navigation.headers()["cache-control"],
        /no-transform/,
        "Cloudflare must preserve the shell HTML"
      );
      const result = await check(page, requests);
      assert.deepEqual(external, [], "Unexpected third origin");
      assert.deepEqual(errors, [], "Unexpected browser errors");
      assert.deepEqual(
        await page.evaluate(() => window.previewPolicyViolations),
        [],
        "Unexpected blocked resource"
      );
      assert.ok(
        ![...requests.keys()].some((url) => new URL(url).pathname.endsWith("/api.php")),
        "MediaWiki API request"
      );
      return result;
    } catch (err) {
      console.error("Browser diagnostics:", {
        external,
        errors,
        failed: [...requests].filter(([, r]) => r.status >= 400),
        status: await page
          .locator("#initialization-error-overlay")
          .textContent()
          .catch(() => "")
      });
      throw err;
    } finally {
      await ctx.close();
    }
  }

  async function checkReader(page, requests) {
    await page
      .locator('#map-workspace[data-map-ready="true"]')
      .waitFor({ state: "attached", timeout: 45000 });
    assert.equal(
      await page
        .locator(".kimap-base-map-image")
        .first()
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true
    );
    assert.equal(await page.evaluate(() => window.Alpine.store("user").manifestId), "vanilla");
    for (const ref of Object.values(map.datasets)) {
      assert.deepEqual(
        requests.get(new URL(ref.url, origin).href),
        { status: 200, source: "r2" },
        ref.url
      );
    }
    await page.locator("#quick-search-input").fill("Bark");
    const result = page
      .locator("#quick-search-results [role=option]")
      .filter({ hasText: "Town" })
      .filter({ has: page.getByText("Bark", { exact: true }) })
      .first();
    await result.click();
    await page.locator("#info-panel-title").filter({ hasText: "Bark" }).waitFor();
    await page.locator("#info-panel-zoom-btn").click();
    await page.locator("#info-panel-copy-view-btn").click();
    await page.waitForFunction(() =>
      document.querySelector("#info-panel-copy-view-btn")?.textContent.includes("Copied")
    );
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(
      shared.startsWith(origin + "/#") && shared.includes("1076-gamedata.base"),
      "Shared view must identify Bark"
    );
    await page.locator("#info-panel-layout-btn").click();
    await page.waitForFunction(() => document.querySelector("#town-layout-viz svg") !== null);
    await page.locator("#close-town-layout-btn").click();
    assert.deepEqual(requests.get(origin + map.assets.buildingLocations.url), {
      status: 200,
      source: "r2"
    });
    await page.locator("#world-views-btn").click();
    const spawn = page.locator("#layer-choice-spawnAreas");
    await revealChoice(spawn);
    await spawn.check();
    assert.equal(await spawn.isChecked(), true);
    assert.deepEqual(requests.get(origin + map.assets.areasMap.url), { status: 200, source: "r2" });
    await page.locator("#map-content-btn").click();
    const roads = page.locator("#layer-choice-roads");
    await revealChoice(roads);
    if (await roads.isChecked()) await roads.uncheck();
    await roads.check();
    await page.locator("#map-container .road-network-overlay").waitFor({ state: "attached" });
    assert.deepEqual(requests.get(map.assets.roadNetwork.url), { status: 200, source: "r2" });
    assert.deepEqual(requests.get(origin + "/" + bootstrapKey), { status: 200, source: "r2" });
    assert.deepEqual(
      [...requests].filter(([, response]) => response.status >= 400),
      [],
      "Missing resources in the cold reader session"
    );
    assert.equal(map.assets.roadNetwork.url, artwork + "/data/overlays/Vanilla_RoadNetwork.svg");
    const artReads = [...requests].filter(([url]) => new URL(url).origin === artwork);
    assert.ok(
      artReads.some(([url]) => url.includes("Kenshi_Map")),
      "No shared base map was requested"
    );
    assert.ok(
      artReads.some(([url]) => url.includes("/icons/")),
      "No shared icon was requested"
    );
    for (const [url, res] of artReads) assert.deepEqual(res, { status: 200, source: "r2" }, url);
    const rgba = await page.evaluate(async (url) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = url;
      await image.decode();
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.drawImage(image, 0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    }, artwork + "/data/overlays/biomemap.png");
    assert.equal(rgba.length, 4);
    const download = page.waitForEvent("download");
    await page.locator("#export-history-btn").evaluate((button) => button.click());
    const exported = await readFile(await (await download).path());
    const document = JSON.parse(exported);
    assert.equal(document.documentType, "scenario");
    assert.ok(
      exported.toString().includes(baselineKey),
      "Scenario must carry the pinned baseline identity"
    );
    await page
      .locator("#import-history-file")
      .setInputFiles({ name: "scenario.json", mimeType: "application/json", buffer: exported });
    await page.waitForFunction(() =>
      window.document.body.textContent.includes("Imported scenario JSON.")
    );
    for (const [family, prefix, field, notice] of [
      ["markerSet", "pm", "markers", "markers"],
      ["paintPlan", "paint", "items", "paint items"]
    ]) {
      const fileReady = page.waitForEvent("download");
      await page.locator("#" + prefix + "-file-export-btn").evaluate((button) => button.click());
      const file = await readFile(await (await fileReady).path());
      const contents = JSON.parse(file);
      assert.equal(contents.documentType, family);
      assert.ok(Array.isArray(contents[field]));
      await page.locator("#" + prefix + "-file-import-input").setInputFiles({
        name: family + ".json",
        mimeType: "application/json",
        buffer: file
      });
      await page
        .locator("#" + prefix + "-logger")
        .getByText("Imported " + contents[field].length + " " + notice + " from JSON.", {
          exact: false
        })
        .first()
        .waitFor({ state: "attached" });
    }
    console.log("Verified marker-set and paint-plan JSON export and import.");
    console.log(
      "Verified anonymous Vanilla, all datasets, Bark, zoom, layout, spawn areas, roads, canvas and scenario files.",
      origin
    );
    return shared;
  }

  async function revealChoice(choice) {
    const group = choice.locator("xpath=ancestor::details[1]");
    if ((await group.count()) && !(await group.evaluate((el) => el.open)))
      await group.locator("summary").first().click();
  }

  const shared = await coldPage(origin + "/", checkReader);
  await coldPage(shared, async (page) => {
    await page
      .locator('#map-workspace[data-map-ready="true"]')
      .waitFor({ state: "attached", timeout: 45000 });
    await page.locator("#info-panel-title").filter({ hasText: "Bark" }).waitFor();
  });
  console.log("Fresh browser restored the shared Bark view.");

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block"
  });
  try {
    const page = await phone.newPage();
    await page.goto(origin);
    await page
      .locator('#map-workspace[data-map-ready="true"]')
      .waitFor({ state: "attached", timeout: 45000 });
    await page.locator("#quick-search-launcher").click();
    await page.locator("#quick-search-input").fill("Bark");
    await page
      .locator("#quick-search-results [role=option]")
      .filter({ hasText: "Bark" })
      .first()
      .click();
    await page.waitForFunction(() =>
      document.querySelector("#info-panel-title")?.textContent.includes("Bark")
    );
  } finally {
    await phone.close();
  }
  console.log("Phone search and selection passed.");
} finally {
  await browser.close();
}
