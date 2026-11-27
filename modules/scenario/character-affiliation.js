import { deepFreeze, stableObject } from "./utils.js";

export const GUARANTEED_MEMBER_CATEGORIES = Object.freeze(["leader", "squad", "squad2"]);

const MAX_AFFILIATION_SQUAD_VISITS = 512;
const DEFAULT_AFFILIATION_CACHE = new WeakMap();

function nameAndId(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function referenceId(reference) {
  return typeof reference?.StringId === "string" ? reference.StringId.trim() : "";
}

function rawReferences(record, category) {
  const value = record?.ReferenceCategories?.[category];
  if (value === undefined) return { state: "absent", entries: [] };
  return Array.isArray(value)
    ? { state: "available", entries: value }
    : { state: "malformed", entries: [] };
}

export function resolveFactionReference(record, baseline) {
  const category = rawReferences(record, "faction");
  if (category.state === "absent" || category.entries.length === 0) {
    return { state: "none", candidateIds: [], unresolvedIds: [] };
  }
  if (category.state === "malformed") {
    return { state: "invalid", candidateIds: [], unresolvedIds: ["(malformed category)"] };
  }

  const candidateIds = new Set();
  const unresolvedIds = new Set();
  for (const reference of category.entries) {
    const id = referenceId(reference);
    if (id === "" || !baseline.factionById[id]) unresolvedIds.add(id || "(missing identity)");
    else candidateIds.add(id);
  }

  const candidates = [...candidateIds].sort();
  const unresolved = [...unresolvedIds].sort();
  if (unresolved.length > 0 || candidates.length === 0) {
    return { state: "invalid", candidateIds: candidates, unresolvedIds: unresolved };
  }
  if (candidates.length > 1) {
    return { state: "ambiguous", candidateIds: candidates, unresolvedIds: [] };
  }
  return {
    state: "resolved",
    factionId: candidates[0],
    candidateIds: candidates,
    unresolvedIds: []
  };
}

function isGuaranteed(reference) {
  return Number.isFinite(reference?.Value0) && reference.Value0 > 0;
}

function createMembershipIndex(baseline) {
  const parentsByMemberId = new Map();
  const malformedSquadIds = new Set();

  for (const squad of baseline.squads) {
    for (const category of GUARANTEED_MEMBER_CATEGORIES) {
      const result = rawReferences(squad.raw, category);
      if (result.state === "malformed") {
        malformedSquadIds.add(squad.id);
        continue;
      }
      for (const reference of result.entries) {
        const memberId = referenceId(reference);
        if (memberId === "" || !isGuaranteed(reference)) continue;
        const parents = parentsByMemberId.get(memberId) ?? new Set();
        parents.add(squad.id);
        parentsByMemberId.set(memberId, parents);
      }
    }
  }

  return { parentsByMemberId, malformedSquadIds };
}

function traverseParentSquads(characterId, membership) {
  const pending = [...(membership.parentsByMemberId.get(characterId) ?? [])].map((squadId) => ({
    squadId,
    path: []
  }));
  const visited = new Set();
  const cycleIds = new Set();
  const malformedIds = new Set();
  let limitReached = false;

  while (pending.length > 0) {
    const { squadId, path } = pending.pop();
    if (path.includes(squadId)) {
      cycleIds.add(squadId);
      continue;
    }
    if (visited.has(squadId)) continue;
    visited.add(squadId);
    if (visited.size > MAX_AFFILIATION_SQUAD_VISITS) {
      limitReached = true;
      break;
    }
    if (membership.malformedSquadIds.has(squadId)) malformedIds.add(squadId);

    const nextPath = [...path, squadId];
    for (const parentId of membership.parentsByMemberId.get(squadId) ?? []) {
      pending.push({ squadId: parentId, path: nextPath });
    }
  }

  return {
    squadIds: [...visited].sort(),
    cycleIds: [...cycleIds].sort(),
    malformedIds: [...malformedIds].sort(),
    limitReached
  };
}

function combineFactionEvidence(squadIds, baseline) {
  const candidateIds = new Set();
  const unresolvedIds = new Set();
  let invalid = false;

  for (const squadId of squadIds) {
    const squad = baseline.squadById[squadId];
    if (!squad) continue;
    const result = resolveFactionReference(squad.raw, baseline);
    for (const candidateId of result.candidateIds) candidateIds.add(candidateId);
    for (const unresolvedId of result.unresolvedIds) unresolvedIds.add(unresolvedId);
    if (result.state === "invalid" || result.state === "ambiguous") invalid = true;
  }

  const candidates = [...candidateIds].sort();
  const unresolved = [...unresolvedIds].sort();
  if (invalid || unresolved.length > 0) {
    return { state: "invalid", candidateIds: candidates, unresolvedIds: unresolved };
  }
  if (candidates.length === 0) {
    return { state: "none", candidateIds: [], unresolvedIds: [] };
  }
  if (candidates.length > 1) {
    return { state: "ambiguous", candidateIds: candidates, unresolvedIds: [] };
  }
  return {
    state: "resolved",
    factionId: candidates[0],
    candidateIds: candidates,
    unresolvedIds: []
  };
}

function createBaselineResidentOwners(baseline, baselineWorld) {
  const ownersByResidentSquadId = new Map();
  for (const baseTownId of baseline.mapTownIds) {
    const townState = baselineWorld?.towns?.[baseTownId];
    const effectiveTown = baseline.townById[townState?.activeTownId ?? baseTownId];
    const ownerId = townState?.ownerId;
    if (!effectiveTown || !baseline.factionById[ownerId]) continue;

    const residentReferences = rawReferences(effectiveTown.raw, "residents");
    if (residentReferences.state !== "available") continue;
    for (const reference of residentReferences.entries) {
      const squadId = referenceId(reference);
      if (!baseline.squadById[squadId]) continue;
      const owners = ownersByResidentSquadId.get(squadId) ?? new Set();
      owners.add(ownerId);
      ownersByResidentSquadId.set(squadId, owners);
    }
  }
  return ownersByResidentSquadId;
}

function diagnosticForCharacter(character, tier, reason, candidateIds = [], unresolvedIds = []) {
  return {
    id: `character:${character.id}`,
    kind: "Character",
    entityId: character.id,
    name: character.name,
    tier,
    reason,
    candidateFactionIds: [...candidateIds],
    unresolvedIds: [...unresolvedIds]
  };
}

/**
 * Resolves one stable baseline affiliation for each supplied Character without display-name matching.
 * Precedence is direct Character faction, guaranteed parent-Squad faction, then initialized mapped-
 * Town resident owner. Omit `characters` to use the scenario-tracked Character subset.
 */
export function resolveCharacterAffiliations({ baseline, baselineWorld, characters } = {}) {
  if (!baseline || typeof baseline !== "object") {
    throw new TypeError("Character affiliation resolution requires a scenario baseline.");
  }
  const targets = Array.isArray(characters) ? characters : baseline.characters;
  const cacheable = targets === baseline.characters;
  const cached = cacheable ? DEFAULT_AFFILIATION_CACHE.get(baseline) : null;
  if (cached?.baselineWorld === baselineWorld) return cached.result;

  const membership = createMembershipIndex(baseline);
  const residentOwners = createBaselineResidentOwners(baseline, baselineWorld);
  const assignments = [];
  const diagnostics = [];

  for (const character of targets) {
    const direct = resolveFactionReference(character.raw, baseline);
    if (direct.state === "resolved") {
      assignments.push({
        characterId: character.id,
        factionId: direct.factionId,
        source: "character"
      });
      continue;
    }
    if (direct.state !== "none") {
      diagnostics.push(
        diagnosticForCharacter(
          character,
          "character",
          direct.state === "ambiguous"
            ? "Direct faction evidence is ambiguous."
            : "Direct faction evidence is malformed or unresolved.",
          direct.candidateIds,
          direct.unresolvedIds
        )
      );
      continue;
    }

    const traversal = traverseParentSquads(character.id, membership);
    if (
      traversal.limitReached ||
      traversal.cycleIds.length > 0 ||
      traversal.malformedIds.length > 0
    ) {
      diagnostics.push(
        diagnosticForCharacter(
          character,
          "squad",
          traversal.limitReached
            ? "Guaranteed squad traversal reached its safety limit."
            : traversal.cycleIds.length > 0
              ? "Guaranteed squad traversal contains a cycle."
              : "Guaranteed squad membership is malformed.",
          [],
          [...traversal.cycleIds, ...traversal.malformedIds]
        )
      );
      continue;
    }

    const squad = combineFactionEvidence(traversal.squadIds, baseline);
    if (squad.state === "resolved") {
      assignments.push({ characterId: character.id, factionId: squad.factionId, source: "squad" });
      continue;
    }
    if (squad.state !== "none") {
      diagnostics.push(
        diagnosticForCharacter(
          character,
          "squad",
          squad.state === "ambiguous"
            ? "Guaranteed squad membership reaches more than one faction."
            : "Guaranteed squad faction evidence is malformed or unresolved.",
          squad.candidateIds,
          squad.unresolvedIds
        )
      );
      continue;
    }

    const townOwnerIds = new Set();
    for (const squadId of traversal.squadIds) {
      for (const ownerId of residentOwners.get(squadId) ?? []) townOwnerIds.add(ownerId);
    }
    const townCandidates = [...townOwnerIds].sort();
    if (townCandidates.length === 1) {
      assignments.push({ characterId: character.id, factionId: townCandidates[0], source: "town" });
    } else {
      diagnostics.push(
        diagnosticForCharacter(
          character,
          "town",
          townCandidates.length > 1
            ? "Baseline town residency reaches more than one owner."
            : "No unique baseline faction evidence was found.",
          townCandidates
        )
      );
    }
  }

  const result = deepFreeze({
    byCharacterId: stableObject(
      assignments.map((assignment) => [assignment.characterId, assignment])
    ),
    diagnostics: diagnostics.sort(nameAndId)
  });
  if (cacheable) DEFAULT_AFFILIATION_CACHE.set(baseline, { baselineWorld, result });
  return result;
}
