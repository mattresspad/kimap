import { deepFreeze } from "./scenario/utils.js";

const WEATHER_ICONS = Object.freeze({
  "Acid Rain": "inspector-acid-rain.svg",
  "Acidic Ground": "inspector-acid-ground.svg",
  "Acidic Water": "inspector-acid-water.svg",
  Burning: "inspector-burning.svg",
  Duststorm: "inspector-duststorm.svg",
  Gas: "inspector-poison-gas.svg"
});

/** Inspector presentation only. Environmental truth belongs to the shared immutable projection. */
export function projectInspectorWeather(projection, areaId) {
  const environment = projection?.byId?.[areaId]?.environment;
  if (!environment) {
    return deepFreeze({
      effects: [],
      notices: ["Environmental reporting is unavailable for this location."]
    });
  }
  const effects = environment.conditions
    .filter(({ label, state }) => state === "recorded" && Object.hasOwn(WEATHER_ICONS, label))
    .map(({ label }) => ({ label, iconPath: `icons/${WEATHER_ICONS[label]}` }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const notices = [];
  if (!effects.length) {
    notices.push(
      environment.conditions.every(({ state }) => state === "not-recorded")
        ? "No hazards recorded in the available area data."
        : "No hazards confirmed; some readings are unavailable or not authored."
    );
  }
  if (environment.unresolved.length) {
    notices.push("Some linked weather data is unavailable; other hazards cannot be ruled out.");
  }
  if (environment.weatherSourceState === "not-authored") {
    notices.push("No weather source is authored for this area.");
  }
  if (
    environment.conditions.some(
      ({ label, state }) =>
        (label === "Acidic Ground" || label === "Acidic Water") && state === "unavailable"
    )
  ) {
    notices.push("Some ground or water hazard values are unavailable.");
  }
  return deepFreeze({ effects, notices });
}
