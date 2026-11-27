import { leafletToKenshi } from "../../modules/selection/map-space.js";

export const COLORS = Object.freeze({
  core: 0x000000,
  easternNone: 0x00ff00,
  shared: 0xff0000,
  unknown: 0x0000ff,
  absent: 0xffff00
});

function colorBytes(index) {
  return [(index >> 16) & 0xff, (index >> 8) & 0xff, index & 0xff, 255];
}

/** Creates decoder-shaped bottom-up RGBA data from logical top-down color rows. */
export function rasterFromRows(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = colorBytes(rows[y][x]);
      const offset = ((height - 1 - y) * width + x) * 4;
      data.set(source, offset);
    }
  }
  return { width, height, data };
}

export function coordinateForPixel(x, y, width = 4, height = 2) {
  return leafletToKenshi({
    lng: ((x + 0.5) / width) * 8192,
    lat: (1 - (y + 0.5) / height) * 8192
  });
}

function reference(StringId, Value0 = 1, Value1 = 0, Name = StringId) {
  return { StringId, Name, Value0, Value1, Value2: 0 };
}

function rawRecord(StringId, Name, Values = {}, ReferenceCategories = {}) {
  return { StringId, Name, Values, ReferenceCategories, Referrers: [] };
}

function faction(id, name, notReal = false) {
  return {
    id,
    name,
    raw: rawRecord(id, name, { "not real": notReal }, {})
  };
}

function town(id, name, ownerId, residents = [], values = {}) {
  return {
    id,
    name,
    ownerId,
    raw: rawRecord(id, name, values, {
      faction: ownerId ? [reference(ownerId)] : [],
      residents
    })
  };
}

function squad(id, name, categories) {
  return { id, name, raw: rawRecord(id, name, {}, categories) };
}

function area(id, name, color, occurrences, references, values = {}) {
  return {
    id,
    name,
    occurrences,
    raw: rawRecord(id, name, { index: color, ...values }, references)
  };
}

export function createPoliticalFixture() {
  const raster = rasterFromRows([
    [COLORS.shared, COLORS.core, COLORS.easternNone, COLORS.shared],
    [COLORS.shared, COLORS.core, COLORS.easternNone, COLORS.unknown]
  ]);
  const factions = [
    faction("faction-a", "Faction A"),
    faction("faction-b", "Faction B"),
    faction("tenant", "Tenant Faction"),
    faction("hidden", "Hidden Evidence", true)
  ];
  const residentSquad = squad("resident-squad", "Resident Squad", {
    leader: [reference("character-a", 0, 0)],
    faction: [reference("tenant")]
  });
  const emptySquad = squad("empty-squad", "Empty Squad", { faction: [reference("tenant")] });
  const homeless = squad("homeless", "Homeless Squad", {
    squad: [reference("character-b", 2, 4)],
    faction: [reference("faction-b")]
  });
  const hidden = squad("hidden-squad", "Hidden Squad", {
    leader: [reference("character-c")],
    faction: [reference("hidden")]
  });
  const unattributed = squad("unattributed", "Unattributed Squad", {
    leader: [reference("character-d")],
    faction: [reference("faction-a"), reference("faction-b")]
  });
  const towns = [
    town("town-base", "Base Town", "faction-a", [
      reference("resident-squad", 2, 8),
      reference("empty-squad", 9, 9)
    ]),
    town("town-override", "Empty Override", "faction-b", []),
    town("town-ruin", "Populated Ruin", "faction-a", [reference("resident-squad", 0)], {
      type: 4
    }),
    town("nest-town", "Nest Town", "faction-b", [])
  ];
  const townById = Object.fromEntries(towns.map((entry) => [entry.id, entry]));
  const squads = [residentSquad, emptySquad, homeless, hidden, unattributed];
  const squadById = Object.fromEntries(squads.map((entry) => [entry.id, entry]));
  const spawnAreas = [
    area(
      "area-a",
      "Area A",
      COLORS.shared,
      [
        {
          entityId: "homeless",
          name: "Homeless Squad",
          type: "Squad",
          occurrenceId: "area-a:Squad:homeless"
        },
        {
          entityId: "unattributed",
          name: "Unattributed Squad",
          type: "Squad",
          occurrenceId: "area-a:Squad:unattributed"
        },
        {
          entityId: "nest-town",
          name: "Nest Town",
          type: "Nest",
          occurrenceId: "area-a:Nest:nest-town"
        }
      ],
      {
        "homeless spawns": [reference("homeless", 3), reference("unattributed", 1)],
        nests: [reference("nest-town", 2)]
      },
      { "homeless spawn amount": 4, "num nests": 5 }
    ),
    area(
      "area-b",
      "Area B",
      COLORS.shared,
      [
        {
          entityId: "hidden-squad",
          name: "Hidden Squad",
          type: "Squad",
          occurrenceId: "area-b:Squad:hidden-squad"
        }
      ],
      { "homeless spawns": [reference("hidden-squad", 2)] },
      { "homeless spawn amount": 2, "num nests": 0 }
    ),
    area(
      "18003-gamedata.base",
      "NONE",
      COLORS.core,
      [],
      {},
      {
        "homeless spawn amount": 0,
        "num nests": 0
      }
    ),
    area(
      "56123-rebirth.mod",
      "NONE",
      COLORS.easternNone,
      [],
      {},
      { "homeless spawn amount": 0, "num nests": 0 }
    ),
    area(
      "area-no-pixels",
      "No Pixels",
      COLORS.absent,
      [],
      {},
      {
        "homeless spawn amount": 0,
        "num nests": 0
      }
    )
  ];
  const mapLocations = [
    {
      instanceId: "town-occurrence-a",
      targetId: "town-base",
      name: "Base marker A",
      raw: { X: coordinateForPixel(0, 0).x, Z: coordinateForPixel(0, 0).z }
    },
    {
      instanceId: "town-occurrence-b",
      targetId: "town-base",
      name: "Base marker B",
      raw: { X: coordinateForPixel(3, 0).x, Z: coordinateForPixel(3, 0).z }
    },
    {
      instanceId: "town-occurrence-ruin",
      targetId: "town-ruin",
      name: "Ruin marker",
      raw: { X: coordinateForPixel(0, 1).x, Z: coordinateForPixel(0, 1).z }
    },
    {
      instanceId: "town-occurrence-core",
      targetId: "town-base",
      name: "Core marker",
      raw: { X: coordinateForPixel(1, 0).x, Z: coordinateForPixel(1, 0).z }
    },
    {
      instanceId: "town-occurrence-unmapped",
      targetId: "town-base",
      name: "Unmapped marker",
      raw: { X: Number.NaN, Z: 0 }
    }
  ];
  const baseline = {
    manifestId: "political-fixture",
    factions,
    towns,
    townById,
    squads,
    squadById,
    spawnAreas,
    mapLocations
  };
  const snapshot = {
    world: {
      towns: {
        "town-base": {
          activeTownId: "town-base",
          name: "Base Town",
          ownerId: "faction-a",
          owner: "Faction A"
        },
        "town-ruin": {
          activeTownId: "town-ruin",
          name: "Populated Ruin",
          ownerId: "faction-a",
          owner: "Faction A"
        }
      },
      spawns: {
        "area-a": {
          entries: {
            "area-a:Squad:homeless": { status: "Default" },
            "area-a:Squad:unattributed": { status: "Active" },
            "area-a:Nest:nest-town": { status: "Potential" }
          }
        },
        "area-b": {
          entries: { "area-b:Squad:hidden-squad": { status: "Distant" } }
        },
        "18003-gamedata.base": { entries: {} },
        "56123-rebirth.mod": { entries: {} },
        "area-no-pixels": { entries: {} }
      }
    }
  };
  return { raster, baseline, snapshot };
}

export function createReplacedFactionIdProjection() {
  return {
    available: true,
    reason: null,
    manifestId: "replaced-id-fixture",
    factions: [
      { id: "old-shell", name: "Shared Display Name", notReal: false, paletteIds: [] },
      { id: "new-shell", name: "Shared Display Name", notReal: false, paletteIds: [] }
    ],
    geometries: [
      {
        key: "1,2,3",
        areaIds: ["area"],
        cellCount: 10,
        excluded: false,
        indeterminate: false,
        records: [
          {
            id: "town:one",
            areaId: "",
            geometryKey: "1,2,3",
            kind: "town",
            state: "current",
            factionId: "old-shell",
            exclusionReason: null,
            metrics: {
              inhabitedOccurrences: { valid: true, value: 1 },
              residentReferences: { valid: true, value: 1 },
              residentPlacements: { valid: true, value: 1 }
            }
          }
        ]
      }
    ],
    towns: [],
    homelessSpawns: [],
    nests: [],
    unattributed: [],
    conditional: [],
    excluded: [],
    diagnostics: []
  };
}
