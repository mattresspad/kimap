import { isGeographicArea } from "./selection/geographic-area-policy.js";

const EFFECT_LABELS = Object.freeze({
  1: "Duststorm",
  2: "Acid Rain",
  3: "Burning",
  4: "Gas"
});

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;

  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function recordId(record) {
  return typeof record?.StringId === "string" ? record.StringId.trim() : "";
}

function recordName(record, fallback) {
  return typeof record?.Name === "string" && record.Name.trim() !== ""
    ? record.Name.trim()
    : fallback;
}

function compareNameAndId(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function exactIndex(database) {
  const index = new Map();
  const values = Array.isArray(database)
    ? database
    : database && typeof database === "object"
      ? Object.values(database)
      : [];

  for (const record of values) {
    const id = recordId(record);
    if (id !== "" && !index.has(id)) index.set(id, record);
  }
  return index;
}

function references(record, category) {
  const value = record?.ReferenceCategories?.[category];
  return Array.isArray(value) ? value : [];
}

function finiteValue(record, key) {
  const value = record?.Values?.[key];
  return Number.isFinite(value) ? value : null;
}

function booleanValue(record, key) {
  const value = record?.Values?.[key];
  return typeof value === "boolean" ? value : null;
}

function effectFromRecord(record) {
  const type = finiteValue(record, "affect type");
  const label = type === null ? null : (EFFECT_LABELS[type] ?? null);
  if (!label) return null;
  return { id: recordId(record) || `${String(type)}:${label}`, label };
}

function sortedUniqueEffects(effects) {
  const byLabel = new Map();
  for (const effect of effects) {
    if (!effect || byLabel.has(effect.label)) continue;
    byLabel.set(effect.label, effect);
  }
  return [...byLabel.values()].sort(
    (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
  );
}

function resolveEnvironment(area, indexes) {
  const unresolved = [];
  const seasons = [];
  const weatherById = new Map();
  const weatherEffects = [];

  for (const seasonReference of references(area, "seasons")) {
    const seasonId = recordId(seasonReference);
    if (seasonId === "") {
      unresolved.push({ kind: "Season", id: "(missing identity)" });
      continue;
    }

    const season = indexes.seasons.get(seasonId);
    if (!season) {
      unresolved.push({ kind: "Season", id: seasonId });
      continue;
    }

    const seasonWeathers = [];
    for (const weatherReference of references(season, "weathers")) {
      const weatherId = recordId(weatherReference);
      if (weatherId === "") {
        unresolved.push({ kind: "Weather", id: "(missing identity)" });
        continue;
      }

      const weather = indexes.weather.get(weatherId);
      if (!weather) {
        unresolved.push({ kind: "Weather", id: weatherId });
        continue;
      }

      const weatherEntry = {
        id: weatherId,
        name: recordName(weather, weatherId)
      };
      seasonWeathers.push(weatherEntry);
      weatherById.set(weatherId, weatherEntry);

      weatherEffects.push(effectFromRecord(weather));
      for (const effectReference of references(weather, "effects")) {
        const effectId = recordId(effectReference);
        if (effectId === "") {
          unresolved.push({ kind: "Effect", id: "(missing identity)" });
          continue;
        }
        const effect = indexes.effects.get(effectId);
        if (!effect) {
          unresolved.push({ kind: "Effect", id: effectId });
          continue;
        }
        weatherEffects.push(effectFromRecord(effect));
      }
    }

    seasons.push({
      id: seasonId,
      name: recordName(season, seasonId),
      weathers: [...new Map(seasonWeathers.map((entry) => [entry.id, entry])).values()].sort(
        compareNameAndId
      )
    });
  }

  const zoneEffects = [];
  if ((finiteValue(area, "acidic ground") ?? 0) > 0) {
    zoneEffects.push({ id: "zone:acidic-ground", label: "Acidic Ground" });
  }
  if ((finiteValue(area, "acidic water") ?? 0) > 0) {
    zoneEffects.push({ id: "zone:acidic-water", label: "Acidic Water" });
  }

  // Presence survives partial chains; missing links cannot establish an absent hazard.
  const weatherLabels = new Set(sortedUniqueEffects(weatherEffects).map(({ label }) => label));
  const weatherSourceState =
    unresolved.length > 0 ? "incomplete" : weatherById.size > 0 ? "available" : "not-authored";
  const conditions = [
    ...[
      ["acidic ground", "Acidic Ground"],
      ["acidic water", "Acidic Water"]
    ].map(([key, label]) => {
      const value = finiteValue(area, key);
      return {
        label,
        state: value === null || value < 0 ? "unavailable" : value > 0 ? "recorded" : "not-recorded"
      };
    }),
    ...["Gas", "Acid Rain", "Duststorm", "Burning"].map((label) => ({
      label,
      state: weatherLabels.has(label)
        ? "recorded"
        : weatherSourceState === "available"
          ? "not-recorded"
          : weatherSourceState === "not-authored"
            ? "not-authored"
            : "unavailable"
    }))
  ];

  return {
    conditions,
    weatherSourceState,
    seasons: [...new Map(seasons.map((entry) => [entry.id, entry])).values()].sort(
      compareNameAndId
    ),
    weathers: [...weatherById.values()].sort(compareNameAndId),
    zoneEffects: sortedUniqueEffects(zoneEffects),
    weatherEffects: sortedUniqueEffects(weatherEffects),
    unresolved: [
      ...new Map(unresolved.map((entry) => [`${entry.kind}:${entry.id}`, entry])).values()
    ]
  };
}

function resolveResources(area, resourceIndex) {
  const resourceReferences = references(area, "resources");
  if (resourceReferences.length === 0) {
    return {
      sourceId: null,
      sourceName: null,
      status: "missing-reference",
      fertility: { arid: null, green: null, swamp: null },
      multipliers: { copper: null, iron: null, stone: null, water: null }
    };
  }

  const sourceId = recordId(resourceReferences[0]);
  const resource = sourceId === "" ? null : resourceIndex.get(sourceId);
  if (!resource) {
    return {
      sourceId: sourceId || null,
      sourceName: null,
      status: "unresolved-reference",
      fertility: { arid: null, green: null, swamp: null },
      multipliers: { copper: null, iron: null, stone: null, water: null }
    };
  }

  return {
    sourceId,
    sourceName: recordName(resource, sourceId),
    status: "available",
    fertility: {
      arid: finiteValue(resource, "arid"),
      green: finiteValue(resource, "green"),
      swamp: finiteValue(resource, "swamp")
    },
    multipliers: {
      copper: finiteValue(resource, "copper mult"),
      iron: finiteValue(resource, "iron mult"),
      stone: finiteValue(resource, "stone mult"),
      water: finiteValue(resource, "water mult")
    }
  };
}

/**
 * Shared immutable, exact-ID facts for Environment Info and location reports.
 */
export function createEnvironmentInfoProjection({
  spawnArea = {},
  season = {},
  weather = {},
  effect = {},
  resource = {}
} = {}) {
  const indexes = {
    spawnAreas: exactIndex(spawnArea),
    seasons: exactIndex(season),
    weather: exactIndex(weather),
    effects: exactIndex(effect),
    resources: exactIndex(resource)
  };

  const areas = [...indexes.spawnAreas.values()]
    .filter((area) => isGeographicArea(recordId(area)))
    .map((area) => {
      const id = recordId(area);
      return {
        id,
        name: recordName(area, id),
        profile: {
          farmWaterUsage: finiteValue(area, "farm water usage"),
          homelessSpawnAmount: finiteValue(area, "homeless spawn amount"),
          nestCount: finiteValue(area, "num nests"),
          fixedMarkersOnly: booleanValue(area, "nests at fixed markers only"),
          weatherStrengthMinimum: finiteValue(area, "weather strength multiplier min"),
          weatherStrengthMaximum: finiteValue(area, "weather strength multiplier max")
        },
        environment: resolveEnvironment(area, indexes),
        resources: resolveResources(area, indexes.resources)
      };
    })
    .sort(compareNameAndId);

  const byId = Object.fromEntries(areas.map((area) => [area.id, area]));
  return deepFreeze({ areas, byId });
}

export { EFFECT_LABELS };
