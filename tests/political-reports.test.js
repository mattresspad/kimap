import assert from "node:assert/strict";
import test from "node:test";
import { createPoliticalFixture } from "./fixtures/political-fixture.js";
import { politicalRegressionDigest } from "./fixtures/political-regression.js";
import {
  createPoliticalAreaIndex,
  createPoliticalEvidenceCatalog,
  createPoliticalReports,
  evaluatePoliticalInfluence,
  POLITICAL_TOWN_METRICS,
  POLITICAL_SOURCE_MIXES,
  POLITICAL_CONFIDENCE_RULES,
  POLITICAL_VIEW_POLICY,
  projectPoliticalEvidence
} from "../modules/political/index.js";
import { ViewportCompositionSession } from "../stores/viewport-composition-session.js";

function setup(edit = () => {}, participantIds = ["faction-a", "faction-b"]) {
  const fixture = createPoliticalFixture();
  edit(fixture);
  const areaIndex = createPoliticalAreaIndex({
    raster: fixture.raster,
    spawnAreas: fixture.baseline.spawnAreas
  });
  const catalog = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex });
  const projection = projectPoliticalEvidence({ catalog, snapshot: fixture.snapshot });
  const influence = evaluatePoliticalInfluence({
    projection,
    participantIds,
    ...POLITICAL_VIEW_POLICY
  });
  return {
    fixture,
    areaIndex,
    projection,
    influence,
    reports: createPoliticalReports({ projection, influence })
  };
}

test("all 60 policies preserve pre-reporting scores, outcomes and pixels across four scenarios", () => {
  assert.equal(
    politicalRegressionDigest(),
    "d5d5022a2ac9d7694c7b59e9802b3f5e49837eb977c2aedd4c26f1f62b31b8b7"
  );
});

test("local reports and scorecard share source totals, denominators, ties and complete geometry", () => {
  const { reports } = setup();
  const local = reports.areas.find((area) => area.geometryKey === "255,0,0");
  assert.equal(local.title, "Area A / Area B");
  assert.equal(local.evidenceTotal, 7);
  assert.equal(local.status, "disputed");
  assert.deepEqual(local.sourceScores, { town: 3, homelessSpawn: 4, nest: 0 });
  assert.equal(local.rows[0].share, 3 / 7);
  assert.deepEqual(local.rows[0].sourceScores, { town: 3, homelessSpawn: 0, nest: 0 });
  assert.deepEqual(local.conditional, { homelessSpawn: 1, nest: 1 });
  assert.equal(local.unattributed.share, 1 / 7);
  assert.deepEqual(local.thresholds, { share: 0.55, margin: 0.1 });
  assert.deepEqual(
    reports.scorecard.rows.map((row) => row.rank),
    [1, 1]
  );
  assert.equal(reports.scorecard.evidenceTotal, 7);
  assert.deepEqual(reports.scorecard.coverage, {
    included: 2,
    indeterminate: 1,
    excluded: 1,
    unmapped: 1
  });
  assert.ok(Object.isFrozen(local.rows[0].sourceScores));
  assert.throws(() => {
    local.rows[0].score = 90;
  }, TypeError);
});

test("hidden identities cannot leak in report leaders, reasons, aggregates or scorecard", () => {
  const { reports } = setup((fixture) => {
    fixture.snapshot.world.spawns["area-b"].entries["area-b:Squad:hidden-squad"].status = "Active";
    fixture.baseline.spawnAreas[1].raw.Values["homeless spawn amount"] = 20;
  });
  const local = reports.areas.find((area) => area.geometryKey === "255,0,0");
  assert.equal(local.status, "filtered");
  assert.equal(local.leaders[0].label, "Outside visible roster");
  assert.equal(local.leaders[0].factionId, undefined);
  assert.equal(local.outside.score, 20);
  assert.equal(reports.scorecard.evidenceTotal, 27);
  assert.equal(reports.scorecard.rows[0].share, 3 / 27);
  assert.doesNotMatch(JSON.stringify(reports), /Hidden Evidence|hidden-squad|"hidden"/);
});

test("indeterminate partial scores do not enter reports or global ranks", () => {
  const { reports } = setup((fixture) => {
    fixture.baseline.spawnAreas[0].raw.Values["homeless spawn amount"] = -1;
  });
  const local = reports.areas.find((area) => area.geometryKey === "255,0,0");
  assert.equal(local.status, "indeterminate");
  assert.equal(local.evidenceTotal, null);
  assert.deepEqual(local.rows, []);
  assert.equal(reports.scorecard.evidenceTotal, 0);
  assert.deepEqual(reports.scorecard.rows, []);
  assert.equal(reports.scorecard.coverage.indeterminate, 2);
});

test("political report state is session-only, restores each widget disclosure and resets independently", () => {
  const session = new ViewportCompositionSession();
  session.setHudExpanded("scanner", true);
  session.activatePoliticalReports();
  assert.equal(session.getSnapshot().hudMode, "scorecard");
  assert.equal(session.getSnapshot().scorecardExpanded, true);
  session.setHudExpanded("scorecard", false);
  session.setHudMode("scanner");
  assert.equal(session.getSnapshot().scannerExpanded, true);
  session.setPoliticalTooltipMode("full");
  session.setPoliticalProbeExpanded(false);
  session.enterFocusMap();
  session.exitFocusMap();
  assert.equal(session.getSnapshot().politicalProbeExpanded, false);
  assert.equal(session.setPoliticalProbeExpanded(false), false);
  session.activatePoliticalReports();
  assert.equal(session.getSnapshot().scorecardExpanded, true);
  session.reset({ hudMode: "scorecard" });
  assert.equal(session.getSnapshot().hudMode, "scorecard");
  assert.equal(session.getSnapshot().scorecardExpanded, false);
  assert.equal(session.getSnapshot().scannerExpanded, false);
  assert.equal(session.getSnapshot().politicalTooltipMode, "reduced");
  assert.equal(session.getSnapshot().politicalProbeExpanded, true);
  assert.throws(() => session.setPoliticalTooltipMode("bad"));
  assert.throws(() => session.setHudExpanded("scorecard", 1));
  assert.equal(new ViewportCompositionSession().getSnapshot().hudMode, "scanner");
});

test("unavailable reports stay unavailable without substitute evidence", () => {
  assert.equal(createPoliticalReports().available, false);
});

test("weighted source contributions reconcile under every audit policy", () => {
  const { projection } = setup((fixture) => {
    fixture.snapshot.world.spawns["area-a"].entries["area-a:Nest:nest-town"].status = "Active";
  });
  for (const townMetric of POLITICAL_TOWN_METRICS) {
    for (const sourceMix of POLITICAL_SOURCE_MIXES) {
      for (const confidenceRule of POLITICAL_CONFIDENCE_RULES) {
        const influence = evaluatePoliticalInfluence({
          projection,
          participantIds: ["faction-a"],
          townMetric,
          sourceMix,
          confidenceRule
        });
        const reports = createPoliticalReports({ projection, influence });
        for (const area of influence.areas) {
          for (const row of area.contributions) {
            assert.ok(
              Math.abs(Object.values(row.sourceScores).reduce((a, b) => a + b, 0) - row.score) <
                1e-10
            );
          }
        }
        const card = reports.scorecard;
        assert.ok(
          Math.abs(
            card.rows.reduce((sum, row) => sum + row.score, 0) +
              card.outside.score +
              card.unattributed.score -
              card.evidenceTotal
          ) < 1e-10
        );
        assert.ok(
          Math.abs(
            Object.values(card.sourceScores).reduce((a, b) => a + b, 0) - card.evidenceTotal
          ) < 1e-10
        );
      }
    }
  }
});

function reportsForScores(scores, change = () => {}) {
  const base = structuredClone(setup().projection);
  const geometry = base.geometries.find((item) => item.key === "255,0,0");
  const town = geometry.records.find((record) => record.kind === "town");
  geometry.records = scores.map(([factionId, value], index) => ({
    ...town,
    id: `score-${index}`,
    factionId,
    metrics: { ...town.metrics, residentReferences: { valid: true, value } }
  }));
  base.geometries = [geometry];
  change(base, geometry);
  const influence = evaluatePoliticalInfluence({
    projection: base,
    participantIds: ["faction-a", "faction-b", "tenant"],
    ...POLITICAL_VIEW_POLICY
  });
  return createPoliticalReports({ projection: base, influence });
}

test("reports preserve exact confidence boundaries and every outcome without rounding", () => {
  assert.equal(
    reportsForScores([
      ["faction-a", 55],
      ["faction-b", 45]
    ]).areas[0].status,
    "dominant"
  );
  const below = reportsForScores([
    ["faction-a", 54.9999],
    ["faction-b", 45.0001]
  ]).areas[0];
  assert.equal(below.status, "disputed");
  assert.equal(below.winnerShare, 54.9999 / 100);
  assert.match(below.reasons.join(" "), /below the confidence/);
  const unknown = reportsForScores([
    [null, 60],
    ["faction-a", 40]
  ]);
  assert.equal(unknown.areas[0].status, "unattributed");
  assert.equal(unknown.scorecard.unattributed.share, 0.6);
  assert.equal(unknown.scorecard.rows[0].share, 0.4);
  assert.equal(
    reportsForScores([
      ["hidden", 60],
      ["faction-a", 40]
    ]).areas[0].status,
    "filtered"
  );
  assert.equal(reportsForScores([]).areas[0].status, "noEvidence");
  assert.equal(
    reportsForScores([], (_p, g) => {
      g.excluded = true;
    }).areas[0].status,
    "excluded"
  );
  assert.equal(
    reportsForScores([], (_p, g) => {
      g.indeterminate = true;
    }).areas[0].status,
    "indeterminate"
  );
});

test("global ranks use exact ties and skip positive evidence in zero-cell geometries", () => {
  const card = reportsForScores([
    ["faction-b", 5],
    ["faction-a", 5],
    ["tenant", 2]
  ]).scorecard;
  assert.deepEqual(
    card.rows.map((row) => [row.factionId, row.rank]),
    [
      ["faction-a", 1],
      ["faction-b", 1],
      ["tenant", 3]
    ]
  );
  const unmapped = reportsForScores([["faction-a", 500]], (_p, g) => {
    g.cellCount = 0;
  });
  assert.equal(unmapped.areas[0].evidenceTotal, 500);
  assert.equal(unmapped.scorecard.evidenceTotal, 0);
  assert.equal(unmapped.scorecard.coverage.unmapped, 1);
  const { projection, influence } = setup();
  assert.throws(
    () =>
      createPoliticalReports({
        projection,
        influence: { ...influence, areas: [...influence.areas, influence.areas[0]] }
      }),
    /duplicated/
  );
});
