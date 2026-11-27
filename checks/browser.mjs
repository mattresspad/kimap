/* global document, window */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startFixture } from "../preview/runtime.mjs";
import { north, south, sampleTown, sampleNamespace } from "../preview/fixture.mjs";

const preview = await startFixture();
let browser;
async function checkViewport(phone) {
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 960 },
    isMobile: phone,
    hasTouch: phone,
    serviceWorkers: "block"
  });
  try {
    const page = await context.newPage();
    const issues = [];
    const origins = new Set([preview.origin, preview.artwork]);
    await page.route(/^https?:/, (route) => {
      if (origins.has(new URL(route.request().url()).origin)) return route.continue();
      issues.push("External request: " + route.request().url());
      return route.abort();
    });
    page.on("pageerror", (error) => issues.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) issues.push(response.status() + " " + response.url());
    });
    await page.goto(preview.origin);
    await page.locator('#map-workspace[data-map-ready="true"]').waitFor({ state: "attached" });
    await page.waitForFunction(
      () =>
        document.querySelector(".kimap-base-map-image")?.naturalWidth > 0 &&
        window.decodedTgaData?.width === 16
    );
    const colors = await page.evaluate(() => {
      const { width, height, data } = window.decodedTgaData;
      const color = (offset) => (data[offset] << 16) + (data[offset + 1] << 8) + data[offset + 2];
      return [color((height - 1) * width * 4), color(0)];
    });
    assert.deepEqual(colors, [north, south]);
    const launcher = page.locator("#quick-search-launcher");
    if (await launcher.isVisible()) await launcher.click();
    await page.locator("#quick-search-input").fill(sampleTown);
    await page
      .locator("#quick-search-results [role=option]")
      .filter({ hasText: sampleTown })
      .first()
      .click();
    await page.waitForFunction(
      (name) => document.querySelector("#info-panel-title")?.textContent.includes(name),
      sampleTown
    );

    if (!phone) {
      await page.locator("#workbench-task-simulate-btn").click();
      const select = page.locator("#character-select-dropdown");
      await select.selectOption("alpha");
      const status = page.locator('input[name="character-status"][value="0"]');
      await status.evaluate((el) => el.click());
      await page.locator("#character-apply-button").evaluate((el) => el.click());
      await page.waitForFunction(() => !document.querySelector("#workbench-undo-btn").disabled);
      for (const [type, exporter, importer] of [
        ["scenario", "export-history-btn", "import-history-file"],
        ["markerSet", "pm-file-export-btn", "pm-file-import-input"],
        ["paintPlan", "paint-file-export-btn", "paint-file-import-input"]
      ]) {
        const download = page.waitForEvent("download");
        await page.locator("#" + exporter).evaluate((el) => el.click());
        const buffer = await readFile(await (await download).path());
        const doc = JSON.parse(buffer);
        assert.equal(doc.documentType, type);
        if (type === "scenario") {
          assert.ok(buffer.toString().includes("vanilla:" + sampleNamespace));
          assert.ok(buffer.toString().includes("alpha"));
        }
        await page
          .locator("#" + importer)
          .setInputFiles({ name: type + ".json", mimeType: "application/json", buffer });
        const feedback =
          type === "scenario"
            ? "Imported scenario JSON."
            : "Imported 0 " + (type === "markerSet" ? "markers" : "paint items") + " from JSON.";
        await page.waitForFunction(
          (message) => document.body.textContent.includes(message),
          feedback
        );
      }
      await page.locator("#workbench-undo-btn").evaluate((el) => el.click());
      await page.waitForFunction(
        () =>
          document.querySelector("#workbench-undo-btn").disabled &&
          !document.querySelector("#workbench-redo-btn").disabled
      );
    }
    assert.deepEqual(issues, []);
    console.log(
      phone ? "Phone survey passed." : "Desktop survey, file interchange and Undo passed."
    );
  } finally {
    await context.close();
  }
}
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  await checkViewport(false);
  await checkViewport(true);
  await preview.bucket.delete(preview.map.datasets.biomes.url.slice(1));
  const page = await browser.newPage();
  await page.goto(preview.origin);
  await page.locator("#initialization-error-overlay:not(.hidden)").waitFor();
  assert.match(await page.locator("#initialization-error-overlay").innerText(), /biomes/);
  assert.equal(await page.locator('#map-workspace[data-map-ready="true"]').count(), 0);
  console.log("Missing required dataset was identified and initialization stopped.");
} finally {
  await browser?.close();
  await preview.close();
}
