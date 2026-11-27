import { deepFreeze } from "../scenario/utils.js";

export const POLITICAL_VIEW_POLICY = deepFreeze({
  id: "localAuthoredBalance",
  label: "Local Authored Balance — Experimental",
  townMetric: "residentReferences",
  sourceMix: "authoredLocal",
  confidenceRule: "share55Margin10"
});

/**
 * The reviewed Stage B vanilla roster plus the explicitly approved Fishmen exception.
 * Stable IDs are the only identity boundary; display names are never reconciled.
 */
export const DEFAULT_POLITICAL_PARTICIPANT_IDS = Object.freeze(
  [
    "58229-Dialogue.mod",
    "48743-Dialogue.mod",
    "513-gamedata.base",
    "1209-gamedata.base",
    "48814-Dialogue.mod",
    "97072-Dialogue.mod",
    "48753-Dialogue.mod",
    "41162-Dialogue.mod",
    "56595-Dialogue.mod",
    "66292-rebirth.mod",
    "16860-gamedata.base",
    "14508-gamedata.base",
    "51646-Dialogue.mod",
    "96175-rebirth.mod",
    "1214-gamedata.base",
    "14491-rebirth.mod",
    "42235-rebirth.mod",
    "55101-rebirth.mod",
    "1305-gamedata.base",
    "42257-rebirth.mod",
    "56644-Dialogue.mod",
    "18007-rebirth.mod",
    "16855-gamedata.base",
    "518-gamedata.base",
    "62806-rebirth.mod",
    "200-gamedata.base",
    "49377-rebirth.mod",
    "48791-Dialogue.mod",
    "42022-rebirth.mod",
    "51357-rebirth.mod",
    "54587-rebirth.mod",
    "42097-rebirth.mod",
    "62805-rebirth.mod",
    "54297-rebirth.mod",
    "51652-rebirth.mod",
    "1085-gamedata.base",
    "95512-rebirth.mod",
    "11624-Dialogue (10).mod",
    "62792-rebirth.mod",
    "42088-rebirth.mod",
    "63028-Dialogue.mod",
    "1084-gamedata.base",
    "56777-Dialogue.mod",
    "51638-rebirth.mod",
    "1233-gamedata.base",
    "96261-rebirth.mod",
    "1083-gamedata.base",
    "1088-gamedata.base",
    "defaultEmpireFactionSID",
    "42264-gamedata.base",
    "18000-gamedata.base",
    "96359-rebirth.mod"
  ].sort()
);

function hasPositiveTownEvidence(record) {
  return record.metrics?.residentReferences?.valid && record.metrics.residentReferences.value > 0;
}

function hasPositiveSpawnEvidence(record) {
  return record.relativeWeight?.valid && record.relativeWeight.value > 0;
}

/** Creates live, presentation-only faction evidence labels without owning scenario state. */
export function createPoliticalFactionProjection({ projection, presentation } = {}) {
  if (!projection?.available || !presentation) {
    return deepFreeze({
      available: false,
      reason: projection?.reason ?? "political-presentation-unavailable",
      rows: [],
      includedCount: 0,
      availableCount: 0
    });
  }

  const snapshot =
    typeof presentation.getSnapshot === "function" ? presentation.getSnapshot() : presentation;
  const included = new Set(snapshot.participantIds ?? []);
  const evidence = new Map(
    projection.factions.map(({ id }) => [id, { town: 0, spawn: 0, conditional: 0 }])
  );

  for (const record of projection.towns) {
    if (record.factionId && hasPositiveTownEvidence(record)) {
      const counts = evidence.get(record.factionId);
      if (counts) counts.town += 1;
    }
  }
  for (const record of [...projection.homelessSpawns, ...projection.nests]) {
    if (record.factionId && hasPositiveSpawnEvidence(record)) {
      const counts = evidence.get(record.factionId);
      if (counts) counts.spawn += 1;
    }
  }
  for (const record of projection.conditional) {
    if (record.factionId && hasPositiveSpawnEvidence(record)) {
      const counts = evidence.get(record.factionId);
      if (counts) counts.conditional += 1;
    }
  }

  const rows = projection.factions
    .map((faction) => {
      const counts = evidence.get(faction.id);
      let evidenceLabel = "No current evidence";
      if (counts.town > 0 && counts.spawn > 0) evidenceLabel = "Both";
      else if (counts.town > 0) evidenceLabel = "Town";
      else if (counts.spawn > 0) evidenceLabel = "Spawn";
      else if (counts.conditional > 0) evidenceLabel = "Conditional";
      return {
        ...faction,
        included: included.has(faction.id),
        color: snapshot.colorsByFactionId?.[faction.id] ?? null,
        defaultColor: snapshot.defaultsByFactionId?.[faction.id]?.color ?? null,
        colorSource: snapshot.defaultsByFactionId?.[faction.id]?.source ?? "generated",
        paletteId: snapshot.defaultsByFactionId?.[faction.id]?.paletteId ?? null,
        evidence: counts,
        evidenceLabel
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  return deepFreeze({
    available: true,
    reason: null,
    rows,
    includedCount: rows.filter(({ included: value }) => value).length,
    availableCount: rows.length
  });
}
