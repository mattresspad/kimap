import { createPoliticalNavigationArtwork } from "./political-navigation-artwork.js";

/** Compact navigation to the existing political configuration and guide. */
export function createPoliticalModeInfo({
  settingsGlyph,
  getConfigurationAvailability,
  onConfigureFactions,
  onOpenHelp,
  getWidgetAvailability = () => ({ available: false, reason: "Political View is unavailable." }),
  getWidgetOpen = () => false,
  onToggleWidget = () => {},
  onGeometryChange
}) {
  const element = document.createElement("details");
  element.className = "political-mode-info";
  const summary = document.createElement("summary");
  summary.textContent = "Political Mode Info";
  const body = document.createElement("div");
  body.className = "political-mode-info-body";
  const configure = document.createElement("button");
  configure.type = "button";
  configure.className = "political-mode-info-configure";
  const cog = document.createElement("span");
  cog.className = "political-mode-info-icon";
  cog.setAttribute("aria-hidden", "true");
  cog.innerHTML = settingsGlyph;
  const label = document.createElement("span");
  label.textContent = "Configure faction colors";
  configure.append(cog, label);
  const reason = document.createElement("small");
  reason.id = "political-mode-info-unavailable";
  const help = document.createElement("button");
  help.type = "button";
  help.className = "political-mode-info-help";
  help.title = "Open Political Mode's Help Section";
  const helpLabel = document.createElement("span");
  helpLabel.textContent = "Political Mode Help";
  help.append(createPoliticalNavigationArtwork("help-book"), helpLabel);
  const widget = document.createElement("button");
  widget.type = "button";
  widget.className = "political-mode-info-widget";
  widget.setAttribute("aria-label", "Faction Colors Widget");
  widget.setAttribute("aria-controls", "faction-colors-widget");
  const widgetLabel = document.createElement("span");
  widgetLabel.textContent = "Faction Colors Widget";
  widget.append(
    createPoliticalNavigationArtwork("faction-colors-widget", { preserveColors: true }),
    widgetLabel
  );
  const widgetReason = document.createElement("small");
  widgetReason.id = "political-mode-info-widget-unavailable";
  widgetReason.className = "political-mode-info-widget-reason";
  body.append(configure, reason, widget, widgetReason, help);
  element.append(summary, body);

  const refresh = () => {
    const availability = getConfigurationAvailability();
    if (!availability.available && document.activeElement === configure) {
      summary.focus({ preventScroll: true });
    }
    configure.disabled = !availability.available;
    configure.title = availability.available ? "Configure faction colors" : availability.reason;
    reason.hidden = availability.available;
    reason.textContent = availability.available ? "" : availability.reason;
    if (availability.available) configure.removeAttribute("aria-describedby");
    else configure.setAttribute("aria-describedby", reason.id);
    const widgetAvailability = getWidgetAvailability();
    if (!widgetAvailability.available && document.activeElement === widget)
      summary.focus({ preventScroll: true });
    widget.disabled = !widgetAvailability.available;
    const open = getWidgetOpen();
    widget.setAttribute("aria-pressed", String(open));
    widget.title = widgetAvailability.available
      ? `${open ? "Close" : "Open"} Faction Colors Widget`
      : widgetAvailability.reason;
    widgetReason.textContent = widgetAvailability.available ? "" : widgetAvailability.reason;
    widgetReason.hidden = widgetAvailability.available;
    if (widgetAvailability.available) widget.removeAttribute("aria-describedby");
    else widget.setAttribute("aria-describedby", widgetReason.id);
  };
  configure.addEventListener("click", (event) => {
    event.stopPropagation();
    if (getConfigurationAvailability().available) onConfigureFactions();
    else refresh();
  });
  help.addEventListener("click", (event) => {
    event.stopPropagation();
    onOpenHelp();
  });
  widget.addEventListener("click", (event) => {
    event.stopPropagation();
    if (getWidgetAvailability().available) onToggleWidget(widget);
    else refresh();
  });
  element.addEventListener("toggle", onGeometryChange);
  refresh();
  return Object.freeze({ element, refresh });
}
