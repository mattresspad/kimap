const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const DESTINATION_ICON_PATHS = Object.freeze({
  "global-status": "M4 18V10m5 8V6m5 12v-5m5 5V3M2 21h20",
  "world-history": "M12 7v5l3 2m6-2a9 9 0 1 1-3-6.7M18 2v4h4",
  "power-ranks": "m4 8 4 4 4-7 4 7 4-4-2 11H6Zm2 11h12",
  infamy:
    "M13 22c5-1 7-4.6 5.3-8.5C17 10.5 14.5 9 15 4c-4 2-7 5.5-7 9-1.8-1-2.2-2.5-2-4-3 3-3 10 3 12 1.4.5 2.6.7 4 .7-2.4-1-3.4-3.2-2.5-5.4 1 1.7 2.2 2.6 4.5 3.1-.8 1.8-.2 4.1-1 5.5Z",
  overrides: "M5 5h6v6H5Zm8 8h6v6h-6ZM8 11v4h5m3-2V9h-5",
  environment: "M7 17h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 10.5 3.5 3.5 0 0 0 7 17Z",
  constants: "M4 6h10m4 0h2M4 12h3m4 0h9M4 18h8m4 0h4M14 4v4M7 10v4m5 2v4",
  "content-browser": "M5 5h3v3H5Zm6 1h8M5 11h3v3H5Zm6 1h8M5 17h3v3H5Zm6 1h8",
  equipment: "M7 7V5a5 5 0 0 1 10 0v2m-13 0h16l-1 14H5Zm5 4v5",
  research: "M9 3h6m-5 0v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3m-6 12h8",
  documents: "M6 3h8l4 4v14H6Zm8 0v5h5M9 13h6m-6 4h6",
  markers: "M12 22s7-6.4 7-13A7 7 0 0 0 5 9c0 6.6 7 13 7 13Zm0-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  paint: "m4 18 10-10 4 4L8 22H4Zm11-11 2-2a2 2 0 0 1 3 3l-2 2M4 18l4 4",
  help: "M9.7 9a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.1 1-1.1 1.9M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
});

export function createDestinationIcon(iconName, ownerDocument = globalThis.document) {
  const pathData = DESTINATION_ICON_PATHS[iconName];
  if (!pathData || !ownerDocument?.createElementNS) return null;

  const svg = ownerDocument.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = ownerDocument.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  return svg;
}
