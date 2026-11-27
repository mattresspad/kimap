import { deepFreeze } from "../scenario/utils.js";
import { formatResourceReading } from "./reporting-policy.js";

const FIELDS = Object.freeze(
  [
    ["arid", "Arid", true],
    ["green", "Green", true],
    ["swamp", "Swamp", true],
    ["copper", "Copper", false],
    ["iron", "Iron", false],
    ["stone", "Stone", false],
    ["water", "Water", false]
  ].map(Object.freeze)
);

const CONDITION_LABELS = Object.freeze({
  recorded: "Recorded",
  "not-recorded": "Not recorded",
  "not-authored": "Not authored",
  unavailable: "Unavailable"
});

/** One immutable catalog per projection/raster. Pointer lookup never traverses reference data. */
export function createEnvironmentReports({ projection, areaIndex }) {
  if (!projection?.byId || !areaIndex?.available)
    throw new TypeError("Environment reports require data and geography.");
  const areas = new Map(
    projection.areas.map((area) => {
      const readings = FIELDS.map(([key, label, farming]) => ({
        key,
        label,
        farming,
        ...formatResourceReading(
          area.resources[farming ? "fertility" : "multipliers"][key],
          farming
        )
      }));
      return [
        area.id,
        deepFreeze({
          id: area.id,
          name: area.name,
          readings,
          resourceStatus: area.resources.status,
          conditions: area.environment.conditions,
          weatherSourceState: area.environment.weatherSourceState,
          incompleteWeather: area.environment.unresolved.length > 0
        })
      ];
    })
  );
  const unmatched = deepFreeze({
    geometryKey: "environment:unmatched",
    title: "Outside known areas",
    areas: [],
    ambiguous: false,
    reason: "No authored area could be resolved at this point."
  });
  const reports = new Map(
    areaIndex.geometries.map((geometry) => {
      const matches = geometry.areaIds.map(
        (id, index) =>
          areas.get(id) ??
          deepFreeze({
            id,
            name: geometry.areaNames[index] ?? id,
            unavailable: true
          })
      );
      return [
        geometry.key,
        deepFreeze({
          geometryKey: geometry.key,
          title: matches.length > 1 ? "Shared area" : (matches[0]?.name ?? "Outside known areas"),
          ambiguous: matches.length > 1,
          areas: matches,
          reason: matches.length ? null : unmatched.reason
        })
      ];
    })
  );
  return Object.freeze({
    getReportAtPoint: (point) => reports.get(areaIndex.getGeometryAtKenshi(point)?.key) ?? unmatched
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function note(root, text) {
  root.append(element("p", "location-report-note", text));
}

function resources(root, area, mode) {
  for (const [farming, label] of [
    [true, "Fertility"],
    [false, "Resources"]
  ]) {
    const group = element("section", "environment-report-group");
    group.append(element("p", "location-report-section", label));
    const list = element(
      "dl",
      mode === "reduced" ? "environment-report-readings is-reduced" : "environment-report-readings"
    );
    for (const reading of area.readings.filter((value) => value.farming === farming)) {
      const row = element("div", "environment-report-reading");
      row.dataset.state = reading.state;
      const value = reading.text === "—" ? reading.text : `${reading.text}${farming ? "%" : "×"}`;
      row.append(element("dt", "", reading.label), element("dd", "", value));
      if (reading.state === "unavailable")
        row.title = `${reading.label}: unavailable or invalid authored value.`;
      list.append(row);
    }
    group.append(list);
    root.append(group);
  }
  if (area.resourceStatus !== "available")
    note(
      root,
      area.resourceStatus === "missing-reference"
        ? "No resource record is linked to this area."
        : "The linked resource record is unavailable."
    );
  else if (area.readings.some(({ state }) => state === "unavailable"))
    note(root, "Some resource values are unavailable; — does not mean zero.");
  if (mode === "full")
    note(
      root,
      "Authored area fertility and resource multipliers; not exact deposits or guaranteed yield."
    );
}

function weather(root, area, mode) {
  if (mode === "reduced") {
    const recorded = area.conditions.filter(({ state }) => state === "recorded");
    if (!recorded.length)
      note(
        root,
        area.conditions.every(({ state }) => state === "not-recorded")
          ? "No hazards recorded in the available area data."
          : "No hazards confirmed; some readings are unavailable or not authored."
      );
    for (const condition of recorded) {
      const row = element("p", "environment-report-condition", condition.label);
      row.dataset.condition = condition.label;
      row.dataset.state = condition.state;
      root.append(row);
    }
  } else {
    const list = element("dl", "environment-report-conditions");
    for (const condition of area.conditions) {
      const row = element("div", "environment-report-condition");
      row.dataset.condition = condition.label;
      row.dataset.state = condition.state;
      row.append(
        element("dt", "", condition.label),
        element("dd", "", CONDITION_LABELS[condition.state])
      );
      list.append(row);
    }
    root.append(list);
  }
  if (area.incompleteWeather)
    note(root, "Some linked weather data is unavailable; other hazards cannot be ruled out.");
  if (area.weatherSourceState === "not-authored")
    note(root, "No weather source is authored for this area.");
  if (area.conditions.slice(0, 2).some(({ state }) => state === "unavailable"))
    note(root, "Some ground or water hazard values are unavailable.");
  if (mode === "full")
    note(root, "Authored area conditions, not current weather or a safety rating.");
}

/** Subject-specific content only; the shared host owns fitting, disclosure and scrolling. */
export function renderEnvironmentReport(
  report,
  {
    subject,
    mode = "full",
    hover = false,
    limit = Infinity,
    completeHint = "Click the map for the complete report."
  } = {}
) {
  const root = element("div", "environment-local-report");
  if (!report) {
    note(root, "Environmental reporting is unavailable for this location.");
    return root;
  }
  root.append(element("p", "location-report-area", report.title));
  if (!report.areas.length) {
    note(root, report.reason);
    return root;
  }
  if (report.ambiguous) {
    note(root, "This raster color is shared by several authored areas; readings are not combined.");
    if (hover) {
      const names = report.areas
        .slice(0, limit)
        .map(({ name }) => name)
        .join(" · ");
      if (names) root.append(element("p", "", names));
      const omitted = Math.max(0, report.areas.length - limit);
      note(root, `${omitted ? `${omitted} more areas. ` : ""}${completeHint}`);
      return root;
    }
  }
  for (const area of report.areas) {
    const section = element("section", "environment-report-area");
    if (report.ambiguous)
      section.append(element("p", "location-report-section", `${area.name} · ${area.id}`));
    if (area.unavailable) note(section, "The matched area record is unavailable.");
    else if (subject === "resources") resources(section, area, mode);
    else weather(section, area, mode);
    root.append(section);
  }
  return root;
}
