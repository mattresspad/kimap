import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentFixture } from "./fixtures/environment-fixture.js";
import { createEnvironmentReports } from "../modules/viewport/environment-reporting.js";
import { formatResourceReading } from "../modules/viewport/reporting-policy.js";
import { createScannerReading } from "../modules/viewport/scanner.js";
import { createEnvironmentInfoProjection } from "../modules/environment-info-model.js";

test("cached location reports preserve shared area identities without political eligibility or scenario input", () => {
  const fixture = createEnvironmentFixture();
  const reports = createEnvironmentReports(fixture);
  const shared = reports.getReportAtPoint(fixture.points.shared);
  assert.equal(shared.ambiguous, true);
  assert.deepEqual(
    shared.areas.map(({ id }) => id),
    ["a", "b"]
  );
  assert.equal(shared.areas[0].name, shared.areas[1].name);
  assert.equal(reports.getReportAtPoint({ ...fixture.points.shared }), shared);
  assert.equal(
    reports.getReportAtPoint(fixture.points.excluded).areas[0].id,
    "18003-gamedata.base"
  );
  assert.equal(reports.getReportAtPoint(fixture.points.unmatched).areas.length, 0);
  assert.equal(reports.getReportAtPoint({ x: Infinity, z: 0 }).title, "Outside known areas");
  assert.throws(() => {
    shared.areas[0].readings[0].text = "99";
  }, TypeError);
  assert.throws(() => createEnvironmentReports({ projection: fixture.projection }));
});

test("resources retain seven Scanner-formatted values, zeroes and first-reference failure", () => {
  const fixture = createEnvironmentFixture();
  const report = createEnvironmentReports(fixture).getReportAtPoint(fixture.points.shared);
  assert.deepEqual(
    report.areas[0].readings.map(({ text }) => text),
    ["0", "<1", "30", "<0.1", "1.3", "—", "0.0"]
  );
  assert.equal(report.areas[0].readings[0].state, "inactive");
  assert.equal(report.areas[0].readings[5].state, "unavailable");
  assert.equal(report.areas[1].resourceStatus, "unresolved-reference");
  assert.ok(report.areas[1].readings.every(({ state }) => state === "unavailable"));
  const empty = createEnvironmentReports(fixture).getReportAtPoint(fixture.points.empty);
  assert.equal(empty.areas[0].resourceStatus, "missing-reference");
  for (const value of [0, 0.004, 0.03, 1.25, null, undefined, -1, Infinity, NaN, "1"]) {
    const scanner = createScannerReading({
      resources: { Values: { arid: value, "water mult": value } }
    });
    assert.deepEqual(formatResourceReading(value, true), scanner.values.arid);
    assert.deepEqual(formatResourceReading(value), scanner.values["water mult"]);
  }
});

test("weather retains positive evidence across incomplete links and separates absence from missing sources", () => {
  const { projection } = createEnvironmentFixture();
  const complete = projection.byId.a.environment;
  assert.equal(complete.conditions.length, 6);
  assert.equal(complete.weatherSourceState, "available");
  assert.deepEqual(
    complete.conditions.map(({ state }) => state),
    ["not-recorded", "recorded", "recorded", "recorded", "recorded", "recorded"]
  );
  assert.equal(complete.weathers.length, 1);
  assert.equal(complete.weatherEffects.length, 4);
  const partial = projection.byId.b.environment;
  assert.equal(partial.weatherSourceState, "incomplete");
  assert.equal(partial.conditions[0].state, "unavailable");
  assert.equal(partial.conditions[1].state, "not-recorded");
  assert.ok(partial.conditions.slice(2).every(({ state }) => state === "recorded"));
  const empty = projection.byId.empty.environment;
  assert.deepEqual(
    empty.conditions.map(({ state }) => state),
    ["unavailable", "unavailable", "not-authored", "not-authored", "not-authored", "not-authored"]
  );
});

test("unresolved season, weather and effect chains never establish absent hazards", () => {
  for (const broken of ["season", "weather", "effect"]) {
    const projection = createEnvironmentInfoProjection({
      spawnArea: [
        {
          StringId: "area",
          Values: { "acidic ground": 0, "acidic water": -1 },
          ReferenceCategories: {
            seasons: [
              { StringId: "season" },
              ...(broken === "season" ? [{ StringId: "missing" }] : [])
            ]
          }
        }
      ],
      season: [
        {
          StringId: "season",
          ReferenceCategories: {
            weathers: [
              { StringId: "weather" },
              ...(broken === "weather" ? [{ StringId: "missing" }] : [])
            ]
          }
        }
      ],
      weather: [
        {
          StringId: "weather",
          Values: { "affect type": 2 },
          ReferenceCategories: { effects: broken === "effect" ? [{ StringId: "missing" }] : [] }
        }
      ]
    });
    const { conditions, weatherSourceState } = projection.byId.area.environment;
    assert.equal(weatherSourceState, "incomplete");
    assert.deepEqual(
      conditions.map(({ state }) => state),
      ["not-recorded", "unavailable", "unavailable", "recorded", "unavailable", "unavailable"]
    );
  }
});
