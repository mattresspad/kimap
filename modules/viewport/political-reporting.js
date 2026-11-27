import { getTheaterDestination } from "../top-bar/model.js";
import { createDestinationIcon } from "../top-bar/icons.js";
import { createRibbonBox, describeRibbonBox } from "./scanner-ribbon.js";
import { createPoliticalRibbonReading } from "./political-ribbon.js";

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const score = (value) => (value > 0 && value < 0.1 ? "<0.1" : number.format(value));
const percent = (value) => `${score(value * 100)}%`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function swatch(color) {
  const node = element("span", "political-report-swatch");
  node.setAttribute("aria-hidden", "true");
  if (/^#[0-9a-f]{6}$/iu.test(color ?? "")) node.style.backgroundColor = color;
  return node;
}

function sourceText(sources) {
  return `Town evidence ${score(sources.town)} · Homeless spawns ${score(sources.homelessSpawn)} · Nests ${score(sources.nest)}`;
}

function neutralRows(container, report) {
  if (report.evidenceTotal === null) return;
  for (const group of [report.outside, report.unattributed]) {
    container.append(
      element(
        "p",
        "political-report-neutral",
        `${group.label}: ${score(group.score)} points · ${percent(group.share)}`
      )
    );
    if (group.score > 0)
      container.append(element("p", "political-report-sources", sourceText(group.sourceScores)));
  }
}

/** Safe presentation only. The report projection already owns scoring and redaction. */
export function renderPoliticalLocalReport(
  report,
  {
    mode = "full",
    limit = Infinity,
    colors = {},
    completeHint = "Click the map for the complete report."
  } = {}
) {
  const root = element("div", "political-local-report");
  if (!report) {
    root.append(
      element("p", "political-report-note", "Political report unavailable for this location.")
    );
    return root;
  }
  root.append(element("p", "political-report-area", report.title));
  const outcome = element("p", "political-report-outcome", report.outcomeLabel);
  outcome.dataset.outcome = report.status;
  root.append(outcome);
  for (const [index, leader] of report.leaders.entries()) {
    root.append(
      element(
        "p",
        "political-report-leader",
        `${index === 0 ? "Leading evidence" : "Runner-up"}: ${leader.label} · ${percent(leader.share)}`
      )
    );
  }
  if (mode === "reduced") {
    if (report.leaders.length === 0)
      root.append(element("p", "political-report-note", report.reasons.join(" ")));
    return root;
  }
  root.append(element("p", "political-report-note", report.reasons.join(" ")));
  if (report.evidenceTotal !== null) {
    root.append(
      element(
        "p",
        "political-report-total",
        `Current authored evidence: ${score(report.evidenceTotal)} points`
      )
    );
    root.append(element("p", "political-report-sources", sourceText(report.sourceScores)));
    if (report.leaders.length) {
      root.append(
        element(
          "p",
          "political-report-rule",
          `Confidence: share ${percent(report.winnerShare)} / required ${percent(report.thresholds.share)}; lead ${score(report.lead * 100)} / required ${score(report.thresholds.margin * 100)} percentage points.`
        )
      );
    }
  }
  if (report.rows.length) {
    root.append(element("p", "political-report-section", "Included factions"));
    const list = element("ul", "political-report-factions");
    for (const row of report.rows.slice(0, limit)) {
      const item = element("li", "political-report-faction");
      const heading = element("div", "political-report-faction-heading");
      heading.append(
        swatch(colors[row.factionId]),
        element("span", "political-report-name", row.name),
        element("span", "political-report-value", `${score(row.score)} · ${percent(row.share)}`)
      );
      item.append(heading, element("p", "political-report-sources", sourceText(row.sourceScores)));
      list.append(item);
    }
    root.append(list);
  }
  neutralRows(root, report);
  const omitted = Math.max(0, report.rows.length - limit);
  if (omitted)
    root.append(
      element(
        "p",
        "political-report-note",
        `${String(omitted)} more included factions. ${completeHint}`
      )
    );
  if (report.conditional.homelessSpawn || report.conditional.nest) {
    root.append(
      element(
        "p",
        "political-report-note",
        `Conditional occurrences (not scored): homeless ${String(report.conditional.homelessSpawn)}, nests ${String(report.conditional.nest)}.`
      )
    );
  }
  return root;
}

/** Political widget and its settings only; location report hosts live in location-reporting. */
export function createPoliticalReportingController({
  container,
  session,
  getPoliticalState,
  getReportAtPoint,
  onFaction,
  onFactionColor = () => {},
  getFactionColorAvailability = () => ({ available: false, reason: "Faction Colors unavailable." }),
  getTheaterAvailability = () => ({ available: false, reason: "Window unavailable." }),
  onOpenTheater = () => {},
  onResize
}) {
  container.classList.add("kimap-ui");
  const scannerBody = container.querySelector("#wt-details");
  const bodySlot = element("div", "wt-body-slot");
  scannerBody.before(bodySlot);
  bodySlot.append(scannerBody);
  const scorecard = element("div", "political-scorecard-body");
  scorecard.id = "political-scorecard-body";
  scorecard.tabIndex = 0;
  scorecard.setAttribute("role", "region");
  scorecard.setAttribute("aria-label", "Political Scorecard: included factions");
  bodySlot.append(scorecard);
  const toggle = container.querySelector("#wt-toggle");
  const switchMode = container.querySelector("#wt-mode");
  const anchor = container.querySelector("#wt-anchor");
  const windowShortcut = container.querySelector("#wt-window");
  windowShortcut.addEventListener("click", () => {
    const destination = windowShortcut.dataset.destination;
    if (getTheaterAvailability(destination).available)
      onOpenTheater(destination, () => windowShortcut);
  });
  const scoreSummary = element("span", "wt-score-summary wt-ribbon");
  const scoreLeader = createRibbonBox("wt-ribbon-row wt-ribbon-primary wt-ribbon-leader");
  const scoreScope = element("span", "wt-ribbon-scope");
  const scoreLeaderName = element("span", "wt-ribbon-name");
  const scoreLeaderVerb = element("span", "wt-ribbon-verb");
  const scoreLeaderSeparator = element("span", "wt-ribbon-separator", "·");
  const scoreLeaderShare = element("span", "wt-ribbon-share");
  scoreLeader.append(scoreLeaderName, scoreLeaderVerb, scoreLeaderSeparator, scoreLeaderShare);
  const scoreCount = createRibbonBox("wt-ribbon-row wt-ribbon-count");
  const scoreCountValue = element("span", "wt-ribbon-count-value");
  const scoreCountNoun = element("span", "wt-ribbon-count-noun");
  scoreCount.append(scoreScope, scoreCountValue, scoreCountNoun, element("span", "", "ranked"));
  scoreSummary.append(scoreCount, scoreLeader);
  container.querySelector("#wt-summary").after(scoreSummary);
  anchor.addEventListener("click", () => {
    session.setHudAnchor(session.getSnapshot().hudAnchor === "left" ? "right" : "left");
  });
  let localPoint = null;
  let renderedScorecard = null;
  let renderedColors = null;
  let renderedNavigation = null;
  let renderedColorAvailability = null;
  let renderedSummary = null;
  let summaryData;
  let summaryLocal;
  let tooltipControl = null;

  switchMode.addEventListener("click", () => {
    if (!getPoliticalState().active) return;
    session.setHudMode(session.getSnapshot().hudMode === "scanner" ? "scorecard" : "scanner");
  });
  scorecard.addEventListener("click", (event) => {
    const button = event.target.closest(
      "button[data-political-faction], button[data-political-color]"
    );
    if (button && !button.disabled) {
      if (button.dataset.politicalColor) {
        onFactionColor(button.dataset.politicalColor);
        return;
      }
      const id = button.dataset.politicalFaction;
      onFaction(
        id,
        () =>
          [...scorecard.querySelectorAll("[data-political-faction]")].find(
            (node) => node.dataset.politicalFaction === id
          ) ?? scorecard
      );
    }
  });
  scorecard.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });

  function renderScorecard(political) {
    const data = political.reports?.scorecard ?? null;
    const availability = getFactionColorAvailability();
    const availabilityKey = `${availability.available}:${availability.reason ?? ""}`;
    if (
      renderedScorecard === data &&
      renderedColors === political.colors &&
      renderedNavigation === political.canNavigate &&
      renderedColorAvailability === availabilityKey
    )
      return;
    const focusAction = document.activeElement?.dataset.politicalColor
      ? "politicalColor"
      : "politicalFaction";
    const focusId = scorecard.contains(document.activeElement)
      ? document.activeElement.dataset[focusAction]
      : null;
    const scrollTop = scorecard.scrollTop;
    renderedScorecard = data;
    renderedColors = political.colors;
    renderedNavigation = political.canNavigate;
    renderedColorAvailability = availabilityKey;
    scorecard.replaceChildren();
    if (!data) {
      scorecard.append(
        element(
          "p",
          "political-report-note",
          political.reason || "Political reporting is unavailable. Scanner remains available."
        )
      );
      return;
    }
    scorecard.append(
      element("p", "political-report-section", "Included factions · Current authored evidence"),
      element("p", "political-report-note", "Local Authored Balance — Experimental")
    );
    if (!data.rows.length)
      scorecard.append(
        element("p", "political-report-note", "No included factions have current scored evidence.")
      );
    for (const row of data.rows) {
      const item = element("div", "political-scorecard-row");
      const heading = element("div", "political-scorecard-heading");
      const color = element("button", "political-scorecard-color");
      color.type = "button";
      color.dataset.politicalColor = row.factionId;
      color.setAttribute("aria-label", `Configure ${row.name} color`);
      color.disabled = !availability.available;
      color.title = availability.available ? `Configure ${row.name} color` : availability.reason;
      color.append(swatch(political.colors[row.factionId]));
      const name = element("button", "political-scorecard-faction", row.name);
      name.type = "button";
      name.dataset.politicalFaction = row.factionId;
      name.disabled = !political.canNavigate;
      name.title = political.canNavigate
        ? `Inspect ${row.name}`
        : "Reference inspection is unavailable.";
      heading.append(
        element("span", "political-scorecard-rank", `#${String(row.rank)}`),
        color,
        name
      );
      item.append(
        heading,
        element(
          "p",
          "political-report-value",
          `${score(row.score)} points · ${percent(row.share)} of scored evidence`
        ),
        element("p", "political-report-sources", sourceText(row.sourceScores))
      );
      scorecard.append(item);
    }
    const footer = element("div", "political-scorecard-footer");
    const facts = (label, entries) => {
      footer.append(element("p", "political-report-section", label));
      const list = element("dl", "political-scorecard-facts");
      for (const [name, value] of entries) {
        const row = element("div", "");
        row.append(element("dt", "", name), element("dd", "", value));
        list.append(row);
      }
      footer.append(list);
    };
    const sources = (values) => [
      ["Town evidence", score(values.town)],
      ["Homeless spawns", score(values.homelessSpawn)],
      ["Nests", score(values.nest)]
    ];
    facts("Scored evidence", [
      ["Total denominator", `${score(data.evidenceTotal)} points`],
      ...sources(data.sourceScores)
    ]);
    for (const group of [data.outside, data.unattributed]) {
      facts(group.label, [
        ["Contribution", `${score(group.score)} points · ${percent(group.share)}`],
        ...sources(group.sourceScores)
      ]);
    }
    const counts = data.coverage;
    facts("Geometry coverage", [
      ["Mapped regions included", String(counts.included)],
      ["Omitted: indeterminate", String(counts.indeterminate)],
      ["Omitted: excluded", String(counts.excluded)],
      ["Omitted: no raster cells", String(counts.unmapped)]
    ]);
    footer.append(
      element(
        "p",
        "political-report-note",
        "Each geometry is counted once. Scores describe authored evidence, not population or map coverage."
      )
    );
    scorecard.append(footer);
    scorecard.scrollTop = scrollTop;
    if (focusId) {
      const target = [...scorecard.querySelectorAll("button")].find(
        (node) => node.dataset[focusAction] === focusId
      );
      (target ?? scorecard).focus({ preventScroll: true });
    }
  }

  function updateScoreSummary(data, local = null) {
    if (summaryData === data && summaryLocal === local) return;
    const reading = createPoliticalRibbonReading(data, local);
    summaryData = data;
    summaryLocal = local;
    if (
      renderedSummary &&
      Object.keys(reading).every((key) => reading[key] === renderedSummary[key])
    )
      return;
    renderedSummary = reading;
    scoreScope.textContent = `${reading.scope}:`;
    scoreLeaderName.textContent = reading.name;
    scoreLeader.dataset.hasShare = String(Boolean(reading.share));
    scoreLeaderVerb.textContent = reading.share ? (reading.tied ? "·" : "leads with") : "";
    scoreLeaderShare.textContent = reading.share;
    scoreCountValue.textContent = String(reading.count ?? "—");
    scoreCountNoun.textContent = reading.count === 1 ? "faction" : "factions";
    describeRibbonBox(scoreLeader, reading.description);
    describeRibbonBox(scoreCount, reading.countDescription);
    if (container.dataset.mode === "scorecard" && container.dataset.expanded === "false")
      onResize();
  }

  function setHoverPoint(point) {
    localPoint = point;
    const political = getPoliticalState();
    const report =
      point && political.active && political.reports?.available ? getReportAtPoint(point) : null;
    updateScoreSummary(political.reports?.scorecard ?? null, report);
  }

  function refreshWindowShortcut() {
    const mode = container.dataset.mode;
    const destination = getTheaterDestination(mode === "scanner" ? "environment" : "ranks");
    if (windowShortcut.dataset.destination !== destination.id) {
      windowShortcut.dataset.destination = destination.id;
      windowShortcut.replaceChildren(createDestinationIcon(destination.icon));
    }
    const availability = getTheaterAvailability(destination.id);
    windowShortcut.disabled = !availability.available;
    windowShortcut.setAttribute("aria-label", `Open ${destination.label}`);
    windowShortcut.title = availability.available
      ? `Open ${destination.label}`
      : availability.reason;
  }

  function refresh() {
    const political = getPoliticalState();
    const state = session.getSnapshot();
    const mode = political.active ? state.hudMode : "scanner";
    const expanded = state[`${mode}Expanded`];
    const title = mode === "scanner" ? "Scanner" : "Political Scorecard";
    container.dataset.mode = mode;
    container.dataset.anchor = state.hudAnchor;
    container.dataset.expanded = String(expanded);
    container.setAttribute("aria-label", title);
    switchMode.hidden = !political.active;
    const switchTitle = mode === "scanner" ? "Show Political Scorecard" : "Show Scanner";
    switchMode.title = switchTitle;
    switchMode.setAttribute("aria-label", switchTitle);
    switchMode.setAttribute("aria-controls", mode === "scanner" ? scorecard.id : scannerBody.id);
    container.querySelector(".wt-title").textContent = title;
    refreshWindowShortcut();
    const anchorTitle = `Move widget to bottom ${state.hudAnchor === "left" ? "right" : "left"}`;
    anchor.title = anchorTitle;
    anchor.setAttribute("aria-label", anchorTitle);
    anchor.setAttribute("aria-controls", container.id);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-controls", mode === "scanner" ? scannerBody.id : scorecard.id);
    toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${title} details`);
    scannerBody.inert = mode !== "scanner" || !expanded;
    scannerBody.setAttribute("aria-hidden", String(mode !== "scanner" || !expanded));
    scorecard.inert = mode !== "scorecard" || !expanded;
    scorecard.setAttribute("aria-hidden", String(mode !== "scorecard" || !expanded));
    if (tooltipControl) {
      tooltipControl.hidden = !political.active;
      tooltipControl.querySelector("select").value = state.politicalTooltipMode;
    }
    renderScorecard(political);
    setHoverPoint(localPoint);
    onResize();
  }

  return {
    refresh,
    refreshWindowShortcut,
    setHoverPoint,
    reset() {
      scorecard.scrollTop = 0;
      setHoverPoint(null);
    },
    mountTooltipControl(after) {
      if (!after) return;
      tooltipControl?.remove();
      tooltipControl = element("label", "political-tooltip-control", "Political tooltip");
      const select = element("select");
      select.id = "political-tooltip-mode";
      for (const value of ["reduced", "full", "hidden"]) {
        const option = element("option", "", value[0].toUpperCase() + value.slice(1));
        option.value = value;
        select.append(option);
      }
      select.addEventListener("change", () => session.setPoliticalTooltipMode(select.value));
      tooltipControl.append(select);
      after.after(tooltipControl);
      refresh();
    }
  };
}
