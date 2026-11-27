import { ScenarioError } from "./errors.js";
import { deepFreeze, stableObject } from "./utils.js";

const GUARANTEED_MEMBER_CATEGORIES = Object.freeze(["leader", "squad", "squad2"]);
const MAX_PRISONER_GROUP_VISITS = 512;

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ScenarioError("invalid_scenario_dataset", `${label} must be an array.`);
  }
  return value;
}

function references(record, category, label) {
  const value = record?.ReferenceCategories?.[category];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ScenarioError("invalid_scenario_reference", `${label} ${category} must be an array.`);
  }
  return value;
}

function createIndex(records, label, identityKey) {
  const index = new Map();
  for (const [position, record] of records.entries()) {
    const id = record?.[identityKey];
    if (typeof id !== "string" || id.trim() === "") {
      throw new ScenarioError(
        "invalid_scenario_identity",
        `${label}[${String(position)}] identity must be a non-empty string.`
      );
    }
    if (index.has(id)) {
      throw new ScenarioError(
        "duplicate_scenario_identity",
        `${label} contains duplicate '${id}'.`,
        { dataset: label, id }
      );
    }
    index.set(id, record);
  }
  return index;
}

function addEvidence(index, characterId, evidence) {
  const entries = index.get(characterId) ?? [];
  entries.push(evidence);
  index.set(characterId, entries);
}

function isGuaranteedMember(reference) {
  return Number.isInteger(reference?.Value0) && reference.Value0 > 0;
}

function initialStatusError(code, message, context) {
  throw new ScenarioError(code, message, context);
}

/**
 * Derives baseline status only from deterministic prisoner placement beneath map-linked base towns.
 * Override-town residents and conditional/optional membership are deliberately not inferred.
 */
export function deriveInitialCharacterStatuses({
  towns,
  squads,
  mapLocations,
  characters,
  observedCharacterIds
}) {
  const rawTowns = requireArray(towns, "towns");
  const rawSquads = requireArray(squads, "squads");
  const rawLocations = requireArray(mapLocations, "mapLocations");
  const rawCharacters = requireArray(characters, "characters");
  if (!observedCharacterIds || typeof observedCharacterIds[Symbol.iterator] !== "function") {
    throw new ScenarioError("invalid_scenario_dataset", "observedCharacterIds must be iterable.");
  }

  const townById = createIndex(rawTowns, "townFcsData", "StringId");
  const squadById = createIndex(rawSquads, "squads", "StringId");
  const characterById = createIndex(rawCharacters, "characters", "StringId");
  const observedIds = new Set();
  for (const [position, characterId] of [...observedCharacterIds].entries()) {
    if (typeof characterId !== "string" || characterId.trim() === "") {
      throw new ScenarioError(
        "invalid_scenario_identity",
        `observedCharacterIds[${String(position)}] must be a non-empty string.`
      );
    }
    observedIds.add(characterId);
  }
  const prisonerEvidence = new Map();
  const ordinaryEvidence = new Map();
  const mapTownIds = [
    ...new Set(
      rawLocations
        .map((location) => location?.TargetId)
        .filter((targetId) => typeof targetId === "string" && townById.has(targetId))
    )
  ].sort((left, right) => left.localeCompare(right));

  function inspectOrdinaryMembers(town, residentSquad) {
    for (const category of GUARANTEED_MEMBER_CATEGORIES) {
      for (const [position, reference] of references(
        residentSquad,
        category,
        `Squad '${residentSquad.StringId}'`
      ).entries()) {
        if (
          observedIds.has(reference?.StringId) &&
          characterById.has(reference.StringId) &&
          isGuaranteedMember(reference)
        ) {
          addEvidence(ordinaryEvidence, reference.StringId, {
            townId: town.StringId,
            residentSquadId: residentSquad.StringId,
            memberCategory: category,
            memberPosition: position
          });
        }
      }
    }
  }

  function inspectPrisonerGroup({ town, residentSquad, groupId, path, conditional, traversal }) {
    if (path.includes(groupId)) {
      initialStatusError(
        "initial_prisoner_graph_cycle",
        `Initial prisoner placement beneath town '${town.StringId}' contains a squad cycle at '${groupId}'.`,
        {
          townId: town.StringId,
          residentSquadId: residentSquad.StringId,
          prisonerSquadId: groupId,
          path: [...path, groupId]
        }
      );
    }

    traversal.visits += 1;
    if (traversal.visits > MAX_PRISONER_GROUP_VISITS) {
      initialStatusError(
        "initial_prisoner_graph_limit",
        `Initial prisoner placement beneath town '${town.StringId}' exceeded the bounded traversal limit.`,
        {
          townId: town.StringId,
          residentSquadId: residentSquad.StringId,
          prisonerSquadId: groupId,
          visitLimit: MAX_PRISONER_GROUP_VISITS
        }
      );
    }

    const prisonerSquad = squadById.get(groupId);
    if (!prisonerSquad) {
      if (observedIds.has(groupId) && characterById.has(groupId)) {
        initialStatusError(
          "indeterminate_initial_character_status",
          `Observed character '${groupId}' is referenced directly as a prisoner instead of through a prisoner squad.`,
          {
            characterId: groupId,
            townId: town.StringId,
            residentSquadId: residentSquad.StringId,
            memberCategory: "prisoners"
          }
        );
      }
      initialStatusError(
        "missing_scenario_identity",
        `Squad '${residentSquad.StringId}' references missing prisoner squad '${groupId}'.`,
        {
          townId: town.StringId,
          residentSquadId: residentSquad.StringId,
          prisonerSquadId: groupId
        }
      );
    }

    const isConditional =
      conditional ||
      references(prisonerSquad, "world state", `Squad '${prisonerSquad.StringId}'`).length > 0;
    const nextPath = [...path, groupId];

    for (const [category, rawReferences] of Object.entries(
      prisonerSquad.ReferenceCategories ?? {}
    )) {
      if (!Array.isArray(rawReferences)) {
        throw new ScenarioError(
          "invalid_scenario_reference",
          `Squad '${prisonerSquad.StringId}' ${category} must be an array.`
        );
      }
      if (category === "prisoners" || category === "world state") continue;

      for (const [position, reference] of rawReferences.entries()) {
        const characterId = reference?.StringId;
        if (!observedIds.has(characterId) || !characterById.has(characterId)) continue;
        if (!GUARANTEED_MEMBER_CATEGORIES.includes(category)) {
          initialStatusError(
            "indeterminate_initial_character_status",
            `Observed character '${characterId}' has unsupported prisoner membership '${category}'.`,
            {
              characterId,
              townId: town.StringId,
              residentSquadId: residentSquad.StringId,
              prisonerSquadId: prisonerSquad.StringId,
              memberCategory: category,
              memberPosition: position
            }
          );
        }
        if (isConditional || !isGuaranteedMember(reference)) {
          initialStatusError(
            "indeterminate_initial_character_status",
            `Observed character '${characterId}' does not have unconditional guaranteed prisoner placement.`,
            {
              characterId,
              townId: town.StringId,
              residentSquadId: residentSquad.StringId,
              prisonerSquadId: prisonerSquad.StringId,
              memberCategory: category,
              memberPosition: position,
              conditional: isConditional,
              authoredCount: reference?.Value0 ?? null
            }
          );
        }

        addEvidence(prisonerEvidence, characterId, {
          townId: town.StringId,
          residentSquadId: residentSquad.StringId,
          prisonerSquadIds: nextPath,
          memberCategory: category,
          memberPosition: position
        });
      }
    }

    for (const nested of references(
      prisonerSquad,
      "prisoners",
      `Squad '${prisonerSquad.StringId}'`
    )) {
      inspectPrisonerGroup({
        town,
        residentSquad,
        groupId: nested?.StringId,
        path: nextPath,
        conditional: isConditional,
        traversal
      });
    }
  }

  for (const townId of mapTownIds) {
    const town = townById.get(townId);
    for (const resident of references(town, "residents", `Town '${townId}'`)) {
      const residentSquad = squadById.get(resident?.StringId);
      if (!residentSquad) {
        initialStatusError(
          "missing_scenario_identity",
          `Town '${townId}' references missing resident squad '${resident?.StringId}'.`,
          { townId, residentSquadId: resident?.StringId ?? null }
        );
      }

      inspectOrdinaryMembers(town, residentSquad);
      const conditional =
        references(residentSquad, "world state", `Squad '${residentSquad.StringId}'`).length > 0;
      const traversal = { visits: 0 };
      for (const prisoner of references(
        residentSquad,
        "prisoners",
        `Squad '${residentSquad.StringId}'`
      )) {
        inspectPrisonerGroup({
          town,
          residentSquad,
          groupId: prisoner?.StringId,
          path: [],
          conditional,
          traversal
        });
      }
    }
  }

  for (const [characterId, placements] of prisonerEvidence) {
    const ordinaryPlacements = ordinaryEvidence.get(characterId);
    if (!ordinaryPlacements) continue;
    initialStatusError(
      "ambiguous_initial_character_status",
      `Observed character '${characterId}' is authored as both a prisoner and an ordinary resident.`,
      { characterId, prisonerPlacements: placements, ordinaryPlacements }
    );
  }

  const sortedObservedIds = [...observedIds].sort((left, right) => left.localeCompare(right));
  return deepFreeze({
    statusByCharacterId: stableObject(
      sortedObservedIds.map((characterId) => [
        characterId,
        prisonerEvidence.has(characterId) ? 2 : 1
      ])
    ),
    placementEvidenceByCharacterId: stableObject(
      [...prisonerEvidence].map(([characterId, placements]) => [characterId, placements])
    )
  });
}
