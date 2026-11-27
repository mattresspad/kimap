export const CHARACTER_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: 1, label: "Alive" }),
  Object.freeze({ value: 2, label: "Imprisoned" }),
  Object.freeze({ value: 0, label: "Dead" })
]);

const CHARACTER_STATUS_VALUES = new Set(CHARACTER_STATUS_OPTIONS.map((option) => option.value));

export function normalizeCharacterStatus(value) {
  const status = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(status) || !CHARACTER_STATUS_VALUES.has(status)) {
    throw new TypeError("Character status must be Alive, Imprisoned, or Dead.");
  }
  return status;
}

export function normalizeFactionRelation(value) {
  const relation = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(relation) || relation < -100 || relation > 100) {
    throw new TypeError("Faction relation must be between -100 and 100.");
  }
  return relation;
}
