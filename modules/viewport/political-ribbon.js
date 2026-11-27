const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const percent = (share) => `${share > 0 && share < 0.001 ? "<0.1" : number.format(share * 100)}%`;

/** Presentation of evaluator-owned, public-safe reports; never interprets confidence rules. */
export function createPoliticalRibbonReading(scorecard, local = null) {
  if (local) {
    const unavailable = local.status === "indeterminate" || local.status === "unavailable";
    const leader = !unavailable && local.leaders.find((row) => row.score > 0);
    const tied = leader && local.leaders[1]?.score === leader.score;
    const name = unavailable
      ? local.status === "indeterminate"
        ? "Indeterminate"
        : "Unavailable"
      : local.status === "excluded"
        ? "Excluded area"
        : !leader
          ? "No current evidence"
          : tied
            ? "Tied leaders"
            : leader.label;
    const share = leader ? percent(leader.share) : "";
    const count = unavailable ? null : local.rows.filter((row) => row.score > 0).length;
    return Object.freeze({
      scope: "Local",
      name,
      share,
      tied: Boolean(tied),
      count,
      description: `${local.title}. ${local.outcomeLabel}. ${leader ? `Leading evidence: ${name}; ${share} of local scored evidence.` : name}`,
      countDescription: `${local.title}: ${count === null ? "local ranked faction count unavailable" : `${count} included factions with positive local scored evidence`}.`
    });
  }
  const leaders = scorecard?.rows.filter((row) => row.rank === 1) ?? [];
  const leader = leaders[0];
  const name = !scorecard
    ? "Unavailable"
    : !leader
      ? "No ranked factions"
      : leaders.length > 1
        ? `${leaders.length} tied`
        : leader.name;
  const share = leader ? percent(leader.share) : "";
  return Object.freeze({
    scope: "Global",
    name,
    share,
    tied: leaders.length > 1,
    count: scorecard ? scorecard.rows.length : null,
    description: leader
      ? `Map-wide. ${leaders.length > 1 ? "Tied leading included factions" : "Leading included faction"}: ${name}; ${share} of scored evidence.`
      : scorecard
        ? "Map-wide: no included factions have positive scored evidence."
        : "Map-wide political reporting unavailable.",
    countDescription: scorecard
      ? `${scorecard.rows.length} included factions with positive map-wide scored evidence.`
      : "Map-wide ranked faction count unavailable."
  });
}
