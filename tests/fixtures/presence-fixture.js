import { createScenarioFixture, faction, reference, town } from "./scenario-fixture.js";

export function createPresenceFixture() {
  const fixture = createScenarioFixture();
  const data = fixture.datasets;
  const squad = (id, factionId, links = {}) => ({
    StringId: id,
    Name: id === "resident" || id === "bar" ? "Same name" : id,
    Values: {},
    ReferenceCategories: {
      ...(factionId ? { faction: [reference(factionId, 0)] } : {}),
      ...links
    }
  });
  data.factions.push(faction("enemy", "Enemy faction", -30));
  data.factions[0].ReferenceCategories.relations = [
    reference("faction-a", 60),
    reference("enemy", -30)
  ];
  data.squads.push(
    squad("resident", "faction-a", { housemates: [reference("nested", 0)] }),
    squad("nested", "enemy", { housemates: [reference("resident", 0)] }),
    squad("bar", "neutral"),
    squad("roaming", "enemy"),
    squad("template", "neutral"),
    squad("unattributed", null),
    squad("ambiguous", null, { faction: [reference("neutral", 0), reference("enemy", 0)] })
  );
  Object.assign(data.townFcsData[0].Values, { type: 2 });
  Object.assign(data.townFcsData[0].ReferenceCategories, {
    residents: [reference("resident", 1), reference("resident", 2)],
    "default resident": [reference("template", 0)],
    "bar squads": [reference("bar", 1)],
    "roaming squads": [reference("roaming", 0)]
  });
  data.townFcsData[1].ReferenceCategories.residents = [];
  data.townFcsData[2].Values.type = 0;
  data.townFcsData[2].ReferenceCategories["roaming squads"] = [reference("roaming", 0)];
  data.townFcsData.push(town("empty"), town("marker-only"));
  data.townFcsData.at(-1).Values.type = 8;
  data.mapData.push(
    { InstanceId: "marker-two", TargetId: "town-base", X: 10, Z: 20 },
    { InstanceId: "empty-marker", TargetId: "empty" },
    { InstanceId: "nest-marker", TargetId: "marker-only" }
  );
  data.spawnAreas[0].ReferenceCategories["homeless spawns"].push(
    reference("bar", 0),
    reference("bar", 1),
    reference("unattributed", 1),
    reference("ambiguous", 1)
  );
  data.spawnAreas.push({
    StringId: "area-two",
    Name: "Same geometry",
    Values: {},
    ReferenceCategories: {}
  });
  return fixture;
}
