import { deepFreeze, isRecord, stableObject } from "../scenario/utils.js";

/** Authored adjacency, independent of mapped roots, scenario eligibility and progression. */
export function createOverrideConnectivity(townIndex) {
  const entries = new Map(
    [...townIndex.keys()].map((id) => [id, { incoming: [], outgoing: [], diagnostics: [] }])
  );
  let unknownTargets = false;
  for (const [sourceId, town] of townIndex) {
    const entry = entries.get(sourceId);
    const categories = town.ReferenceCategories;
    const links = categories?.["override town"];
    if (
      (Object.hasOwn(town, "ReferenceCategories") && !isRecord(categories)) ||
      (isRecord(categories) && Object.hasOwn(categories, "override town") && !Array.isArray(links))
    ) {
      unknownTargets = true;
      entry.diagnostics.push({
        level: "warning",
        code: "override_connectivity_malformed",
        message: `Authored override links for ${sourceId} are unavailable or malformed.`
      });
      continue;
    }
    for (const [position, reference] of (links ?? []).entries()) {
      const targetId =
        typeof reference?.StringId === "string" && reference.StringId.trim() !== ""
          ? reference.StringId
          : null;
      const link = { sourceId, targetId, position };
      entry.outgoing.push(link);
      if (targetId && entries.has(targetId)) entries.get(targetId).incoming.push(link);
      else {
        if (!targetId) unknownTargets = true;
        entry.diagnostics.push({
          level: "warning",
          code: "override_connectivity_unresolved",
          message: targetId
            ? `Authored override target ${targetId} from ${sourceId} is unavailable.`
            : `Authored override ${position + 1} from ${sourceId} has no valid target ID.`
        });
      }
    }
  }
  for (const entry of entries.values()) {
    entry.incoming.sort(
      (left, right) => left.sourceId.localeCompare(right.sourceId) || left.position - right.position
    );
    entry.state =
      entry.incoming.length || entry.outgoing.length
        ? "connected"
        : unknownTargets
          ? "unavailable"
          : "unconnected";
    if (entry.state === "unavailable" && !entry.diagnostics.length) {
      entry.diagnostics.push({
        level: "warning",
        code: "override_connectivity_incomplete",
        message:
          "Some authored override links have unknown targets; connectivity cannot be confirmed."
      });
    }
  }
  return deepFreeze(stableObject(entries.entries()));
}

export function projectOverrideReport(connectivity, scenarioAvailable, network) {
  if (connectivity?.state === "unconnected") {
    return { state: "unconnected", notice: "No connected overrides." };
  }
  if (!connectivity || connectivity.state === "unavailable") {
    return { state: "unavailable", notice: "Override connectivity is unavailable." };
  }
  if (!scenarioAvailable) {
    return {
      state: "unavailable",
      notice: "Override connections are authored, but scenario analysis is unavailable."
    };
  }
  if (!network) {
    return {
      state: "unavailable",
      notice: "Override connections are authored, but no mapped scenario path is available."
    };
  }
  return { state: "available", notice: null };
}
