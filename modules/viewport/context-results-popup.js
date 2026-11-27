/** Themed aggregate chooser. Discovery keeps ownership of entries and destinations. */
export function openContextResultsPopup({
  map,
  entries,
  latLng,
  marker,
  createReferenceButton,
  onActivate,
  onReference,
  onNavigate
}) {
  const content = document.createElement("div");
  content.className = "kenshi-popup context-indicator-popup";
  const heading = document.createElement("h4");
  heading.textContent = `${entries.length} Context results`;
  const list = document.createElement("ul");
  list.className = "context-results-list";
  list.tabIndex = 0;
  list.setAttribute("aria-label", "Context results");
  let navigating = false;
  const popup = L.popup({
    className: "context-results-popup kimap-ui",
    minWidth: 0,
    maxWidth: 286
  });
  const activate = (action) => {
    navigating = true;
    if (action() === false) navigating = false;
    map.closePopup(popup);
    if (navigating) onNavigate?.();
  };
  for (const entry of entries) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "context-reference-action";
    button.textContent =
      entry.kind === "treasure"
        ? `${entry.treasureName} — ${entry.name}`
        : entry.kind === "narcotic"
          ? `${entry.locationName} — ${entry.name}`
          : entry.name;
    button.addEventListener("click", () => activate(() => onActivate(entry)));
    row.append(button);
    if (entry.referenceType && entry.referenceId) {
      const reference = createReferenceButton(
        entry.referenceType,
        entry.referenceId,
        `Open ${entry.name}`,
        "context-popup-reference"
      );
      reference.addEventListener("click", () => activate(() => onReference(entry, reference)));
      row.append(reference);
    }
    list.append(row);
  }
  content.append(heading, list);
  L.DomEvent.disableClickPropagation(content);
  L.DomEvent.disableScrollPropagation(content);
  const fit = () => {
    const size = map.getSize();
    content.style.setProperty(
      "--context-results-height",
      `${Math.max(32, Math.min(320, size.y - 108))}px`
    );
    content.style.setProperty(
      "--context-results-width",
      `${Math.max(0, Math.min(286, size.x - 48))}px`
    );
    if (popup.isOpen()) {
      const autoPan = popup.options.autoPan;
      popup.options.autoPan = false;
      try {
        popup.update();
      } finally {
        popup.options.autoPan = autoPan;
      }
    }
  };
  fit();
  popup.on("remove", () => {
    map.off("resize", fit);
    const source = marker?.getElement();
    if (!navigating && source?.isConnected && source.getClientRects().length) {
      source.focus({ preventScroll: true });
    }
  });
  map.on("resize", fit);
  popup.setLatLng(latLng).setContent(content).openOn(map);
  if (document.activeElement === marker?.getElement()) {
    list.querySelector("button")?.focus({ preventScroll: true });
  }
  return popup;
}
