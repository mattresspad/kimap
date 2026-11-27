import { cloneData } from "../scenario/utils.js";

/** Compose the retained lineage; this never chooses or reevaluates an override. */
export function composeEffectiveTown(townById, baseTownId, state = null) {
  const base = townById[baseTownId];
  if (!base) return null;
  const result = cloneData(base);
  const path = state?.path ?? [baseTownId];
  const end = state?.activeTownId ? path.lastIndexOf(state.activeTownId) : path.length - 1;
  for (const id of path.slice(1, end + 1)) {
    const record = townById[id];
    if (!record) continue;
    Object.assign((result.Values ??= {}), record.Values ?? {});
    Object.assign((result.ReferenceCategories ??= {}), record.ReferenceCategories ?? {});
    result.Name = record.Name;
    result.StringId = record.StringId;
  }
  return result;
}
