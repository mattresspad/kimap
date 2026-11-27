/* global document */
const button = document.querySelector("#run-checks");
const output = document.querySelector("#test-results");
const frame = document.querySelector("#map");
const delay = () => new Promise((resolve) => setTimeout(resolve, 50));

async function until(predicate, label) {
  const deadline = Date.now() + 30000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay();
  }
}

function paintsAbove(image, base) {
  const pane = image.closest(".leaflet-pane");
  const basePane = base.closest(".leaflet-pane");
  const view = image.ownerDocument.defaultView;
  const imageZ = Number(view.getComputedStyle(pane === basePane ? image : pane).zIndex);
  const baseZ = Number(view.getComputedStyle(pane === basePane ? base : basePane).zIndex);
  return (
    imageZ > baseZ ||
    (pane === basePane && imageZ === baseZ && Boolean(base.compareDocumentPosition(image) & 4))
  );
}

// Road Network is an inline SVGOverlay; other rasters are ImageOverlays.
const loaded = (image) =>
  image.tagName.toLowerCase() === "svg" || (image.complete && image.naturalWidth > 0);

button.addEventListener("click", async () => {
  button.disabled = true;
  output.textContent = "Waiting for the local map…";
  let assertions = 0;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    assertions++;
  };
  try {
    await until(
      () => frame.contentDocument?.querySelector('#map-workspace[data-map-ready="true"]'),
      "map readiness"
    );
    const doc = frame.contentDocument;
    const map = doc.querySelector("#map-container");
    const images = () => [...map.querySelectorAll(".leaflet-image-layer")];
    const baseImages = () =>
      images().filter((image) => image.classList.contains("kimap-base-map-image"));
    const overlays = () =>
      images().filter((image) => !image.classList.contains("kimap-base-map-image"));
    const settled = () => !map.classList.contains("leaflet-zoom-anim") && baseImages().length === 1;
    const choose = (input) => {
      const launcher = doc.querySelector("#world-views-btn");
      if (launcher.getAttribute("aria-expanded") !== "true") launcher.click();
      if (!input.checked) input.click();
    };
    const zoom = async (direction, size) => {
      doc.querySelector(`#map-zoom-${direction}-btn`).click();
      await until(
        () => map.dataset.baseMapResolution === String(size) && settled(),
        `${size}px image`
      );
    };
    while (!doc.querySelector("#map-zoom-out-btn").disabled) {
      doc.querySelector("#map-zoom-out-btn").click();
      await until(() => !map.classList.contains("leaflet-zoom-anim"), "zoom out");
      await delay();
    }
    await until(settled, "initial image");
    const initialSize = Number(map.dataset.baseMapResolution);
    const nextSize = Math.min(8192, initialSize * 2);
    const check = (input, held, label) => {
      assert(input.checked, `${label}: World View selection changed`);
      assert(held.length > 0, `${label}: no overlay image`);
      assert(baseImages().length === 1, `${label}: old base image retained`);
      for (const image of held) {
        assert(
          image.isConnected && overlays().includes(image),
          `${label}: overlay was recreated/removed`
        );
        assert(loaded(image), `${label}: overlay not loaded`);
        assert(
          paintsAbove(image, baseImages()[0]),
          `${label}: base image covers the selected overlay`
        );
      }
    };
    const choices = [...doc.querySelectorAll('#world-views-control input[type="radio"]')]
      .filter((input) => input.id !== "layer-choice-none")
      .sort(
        (a, b) => Number(b.id === "layer-choice-green") - Number(a.id === "layer-choice-green")
      );
    for (const input of choices) {
      await until(() => !input.disabled, `${input.id} readiness`);
      choose(input);
      await until(() => overlays().length > 0 && overlays().every(loaded), input.id);
      const held = overlays();
      check(input, held, `${input.id} before zoom`);
      await zoom("in", nextSize);
      check(input, held, `${input.id} after zoom in`);
      await zoom("out", initialSize);
      check(input, held, `${input.id} after zoom out`);
      output.textContent += `\nPASS: ${input.id}, ${initialSize} → ${nextSize} → ${initialSize}`;
    }
    choose(doc.querySelector("#layer-choice-green"));
    for (const id of ["spawnBorders", "roads", "debugGrid"]) {
      choose(doc.querySelector(`#layer-choice-${id}`));
    }
    await until(() => overlays().length === 4 && overlays().every(loaded), "reference images");
    const references = overlays();
    await zoom("in", nextSize);
    check(doc.querySelector("#layer-choice-green"), references, "World View with reference layers");
    for (const id of ["spawnBorders", "roads", "debugGrid"]) {
      assert(
        doc.querySelector(`#layer-choice-${id}`).checked,
        `${id}: reference selection changed`
      );
    }
    for (let size = nextSize * 2; size <= 8192; size *= 2) {
      await zoom("in", size);
      check(doc.querySelector("#layer-choice-green"), references, `${size}px with references`);
    }
    for (let size = 4096; size >= initialSize; size /= 2) {
      await zoom("out", size);
      check(
        doc.querySelector("#layer-choice-green"),
        references,
        `${size}px return with references`
      );
    }
    output.textContent += `\nPASS: ${assertions} assertions; all ${choices.length} World Views and three reference layers retain their images above the base.`;
  } catch (error) {
    output.textContent += `\nFAIL after ${assertions} assertions: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
