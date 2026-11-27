import { kenshiAssetUrl } from "./asset-url.js";
import { resolveLandmarkAreas } from "./landmark-catalog.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createLandmarkInspector({ container }) {
  let current;
  let areaValue = null;
  let areaKey = null;
  return Object.freeze({
    render(occurrence, areaIndex, geographyStatus) {
      if (current !== occurrence) {
        current = occurrence;
        areaKey = null;
        container.replaceChildren();
        if (!occurrence) {
          container.append(element("p", "context-error", "This landmark is unavailable."));
          return;
        }
        const section = element("section", "inspector-section landmark-overview");
        const identity = element("div", "inspector-overview-identity");
        identity.append(element("h4", "inspector-section-heading", "Landmark"));
        const artwork = element("span", "landmark-inspector-artwork");
        artwork.setAttribute("aria-hidden", "true");
        artwork.style.setProperty(
          "--landmark-artwork",
          `url("${kenshiAssetUrl(occurrence.icon)}")`
        );
        identity.append(artwork);
        section.append(identity);
        if (occurrence.description) {
          section.append(element("p", "landmark-description", occurrence.description));
        }
        const facts = element("dl", "inspector-fact-list");
        for (const [label, value, className] of [
          ["Definition ID", occurrence.definitionId, "is-monospace"],
          [
            "Coordinates",
            `X ${Math.round(occurrence.point.x)}, Z ${Math.round(occurrence.point.z)}`,
            "is-monospace"
          ],
          ["Spawn area", "", "landmark-area-reading"]
        ]) {
          const row = element("div", "inspector-fact-row");
          const description = element("dd", className, value);
          if (label === "Spawn area") areaValue = description;
          row.append(element("dt", "", label), description);
          facts.append(row);
        }
        section.append(facts);
        container.append(section);
      }
      if (!occurrence) return;
      let reading;
      try {
        reading = resolveLandmarkAreas(occurrence.point, areaIndex, geographyStatus);
      } catch {
        reading = { status: "unavailable", areas: [] };
      }
      const key = JSON.stringify(reading);
      if (key === areaKey) return;
      areaKey = key;
      areaValue.replaceChildren();
      if (reading.status !== "ready") {
        areaValue.textContent = {
          loading: "Area geography is loading.",
          unavailable: "Area geography is unavailable.",
          unmatched: "Outside known spawn areas."
        }[reading.status];
      } else {
        for (const area of reading.areas) {
          const name = element("span", "landmark-area-name", area.name);
          name.title = area.id;
          areaValue.append(name);
        }
        if (reading.areas.length > 1) {
          areaValue.append(
            element(
              "small",
              "context-source-note",
              "Shared raster color; the containing area is ambiguous."
            )
          );
        }
      }
    }
  });
}
