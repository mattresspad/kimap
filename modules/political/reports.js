import { deepFreeze } from "../scenario/utils.js";

const SOURCES = ["town", "homelessSpawn", "nest"];
const SCORED_STATUSES = new Set(["dominant", "disputed", "filtered", "unattributed", "noEvidence"]);
const OUTCOME_LABELS = {
  dominant: "Dominant",
  disputed: "Disputed",
  filtered: "Filtered",
  unattributed: "Unattributed",
  indeterminate: "Indeterminate",
  noEvidence: "Transparent — no current evidence",
  excluded: "Transparent — excluded geography"
};

function emptySources() {
  return { town: 0, homelessSpawn: 0, nest: 0 };
}
function emptyGroup(label) {
  return { label, score: 0, share: 0, sourceScores: emptySources() };
}
function addContribution(target, contribution) {
  target.score += contribution.score;
  for (const kind of SOURCES) target.sourceScores[kind] += contribution.sourceScores[kind];
}
function withShare(row, total) {
  return { ...row, share: total > 0 ? row.score / total : 0 };
}

function publicContributor(row, factionById) {
  if (!row) return null;
  if (row.factionId === null) return { label: "Unattributed", share: row.share, score: row.score };
  if (!row.participant)
    return { label: "Outside visible roster", share: row.share, score: row.score };
  return {
    factionId: row.factionId,
    label: factionById.get(row.factionId)?.name ?? row.factionId,
    share: row.share,
    score: row.score
  };
}

function explanationReasons(area, geometry, thresholds) {
  const reasons = [];
  if (geometry.ambiguous)
    reasons.push(
      "This raster color combines multiple authored areas; their evidence is evaluated together."
    );
  if (area.status === "excluded")
    reasons.push("This geography is intentionally excluded from Political View.");
  else if (area.status === "noEvidence")
    reasons.push("No current scoring evidence is present here.");
  else if (area.status === "indeterminate") {
    if (geometry.mixedExclusion)
      reasons.push("This raster color mixes included and excluded geography.");
    else if (geometry.areaIds.length === 0)
      reasons.push("This raster color has no resolved area record.");
    else
      reasons.push(
        "Incomplete, conflicting, or invalid evidence prevents a reliable result. Partial scores are not ranked."
      );
  } else if (area.status === "disputed") {
    if (area.contributions[0]?.score === area.contributions[1]?.score)
      reasons.push("The leading contributors are tied.");
    if (area.winnerShare < thresholds.share)
      reasons.push("The leading share is below the confidence threshold.");
    if (area.lead < thresholds.margin)
      reasons.push("The lead over the runner-up is below the required margin.");
  } else {
    reasons.push("The leading contribution meets the confidence rule.");
    if (area.status === "filtered")
      reasons.push(
        "The leading faction is outside the visible roster; an included runner-up is not promoted."
      );
    if (area.status === "unattributed")
      reasons.push("The leading evidence has no single resolved faction identity.");
  }
  return reasons;
}

/** Public-safe report data: concealed faction identities never cross this boundary. */
export function createPoliticalReports({ projection, influence } = {}) {
  if (!projection?.available || !influence?.available) {
    return deepFreeze({
      available: false,
      reason: "Political reports require current political evidence.",
      areas: [],
      scorecard: null
    });
  }
  const thresholds = influence.confidenceThresholds;
  if (!thresholds)
    throw new TypeError("Political reports require evaluated confidence thresholds.");
  const factionById = new Map(projection.factions.map((faction) => [faction.id, faction]));
  const geometryByKey = new Map(projection.geometries.map((geometry) => [geometry.key, geometry]));
  const globalRows = new Map();
  const outside = emptyGroup("Outside visible roster");
  const unattributed = emptyGroup("Unattributed");
  const sourceScores = emptySources();
  const coverage = { included: 0, indeterminate: 0, excluded: 0, unmapped: 0 };
  let total = 0;
  const seen = new Set();
  const areas = influence.areas.map((area) => {
    const geometry = geometryByKey.get(area.geometryKey);
    if (!geometry || seen.has(area.geometryKey))
      throw new TypeError("Political report geometry is missing or duplicated.");
    seen.add(area.geometryKey);
    const valid = SCORED_STATUSES.has(area.status);
    const rows = [];
    const localOutside = emptyGroup("Outside visible roster");
    const localUnattributed = emptyGroup("Unattributed");
    const localSources = emptySources();
    if (valid) {
      for (const contribution of area.contributions) {
        if (
          !SOURCES.every(
            (kind) =>
              Number.isFinite(contribution.sourceScores?.[kind]) &&
              contribution.sourceScores[kind] >= 0
          ) ||
          !Number.isFinite(contribution.score) ||
          contribution.score < 0
        ) {
          throw new TypeError("Political report source scores are invalid.");
        }
        for (const kind of SOURCES) localSources[kind] += contribution.sourceScores[kind];
        if (contribution.factionId === null) addContribution(localUnattributed, contribution);
        else if (!contribution.participant) addContribution(localOutside, contribution);
        else
          rows.push({
            factionId: contribution.factionId,
            name: factionById.get(contribution.factionId)?.name ?? contribution.factionId,
            score: contribution.score,
            share: contribution.share,
            sourceScores: { ...contribution.sourceScores }
          });
      }
    }
    const conditional = { homelessSpawn: 0, nest: 0 };
    for (const record of geometry.records) {
      if (
        record.state === "conditional" &&
        !record.exclusionReason &&
        Object.hasOwn(conditional, record.kind)
      )
        conditional[record.kind] += 1;
    }
    if (area.cellCount <= 0) coverage.unmapped += 1;
    else if (area.status === "excluded") coverage.excluded += 1;
    else if (!valid) coverage.indeterminate += 1;
    else {
      coverage.included += 1;
      total += area.evidenceTotal;
      for (const kind of SOURCES) sourceScores[kind] += localSources[kind];
      addContribution(outside, localOutside);
      addContribution(unattributed, localUnattributed);
      for (const row of rows) {
        const aggregate = globalRows.get(row.factionId) ?? {
          factionId: row.factionId,
          name: row.name,
          score: 0,
          sourceScores: emptySources()
        };
        addContribution(aggregate, row);
        globalRows.set(row.factionId, aggregate);
      }
    }
    return {
      geometryKey: area.geometryKey,
      areas: geometry.areaIds.map((id, index) => ({ id, name: geometry.areaNames[index] ?? id })),
      title: geometry.areaNames.join(" / ") || "Unknown political area",
      status: area.status,
      outcomeLabel: OUTCOME_LABELS[area.status],
      reasons: explanationReasons(area, geometry, thresholds),
      evidenceTotal: valid ? area.evidenceTotal : null,
      sourceScores: valid ? localSources : null,
      thresholds,
      winnerShare: valid ? area.winnerShare : null,
      lead: valid ? area.lead : null,
      leaders: valid
        ? area.contributions.slice(0, 2).map((row) => publicContributor(row, factionById))
        : [],
      rows,
      outside: withShare(localOutside, area.evidenceTotal),
      unattributed: withShare(localUnattributed, area.evidenceTotal),
      conditional,
      invalidEvidenceCount: area.invalidEvidenceIds.length
    };
  });
  const ranked = [...globalRows.values()]
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.factionId.localeCompare(b.factionId));
  let rank = 0;
  const rows = ranked.map((row, index) => {
    if (index === 0 || row.score !== ranked[index - 1].score) rank = index + 1;
    return { ...withShare(row, total), rank };
  });
  return deepFreeze({
    available: true,
    reason: null,
    areas,
    scorecard: {
      rows,
      evidenceTotal: total,
      sourceScores,
      outside: withShare(outside, total),
      unattributed: withShare(unattributed, total),
      coverage
    }
  });
}
