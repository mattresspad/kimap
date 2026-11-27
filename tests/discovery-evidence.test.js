import assert from "node:assert/strict";
import test from "node:test";

import {
  createDiscoveryAudit,
  createDiscoveryCatalog,
  projectDiscoveryEntity
} from "../modules/discovery/index.js";

function ref(StringId, Value0 = 1, Name = StringId, Value1 = 0) {
  return { StringId, Name, Value0, Value1 };
}

function record(StringId, Name, ReferenceCategories = {}, Values = {}) {
  return { StringId, Name, ReferenceCategories, Values };
}

function fixture() {
  return {
    characters: [
      record(
        "char",
        "Named Character",
        { faction: [ref("faction")], squad: [ref("squad")], items: [ref("item")] },
        { "bounty amount": 5000 }
      ),
      record("same-name-a", "Collision")
    ],
    animals: [record("animal", "Pack Bull"), record("same-name-b", "Collision")],
    squads: [
      record("squad", "Resident Squad", {
        leader: [ref("char", 1, "Named Character", 2)],
        animal: [ref("animal", 1)],
        "vendor lists": [ref("vendor")],
        "nested squad": [ref("cycle")]
      }),
      record("cycle", "Cycle Squad", { squad: [ref("squad")] })
    ],
    factions: [record("faction", "Faction")],
    townFcsData: [
      record("town", "Town", { residents: [ref("squad")] }, { type: 2 }),
      record("nest", "Nest Template", { "roaming squads": [ref("squad")] }, { type: 0 }),
      record("nest-marker", "Nest Marker", {}, { type: 8 })
    ],
    spawnAreas: [
      record("area", "Area", { "homeless spawns": [ref("squad", 4)], nests: [ref("nest", 2)] })
    ],
    mapData: [
      { InstanceId: "town-one", TargetId: "town", Name: "Town marker", X: 10, Z: 20 },
      { InstanceId: "town-two", TargetId: "town", Name: "Town marker 2", X: 30, Z: 40 },
      { InstanceId: "mapped-nest", TargetId: "nest", Name: "Mapped mod nest", X: 50, Z: 60 },
      { InstanceId: "nest-marker-one", TargetId: "nest-marker", Name: "Nest marker", X: 70, Z: 80 }
    ],
    items: [record("item", "Book", { "vendor lists": [ref("vendor")] }, { value: 100, weight: 2 })],
    weapons: [record("weapon", "Blade")],
    crossbows: [record("crossbow", "Bow")],
    armours: [record("armour", "Coat")],
    mapItems: [record("map-item", "Map")],
    nestItems: [record("nest-item", "Egg")],
    vendorLists: [record("vendor", "Vendor List", { items: [ref("item")] })]
  };
}

function snapshot() {
  return {
    characters: { char: 1 },
    world: {
      towns: { town: { activeTownId: "town", path: ["town"] } },
      spawns: {
        area: {
          entries: {
            current: {
              occurrenceId: "current",
              entityId: "squad",
              type: "Squad",
              status: "Active"
            },
            conditional: {
              occurrenceId: "conditional",
              entityId: "nest",
              type: "Nest",
              status: "Potential"
            }
          }
        }
      }
    }
  };
}

function lenses(byBaseTownId = {}) {
  return {
    townOverrides: { byBaseTownId, roots: Object.values(byBaseTownId) },
    relations: { byFactionId: {} }
  };
}

test("discovery catalog indexes complete entity families and keeps type-8 geographic", () => {
  const datasets = fixture();
  const before = structuredClone(datasets);
  const catalog = createDiscoveryCatalog({ datasets, baseline: { manifestId: "fixture" } });
  assert.equal(catalog.byType.character.char.subtype, "Character");
  assert.equal(catalog.byType.character.animal.subtype, "Animal");
  assert.ok(catalog.byType.nest.nest);
  assert.equal(catalog.byType.nest["nest-marker"], undefined);
  assert.equal(catalog.byType.weapon.weapon.name, "Blade");
  assert.deepEqual(datasets, before);
  assert.ok(Object.isFrozen(catalog));
});

test("discovery uses stable IDs and never reconciles same display names", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  assert.ok(catalog.byType.character["same-name-a"]);
  assert.ok(catalog.byType.character["same-name-b"]);
  assert.notEqual(
    catalog.byType.character["same-name-a"].entityId,
    catalog.byType.character["same-name-b"].entityId
  );
});

test("discovery retains exact relationship detail and bounded cycles", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  const member = catalog.edges.find(
    ({ sourceKey, category }) => sourceKey === "squad:squad" && category === "leader"
  );
  assert.deepEqual(
    {
      target: member.targetKey,
      position: member.position,
      value0: member.value0,
      value1: member.value1
    },
    { target: "character:char", position: 0, value0: 1, value1: 2 }
  );
  assert.ok(catalog.diagnostics.some(({ code }) => code === "discovery_graph_cycle"));
});

test("character projection separates life status from repeated current appearances", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  const projection = projectDiscoveryEntity({
    catalog,
    snapshot: snapshot(),
    lenses: lenses(),
    target: { entityType: "character", entityId: "char" }
  });
  assert.equal(projection.scenario.characterLifeStatus, 1);
  assert.equal(projection.appearances.filter(({ state }) => state === "current").length, 4);
  assert.equal(projection.facts.bounty.amount, 5000);
  assert.ok(projection.relationships.some(({ entityType }) => entityType === "item"));
});

test("spawn projection preserves conditional nest evidence without inventing coordinates", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  const projection = projectDiscoveryEntity({
    catalog,
    snapshot: snapshot(),
    lenses: lenses(),
    target: { entityType: "nest", entityId: "nest" }
  });
  assert.ok(projection.appearances.some(({ state }) => state === "conditional"));
  assert.ok(
    projection.appearances.some(
      ({ state, occurrenceId }) => state === "current" && occurrenceId === "mapped-nest"
    )
  );
  assert.ok(
    projection.appearances.every(
      ({ coordinates, parentType }) => parentType === "town" || coordinates === null
    )
  );
});

test("reference-only projection retains relationships and labels classifications unavailable", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  const projection = projectDiscoveryEntity({
    catalog,
    target: { entityType: "item", entityId: "item" }
  });
  assert.equal(projection.scenario.available, false);
  assert.ok(projection.relationships.some(({ provenanceOnly }) => provenanceOnly));
  assert.ok(
    projection.appearances.every(({ state }) =>
      ["unavailable", "unmapped", "unattributed"].includes(state)
    )
  );
});

test("a snapshot without shared lenses keeps placement classification unavailable", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  const projection = projectDiscoveryEntity({
    catalog,
    snapshot: snapshot(),
    target: { entityType: "character", entityId: "char" }
  });
  assert.equal(projection.scenario.available, false);
  assert.ok(projection.appearances.every(({ state }) => state === "unavailable"));
  assert.equal(projection.scenario.characterLifeStatus, 1);
});

test("disappeared evidence preserves every former occurrence without relabeling locked branches", () => {
  const datasets = fixture();
  datasets.spawnAreas = [];
  datasets.mapData = datasets.mapData.filter(({ TargetId }) => TargetId === "town");
  datasets.townFcsData.push(
    record("former", "Former Town", { residents: [ref("squad")] }, { type: 2 }),
    record("new", "New Town", {}, { type: 2 }),
    record("locked", "Locked Town", { residents: [ref("squad")] }, { type: 2 })
  );
  const current = snapshot();
  current.world.spawns = {};
  current.world.towns.town = {
    activeTownId: "new",
    path: ["town", "former", "new"]
  };
  const network = {
    baseTownId: "town",
    nodes: ["town", "former", "new", "locked"].map((id) => ({ id })),
    edges: [{ targetId: "locked", status: "locked" }]
  };
  const projection = projectDiscoveryEntity({
    catalog: createDiscoveryCatalog({ datasets }),
    snapshot: current,
    lenses: lenses({ town: network }),
    target: { entityType: "character", entityId: "char" }
  });
  assert.equal(projection.appearances.filter(({ state }) => state === "disappeared").length, 4);
  assert.equal(projection.appearances.filter(({ state }) => state === "eliminated").length, 2);
});

test("discovery audit is aggregate, deterministic, and covers vendor and bounty provenance", () => {
  const catalog = createDiscoveryCatalog({
    datasets: fixture(),
    baseline: { manifestId: "fixture" }
  });
  const first = createDiscoveryAudit({
    catalog,
    snapshot: snapshot(),
    lenses: lenses(),
    manifest: { id: "fixture", title: "Fixture" }
  });
  const second = createDiscoveryAudit({
    catalog,
    snapshot: snapshot(),
    lenses: lenses(),
    manifest: { id: "fixture", title: "Fixture" }
  });
  assert.deepEqual(first, second);
  assert.equal(first.appearances.bountyCandidates, 1);
  assert.ok(first.relationships.vendorProvenanceEdges > 0);
  assert.ok(first.entities.nestTemplates > 0);
});

test("unknown discovery targets fail truthfully without display-name fallback", () => {
  const catalog = createDiscoveryCatalog({ datasets: fixture() });
  const projection = projectDiscoveryEntity({
    catalog,
    snapshot: snapshot(),
    lenses: lenses(),
    target: { entityType: "character", entityId: "Collision" }
  });
  assert.deepEqual(projection, {
    available: false,
    reason: "unknown-reference-target",
    target: { entityType: "character", entityId: "Collision" }
  });
});
