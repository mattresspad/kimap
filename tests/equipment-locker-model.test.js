import assert from "node:assert/strict";
import test from "node:test";

import {
  EQUIPMENT_LOCKER_INITIAL_STORAGE_ROWS,
  EQUIPMENT_LOCKER_ITEM_CATEGORIES,
  EQUIPMENT_LOCKER_SLOTS,
  EQUIPMENT_LOCKER_STORAGE_COLUMNS,
  EquipmentLockerPresentationSession,
  createEquipmentLockerProjection,
  createEquipmentLockerView
} from "../modules/equipment-locker-model.js";

function reference(StringId, Name = StringId, Value0 = 0, Value1 = 0, Value2 = 0) {
  return { StringId, Name, Value0, Value1, Value2 };
}

function item(
  StringId,
  Name,
  { width = 1, height = 1, slot, removed = false, values = {}, references = {} } = {}
) {
  return {
    StringId,
    Name,
    Values: {
      "inventory footprint width": width,
      "inventory footprint height": height,
      ...(slot === undefined ? {} : { slot }),
      ...(removed ? { REMOVED: true } : {}),
      ...values
    },
    ReferenceCategories: references
  };
}

function character(StringId, Name, { removed = false, values = {}, references = {} } = {}) {
  return {
    StringId,
    Name,
    Values: { ...(removed ? { REMOVED: true } : {}), ...values },
    ReferenceCategories: references
  };
}

function basicProjection(extra = {}) {
  return createEquipmentLockerProjection({
    weapons: [item("blade", "Blade", { width: 7, height: 1 })],
    crossbows: [item("bow", "Bow", { width: 9, height: 2 })],
    armours: [item("coat", "Coat", { width: 4, height: 6, slot: 5 })],
    bags: [item("pack", "Pack", { width: 5, height: 4, slot: 12 })],
    limbReplacements: [item("arm", "Arm", { width: 2, height: 7, slot: 50 })],
    items: [item("kit", "Kit", { width: 2, height: 2 })],
    mapItems: [item("map", "Map")],
    nestItems: [item("egg", "Egg", { width: 2, height: 3 })],
    characters: [],
    weaponManufacturers: [],
    ...extra
  });
}

test("Equipment projection uses typed exact identities and deterministic duplicate handling", () => {
  const duplicate = item("same", "Same Name", { values: { "weight kg": 0, value: 0 } });
  const datasets = {
    weapons: [item("weapon", "Same Name", { width: 10, height: 2 })],
    items: [duplicate, structuredClone(duplicate)],
    mapItems: [item("same", "Same Name")],
    nestItems: [item("conflict", "First"), item("conflict", "Second", { width: 2 })]
  };
  const projection = createEquipmentLockerProjection(datasets);
  const reversed = createEquipmentLockerProjection({
    ...datasets,
    weapons: [...datasets.weapons].reverse(),
    items: [...datasets.items].reverse(),
    mapItems: [...datasets.mapItems].reverse(),
    nestItems: [...datasets.nestItems].reverse()
  });

  assert.deepEqual(projection, reversed);
  assert.equal(projection.recordsByKey["item:same"].id, "same");
  assert.equal(projection.recordsByKey["mapItem:same"].id, "same");
  assert.equal(projection.recordsByKey["nestItem:conflict"], undefined);
  assert.deepEqual(projection.conflictingKeys, ["nestItem:conflict"]);
  assert.equal(
    projection.diagnostics.filter(({ code }) => code === "identical_duplicate").length,
    1
  );
  assert.equal(
    projection.diagnostics.filter(({ code }) => code === "conflicting_duplicate").length,
    1
  );
  assert.deepEqual(
    projection.itemRecords.map(({ key }) => key),
    ["item:same", "mapItem:same", "weapon:weapon"]
  );
});

test("Equipment projection preserves authored zeroes, missing values, facts, and safe footprints", () => {
  const invalid = item("invalid", "Invalid", {
    width: 0,
    height: "two",
    values: { "weight kg": 0, value: 0, description: "Authored description", custom: 0 },
    references: { ammunition: [reference("ammo", "Ammo", 0, 2, 0)] }
  });
  const missing = {
    StringId: "missing",
    Name: "Missing",
    Values: {},
    ReferenceCategories: {}
  };
  const projection = createEquipmentLockerProjection({ items: [invalid, missing] });
  const invalidNode = projection.recordsByKey["item:invalid"];
  const missingNode = projection.recordsByKey["item:missing"];

  assert.equal(invalidNode.weight, 0);
  assert.equal(projection.characterAvailable, false);
  assert.equal(invalidNode.value, 0);
  assert.equal(invalidNode.authored.values.custom, 0);
  assert.equal(invalidNode.description, "Authored description");
  assert.deepEqual(invalidNode.authored.referenceCategories.ammunition[0], {
    authoredIndex: 0,
    id: "ammo",
    name: "Ammo",
    value0: 0,
    value1: 2,
    value2: 0
  });
  assert.equal(invalidNode.footprint, null);
  assert.equal(invalidNode.storable, false);
  assert.equal(missingNode.weight, null);
  assert.equal(missingNode.footprint, null);
  assert.equal(missingNode.storable, false);
  assert.ok(missingNode.diagnostics.some(({ code }) => code === "invalid_footprint"));
  assert.ok(invalidNode.diagnostics.some(({ code }) => code === "invalid_footprint"));
  assert.throws(() => {
    invalidNode.authored.values.custom = 4;
  }, TypeError);
  assert.throws(() => {
    projection.itemRecords.pop();
  }, TypeError);
});

test("Equipment projection maps every supported authored slot conservatively", () => {
  const projection = createEquipmentLockerProjection({
    weapons: [
      item("short", "Short", { width: 7, height: 1 }),
      item("long", "Long", { width: 10, height: 2 })
    ],
    crossbows: [item("crossbow", "Crossbow", { width: 10, height: 2 })],
    armours: [
      item("head", "Head", { width: 4, height: 3, slot: 3 }),
      item("body", "Body", { width: 4, height: 6, slot: 5 }),
      item("pants", "Pants", { width: 4, height: 5, slot: 6 }),
      item("shirt", "Shirt", { width: 4, height: 2, slot: 8 }),
      item("boots", "Boots", { width: 4, height: 2, slot: 9 })
    ],
    bags: [item("bag", "Bag", { width: 5, height: 4, slot: 12 })],
    limbReplacements: [
      item("la", "Left Arm", { width: 2, height: 7, slot: 50 }),
      item("ra", "Right Arm", { width: 2, height: 7, slot: 51 }),
      item("ll", "Left Leg", { width: 2, height: 7, slot: 52 }),
      item("rl", "Right Leg", { width: 2, height: 7, slot: 53 })
    ],
    items: [item("lantern", "Lantern", { width: 2, height: 2, slot: 14 })]
  });
  const slots = (key) => projection.recordsByKey[key].compatibleSlotIds;

  assert.deepEqual(slots("weapon:short"), ["weapon1", "weapon2"]);
  assert.deepEqual(slots("weapon:long"), ["weapon1"]);
  assert.deepEqual(slots("crossbow:crossbow"), ["weapon1"]);
  assert.deepEqual(slots("armour:head"), ["head"]);
  assert.deepEqual(slots("armour:body"), ["armour"]);
  assert.deepEqual(slots("armour:pants"), ["pants"]);
  assert.deepEqual(slots("armour:shirt"), ["shirt"]);
  assert.deepEqual(slots("armour:boots"), ["boots"]);
  assert.deepEqual(slots("bag:bag"), ["backpack"]);
  assert.deepEqual(slots("limbReplacement:la"), ["leftArm"]);
  assert.deepEqual(slots("limbReplacement:ra"), ["rightArm"]);
  assert.deepEqual(slots("limbReplacement:ll"), ["leftLeg"]);
  assert.deepEqual(slots("limbReplacement:rl"), ["rightLeg"]);
  assert.deepEqual(slots("item:lantern"), ["belt"]);
  assert.equal(EQUIPMENT_LOCKER_SLOTS.length, 13);
  assert.equal(EQUIPMENT_LOCKER_STORAGE_COLUMNS, 24);
  assert.equal(EQUIPMENT_LOCKER_INITIAL_STORAGE_ROWS, 8);
});

test("Character templates group exact candidates without choosing a realized loadout", () => {
  const conflictingArmour = item("conflict", "Conflict One", { width: 4, height: 3, slot: 3 });
  const projection = createEquipmentLockerProjection({
    weapons: [item("blade", "Blade", { width: 7, height: 1 })],
    crossbows: [item("bow", "Bow", { width: 10, height: 2 })],
    armours: [
      item("hat-a", "Same Hat", { width: 4, height: 3, slot: 3 }),
      item("hat-b", "Same Hat", { width: 4, height: 3, slot: 3 }),
      item("odd", "Unsupported Clothing", { width: 4, height: 3, slot: 999 }),
      conflictingArmour,
      { ...structuredClone(conflictingArmour), Name: "Conflict Two" }
    ],
    bags: [item("pack", "Pack", { width: 5, height: 4, slot: 12 })],
    items: [item("medkit", "Medkit")],
    weaponManufacturers: [{ StringId: "maker", Name: "Maker", Values: {} }],
    characters: [
      character("person", "Person", {
        values: { "armour grade": 2, "armour upgrade chance": 0 },
        references: {
          clothing: [
            reference("hat-a", "Wrong authored label", 0, 1, 2),
            reference("hat-b"),
            reference("conflict"),
            reference("missing"),
            reference("odd")
          ],
          weapons: [reference("blade")],
          crossbows: [reference("bow")],
          backpack: [reference("pack")],
          inventory: [reference("medkit", "Medkit", 0, 3, 0)],
          "weapon level": [reference("maker")]
        }
      })
    ]
  });
  const person = projection.recordsByKey["character:person"];
  const head = person.loadout.slotGroups.find(({ key }) => key === "head");
  const weapon1 = person.loadout.slotGroups.find(({ key }) => key === "weapon1");
  const weapon2 = person.loadout.slotGroups.find(({ key }) => key === "weapon2");

  assert.equal(head.competing, true);
  assert.deepEqual(
    head.candidates.map(({ targetKey }) => targetKey),
    ["armour:hat-a", "armour:hat-b"]
  );
  assert.deepEqual(
    weapon1.candidates.map(({ targetKey }) => targetKey),
    ["weapon:blade", "crossbow:bow"]
  );
  assert.deepEqual(
    weapon2.candidates.map(({ targetKey }) => targetKey),
    ["weapon:blade"]
  );
  assert.equal(person.loadout.inventory[0].targetKey, "item:medkit");
  assert.equal(person.loadout.inventory[0].value1, 3);
  assert.equal(person.loadout.weaponManufacturers[0].targetKey, "weaponManufacturer:maker");
  assert.deepEqual(
    person.loadout.unresolved.map(({ status, targetKey }) => [status, targetKey]),
    [
      ["conflicting", "armour:conflict"],
      ["unresolved", "armour:missing"],
      ["incompatible", "armour:odd"]
    ]
  );
  assert.ok(person.diagnostics.some(({ code }) => code === "character_conflicting_reference"));
  assert.ok(person.diagnostics.some(({ code }) => code === "character_unresolved_reference"));
  assert.ok(person.diagnostics.some(({ code }) => code === "character_incompatible_reference"));
  assert.equal(person.authored.values["armour upgrade chance"], 0);
  assert.equal(person.loadout.hasEvidence, true);
  assert.equal(projection.characterAvailable, true);
  assert.throws(() => {
    head.candidates.push({});
  }, TypeError);
});

test("Projection retains record-local diagnostics for malformed values and authored facts", () => {
  const malformedItem = item("malformed", "Malformed", {
    values: { REMOVED: "yes", "weight kg": "heavy", value: Number.POSITIVE_INFINITY }
  });
  const projection = createEquipmentLockerProjection({
    items: [malformedItem],
    weaponManufacturers: [{ StringId: "maker", Name: "Maker", Values: "invalid" }]
  });
  const record = projection.recordsByKey["item:malformed"];
  const manufacturer = projection.recordsByKey["weaponManufacturer:maker"];

  assert.equal(record.removed, false);
  assert.equal(record.weight, null);
  assert.equal(record.value, null);
  assert.ok(record.diagnostics.some(({ code }) => code === "invalid_removed_flag"));
  assert.equal(
    record.diagnostics.filter(({ code }) => code === "invalid_authored_number").length,
    2
  );
  assert.ok(manufacturer.diagnostics.some(({ code }) => code === "malformed_values"));
});

test("Locker view filters removed records and queries before presenting truthful counts", () => {
  const projection = createEquipmentLockerProjection({
    weapons: [
      item("visible", "Visible Blade", { width: 7, height: 1 }),
      item("removed", "Removed Blade", { width: 7, height: 1, removed: true })
    ],
    items: [item("kit", "Visible Kit")],
    characters: [
      character("person", "Visible Person"),
      character("old", "Removed Person", { removed: true })
    ]
  });
  const defaultView = createEquipmentLockerView(projection, {
    queries: { items: "blade", characters: "person" },
    openCategoryKeys: { items: [], characters: [] }
  });

  assert.deepEqual(defaultView.itemCategories, [
    {
      key: "weapons",
      label: "Weapons",
      recordKeys: ["weapon:visible"],
      count: 1,
      totalCount: 1,
      open: true
    }
  ]);
  assert.deepEqual(defaultView.visibleCharacterKeys, ["character:person"]);
  const allView = createEquipmentLockerView(projection, {
    activeTab: "characters",
    showRemoved: true,
    queries: { items: "blade", characters: "person" }
  });
  assert.equal(allView.activeTab, "characters");
  assert.deepEqual(allView.itemCategories[0].recordKeys, ["weapon:removed", "weapon:visible"]);
  assert.deepEqual(allView.visibleCharacterKeys, ["character:old", "character:person"]);
  assert.throws(() => defaultView.itemCategories.pop(), TypeError);
  assert.deepEqual(
    EQUIPMENT_LOCKER_ITEM_CATEGORIES.map(({ key }) => key),
    [
      "weapons",
      "crossbows",
      "armours",
      "bags",
      "limbReplacements",
      "items",
      "mapItems",
      "nestItems"
    ]
  );
});

test("Locker session retains independent catalog state with immutable no-op snapshots", () => {
  const projection = basicProjection({
    weapons: [
      item("blade", "Blade", { width: 7, height: 1 }),
      item("old", "Old", { width: 7, height: 1, removed: true })
    ],
    characters: [character("person", "Person")]
  });
  const session = new EquipmentLockerPresentationSession({ projection });
  const events = [];
  session.subscribe((event) => events.push(event.type));
  session.subscribe(() => {
    throw new Error("observer failures are isolated");
  });
  const initial = session.getSnapshot();

  assert.equal(session.setActiveTab("items"), false);
  assert.equal(session.setQuery("items", ""), false);
  assert.equal(session.setShowRemoved(false), false);
  assert.equal(session.setCategoryOpen("items", "weapons", true), false);
  assert.strictEqual(session.getSnapshot(), initial);
  session.setQuery("items", "blade");
  session.setQuery("characters", "person");
  session.setCatalogScrollTop("items", 42);
  session.setCatalogFocusIdentity("items", "record:weapon:blade");
  session.setActiveTab("characters");
  session.selectCatalogRecord("character:person");
  assert.deepEqual(events, [
    "setQuery",
    "setQuery",
    "setCatalogScrollTop",
    "setCatalogFocusIdentity",
    "setActiveTab",
    "selectCatalogRecord"
  ]);
  assert.deepEqual(session.getSnapshot().queries, { items: "blade", characters: "person" });
  assert.equal(session.getSnapshot().catalogScrollTop.items, 42);
  assert.throws(() => {
    session.getSnapshot().queries.items = "changed";
  }, TypeError);

  session.setShowRemoved(true);
  session.selectCatalogRecord("weapon:old");
  session.setShowRemoved(false);
  assert.equal(session.getSnapshot().selection, null);
  assert.throws(() => session.selectCatalogRecord("weapon:old"), /hidden/);
  assert.throws(() => session.setActiveTab("unknown"), /Unknown/);
  assert.throws(() => session.setQuery("items", null), /must be a string/);
  assert.throws(() => session.setCatalogScrollTop("items", -1), /nonnegative/);
});

test("Storage disclosure state is retained, immutable, and no-op aware", () => {
  const session = new EquipmentLockerPresentationSession({ projection: basicProjection() });
  const initial = session.getSnapshot();

  assert.equal(initial.storageExpanded, false);
  assert.equal(session.setStorageExpanded(false), false);
  assert.strictEqual(session.getSnapshot(), initial);

  const expanded = session.setStorageExpanded(true);
  assert.equal(expanded.type, "setStorageExpanded");
  assert.deepEqual(expanded.detail, { expanded: true });
  assert.equal(expanded.snapshot.storageExpanded, true);
  assert.equal(session.setStorageExpanded(true), false);
  session.setQuery("items", "kit");
  assert.equal(session.getSnapshot().storageExpanded, true);
  assert.throws(() => {
    expanded.snapshot.storageExpanded = false;
  }, TypeError);
  assert.throws(() => session.setStorageExpanded("true"), /must be boolean/);
});

test("Storage actions reveal the tray atomically while replacements preserve its state", () => {
  const projection = basicProjection();
  const session = new EquipmentLockerPresentationSession({ projection });
  const events = [];
  session.subscribe(({ type }) => events.push(type));

  session.equipCatalogRecord("weapon:blade", "weapon1");
  session.equipCatalogRecord("weapon:blade", "weapon1");
  assert.equal(session.getSnapshot().storageExpanded, false);
  assert.deepEqual(events, ["equipCatalogRecord", "equipCatalogRecord"]);

  session.setStorageExpanded(true);
  session.equipCatalogRecord("weapon:blade", "weapon1");
  assert.equal(session.getSnapshot().storageExpanded, true);

  session.setStorageExpanded(false);
  events.length = 0;
  const added = session.addToStorage("item:kit");
  assert.deepEqual(events, ["addToStorage"]);
  assert.equal(added.snapshot.storageExpanded, true);
  assert.equal(added.snapshot.rovingStorageOccurrenceId, added.detail.occurrenceId);

  const equipped = session.equipCatalogRecord("armour:coat").detail.occurrenceId;
  session.setStorageExpanded(false);
  events.length = 0;
  const moved = session.moveOccurrenceToStorage(equipped);
  assert.deepEqual(events, ["moveOccurrenceToStorage"]);
  assert.equal(moved.snapshot.storageExpanded, true);
  assert.equal(moved.snapshot.rovingStorageOccurrenceId, equipped);

  session.requestClear();
  const cleared = session.confirmClear();
  assert.equal(cleared.snapshot.storageExpanded, false);
  session.setStorageExpanded(true);
  const reset = session.reset();
  assert.equal(reset.snapshot.storageExpanded, false);
});

test("Storage packing is deterministic, reuses holes, grows in four-row bands, and never rotates", () => {
  const projection = createEquipmentLockerProjection({
    items: [
      item("small", "Small", { width: 2, height: 2 }),
      item("wide", "Wide", { width: 12, height: 8 })
    ]
  });
  const session = new EquipmentLockerPresentationSession({ projection });
  const first = session.addToStorage("item:small").detail.occurrenceId;
  const second = session.addToStorage("item:small").detail.occurrenceId;
  assert.deepEqual(session.getSnapshot().storage.placements, [
    { occurrenceId: first, x: 0, y: 0, width: 2, height: 2 },
    { occurrenceId: second, x: 2, y: 0, width: 2, height: 2 }
  ]);
  session.removeOccurrence(first);
  const reused = session.addToStorage("item:small").detail.occurrenceId;
  assert.deepEqual(
    session.getSnapshot().storage.placements.find(({ occurrenceId }) => occurrenceId === reused),
    { occurrenceId: reused, x: 0, y: 0, width: 2, height: 2 }
  );

  const expansion = new EquipmentLockerPresentationSession({ projection });
  expansion.addToStorage("item:wide");
  expansion.addToStorage("item:wide");
  const third = expansion.addToStorage("item:wide").detail.occurrenceId;
  assert.deepEqual(
    expansion.getSnapshot().storage.placements.find(({ occurrenceId }) => occurrenceId === third),
    { occurrenceId: third, x: 0, y: 8, width: 12, height: 8 }
  );
  assert.equal(expansion.getSnapshot().storage.rows, 16);
  assert.equal(expansion.getSnapshot().storage.columns, 24);
});

test("Equipping chooses empty targets and losslessly moves replacements into Storage", () => {
  const projection = createEquipmentLockerProjection({
    weapons: [
      item("first", "First", { width: 7, height: 1 }),
      item("second", "Second", { width: 7, height: 1 }),
      item("third", "Third", { width: 7, height: 1 })
    ],
    crossbows: [item("bow", "Bow", { width: 10, height: 2 })]
  });
  const session = new EquipmentLockerPresentationSession({ projection });
  assert.equal(session.resolveDefaultSlot("weapon:first"), "weapon1");
  const first = session.equipCatalogRecord("weapon:first").detail.occurrenceId;
  assert.equal(session.resolveDefaultSlot("weapon:second"), "weapon2");
  const second = session.equipCatalogRecord("weapon:second").detail.occurrenceId;
  assert.equal(session.resolveDefaultSlot("weapon:third"), "weapon1");
  const thirdEvent = session.equipCatalogRecord("weapon:third");
  const third = thirdEvent.detail.occurrenceId;

  assert.equal(thirdEvent.detail.displacedOccurrenceId, first);
  assert.equal(session.getSnapshot().equipment.weapon1, third);
  assert.equal(session.getSnapshot().equipment.weapon2, second);
  assert.equal(session.getSnapshot().storage.placements[0].occurrenceId, first);
  assert.match(session.getSnapshot().status.message, /replaced item moved to Storage/);
  assert.equal(session.resolveDefaultSlot("crossbow:bow"), "weapon1");

  const moveEvent = session.equipOccurrence(first, "weapon2");
  assert.equal(moveEvent.detail.displacedOccurrenceId, second);
  assert.equal(session.getSnapshot().equipment.weapon2, first);
  assert.equal(session.getSnapshot().storage.placements[0].occurrenceId, second);
  assert.equal(session.equipOccurrence(first, "weapon2"), false);
  assert.throws(() => session.equipCatalogRecord("crossbow:bow", "weapon2"), /not compatible/);
});

test("Locker occurrence movement, removal, Clear confirmation, and reset remain atomic", () => {
  const projection = basicProjection();
  const session = new EquipmentLockerPresentationSession({ projection });
  assert.equal(session.reset(), false);
  const occurrenceId = session.equipCatalogRecord("armour:coat").detail.occurrenceId;
  session.moveOccurrenceToStorage(occurrenceId);
  assert.equal(session.getSnapshot().equipment.armour, null);
  assert.equal(session.getSnapshot().storage.placements[0].occurrenceId, occurrenceId);
  assert.equal(session.moveOccurrenceToStorage(occurrenceId), false);
  session.selectOccurrence(occurrenceId);
  session.setRovingStorageOccurrenceId(occurrenceId);
  session.removeOccurrence(occurrenceId);
  assert.deepEqual(session.getSnapshot().occurrences, []);
  assert.equal(session.getSnapshot().selection, null);
  assert.equal(session.getSnapshot().rovingStorageOccurrenceId, null);

  session.addToStorage("item:kit");
  assert.equal(session.requestClear().type, "requestClear");
  assert.equal(session.requestClear(), false);
  assert.equal(session.cancelClear().type, "cancelClear");
  assert.equal(session.cancelClear(), false);
  session.requestClear();
  assert.equal(session.confirmClear().type, "confirmClear");
  assert.deepEqual(session.getSnapshot().occurrences, []);
  assert.equal(session.getSnapshot().storage.rows, 8);
  assert.equal(session.getSnapshot().status.message, "Equipment Locker cleared.");
  assert.equal(session.confirmClear(), false);

  session.setQuery("items", "kit");
  assert.equal(session.reset().type, "reset");
  assert.equal(session.getSnapshot().queries.items, "");
  assert.equal(session.getSnapshot().status, null);
  assert.throws(() => new EquipmentLockerPresentationSession(), /requires a Locker projection/);
});

test("Locker validation feedback is retained, immutable, and no-op aware", () => {
  const projection = createEquipmentLockerProjection({
    items: [item("first-aid", "First Aid", { width: 2, height: 2 })]
  });
  const session = new EquipmentLockerPresentationSession({ projection });

  const event = session.reportValidation("Footprint is unavailable.");
  assert.equal(event.snapshot.status.tone, "danger");
  assert.equal(event.snapshot.status.message, "Footprint is unavailable.");
  assert.equal(session.reportValidation("Footprint is unavailable."), false);
  assert.throws(() => session.reportValidation(""), /nonempty text/u);
  assert.equal(Object.isFrozen(event.snapshot.status), true);
});
