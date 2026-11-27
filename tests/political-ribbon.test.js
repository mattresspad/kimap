import assert from "node:assert/strict";
import test from "node:test";
import { createPoliticalRibbonReading } from "../modules/viewport/political-ribbon.js";
import { createPoliticalFixture } from "./fixtures/political-fixture.js";
import {
  createPoliticalAreaIndex,
  createPoliticalEvidenceCatalog,
  projectPoliticalEvidence,
  evaluatePoliticalInfluence,
  createPoliticalReports,
  POLITICAL_VIEW_POLICY
} from "../modules/political/index.js";

function reports(participantIds = ["faction-a", "faction-b"], edit = () => {}) {
  const fixture = createPoliticalFixture();
  edit(fixture);
  const areaIndex = createPoliticalAreaIndex({
    raster: fixture.raster,
    spawnAreas: fixture.baseline.spawnAreas
  });
  const catalog = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex });
  const projection = projectPoliticalEvidence({ catalog, snapshot: fixture.snapshot });
  return createPoliticalReports({
    projection,
    influence: evaluatePoliticalInfluence({ projection, participantIds, ...POLITICAL_VIEW_POLICY })
  });
}

test("ribbon derives scoped counts, exact ties and shared geometry names from existing reports", () => {
  const data = reports();
  const local = data.areas.find((area) => area.geometryKey === "255,0,0");
  const global = createPoliticalRibbonReading(data.scorecard);
  assert.equal(global.scope, "Global");
  assert.equal(global.count, 2);
  assert.equal(global.name, "2 tied");
  assert.equal(global.tied, true);
  const reading = createPoliticalRibbonReading(data.scorecard, local);
  assert.equal(reading.scope, "Local");
  assert.equal(reading.count, 2);
  assert.equal(reading.name, "Tied leaders");
  assert.equal(reading.tied, true);
  assert.equal(reading.share, "42.9%");
  assert.match(reading.description, /Area A \/ Area B.*Disputed/);
  assert.ok(Object.isFrozen(reading));
  const nearTie = {
    ...local,
    leaders: local.leaders.map((row, index) => ({ ...row, score: row.score - index * 1e-10 }))
  };
  assert.notEqual(createPoliticalRibbonReading(data.scorecard, nearTie).name, "Tied leaders");
});

test("local hidden leaders retain full-denominator share without promoting the included runner-up", () => {
  const data = reports(["faction-a", "faction-b"], (fixture) => {
    fixture.snapshot.world.spawns["area-b"].entries["area-b:Squad:hidden-squad"].status = "Active";
    fixture.baseline.spawnAreas[1].raw.Values["homeless spawn amount"] = 20;
  });
  const local = data.areas.find((area) => area.status === "filtered");
  const result = createPoliticalRibbonReading(data.scorecard, local);
  assert.equal(result.name, "Outside visible roster");
  assert.equal(result.share, "74.1%");
  assert.equal(result.count, 2);
  assert.doesNotMatch(JSON.stringify(result), /Hidden Evidence|hidden-squad/);
  const unattributed = {
    ...local,
    status: "unattributed",
    outcomeLabel: "Unattributed",
    leaders: [{ label: "Unattributed", score: 20, share: 20 / 27 }]
  };
  assert.equal(createPoliticalRibbonReading(data.scorecard, unattributed).name, "Unattributed");
});

test("local outcome classes do not fall back to the map leader or imply unavailable counts are zero", () => {
  const data = reports();
  for (const area of data.areas) {
    const result = createPoliticalRibbonReading(data.scorecard, area);
    assert.equal(result.scope, "Local");
    if (area.status === "indeterminate") {
      assert.equal(result.name, "Indeterminate");
      assert.equal(result.count, null);
      assert.equal(result.share, "");
    }
    if (area.status === "noEvidence") assert.equal(result.name, "No current evidence");
    if (area.status === "excluded") assert.equal(result.name, "Excluded area");
  }
  assert.equal(createPoliticalRibbonReading(null).count, null);
  assert.equal(createPoliticalRibbonReading({ rows: [] }).count, 0);
  const local = {
    ...data.areas[0],
    status: "dominant",
    outcomeLabel: "Dominant",
    rows: [{ score: 1 }, { score: 0 }],
    leaders: [{ score: 1, share: 0.0009, label: "Small evidence" }]
  };
  assert.equal(createPoliticalRibbonReading(data.scorecard, local).count, 1);
  assert.equal(createPoliticalRibbonReading(data.scorecard, local).share, "<0.1%");
});
