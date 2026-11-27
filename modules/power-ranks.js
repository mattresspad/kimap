import { getTheaterDestination } from "./top-bar/model.js";

function createElement(tagName, className = "", text = null) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== null) element.textContent = text;
  return element;
}

export function createPowerRanksViewState(initialOpenIds = []) {
  const openIds = new Set(initialOpenIds);
  let focusedId = null;
  return Object.freeze({
    isOpen(factionId) {
      return openIds.has(factionId);
    },
    setOpen(factionId, open) {
      if (open) openIds.add(factionId);
      else openIds.delete(factionId);
    },
    getOpenIds() {
      return [...openIds].sort();
    },
    setFocusedId(factionId) {
      focusedId = factionId === null ? null : String(factionId);
    },
    getFocusedId() {
      return focusedId;
    }
  });
}

function normalizeReport(projection) {
  if (Array.isArray(projection)) return { entries: projection, diagnostics: [] };
  if (!projection || !Array.isArray(projection.entries)) return null;
  return {
    entries: projection.entries,
    diagnostics: Array.isArray(projection.diagnostics) ? projection.diagnostics : []
  };
}

function appendChange(container, gained, lost) {
  if (gained === 0 && lost === 0) {
    container.textContent = "0";
    return;
  }
  if (gained > 0)
    container.appendChild(createElement("span", "power-rank-change is-gained", `+${gained}`));
  if (lost > 0)
    container.appendChild(createElement("span", "power-rank-change is-lost", `−${lost}`));
}

function appendEntityList(section, heading, entries, { status = false } = {}) {
  section.appendChild(createElement("h4", "power-rank-report__subheading", heading));
  if (entries.length === 0) {
    section.appendChild(createElement("p", "power-rank-report__empty", "None"));
    return;
  }

  const list = createElement("ul", "power-rank-report__list");
  for (const entry of entries) {
    const item = createElement("li", "power-rank-report__item");
    const identity = createElement("span", "power-rank-report__identity");
    identity.append(
      createElement("span", "power-rank-report__name", entry.name),
      createElement("span", "power-rank-report__id", entry.baseTownId ?? entry.id)
    );
    item.appendChild(identity);
    if (status) {
      const statusClass = entry.statusLabel.toLowerCase().replaceAll(" ", "-");
      item.appendChild(
        createElement("span", `power-rank-status is-${statusClass}`, entry.statusLabel)
      );
    }
    list.appendChild(item);
  }
  section.appendChild(list);
}

function createSpawnReport(stat) {
  const evidence = stat.spawnPresence ?? { areas: [], squads: [], areaCount: 0, squadCount: 0 };
  const section = createElement("section", "power-rank-report__section");
  section.append(
    createElement("h3", "", "Spawn Presence"),
    createElement(
      "p",
      "power-rank-report__metric",
      `${evidence.areaCount} active ${evidence.areaCount === 1 ? "area" : "areas"} · ${evidence.squadCount} unique ${evidence.squadCount === 1 ? "squad" : "squads"}`
    )
  );
  appendEntityList(section, "Active Spawn Areas", evidence.areas);
  appendEntityList(section, "Squad Templates", evidence.squads);
  return section;
}

function createCharacterReport(stat) {
  const evidence = stat.worldStateCharacters ?? { entries: [], aliveCount: 0, totalCount: 0 };
  const section = createElement("section", "power-rank-report__section");
  section.append(
    createElement("h3", "", "World-State Characters"),
    createElement(
      "p",
      "power-rank-report__metric",
      `${evidence.aliveCount} alive · ${evidence.totalCount} affiliated`
    )
  );
  appendEntityList(section, "Affiliated Characters", evidence.entries, { status: true });
  return section;
}

function createTownReport(stat) {
  const evidence = stat.townControl ?? { current: [], gained: [], lost: [] };
  const section = createElement("section", "power-rank-report__section");
  section.append(
    createElement("h3", "", "Town Control"),
    createElement(
      "p",
      "power-rank-report__metric",
      `${stat.townsOwned} current · +${stat.townsGained} gained · −${stat.townsLost} lost`
    )
  );
  appendEntityList(section, "Currently Owned", evidence.current);
  if (evidence.gained.length > 0) appendEntityList(section, "Gained", evidence.gained);
  if (evidence.lost.length > 0) appendEntityList(section, "Lost", evidence.lost);
  return section;
}

function createFactionDisclosure(stat, index, viewState) {
  const disclosure = createElement("details", "power-rank-entry");
  disclosure.dataset.powerRankFactionId = stat.id;
  disclosure.open = viewState?.isOpen(stat.id) ?? false;

  const summary = createElement("summary", "power-rank-summary");
  summary.dataset.powerRankSummaryId = stat.id;
  if (viewState?.getFocusedId() === stat.id) summary.setAttribute("autofocus", "");
  const rank = createElement(
    "span",
    "power-rank-summary__rank",
    `#${String(stat.rank ?? index + 1)}`
  );
  rank.setAttribute("aria-label", `Rank ${String(stat.rank ?? index + 1)}`);
  const faction = createElement("strong", "power-rank-summary__faction", stat.name);
  const towns = createElement("span", "power-rank-summary__towns", String(stat.townsOwned));
  towns.setAttribute("aria-label", `${String(stat.townsOwned)} towns`);
  const change = createElement("span", "power-rank-summary__change");
  change.setAttribute(
    "aria-label",
    `${String(stat.townsGained)} gained, ${String(stat.townsLost)} lost`
  );
  appendChange(change, stat.townsGained, stat.townsLost);
  const indicator = createElement("span", "power-rank-summary__indicator", "›");
  indicator.setAttribute("aria-hidden", "true");
  summary.append(rank, faction, towns, change, indicator);

  const report = createElement("div", "power-rank-report");
  report.append(createSpawnReport(stat), createCharacterReport(stat), createTownReport(stat));
  disclosure.append(summary, report);
  return disclosure;
}

function createDiagnosticsDisclosure(diagnostics) {
  const disclosure = createElement("details", "power-rank-diagnostics");
  const summary = createElement(
    "summary",
    "power-rank-diagnostics__summary",
    `${diagnostics.length} unattributed evidence ${diagnostics.length === 1 ? "record" : "records"}`
  );
  const introduction = createElement(
    "p",
    "power-rank-diagnostics__intro",
    "These records were excluded from faction evidence because exact identity did not establish one owner."
  );
  const list = createElement("ul", "power-rank-diagnostics__list");
  for (const diagnostic of diagnostics) {
    const item = createElement("li", "power-rank-diagnostics__item");
    const title = createElement("strong", "", `${diagnostic.kind}: ${diagnostic.name}`);
    const id = createElement("span", "power-rank-report__id", diagnostic.entityId);
    const reason = createElement("span", "", diagnostic.reason);
    item.append(title, id, reason);
    if (diagnostic.candidateFactionIds?.length > 0) {
      item.appendChild(
        createElement(
          "span",
          "power-rank-diagnostics__context",
          `Candidate factions: ${diagnostic.candidateFactionIds.join(", ")}`
        )
      );
    }
    if (diagnostic.unresolvedIds?.length > 0) {
      item.appendChild(
        createElement(
          "span",
          "power-rank-diagnostics__context",
          `Unresolved: ${diagnostic.unresolvedIds.join(", ")}`
        )
      );
    }
    list.appendChild(item);
  }
  disclosure.append(summary, introduction, list);
  return disclosure;
}

function findFocusedFactionId(content) {
  const summary = document.activeElement?.closest?.("[data-power-rank-summary-id]");
  return summary && content.contains(summary) ? summary.dataset.powerRankSummaryId : null;
}

function restoreFactionFocus(content, factionId) {
  if (!factionId) return;
  const summary = [...content.querySelectorAll("[data-power-rank-summary-id]")].find(
    (candidate) => candidate.dataset.powerRankSummaryId === factionId
  );
  summary?.focus({ preventScroll: true });
}

export function renderPowerRanks(stats, { diagnostics = [], viewState = null } = {}) {
  const content = document.getElementById("power-ranks-content");
  if (!content) return;
  const focusedFactionId = findFocusedFactionId(content);

  if (stats.length === 0) {
    content.replaceChildren(
      createElement("p", "power-rank-empty", "No territorial control data is available.")
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  const columnHeader = createElement("div", "power-ranks-header");
  for (const label of ["Rank", "Faction", "Towns", "Change"]) {
    columnHeader.appendChild(createElement("span", "", label));
  }
  fragment.appendChild(columnHeader);

  const list = createElement("div", "power-ranks-list");
  stats.forEach((stat, index) => list.appendChild(createFactionDisclosure(stat, index, viewState)));
  fragment.appendChild(list);
  if (diagnostics.length > 0) fragment.appendChild(createDiagnosticsDisclosure(diagnostics));

  content.replaceChildren(fragment);
  restoreFactionFocus(content, focusedFactionId);
}

/**
 * Initializes the Power Ranks module without adding report state to ScenarioSession.
 */
export function initPowerRanksModule(windowManager, dataProvider) {
  console.log("Power Ranks Module Loading...");

  const paneElement = document.getElementById("pane-power-ranks");
  const content = document.getElementById("power-ranks-content");
  if (!paneElement || !content) {
    console.error("Power Ranks: Pane element not found.");
    return;
  }

  const viewState = createPowerRanksViewState();
  let navigationNote = null;
  const onToggle = (event) => {
    const disclosure = event.target.closest?.("[data-power-rank-faction-id]");
    if (!disclosure || !content.contains(disclosure)) return;
    viewState.setOpen(disclosure.dataset.powerRankFactionId, disclosure.open);
  };
  const onFocusIn = (event) => {
    const summary = event.target.closest?.("[data-power-rank-summary-id]");
    if (!summary || !content.contains(summary)) return;
    viewState.setFocusedId(summary.dataset.powerRankSummaryId);
  };
  content.addEventListener("toggle", onToggle, true);
  content.addEventListener("focusin", onFocusIn);

  const onShow = () => {
    const report = normalizeReport(dataProvider());
    if (!report) {
      content.replaceChildren(
        createElement("p", "power-rank-empty", "Scenario analysis unavailable.")
      );
      return;
    }
    renderPowerRanks(report.entries, { diagnostics: report.diagnostics, viewState });
    if (navigationNote) {
      const notice = createElement("p", "power-rank-navigation-note", navigationNote);
      notice.setAttribute("role", "status");
      notice.setAttribute("tabindex", "-1");
      content.prepend(notice);
      navigationNote = null;
    }
  };

  windowManager.register("ranks", getTheaterDestination("ranks")?.label, paneElement, onShow);

  return {
    refresh: onShow,
    openFaction(factionId, { returnFocus } = {}) {
      const id = typeof factionId === "string" ? factionId : "";
      const report = normalizeReport(dataProvider());
      const targeted = Boolean(id && report?.entries.some((entry) => entry.id === id));
      navigationNote =
        id && report && !targeted
          ? "This faction has no current or previously held mapped town, so it has no territorial rank."
          : null;
      if (targeted) {
        viewState.setOpen(id, true);
        viewState.setFocusedId(id);
      }
      const options = returnFocus ? { returnFocus } : {};
      const wasOpen = windowManager.isOpen("ranks");
      windowManager.open("ranks", options);
      if (!windowManager.isOpen("ranks")) {
        navigationNote = null;
        return { opened: false, targeted: false };
      }
      if (wasOpen) onShow();
      if (targeted) {
        requestAnimationFrame(() => {
          if (!windowManager.isOpen("ranks")) return;
          const summary = [...content.querySelectorAll("[data-power-rank-summary-id]")].find(
            (candidate) => candidate.dataset.powerRankSummaryId === id
          );
          summary?.focus({ preventScroll: true });
          summary?.scrollIntoView({ behavior: "auto", block: "center" });
        });
      } else if (id) {
        requestAnimationFrame(() => {
          if (!windowManager.isOpen("ranks")) return;
          content.scrollTo({ top: 0, behavior: "auto" });
          content.querySelector(".power-rank-navigation-note")?.focus({ preventScroll: true });
        });
      }
      return { opened: true, targeted };
    },
    cleanup() {
      content.removeEventListener("toggle", onToggle, true);
      content.removeEventListener("focusin", onFocusIn);
    }
  };
}
