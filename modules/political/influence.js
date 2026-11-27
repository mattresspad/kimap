import { deepFreeze, diagnostic } from "../scenario/utils.js";

export const POLITICAL_TOWN_METRICS = Object.freeze([
  "inhabitedOccurrences",
  "residentReferences",
  "residentPlacements"
]);

export const POLITICAL_SOURCE_MIXES = Object.freeze([
  "equal",
  "townHeavy",
  "spawnHeavy",
  "authoredLocal",
  "authoredTotal"
]);

export const POLITICAL_CONFIDENCE_RULES = Object.freeze([
  "plurality",
  "share55Margin10",
  "share60Margin20",
  "share67Margin33"
]);

const UNATTRIBUTED_KEY = "\u0000unattributed";
const FIXED_MIXES = Object.freeze({
  equal: Object.freeze({ town: 1, homelessSpawn: 1, nest: 1 }),
  townHeavy: Object.freeze({ town: 2, homelessSpawn: 1, nest: 1 }),
  spawnHeavy: Object.freeze({ town: 1, homelessSpawn: 2, nest: 2 })
});
const CONFIDENCE = Object.freeze({
  plurality: Object.freeze({ share: 0, margin: 0 }),
  share55Margin10: Object.freeze({ share: 0.55, margin: 0.1 }),
  share60Margin20: Object.freeze({ share: 0.6, margin: 0.2 }),
  share67Margin33: Object.freeze({ share: 0.67, margin: 0.33 })
});

function requireChoice(value, choices, label) {
  if (!choices.includes(value)) {
    throw new TypeError(`${label} must be one of: ${choices.join(", ")}.`);
  }
  return value;
}

function evidenceKey(record) {
  return record.factionId ?? UNATTRIBUTED_KEY;
}

function addScore(scores, key, amount) {
  scores.set(key, (scores.get(key) ?? 0) + amount);
}

function addSourceScore(sources, key, kind, amount) {
  const values = sources.get(key) ?? { town: 0, homelessSpawn: 0, nest: 0 };
  values[kind] += amount;
  sources.set(key, values);
}

function scoreMapToRows(scores) {
  const total = [...scores.values()].reduce((sum, value) => sum + value, 0);
  return [...scores]
    .map(([key, score]) => ({
      factionId: key === UNATTRIBUTED_KEY ? null : key,
      score,
      share: total > 0 ? score / total : 0
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.factionId ?? "").localeCompare(String(right.factionId ?? ""))
    );
}

function scoreFixedMix(records, townMetric, mix) {
  const channelMaps = new Map([
    ["town", new Map()],
    ["homelessSpawn", new Map()],
    ["nest", new Map()]
  ]);
  const invalid = [];

  for (const record of records) {
    if (record.state !== "current" || record.exclusionReason) continue;
    let detail;
    if (record.kind === "town") detail = record.metrics?.[townMetric];
    else detail = record.relativeWeight;
    if (!detail?.valid) {
      invalid.push(record.id);
      continue;
    }
    addScore(channelMaps.get(record.kind), evidenceKey(record), detail.value);
  }

  const activeChannels = [...channelMaps].filter(([, scores]) =>
    [...scores.values()].some((value) => value > 0)
  );
  const coefficientTotal = activeChannels.reduce(
    (total, [kind]) => total + FIXED_MIXES[mix][kind],
    0
  );
  const combined = new Map();
  const sourceScores = new Map();
  const channelTotals = {};

  for (const [kind, scores] of channelMaps) {
    const total = [...scores.values()].reduce((sum, value) => sum + value, 0);
    channelTotals[kind] = total;
    if (total <= 0 || coefficientTotal <= 0) continue;
    const channelWeight = FIXED_MIXES[mix][kind] / coefficientTotal;
    for (const [key, value] of scores) {
      const amount = (value / total) * channelWeight;
      addScore(combined, key, amount);
      addSourceScore(sourceScores, key, kind, amount);
    }
  }

  return { scores: combined, sourceScores, channelTotals, invalid };
}

function scoreAuthoredMix(records, townMetric, totalPressure) {
  const scores = new Map();
  const sourceScores = new Map();
  const invalid = [];
  let townTotal = 0;

  for (const record of records) {
    if (record.kind !== "town" || record.state !== "current" || record.exclusionReason) continue;
    const detail = record.metrics?.[townMetric];
    if (!detail?.valid) {
      invalid.push(record.id);
      continue;
    }
    townTotal += detail.value;
    addScore(scores, evidenceKey(record), detail.value);
    addSourceScore(sourceScores, evidenceKey(record), "town", detail.value);
  }

  const grouped = new Map();
  for (const record of records) {
    if (record.kind === "town" || record.state !== "current" || record.exclusionReason) continue;
    const key = `${record.kind}:${record.areaId}`;
    const group = grouped.get(key) ?? {
      kind: record.kind,
      areaId: record.areaId,
      cellCount: null,
      scalar: record.areaScalar,
      records: []
    };
    group.records.push(record);
    grouped.set(key, group);
  }

  const channelTotals = { town: townTotal, homelessSpawn: 0, nest: 0 };
  for (const group of [...grouped.values()].sort((left, right) =>
    `${left.kind}:${left.areaId}`.localeCompare(`${right.kind}:${right.areaId}`)
  )) {
    const relative = new Map();
    let valid = group.scalar?.valid === true;
    for (const record of group.records) {
      if (!record.relativeWeight?.valid) {
        invalid.push(record.id);
        valid = false;
        continue;
      }
      addScore(relative, evidenceKey(record), record.relativeWeight.value);
      if (group.cellCount === null) group.cellCount = record.geometryCellCount ?? null;
    }
    const relativeTotal = [...relative.values()].reduce((sum, value) => sum + value, 0);
    if (relativeTotal <= 0) continue;
    if (!valid) {
      invalid.push(`${group.kind}:${group.areaId}:scalar`);
      continue;
    }

    const geometryCellCount = group.records[0]?.geometryCellCount;
    if (
      totalPressure &&
      group.kind === "homelessSpawn" &&
      (!Number.isInteger(geometryCellCount) || geometryCellCount < 0)
    ) {
      invalid.push(`${group.kind}:${group.areaId}:geometry`);
      continue;
    }
    const areaPressure =
      group.scalar.value *
      (totalPressure && group.kind === "homelessSpawn" ? geometryCellCount : 1);
    channelTotals[group.kind] += areaPressure;
    for (const [key, value] of relative) {
      const amount = (value / relativeTotal) * areaPressure;
      addScore(scores, key, amount);
      addSourceScore(sourceScores, key, group.kind, amount);
    }
  }

  return { scores, sourceScores, channelTotals, invalid: [...new Set(invalid)].sort() };
}

function attachGeometryCellCount(records, cellCount) {
  return records.map((record) => ({ ...record, geometryCellCount: cellCount }));
}

function classifyOutcome(rows, participantIds, confidenceRule) {
  if (rows.length === 0) {
    return {
      status: "noEvidence",
      winnerId: null,
      winnerShare: 0,
      runnerUpShare: 0,
      lead: 0
    };
  }

  const winner = rows[0];
  const runner = rows[1] ?? { score: 0, share: 0 };
  const exactTie = runner.score === winner.score;
  const lead = winner.share - runner.share;
  const rule = CONFIDENCE[confidenceRule];
  const passes =
    !exactTie &&
    winner.share >= rule.share &&
    (confidenceRule === "plurality" || lead >= rule.margin);

  let status = "disputed";
  if (passes) {
    if (winner.factionId === null) status = "unattributed";
    else if (!participantIds.has(winner.factionId)) status = "filtered";
    else status = "dominant";
  }

  return {
    status,
    winnerId: winner.factionId,
    winnerShare: winner.share,
    runnerUpShare: runner.share,
    lead
  };
}

/** Evaluates one explicit sensitivity policy across every raster geometry. */
export function evaluatePoliticalInfluence({
  projection,
  participantIds,
  townMetric,
  sourceMix,
  confidenceRule
} = {}) {
  if (!Array.isArray(participantIds)) {
    throw new TypeError("participantIds must be an explicit array of stable faction IDs.");
  }
  requireChoice(townMetric, POLITICAL_TOWN_METRICS, "townMetric");
  requireChoice(sourceMix, POLITICAL_SOURCE_MIXES, "sourceMix");
  requireChoice(confidenceRule, POLITICAL_CONFIDENCE_RULES, "confidenceRule");

  const diagnostics = [...(projection?.diagnostics ?? [])];
  const knownFactionIds = new Set((projection?.factions ?? []).map(({ id }) => id));
  const participants = new Set();
  for (const [position, id] of participantIds.entries()) {
    if (typeof id !== "string" || id.trim() === "") {
      diagnostics.push(
        diagnostic(
          "warning",
          "political_participant_id_invalid",
          "A participant roster entry is not a stable faction ID.",
          { position, value: id ?? null }
        )
      );
    } else if (!knownFactionIds.has(id)) {
      diagnostics.push(
        diagnostic(
          "warning",
          "political_participant_id_unknown",
          `Participant faction '${id}' is not present in this manifest.`,
          { position, factionId: id }
        )
      );
    } else if (participants.has(id)) {
      diagnostics.push(
        diagnostic(
          "info",
          "political_participant_id_duplicate",
          `Participant faction '${id}' occurs more than once in the roster.`,
          { position, factionId: id }
        )
      );
    } else {
      participants.add(id);
    }
  }

  if (!projection?.available) {
    return deepFreeze({
      available: false,
      reason: projection?.reason ?? "political-evidence-unavailable",
      participantIds: [...participants].sort(),
      townMetric,
      sourceMix,
      confidenceRule,
      areas: [],
      diagnostics
    });
  }

  const areas = projection.geometries.map((geometry) => {
    if (geometry.excluded) {
      return {
        geometryKey: geometry.key,
        areaIds: geometry.areaIds,
        cellCount: geometry.cellCount,
        status: "excluded",
        winnerId: null,
        winnerShare: 0,
        runnerUpShare: 0,
        lead: 0,
        evidenceTotal: 0,
        channelTotals: { town: 0, homelessSpawn: 0, nest: 0 },
        contributions: [],
        invalidEvidenceIds: []
      };
    }
    if (geometry.indeterminate) {
      return {
        geometryKey: geometry.key,
        areaIds: geometry.areaIds,
        cellCount: geometry.cellCount,
        status: "indeterminate",
        winnerId: null,
        winnerShare: 0,
        runnerUpShare: 0,
        lead: 0,
        evidenceTotal: 0,
        channelTotals: { town: 0, homelessSpawn: 0, nest: 0 },
        contributions: [],
        invalidEvidenceIds: geometry.records.map(({ id }) => id).sort()
      };
    }

    const structurallyInvalid = geometry.records
      .filter(({ evidenceIndeterminate }) => evidenceIndeterminate)
      .map(({ id }) => id)
      .sort();
    if (structurallyInvalid.length > 0) {
      return {
        geometryKey: geometry.key,
        areaIds: geometry.areaIds,
        cellCount: geometry.cellCount,
        status: "indeterminate",
        winnerId: null,
        winnerShare: 0,
        runnerUpShare: 0,
        lead: 0,
        evidenceTotal: 0,
        channelTotals: { town: 0, homelessSpawn: 0, nest: 0 },
        contributions: [],
        invalidEvidenceIds: structurallyInvalid
      };
    }

    const records = attachGeometryCellCount(geometry.records, geometry.cellCount);
    const scored = Object.hasOwn(FIXED_MIXES, sourceMix)
      ? scoreFixedMix(records, townMetric, sourceMix)
      : scoreAuthoredMix(records, townMetric, sourceMix === "authoredTotal");
    const contributions = scoreMapToRows(scored.scores).map((entry) => ({
      ...entry,
      participant: entry.factionId !== null && participants.has(entry.factionId),
      sourceScores: scored.sourceScores.get(entry.factionId ?? UNATTRIBUTED_KEY)
    }));
    const evidenceTotal = contributions.reduce((total, { score }) => total + score, 0);
    const outcome =
      scored.invalid.length > 0
        ? {
            status: "indeterminate",
            winnerId: null,
            winnerShare: 0,
            runnerUpShare: 0,
            lead: 0
          }
        : classifyOutcome(contributions, participants, confidenceRule);

    return {
      geometryKey: geometry.key,
      areaIds: geometry.areaIds,
      cellCount: geometry.cellCount,
      ...outcome,
      evidenceTotal,
      channelTotals: scored.channelTotals,
      contributions,
      invalidEvidenceIds: scored.invalid
    };
  });

  return deepFreeze({
    available: true,
    reason: null,
    participantIds: [...participants].sort(),
    townMetric,
    sourceMix,
    confidenceRule,
    confidenceThresholds: CONFIDENCE[confidenceRule],
    areas,
    diagnostics
  });
}
