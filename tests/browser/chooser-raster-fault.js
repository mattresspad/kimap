/* global window, document */
// Test-only preloader, installed before the real bundle in an isolated same-origin iframe.
const mode = document.currentScript.dataset.mode;
const originalFetch = window.fetch.bind(window);
let release;
const gate = new Promise((resolve) => {
  release = resolve;
});
window.addEventListener("message", (event) => {
  if (event.source === window.parent && event.data === "release-test-raster") release();
});
window.fetch = async (input, options) => {
  const url = typeof input === "string" ? input : input.url;
  if (/areasmap\.tga/i.test(url)) {
    document.documentElement.dataset.testRaster = mode;
    if (mode === "failed") throw new Error("Deliberate fixture raster failure");
    await gate;
  }
  return originalFetch(input, options);
};
