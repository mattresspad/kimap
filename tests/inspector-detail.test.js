import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentInfoProjection } from "../modules/environment-info-model.js";
import { projectInspectorWeather } from "../modules/inspector-weather.js";
import {
  createContextProjection,
  createSelectionCatalog,
  createSelectionOrigin
} from "../modules/selection/index.js";
import {
  COMMAND_TYPES,
  ScenarioSession,
  createScenarioCommand,
  createScenarioLensProjection,
  normalizeScenarioBaseline
} from "../modules/scenario/index.js";
import { createScenarioFixture, town } from "./fixtures/scenario-fixture.js";

function catalogFor(towns) {
  const fixture = createScenarioFixture({ towns, spawnAreas: [], squads: [] });
  return createSelectionCatalog({
    origin: createSelectionOrigin(fixture.contract),
    towns,
    spawnAreas: [],
    mapLocations: []
  });
}

function townContext(catalog, id, scenario = {}) {
  return createContextProjection({
    catalog,
    selection: { kind: "entity", entityType: "town", entityId: id, instanceId: null },
    ...scenario
  }).town;
}

test("override connectivity indexes both directions, repeats and unmapped towns by exact ID", () => {
  const towns = [
    town("root", { overrides: ["middle", "middle"] }),
    town("middle", { overrides: ["terminal"] }),
    town("terminal"),
    town("isolated", { Name: "terminal" }),
    town("self", { overrides: ["self"] })
  ];
  const catalog = catalogFor(towns);
  const index = catalog.overrideConnectivityByTownId;
  assert.deepEqual(index, catalogFor([...towns].reverse()).overrideConnectivityByTownId);
  assert.equal(index.root.state, "connected");
  assert.deepEqual(
    index.middle.incoming.map(({ position }) => position),
    [0, 1]
  );
  assert.equal(index.middle.outgoing[0].targetId, "terminal");
  assert.equal(index.terminal.incoming[0].sourceId, "middle");
  assert.equal(index.terminal.outgoing.length, 0);
  assert.equal(index.terminal.state, "connected");
  assert.equal(index.self.incoming[0].sourceId, "self");
  assert.equal(index.self.outgoing[0].targetId, "self");
  assert.equal(index.self.state, "connected");
  assert.equal(index.isolated.state, "unconnected");
  assert.deepEqual(townContext(catalog, "isolated").overrideReport, {
    state: "unconnected",
    notice: "No connected overrides."
  });
  assert.match(
    townContext(catalog, "terminal").overrideReport.notice,
    /scenario analysis is unavailable/u
  );
  assert.match(
    townContext(catalog, "root", { snapshot: {}, lenses: {} }).overrideReport.notice,
    /no mapped scenario path/u
  );
  assert.throws(() => index.middle.incoming.push({}), TypeError);
  assert.deepEqual(
    towns[0].ReferenceCategories["override town"].map(({ StringId }) => StringId),
    ["middle", "middle"]
  );
});

test("unresolved/self links and malformed connectivity never claim an absent network", () => {
  const unresolved = catalogFor([town("root", { overrides: ["not-loaded"] }), town("isolated")]);
  const context = townContext(unresolved, "root");
  assert.equal(context.overrideConnectivity.state, "connected");
  assert.equal(context.overrideConnectivity.outgoing[0].targetId, "not-loaded");
  assert.equal(context.overrideReport.state, "unavailable");
  assert.match(context.diagnostics[0].message, /not-loaded/u);
  assert.equal(townContext(unresolved, "isolated").overrideReport.state, "unconnected");
  for (const links of [[{}], "invalid", null]) {
    const invalid = town("invalid");
    invalid.ReferenceCategories["override town"] = links;
    const catalog = catalogFor([invalid, town("isolated")]);
    for (const id of ["invalid", "isolated"]) {
      const result = townContext(catalog, id);
      assert.equal(result.overrideReport.state, "unavailable");
      assert.ok(result.diagnostics.length);
    }
  }
  const missingMetadata = { ...unresolved, overrideConnectivityByTownId: undefined };
  assert.equal(townContext(missingMetadata, "isolated").overrideReport.state, "unavailable");
});

test("connected roots retain blocked, intermediate and terminal scenario reports", () => {
  const fixture = createScenarioFixture({
    towns: [
      town("town-base", { overrides: ["middle"] }),
      town("middle", {
        overrides: ["terminal"],
        conditions: [{ id: "state-imprisoned", value: 1 }]
      }),
      town("terminal", { conditions: [{ id: "state-dead", value: 1 }] }),
      town("isolated")
    ],
    spawnAreas: [],
    squads: []
  });
  const baseline = normalizeScenarioBaseline(fixture);
  const session = new ScenarioSession(baseline);
  const catalog = createSelectionCatalog({
    origin: createSelectionOrigin(fixture.contract),
    towns: fixture.datasets.townFcsData,
    spawnAreas: [],
    mapLocations: fixture.datasets.mapData
  });
  const context = (id = "town-base") =>
    townContext(catalog, id, {
      snapshot: session.getSnapshot(),
      lenses: createScenarioLensProjection({
        baseline,
        snapshot: session.getSnapshot(),
        journal: session.getJournal(),
        timeline: session.getTimeline()
      })
    });
  assert.equal(context().overrideReport.state, "available");
  assert.equal(context().primaryNetwork.activeTownId, "town-base");
  assert.equal(context().primaryNetwork.outgoing[0].conditions[0].satisfied, false);
  for (const [status, active] of [
    [2, "middle"],
    [0, "terminal"]
  ]) {
    session.dispatch(
      createScenarioCommand(
        COMMAND_TYPES.SET_CHARACTER_STATUS,
        { characterId: "alpha", status, playerInvolved: true },
        { id: `status-${status}`, occurredAt: "2026-09-22T12:00:00.000Z" }
      )
    );
    assert.equal(context().primaryNetwork.activeTownId, active);
    assert.equal(context().overrideReport.state, "available");
  }
  assert.deepEqual(context().primaryNetwork.outgoing, []);
  assert.equal(context("terminal").overrideReport.state, "available");
  assert.equal(context("terminal").overrideConnectivity.incoming.length, 1);
  assert.equal(context("isolated").overrideReport.state, "unconnected");
});

const record = (StringId, Values = {}, ReferenceCategories = {}) => ({
  StringId,
  Name: "Same name",
  Values,
  ReferenceCategories
});
const ref = (StringId) => ({ StringId });
function weatherFixture({
  values = { "acidic ground": 1, "acidic water": 1 },
  missing = false,
  clear = false
} = {}) {
  return createEnvironmentInfoProjection({
    spawnArea: [
      record("area", values, {
        seasons: [ref("season"), ref("season"), ...(missing ? [ref("absent")] : [])]
      }),
      record("other", { "acidic ground": 0, "acidic water": 0 })
    ],
    season: [record("season", {}, { weathers: [ref("weather"), ref("weather")] })],
    weather: [
      record(
        "weather",
        { "affect type": clear ? 0 : 2 },
        {
          effects: clear
            ? []
            : [
                ref("dust"),
                ref("gas"),
                ref("burn"),
                ref("gas"),
                ...(missing ? [ref("absent-effect")] : [])
              ]
        }
      )
    ],
    effect: [
      record("dust", { "affect type": 1 }),
      record("gas", { "affect type": 4 }),
      record("burn", { "affect type": 3 })
    ]
  });
}

test("Inspector weather uses all six recorded effects with stable artwork and no duplicate rows", () => {
  const projection = weatherFixture();
  const report = projectInspectorWeather(projection, "area");
  assert.deepEqual(
    report.effects,
    [
      ["Acid Rain", "acid-rain"],
      ["Acidic Ground", "acid-ground"],
      ["Acidic Water", "acid-water"],
      ["Burning", "burning"],
      ["Duststorm", "duststorm"],
      ["Gas", "poison-gas"]
    ].map(([label, file]) => ({ label, iconPath: `icons/inspector-${file}.svg` }))
  );
  assert.deepEqual(report.notices, []);
  assert.deepEqual(projectInspectorWeather(projection, "other").effects, []);
  assert.throws(() => report.effects.push({}), TypeError);
});

test("Inspector weather keeps positive hazards alongside broken chains and unavailable values", () => {
  const report = projectInspectorWeather(
    weatherFixture({ values: { "acidic ground": -1, "acidic water": 1 }, missing: true }),
    "area"
  );
  assert.equal(report.effects.length, 5);
  assert.ok(report.effects.some(({ label }) => label === "Acidic Water"));
  assert.match(report.notices.join(" "), /linked weather data is unavailable/u);
  assert.match(report.notices.join(" "), /ground or water hazard values are unavailable/u);
  assert.doesNotMatch(JSON.stringify(report), /Clear/u);
  for (const invalid of [undefined, null, -1, "1", Infinity]) {
    const invalidReport = projectInspectorWeather(
      weatherFixture({ values: { "acidic ground": invalid, "acidic water": 0 }, clear: true }),
      "area"
    );
    assert.match(invalidReport.notices.join(" "), /some readings are unavailable/u);
    assert.equal(invalidReport.effects.length, 0);
  }
});

test("Inspector weather distinguishes complete absence, no authored source and unavailable projection", () => {
  const projection = weatherFixture({
    values: { "acidic ground": 0, "acidic water": 0 },
    clear: true
  });
  assert.deepEqual(projectInspectorWeather(projection, "area"), {
    effects: [],
    notices: ["No hazards recorded in the available area data."]
  });
  assert.match(
    projectInspectorWeather(projection, "other").notices.join(" "),
    /No weather source is authored/u
  );
  for (const [source, id] of [
    [null, "area"],
    [projection, "missing"]
  ]) {
    assert.deepEqual(projectInspectorWeather(source, id), {
      effects: [],
      notices: ["Environmental reporting is unavailable for this location."]
    });
  }
});

test("direct area and containing-point weather stay available without simulation; failure is local", () => {
  const catalog = createSelectionCatalog({
    origin: { manifestId: "fixture", baselineKey: "fixture" },
    towns: [],
    mapLocations: [],
    spawnAreas: [record("area", {}, { resources: [ref("resource")] })]
  });
  const references = { resourceById: { resource: record("resource", { arid: 0.5, water: 0.2 }) } };
  const common = { catalog, references, environmentProjection: weatherFixture() };
  const area = createContextProjection({
    ...common,
    selection: { kind: "entity", entityType: "spawnArea", entityId: "area" }
  });
  const point = createContextProjection({
    ...common,
    selection: { kind: "point", point: { x: 12.123, z: -456.7 } },
    pointFacts: { spawnAreaId: "area" }
  });
  assert.deepEqual(area.spawnArea.weather, point.point.spawnArea.weather);
  assert.equal(area.scenarioAvailable, false);
  assert.equal(point.point.coordinates.x, 12.123);
  const unavailable = createContextProjection({
    ...common,
    environmentProjection: null,
    selection: area.selection
  });
  assert.match(unavailable.spawnArea.weather.notices[0], /unavailable/u);
  assert.equal(unavailable.title, area.title);
  assert.deepEqual(unavailable.spawnArea.fertility, area.spawnArea.fertility);
  assert.deepEqual(unavailable.spawnArea.resources, area.spawnArea.resources);
});
