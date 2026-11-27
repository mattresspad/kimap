// modules/world-history.js

import { getTheaterDestination } from "./top-bar/model.js";

/**
 * Initializes the World History UI.
 * @param {WindowManager} windowManager
 */
export function initWorldHistoryModule(windowManager) {
  const paneElement = document.getElementById("pane-world-history");
  if (!paneElement) return;

  windowManager.register("history", getTheaterDestination("history")?.label, paneElement);
}

/**
 * Re-renders the authoritative derived scenario timeline.
 * Newest entries appear first so initialization, Undo, and imports cannot leave stale DOM entries.
 */
export function renderWorldHistoryLog(narrativeEvents) {
  const logContainer = document.getElementById("world-history-log");
  if (!logContainer) return;

  logContainer.replaceChildren();

  if (!Array.isArray(narrativeEvents) || narrativeEvents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "log-entry system";
    empty.textContent = "No scenario changes recorded.";
    logContainer.appendChild(empty);
    return;
  }

  [...narrativeEvents].reverse().forEach((event) => {
    const entry = document.createElement("div");
    entry.className = "history-entry";

    const timestamp = document.createElement("span");
    timestamp.className = "timestamp";
    const occurredAt = typeof event === "object" ? (event.occurredAt ?? event.timestamp) : null;
    timestamp.textContent = occurredAt
      ? `[${new Date(occurredAt).toLocaleTimeString()}]`
      : "[Scenario]";

    const narrative = document.createElement("span");
    narrative.className = "narrative";
    narrative.textContent =
      typeof event === "string" ? event : (event?.message ?? event?.text ?? "Scenario updated.");

    entry.append(timestamp, narrative);
    logContainer.appendChild(entry);
  });
}
