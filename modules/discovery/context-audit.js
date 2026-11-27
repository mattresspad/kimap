import { deepFreeze } from "../scenario/utils.js";
import { projectDiscoveryContextSubject, projectNarcoticProhibition } from "./context.js";

function countBy(values, select) {
  const counts = new Map();
  for (const value of values) {
    const key = select(value) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => String(left).localeCompare(String(right)))
  );
}

function placementCounts(projection) {
  const placements =
    projection.subjectId === "nestTreasures"
      ? projection.rows.flatMap(({ sources }) => sources.flatMap(({ placements }) => placements))
      : projection.rows.flatMap(({ placements: values }) => values);
  return countBy(placements, ({ state }) => state);
}

function affiliationCounts(rows) {
  return countBy(rows, ({ affiliation }) => affiliation?.source ?? "unattributed");
}

/** Produces aggregate-only Context policy findings suitable for custom manifests. */
export function createDiscoveryContextAudit({
  contextCatalog,
  discoveryCatalog,
  snapshot = null,
  lenses = null,
  areaIndex = null,
  manifest = null
} = {}) {
  if (!contextCatalog || !discoveryCatalog) {
    throw new TypeError("Context audit requires Context and discovery catalogs.");
  }
  const keyCharacters = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "keyCharacters"
  });
  const bountyTargets = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "bountyTargets"
  });
  const fancyWeaponWielders = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "fancyWeaponWielders"
  });
  const animals = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "deadlyAnimals"
  });
  const treasures = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "nestTreasures"
  });
  const treasureSpots = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "treasureSpots"
  });
  const narcotics = projectDiscoveryContextSubject({
    contextCatalog,
    discoveryCatalog,
    snapshot,
    lenses,
    subjectId: "narcotics"
  });
  const prohibition = contextCatalog.narcotics
    .filter(({ illegalGoods }) => illegalGoods.length > 0)
    .map(({ entityId }) =>
      projectNarcoticProhibition({
        contextCatalog,
        discoveryCatalog,
        snapshot,
        lenses,
        areaIndex,
        itemId: entityId
      })
    );
  const usedAnimals = contextCatalog.animals.filter(({ used }) => used);
  const unusedAnimals = contextCatalog.animals.filter(({ used }) => !used);
  const usedCharacters = contextCatalog.characters.filter(({ used }) => used);
  const unusedCharacters = contextCatalog.characters.filter(({ used }) => !used);
  const keyIds = new Set(contextCatalog.keyCharacters.map(({ entityId }) => entityId));
  const overlap = contextCatalog.bountyTargets.filter(({ entityId }) => keyIds.has(entityId));
  return deepFreeze({
    schemaVersion: 1,
    available: contextCatalog.available,
    reason: contextCatalog.reason,
    manifest: {
      id: manifest?.id ?? contextCatalog.manifestId ?? null,
      title: manifest?.title ?? null
    },
    characters: {
      total: contextCatalog.characters.length,
      usable: usedCharacters.length,
      unused: unusedCharacters.length,
      worldStateCandidates: contextCatalog.characters.filter(({ keyCandidate }) => keyCandidate)
        .length,
      bountyCandidates: contextCatalog.characters.filter(({ bountyCandidate }) => bountyCandidate)
        .length
    },
    keyCharacters: {
      total: contextCatalog.keyCharacters.length,
      affiliations: affiliationCounts(contextCatalog.keyCharacters),
      worldStateReferences: contextCatalog.keyCharacters.reduce(
        (total, character) => total + character.worldStates.length,
        0
      ),
      placements: placementCounts(keyCharacters)
    },
    bountyTargets: {
      total: contextCatalog.bountyTargets.length,
      affiliations: affiliationCounts(contextCatalog.bountyTargets),
      withAuthoredIssuers: contextCatalog.bountyTargets.filter(({ issuers }) => issuers.length > 0)
        .length,
      withoutAuthoredIssuers: contextCatalog.bountyTargets.filter(
        ({ issuers }) => issuers.length === 0
      ).length,
      resolvedIssuerReferences: contextCatalog.bountyTargets.reduce(
        (total, character) => total + character.issuers.filter(({ resolved }) => resolved).length,
        0
      ),
      unresolvedIssuerReferences: contextCatalog.bountyTargets.reduce(
        (total, character) => total + character.issuers.filter(({ resolved }) => !resolved).length,
        0
      ),
      placements: placementCounts(bountyTargets)
    },
    fancyWeaponWielders: {
      total: contextCatalog.fancyWeaponWielders.length,
      withMeitouCandidate: contextCatalog.fancyWeaponWielders.filter(({ candidateGrades }) =>
        candidateGrades.some(({ label }) => label === "Meitou")
      ).length,
      withEdgeCandidate: contextCatalog.fancyWeaponWielders.filter(({ candidateGrades }) =>
        candidateGrades.some(({ label }) => label.startsWith("Edge Type "))
      ).length,
      placements: placementCounts(fancyWeaponWielders)
    },
    overlap: {
      keyCharactersAndBountyTargets: overlap.length
    },
    animals: {
      total: contextCatalog.animals.length,
      usable: usedAnimals.length,
      unused: unusedAnimals.length,
      deadly: contextCatalog.deadlyAnimals.length,
      qualifyingReasons: {
        strength: contextCatalog.deadlyAnimals.filter(({ reasons }) => reasons.includes("strength"))
          .length,
        deathItemValue: contextCatalog.deadlyAnimals.filter(({ reasons }) =>
          reasons.includes("deathItemValue")
        ).length,
        both: contextCatalog.deadlyAnimals.filter(({ reasons }) => reasons.length === 2).length
      },
      unresolvedEligibility: contextCatalog.animals.filter(({ eligibilityUncertain }) =>
        Boolean(eligibilityUncertain)
      ).length,
      campaignOnly: unusedAnimals.filter(({ campaignOnly }) => campaignOnly).length,
      deadSquad: unusedAnimals.filter(({ deadSquad }) => deadSquad).length,
      placements: placementCounts(animals)
    },
    nestTreasures: {
      total: contextCatalog.nestTreasures.length,
      reachableSources: contextCatalog.nestTreasures.reduce(
        (total, treasure) => total + treasure.sources.length,
        0
      ),
      placements: placementCounts(treasures)
    },
    treasureSpots: {
      total: contextCatalog.treasureSpots.length,
      exactOccurrences: contextCatalog.treasureSpots.reduce(
        (total, town) => total + town.placements.length,
        0
      ),
      withGeneratedStock: contextCatalog.treasureSpots.filter(({ qualificationKinds }) =>
        qualificationKinds.includes("valuableStock")
      ).length,
      withDeathLoot: contextCatalog.treasureSpots.filter(({ qualificationKinds }) =>
        qualificationKinds.includes("deathLoot")
      ).length,
      confirmedVendorEvidence: contextCatalog.treasureSpots.reduce(
        (total, town) =>
          total +
          town.vendorEvidence.filter(({ availability }) => availability === "confirmed").length,
        0
      ),
      uncertainVendorEvidence: contextCatalog.treasureSpots.reduce(
        (total, town) =>
          total +
          town.vendorEvidence.filter(({ availability }) => availability === "uncertain").length,
        0
      ),
      blockedVendorEvidence: contextCatalog.treasureSpots.reduce(
        (total, town) => total + town.blockedVendorEvidence.length,
        0
      ),
      deathLootEvidence: contextCatalog.treasureSpots.reduce(
        (total, town) => total + town.deathLootEvidence.length,
        0
      ),
      placements: placementCounts(treasureSpots)
    },
    narcotics: {
      total: contextCatalog.narcotics.length,
      names: contextCatalog.narcotics.map(({ name }) => name).sort(),
      confirmedVendorEvidence: narcotics.rows.reduce(
        (total, item) => total + item.confirmedEvidence.length,
        0
      ),
      uncertainVendorEvidence: narcotics.rows.reduce(
        (total, item) => total + item.uncertainEvidence.length,
        0
      ),
      blockedVendorEvidence: narcotics.rows.reduce(
        (total, item) => total + item.blockedEvidence.length,
        0
      ),
      withAuthoredProhibition: contextCatalog.narcotics.filter(
        ({ illegalGoods }) => illegalGoods.length > 0
      ).length,
      illegalGoodsMappings: contextCatalog.narcotics.reduce(
        (total, item) => total + item.illegalGoods.length,
        0
      ),
      placements: placementCounts(narcotics),
      prohibitionAreas: prohibition.reduce((totals, projection) => {
        for (const area of projection.areas ?? []) {
          const key = area.caution ? "caution" : area.state;
          totals[key] = (totals[key] ?? 0) + 1;
        }
        return totals;
      }, {})
    },
    diagnostics: countBy(contextCatalog.diagnostics, ({ code }) => code)
  });
}

export function formatDiscoveryContextAuditSummary(audit) {
  return [
    `Discovery Context audit: ${audit.manifest.title ?? audit.manifest.id ?? "unknown manifest"}`,
    `Characters: ${String(audit.characters.usable)} usable, ${String(audit.characters.unused)} unused, from ${String(audit.characters.total)} raw Characters.`,
    `Key Characters: ${String(audit.keyCharacters.total)} of ${String(audit.characters.worldStateCandidates)} world-state candidates; ${String(audit.keyCharacters.placements.current ?? 0)}/${String(audit.keyCharacters.placements.conditional ?? 0)} current/conditional targets.`,
    `Bounty Targets: ${String(audit.bountyTargets.total)} of ${String(audit.characters.bountyCandidates)} positive amount/chance candidates; ${String(audit.bountyTargets.withAuthoredIssuers)} with authored issuers and ${String(audit.bountyTargets.withoutAuthoredIssuers)} without.`,
    `Fancy Weapon Wielders: ${String(audit.fancyWeaponWielders.total)} reachable Characters; ${String(audit.fancyWeaponWielders.withMeitouCandidate)} with Meitou and ${String(audit.fancyWeaponWielders.withEdgeCandidate)} with Edge candidate models.`,
    `Animals: ${String(audit.animals.usable)} usable, ${String(audit.animals.unused)} unused, ${String(audit.animals.deadly)} Deadly Animals.`,
    `Animal exclusions: ${String(audit.animals.campaignOnly)} campaign-only, ${String(audit.animals.deadSquad)} linked only through unused squads.`,
    `Nest Treasures: ${String(audit.nestTreasures.total)} items across ${String(audit.nestTreasures.reachableSources)} reachable Nest sources.`,
    `Treasure Spots: ${String(audit.treasureSpots.total)} Towns across ${String(audit.treasureSpots.exactOccurrences)} exact occurrences; ${String(audit.treasureSpots.confirmedVendorEvidence)}/${String(audit.treasureSpots.uncertainVendorEvidence)}/${String(audit.treasureSpots.blockedVendorEvidence)} confirmed/uncertain/blocked vendor paths.`,
    `Narcotics: ${String(audit.narcotics.total)} Items; ${String(audit.narcotics.confirmedVendorEvidence)}/${String(audit.narcotics.uncertainVendorEvidence)}/${String(audit.narcotics.blockedVendorEvidence)} confirmed/uncertain/blocked vendor paths; ${String(audit.narcotics.withAuthoredProhibition)} with authored prohibition.`,
    `Current/conditional targets: Animals ${String(audit.animals.placements.current ?? 0)}/${String(audit.animals.placements.conditional ?? 0)}; Nest Treasures ${String(audit.nestTreasures.placements.current ?? 0)}/${String(audit.nestTreasures.placements.conditional ?? 0)}.`
  ].join("\n");
}
