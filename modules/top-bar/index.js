export {
  SEARCH_RESULT_LIMIT,
  THEATER_AVAILABILITY_POLICIES,
  THEATER_DESTINATION_GROUPS,
  THEATER_DESTINATIONS,
  createSearchActivationRoute,
  createSearchRecords,
  getTheaterDestination,
  getTheaterDestinationAvailability,
  getThemeTogglePresentation,
  getSearchRecordKey,
  normalizeTheme,
  persistTheme,
  readAndMigrateTheme,
  searchRecords
} from "./model.js";

export { TopBarController, createShellTransientAdapter, createTopBarController } from "./shell.js";
export { createDestinationIcon } from "./icons.js";
