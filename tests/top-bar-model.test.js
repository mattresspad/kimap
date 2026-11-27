import assert from "node:assert/strict";
import test from "node:test";

import {
  SEARCH_RESULT_LIMIT,
  THEATER_DESTINATION_GROUPS,
  THEATER_DESTINATIONS,
  createSearchActivationRoute,
  createSearchRecords,
  getTheaterDestination,
  getTheaterDestinationAvailability,
  getThemeTogglePresentation,
  getSearchRecordKey,
  normalizeTheme,
  persistTheme,
  readAndMigrateTheme,
  searchRecords
} from "../modules/top-bar/index.js";
import {
  SEARCH_FILTER_GROUPS,
  createSearchFilterSelection,
  filterSearchRecords,
  setSearchFilterGroupEnabled
} from "../modules/top-bar/model.js";

test("the top bar registry defines fourteen immutable, uniquely identified destinations", () => {
  assert.equal(THEATER_DESTINATIONS.length, 14);
  assert.equal(new Set(THEATER_DESTINATIONS.map(({ id }) => id)).size, 14);
  assert.deepEqual(
    THEATER_DESTINATIONS.map(({ id }) => id),
    [
      "status",
      "history",
      "ranks",
      "infamy",
      "overrides",
      "environment",
      "settings",
      "browser",
      "equipment",
      "research",
      "prefs",
      "markers",
      "paint",
      "help"
    ]
  );
  assert.deepEqual(Object.fromEntries(THEATER_DESTINATIONS.map(({ id, label }) => [id, label])), {
    status: "Global Status",
    history: "World History",
    ranks: "Faction Power Ranks",
    infamy: "Infamy Tracking",
    overrides: "Override Network",
    environment: "Environment Info",
    settings: "Global Constants",
    browser: "Content Browser",
    equipment: "Equipment Locker",
    research: "Research Tree",
    prefs: "Scenario Documents",
    markers: "Player Markers",
    paint: "Paint Manager",
    help: "Help Guide"
  });
  assert.equal(Object.isFrozen(THEATER_DESTINATIONS), true);
  assert.equal(THEATER_DESTINATIONS.every(Object.isFrozen), true);
  assert.throws(() => THEATER_DESTINATIONS.push({}), TypeError);
  assert.deepEqual(THEATER_DESTINATION_GROUPS, [
    { id: "simulation", label: "Simulation", order: 0 },
    { id: "reference", label: "Reference", order: 1 },
    { id: "workspace", label: "Workspace", order: 2 },
    { id: "utility", label: "Utility", order: 3 }
  ]);
  assert.deepEqual(
    THEATER_DESTINATIONS.map(({ group, order, availabilityPolicy }) => ({
      group,
      order,
      availabilityPolicy
    })),
    [
      ...Array.from({ length: 5 }, (_, order) => ({
        group: "simulation",
        order,
        availabilityPolicy: "scenario"
      })),
      ...Array.from({ length: 5 }, (_, order) => ({
        group: "reference",
        order,
        availabilityPolicy: "always"
      })),
      { group: "workspace", order: 0, availabilityPolicy: "scenario" },
      { group: "workspace", order: 1, availabilityPolicy: "always" },
      { group: "workspace", order: 2, availabilityPolicy: "always" },
      { group: "utility", order: 0, availabilityPolicy: "always" }
    ]
  );
  assert.equal(
    THEATER_DESTINATIONS.every(({ icon }) => icon.trim() !== ""),
    true
  );
  assert.equal(getTheaterDestination("prefs").label, "Scenario Documents");
  assert.equal(getTheaterDestination("missing"), null);
});

test("destination availability follows scenario and always policies", () => {
  assert.deepEqual(getTheaterDestinationAvailability("status"), {
    available: false,
    reason: "Simulation is unavailable because scenario normalization did not complete."
  });
  assert.deepEqual(getTheaterDestinationAvailability("status", { scenarioAvailable: true }), {
    available: true,
    reason: null
  });
  assert.deepEqual(getTheaterDestinationAvailability("prefs"), {
    available: false,
    reason: "Simulation is unavailable because scenario normalization did not complete."
  });
  assert.deepEqual(getTheaterDestinationAvailability("prefs", { scenarioAvailable: true }), {
    available: true,
    reason: null
  });
  assert.deepEqual(getTheaterDestinationAvailability("help"), {
    available: true,
    reason: null
  });
  assert.equal(Object.isFrozen(getTheaterDestinationAvailability("missing")), true);
});

test("theme normalization accepts only the persisted dark and light values", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("light"), "light");
  for (const value of [undefined, null, "", "Light", " light ", "desert", "pico", {}]) {
    assert.equal(normalizeTheme(value), "dark");
  }
});

test("theme toggle presentation consistently describes its next action", () => {
  assert.deepEqual(getThemeTogglePresentation("dark"), {
    theme: "dark",
    nextTheme: "light",
    icon: "sun",
    label: "Switch to light theme",
    title: "Switch to light theme",
    ariaLabel: "Switch to light theme"
  });
  assert.deepEqual(getThemeTogglePresentation("light"), {
    theme: "light",
    nextTheme: "dark",
    icon: "moon",
    label: "Switch to dark theme",
    title: "Switch to dark theme",
    ariaLabel: "Switch to dark theme"
  });
  assert.equal(Object.isFrozen(getThemeTogglePresentation("pico")), true);
});

test("theme storage migrates legacy values and degrades safely when storage fails", () => {
  const values = new Map([["kim-theme", "desert"]]);
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
  assert.equal(readAndMigrateTheme(storage), "dark");
  assert.equal(values.get("kim-theme"), "dark");
  assert.equal(persistTheme(storage, "light"), "light");
  assert.equal(values.get("kim-theme"), "light");
  assert.equal(persistTheme(storage, "pico"), "dark");
  assert.equal(values.get("kim-theme"), "dark");

  const failedStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    }
  };
  assert.equal(readAndMigrateTheme(failedStorage), "dark");
  assert.equal(persistTheme(failedStorage, "light"), "light");
});

test("Quick Search defines seven immutable user-facing filter groups", () => {
  assert.deepEqual(SEARCH_FILTER_GROUPS, [
    { id: "towns", label: "Towns", kinds: ["town"] },
    { id: "spawn-areas", label: "Spawn Areas", kinds: ["spawnArea"] },
    {
      id: "characters-animals",
      label: "Characters & Animals",
      kinds: ["character"]
    },
    { id: "squads", label: "Squads", kinds: ["squad"] },
    { id: "factions", label: "Factions", kinds: ["faction"] },
    { id: "nests", label: "Nests", kinds: ["nest"] },
    {
      id: "items-equipment",
      label: "Items & Equipment",
      kinds: ["item", "weapon", "crossbow", "armour", "mapItem", "nestItem"]
    }
  ]);
  assert.equal(Object.isFrozen(SEARCH_FILTER_GROUPS), true);
  assert.equal(SEARCH_FILTER_GROUPS.every(Object.isFrozen), true);
  assert.equal(
    SEARCH_FILTER_GROUPS.every(({ kinds }) => Object.isFrozen(kinds)),
    true
  );
  assert.throws(() => SEARCH_FILTER_GROUPS[0].kinds.push("faction"), TypeError);
});

test("search filter selections default on, retain independently, and reset with a new selection", () => {
  const defaults = createSearchFilterSelection();
  assert.deepEqual(
    defaults,
    SEARCH_FILTER_GROUPS.map(({ id }) => id)
  );
  assert.equal(Object.isFrozen(defaults), true);

  const withoutTowns = setSearchFilterGroupEnabled(defaults, "towns", false);
  const itemsOnly = createSearchFilterSelection(["items-equipment"]);
  assert.equal(withoutTowns.includes("towns"), false);
  assert.deepEqual(itemsOnly, ["items-equipment"]);
  assert.deepEqual(createSearchFilterSelection(), defaults, "a new controller selection resets");
  assert.deepEqual(createSearchFilterSelection([]), [], "all groups may be disabled");
});

test("search records normalize database shapes and retain composite identities", () => {
  const databases = {
    town: {
      alpha: { StringId: "shared", Name: "Alpha" },
      invalid: { StringId: "missing-name" }
    },
    faction: [
      { entityId: "shared", name: "Alpha" },
      { id: " faction-two ", name: " Second Faction " }
    ],
    character: new Map([["character", { StringId: "char", Name: "Character" }]])
  };
  const records = createSearchRecords(databases);

  assert.deepEqual(records, [
    { kind: "faction", id: "shared", name: "Alpha" },
    { kind: "town", id: "shared", name: "Alpha" },
    { kind: "character", id: "char", name: "Character" },
    {
      kind: "faction",
      id: "faction-two",
      name: "Second Faction"
    }
  ]);
  assert.equal(Object.isFrozen(records), true);
  assert.equal(records.every(Object.isFrozen), true);
  assert.throws(() => (records[0].name = "Changed"), TypeError);
});

test("duplicate composite identities collapse deterministically without collapsing name collisions", () => {
  const first = createSearchRecords({
    town: [
      { StringId: "same", Name: "Zulu" },
      { StringId: "same", Name: "Alpha" }
    ],
    faction: [{ StringId: "same", Name: "Alpha" }]
  });
  const second = createSearchRecords({
    faction: [{ StringId: "same", Name: "Alpha" }],
    town: [
      { StringId: "same", Name: "Alpha" },
      { StringId: "same", Name: "Zulu" }
    ]
  });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((record) => [getSearchRecordKey(record), record.name]),
    [
      ["faction:same", "Alpha"],
      ["town:same", "Alpha"]
    ]
  );
});

test("search ranks exact, name prefix, name substring, then stable-ID substring matches", () => {
  const records = createSearchRecords({
    town: [
      { StringId: "town-id", Name: "Hub" },
      { StringId: "prefix", Name: "Hub South" },
      { StringId: "substring", Name: "The Hub" },
      { StringId: "north-hub", Name: "Outpost" }
    ],
    faction: [{ StringId: "HUB", Name: "Other" }]
  });

  assert.deepEqual(searchRecords(records, "  hUb  ").map(getSearchRecordKey), [
    "town:town-id",
    "faction:HUB",
    "town:prefix",
    "town:substring",
    "town:north-hub"
  ]);
});

test("search ordering is deterministic across equal names, kinds, and IDs", () => {
  const records = createSearchRecords({
    town: [
      { StringId: "beta", Name: "Collision" },
      { StringId: "alpha", Name: "Collision" }
    ],
    character: [{ StringId: "same", Name: "Collision" }],
    faction: [{ StringId: "same", Name: "Collision" }]
  });

  assert.deepEqual(searchRecords(records, "collision").map(getSearchRecordKey), [
    "character:same",
    "faction:same",
    "town:alpha",
    "town:beta"
  ]);
});

test("search enforces its fifteen-result cap and returns immutable empty results", () => {
  const records = createSearchRecords({
    item: Array.from({ length: 20 }, (_, index) => ({
      StringId: `item-${String(index).padStart(2, "0")}`,
      Name: `Match ${String(index).padStart(2, "0")}`
    }))
  });

  assert.equal(searchRecords(records, "match").length, SEARCH_RESULT_LIMIT);
  assert.equal(searchRecords(records, "match", 4).length, 4);
  assert.equal(searchRecords(records, "match", 100).length, SEARCH_RESULT_LIMIT);
  assert.deepEqual(searchRecords(records, ""), []);
  assert.deepEqual(searchRecords(records, null), []);
  assert.deepEqual(searchRecords(records, "match", 0), []);
  assert.equal(Object.isFrozen(searchRecords(records, "")), true);
});

test("search filters complete logical families before ranking and result limiting", () => {
  const records = createSearchRecords({
    town: Array.from({ length: 20 }, (_, index) => ({
      StringId: `town-${String(index).padStart(2, "0")}`,
      Name: `Match Town ${String(index).padStart(2, "0")}`
    })),
    item: [{ StringId: "item-a", Name: "Match Item" }],
    weapon: [{ StringId: "weapon-a", Name: "Match Weapon" }],
    character: [{ StringId: "character-a", Name: "Match Character" }]
  });

  const itemRecords = filterSearchRecords(records, ["items-equipment"]);
  assert.deepEqual(searchRecords(itemRecords, "match").map(getSearchRecordKey), [
    "item:item-a",
    "weapon:weapon-a"
  ]);
  assert.deepEqual(filterSearchRecords(records, []), []);
  assert.equal(Object.isFrozen(itemRecords), true);
  assert.equal(Object.isFrozen(filterSearchRecords(records, [])), true);
});

test("search activation routes geographic and reference records canonically", () => {
  assert.deepEqual(createSearchActivationRoute({ kind: "town", id: "town-a" }), {
    route: "geographic",
    entityType: "town",
    entityId: "town-a",
    instanceId: null
  });
  assert.deepEqual(createSearchActivationRoute({ kind: "spawnArea", id: "area-a" }), {
    route: "geographic",
    entityType: "spawnArea",
    entityId: "area-a",
    instanceId: null
  });
  for (const kind of [
    "character",
    "squad",
    "faction",
    "nest",
    "item",
    "weapon",
    "crossbow",
    "armour",
    "mapItem",
    "nestItem"
  ]) {
    assert.deepEqual(createSearchActivationRoute({ kind, id: "shared" }), {
      route: "reference",
      entityType: kind,
      entityId: "shared"
    });
  }
  assert.equal(createSearchActivationRoute({ kind: "theater", id: "help" }), null);
  assert.equal(createSearchActivationRoute({ kind: "town", id: "" }), null);
  assert.equal(Object.isFrozen(createSearchActivationRoute({ kind: "faction", id: "a" })), true);
});
