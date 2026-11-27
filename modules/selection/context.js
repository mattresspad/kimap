import { deepFreeze } from "../scenario/utils.js";
import { kenshiToLeaflet } from "./map-space.js";
import { composeEffectiveTown } from "./effective-town.js";
import { projectInspectorWeather } from "../inspector-weather.js";
import { projectOverrideReport } from "./override-connectivity.js";

function safeName(record, fallback) {
  return typeof record?.Name === "string" && record.Name.trim() !== "" ? record.Name : fallback;
}

function referenceIds(record, category) {
  return (record?.ReferenceCategories?.[category] ?? [])
    .map((reference) => reference?.StringId)
    .filter((id) => typeof id === "string" && id !== "");
}

function selectResources(spawnArea, references) {
  const resourceId = referenceIds(spawnArea, "resources")[0];
  const resource = resourceId ? references.resourceById?.[resourceId] : null;
  if (!resource) return { fertility: [], resources: [] };
  const fertility = [
    { id: "arid", label: "Arid", value: Math.round((resource.Values?.arid ?? 0) * 100) },
    { id: "green", label: "Green", value: Math.round((resource.Values?.green ?? 0) * 100) },
    { id: "swamp", label: "Swamp", value: Math.round((resource.Values?.swamp ?? 0) * 100) }
  ].filter((entry) => entry.value > 0);
  const resources = [
    { id: "copper", label: "Copper", value: resource.Values?.["copper mult"] ?? 0 },
    { id: "iron", label: "Iron", value: resource.Values?.["iron mult"] ?? 0 },
    { id: "stone", label: "Stone", value: resource.Values?.["stone mult"] ?? 0 },
    { id: "water", label: "Water", value: resource.Values?.water ?? 0 }
  ];
  return { fertility, resources };
}

function selectSpawnOccurrences(spawnArea, snapshot, references) {
  const authoritative = snapshot?.world?.spawns?.[spawnArea.StringId]?.entries;
  if (authoritative) {
    return Object.values(authoritative)
      .map((entry) => ({ ...entry }))
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) || left.occurrenceId.localeCompare(right.occurrenceId)
      );
  }

  const occurrences = [];
  const counts = new Map();
  for (const [category, type, index] of [
    ["homeless spawns", "Squad", references.squadById],
    ["nests", "Nest", references.townById]
  ]) {
    for (const entityId of referenceIds(spawnArea, category)) {
      const count = (counts.get(`${type}:${entityId}`) ?? 0) + 1;
      counts.set(`${type}:${entityId}`, count);
      const entity = index?.[entityId];
      occurrences.push({
        occurrenceId: `${spawnArea.StringId}:${type}:${entityId}${count > 1 ? `:${String(count)}` : ""}`,
        entityId,
        name: safeName(entity, entityId),
        type,
        status: "Unavailable"
      });
    }
  }
  return occurrences.sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.occurrenceId.localeCompare(right.occurrenceId)
  );
}

function projectSpawnArea(spawnArea, snapshot, references, anchor, environmentProjection) {
  const occurrences = selectSpawnOccurrences(spawnArea, snapshot, references);
  const resources = selectResources(spawnArea, references);
  return {
    id: spawnArea.StringId,
    name: safeName(spawnArea, spawnArea.StringId),
    occurrences,
    spawnCount: occurrences.filter((entry) => entry.type === "Squad").length,
    nestCount: occurrences.filter((entry) => entry.type === "Nest").length,
    weather: projectInspectorWeather(environmentProjection, spawnArea.StringId),
    fertility: resources.fertility,
    resources: resources.resources,
    anchor,
    diagnostics: []
  };
}

function findTownNetworks(townId, lenses) {
  return (lenses?.townOverrides?.roots ?? [])
    .filter((root) => root.nodes.some((node) => node.id === townId))
    .sort(
      (left, right) =>
        left.baseTownName.localeCompare(right.baseTownName) ||
        left.baseTownId.localeCompare(right.baseTownId)
    );
}

function mergeActiveTown(catalog, network) {
  const activePath = network?.activePath ?? [];
  if (activePath.length === 0) return null;
  return composeEffectiveTown(catalog.townById, activePath[0], {
    path: activePath,
    activeTownId: network.activeTownId
  });
}

function projectTown(catalog, selection, snapshot, lenses) {
  const scenarioAvailable = Boolean(snapshot && lenses);
  const selectedTown = catalog.townById[selection.entityId];
  const networks = findTownNetworks(selection.entityId, lenses);
  const primaryNetwork =
    lenses?.townOverrides?.byBaseTownId?.[selection.entityId] ?? networks[0] ?? null;
  const overrideConnectivity = catalog.overrideConnectivityByTownId?.[selection.entityId] ?? null;
  const activeTown = mergeActiveTown(catalog, primaryNetwork) ?? selectedTown;
  const ownerReference = activeTown.ReferenceCategories?.faction?.[0];
  const ownerId = ownerReference?.StringId ?? null;
  const relation = ownerId ? (lenses?.relations?.byFactionId?.[ownerId] ?? null) : null;
  const selectedEdge = primaryNetwork?.edges.find((edge) => edge.targetId === selection.entityId);
  const selectedNode = primaryNetwork?.nodes.find((node) => node.id === selection.entityId);
  const location = selection.instanceId
    ? catalog.locationById[selection.instanceId]
    : (catalog.locationsByTargetId[selection.entityId]?.[0] ??
      catalog.locationsByTargetId[primaryNetwork?.baseTownId]?.[0] ??
      null);
  const coordinates = location
    ? { x: location.X, z: location.Z, leaflet: kenshiToLeaflet({ x: location.X, z: location.Z }) }
    : null;
  const activeSteps = (primaryNetwork?.activePath ?? []).map((townId, index, path) => {
    const town = catalog.townById[townId];
    const edge =
      index > 0
        ? primaryNetwork.edges.find(
            (candidate) => candidate.sourceId === path[index - 1] && candidate.targetId === townId
          )
        : null;
    return {
      townId,
      townName: safeName(town, townId),
      reason:
        index === 0
          ? "Base Town"
          : edge?.conditions.map((condition) => condition.text).join(" AND ") ||
            "Override prerequisites satisfied"
    };
  });

  return {
    id: selection.entityId,
    name: safeName(selectedTown, selection.entityId),
    selectedTown: {
      id: selection.entityId,
      name: safeName(selectedTown, selection.entityId),
      branchStatus:
        selectedEdge?.status ?? (primaryNetwork?.baseTownId === selection.entityId ? "base" : null),
      branchConditions: selectedEdge?.conditions ?? []
    },
    currentTown: {
      id: activeTown.StringId,
      name: safeName(activeTown, activeTown.StringId),
      ownerId,
      ownerName: ownerReference?.Name ?? selectedNode?.ownerName ?? "Unknown",
      relationValue: relation?.value ?? null,
      relationClassification: relation?.classification ?? null,
      residents: (activeTown.ReferenceCategories?.residents ?? [])
        .map((reference, position) => ({
          entityType: "squad",
          entityId: reference?.StringId ?? null,
          name: safeName(reference, reference?.StringId ?? "Unknown squad"),
          status: scenarioAvailable ? "current" : "unavailable",
          position,
          value0: reference?.Value0 ?? null,
          value1: reference?.Value1 ?? null
        }))
        .filter(({ entityId }) => typeof entityId === "string" && entityId !== "")
    },
    location: location
      ? { instanceId: location.InstanceId, targetId: location.TargetId, coordinates }
      : null,
    primaryNetwork: primaryNetwork
      ? {
          baseTownId: primaryNetwork.baseTownId,
          activeTownId: primaryNetwork.activeTownId,
          activePath: [...primaryNetwork.activePath],
          activeSteps,
          transitionHistory: [...primaryNetwork.transitionHistory],
          outgoing: primaryNetwork.outgoingByTownId[primaryNetwork.activeTownId] ?? [],
          ambiguous: primaryNetwork.ambiguous,
          cycle: primaryNetwork.cycle
        }
      : null,
    networkIds: networks.map((network) => network.baseTownId),
    overrideConnectivity,
    overrideReport: projectOverrideReport(overrideConnectivity, scenarioAvailable, primaryNetwork),
    diagnostics: [
      ...(primaryNetwork?.diagnostics ?? []),
      ...(overrideConnectivity?.diagnostics ?? [])
    ],
    scenarioAvailable
  };
}

export function createContextProjection({
  catalog,
  selection,
  snapshot = null,
  lenses = null,
  references = {},
  pointFacts = null,
  spawnAreaAnchor = null,
  environmentProjection = null,
  capabilities = {}
}) {
  if (!selection) return null;
  let projection;
  if (selection.kind === "entity" && selection.entityType === "town") {
    projection = {
      kind: "town",
      title: safeName(catalog.townById[selection.entityId], selection.entityId),
      town: projectTown(catalog, selection, snapshot, lenses)
    };
  } else if (selection.kind === "entity" && selection.entityType === "spawnArea") {
    const spawnArea = catalog.spawnAreaById[selection.entityId];
    projection = {
      kind: "spawnArea",
      title: safeName(spawnArea, selection.entityId),
      spawnArea: projectSpawnArea(
        spawnArea,
        snapshot,
        references,
        spawnAreaAnchor,
        environmentProjection
      )
    };
  } else {
    const spawnArea = pointFacts?.spawnAreaId
      ? catalog.spawnAreaById[pointFacts.spawnAreaId]
      : null;
    projection = {
      kind: "point",
      title: spawnArea ? safeName(spawnArea, "Map Point") : "Map Point",
      point: {
        coordinates: {
          x: selection.point.x,
          z: selection.point.z,
          leaflet: kenshiToLeaflet(selection.point)
        },
        biome: pointFacts?.biome ?? null,
        spawnArea: spawnArea
          ? projectSpawnArea(
              spawnArea,
              snapshot,
              references,
              spawnAreaAnchor,
              environmentProjection
            )
          : null,
        diagnostics: [
          ...(!spawnArea
            ? [
                {
                  level: "info",
                  code: "point_spawn_area_unknown",
                  message: "No containing spawn area is available for this point."
                }
              ]
            : []),
          ...(!pointFacts?.biome
            ? [
                {
                  level: "info",
                  code: "point_biome_unknown",
                  message: "No biome is available for this point."
                }
              ]
            : [])
        ]
      }
    };
  }

  const diagnostics =
    projection.town?.diagnostics ??
    projection.spawnArea?.diagnostics ??
    projection.point?.diagnostics ??
    [];
  return deepFreeze({
    selection,
    ...projection,
    diagnostics,
    scenarioAvailable: Boolean(snapshot && lenses),
    capabilities: {
      hasLayout: Boolean(capabilities.hasLayout),
      wikiAvailable: false
    }
  });
}
