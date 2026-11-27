import { kenshiAssetUrl } from "../asset-url.js";

/** Optional published artwork never owns the identity or dimensions of a control. */
export function createScannerArtwork(path, className, fallback = "") {
  const slot = document.createElement("span");
  slot.className = `wt-artwork ${className}`;
  slot.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  const text = document.createElement("span");
  text.className = "wt-artwork-fallback";
  text.textContent = fallback;
  slot.append(image, text);
  image.addEventListener("load", () => {
    slot.dataset.loaded = "true";
  });
  image.addEventListener("error", () => {
    slot.dataset.loaded = "false";
  });
  image.src = kenshiAssetUrl(`icons/${path}.svg`, { forceCdn: true });
  return slot;
}

export function createRibbonBox(className) {
  const box = document.createElement("span");
  box.className = `wt-ribbon-box ${className}`;
  box.setAttribute("role", "group");
  return box;
}

export function describeRibbonBox(box, description) {
  if (box.title === description) return;
  box.title = description;
  box.setAttribute("aria-label", description);
}

/** Each row keeps its protected content; shortening precedes name ellipsis or omission. */
export function createRibbonRowFit({ availableWidth, fullWidth, minimumWidth }) {
  if (availableWidth < minimumWidth) return "hidden";
  return availableWidth >= fullWidth ? "full" : "compact";
}
