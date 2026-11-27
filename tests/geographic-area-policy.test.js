import assert from "node:assert/strict";
import test from "node:test";
import {
  createGeographicColorMap,
  isGeographicArea
} from "../modules/selection/geographic-area-policy.js";
import { createPoliticalAreaIndex } from "../modules/political/area-index.js";
import {
  createPoliticalEvidenceCatalog,
  projectPoliticalEvidence
} from "../modules/political/evidence.js";
import {
  createPoliticalFixture,
  rasterFromRows,
  coordinateForPixel
} from "./fixtures/political-fixture.js";
import { createSelectionCatalog } from "../modules/selection/catalog.js";
import { createSpawnAreaAnchorIndex } from "../modules/selection/spawn-area-anchors.js";
import { parseMapView } from "../modules/selection/deep-link.js";
import { createSearchRecords } from "../modules/top-bar/model.js";
import { createEnvironmentInfoProjection } from "../modules/environment-info-model.js";
import { createEnvironmentReports } from "../modules/viewport/environment-reporting.js";
import { createDiscoveryCatalog, projectDiscoveryEntity } from "../modules/discovery/index.js";
import { createDiscoveryAppearanceRoots } from "../modules/discovery/projection.js";

const rim = "51405-Newwworld.mod",
  shem = "55938-rebirth.mod";
const ref = (id) => ({ StringId: id, Value0: 1, Value1: 0 });
const area = (StringId, Name) => ({
  StringId,
  Name,
  Values: { index: 0xff0000 },
  ReferenceCategories: { "homeless spawns": [ref("squad")] }
});

for (const manifestId of ["vanilla", "custom-fixture"])
  for (const reverse of [false, true]) {
    test(`unused exact ID is excluded across geography: ${manifestId}, reversed=${reverse}`, () => {
      const spawnAreas = [area(rim, "Rim Sands"), area(shem, "Shem")];
      if (reverse) spawnAreas.reverse();
      const raw = structuredClone(spawnAreas);
      const raster = rasterFromRows([[0xff0000]]);
      const areaIndex = createPoliticalAreaIndex({ raster, spawnAreas });
      const geometry = areaIndex.geometries[0];
      assert.deepEqual(geometry.areaIds, [shem]);
      assert.equal(geometry.ambiguous, false);
      assert.equal(geometry.mixedExclusion, false);
      assert.equal(geometry.indeterminate, false);
      assert.equal(areaIndex.getGeometryForAreaId(rim), null);
      assert.ok(
        areaIndex.diagnostics.some(
          (d) => d.code === "geographic_area_unused" && d.context.areaId === rim
        )
      );
      assert.deepEqual(areaIndex.excludedAreaIds, ["18003-gamedata.base"]);
      const colors = createGeographicColorMap(spawnAreas);
      assert.equal(colors.get("255,0,0").StringId, shem);
      const anchors = createSpawnAreaAnchorIndex({
        raster,
        colorToAreaMap: colors,
        minimumPixels: 1
      });
      assert.equal(anchors.getAreaIdAtLeaflet({ lat: 4096, lng: 4096 }), shem);
      assert.equal(anchors.getPrimaryAnchor(rim), null);
      assert.equal(
        createSpawnAreaAnchorIndex({
          raster,
          colorToAreaMap: new Map([["255,0,0", rim]]),
          minimumPixels: 1
        }).components.length,
        0
      );
      const projection = createEnvironmentInfoProjection({ spawnArea: spawnAreas });
      const report = createEnvironmentReports({ projection, areaIndex }).getReportAtPoint(
        coordinateForPixel(0, 0, 1, 1)
      );
      assert.deepEqual(
        report.areas.map((a) => a.id),
        [shem]
      );
      assert.equal(report.ambiguous, false);
      const catalog = createSelectionCatalog({
        origin: { manifestId, baselineKey: "fixture" },
        towns: [],
        mapLocations: [],
        spawnAreas
      });
      assert.equal(catalog.spawnAreaById[rim], undefined);
      assert.ok(catalog.spawnAreaById[shem]);
      const restored = parseMapView(
        `#view=1&cx=0&cz=0&zoom=-4&manifest=${manifestId}&baseline=fixture&type=spawnArea&id=${rim}`,
        catalog
      );
      assert.deepEqual(restored.viewport, { center: { x: 0, z: 0 }, zoom: -4 });
      assert.equal(restored.selection, null);
      assert.deepEqual(
        createSearchRecords({ spawnArea: spawnAreas }).map((r) => r.id),
        [shem]
      );
      assert.deepEqual(spawnAreas, raw);
    });
  }

test("names and other shared colors never acquire the unused-record exception", () => {
  const spawnAreas = [area(shem, "Shem"), area("custom-rim", "Rim Sands")];
  const index = createPoliticalAreaIndex({ raster: rasterFromRows([[0xff0000]]), spawnAreas });
  assert.equal(isGeographicArea("custom-rim"), true);
  assert.equal(index.geometries[0].ambiguous, true);
  assert.equal(index.geometries[0].areaIds.length, 2);
});

test("political catalogs omit unused spawns but retain baseline and exclusion diagnostics", () => {
  const { baseline, raster, snapshot } = createPoliticalFixture();
  const unused = structuredClone(baseline.spawnAreas[0]);
  unused.id = rim;
  unused.raw.StringId = rim;
  baseline.spawnAreas.push(unused);
  const areaIndex = createPoliticalAreaIndex({ raster, spawnAreas: baseline.spawnAreas });
  const catalog = createPoliticalEvidenceCatalog({ baseline, areaIndex });
  const projection = projectPoliticalEvidence({ catalog, snapshot });
  assert.ok(baseline.spawnAreas.includes(unused));
  assert.ok(!catalog.spawnAreas.some((a) => a.id === rim));
  assert.ok(
    !projection.geometries.some(
      (g) => g.areaIds.includes(rim) || g.records.some((r) => r.areaId === rim)
    )
  );
  assert.ok(projection.diagnostics.some((d) => d.code === "geographic_area_unused"));
});

test("unused spawn roots have no mapped discovery presence; raw relationships survive", () => {
  const datasets = {
    spawnAreas: [area(rim, "Rim Sands"), area(shem, "Shem")],
    squads: [{ StringId: "squad", Name: "Squad", Values: {}, ReferenceCategories: {} }]
  };
  const catalog = createDiscoveryCatalog({ datasets });
  for (const snapshot of [
    null,
    {
      world: {
        spawns: Object.fromEntries(
          [rim, shem].map((id) => [
            id,
            {
              entries: {
                one: {
                  type: "Squad",
                  entityId: "squad",
                  occurrenceId: `${id}:one`,
                  status: "Default"
                }
              }
            }
          ])
        )
      }
    }
  ]) {
    const roots = createDiscoveryAppearanceRoots({
      catalog,
      snapshot,
      lenses: snapshot ? {} : null
    });
    assert.deepEqual(
      roots.map((r) => r.parentId),
      [shem]
    );
    const report = projectDiscoveryEntity({
      catalog,
      snapshot,
      lenses: snapshot ? {} : null,
      target: { entityType: "squad", entityId: "squad" }
    });
    assert.ok(report.relationships.some((r) => r.entityId === rim));
    assert.ok(!report.appearances.some((a) => a.parentId === rim));
    assert.ok(report.appearances.some((a) => a.parentId === shem));
  }
});
