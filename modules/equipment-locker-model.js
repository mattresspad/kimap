const SESSION_INTERNALS = new WeakMap();

const STORAGE_COLUMNS = 24;
const INITIAL_STORAGE_ROWS = 8;
const STORAGE_ROW_BAND = 4;
const TAB_IDS = new Set(["items", "characters"]);

function freezeDeep(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const entry of Object.values(value)) freezeDeep(entry, seen);
  return Object.freeze(value);
}

function cloneData(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const result = [];
    seen.set(value, result);
    for (const entry of value) result.push(cloneData(entry, seen));
    return result;
  }
  const result = {};
  seen.set(value, result);
  for (const [key, entry] of Object.entries(value)) result[key] = cloneData(entry, seen);
  return result;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactId(value) {
  return typeof value === "string" && value !== "" && value.trim() === value ? value : null;
}

function typedKey(kind, id) {
  return `${kind}:${id}`;
}

function sourceRecords(value) {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return Object.values(value);
  return [];
}

function structurallyEqual(left, right, seen = new WeakMap()) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  let paired = seen.get(left);
  if (paired?.has(right)) return true;
  if (!paired) {
    paired = new WeakSet();
    seen.set(left, paired);
  }
  paired.add(right);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key, index) => key === rightKeys[index] && structurallyEqual(left[key], right[key], seen)
  );
}

function compareRecord(left, right) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareDiagnostic(left, right) {
  return (
    (left.recordKey ?? "").localeCompare(right.recordKey ?? "") ||
    left.code.localeCompare(right.code) ||
    (left.relatedKey ?? "").localeCompare(right.relatedKey ?? "") ||
    left.message.localeCompare(right.message)
  );
}

function diagnostic(code, message, { recordKey = null, relatedKey = null, detail = null } = {}) {
  return { severity: "warning", code, message, recordKey, relatedKey, detail };
}

const SLOT_DEFINITIONS = [
  { id: "weapon1", label: "Weapon I", width: 10, height: 2 },
  { id: "weapon2", label: "Weapon II", width: 7, height: 1 },
  { id: "belt", label: "Belt", width: 2, height: 2 },
  { id: "shirt", label: "Shirt", width: 4, height: 2 },
  { id: "head", label: "Head", width: 4, height: 3 },
  { id: "pants", label: "Pants", width: 4, height: 5 },
  { id: "armour", label: "Armour", width: 4, height: 6 },
  { id: "boots", label: "Boots", width: 4, height: 2 },
  { id: "backpack", label: "Backpack", width: 5, height: 4 },
  { id: "leftArm", label: "Left Arm", width: 2, height: 7 },
  { id: "rightArm", label: "Right Arm", width: 2, height: 7 },
  { id: "leftLeg", label: "Left Leg", width: 2, height: 7 },
  { id: "rightLeg", label: "Right Leg", width: 2, height: 7 }
];

export const EQUIPMENT_LOCKER_SLOTS = freezeDeep(SLOT_DEFINITIONS.map((slot) => ({ ...slot })));

const SLOT_BY_ID = new Map(EQUIPMENT_LOCKER_SLOTS.map((slot) => [slot.id, slot]));

const DATASET_DEFINITIONS = [
  { source: "weapons", kind: "weapon", categoryKey: "weapons", label: "Weapons" },
  { source: "crossbows", kind: "crossbow", categoryKey: "crossbows", label: "Crossbows" },
  { source: "armours", kind: "armour", categoryKey: "armours", label: "Armour" },
  { source: "bags", kind: "bag", categoryKey: "bags", label: "Bags" },
  {
    source: "limbReplacements",
    kind: "limbReplacement",
    categoryKey: "limbReplacements",
    label: "Limb Replacements"
  },
  { source: "items", kind: "item", categoryKey: "items", label: "Items" },
  { source: "mapItems", kind: "mapItem", categoryKey: "mapItems", label: "Maps" },
  { source: "nestItems", kind: "nestItem", categoryKey: "nestItems", label: "Nest Items" }
];

export const EQUIPMENT_LOCKER_ITEM_CATEGORIES = freezeDeep(
  DATASET_DEFINITIONS.map(({ categoryKey: key, kind, label }) => ({ key, kind, label }))
);

const ARMOUR_SLOT_IDS = new Map([
  [3, "head"],
  [5, "armour"],
  [6, "pants"],
  [8, "shirt"],
  [9, "boots"]
]);
const LIMB_SLOT_IDS = new Map([
  [50, "leftArm"],
  [51, "rightArm"],
  [52, "leftLeg"],
  [53, "rightLeg"]
]);

const CHARACTER_REFERENCE_GROUPS = [
  { category: "clothing", kind: "armour" },
  { category: "weapons", kind: "weapon" },
  { category: "crossbows", kind: "crossbow" },
  { category: "backpack", kind: "bag" },
  { category: "inventory", kind: "item", group: "inventory" },
  {
    category: "weapon level",
    kind: "weaponManufacturer",
    group: "weaponManufacturers"
  }
];

function authoredNumber(values, key) {
  const value = values[key];
  return Number.isFinite(value) ? value : null;
}

function diagnoseCommonValues(values, recordKey, addDiagnostic) {
  if (Object.hasOwn(values, "REMOVED") && typeof values.REMOVED !== "boolean") {
    addDiagnostic(
      diagnostic("invalid_removed_flag", "REMOVED is present but is not a boolean.", {
        recordKey,
        detail: { value: cloneData(values.REMOVED) }
      })
    );
  }
  for (const key of ["weight kg", "value"]) {
    if (Object.hasOwn(values, key) && !Number.isFinite(values[key])) {
      addDiagnostic(
        diagnostic("invalid_authored_number", `'${key}' is present but is not a finite number.`, {
          recordKey,
          detail: { key, value: cloneData(values[key]) }
        })
      );
    }
  }
}

function normalizeFootprint(values, recordKey, addDiagnostic) {
  const width = values["inventory footprint width"];
  const height = values["inventory footprint height"];
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    addDiagnostic(
      diagnostic("invalid_footprint", "Item has no usable positive-integer inventory footprint.", {
        recordKey
      })
    );
    return null;
  }
  return { width, height };
}

function candidateSlotIds(kind, values, footprint) {
  if (footprint === null) return [];
  let candidates = [];
  if (kind === "weapon") candidates = ["weapon1", "weapon2"];
  else if (kind === "crossbow") candidates = ["weapon1"];
  else if (kind === "armour") candidates = [ARMOUR_SLOT_IDS.get(values.slot)].filter(Boolean);
  else if (kind === "bag" && values.slot === 12) candidates = ["backpack"];
  else if (kind === "limbReplacement") {
    candidates = [LIMB_SLOT_IDS.get(values.slot)].filter(Boolean);
  } else if (kind === "item" && values.slot === 14) candidates = ["belt"];

  return candidates.filter((slotId) => {
    const slot = SLOT_BY_ID.get(slotId);
    return footprint.width <= slot.width && footprint.height <= slot.height;
  });
}

function normalizeReferences(record, recordKey, addDiagnostic) {
  const categories = record.ReferenceCategories;
  if (categories === undefined) return {};
  if (!isRecord(categories)) {
    addDiagnostic(
      diagnostic("malformed_reference_categories", "ReferenceCategories is not an object.", {
        recordKey
      })
    );
    return {};
  }
  const result = {};
  for (const category of Object.keys(categories).sort()) {
    const references = categories[category];
    if (!Array.isArray(references)) {
      addDiagnostic(
        diagnostic(
          "malformed_reference_category",
          `Reference category '${category}' is not an array.`,
          {
            recordKey
          }
        )
      );
      result[category] = [];
      continue;
    }
    result[category] = references.map((reference, authoredIndex) => {
      const id = exactId(reference?.StringId);
      if (id === null) {
        addDiagnostic(
          diagnostic(
            "malformed_reference",
            `Reference category '${category}' contains no exact ID.`,
            {
              recordKey
            }
          )
        );
      }
      return {
        authoredIndex,
        id,
        name:
          typeof reference?.Name === "string" && reference.Name.trim() !== ""
            ? reference.Name.trim()
            : (id ?? "Missing identity"),
        value0: Number.isFinite(reference?.Value0) ? reference.Value0 : null,
        value1: Number.isFinite(reference?.Value1) ? reference.Value1 : null,
        value2: Number.isFinite(reference?.Value2) ? reference.Value2 : null
      };
    });
  }
  return result;
}

function groupUniqueRecords(definition, rawRecords, diagnostics, conflictingKeys) {
  const grouped = new Map();
  for (const entry of sourceRecords(rawRecords)) {
    if (!isRecord(entry)) {
      diagnostics.push(
        diagnostic("malformed_record", `${definition.label} contains a non-object record.`)
      );
      continue;
    }
    const id = exactId(entry.StringId);
    if (id === null) {
      diagnostics.push(
        diagnostic("missing_identity", `${definition.label} record has no exact StringId.`)
      );
      continue;
    }
    const entries = grouped.get(id) ?? [];
    entries.push(entry);
    grouped.set(id, entries);
  }

  const result = [];
  for (const [id, entries] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    const key = typedKey(definition.kind, id);
    const [representative, ...duplicates] = entries;
    if (duplicates.some((entry) => !structurallyEqual(representative, entry))) {
      conflictingKeys.add(key);
      diagnostics.push(
        diagnostic(
          "conflicting_duplicate",
          `${definition.label} ID has conflicting duplicate records and was omitted.`,
          { recordKey: key }
        )
      );
      continue;
    }
    if (duplicates.length > 0) {
      diagnostics.push(
        diagnostic(
          "identical_duplicate",
          `${definition.label} ID has identical duplicate records; one copy was retained.`,
          { recordKey: key, detail: { duplicateCount: duplicates.length } }
        )
      );
    }
    result.push({ id, key, raw: representative });
  }
  return result;
}

function normalizeItem(definition, entry, diagnostics) {
  const localDiagnostics = [];
  const addDiagnostic = (entryDiagnostic) => {
    localDiagnostics.push(entryDiagnostic);
    diagnostics.push(entryDiagnostic);
  };
  const values = isRecord(entry.raw.Values) ? cloneData(entry.raw.Values) : {};
  if (!isRecord(entry.raw.Values) && entry.raw.Values !== undefined) {
    addDiagnostic(
      diagnostic("malformed_values", "Item Values is not an object.", { recordKey: entry.key })
    );
  }
  diagnoseCommonValues(values, entry.key, addDiagnostic);
  const footprint = normalizeFootprint(values, entry.key, addDiagnostic);
  const compatibleSlotIds = candidateSlotIds(definition.kind, values, footprint);
  const slotBearingKind = ["weapon", "crossbow", "armour", "bag", "limbReplacement"].includes(
    definition.kind
  );
  if (slotBearingKind && footprint !== null && compatibleSlotIds.length === 0) {
    addDiagnostic(
      diagnostic("unsupported_slot", "Item has no supported compatible Equipment slot.", {
        recordKey: entry.key,
        detail: { authoredSlot: values.slot ?? null }
      })
    );
  }
  if (definition.kind === "item" && values.slot === 14 && compatibleSlotIds.length === 0) {
    addDiagnostic(
      diagnostic("oversized_belt_item", "Belt item does not fit the supported Belt slot.", {
        recordKey: entry.key
      })
    );
  }
  const name =
    typeof entry.raw.Name === "string" && entry.raw.Name.trim() !== ""
      ? entry.raw.Name.trim()
      : entry.id;
  if (name === entry.id && entry.raw.Name !== entry.id) {
    addDiagnostic(
      diagnostic("missing_name", "Item has no usable name and uses its exact ID.", {
        recordKey: entry.key
      })
    );
  }
  return {
    key: entry.key,
    id: entry.id,
    kind: definition.kind,
    categoryKey: definition.categoryKey,
    categoryLabel: definition.label,
    name,
    removed: values.REMOVED === true,
    description: typeof values.description === "string" ? values.description.trim() : "",
    footprint,
    compatibleSlotIds,
    storable: footprint !== null && footprint.width <= STORAGE_COLUMNS,
    equipable: compatibleSlotIds.length > 0,
    weight: authoredNumber(values, "weight kg"),
    value: authoredNumber(values, "value"),
    authored: {
      values,
      referenceCategories: normalizeReferences(entry.raw, entry.key, addDiagnostic)
    },
    diagnostics: localDiagnostics.sort(compareDiagnostic)
  };
}

function resolveCharacterReference(
  reference,
  expectedKind,
  recordsByKey,
  conflictingKeys,
  characterKey,
  category,
  addDiagnostic
) {
  const id = reference.id;
  const targetKey = id === null ? null : typedKey(expectedKind, id);
  let status = "resolved";
  if (targetKey === null) status = "malformed";
  else if (conflictingKeys.has(targetKey)) status = "conflicting";
  else if (!recordsByKey[targetKey]) status = "unresolved";
  if (status !== "resolved") {
    addDiagnostic(
      diagnostic(
        `character_${status}_reference`,
        `Character '${category}' reference could not be resolved by exact typed ID.`,
        { recordKey: characterKey, relatedKey: targetKey }
      )
    );
  }
  const target = status === "resolved" ? recordsByKey[targetKey] : null;
  return {
    ...reference,
    category,
    expectedKind,
    targetKey,
    status,
    compatibleSlotIds: target?.compatibleSlotIds ?? []
  };
}

function normalizeCharacter(entry, recordsByKey, conflictingKeys, diagnostics) {
  const localDiagnostics = [];
  const addDiagnostic = (entryDiagnostic) => {
    localDiagnostics.push(entryDiagnostic);
    diagnostics.push(entryDiagnostic);
  };
  const values = isRecord(entry.raw.Values) ? cloneData(entry.raw.Values) : {};
  if (!isRecord(entry.raw.Values) && entry.raw.Values !== undefined) {
    addDiagnostic(
      diagnostic("malformed_values", "Character Values is not an object.", {
        recordKey: entry.key
      })
    );
  }
  diagnoseCommonValues(values, entry.key, addDiagnostic);
  const references = normalizeReferences(entry.raw, entry.key, addDiagnostic);
  const slotCandidates = Object.fromEntries(EQUIPMENT_LOCKER_SLOTS.map(({ id }) => [id, []]));
  const inventory = [];
  const weaponManufacturers = [];
  const unresolved = [];
  const all = [];

  for (const group of CHARACTER_REFERENCE_GROUPS) {
    for (const reference of references[group.category] ?? []) {
      const resolved = resolveCharacterReference(
        reference,
        group.kind,
        recordsByKey,
        conflictingKeys,
        entry.key,
        group.category,
        addDiagnostic
      );
      all.push(resolved);
      if (resolved.status !== "resolved") {
        unresolved.push(resolved);
        continue;
      }
      if (group.group === "inventory") inventory.push(resolved);
      else if (group.group === "weaponManufacturers") weaponManufacturers.push(resolved);
      else if (resolved.compatibleSlotIds.length === 0) {
        const incompatible = { ...resolved, status: "incompatible" };
        all[all.length - 1] = incompatible;
        unresolved.push(incompatible);
        addDiagnostic(
          diagnostic(
            "character_incompatible_reference",
            `Character '${group.category}' reference resolves, but the item has no compatible Equipment slot.`,
            { recordKey: entry.key, relatedKey: resolved.targetKey }
          )
        );
      } else {
        for (const slotId of resolved.compatibleSlotIds) slotCandidates[slotId].push(resolved);
      }
    }
  }

  const name =
    typeof entry.raw.Name === "string" && entry.raw.Name.trim() !== ""
      ? entry.raw.Name.trim()
      : entry.id;
  if (name === entry.id && entry.raw.Name !== entry.id) {
    addDiagnostic(
      diagnostic("missing_name", "Character has no usable name and uses its exact ID.", {
        recordKey: entry.key
      })
    );
  }
  const slotGroups = EQUIPMENT_LOCKER_SLOTS.map(({ id, label }) => ({
    key: id,
    label,
    candidates: slotCandidates[id],
    competing: slotCandidates[id].length > 1
  })).filter(({ candidates }) => candidates.length > 0);

  return {
    key: entry.key,
    id: entry.id,
    kind: "character",
    name,
    removed: values.REMOVED === true,
    description: typeof values.description === "string" ? values.description.trim() : "",
    authored: { values, referenceCategories: references },
    loadout: {
      hasEvidence: all.length > 0,
      slotGroups,
      inventory,
      weaponManufacturers,
      unresolved,
      references: all
    },
    diagnostics: localDiagnostics.sort(compareDiagnostic)
  };
}

/** Build a deeply immutable exact-ID Equipment Locker projection from staged raw datasets. */
export function createEquipmentLockerProjection(datasets = {}) {
  if (!isRecord(datasets)) throw new TypeError("Equipment Locker datasets must be an object.");
  const diagnostics = [];
  const conflictingKeys = new Set();
  const recordsByKey = {};
  const itemRecords = [];

  for (const definition of DATASET_DEFINITIONS) {
    const entries = groupUniqueRecords(
      definition,
      datasets[definition.source],
      diagnostics,
      conflictingKeys
    );
    for (const entry of entries) {
      const record = normalizeItem(definition, entry, diagnostics);
      recordsByKey[record.key] = record;
      itemRecords.push(record);
    }
  }

  const manufacturerDefinition = {
    source: "weaponManufacturers",
    kind: "weaponManufacturer",
    label: "Weapon Manufacturers"
  };
  const manufacturerEntries = groupUniqueRecords(
    manufacturerDefinition,
    datasets.weaponManufacturers,
    diagnostics,
    conflictingKeys
  );
  for (const entry of manufacturerEntries) {
    const localDiagnostics = [];
    const addDiagnostic = (entryDiagnostic) => {
      localDiagnostics.push(entryDiagnostic);
      diagnostics.push(entryDiagnostic);
    };
    const values = isRecord(entry.raw.Values) ? cloneData(entry.raw.Values) : {};
    if (!isRecord(entry.raw.Values) && entry.raw.Values !== undefined) {
      addDiagnostic(
        diagnostic("malformed_values", "Weapon Manufacturer Values is not an object.", {
          recordKey: entry.key
        })
      );
    }
    diagnoseCommonValues(values, entry.key, addDiagnostic);
    recordsByKey[entry.key] = {
      key: entry.key,
      id: entry.id,
      kind: "weaponManufacturer",
      name:
        typeof entry.raw.Name === "string" && entry.raw.Name.trim() !== ""
          ? entry.raw.Name.trim()
          : entry.id,
      removed: values.REMOVED === true,
      authored: {
        values,
        referenceCategories: normalizeReferences(entry.raw, entry.key, addDiagnostic)
      },
      diagnostics: localDiagnostics.sort(compareDiagnostic)
    };
  }

  const characterDefinition = { source: "characters", kind: "character", label: "Characters" };
  const characterEntries = groupUniqueRecords(
    characterDefinition,
    datasets.characters,
    diagnostics,
    conflictingKeys
  );
  const characters = characterEntries
    .map((entry) => normalizeCharacter(entry, recordsByKey, conflictingKeys, diagnostics))
    .sort(compareRecord);
  for (const character of characters) recordsByKey[character.key] = character;

  itemRecords.sort(compareRecord);
  const itemCategories = EQUIPMENT_LOCKER_ITEM_CATEGORIES.map((category) => ({
    ...category,
    recordKeys: itemRecords
      .filter(({ categoryKey }) => categoryKey === category.key)
      .map(({ key }) => key)
  })).filter(({ recordKeys }) => recordKeys.length > 0);

  const sortedRecordsByKey = Object.fromEntries(
    Object.entries(recordsByKey).sort(([left], [right]) => left.localeCompare(right))
  );
  return freezeDeep({
    available: itemRecords.length > 0,
    validItemCount: itemRecords.length,
    characterAvailable: characters.length > 0,
    itemRecords,
    characters,
    weaponManufacturers: manufacturerEntries
      .map(({ key }) => sortedRecordsByKey[key])
      .sort(compareRecord),
    recordsByKey: sortedRecordsByKey,
    itemCategories,
    conflictingKeys: [...conflictingKeys].sort(),
    diagnostics: diagnostics.sort(compareDiagnostic)
  });
}

function normalizeViewQuery(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
}

function queryMatches(record, query) {
  return (
    query === "" ||
    record.name.toLocaleLowerCase("en-US").includes(query) ||
    record.id.toLocaleLowerCase("en-US").includes(query)
  );
}

/** Select catalog presentation without mutating the immutable projection or session snapshot. */
export function createEquipmentLockerView(projection, snapshot = {}) {
  if (
    !projection ||
    !Array.isArray(projection.itemRecords) ||
    !Array.isArray(projection.characters)
  ) {
    throw new TypeError("Equipment Locker view requires a Locker projection.");
  }
  const activeTab = TAB_IDS.has(snapshot.activeTab) ? snapshot.activeTab : "items";
  const showRemoved = snapshot.showRemoved === true;
  const queries = isRecord(snapshot.queries) ? snapshot.queries : {};
  const openCategoryKeys = isRecord(snapshot.openCategoryKeys) ? snapshot.openCategoryKeys : {};
  const itemQuery = normalizeViewQuery(queries.items);
  const characterQuery = normalizeViewQuery(queries.characters);
  const itemOpen = new Set(Array.isArray(openCategoryKeys.items) ? openCategoryKeys.items : []);

  const eligibleItems = projection.itemRecords.filter((record) => showRemoved || !record.removed);
  const itemCategories = projection.itemCategories
    .map((category) => {
      const all = category.recordKeys
        .map((key) => projection.recordsByKey[key])
        .filter((record) => record && (showRemoved || !record.removed));
      const records = all.filter((record) => queryMatches(record, itemQuery));
      return {
        key: category.key,
        label: category.label,
        recordKeys: records.map(({ key }) => key),
        count: records.length,
        totalCount: all.length,
        open: itemQuery !== "" ? records.length > 0 : itemOpen.has(category.key)
      };
    })
    .filter(({ count, totalCount }) => totalCount > 0 && (itemQuery === "" || count > 0));
  const eligibleCharacters = projection.characters.filter(
    (record) => showRemoved || !record.removed
  );
  const visibleCharacters = eligibleCharacters.filter((record) =>
    queryMatches(record, characterQuery)
  );

  return freezeDeep({
    activeTab,
    showRemoved,
    itemQuery,
    characterQuery,
    itemCategories,
    visibleItemKeys: itemCategories.flatMap(({ recordKeys }) => recordKeys),
    eligibleItemCount: eligibleItems.length,
    visibleCharacterKeys: visibleCharacters.map(({ key }) => key),
    eligibleCharacterCount: eligibleCharacters.length,
    itemSearchEmpty: itemQuery !== "" && itemCategories.length === 0,
    characterSearchEmpty: characterQuery !== "" && visibleCharacters.length === 0
  });
}

function requireTab(tab) {
  if (!TAB_IDS.has(tab)) throw new TypeError(`Unknown Equipment Locker tab '${String(tab)}'.`);
  return tab;
}

function initialCategoryKeys(projection) {
  return projection.itemCategories[0] ? [projection.itemCategories[0].key] : [];
}

function emptyEquipment() {
  return Object.fromEntries(EQUIPMENT_LOCKER_SLOTS.map(({ id }) => [id, null]));
}

function createInitialSessionState(projection) {
  return {
    activeTab: "items",
    queries: { items: "", characters: "" },
    showRemoved: false,
    openCategoryKeys: {
      items: new Set(initialCategoryKeys(projection)),
      characters: new Set(["characters"])
    },
    catalogScrollTop: { items: 0, characters: 0 },
    catalogFocusIdentity: { items: null, characters: null },
    selection: null,
    equipment: emptyEquipment(),
    occurrences: new Map(),
    placements: new Map(),
    storageRows: INITIAL_STORAGE_ROWS,
    nextOccurrenceNumber: 1,
    rovingEquipmentSlotId: EQUIPMENT_LOCKER_SLOTS[0].id,
    rovingStorageOccurrenceId: null,
    storageExpanded: false,
    clearConfirmationOpen: false,
    status: null
  };
}

function sessionSnapshot(internal) {
  const state = internal.state;
  return freezeDeep({
    activeTab: state.activeTab,
    queries: { ...state.queries },
    showRemoved: state.showRemoved,
    openCategoryKeys: {
      items: [...state.openCategoryKeys.items].sort(),
      characters: [...state.openCategoryKeys.characters].sort()
    },
    catalogScrollTop: { ...state.catalogScrollTop },
    catalogFocusIdentity: { ...state.catalogFocusIdentity },
    selection: state.selection === null ? null : { ...state.selection },
    equipment: { ...state.equipment },
    occurrences: [...state.occurrences.values()].map((occurrence) => ({ ...occurrence })),
    storage: {
      columns: STORAGE_COLUMNS,
      rows: state.storageRows,
      placements: [...state.placements.values()].map((placement) => ({ ...placement }))
    },
    rovingEquipmentSlotId: state.rovingEquipmentSlotId,
    rovingStorageOccurrenceId: state.rovingStorageOccurrenceId,
    storageExpanded: state.storageExpanded,
    clearConfirmationOpen: state.clearConfirmationOpen,
    status: state.status === null ? null : { ...state.status }
  });
}

function notify(session, type, detail = null) {
  const internal = SESSION_INTERNALS.get(session);
  internal.snapshot = sessionSnapshot(internal);
  const event = freezeDeep({ type, detail, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(event);
    } catch (_error) {
      // Presentation observers cannot roll back an already committed Locker action.
    }
  }
  return event;
}

function requireCatalogRecord(internal, key, { itemOnly = false, visible = true } = {}) {
  const record = internal.projection.recordsByKey[key];
  const permitted =
    record && (internal.itemKeys.has(key) || (!itemOnly && internal.characterKeys.has(key)));
  if (!permitted) throw new TypeError(`Unknown Equipment Locker record '${String(key)}'.`);
  if (visible && !internal.state.showRemoved && record.removed) {
    throw new TypeError(`Equipment Locker record '${key}' is hidden by the removed-record filter.`);
  }
  return record;
}

function requireOccurrence(internal, occurrenceId) {
  if (typeof occurrenceId !== "string" || !internal.state.occurrences.has(occurrenceId)) {
    throw new TypeError(`Unknown Equipment Locker occurrence '${String(occurrenceId)}'.`);
  }
  return internal.state.occurrences.get(occurrenceId);
}

function requireUsableItem(record, operation) {
  if (record.footprint === null) {
    throw new TypeError(`${record.name} cannot be ${operation} without a usable footprint.`);
  }
  if (operation === "stored" && !record.storable) {
    throw new TypeError(`${record.name} is wider than Equipment Locker Storage.`);
  }
  if (operation === "equipped" && !record.equipable) {
    throw new TypeError(`${record.name} has no compatible Equipment slot.`);
  }
}

function placementIntersects(left, right) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

function firstStoragePlacement(state, footprint) {
  const existing = [...state.placements.values()];
  const maxBottom = Math.max(0, ...existing.map(({ y, height }) => y + height));
  for (let y = 0; y <= maxBottom; y += 1) {
    for (let x = 0; x <= STORAGE_COLUMNS - footprint.width; x += 1) {
      const candidate = { x, y, width: footprint.width, height: footprint.height };
      if (existing.every((placement) => !placementIntersects(candidate, placement))) {
        return candidate;
      }
    }
  }
  throw new Error("Equipment Locker could not find a bounded Storage placement.");
}

function growStorageRows(currentRows, requiredRows) {
  if (requiredRows <= currentRows) return currentRows;
  return Math.max(
    INITIAL_STORAGE_ROWS,
    Math.ceil(requiredRows / STORAGE_ROW_BAND) * STORAGE_ROW_BAND
  );
}

function placeOccurrenceInStorage(internal, occurrenceId) {
  const occurrence = requireOccurrence(internal, occurrenceId);
  const item = internal.projection.recordsByKey[occurrence.itemKey];
  requireUsableItem(item, "stored");
  const placement = firstStoragePlacement(internal.state, item.footprint);
  const complete = { occurrenceId, ...placement };
  internal.state.placements.set(occurrenceId, complete);
  internal.state.storageRows = growStorageRows(
    internal.state.storageRows,
    placement.y + placement.height
  );
  internal.state.rovingStorageOccurrenceId = occurrenceId;
  return complete;
}

function locateEquipmentOccurrence(state, occurrenceId) {
  return (
    Object.keys(state.equipment).find((slotId) => state.equipment[slotId] === occurrenceId) ?? null
  );
}

function chooseEquipSlot(internal, record, requestedSlotId = null) {
  requireUsableItem(record, "equipped");
  if (requestedSlotId !== null) {
    if (!SLOT_BY_ID.has(requestedSlotId)) {
      throw new TypeError(`Unknown Equipment slot '${String(requestedSlotId)}'.`);
    }
    if (!record.compatibleSlotIds.includes(requestedSlotId)) {
      throw new TypeError(
        `${record.name} is not compatible with ${SLOT_BY_ID.get(requestedSlotId).label}.`
      );
    }
    return requestedSlotId;
  }
  const empty = record.compatibleSlotIds.find(
    (slotId) => internal.state.equipment[slotId] === null
  );
  if (empty) return empty;
  if (record.compatibleSlotIds.includes("weapon1")) return "weapon1";
  return record.compatibleSlotIds[0];
}

function createOccurrence(internal, itemKey) {
  const occurrenceId = `locker-occurrence-${String(internal.state.nextOccurrenceNumber)}`;
  internal.state.nextOccurrenceNumber += 1;
  const occurrence = { id: occurrenceId, itemKey };
  internal.state.occurrences.set(occurrenceId, occurrence);
  return occurrence;
}

function normalizeStorageRoving(state) {
  if (
    state.rovingStorageOccurrenceId !== null &&
    state.placements.has(state.rovingStorageOccurrenceId)
  ) {
    return;
  }
  state.rovingStorageOccurrenceId = state.placements.keys().next().value ?? null;
}

/** Session-local Equipment Locker state. It never mutates manifest or scenario data. */
export class EquipmentLockerPresentationSession {
  constructor({ projection } = {}) {
    if (!projection || !Array.isArray(projection.itemRecords) || !projection.recordsByKey) {
      throw new TypeError("Equipment Locker presentation requires a Locker projection.");
    }
    const internal = {
      projection,
      itemKeys: new Set(projection.itemRecords.map(({ key }) => key)),
      characterKeys: new Set(projection.characters.map(({ key }) => key)),
      categoryKeys: new Set(projection.itemCategories.map(({ key }) => key)),
      subscribers: new Set(),
      state: createInitialSessionState(projection),
      snapshot: null
    };
    internal.snapshot = sessionSnapshot(internal);
    SESSION_INTERNALS.set(this, internal);
  }

  getSnapshot() {
    return SESSION_INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") throw new TypeError("Subscriber must be a function.");
    const subscribers = SESSION_INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  setActiveTab(tab) {
    const normalized = requireTab(tab);
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.activeTab === normalized) return false;
    internal.state.activeTab = normalized;
    return notify(this, "setActiveTab");
  }

  setQuery(tab, query) {
    requireTab(tab);
    if (typeof query !== "string") throw new TypeError("Equipment Locker query must be a string.");
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.queries[tab] === query) return false;
    internal.state.queries[tab] = query;
    return notify(this, "setQuery", { tab });
  }

  setShowRemoved(showRemoved) {
    if (typeof showRemoved !== "boolean") {
      throw new TypeError("Equipment Locker removed-record visibility must be boolean.");
    }
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.showRemoved === showRemoved) return false;
    internal.state.showRemoved = showRemoved;
    if (
      !showRemoved &&
      internal.state.selection?.source === "catalog" &&
      internal.projection.recordsByKey[internal.state.selection.key]?.removed
    ) {
      internal.state.selection = null;
    }
    return notify(this, "setShowRemoved");
  }

  setCategoryOpen(tab, categoryKey, open) {
    requireTab(tab);
    if (typeof open !== "boolean") throw new TypeError("Locker disclosure state must be boolean.");
    const internal = SESSION_INTERNALS.get(this);
    const valid =
      tab === "items" ? internal.categoryKeys.has(categoryKey) : categoryKey === "characters";
    if (!valid) throw new TypeError(`Unknown Equipment Locker category '${String(categoryKey)}'.`);
    const categories = internal.state.openCategoryKeys[tab];
    if (categories.has(categoryKey) === open) return false;
    if (open) categories.add(categoryKey);
    else categories.delete(categoryKey);
    return notify(this, "setCategoryOpen", { tab, categoryKey });
  }

  setCatalogScrollTop(tab, scrollTop) {
    requireTab(tab);
    if (!Number.isFinite(scrollTop) || scrollTop < 0) {
      throw new TypeError("Equipment Locker catalog scroll must be a nonnegative finite number.");
    }
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.catalogScrollTop[tab] === scrollTop) return false;
    internal.state.catalogScrollTop[tab] = scrollTop;
    return notify(this, "setCatalogScrollTop", { tab });
  }

  setCatalogFocusIdentity(tab, identity) {
    requireTab(tab);
    if (identity !== null && (typeof identity !== "string" || identity === "")) {
      throw new TypeError("Equipment Locker catalog focus identity must be null or nonempty text.");
    }
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.catalogFocusIdentity[tab] === identity) return false;
    internal.state.catalogFocusIdentity[tab] = identity;
    return notify(this, "setCatalogFocusIdentity", { tab });
  }

  selectCatalogRecord(key) {
    const internal = SESSION_INTERNALS.get(this);
    requireCatalogRecord(internal, key);
    if (internal.state.selection?.source === "catalog" && internal.state.selection.key === key) {
      return false;
    }
    internal.state.selection = { source: "catalog", key };
    return notify(this, "selectCatalogRecord", { key });
  }

  selectOccurrence(occurrenceId) {
    const internal = SESSION_INTERNALS.get(this);
    requireOccurrence(internal, occurrenceId);
    if (
      internal.state.selection?.source === "occurrence" &&
      internal.state.selection.occurrenceId === occurrenceId
    ) {
      return false;
    }
    internal.state.selection = { source: "occurrence", occurrenceId };
    return notify(this, "selectOccurrence", { occurrenceId });
  }

  clearSelection() {
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.selection === null) return false;
    internal.state.selection = null;
    return notify(this, "clearSelection");
  }

  resolveDefaultSlot(itemKey) {
    const internal = SESSION_INTERNALS.get(this);
    const record = requireCatalogRecord(internal, itemKey, { itemOnly: true, visible: false });
    return chooseEquipSlot(internal, record);
  }

  addToStorage(itemKey) {
    const internal = SESSION_INTERNALS.get(this);
    const item = requireCatalogRecord(internal, itemKey, { itemOnly: true });
    requireUsableItem(item, "stored");
    const occurrence = createOccurrence(internal, itemKey);
    const placement = placeOccurrenceInStorage(internal, occurrence.id);
    internal.state.storageExpanded = true;
    internal.state.selection = { source: "occurrence", occurrenceId: occurrence.id };
    internal.state.status = { tone: "success", message: `${item.name} added to Storage.` };
    return notify(this, "addToStorage", { occurrenceId: occurrence.id, placement });
  }

  equipCatalogRecord(itemKey, slotId = null) {
    const internal = SESSION_INTERNALS.get(this);
    const item = requireCatalogRecord(internal, itemKey, { itemOnly: true });
    const targetSlotId = chooseEquipSlot(internal, item, slotId);
    const occurrence = createOccurrence(internal, itemKey);
    const displacedId = internal.state.equipment[targetSlotId];
    if (displacedId !== null) placeOccurrenceInStorage(internal, displacedId);
    internal.state.equipment[targetSlotId] = occurrence.id;
    internal.state.rovingEquipmentSlotId = targetSlotId;
    internal.state.selection = { source: "occurrence", occurrenceId: occurrence.id };
    const replaced = displacedId !== null;
    internal.state.status = {
      tone: replaced ? "warning" : "success",
      message: replaced
        ? `${item.name} equipped; the replaced item moved to Storage.`
        : `${item.name} equipped.`
    };
    return notify(this, "equipCatalogRecord", {
      occurrenceId: occurrence.id,
      slotId: targetSlotId,
      displacedOccurrenceId: displacedId
    });
  }

  equipOccurrence(occurrenceId, slotId = null) {
    const internal = SESSION_INTERNALS.get(this);
    const occurrence = requireOccurrence(internal, occurrenceId);
    const item = internal.projection.recordsByKey[occurrence.itemKey];
    const targetSlotId = chooseEquipSlot(internal, item, slotId);
    const sourceSlotId = locateEquipmentOccurrence(internal.state, occurrenceId);
    if (sourceSlotId === targetSlotId) return false;
    const displacedId = internal.state.equipment[targetSlotId];
    internal.state.placements.delete(occurrenceId);
    if (sourceSlotId !== null) internal.state.equipment[sourceSlotId] = null;
    if (displacedId !== null && displacedId !== occurrenceId) {
      placeOccurrenceInStorage(internal, displacedId);
    }
    internal.state.equipment[targetSlotId] = occurrenceId;
    internal.state.rovingEquipmentSlotId = targetSlotId;
    normalizeStorageRoving(internal.state);
    internal.state.selection = { source: "occurrence", occurrenceId };
    internal.state.status = {
      tone: displacedId === null ? "success" : "warning",
      message:
        displacedId === null
          ? `${item.name} equipped.`
          : `${item.name} equipped; the replaced item moved to Storage.`
    };
    return notify(this, "equipOccurrence", {
      occurrenceId,
      slotId: targetSlotId,
      displacedOccurrenceId: displacedId
    });
  }

  moveOccurrenceToStorage(occurrenceId) {
    const internal = SESSION_INTERNALS.get(this);
    const occurrence = requireOccurrence(internal, occurrenceId);
    if (internal.state.placements.has(occurrenceId)) return false;
    const item = internal.projection.recordsByKey[occurrence.itemKey];
    requireUsableItem(item, "stored");
    const slotId = locateEquipmentOccurrence(internal.state, occurrenceId);
    if (slotId === null) throw new Error("Equipment occurrence has no active location.");
    internal.state.equipment[slotId] = null;
    const placement = placeOccurrenceInStorage(internal, occurrenceId);
    internal.state.storageExpanded = true;
    internal.state.selection = { source: "occurrence", occurrenceId };
    internal.state.status = { tone: "success", message: `${item.name} moved to Storage.` };
    return notify(this, "moveOccurrenceToStorage", { occurrenceId, placement });
  }

  removeOccurrence(occurrenceId) {
    const internal = SESSION_INTERNALS.get(this);
    const occurrence = requireOccurrence(internal, occurrenceId);
    const item = internal.projection.recordsByKey[occurrence.itemKey];
    const slotId = locateEquipmentOccurrence(internal.state, occurrenceId);
    if (slotId !== null) internal.state.equipment[slotId] = null;
    internal.state.placements.delete(occurrenceId);
    internal.state.occurrences.delete(occurrenceId);
    if (internal.state.selection?.occurrenceId === occurrenceId) internal.state.selection = null;
    normalizeStorageRoving(internal.state);
    internal.state.status = { tone: "warning", message: `${item.name} removed from the Locker.` };
    return notify(this, "removeOccurrence", { occurrenceId });
  }

  setRovingEquipmentSlotId(slotId) {
    if (!SLOT_BY_ID.has(slotId)) throw new TypeError(`Unknown Equipment slot '${String(slotId)}'.`);
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.rovingEquipmentSlotId === slotId) return false;
    internal.state.rovingEquipmentSlotId = slotId;
    return notify(this, "setRovingEquipmentSlotId", { slotId });
  }

  setRovingStorageOccurrenceId(occurrenceId) {
    const internal = SESSION_INTERNALS.get(this);
    if (occurrenceId !== null && !internal.state.placements.has(occurrenceId)) {
      throw new TypeError(`Unknown stored occurrence '${String(occurrenceId)}'.`);
    }
    if (internal.state.rovingStorageOccurrenceId === occurrenceId) return false;
    internal.state.rovingStorageOccurrenceId = occurrenceId;
    return notify(this, "setRovingStorageOccurrenceId", { occurrenceId });
  }

  setStorageExpanded(expanded) {
    if (typeof expanded !== "boolean") {
      throw new TypeError("Equipment Locker Storage disclosure state must be boolean.");
    }
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.storageExpanded === expanded) return false;
    internal.state.storageExpanded = expanded;
    return notify(this, "setStorageExpanded", { expanded });
  }

  requestClear() {
    const internal = SESSION_INTERNALS.get(this);
    if (internal.state.clearConfirmationOpen) return false;
    internal.state.clearConfirmationOpen = true;
    return notify(this, "requestClear");
  }

  cancelClear() {
    const internal = SESSION_INTERNALS.get(this);
    if (!internal.state.clearConfirmationOpen) return false;
    internal.state.clearConfirmationOpen = false;
    return notify(this, "cancelClear");
  }

  reportValidation(message) {
    if (typeof message !== "string" || message.trim() === "") {
      throw new TypeError("Equipment Locker validation feedback must be nonempty text.");
    }
    const internal = SESSION_INTERNALS.get(this);
    const normalized = message.trim();
    if (internal.state.status?.tone === "danger" && internal.state.status.message === normalized) {
      return false;
    }
    internal.state.status = { tone: "danger", message: normalized };
    return notify(this, "reportValidation");
  }

  confirmClear() {
    const internal = SESSION_INTERNALS.get(this);
    if (!internal.state.clearConfirmationOpen) return false;
    internal.state = createInitialSessionState(internal.projection);
    internal.state.status = { tone: "success", message: "Equipment Locker cleared." };
    return notify(this, "confirmClear");
  }

  reset() {
    const internal = SESSION_INTERNALS.get(this);
    const nextState = createInitialSessionState(internal.projection);
    if (structurallyEqual(internal.snapshot, sessionSnapshot({ state: nextState }))) return false;
    internal.state = nextState;
    return notify(this, "reset");
  }
}

export const EQUIPMENT_LOCKER_STORAGE_COLUMNS = STORAGE_COLUMNS;
export const EQUIPMENT_LOCKER_INITIAL_STORAGE_ROWS = INITIAL_STORAGE_ROWS;
export const EQUIPMENT_LOCKER_STORAGE_ROW_BAND = STORAGE_ROW_BAND;
