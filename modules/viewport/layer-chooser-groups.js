import { deepFreeze } from "../scenario/utils.js";

export const WORLD_VIEW_GROUPS = deepFreeze([
  {
    id: "geography",
    title: "Geography",
    expanded: true,
    choices: [
      { id: "spawnAreas", label: "Spawn Areas" },
      { id: "spawnBorders", label: "Spawn Borders" },
      { id: "biomes", label: "Biomes" }
    ]
  },
  {
    id: "fertility",
    title: "Fertility",
    expanded: false,
    choices: [
      { id: "arid", label: "Arid" },
      { id: "green", label: "Green" },
      { id: "swamp", label: "Swamp" }
    ]
  },
  {
    id: "resources",
    title: "Mining & Resources",
    expanded: false,
    choices: [
      { id: "copper", label: "Copper" },
      { id: "iron", label: "Iron" },
      { id: "stone", label: "Stone" },
      { id: "water", label: "Water" }
    ]
  },
  {
    id: "weather",
    title: "Weather & Hazards",
    expanded: false,
    choices: [
      { id: "acidGround", label: "Acidic Ground" },
      { id: "acidRain", label: "Acid Rain" },
      { id: "acidWater", label: "Acidic Water" },
      { id: "burning", label: "Burning" },
      { id: "duststorm", label: "Duststorm" },
      { id: "gas", label: "Gas" }
    ]
  }
]);

export const WORLD_VIEW_GROUP_DEFAULTS = Object.freeze(
  Object.fromEntries(WORLD_VIEW_GROUPS.map(({ id, expanded }) => [id, expanded]))
);
