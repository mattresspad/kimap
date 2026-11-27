import { renderPoliticalLocalReport } from "./political-reporting.js";
import { renderEnvironmentReport } from "./environment-reporting.js";
import { renderPresenceReport } from "./presence-reporting.js";

/** Internal providers, not a second state store. Availability and facts are supplied by the app. */
export function createLocationReportSubjects({
  getPoliticalState,
  getPoliticalReport,
  getEnvironmentState,
  getEnvironmentReport,
  getPresenceState = () => ({ available: false, reason: "Current presence is unavailable." }),
  getPresenceReport = () => null,
  getTownPresenceReport = () => null
}) {
  const environmental = (id, label) =>
    Object.freeze({
      label,
      getState: getEnvironmentState,
      getReportAtPoint: getEnvironmentReport,
      hoverLimit: (report, mode) =>
        report?.ambiguous ? Math.min(mode === "full" ? 5 : 3, report.areas.length) : 0,
      render: (report, options) => renderEnvironmentReport(report, { ...options, subject: id })
    });
  const presence = (id, label) =>
    Object.freeze({
      label,
      nonTouchOnly: true,
      supportsTowns: true,
      getState: getPresenceState,
      getReportAtPoint: getPresenceReport,
      getReportForTown: getTownPresenceReport,
      hoverLimit: (_report, mode) => (mode === "full" ? 5 : 3),
      render: (report, options) => renderPresenceReport(report, { ...options, subject: id })
    });
  return Object.freeze({
    political: Object.freeze({
      label: "Political",
      getState: () => {
        const state = getPoliticalState();
        return {
          enabled: state.active,
          active: state.active,
          available: Boolean(state.reports?.available),
          reason: state.reason,
          appearance: state.colors
        };
      },
      getReportAtPoint: getPoliticalReport,
      hoverLimit: (report, mode) => (mode === "full" ? Math.min(5, report?.rows.length ?? 0) : 0),
      render: (report, { appearance, ...options }) =>
        renderPoliticalLocalReport(report, { ...options, colors: appearance })
    }),
    resources: environmental("resources", "Resources"),
    weather: environmental("weather", "Weather"),
    relations: presence("relations", "Relations"),
    squadPresence: presence("squadPresence", "Squad Presence")
  });
}
