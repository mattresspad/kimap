import { deepFreeze, diagnostic, stableObject } from "./utils.js";
import { createPowerRankReportProjection } from "./power-report.js";

export const ALLY_RELATION_THRESHOLD = 60;

const STATUS_LABELS = Object.freeze({
  0: "Dead",
  1: "Alive",
  2: "Imprisoned"
});

const ACKNOWLEDGED_VANILLA_BASELINE =
  "vanilla:56b5eb802ac4d395b67ae10da0a79c4781853aaca11fc8b76a3ec9215f809411";

const ACKNOWLEDGED_VANILLA_CONDITIONLESS_STATES = new Set([
  "63144-rebirth.mod",
  "1533834-rebirth.mod",
  "63881-Dialogue.mod",
  "59123-Dialogue.mod",
  "62347-Dialogue.mod",
  "65302-Dialogue.mod",
  "97160-Dialogue.mod",
  "1534045-rebirth.mod"
]);

function compareNameAndId(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function safeName(record, fallback) {
  return typeof record?.Name === "string" && record.Name.trim() !== "" ? record.Name : fallback;
}

export function classifyFactionRelation(faction, value) {
  if (value >= ALLY_RELATION_THRESHOLD) return "ally";
  if (value <= faction.enemyThreshold) return "enemy";
  return "neutral";
}

function selectRelations(baseline, snapshot) {
  const factions = baseline.factions
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      value: snapshot.relations[faction.id] ?? 0,
      classification: classifyFactionRelation(faction, snapshot.relations[faction.id] ?? 0),
      enemyThreshold: faction.enemyThreshold,
      notReal: faction.raw?.Values?.["not real"] === true
    }))
    .sort(compareNameAndId);

  return {
    factions,
    byFactionId: stableObject(factions.map((faction) => [faction.id, faction])),
    allies: factions
      .filter((faction) => faction.classification === "ally")
      .sort((left, right) => right.value - left.value || compareNameAndId(left, right)),
    enemies: factions
      .filter((faction) => faction.classification === "enemy")
      .sort((left, right) => left.value - right.value || compareNameAndId(left, right))
  };
}

function createDiagnosticCollector() {
  const entries = [];
  const keys = new Set();

  return {
    add(level, code, message, context = {}) {
      const key = `${code}:${JSON.stringify(context)}`;
      if (keys.has(key)) return;
      keys.add(key);
      entries.push(diagnostic(level, code, message, context));
    },
    entries
  };
}

function buildCampaignIndex(rawCampaigns, diagnostics) {
  const campaignById = new Map();
  for (const [position, campaign] of rawCampaigns.entries()) {
    const id = typeof campaign?.StringId === "string" ? campaign.StringId.trim() : "";
    if (id === "") {
      diagnostics.add(
        "warning",
        "campaign_missing_identity",
        `Campaign record ${String(position)} has no usable identity.`,
        { position }
      );
      continue;
    }
    if (campaignById.has(id)) {
      diagnostics.add(
        "warning",
        "campaign_duplicate_identity",
        `Campaign '${id}' is duplicated; the first record is retained.`,
        { campaignId: id }
      );
      continue;
    }
    campaignById.set(id, campaign);
  }
  return campaignById;
}

function campaignConditionKey(condition) {
  return `${condition.worldStateId}:${String(condition.requiredValue)}`;
}

function selectCampaigns(baseline, snapshot, rawCampaigns) {
  const diagnostics = createDiagnosticCollector();
  const campaignById = buildCampaignIndex(rawCampaigns, diagnostics);
  const cache = new Map();

  function resolveCampaign(campaignId, stack = []) {
    if (cache.has(campaignId)) return cache.get(campaignId);
    if (stack.includes(campaignId)) {
      const cycle = [...stack.slice(stack.indexOf(campaignId)), campaignId];
      diagnostics.add(
        "warning",
        "campaign_inheritance_cycle",
        `Campaign inheritance contains a cycle at '${campaignId}'.`,
        { campaignId, cycle }
      );
      return {
        id: campaignId,
        name: campaignId,
        status: "indeterminate",
        statusLabel: "Indeterminate",
        conditions: [],
        satisfiedCount: 0,
        requiredCount: 0,
        indeterminate: true
      };
    }

    const raw = campaignById.get(campaignId);
    if (!raw) {
      diagnostics.add(
        "warning",
        "campaign_missing_reference",
        `Campaign '${campaignId}' is referenced but missing from the campaign dataset.`,
        { campaignId }
      );
      return {
        id: campaignId,
        name: campaignId,
        status: "indeterminate",
        statusLabel: "Indeterminate",
        conditions: [],
        satisfiedCount: 0,
        requiredCount: 0,
        indeterminate: true
      };
    }

    const nextStack = [...stack, campaignId];
    const inheritedRefs = raw.ReferenceCategories?.["inherits from"];
    const inherited = Array.isArray(inheritedRefs) ? inheritedRefs : [];
    let indeterminate = inheritedRefs !== undefined && !Array.isArray(inheritedRefs);
    const conditions = [];

    if (indeterminate) {
      diagnostics.add(
        "warning",
        "campaign_invalid_inheritance",
        `Campaign '${campaignId}' has malformed inheritance references.`,
        { campaignId }
      );
    }

    for (const reference of inherited) {
      const inheritedId = typeof reference?.StringId === "string" ? reference.StringId.trim() : "";
      if (inheritedId === "") {
        indeterminate = true;
        diagnostics.add(
          "warning",
          "campaign_invalid_inheritance",
          `Campaign '${campaignId}' has an inheritance reference without an identity.`,
          { campaignId }
        );
        continue;
      }
      const inheritedCampaign = resolveCampaign(inheritedId, nextStack);
      indeterminate ||= inheritedCampaign.indeterminate;
      conditions.push(...inheritedCampaign.conditions);
    }

    const rawConditions = raw.ReferenceCategories?.["world state"];
    if (rawConditions !== undefined && !Array.isArray(rawConditions)) {
      indeterminate = true;
      diagnostics.add(
        "warning",
        "campaign_invalid_world_state_conditions",
        `Campaign '${campaignId}' has malformed world-state prerequisites.`,
        { campaignId }
      );
    }

    for (const reference of Array.isArray(rawConditions) ? rawConditions : []) {
      const worldStateId = typeof reference?.StringId === "string" ? reference.StringId.trim() : "";
      const requiredValue = reference?.Value0;
      if (
        worldStateId === "" ||
        (requiredValue !== 0 && requiredValue !== 1) ||
        !Object.hasOwn(snapshot.worldStates, worldStateId)
      ) {
        indeterminate = true;
        diagnostics.add(
          "warning",
          "campaign_unknown_world_state",
          `Campaign '${campaignId}' has a prerequisite KiMap cannot evaluate.`,
          { campaignId, worldStateId: worldStateId || null, requiredValue }
        );
        continue;
      }
      const actualValue = snapshot.worldStates[worldStateId];
      conditions.push({
        worldStateId,
        name: safeName(reference, baseline.worldStateById[worldStateId]?.name ?? worldStateId),
        requiredValue,
        actualValue,
        satisfied: actualValue === requiredValue
      });
    }

    const deduplicated = [];
    const seenConditions = new Set();
    for (const condition of conditions) {
      const key = campaignConditionKey(condition);
      if (seenConditions.has(key)) continue;
      seenConditions.add(key);
      deduplicated.push(condition);
    }

    const requirementsByState = new Map();
    for (const condition of deduplicated) {
      const values = requirementsByState.get(condition.worldStateId) ?? new Set();
      values.add(condition.requiredValue);
      requirementsByState.set(condition.worldStateId, values);
      if (values.size > 1) {
        indeterminate = true;
        diagnostics.add(
          "warning",
          "campaign_conflicting_prerequisites",
          `Campaign '${campaignId}' requires conflicting values for world state '${condition.worldStateId}'.`,
          { campaignId, worldStateId: condition.worldStateId }
        );
      }
    }

    const satisfiedCount = deduplicated.filter((condition) => condition.satisfied).length;
    let status = "no-prerequisites";
    let statusLabel = "No world-state prerequisites";
    if (indeterminate) {
      status = "indeterminate";
      statusLabel = "Indeterminate";
    } else if (deduplicated.length > 0 && satisfiedCount === deduplicated.length) {
      status = "eligible";
      statusLabel = "Eligible by world state";
    } else if (deduplicated.length > 0) {
      status = "blocked";
      statusLabel = "Blocked by world state";
    }

    const result = {
      id: campaignId,
      name: safeName(raw, campaignId),
      displayName:
        typeof raw.Values?.["display name"] === "string" && raw.Values["display name"].trim() !== ""
          ? raw.Values["display name"]
          : safeName(raw, campaignId),
      status,
      statusLabel,
      conditions: deduplicated,
      satisfiedCount,
      requiredCount: deduplicated.length,
      indeterminate,
      schedulingNote:
        "World-state eligibility does not predict whether the Kenshi campaign scheduler will run this campaign."
    };
    cache.set(campaignId, result);
    return result;
  }

  const byFactionId = {};
  for (const faction of baseline.factions) {
    const rawReferences = faction.raw?.ReferenceCategories?.campaigns;
    if (rawReferences !== undefined && !Array.isArray(rawReferences)) {
      diagnostics.add(
        "warning",
        "faction_invalid_campaign_references",
        `Faction '${faction.id}' has malformed campaign references.`,
        { factionId: faction.id }
      );
    }
    const campaigns = [];
    for (const reference of Array.isArray(rawReferences) ? rawReferences : []) {
      const campaignId = typeof reference?.StringId === "string" ? reference.StringId.trim() : "";
      if (campaignId === "") {
        diagnostics.add(
          "warning",
          "faction_invalid_campaign_reference",
          `Faction '${faction.id}' has a campaign reference without an identity.`,
          { factionId: faction.id }
        );
        continue;
      }
      const resolved = resolveCampaign(campaignId);
      campaigns.push({
        ...resolved,
        name: resolved.name === campaignId ? safeName(reference, campaignId) : resolved.name
      });
    }
    byFactionId[faction.id] = campaigns;
  }

  return {
    byFactionId: stableObject(Object.entries(byFactionId)),
    diagnostics: diagnostics.entries
  };
}

function acknowledgeDiagnostics(snapshot) {
  const acknowledged = [];
  const visible = [];
  for (const entry of snapshot.diagnostics ?? []) {
    const isAcknowledged =
      snapshot.baseline.key === ACKNOWLEDGED_VANILLA_BASELINE &&
      entry.code === "conditionless_world_state" &&
      ACKNOWLEDGED_VANILLA_CONDITIONLESS_STATES.has(entry.context?.stateId);
    (isAcknowledged ? acknowledged : visible).push(entry);
  }
  return { visible, acknowledged };
}

function selectGlobalStatus(baseline, snapshot, relations, diagnosticPolicy) {
  const characters = baseline.characters
    .map((character) => ({
      id: character.id,
      name: character.name,
      status: snapshot.characters[character.id],
      statusLabel: STATUS_LABELS[snapshot.characters[character.id]] ?? "Unknown"
    }))
    .sort(compareNameAndId);
  const worldStates = baseline.worldStates
    .map((state) => ({
      id: state.id,
      name: state.name,
      active: state.active,
      value: snapshot.worldStates[state.id] ?? 0,
      valueLabel: state.active
        ? (snapshot.worldStates[state.id] ?? 0) === 1
          ? "TRUE"
          : "FALSE"
        : "INACTIVE"
    }))
    .sort(compareNameAndId);

  return {
    relations: relations.factions.filter((faction) => !faction.notReal),
    characters,
    worldStates,
    diagnostics: diagnosticPolicy.visible,
    acknowledgedDiagnosticCount: diagnosticPolicy.acknowledged.length
  };
}

function selectWorldHistory(timeline, journal) {
  if (Array.isArray(timeline)) {
    return timeline.map((entry) => ({
      id: entry.id,
      commandId: entry.commandId,
      occurredAt: entry.occurredAt,
      type: entry.type,
      message: entry.message,
      ...(entry.townTransition ? { townTransition: entry.townTransition } : {})
    }));
  }
  return journal.flatMap((entry) =>
    [entry.summary, ...entry.consequences].map((message, consequenceIndex) => ({
      id: `${entry.id}:${String(consequenceIndex)}`,
      commandId: entry.id,
      occurredAt: entry.occurredAt,
      type: consequenceIndex === 0 ? "command-summary" : "command-consequence",
      message
    }))
  );
}

function selectPowerRanks(baseline, snapshot) {
  return createPowerRankReportProjection(baseline, snapshot);
}

function bountyFactionReferences(character) {
  const categories = character?.ReferenceCategories;
  const plural = categories?.["bounty factions"];
  const singular = categories?.["bounty faction"];
  return [...(Array.isArray(plural) ? plural : []), ...(Array.isArray(singular) ? singular : [])];
}

function selectBounties(baseline, snapshot, rawCharacters) {
  const bounties = [];
  for (const character of rawCharacters) {
    const id = typeof character?.StringId === "string" ? character.StringId.trim() : "";
    if (id === "") continue;
    const amount = character.Values?.["bounty amount"];
    const chance = character.Values?.["bounty chance"];
    const factions = bountyFactionReferences(character);
    const scenarioTracked = Object.hasOwn(snapshot.characters, id);
    const unique = character.Values?.unique === true;
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(chance) ||
      chance <= 0 ||
      factions.length === 0 ||
      (!unique && !scenarioTracked)
    ) {
      continue;
    }

    const status = scenarioTracked ? snapshot.characters[id] : null;
    const issuerById = new Map();
    for (const reference of factions) {
      const factionId =
        typeof reference?.StringId === "string" && reference.StringId.trim() !== ""
          ? reference.StringId
          : safeName(reference, "unknown");
      if (!issuerById.has(factionId)) {
        issuerById.set(factionId, {
          id: factionId,
          name: safeName(reference, factionId)
        });
      }
    }
    bounties.push({
      id,
      name: safeName(character, id),
      amount,
      chance,
      chanceLabel: chance === 100 ? "Guaranteed" : `${String(chance)}%`,
      unique,
      scenarioTracked,
      status,
      statusLabel: scenarioTracked ? (STATUS_LABELS[status] ?? "Unknown") : "Reference only",
      factions: [...issuerById.values()].sort(compareNameAndId)
    });
  }

  return bounties.sort(
    (left, right) => right.amount - left.amount || compareNameAndId(left, right)
  );
}

function selectSpawnActivity(snapshot) {
  return Object.entries(snapshot.world.spawns)
    .map(([areaId, area]) => ({
      id: areaId,
      name: area.name,
      entries: Object.values(area.entries).sort(
        (left, right) =>
          left.name.localeCompare(right.name) || left.occurrenceId.localeCompare(right.occurrenceId)
      )
    }))
    .sort(compareNameAndId);
}

function findDeathLock(baseline, snapshot, worldStateId, requiredValue, visited = new Set()) {
  if (requiredValue !== 1 || visited.has(worldStateId)) return null;
  visited.add(worldStateId);
  const worldState = baseline.worldStateById[worldStateId];
  if (!worldState) return null;

  for (const condition of worldState.conditions) {
    if (
      condition.category === "NPC is" &&
      condition.value === 1 &&
      snapshot.characters[condition.entityId] === 0
    ) {
      return {
        characterId: condition.entityId,
        characterName: baseline.characterById[condition.entityId]?.name ?? condition.name,
        message: `Requires ${baseline.characterById[condition.entityId]?.name ?? condition.name} to be alive, but the retained scenario records their death.`
      };
    }
    if (condition.category === "world state") {
      const nested = findDeathLock(
        baseline,
        snapshot,
        condition.entityId,
        condition.value,
        visited
      );
      if (nested) return nested;
    }
  }
  return null;
}

export function deriveTownOverrideLens(baseline, snapshot, baseTownId, timeline = []) {
  const baseTown = baseline.townById[baseTownId];
  if (!baseTown) return null;

  const authoritative = snapshot.world.towns[baseTownId];
  const activePath = authoritative?.path ?? [baseTownId];
  const authoritativeTransitions = authoritative?.transitions ?? [];
  const transitionEvents = new Map(
    timeline
      .filter(
        (entry) =>
          entry?.type === "town-transition" && entry.townTransition?.baseTownId === baseTownId
      )
      .map((entry) => {
        const transition = entry.townTransition;
        return [
          `${transition.phase}:${String(transition.evaluationIndex)}:${String(transition.sequence)}`,
          entry
        ];
      })
  );
  const transitionHistory = authoritativeTransitions.map((transition) => {
    const event = transitionEvents.get(
      `${transition.phase}:${String(transition.evaluationIndex)}:${String(transition.sequence)}`
    );
    return {
      ...transition,
      commandId: event?.commandId ?? null,
      occurredAt: event?.occurredAt ?? null,
      message: event?.message ?? null
    };
  });
  const activeEdges = new Set();
  for (let index = 1; index < activePath.length; index += 1) {
    const sourceId = activePath[index - 1];
    const targetId = activePath[index];
    const traversal = [...transitionHistory]
      .reverse()
      .find(
        (transition) => transition.sourceTownId === sourceId && transition.targetTownId === targetId
      );
    const referencePosition =
      traversal?.referencePosition ?? baseline.townById[sourceId]?.overrideIds.indexOf(targetId);
    activeEdges.add(`${sourceId}->${targetId}:${String(referencePosition)}`);
  }
  const nodes = new Map();
  const edges = [];
  const paths = [];
  const diagnostics = createDiagnosticCollector();
  const maxPaths = Math.max(64, 4 * baseline.towns.length);

  function addNode(town) {
    if (nodes.has(town.id)) return;
    nodes.set(town.id, {
      id: town.id,
      name: town.name,
      ownerId: town.ownerId,
      ownerName: town.owner
    });
  }

  function walk(townId, path) {
    if (paths.length >= maxPaths) return;
    const town = baseline.townById[townId];
    if (!town) return;
    addNode(town);
    if (town.overrideIds.length === 0) {
      paths.push(path);
      return;
    }

    for (const [position, targetId] of town.overrideIds.entries()) {
      const target = baseline.townById[targetId];
      if (!target) continue;
      addNode(target);
      const conditions = target.conditions.map((condition) => {
        const actualValue = snapshot.worldStates[condition.entityId];
        return {
          worldStateId: condition.entityId,
          name: baseline.worldStateById[condition.entityId]?.name ?? condition.name,
          requiredValue: condition.value,
          actualValue,
          satisfied: actualValue === condition.value,
          text: `'${baseline.worldStateById[condition.entityId]?.name ?? condition.name}' must be ${condition.value === 1 ? "TRUE" : "FALSE"}`
        };
      });
      const indeterminate = conditions.some(
        (condition) => condition.actualValue !== 0 && condition.actualValue !== 1
      );
      const deathLock = target.conditions
        .map((condition) =>
          findDeathLock(baseline, snapshot, condition.entityId, condition.value, new Set())
        )
        .find(Boolean);
      const edgeId = `${townId}->${targetId}:${String(position)}`;
      const traversals = transitionHistory.filter(
        (transition) =>
          transition.sourceTownId === townId &&
          transition.targetTownId === targetId &&
          transition.referencePosition === position
      );
      const lastTraversal = traversals.at(-1) ?? null;
      const isActive = activeEdges.has(edgeId);
      const eligible = conditions.every((condition) => condition.satisfied);
      const availableFromActiveNode = authoritative?.activeTownId === townId && eligible;
      const cycle = path.some((step) => step.townId === targetId);
      let status = "blocked";
      if (isActive) status = "active";
      else if (indeterminate) status = "indeterminate";
      else if (deathLock) status = "locked";
      else if (eligible) status = "eligible";

      const edge = {
        id: edgeId,
        sourceId: townId,
        targetId,
        conditionCount: conditions.length,
        referencePosition: position,
        status,
        isActive,
        eligible,
        availableFromActiveNode,
        historicallyTraversed: traversals.length > 0,
        traversalCount: traversals.length,
        lastTraversal,
        cycle,
        conditions,
        deathLock,
        implausibilityReason: deathLock?.message ?? null
      };
      edges.push(edge);
      const nextPath = [
        ...path,
        {
          townId: target.id,
          townName: target.name,
          ownerId: target.ownerId,
          ownerName: target.owner,
          conditions,
          edgeStatus: status,
          cycle
        }
      ];
      if (cycle) {
        paths.push(nextPath);
        diagnostics.add(
          "warning",
          "town_override_graph_cycle",
          `Town override graph for '${baseTownId}' contains a cycle at '${targetId}'.`,
          { baseTownId, targetId }
        );
      } else {
        walk(targetId, nextPath);
      }
    }
  }

  walk(baseTownId, [
    {
      townId: baseTown.id,
      townName: baseTown.name,
      ownerId: baseTown.ownerId,
      ownerName: baseTown.owner,
      conditions: [],
      edgeStatus: "base",
      cycle: false
    }
  ]);

  if (paths.length >= maxPaths) {
    diagnostics.add(
      "warning",
      "town_override_path_limit",
      `Town override path enumeration for '${baseTownId}' reached its safety limit.`,
      { baseTownId, maxPaths }
    );
  }

  for (const entry of snapshot.diagnostics ?? []) {
    if (
      entry.context?.baseTownId === baseTownId ||
      (entry.context?.townId && nodes.has(entry.context.townId))
    ) {
      diagnostics.add(entry.level, entry.code, entry.message, entry.context);
    }
  }

  const outgoingByTownId = {};
  for (const edge of edges) {
    (outgoingByTownId[edge.sourceId] ??= []).push(edge);
  }

  return deepFreeze({
    baseTownId,
    baseTownName: baseTown.name,
    activeTownId: authoritative?.activeTownId ?? baseTownId,
    activePath,
    activeLineage: activePath,
    transitionHistory,
    ambiguous: authoritative?.ambiguous ?? false,
    cycle: authoritative?.cycle ?? false,
    nodes: [...nodes.values()],
    edges,
    paths,
    outgoingByTownId: stableObject(Object.entries(outgoingByTownId)),
    diagnostics: diagnostics.entries
  });
}

function selectTownOverrides(baseline, snapshot, timeline) {
  const roots = baseline.mapTownIds
    .filter((townId) => baseline.townById[townId]?.overrideIds.length > 0)
    .map((townId) => deriveTownOverrideLens(baseline, snapshot, townId, timeline))
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.baseTownName.localeCompare(right.baseTownName) ||
        left.baseTownId.localeCompare(right.baseTownId)
    );
  return {
    roots,
    byBaseTownId: stableObject(roots.map((root) => [root.baseTownId, root]))
  };
}

export function createScenarioLensProjection({
  baseline,
  snapshot,
  journal,
  timeline = null,
  campaigns = [],
  characters = []
}) {
  if (!baseline || !snapshot || !Array.isArray(journal)) {
    throw new TypeError("Scenario lens projection requires a baseline, snapshot, and journal.");
  }
  if (!Array.isArray(campaigns) || !Array.isArray(characters)) {
    throw new TypeError("Scenario lens reference datasets must be arrays.");
  }
  if (timeline !== null && !Array.isArray(timeline)) {
    throw new TypeError("Scenario timeline must be an array when supplied.");
  }

  const relations = selectRelations(baseline, snapshot);
  const campaignProjection = selectCampaigns(baseline, snapshot, campaigns);
  const diagnosticPolicy = acknowledgeDiagnostics(snapshot);
  const powerRankProjection = selectPowerRanks(baseline, snapshot);
  const relationRows = relations.factions.map((faction) => ({
    ...faction,
    campaigns: campaignProjection.byFactionId[faction.id] ?? []
  }));

  return deepFreeze({
    baseline: snapshot.baseline,
    diagnostics: {
      visible: [...diagnosticPolicy.visible, ...campaignProjection.diagnostics],
      acknowledged: diagnosticPolicy.acknowledged
    },
    globalStatus: selectGlobalStatus(baseline, snapshot, relations, diagnosticPolicy),
    worldHistory: selectWorldHistory(timeline, journal),
    relations: {
      factions: relationRows,
      byFactionId: stableObject(relationRows.map((faction) => [faction.id, faction])),
      allies: relations.allies,
      enemies: relations.enemies,
      diagnostics: campaignProjection.diagnostics
    },
    powerRanks: powerRankProjection.entries,
    powerRankDiagnostics: powerRankProjection.diagnostics,
    infamy: {
      allies: relations.allies,
      enemies: relations.enemies,
      bounties: selectBounties(baseline, snapshot, characters),
      spawns: selectSpawnActivity(snapshot)
    },
    townOverrides: selectTownOverrides(baseline, snapshot, timeline ?? [])
  });
}
