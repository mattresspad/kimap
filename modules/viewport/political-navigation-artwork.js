import { kenshiAssetUrl } from "../asset-url.js";

/** Optional, published artwork. Labels remain usable if an image fails. */
export function createPoliticalNavigationArtwork(file, { preserveColors = false } = {}) {
  const slot = document.createElement("span");
  slot.className = "political-mode-info-icon";
  slot.dataset.preserveColors = String(preserveColors);
  slot.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  image.width = 20;
  image.height = 20;
  image.addEventListener("error", () => {
    image.hidden = true;
  });
  image.src = kenshiAssetUrl(`icons/${file}.svg`, { forceCdn: true });
  slot.append(image);
  return slot;
}
