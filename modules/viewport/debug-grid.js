export const DEFAULT_DEBUG_GRID_COLOR = "#00ffff";

const validColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);

/** One cached wireframe and one passive image, independent of map zoom and political evidence. */
export function createDebugGridController({
  map,
  layer,
  leaflet,
  width,
  height,
  requestFrame = requestAnimationFrame
}) {
  if (![width, height].every((value) => Number.isInteger(value) && value > 0)) {
    throw new TypeError("Debug Grid requires positive integer map dimensions.");
  }
  const lines = [];
  for (let x = 0; x <= width; x += 32) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke-width="4" opacity="0.6"/>`);
  }
  for (let y = 0; y <= height; y += 32) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke-width="4" opacity="0.6"/>`);
  }
  // Opacity stays on each line: intersections retain their original combined opacity.
  const geometry = lines.join("");
  let color = DEFAULT_DEBUG_GRID_COLOR;
  let publishedColor = null;
  let overlay = null;
  let pending = false;
  const imageUrl = () =>
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" stroke="${color}">${geometry}</svg>`
    );
  const publish = () => {
    if (overlay && publishedColor !== color) {
      overlay.setUrl(imageUrl());
      publishedColor = color;
    }
  };

  return Object.freeze({
    ensureOverlay(nextColor = color) {
      if (validColor(nextColor)) color = nextColor.toLowerCase();
      if (!overlay) {
        const pane = map.getPane("debugGridPane") ?? map.createPane("debugGridPane");
        pane.style.zIndex = 550;
        pane.style.pointerEvents = "none";
        overlay = leaflet.imageOverlay(
          imageUrl(),
          [
            [0, 0],
            [height, width]
          ],
          {
            pane: "debugGridPane",
            interactive: false
          }
        );
        publishedColor = color;
        layer.addLayer(overlay);
      } else publish();
    },
    setColor(nextColor) {
      if (!validColor(nextColor) || color === nextColor.toLowerCase()) return false;
      color = nextColor.toLowerCase();
      if (overlay && !pending && map.hasLayer(layer)) {
        pending = true;
        requestFrame(() => {
          pending = false;
          if (map.hasLayer(layer)) publish();
        });
      }
      return true;
    }
  });
}
