import { ScenarioError } from "./errors.js";
import { deriveInitialCharacterStatuses } from "./initial-character-status.js";
import {
  asInteger,
  asNonEmptyString,
  cloneData,
  deepFreeze,
  diagnostic,
  isRecord,
  stableObject
} from "./utils.js";

export const PLAYER_FACTION_ID = "204-gamedata.base";
export const SUPPORTED_WORLD_STATE_CONDITIONS = Object.freeze([
  "NPC is",
  "NPC is NOT",
  "player ally",
  "player enemy",
  "world state"
]);
export const DEPRECATED_WORLD_STATE_CONDITION = "town okay";

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ScenarioError("invalid_scenario_dataset", `${label} must be an array.`);
  }

  return value;
}

function optionalReferenceArray(categories, category, label) {
  const value = categories?.[category];
  return value === undefined ? [] : requireArray(value, `${label} ${category}`);
}

function createUniqueIndex(records, label, getId) {
  const index = new Map();

  for (const [position, rawRecord] of records.entries()) {
    if (!isRecord(rawRecord)) {
      throw new ScenarioError(
        "invalid_scenario_identity",
        `${label}[${String(position)}] must be an object.`
      );
    }

    const id = asNonEmptyString(
      getId(rawRecord),
      `${label}[${String(position)}] identity`,
      "invalid_scenario_identity"
    );
    if (index.has(id)) {
      throw new ScenarioError(
        "duplicate_scenario_identity",
        `${label} contains duplicate '${id}'.`,
        {
          dataset: label,
          id
        }
      );
    }

    index.set(id, rawRecord);
  }

  return index;
}

function getDatasetNamespace(urlValue, expectedKind, manifestId, key) {
  let pathSegments;
  try {
    const url = new URL(urlValue, "https://map.kenshi.wiki");
    pathSegments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch (_error) {
    throw new ScenarioError("invalid_baseline_url", `datasets.${key}.url is invalid.`, { key });
  }

  const rootIndex = pathSegments.indexOf("data");
  const kind = pathSegments[rootIndex + 1];
  const namespace = pathSegments[rootIndex + 2];
  if (rootIndex < 0 || kind !== expectedKind || !namespace) {
    throw new ScenarioError(
      "invalid_baseline_url",
      `datasets.${key}.url does not use the expected manifest namespace.`,
      { key, expectedKind }
    );
  }

  if (expectedKind === "mod-manifests" && namespace !== manifestId) {
    throw new ScenarioError(
      "manifest_namespace_mismatch",
      `datasets.${key}.url does not use manifest '${manifestId}'.`,
      { key, manifestId, namespace }
    );
  }

  return namespace;
}

export function deriveBaselineKey(contract) {
  if (!isRecord(contract) || contract.contractVersion !== 3) {
    throw new ScenarioError(
      "unsupported_scenario_contract",
      "Scenario baselines require Caravan contract v3."
    );
  }

  const manifestId = asNonEmptyString(
    contract.userData?.manifestId,
    "userData.manifestId",
    "invalid_scenario_contract"
  );
  if (contract.manifest?.id !== manifestId) {
    throw new ScenarioError(
      "manifest_identity_mismatch",
      "manifest.id must match userData.manifestId."
    );
  }
  if (!isRecord(contract.datasets) || Object.keys(contract.datasets).length === 0) {
    throw new ScenarioError(
      "invalid_scenario_contract",
      "Structured dataset metadata is required."
    );
  }

  const expectedKind = manifestId === "vanilla" ? "vanilla" : "mod-manifests";
  let commonNamespace = null;
  for (const [key, metadata] of Object.entries(contract.datasets)) {
    const url = asNonEmptyString(metadata?.url, `datasets.${key}.url`, "invalid_scenario_contract");
    const namespace = getDatasetNamespace(url, expectedKind, manifestId, key);
    commonNamespace ??= namespace;
    if (namespace !== commonNamespace) {
      throw new ScenarioError(
        "manifest_namespace_mismatch",
        "Required dataset paths do not share one manifest namespace.",
        { key, expected: commonNamespace, actual: namespace }
      );
    }
  }

  return manifestId === "vanilla" ? `vanilla:${commonNamespace}` : `manifest:${manifestId}`;
}

function normalizeReference(rawReference, label) {
  if (!isRecord(rawReference)) {
    throw new ScenarioError("invalid_scenario_reference", `${label} must be an object.`);
  }

  return {
    entityId: asNonEmptyString(
      rawReference.StringId,
      `${label}.StringId`,
      "invalid_scenario_reference"
    ),
    name:
      typeof rawReference.Name === "string" && rawReference.Name.trim() !== ""
        ? rawReference.Name
        : rawReference.StringId,
    value: rawReference.Value0
  };
}

function normalizeWorldStates(rawStates, factionIndex, diagnostics) {
  const rawIndex = createUniqueIndex(rawStates, "worldStates", (record) => record.StringId);
  const referencedCharacters = new Map();
  const normalizedStates = [];

  for (const rawState of rawStates) {
    const id = rawState.StringId;
    const categories = rawState.ReferenceCategories ?? {};
    if (!isRecord(categories)) {
      throw new ScenarioError(
        "invalid_scenario_reference",
        `World state '${id}' has malformed ReferenceCategories.`,
        { stateId: id }
      );
    }

    for (const category of Object.keys(categories)) {
      if (
        category !== DEPRECATED_WORLD_STATE_CONDITION &&
        !SUPPORTED_WORLD_STATE_CONDITIONS.includes(category)
      ) {
        throw new ScenarioError(
          "unsupported_condition_category",
          `World state '${id}' uses unsupported condition category '${category}'.`,
          { stateId: id, category }
        );
      }
    }

    const conditions = [];
    for (const category of SUPPORTED_WORLD_STATE_CONDITIONS) {
      if (categories[category] === undefined) continue;
      const references = requireArray(categories[category], `World state '${id}' ${category}`);

      for (const [position, rawReference] of references.entries()) {
        const reference = normalizeReference(
          rawReference,
          `World state '${id}' ${category}[${String(position)}]`
        );
        if (category === "NPC is" || category === "NPC is NOT") {
          asInteger(
            reference.value,
            `World state '${id}' ${category} Value0`,
            0,
            2,
            "invalid_scenario_reference"
          );
          const existing = referencedCharacters.get(reference.entityId);
          if (existing && existing.name !== reference.name) {
            diagnostics.push(
              diagnostic(
                "warning",
                "character_reference_name_mismatch",
                `Character '${reference.entityId}' is referenced with more than one name.`,
                { characterId: reference.entityId, first: existing.name, next: reference.name }
              )
            );
          }
          referencedCharacters.set(reference.entityId, existing ?? reference);
        } else if (category === "player ally" || category === "player enemy") {
          asInteger(
            reference.value,
            `World state '${id}' ${category} Value0`,
            0,
            1,
            "invalid_scenario_reference"
          );
          if (!factionIndex.has(reference.entityId)) {
            throw new ScenarioError(
              "missing_scenario_identity",
              `World state '${id}' references missing faction '${reference.entityId}'.`,
              { stateId: id, factionId: reference.entityId }
            );
          }
        } else {
          asInteger(
            reference.value,
            `World state '${id}' world state Value0`,
            0,
            1,
            "invalid_scenario_reference"
          );
        }
        conditions.push({ category, ...reference });
      }
    }

    const deprecatedReferences = categories[DEPRECATED_WORLD_STATE_CONDITION];
    if (deprecatedReferences !== undefined) {
      requireArray(deprecatedReferences, `World state '${id}' ${DEPRECATED_WORLD_STATE_CONDITION}`);
      diagnostics.push(
        diagnostic(
          "warning",
          conditions.length === 0
            ? "deprecated_town_condition_tombstone"
            : "deprecated_town_condition_removed",
          conditions.length === 0
            ? `World state '${id}' is inactive because town okay is its only condition.`
            : `Deprecated town okay conditions were removed from world state '${id}'.`,
          { stateId: id }
        )
      );
    }

    let active = true;
    if (conditions.length === 0) {
      active = false;
      if (deprecatedReferences === undefined) {
        diagnostics.push(
          diagnostic(
            "warning",
            "conditionless_world_state",
            `World state '${id}' is inactive because it has no supported conditions.`,
            { stateId: id }
          )
        );
      }
    }

    normalizedStates.push({
      id,
      name: typeof rawState.Name === "string" ? rawState.Name : id,
      active,
      playerInvolvementRequired: rawState.Values?.["player involvement"] === true,
      conditions,
      raw: cloneData(rawState)
    });
  }

  const normalizedIds = new Set(normalizedStates.map((state) => state.id));
  for (const state of normalizedStates) {
    for (const condition of state.conditions) {
      if (condition.category === "world state" && !normalizedIds.has(condition.entityId)) {
        throw new ScenarioError(
          "missing_scenario_identity",
          `World state '${state.id}' references missing world state '${condition.entityId}'.`,
          { stateId: state.id, dependencyId: condition.entityId }
        );
      }
    }
  }

  return { normalizedStates, referencedCharacters, rawIndex };
}

function normalizeCharacters(rawCharacters, references, initialStatuses) {
  const rawIndex = createUniqueIndex(rawCharacters, "characters", (record) => record.StringId);
  return [...references.values()]
    .map((reference) => {
      const raw = rawIndex.get(reference.entityId);
      return {
        id: reference.entityId,
        name: typeof raw?.Name === "string" && raw.Name.trim() !== "" ? raw.Name : reference.name,
        initialStatus: initialStatuses.statusByCharacterId[reference.entityId] ?? 1,
        initialStatusEvidence:
          initialStatuses.placementEvidenceByCharacterId[reference.entityId] ?? [],
        raw: raw ? cloneData(raw) : null
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeFactions(rawFactions) {
  const rawIndex = createUniqueIndex(rawFactions, "factions", (record) => record.StringId);
  const factions = [...rawIndex.values()]
    .map((raw) => {
      const threshold = raw.Values?.["enemy classification"];
      return {
        id: raw.StringId,
        name: typeof raw.Name === "string" && raw.Name.trim() !== "" ? raw.Name : raw.StringId,
        enemyThreshold: Number.isFinite(threshold) ? threshold : -10,
        raw: cloneData(raw)
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const initialRelations = Object.fromEntries(factions.map((faction) => [faction.id, 0]));
  const playerFaction = rawIndex.get(PLAYER_FACTION_ID);
  const relationReferences = playerFaction?.ReferenceCategories?.relations ?? [];
  requireArray(relationReferences, "Player faction relations");
  for (const reference of relationReferences) {
    const normalized = normalizeReference(reference, "Player faction relation");
    if (!rawIndex.has(normalized.entityId)) {
      throw new ScenarioError(
        "missing_scenario_identity",
        `Player faction relations reference missing faction '${normalized.entityId}'.`,
        { factionId: normalized.entityId }
      );
    }
    initialRelations[normalized.entityId] = asInteger(
      normalized.value,
      `Initial relation '${normalized.entityId}'`,
      -100,
      100,
      "invalid_scenario_reference"
    );
  }

  return { factions, rawIndex, initialRelations };
}

function normalizeTowns(rawTowns, stateIds) {
  const rawIndex = createUniqueIndex(rawTowns, "townFcsData", (record) => record.StringId);
  const towns = [...rawIndex.values()]
    .map((raw) => {
      const conditions = optionalReferenceArray(
        raw.ReferenceCategories,
        "world state",
        `Town '${raw.StringId}'`
      ).map((reference, position) => {
        const normalized = normalizeReference(
          reference,
          `Town '${raw.StringId}' world state[${String(position)}]`
        );
        asInteger(
          normalized.value,
          `Town '${raw.StringId}' world state Value0`,
          0,
          1,
          "invalid_scenario_reference"
        );
        if (!stateIds.has(normalized.entityId)) {
          throw new ScenarioError(
            "missing_scenario_identity",
            `Town '${raw.StringId}' references missing world state '${normalized.entityId}'.`
          );
        }
        return normalized;
      });
      const overrideIds = optionalReferenceArray(
        raw.ReferenceCategories,
        "override town",
        `Town '${raw.StringId}'`
      ).map(
        (reference, position) =>
          normalizeReference(reference, `Town '${raw.StringId}' override town[${String(position)}]`)
            .entityId
      );
      const ownerReference = raw.ReferenceCategories?.faction?.[0];

      return {
        id: raw.StringId,
        name: typeof raw.Name === "string" ? raw.Name : raw.StringId,
        owner: ownerReference?.Name || "Unknown",
        ownerId: ownerReference?.StringId || null,
        conditions,
        overrideIds,
        raw: cloneData(raw)
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  for (const town of towns) {
    for (const overrideId of town.overrideIds) {
      if (!rawIndex.has(overrideId)) {
        throw new ScenarioError(
          "missing_scenario_identity",
          `Town '${town.id}' references missing override town '${overrideId}'.`,
          { townId: town.id, overrideId }
        );
      }
    }
  }

  return towns;
}

function normalizeConditionalEntity(raw, label, stateIds) {
  const conditions = optionalReferenceArray(
    raw.ReferenceCategories,
    "world state",
    `${label} '${raw.StringId}'`
  ).map((reference, position) => {
    const normalized = normalizeReference(
      reference,
      `${label} '${raw.StringId}' world state[${String(position)}]`
    );
    asInteger(
      normalized.value,
      `${label} '${raw.StringId}' world state Value0`,
      0,
      1,
      "invalid_scenario_reference"
    );
    if (!stateIds.has(normalized.entityId)) {
      throw new ScenarioError(
        "missing_scenario_identity",
        `${label} '${raw.StringId}' references missing world state '${normalized.entityId}'.`
      );
    }
    return normalized;
  });

  return {
    id: raw.StringId,
    name: typeof raw.Name === "string" ? raw.Name : raw.StringId,
    conditions,
    raw: cloneData(raw)
  };
}

function normalizeSpawns(rawAreas, rawSquads, towns, stateIds) {
  const areaIndex = createUniqueIndex(rawAreas, "spawnAreas", (record) => record.StringId);
  const squadIndex = createUniqueIndex(rawSquads, "squads", (record) => record.StringId);
  const townIds = new Set(towns.map((town) => town.id));
  const squads = [...squadIndex.values()]
    .map((raw) => normalizeConditionalEntity(raw, "Squad", stateIds))
    .sort((left, right) => left.id.localeCompare(right.id));
  const spawnAreas = [...areaIndex.values()]
    .map((raw) => {
      const occurrences = [];
      for (const [category, type, identities] of [
        ["homeless spawns", "Squad", squadIndex],
        ["nests", "Nest", { has: (id) => townIds.has(id) }]
      ]) {
        const counts = new Map();
        for (const [position, reference] of optionalReferenceArray(
          raw.ReferenceCategories,
          category,
          `Spawn area '${raw.StringId}'`
        ).entries()) {
          const normalized = normalizeReference(
            reference,
            `Spawn area '${raw.StringId}' ${category}[${String(position)}]`
          );
          if (!identities.has(normalized.entityId)) {
            throw new ScenarioError(
              "missing_scenario_identity",
              `Spawn area '${raw.StringId}' references missing ${type.toLowerCase()} '${normalized.entityId}'.`
            );
          }
          const baseOccurrenceId = `${raw.StringId}:${type}:${normalized.entityId}`;
          const occurrenceNumber = (counts.get(baseOccurrenceId) ?? 0) + 1;
          counts.set(baseOccurrenceId, occurrenceNumber);
          occurrences.push({
            entityId: normalized.entityId,
            name: normalized.name,
            type,
            occurrenceId:
              occurrenceNumber === 1 ? baseOccurrenceId : `${baseOccurrenceId}:${occurrenceNumber}`
          });
        }
      }

      return {
        id: raw.StringId,
        name: typeof raw.Name === "string" ? raw.Name : raw.StringId,
        occurrences,
        raw: cloneData(raw)
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return { squads, spawnAreas };
}

function normalizeMapLocations(rawLocations) {
  const rawIndex = createUniqueIndex(rawLocations, "mapData", (record) => record.InstanceId);
  return [...rawIndex.values()]
    .map((raw) => ({
      instanceId: raw.InstanceId,
      targetId: typeof raw.TargetId === "string" ? raw.TargetId : null,
      name: typeof raw.Name === "string" ? raw.Name : raw.InstanceId,
      raw: cloneData(raw)
    }))
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId));
}

export function normalizeScenarioBaseline({ contract, datasets }) {
  if (!isRecord(datasets)) {
    throw new ScenarioError("invalid_scenario_dataset", "Staged scenario datasets are required.");
  }

  const baselineKey = deriveBaselineKey(contract);
  const manifestId = contract.userData.manifestId;
  const diagnostics = [];
  const rawCharacters = requireArray(datasets.characters, "datasets.characters");
  const rawFactions = requireArray(datasets.factions, "datasets.factions");
  const rawTowns = requireArray(datasets.townFcsData, "datasets.townFcsData");
  const rawSquads = requireArray(datasets.squads, "datasets.squads");
  const rawSpawnAreas = requireArray(datasets.spawnAreas, "datasets.spawnAreas");
  const rawMapLocations = requireArray(datasets.mapData, "datasets.mapData");
  const factionResult = normalizeFactions(rawFactions);
  const worldStateResult = normalizeWorldStates(
    requireArray(datasets.worldStates, "datasets.worldStates"),
    factionResult.rawIndex,
    diagnostics
  );
  const initialStatuses = deriveInitialCharacterStatuses({
    towns: rawTowns,
    squads: rawSquads,
    mapLocations: rawMapLocations,
    characters: rawCharacters,
    observedCharacterIds: worldStateResult.referencedCharacters.keys()
  });
  const characters = normalizeCharacters(
    rawCharacters,
    worldStateResult.referencedCharacters,
    initialStatuses
  );
  const stateIds = new Set(worldStateResult.normalizedStates.map((state) => state.id));
  const towns = normalizeTowns(rawTowns, stateIds);
  const { squads, spawnAreas } = normalizeSpawns(rawSpawnAreas, rawSquads, towns, stateIds);
  const mapLocations = normalizeMapLocations(rawMapLocations);
  const townIds = new Set(towns.map((town) => town.id));
  const mapTownIds = [
    ...new Set(
      mapLocations
        .map((location) => location.targetId)
        .filter((targetId) => targetId !== null && townIds.has(targetId))
    )
  ].sort((left, right) => left.localeCompare(right));

  const baseline = {
    schemaVersion: 1,
    contractVersion: 3,
    manifestId,
    key: baselineKey,
    manifest: cloneData(contract.manifest),
    characters,
    characterById: stableObject(characters.map((character) => [character.id, character])),
    factions: factionResult.factions,
    factionById: stableObject(factionResult.factions.map((faction) => [faction.id, faction])),
    initialRelations: stableObject(Object.entries(factionResult.initialRelations)),
    worldStates: [...worldStateResult.normalizedStates].sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
    worldStateById: stableObject(
      worldStateResult.normalizedStates.map((state) => [state.id, state])
    ),
    towns,
    townById: stableObject(towns.map((town) => [town.id, town])),
    squads,
    squadById: stableObject(squads.map((squad) => [squad.id, squad])),
    spawnAreas,
    spawnAreaById: stableObject(spawnAreas.map((area) => [area.id, area])),
    mapLocations,
    mapLocationById: stableObject(mapLocations.map((location) => [location.instanceId, location])),
    mapTownIds,
    diagnostics
  };

  return deepFreeze(baseline);
}
