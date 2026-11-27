import { deepFreeze } from "../scenario/utils.js";

export const ATTITUDE_LABELS = Object.freeze({
  enemy: "Enemy",
  ally: "Ally",
  neutral: "Neutral",
  unavailable: "Attitude unavailable"
});

export function formatPresenceFaction(faction) {
  const value = Number.isFinite(faction.value)
    ? ` (${faction.value > 0 ? "+" : ""}${faction.value})`
    : "";
  return `${faction.name} · ${ATTITUDE_LABELS[faction.classification]}${value}`;
}

/** Cached reports share the same projection as Inspector population details. */
export function createPresenceReports({ projection, areaIndex }) {
  const townReports = new Map();
  for (const occurrence of Object.values(projection?.occurrences ?? {})) {
    townReports.set(
      occurrence.instanceId,
      deepFreeze({
        geometryKey: `town:${occurrence.baseTownId}:${occurrence.instanceId}`,
        target: "town",
        baseTownId: occurrence.baseTownId,
        areas: [occurrence.report],
        ambiguous: false
      })
    );
  }
  const unmatched = deepFreeze({
    geometryKey: "presence:unmatched",
    target: "point",
    areas: [],
    ambiguous: false,
    reason: "No authored area could be resolved at this point."
  });
  const reports = new Map(
    (areaIndex?.geometries ?? []).map((geometry) => [
      geometry.key,
      deepFreeze({
        geometryKey: geometry.key,
        target: "point",
        ambiguous: geometry.areaIds.length > 1,
        areas: geometry.areaIds.map(
          (id, position) =>
            projection?.areas?.[id] ?? {
              id,
              name: geometry.areaNames[position] ?? id,
              unavailable: true
            }
        )
      })
    ])
  );
  return Object.freeze({
    getState: (target = null) => ({
      available: Boolean(
        projection?.available && (target?.kind === "town" || areaIndex?.available)
      ),
      reason: !projection?.available
        ? projection?.reason || "Current presence requires scenario analysis."
        : !areaIndex?.available
          ? "Area geography is unavailable; town reporting remains available."
          : ""
    }),
    getReportAtPoint: (point) =>
      reports.get(areaIndex?.getGeometryAtKenshi(point)?.key) ?? unmatched,
    getReportForTown: (target) => {
      const report = townReports.get(target.instanceId);
      return report?.baseTownId === target.entityId ? report : null;
    }
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const note = (root, text) => root.append(element("p", "location-report-note", text));

export function renderPresenceReport(
  report,
  { subject, filter = "alliesEnemies", mode = "full", hover = false, limit = 5, completeHint = "" }
) {
  const root = element("div", "presence-report");
  if (!report?.areas?.length) {
    note(root, report?.reason || "This reporting target is unavailable.");
    return root;
  }
  if (report.ambiguous)
    note(root, "Shared area geometry: these are separate authored area readings.");
  let remaining = hover ? limit : Infinity;
  let omitted = 0;
  const areaLimit = hover ? (mode === "full" ? 5 : 3) : Infinity;
  for (const area of report.areas.slice(0, areaLimit)) {
    const section = element("section", "presence-report-area");
    const heading = element("p", "location-report-section", area.name);
    heading.title = `${area.name} · ${area.id}`;
    section.append(heading);
    root.append(section);
    if (area.unavailable) {
      note(section, "Current authored presence is unavailable.");
      continue;
    }
    if (subject === "relations") {
      const rows = area.factions.filter(
        ({ classification }) =>
          filter === "includeNeutrals" || classification === "ally" || classification === "enemy"
      );
      let priorAttitude = null;
      for (const row of rows) {
        if (remaining <= 0) {
          omitted++;
          continue;
        }
        remaining--;
        if (row.classification !== priorAttitude) {
          section.append(element("p", "presence-report-role", ATTITUDE_LABELS[row.classification]));
          priorAttitude = row.classification;
        }
        const line = element("div", "presence-report-row");
        line.title = `${row.name} · ${row.id}`;
        line.append(element("span", "", mode === "full" ? formatPresenceFaction(row) : row.name));
        if (mode === "full") {
          const roles = [
            ...new Set(row.sources.map((source) => [source.role, ...source.path].join(" → ")))
          ];
          line.append(element("small", "location-report-note", roles.join("; ")));
        }
        section.append(line);
      }
      if (!rows.length)
        note(
          section,
          area.entryCount === 0 && !area.owner && !area.diagnostics.length
            ? "No current authored entries."
            : filter === "alliesEnemies"
              ? "No allies or enemies resolved in the covered sources."
              : "No faction attitudes could be resolved in the covered sources."
        );
    } else {
      if (area.kind === "town") note(section, `Owner: ${area.owner?.name ?? "Unresolved"}`);
      for (const group of area.groups) {
        if (!group.rows.length) continue;
        if (remaining > 0) section.append(element("p", "presence-report-role", group.label));
        for (const row of group.rows) {
          if (remaining <= 0) {
            omitted++;
            continue;
          }
          remaining--;
          const line = element("div", "presence-report-row");
          line.title = `${row.name} · ${row.id}`;
          const detail = [
            row.template ? "Default template" : "",
            row.occurrences.length > 1 ? `${row.occurrences.length} authored entries` : ""
          ].filter(Boolean);
          line.append(element("span", "", row.name));
          if (detail.length)
            line.append(element("small", "location-report-note", detail.join(" · ")));
          if (mode === "full")
            line.append(
              element(
                "small",
                "location-report-note",
                row.factions.length
                  ? row.factions.map(formatPresenceFaction).join("; ")
                  : "Faction unresolved"
              )
            );
          section.append(line);
        }
      }
      if (area.entryCount === 0)
        note(
          section,
          area.diagnostics.length
            ? "No current population entries could be resolved."
            : "No current authored population entries."
        );
    }
    if (area.diagnostics.length)
      note(
        section,
        mode === "full"
          ? area.diagnostics.join(" ")
          : "Some source or faction information is incomplete."
      );
  }
  if (omitted || report.areas.length > areaLimit) {
    note(
      root,
      `${omitted ? `${omitted} more entries. ` : ""}${report.areas.length > areaLimit ? "More area readings. " : ""}${completeHint}`
    );
  }
  if (mode === "full")
    note(
      root,
      subject === "relations"
        ? "Authored associations, not a danger or safety assessment. Ownership does not establish occupancy."
        : "Current scenario's authored entries and templates; not simultaneous population or encounter probability."
    );
  return root;
}
