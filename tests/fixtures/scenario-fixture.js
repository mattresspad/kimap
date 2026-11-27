const PLAYER_FACTION_ID = "204-gamedata.base";

export function reference(StringId, Value0, Name = StringId) {
  return { Name, StringId, Value0, Value1: 0, Value2: 0 };
}

export function worldState(
  StringId,
  ReferenceCategories,
  { Name = StringId, playerInvolvement = false } = {}
) {
  return {
    Name,
    StringId,
    Values: { notes: "", "player involvement": playerInvolvement },
    ReferenceCategories,
    Referrers: []
  };
}

export function faction(StringId, Name, enemyThreshold = -10, relations = []) {
  return {
    Name,
    StringId,
    Values: { "enemy classification": enemyThreshold },
    ReferenceCategories: { relations },
    Referrers: []
  };
}

export function town(
  StringId,
  { Name = StringId, owner = "Neutral", ownerId = "neutral", overrides = [], conditions = [] } = {}
) {
  return {
    Name,
    StringId,
    Values: {},
    ReferenceCategories: {
      faction: [reference(ownerId, 0, owner)],
      ...(overrides.length > 0 ? { "override town": overrides.map((id) => reference(id, 0)) } : {}),
      ...(conditions.length > 0
        ? {
            "world state": conditions.map(({ id, value }) => reference(id, value))
          }
        : {})
    },
    Referrers: []
  };
}

export function createScenarioFixture({
  manifestId = "test-manifest",
  worldStates,
  factions,
  characters,
  towns,
  squads,
  spawnAreas,
  mapData
} = {}) {
  const namespace =
    manifestId === "vanilla" ? "/data/vanilla/fixture-hash" : `/data/mod-manifests/${manifestId}`;
  const datasetKeys = [
    "characters",
    "factions",
    "worldStates",
    "townFcsData",
    "spawnAreas",
    "squads",
    "mapData"
  ];
  const contract = {
    contractVersion: 3,
    userData: { manifestId },
    manifest: { id: manifestId, title: "Scenario fixture" },
    datasets: Object.fromEntries(
      datasetKeys.map((key) => [
        key,
        { url: `https://map.kenshi.wiki${namespace}/${key}.json`, required: true }
      ])
    )
  };

  const defaultFactions = [
    faction(PLAYER_FACTION_ID, "Nameless", -10, [reference("faction-a", 0, "Faction A")]),
    faction("faction-a", "Faction A", -10),
    faction("neutral", "Neutral", -10)
  ];
  const defaultStates = [
    worldState("state-alive", { "NPC is": [reference("alpha", 1, "Alpha")] }),
    worldState(
      "state-alive-player",
      { "NPC is": [reference("alpha", 1, "Alpha")] },
      { playerInvolvement: true }
    ),
    worldState("state-dead", { "NPC is": [reference("alpha", 0, "Alpha")] }),
    worldState(
      "state-dead-player",
      { "NPC is": [reference("alpha", 0, "Alpha")] },
      { playerInvolvement: true }
    ),
    worldState("state-imprisoned", { "NPC is": [reference("alpha", 2, "Alpha")] }),
    worldState("state-both-alive", {
      "NPC is": [reference("alpha", 1, "Alpha"), reference("bravo", 1, "Bravo")]
    }),
    worldState("state-not-alive", { "NPC is NOT": [reference("alpha", 1, "Alpha")] }),
    worldState("state-ally", { "player ally": [reference("faction-a", 1, "Faction A")] }),
    worldState(
      "state-ally-player",
      { "player ally": [reference("faction-a", 1, "Faction A")] },
      { playerInvolvement: true }
    )
  ];
  const defaultTowns = [
    town("town-base", { Name: "Base Town", overrides: ["town-dead"] }),
    town("town-dead", {
      Name: "Base Town (override) Fallen",
      owner: "Faction A",
      ownerId: "faction-a",
      conditions: [{ id: "state-dead", value: 1 }]
    }),
    town("nest-one", { Name: "Nest One" })
  ];
  const defaultSquads = [
    {
      Name: "Patrol",
      StringId: "squad-one",
      Values: {},
      ReferenceCategories: {
        "world state": [reference("state-dead", 1)]
      },
      Referrers: []
    }
  ];
  const defaultAreas = [
    {
      Name: "Test Area",
      StringId: "area-one",
      Values: {},
      ReferenceCategories: {
        "homeless spawns": [reference("squad-one", 1), reference("squad-one", 1)],
        nests: [reference("nest-one", 1)]
      },
      Referrers: []
    }
  ];

  return {
    contract,
    datasets: {
      characters: characters ?? [
        { Name: "Alpha canonical", StringId: "alpha", Values: {}, ReferenceCategories: {} },
        { Name: "Bravo canonical", StringId: "bravo", Values: {}, ReferenceCategories: {} }
      ],
      factions: factions ?? defaultFactions,
      worldStates: worldStates ?? defaultStates,
      townFcsData: towns ?? defaultTowns,
      squads: squads ?? defaultSquads,
      spawnAreas: spawnAreas ?? defaultAreas,
      mapData: mapData ?? [
        { Name: "Base Town marker", InstanceId: "marker-one", TargetId: "town-base" }
      ]
    }
  };
}
