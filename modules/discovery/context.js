import { replayScenario } from "../../stores/scenario-session.js";
import { resolveCharacterAffiliations } from "../scenario/character-affiliation.js";
import { createScenarioLensProjection } from "../scenario/lenses.js";
import { cloneData, deepFreeze } from "../scenario/utils.js";
import { getDiscoveryCatalogInternals } from "./catalog.js";
import {
  canTraverseDiscoveryPlacement,
  hasPositiveStructuralCapacity,
  normalizeDiscoveryCategory
} from "./paths.js";
import { createDiscoveryAppearanceRoots, projectDiscoveryEntity } from "./projection.js";

export const DISCOVERY_CONTEXT_SUBJECTS = Object.freeze([
  "keyCharacters",
  "bountyTargets",
  "deadlyAnimals",
  "fancyWeaponWielders",
  "nestTreasures",
  "treasureSpots",
  "narcotics"
]);
const CONTEXT_INTERNALS = new WeakMap();
const ITEM_TYPES = Object.freeze(["item", "weapon", "crossbow", "armour", "mapItem", "nestItem"]);
const VISIBLE_STATES = new Set(["current", "conditional"]);
const CHARACTER_STATUS_LABELS = Object.freeze({ 0: "Dead", 1: "Alive", 2: "Imprisoned" });
const MAX_CONTEXT_PATH_DEPTH = 64;
const FANCY_WEAPON_MODELS = Object.freeze({
  "1068-gamedata.base": { label: "Edge Type 1", rank: 1 },
  "1071-gamedata.base": { label: "Edge Type 2", rank: 2 },
  "1069-gamedata.base": { label: "Edge Type 3", rank: 3 },
  "52293-rebirth.mod": { label: "Meitou", rank: 4 }
});

function asFinite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function exactItem(discoveryCatalog, entityId) {
  const matches = ITEM_TYPES.flatMap((entityType) => {
    const entity = discoveryCatalog.byType?.[entityType]?.[entityId];
    return entity ? [{ entityType, entity }] : [];
  });
  return matches.length === 1 ? matches[0] : null;
}

function recordsById(records) {
  const byId = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const id = record?.StringId;
    if (typeof id !== "string" || id.trim() === "") continue;
    const matches = byId.get(id) ?? [];
    matches.push(record);
    byId.set(id, matches);
  }
  return byId;
}

function wieldedWeaponFacts(
  character,
  discoveryCatalog,
  weaponRecords,
  manufacturers,
  diagnostics
) {
  const characterId = character.entityId;
  const gradeReferences = character.authored?.ReferenceCategories?.["weapon level"] ?? [];
  const candidateGrades = [];
  const authoredGrades = Array.isArray(gradeReferences) ? gradeReferences : [];
  for (const [position, reference] of authoredGrades.entries()) {
    const manufacturerId = reference?.StringId;
    const matches = manufacturers.get(manufacturerId) ?? [];
    if (matches.length !== 1) {
      diagnostics.push({
        level: "warning",
        code: "context_wielder_manufacturer_unresolved",
        message: `Weapon manufacturer '${String(manufacturerId ?? "(missing identity)")}' is ${matches.length > 1 ? "ambiguous" : "unresolved"} for '${characterId}'.`,
        context: { characterId, manufacturerId: manufacturerId ?? null, position }
      });
      continue;
    }
    const manufacturer = matches[0];
    const models = manufacturer.ReferenceCategories?.["weapon models"] ?? [];
    for (const [modelPosition, model] of (Array.isArray(models) ? models : []).entries()) {
      const modelId = model?.StringId;
      const qualifying = Object.hasOwn(FANCY_WEAPON_MODELS, modelId)
        ? FANCY_WEAPON_MODELS[modelId]
        : null;
      if (!qualifying) continue;
      candidateGrades.push({
        modelId,
        label: qualifying.label,
        rank: qualifying.rank,
        manufacturerId,
        manufacturerName: manufacturer.Name ?? manufacturerId,
        manufacturerPosition: position,
        modelPosition,
        manufacturerValue0: reference?.Value0 ?? null,
        manufacturerValue1: reference?.Value1 ?? null,
        manufacturerValue2: reference?.Value2 ?? null,
        modelValue0: model?.Value0 ?? null,
        modelValue1: model?.Value1 ?? null,
        modelValue2: model?.Value2 ?? null
      });
    }
  }
  if (candidateGrades.length === 0) return null;

  const weaponReferences = character.authored?.ReferenceCategories?.weapons ?? [];
  const weaponTypes = [];
  const weaponCatalog = discoveryCatalog.byType?.weapon ?? {};
  const authoredWeapons = Array.isArray(weaponReferences) ? weaponReferences : [];
  for (const [position, reference] of authoredWeapons.entries()) {
    const weaponId = reference?.StringId;
    const matches = weaponRecords.get(weaponId) ?? [];
    const weapon = Object.hasOwn(weaponCatalog, weaponId) ? weaponCatalog[weaponId] : null;
    if (matches.length !== 1 || !weapon) {
      diagnostics.push({
        level: "warning",
        code: "context_wielder_weapon_unresolved",
        message: `Weapon '${String(weaponId ?? "(missing identity)")}' is ${matches.length > 1 ? "ambiguous" : "unresolved"} for '${characterId}'.`,
        context: { characterId, weaponId: weaponId ?? null, position }
      });
      continue;
    }
    weaponTypes.push({
      weaponId,
      name: weapon.name,
      position,
      value0: reference?.Value0 ?? null,
      value1: reference?.Value1 ?? null,
      value2: reference?.Value2 ?? null
    });
  }
  if (weaponTypes.length === 0) return null;
  candidateGrades.sort(
    (left, right) =>
      right.rank - left.rank ||
      left.manufacturerId.localeCompare(right.manufacturerId) ||
      left.manufacturerPosition - right.manufacturerPosition ||
      left.modelPosition - right.modelPosition
  );
  return {
    candidateGrades,
    weaponTypes,
    bestGradeRank: candidateGrades[0].rank
  };
}

function appearanceIdentity(appearance) {
  return [appearance.parentType, appearance.parentId, appearance.occurrenceId].join(":");
}

function visibleAppearances(projection) {
  const byIdentity = new Map();
  for (const appearance of projection?.appearances ?? []) {
    if (!VISIBLE_STATES.has(appearance.state)) continue;
    const key = appearanceIdentity(appearance);
    const retained = byIdentity.get(key);
    if (!retained || (appearance.state === "current" && retained.state !== "current")) {
      byIdentity.set(key, cloneData(appearance));
    }
  }
  return [...byIdentity.values()].sort(
    (left, right) =>
      left.state.localeCompare(right.state) ||
      String(left.parentType).localeCompare(String(right.parentType)) ||
      String(left.parentId).localeCompare(String(right.parentId)) ||
      String(left.occurrenceId).localeCompare(String(right.occurrenceId))
  );
}

function initialScenario(baseline, datasets) {
  if (!baseline) return null;
  const replayed = replayScenario(baseline, []);
  return {
    snapshot: replayed.snapshot,
    lenses: createScenarioLensProjection({
      baseline,
      snapshot: replayed.snapshot,
      journal: replayed.journal,
      timeline: replayed.timeline,
      campaigns: Array.isArray(datasets.factionCampaigns) ? datasets.factionCampaigns : [],
      characters: Array.isArray(datasets.characters) ? datasets.characters : []
    })
  };
}

function worldStateCharacterIndex(baseline) {
  const byCharacterId = new Map();
  for (const state of baseline.worldStates ?? []) {
    for (const condition of state.conditions ?? []) {
      if (condition.category !== "NPC is" && condition.category !== "NPC is NOT") continue;
      const entries = byCharacterId.get(condition.entityId) ?? [];
      entries.push({
        stateId: state.id,
        name: state.name,
        category: condition.category,
        requiredStatus: condition.value
      });
      byCharacterId.set(condition.entityId, entries);
    }
  }
  for (const entries of byCharacterId.values()) {
    entries.sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.stateId.localeCompare(right.stateId) ||
        left.category.localeCompare(right.category) ||
        Number(left.requiredStatus) - Number(right.requiredStatus)
    );
  }
  return byCharacterId;
}

function exactFaction(discoveryCatalog, entityId) {
  return discoveryCatalog.byType?.faction?.[entityId] ?? null;
}

function affiliationFact(discoveryCatalog, affiliation) {
  if (!affiliation) return { factionId: null, factionName: "Unattributed", source: null };
  const faction = exactFaction(discoveryCatalog, affiliation.factionId);
  if (!faction) return { factionId: null, factionName: "Unattributed", source: null };
  return {
    factionId: faction.entityId,
    factionName: faction.name,
    source: affiliation.source
  };
}

function bountyIssuerFacts(discoveryCatalog, character, diagnostics) {
  const issuers = [];
  for (const [category, references] of Object.entries(
    character.authored?.ReferenceCategories ?? {}
  )) {
    const normalizedCategory = normalizeDiscoveryCategory(category);
    if (normalizedCategory !== "bounty faction" && normalizedCategory !== "bounty factions") {
      continue;
    }
    for (const [position, reference] of (Array.isArray(references) ? references : []).entries()) {
      const factionId =
        typeof reference?.StringId === "string" && reference.StringId.trim() !== ""
          ? reference.StringId
          : null;
      const faction = factionId ? exactFaction(discoveryCatalog, factionId) : null;
      if (!faction) {
        diagnostics.push({
          level: "warning",
          code: "context_bounty_issuer_unresolved",
          message: `Bounty issuer '${factionId ?? "(missing identity)"}' could not be resolved for '${character.entityId}'.`,
          context: { characterId: character.entityId, factionId, category, position }
        });
      }
      issuers.push({
        factionId,
        name: faction?.name ?? reference?.Name ?? factionId ?? "Unknown",
        category,
        position,
        resolved: Boolean(faction)
      });
    }
  }
  return issuers.sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      String(left.factionId).localeCompare(String(right.factionId)) ||
      left.category.localeCompare(right.category) ||
      left.position - right.position
  );
}

function normalizedCharacter(entity) {
  return { id: entity.entityId, name: entity.name, raw: entity.authored };
}

function characterLifeStatus(snapshot, entityId) {
  if (!snapshot?.characters || !Object.hasOwn(snapshot.characters, entityId)) {
    return { lifeStatus: null, lifeStatusLabel: "Reference only", scenarioTracked: false };
  }
  const lifeStatus = snapshot.characters[entityId];
  return {
    lifeStatus,
    lifeStatusLabel: CHARACTER_STATUS_LABELS[lifeStatus] ?? "Unavailable",
    scenarioTracked: true
  };
}

function deathItemFacts(discoveryCatalog, animal) {
  const references = animal.authored?.ReferenceCategories?.["death items"] ?? [];
  let total = 0;
  let invalid = false;
  const items = [];
  for (const [position, reference] of references.entries()) {
    const entityId = typeof reference?.StringId === "string" ? reference.StringId : null;
    const resolved = entityId ? exactItem(discoveryCatalog, entityId) : null;
    const value = asFinite(resolved?.entity?.authored?.Values?.value);
    if (!resolved || value === null) invalid = true;
    else total += value;
    items.push({
      entityId,
      entityType: resolved?.entityType ?? null,
      name: resolved?.entity?.name ?? reference?.Name ?? entityId ?? "Unknown",
      position,
      value,
      value0: reference?.Value0 ?? null,
      value1: reference?.Value1 ?? null,
      value2: reference?.Value2 ?? null,
      resolved: Boolean(resolved),
      validValue: value !== null
    });
  }
  return { total, invalid, items };
}

function campaignAnimalIds(datasets, internals) {
  const result = new Set();
  const squadIds = new Set(
    internals.byKey
      ? [...internals.byKey.values()]
          .filter(({ entityType }) => entityType === "squad")
          .map(({ entityId }) => entityId)
      : []
  );
  const rootSquads = new Set();
  for (const campaign of datasets.factionCampaigns ?? []) {
    for (const references of Object.values(campaign?.ReferenceCategories ?? {})) {
      for (const reference of Array.isArray(references) ? references : []) {
        if (squadIds.has(reference?.StringId)) rootSquads.add(reference.StringId);
      }
    }
  }
  const queue = [...rootSquads].map((id) => `squad:${id}`);
  const visited = new Set();
  while (queue.length > 0) {
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);
    for (const edge of internals.forwardByKey.get(key) ?? []) {
      const category = normalizeDiscoveryCategory(edge.category);
      if (
        edge.targetKind === "character" &&
        /^(animal|animals|animal2|animals2)$/u.test(category)
      ) {
        if (hasPositiveStructuralCapacity(edge)) result.add(edge.targetId);
      }
      if (edge.targetKind === "squad" && edge.targetKey) queue.push(edge.targetKey);
    }
  }
  return result;
}

function keyId(key) {
  return typeof key === "string" && key.includes(":") ? key.slice(key.indexOf(":") + 1) : null;
}

function internalRecord(internals, kind, id) {
  if (kind === "town") return internals.townById.get(id) ?? null;
  if (kind === "spawnArea") return internals.spawnAreaById.get(id) ?? null;
  if (kind === "vendorList") return internals.vendorById.get(id) ?? null;
  if (kind === "tradeCulture") return internals.tradeCultureById.get(id) ?? null;
  return internals.byKey.get(`${kind}:${id}`)?.raw ?? null;
}

function internalName(internals, kind, id) {
  const entity = internals.byKey.get(`${kind}:${id}`);
  return entity?.name ?? internalRecord(internals, kind, id)?.Name ?? id;
}

function edgeFact(edge) {
  return {
    category: edge.category,
    position: edge.position,
    sourceKey: edge.sourceKey,
    sourceKind: edge.sourceKind,
    targetKey: edge.targetKey,
    targetKind: edge.targetKind,
    targetId: edge.targetId,
    value0: edge.value0,
    value1: edge.value1,
    value2: edge.value2,
    resolution: edge.resolution
  };
}

function exactOutgoing(internals, sourceKey, category, targetKind) {
  const candidates = (internals.forwardByKey.get(sourceKey) ?? []).filter(
    (edge) => normalizeDiscoveryCategory(edge.category) === category
  );
  if (candidates.length === 0) {
    return { state: "missing", candidateIds: [], unresolvedIds: [] };
  }
  const resolvedIds = new Set();
  const unresolvedIds = new Set();
  for (const edge of candidates) {
    if (edge.resolution === "resolved" && edge.targetKind === targetKind && edge.targetId) {
      resolvedIds.add(edge.targetId);
    } else {
      unresolvedIds.add(edge.targetId ?? "(missing identity)");
    }
  }
  const candidateIds = [...resolvedIds].sort();
  const unresolved = [...unresolvedIds].sort();
  if (unresolved.length > 0) {
    return { state: "unresolved", candidateIds, unresolvedIds: unresolved };
  }
  if (candidateIds.length !== 1) {
    return {
      state: candidateIds.length > 1 ? "ambiguous" : "unresolved",
      candidateIds,
      unresolvedIds: []
    };
  }
  return {
    state: "resolved",
    entityId: candidateIds[0],
    candidateIds,
    unresolvedIds: []
  };
}

function factionResolutionForCommerce(internals, squadKeys, root) {
  for (const squadKey of [...squadKeys].reverse()) {
    const hasFactionCategory = (internals.forwardByKey.get(squadKey) ?? []).some(
      (edge) => normalizeDiscoveryCategory(edge.category) === "faction"
    );
    if (!hasFactionCategory) continue;
    const result = exactOutgoing(internals, squadKey, "faction", "faction");
    return {
      ...result,
      source: "squad",
      sourceId: keyId(squadKey),
      factionId: result.entityId ?? null,
      factionName: result.entityId
        ? internalName(internals, "faction", result.entityId)
        : "Unattributed"
    };
  }
  if (root.parentType === "town" && root.effectiveParentId) {
    const sourceKey = `town:${root.effectiveParentId}`;
    const result = exactOutgoing(internals, sourceKey, "faction", "faction");
    return {
      ...result,
      source: "town",
      sourceId: root.effectiveParentId,
      factionId: result.entityId ?? null,
      factionName: result.entityId
        ? internalName(internals, "faction", result.entityId)
        : "Unattributed"
    };
  }
  return {
    state: "missing",
    source: null,
    sourceId: null,
    factionId: null,
    factionName: "Unattributed",
    candidateIds: [],
    unresolvedIds: []
  };
}

function tradeCultureResolution(internals, faction) {
  if (faction.state !== "resolved" || !faction.factionId) {
    return {
      state: faction.state,
      cultureId: null,
      cultureName: "Unattributed",
      candidateIds: faction.candidateIds ?? [],
      unresolvedIds: faction.unresolvedIds ?? []
    };
  }
  const result = exactOutgoing(
    internals,
    `faction:${faction.factionId}`,
    "trade culture",
    "tradeCulture"
  );
  return {
    ...result,
    cultureId: result.entityId ?? null,
    cultureName: result.entityId
      ? internalName(internals, "tradeCulture", result.entityId)
      : "Not authored"
  };
}

function cultureItemAssessment(internals, culture, itemKey) {
  if (culture.state !== "resolved" || !culture.cultureId) {
    return { state: "uncertain", reason: `trade-culture-${culture.state}` };
  }
  const itemId = keyId(itemKey);
  const forbidden = (internals.forwardByKey.get(`tradeCulture:${culture.cultureId}`) ?? []).filter(
    (edge) =>
      normalizeDiscoveryCategory(edge.category) === "forbidden items" &&
      (edge.targetKey === itemKey || (!edge.targetKey && edge.targetId === itemId))
  );
  if (forbidden.some((edge) => edge.targetKey === itemKey && edge.resolution === "resolved")) {
    return { state: "blocked", reason: "forbidden-item" };
  }
  if (forbidden.length > 0) {
    return { state: "uncertain", reason: "forbidden-item-unresolved" };
  }
  return { state: "confirmed", reason: "not-forbidden" };
}

function vendorAssessment(internals, squadKeys, root, itemKey) {
  const faction = factionResolutionForCommerce(internals, squadKeys, root);
  const culture = tradeCultureResolution(internals, faction);
  const result = cultureItemAssessment(internals, culture, itemKey);
  return { ...result, faction, culture };
}

function walkCommerceRoot(internals, root, { onVendor, onCharacter } = {}) {
  const visitSquad = (squadKey, squadKeys, pathEdges, pathKeys) => {
    if (pathKeys.length > MAX_CONTEXT_PATH_DEPTH || pathKeys.has(squadKey)) return;
    const nextKeys = new Set(pathKeys);
    nextKeys.add(squadKey);
    const nextSquads = [...squadKeys, squadKey];
    for (const edge of internals.forwardByKey.get(squadKey) ?? []) {
      if (!edge.targetKey || edge.resolution !== "resolved") continue;
      if (edge.targetKind === "squad" && canTraverseDiscoveryPlacement(edge)) {
        visitSquad(edge.targetKey, nextSquads, [...pathEdges, edgeFact(edge)], nextKeys);
      } else if (edge.targetKind === "vendorList" && canTraverseDiscoveryPlacement(edge)) {
        onVendor?.({
          root,
          squadKeys: nextSquads,
          vendorKey: edge.targetKey,
          pathEdges: [...pathEdges, edgeFact(edge)]
        });
      } else if (edge.targetKind === "character" && canTraverseDiscoveryPlacement(edge)) {
        onCharacter?.({
          root,
          squadKeys: nextSquads,
          characterKey: edge.targetKey,
          membership: edgeFact(edge),
          pathEdges: [...pathEdges, edgeFact(edge)]
        });
      }
    }
  };

  if (root.parentType === "town" && root.rootKey.startsWith("town:")) {
    for (const edge of internals.forwardByKey.get(root.rootKey) ?? []) {
      if (edge.targetKind === "squad" && canTraverseDiscoveryPlacement(edge)) {
        visitSquad(edge.targetKey, [], [edgeFact(edge)], new Set([root.rootKey]));
      }
    }
  } else if (root.parentType === "spawnArea" && root.rootKey.startsWith("squad:")) {
    visitSquad(root.rootKey, [], [], new Set());
  }
}

function commerceRoots(discoveryCatalog, snapshot, lenses, parentTypes) {
  return createDiscoveryAppearanceRoots({ catalog: discoveryCatalog, snapshot, lenses }).filter(
    (root) => VISIBLE_STATES.has(root.state) && parentTypes.has(root.parentType)
  );
}

function vendorItemEvidence(internals, root, squadKeys, vendorKey, pathEdges, acceptItem) {
  const evidence = [];
  for (const edge of internals.forwardByKey.get(vendorKey) ?? []) {
    if (
      !edge.targetKey ||
      edge.resolution !== "resolved" ||
      !ITEM_TYPES.includes(edge.targetKind) ||
      !canTraverseDiscoveryPlacement(edge) ||
      !hasPositiveStructuralCapacity(edge)
    ) {
      continue;
    }
    const entity = internals.byKey.get(edge.targetKey);
    if (!entity || !acceptItem(entity, edge)) continue;
    const assessment = vendorAssessment(internals, squadKeys, root, edge.targetKey);
    evidence.push({
      kind: "vendor",
      availability: assessment.state,
      availabilityReason: assessment.reason,
      root: cloneData(root),
      itemId: entity.entityId,
      itemType: entity.entityType,
      itemName: entity.name,
      itemValue: asFinite(entity.raw?.Values?.value),
      vendorListId: keyId(vendorKey),
      vendorListName: internalName(internals, "vendorList", keyId(vendorKey)),
      squadIds: squadKeys.map(keyId),
      squadNames: squadKeys.map((key) => internalName(internals, "squad", keyId(key))),
      faction: assessment.faction,
      tradeCulture: assessment.culture,
      stockReference: edgeFact(edge),
      path: [...pathEdges, edgeFact(edge)]
    });
  }
  return evidence;
}

function collectTreasureEvidence(discoveryCatalog, snapshot, lenses) {
  const internals = getDiscoveryCatalogInternals(discoveryCatalog);
  const evidence = [];
  for (const root of commerceRoots(discoveryCatalog, snapshot, lenses, new Set(["town"]))) {
    walkCommerceRoot(internals, root, {
      onVendor({ squadKeys, vendorKey, pathEdges }) {
        evidence.push(
          ...vendorItemEvidence(internals, root, squadKeys, vendorKey, pathEdges, (item) => {
            const value = asFinite(item.raw?.Values?.value);
            return value !== null && value >= 5000;
          })
        );
      },
      onCharacter({ characterKey, membership, pathEdges }) {
        const character = internals.byKey.get(characterKey);
        if (!character || character.subtype !== "Character") return;
        const references = character.raw?.ReferenceCategories?.["death items"] ?? [];
        for (const [position, reference] of (Array.isArray(references)
          ? references
          : []
        ).entries()) {
          const itemId = typeof reference?.StringId === "string" ? reference.StringId : null;
          const item = itemId ? exactItem(discoveryCatalog, itemId) : null;
          const value = asFinite(item?.entity?.authored?.Values?.value);
          if (!item || value === null || value < 5000) continue;
          evidence.push({
            kind: "deathLoot",
            availability: "confirmed",
            availabilityReason: "individual-death-item",
            root: cloneData(root),
            characterId: character.entityId,
            characterName: character.name,
            characterMembership: cloneData(membership),
            itemId,
            itemType: item.entityType,
            itemName: item.entity.name,
            itemValue: value,
            deathItemReference: {
              position,
              value0: reference?.Value0 ?? null,
              value1: reference?.Value1 ?? null,
              value2: reference?.Value2 ?? null
            },
            path: cloneData(pathEdges)
          });
        }
      }
    });
  }
  return evidence;
}

function collectNarcoticEvidence(discoveryCatalog, snapshot, lenses, itemKeys) {
  const internals = getDiscoveryCatalogInternals(discoveryCatalog);
  const evidence = [];
  for (const root of commerceRoots(
    discoveryCatalog,
    snapshot,
    lenses,
    new Set(["town", "spawnArea"])
  )) {
    walkCommerceRoot(internals, root, {
      onVendor({ squadKeys, vendorKey, pathEdges }) {
        evidence.push(
          ...vendorItemEvidence(internals, root, squadKeys, vendorKey, pathEdges, (item) =>
            itemKeys.has(item.key)
          )
        );
      }
    });
  }
  return evidence;
}

function occurrenceIdentity(root) {
  return root.parentType === "town"
    ? `town:${root.parentId}:${root.occurrenceId}`
    : `spawnArea:${root.parentId}`;
}

function sortEvidence(left, right) {
  return (
    String(left.root?.parentId).localeCompare(String(right.root?.parentId)) ||
    String(left.root?.occurrenceId).localeCompare(String(right.root?.occurrenceId)) ||
    String(left.kind).localeCompare(String(right.kind)) ||
    String(left.itemName).localeCompare(String(right.itemName)) ||
    String(left.vendorListId ?? left.characterId).localeCompare(
      String(right.vendorListId ?? right.characterId)
    )
  );
}

function aggregateLocations(evidence, { includeBlocked = false } = {}) {
  const locations = new Map();
  for (const entry of evidence) {
    if (!includeBlocked && entry.availability === "blocked") continue;
    const key = occurrenceIdentity(entry.root);
    const location = locations.get(key) ?? {
      key,
      parentType: entry.root.parentType,
      parentId: entry.root.parentId,
      effectiveParentIds: new Set(),
      occurrenceId: entry.root.occurrenceId,
      name: entry.root.name,
      coordinates: entry.root.coordinates,
      state: entry.root.state,
      availability: entry.availability === "uncertain" ? "uncertain" : "confirmed",
      evidence: []
    };
    if (entry.root.effectiveParentId) location.effectiveParentIds.add(entry.root.effectiveParentId);
    if (entry.root.state === "current") location.state = "current";
    if (entry.availability === "confirmed") location.availability = "confirmed";
    location.evidence.push(cloneData(entry));
    locations.set(key, location);
  }
  return [...locations.values()]
    .map((location) => ({
      ...location,
      effectiveParentIds: [...location.effectiveParentIds].sort(),
      evidence: location.evidence.sort(sortEvidence)
    }))
    .sort(
      (left, right) =>
        left.parentType.localeCompare(right.parentType) ||
        left.parentId.localeCompare(right.parentId) ||
        String(left.occurrenceId).localeCompare(String(right.occurrenceId))
    );
}

function groupTreasureEvidence(discoveryCatalog, evidence) {
  const internals = getDiscoveryCatalogInternals(discoveryCatalog);
  const groups = new Map();
  for (const entry of evidence) {
    const townId = entry.root.parentId;
    const group = groups.get(townId) ?? {
      townId,
      name: internalName(internals, "town", townId),
      evidence: []
    };
    group.evidence.push(entry);
    groups.set(townId, group);
  }
  return [...groups.values()]
    .map((group) => {
      const qualifying = group.evidence.filter(
        (entry) => entry.kind === "deathLoot" || entry.availability !== "blocked"
      );
      if (qualifying.length === 0) return null;
      const placements = aggregateLocations(qualifying);
      return {
        townId: group.townId,
        entityId: group.townId,
        name: group.name,
        qualificationKinds: [
          ...(qualifying.some(({ kind }) => kind === "vendor") ? ["valuableStock"] : []),
          ...(qualifying.some(({ kind }) => kind === "deathLoot") ? ["deathLoot"] : [])
        ],
        vendorEvidence: group.evidence
          .filter(({ kind, availability }) => kind === "vendor" && availability !== "blocked")
          .sort(sortEvidence),
        blockedVendorEvidence: group.evidence
          .filter(({ kind, availability }) => kind === "vendor" && availability === "blocked")
          .sort(sortEvidence),
        deathLootEvidence: group.evidence
          .filter(({ kind }) => kind === "deathLoot")
          .sort(sortEvidence),
        placements
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.townId.localeCompare(right.townId)
    );
}

function illegalGoodsFacts(discoveryCatalog, itemKey) {
  const internals = getDiscoveryCatalogInternals(discoveryCatalog);
  const facts = [];
  for (const faction of Object.values(discoveryCatalog.byType?.faction ?? {})) {
    const culture = tradeCultureResolution(internals, {
      state: "resolved",
      factionId: faction.entityId,
      factionName: faction.name,
      candidateIds: [faction.entityId],
      unresolvedIds: []
    });
    if (culture.state !== "resolved" || !culture.cultureId) continue;
    const matching = (internals.forwardByKey.get(`tradeCulture:${culture.cultureId}`) ?? []).filter(
      (edge) =>
        normalizeDiscoveryCategory(edge.category) === "illegal goods" &&
        edge.targetKey === itemKey &&
        edge.resolution === "resolved"
    );
    if (matching.length === 0) continue;
    facts.push({
      factionId: faction.entityId,
      factionName: faction.name,
      cultureId: culture.cultureId,
      cultureName: culture.cultureName,
      references: matching.map(edgeFact)
    });
  }
  return facts.sort(
    (left, right) =>
      left.factionName.localeCompare(right.factionName) ||
      left.factionId.localeCompare(right.factionId)
  );
}

function createUnavailableCatalog(discoveryCatalog, diagnostics, reason) {
  const characters = Object.values(discoveryCatalog.byType?.character ?? {})
    .filter(({ subtype }) => subtype === "Character")
    .map((entity) => ({ entityId: entity.entityId, name: entity.name, authored: entity.authored }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
    );
  const animals = Object.values(discoveryCatalog.byType?.character ?? {})
    .filter(({ subtype }) => subtype === "Animal")
    .map((entity) => ({ entityId: entity.entityId, name: entity.name, authored: entity.authored }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
    );
  return deepFreeze({
    schemaVersion: 1,
    manifestId: discoveryCatalog.manifestId,
    available: false,
    reason,
    characters,
    animals,
    keyCharacters: [],
    bountyTargets: [],
    fancyWeaponWielders: [],
    deadlyAnimals: [],
    nestTreasures: [],
    treasureSpots: [],
    narcotics: Object.values(discoveryCatalog.byType?.item ?? {})
      .filter((entity) => asFinite(entity.authored?.Values?.["item function"]) === 8)
      .map((entity) => ({
        entityId: entity.entityId,
        name: entity.name,
        value: asFinite(entity.authored?.Values?.value),
        baselineEvidence: [],
        illegalGoods: []
      }))
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
      ),
    diagnostics
  });
}

/** Builds stable Context eligibility and usedness from the untouched scenario baseline. */
export function createDiscoveryContextCatalog({ discoveryCatalog, datasets, baseline } = {}) {
  if (!discoveryCatalog || !datasets || typeof datasets !== "object") {
    throw new TypeError("Discovery Context requires a discovery catalog and datasets.");
  }
  const diagnostics = [];
  let initial;
  try {
    initial = initialScenario(baseline, datasets);
    if (!initial) throw new TypeError("Scenario baseline is unavailable.");
  } catch (error) {
    diagnostics.push({
      level: "warning",
      code: "context_reachability_unavailable",
      message: `Context reachability could not be initialized: ${error.message}`,
      context: {}
    });
    return createUnavailableCatalog(
      discoveryCatalog,
      diagnostics,
      "Scenario-aware reachability is unavailable for this manifest."
    );
  }

  const internals = getDiscoveryCatalogInternals(discoveryCatalog);
  const campaignAnimals = campaignAnimalIds(datasets, internals);
  const characterEntities = Object.values(discoveryCatalog.byType?.character ?? {})
    .filter(({ subtype }) => subtype === "Character")
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
    );
  const affiliations = resolveCharacterAffiliations({
    baseline,
    baselineWorld: initial.snapshot.baselineWorld,
    characters: characterEntities.map(normalizedCharacter)
  });
  const affiliationDiagnostics = new Map(
    affiliations.diagnostics.map((entry) => [entry.entityId, entry])
  );
  const worldStatesByCharacterId = worldStateCharacterIndex(baseline);
  const weaponRecords = recordsById(datasets.weapons);
  const manufacturers = recordsById(datasets.weaponManufacturers);
  const characters = [];
  const keyCharacters = [];
  const bountyTargets = [];
  const fancyWeaponWielders = [];
  for (const entity of characterEntities) {
    const initialProjection = projectDiscoveryEntity({
      catalog: discoveryCatalog,
      snapshot: initial.snapshot,
      lenses: initial.lenses,
      target: { entityType: "character", entityId: entity.entityId }
    });
    const appearances = visibleAppearances(initialProjection);
    const worldStates = worldStatesByCharacterId.get(entity.entityId) ?? [];
    const bountyAmount = asFinite(entity.authored?.Values?.["bounty amount"]);
    const bountyChance = asFinite(entity.authored?.Values?.["bounty chance"]);
    const bountyFuzz = asFinite(entity.authored?.Values?.["bounty amount fuzz"]);
    const issuers = bountyIssuerFacts(discoveryCatalog, entity, diagnostics);
    const keyCandidate = worldStates.length > 0;
    const bountyCandidate =
      bountyAmount !== null && bountyAmount > 0 && bountyChance !== null && bountyChance > 0;
    const character = {
      entityId: entity.entityId,
      name: entity.name,
      used: appearances.length > 0,
      keyCandidate,
      bountyCandidate,
      worldStates,
      bountyAmount,
      bountyChance,
      bountyFuzz,
      issuers,
      affiliation: affiliationFact(discoveryCatalog, affiliations.byCharacterId[entity.entityId]),
      affiliationDiagnostic: affiliationDiagnostics.get(entity.entityId) ?? null,
      baselineAppearances: appearances
    };
    characters.push(character);
    if (character.used && keyCandidate) keyCharacters.push(character);
    if (character.used && bountyCandidate) bountyTargets.push(character);
    if (character.used) {
      const weaponFacts = wieldedWeaponFacts(
        entity,
        discoveryCatalog,
        weaponRecords,
        manufacturers,
        diagnostics
      );
      if (weaponFacts) fancyWeaponWielders.push({ ...character, ...weaponFacts });
    }
    if ((keyCandidate || bountyCandidate) && character.affiliationDiagnostic) {
      diagnostics.push({
        level: "warning",
        code: "context_character_affiliation_unattributed",
        message: `Character affiliation is unattributed for '${entity.entityId}'.`,
        context: cloneData(character.affiliationDiagnostic)
      });
    }
  }
  bountyTargets.sort(
    (left, right) =>
      right.bountyAmount - left.bountyAmount ||
      left.name.localeCompare(right.name) ||
      left.entityId.localeCompare(right.entityId)
  );
  fancyWeaponWielders.sort(
    (left, right) =>
      right.bestGradeRank - left.bestGradeRank ||
      left.name.localeCompare(right.name) ||
      left.entityId.localeCompare(right.entityId)
  );
  const animals = [];
  const deadlyAnimals = [];
  for (const entity of Object.values(discoveryCatalog.byType?.character ?? {})
    .filter(({ subtype }) => subtype === "Animal")
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
    )) {
    const strength = asFinite(entity.authored?.Values?.["animal strength"]);
    const deathItems = deathItemFacts(discoveryCatalog, entity);
    const qualifiesStrength = strength !== null && strength >= 50;
    const qualifiesDeathItems = !deathItems.invalid && deathItems.total >= 5000;
    const eligibilityUncertain =
      !qualifiesStrength && !qualifiesDeathItems && (strength === null || deathItems.invalid);
    const initialProjection = projectDiscoveryEntity({
      catalog: discoveryCatalog,
      snapshot: initial.snapshot,
      lenses: initial.lenses,
      target: { entityType: "character", entityId: entity.entityId }
    });
    const appearances = visibleAppearances(initialProjection);
    const used = appearances.length > 0;
    const incomingSquad = (internals.reverseByKey.get(`character:${entity.entityId}`) ?? []).some(
      ({ sourceKind }) => sourceKind === "squad"
    );
    const animal = {
      entityId: entity.entityId,
      name: entity.name,
      strength,
      deathItemValue: deathItems.total,
      deathItems: deathItems.items,
      qualifies: qualifiesStrength || qualifiesDeathItems,
      reasons: [
        ...(qualifiesStrength ? ["strength"] : []),
        ...(qualifiesDeathItems ? ["deathItemValue"] : [])
      ],
      eligibilityUncertain,
      used,
      campaignOnly: !used && campaignAnimals.has(entity.entityId),
      deadSquad: !used && incomingSquad,
      baselineAppearances: appearances
    };
    animals.push(animal);
    if (eligibilityUncertain) {
      diagnostics.push({
        level: "warning",
        code: "context_animal_eligibility_unresolved",
        message: `Deadly Animal eligibility is unresolved for '${entity.entityId}'.`,
        context: { entityId: entity.entityId }
      });
    }
    if (animal.used && animal.qualifies) deadlyAnimals.push(animal);
  }

  const nestTreasures = [];
  for (const item of Object.values(discoveryCatalog.byType?.nestItem ?? {}).sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
  )) {
    const value = asFinite(item.authored?.Values?.value);
    if (value === null || value <= 25) continue;
    const sources = [];
    for (const edge of internals.reverseByKey.get(`nestItem:${item.entityId}`) ?? []) {
      if (
        edge.sourceKind !== "nest" ||
        normalizeDiscoveryCategory(edge.category) !== "debris" ||
        !hasPositiveStructuralCapacity(edge)
      )
        continue;
      const nestId = edge.sourceKey.slice("nest:".length);
      const nest = discoveryCatalog.byType?.nest?.[nestId];
      if (!nest) continue;
      const initialProjection = projectDiscoveryEntity({
        catalog: discoveryCatalog,
        snapshot: initial.snapshot,
        lenses: initial.lenses,
        target: { entityType: "nest", entityId: nestId }
      });
      const appearances = visibleAppearances(initialProjection);
      if (appearances.length === 0) continue;
      sources.push({
        nestId,
        name: nest.name,
        value0: edge.value0,
        value1: edge.value1,
        value2: edge.value2,
        position: edge.position,
        baselineAppearances: appearances
      });
    }
    if (sources.length === 0) continue;
    nestTreasures.push({
      entityId: item.entityId,
      name: item.name,
      value,
      sources: sources.sort(
        (left, right) =>
          left.name.localeCompare(right.name) || left.nestId.localeCompare(right.nestId)
      )
    });
  }

  const treasureSpots = groupTreasureEvidence(
    discoveryCatalog,
    collectTreasureEvidence(discoveryCatalog, initial.snapshot, initial.lenses)
  );
  const narcoticEntities = Object.values(discoveryCatalog.byType?.item ?? {})
    .filter((entity) => asFinite(entity.authored?.Values?.["item function"]) === 8)
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.entityId.localeCompare(right.entityId)
    );
  const narcoticKeys = new Set(narcoticEntities.map(({ entityId }) => `item:${entityId}`));
  const narcoticEvidence = collectNarcoticEvidence(
    discoveryCatalog,
    initial.snapshot,
    initial.lenses,
    narcoticKeys
  );
  const narcotics = narcoticEntities.map((entity) => ({
    entityId: entity.entityId,
    name: entity.name,
    value: asFinite(entity.authored?.Values?.value),
    baselineEvidence: narcoticEvidence
      .filter(({ itemId, itemType }) => itemType === "item" && itemId === entity.entityId)
      .sort(sortEvidence),
    illegalGoods: illegalGoodsFacts(discoveryCatalog, `item:${entity.entityId}`)
  }));

  const publicCatalog = deepFreeze({
    schemaVersion: 1,
    manifestId: discoveryCatalog.manifestId,
    available: true,
    reason: "",
    characters,
    keyCharacters,
    bountyTargets,
    fancyWeaponWielders,
    animals,
    deadlyAnimals,
    nestTreasures,
    treasureSpots,
    narcotics,
    diagnostics: diagnostics.sort(
      (left, right) =>
        left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
    )
  });
  CONTEXT_INTERNALS.set(publicCatalog, { initial });
  return publicCatalog;
}

function projectAnimal(contextCatalog, discoveryCatalog, animal, snapshot, lenses) {
  const projection = projectDiscoveryEntity({
    catalog: discoveryCatalog,
    snapshot,
    lenses,
    target: { entityType: "character", entityId: animal.entityId }
  });
  const placements = visibleAppearances(projection);
  return {
    ...cloneData(animal),
    currentLocationCount: placements.filter(({ state }) => state === "current").length,
    conditionalLocationCount: placements.filter(({ state }) => state === "conditional").length,
    placements,
    mapControlsAvailable: contextCatalog.available && Boolean(snapshot && lenses)
  };
}

function projectCharacter(contextCatalog, discoveryCatalog, character, snapshot, lenses) {
  const projection = projectDiscoveryEntity({
    catalog: discoveryCatalog,
    snapshot,
    lenses,
    target: { entityType: "character", entityId: character.entityId }
  });
  const placements = visibleAppearances(projection);
  return {
    ...cloneData(character),
    ...characterLifeStatus(snapshot, character.entityId),
    currentLocationCount: placements.filter(({ state }) => state === "current").length,
    conditionalLocationCount: placements.filter(({ state }) => state === "conditional").length,
    placements,
    mapControlsAvailable: contextCatalog.available && Boolean(snapshot && lenses)
  };
}

function projectTreasureSpots(contextCatalog, discoveryCatalog, snapshot, lenses) {
  const dynamicGroups = new Map(
    groupTreasureEvidence(
      discoveryCatalog,
      collectTreasureEvidence(discoveryCatalog, snapshot, lenses)
    ).map((group) => [group.townId, group])
  );
  return contextCatalog.treasureSpots.map((stable) => {
    const dynamic = dynamicGroups.get(stable.townId);
    const placements = dynamic?.placements ?? [];
    const dynamicByOccurrence = new Map(
      placements.map((placement) => [placement.occurrenceId, placement])
    );
    const occurrences = stable.placements.map((placement) => {
      const current = dynamicByOccurrence.get(placement.occurrenceId);
      return {
        occurrenceId: placement.occurrenceId,
        name: placement.name,
        coordinates: cloneData(placement.coordinates),
        state: current?.state ?? "unavailable",
        availability: current?.availability ?? "unavailable",
        effectiveParentIds: cloneData(current?.effectiveParentIds ?? [])
      };
    });
    const vendorEvidence = dynamic?.vendorEvidence ?? [];
    return {
      ...cloneData(stable),
      occurrences,
      placements: cloneData(placements),
      vendorEvidence: cloneData(vendorEvidence),
      blockedVendorEvidence: cloneData(dynamic?.blockedVendorEvidence ?? []),
      deathLootEvidence: cloneData(dynamic?.deathLootEvidence ?? []),
      currentLocationCount: placements.filter(({ state }) => state === "current").length,
      conditionalLocationCount: placements.filter(({ state }) => state === "conditional").length,
      uncertainLocationCount: placements.filter(({ availability }) => availability === "uncertain")
        .length,
      mapControlsAvailable: contextCatalog.available && Boolean(snapshot && lenses)
    };
  });
}

function projectNarcotics(contextCatalog, discoveryCatalog, snapshot, lenses) {
  const keys = new Set(contextCatalog.narcotics.map(({ entityId }) => `item:${entityId}`));
  const dynamic = collectNarcoticEvidence(discoveryCatalog, snapshot, lenses, keys);
  return contextCatalog.narcotics.map((item) => {
    const evidence = dynamic.filter(
      ({ itemId, itemType }) => itemType === "item" && itemId === item.entityId
    );
    const purchaseEvidence = evidence.filter(({ availability }) => availability !== "blocked");
    const blockedEvidence = evidence.filter(({ availability }) => availability === "blocked");
    const placements = aggregateLocations(purchaseEvidence);
    const blockedLocations = aggregateLocations(blockedEvidence, { includeBlocked: true });
    return {
      ...cloneData(item),
      evidence: evidence.sort(sortEvidence),
      confirmedEvidence: evidence
        .filter(({ availability }) => availability === "confirmed")
        .sort(sortEvidence),
      uncertainEvidence: evidence
        .filter(({ availability }) => availability === "uncertain")
        .sort(sortEvidence),
      blockedEvidence: blockedEvidence.sort(sortEvidence),
      placements,
      currentLocationCount: placements.filter(
        ({ state, availability }) => state === "current" && availability === "confirmed"
      ).length,
      conditionalLocationCount: placements.filter(
        ({ state, availability }) => state === "conditional" && availability === "confirmed"
      ).length,
      uncertainLocationCount: placements.filter(({ availability }) => availability === "uncertain")
        .length,
      blockedLocationCount: blockedLocations.length,
      mapControlsAvailable: contextCatalog.available && Boolean(snapshot && lenses),
      prohibitionAuthored: item.illegalGoods.length > 0
    };
  });
}

/** Reclassifies map targets without changing stable baseline usedness or eligibility. */
export function projectDiscoveryContextSubject({
  contextCatalog,
  discoveryCatalog,
  snapshot = null,
  lenses = null,
  subjectId
} = {}) {
  if (!DISCOVERY_CONTEXT_SUBJECTS.includes(subjectId)) {
    throw new TypeError(`Unknown Discovery Context subject '${String(subjectId)}'.`);
  }
  if (!contextCatalog || !discoveryCatalog) {
    throw new TypeError("A Context catalog and discovery catalog are required.");
  }
  if (
    subjectId === "keyCharacters" ||
    subjectId === "bountyTargets" ||
    subjectId === "fancyWeaponWielders"
  ) {
    const rows = contextCatalog[subjectId].map((character) =>
      projectCharacter(contextCatalog, discoveryCatalog, character, snapshot, lenses)
    );
    return deepFreeze({
      subjectId,
      available: contextCatalog.available,
      reason: contextCatalog.reason,
      rows,
      diagnostics: cloneData(contextCatalog.diagnostics)
    });
  }
  if (subjectId === "deadlyAnimals") {
    const rows = contextCatalog.deadlyAnimals.map((animal) =>
      projectAnimal(contextCatalog, discoveryCatalog, animal, snapshot, lenses)
    );
    return deepFreeze({
      subjectId,
      available: contextCatalog.available,
      reason: contextCatalog.reason,
      rows,
      diagnostics: cloneData(contextCatalog.diagnostics)
    });
  }
  if (subjectId === "treasureSpots") {
    return deepFreeze({
      subjectId,
      available: contextCatalog.available,
      reason: contextCatalog.reason,
      rows: projectTreasureSpots(contextCatalog, discoveryCatalog, snapshot, lenses),
      diagnostics: cloneData(contextCatalog.diagnostics)
    });
  }
  if (subjectId === "narcotics") {
    return deepFreeze({
      subjectId,
      available: contextCatalog.available,
      reason: contextCatalog.reason,
      rows: projectNarcotics(contextCatalog, discoveryCatalog, snapshot, lenses),
      diagnostics: cloneData(contextCatalog.diagnostics)
    });
  }

  const rows = contextCatalog.nestTreasures.map((treasure) => ({
    ...cloneData(treasure),
    sources: treasure.sources.map((source) => {
      const projection = projectDiscoveryEntity({
        catalog: discoveryCatalog,
        snapshot,
        lenses,
        target: { entityType: "nest", entityId: source.nestId }
      });
      const placements = visibleAppearances(projection);
      return {
        ...cloneData(source),
        currentLocationCount: placements.filter(({ state }) => state === "current").length,
        conditionalLocationCount: placements.filter(({ state }) => state === "conditional").length,
        placements,
        mapControlsAvailable: contextCatalog.available && Boolean(snapshot && lenses)
      };
    })
  }));
  return deepFreeze({
    subjectId,
    available: contextCatalog.available,
    reason: contextCatalog.reason,
    rows,
    diagnostics: cloneData(contextCatalog.diagnostics)
  });
}

/** Projects exact Trade Culture illegality into raster geometries without owning map state. */
export function projectNarcoticProhibition({
  contextCatalog,
  discoveryCatalog,
  snapshot = null,
  lenses = null,
  areaIndex = null,
  itemId
} = {}) {
  const item = contextCatalog?.narcotics?.find((candidate) => candidate.entityId === itemId);
  if (!item) throw new TypeError(`Unknown Narcotic Item ID '${String(itemId)}'.`);
  if (!contextCatalog.available || !snapshot || !lenses || !areaIndex?.available) {
    return deepFreeze({
      available: false,
      reason: !contextCatalog.available
        ? contextCatalog.reason
        : !snapshot || !lenses
          ? "scenario-projection-unavailable"
          : "raster-geography-unavailable",
      itemId,
      authored: item.illegalGoods.length > 0,
      areas: [],
      diagnostics: []
    });
  }
  if (item.illegalGoods.length === 0) {
    return deepFreeze({
      available: true,
      reason: null,
      itemId,
      authored: false,
      areas: [],
      diagnostics: []
    });
  }

  const internals = getDiscoveryCatalogInternals(discoveryCatalog);
  const enforcingFactionIds = new Set(item.illegalGoods.map(({ factionId }) => factionId));
  const diagnostics = [];
  const byGeometry = new Map();
  for (const root of createDiscoveryAppearanceRoots({
    catalog: discoveryCatalog,
    snapshot,
    lenses
  })) {
    if (!VISIBLE_STATES.has(root.state)) continue;
    let faction;
    let geometry;
    let source;
    if (root.parentType === "town" && root.rootKey.startsWith("town:")) {
      faction = exactOutgoing(internals, root.rootKey, "faction", "faction");
      if (faction.state !== "resolved" || !enforcingFactionIds.has(faction.entityId)) continue;
      if (!root.coordinates) {
        diagnostics.push({
          level: "warning",
          code: "context_prohibition_town_coordinates_missing",
          message: `Town occurrence '${root.occurrenceId}' has no coordinates for prohibition projection.`,
          context: { itemId, townId: root.parentId, occurrenceId: root.occurrenceId }
        });
        continue;
      }
      geometry = areaIndex.getGeometryAtKenshi(root.coordinates);
      source = "townOwner";
    } else if (root.parentType === "spawnArea" && root.rootKey.startsWith("squad:")) {
      faction = exactOutgoing(internals, root.rootKey, "faction", "faction");
      if (faction.state !== "resolved" || !enforcingFactionIds.has(faction.entityId)) continue;
      geometry = areaIndex.getGeometryForAreaId(root.parentId);
      source = "spawnSquad";
    } else {
      continue;
    }
    if (!geometry || geometry.excluded) {
      diagnostics.push({
        level: "warning",
        code: "context_prohibition_geometry_unresolved",
        message: `Prohibition evidence for '${root.parentId}' has no eligible raster geometry.`,
        context: { itemId, parentType: root.parentType, parentId: root.parentId }
      });
      continue;
    }
    const area = byGeometry.get(geometry.key) ?? {
      geometryKey: geometry.key,
      state: root.state,
      caution: Boolean(geometry.ambiguous || geometry.indeterminate || geometry.mixedExclusion),
      areaIds: [...geometry.areaIds],
      areaNames: [...geometry.areaNames],
      evidence: []
    };
    if (root.state === "current") area.state = "current";
    area.evidence.push({
      source,
      factionId: faction.entityId,
      factionName: internalName(internals, "faction", faction.entityId),
      parentType: root.parentType,
      parentId: root.parentId,
      effectiveParentId: root.effectiveParentId,
      occurrenceId: root.occurrenceId,
      state: root.state
    });
    byGeometry.set(geometry.key, area);
  }

  return deepFreeze({
    available: true,
    reason: null,
    itemId,
    authored: true,
    areas: [...byGeometry.values()]
      .map((area) => ({
        ...area,
        evidence: area.evidence.sort(
          (left, right) =>
            left.parentType.localeCompare(right.parentType) ||
            left.parentId.localeCompare(right.parentId) ||
            String(left.occurrenceId).localeCompare(String(right.occurrenceId))
        )
      }))
      .sort((left, right) => left.geometryKey.localeCompare(right.geometryKey)),
    diagnostics: diagnostics.sort(
      (left, right) =>
        left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
    )
  });
}

function colorKeyFromIndex(value) {
  return `${String((value >> 16) & 0xff)},${String((value >> 8) & 0xff)},${String(value & 0xff)}`;
}

function writeRgba(pixels, offset, color, alpha) {
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = alpha;
}

/** Creates a caller-copyable passive raster for one active Narcotic prohibition projection. */
export function createNarcoticProhibitionRaster({ areaIndex, projection } = {}) {
  if (!areaIndex?.available || !projection?.available) {
    return Object.freeze({
      available: false,
      reason: !areaIndex?.available ? "raster-geography-unavailable" : projection?.reason,
      width: 0,
      height: 0,
      statusCounts: Object.freeze({}),
      copyRgba: () => new Uint8ClampedArray()
    });
  }
  const colorIndexes = areaIndex.copyColorIndexes();
  const projectedByKey = new Map(projection.areas.map((area) => [area.geometryKey, area]));
  const pixels = new Uint8ClampedArray(areaIndex.width * areaIndex.height * 4);
  const currentColor = [176, 48, 54];
  const conditionalColor = [214, 151, 48];
  const cautionColor = [216, 176, 72];
  const at = (x, y) =>
    x < 0 || y < 0 || x >= areaIndex.width || y >= areaIndex.height
      ? null
      : colorIndexes[y * areaIndex.width + x];
  for (let y = 0; y < areaIndex.height; y += 1) {
    for (let x = 0; x < areaIndex.width; x += 1) {
      const flatIndex = y * areaIndex.width + x;
      const colorIndex = colorIndexes[flatIndex];
      const area = projectedByKey.get(colorKeyFromIndex(colorIndex));
      if (!area) continue;
      const offset = flatIndex * 4;
      if (area.caution) {
        if ((x + y) % 6 === 0 || (x - y + areaIndex.height) % 6 === 0) {
          writeRgba(pixels, offset, cautionColor, 205);
        }
        continue;
      }
      if (area.state === "current") {
        if ((x + y) % 7 < 3) writeRgba(pixels, offset, currentColor, 178);
        continue;
      }
      const boundary =
        at(x - 1, y) !== colorIndex ||
        at(x + 1, y) !== colorIndex ||
        at(x, y - 1) !== colorIndex ||
        at(x, y + 1) !== colorIndex;
      if (boundary && (x + y) % 8 < 5) {
        writeRgba(pixels, offset, conditionalColor, 224);
      }
    }
  }
  const statusCounts = {
    current: projection.areas.filter(({ state, caution }) => state === "current" && !caution)
      .length,
    conditional: projection.areas.filter(
      ({ state, caution }) => state === "conditional" && !caution
    ).length,
    caution: projection.areas.filter(({ caution }) => caution).length
  };
  return Object.freeze({
    available: true,
    reason: null,
    width: areaIndex.width,
    height: areaIndex.height,
    statusCounts: Object.freeze(statusCounts),
    copyRgba: () => new Uint8ClampedArray(pixels)
  });
}

export function getDiscoveryContextCatalogInternals(catalog) {
  return CONTEXT_INTERNALS.get(catalog) ?? null;
}
