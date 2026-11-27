import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_POLITICAL_PARTICIPANT_IDS,
  POLITICAL_OUTCOME_COLORS,
  POLITICAL_VIEW_POLICY,
  createPoliticalFactionProjection,
  createPoliticalPaletteDefaults,
  createPoliticalRasterProjection,
  evaluatePoliticalInfluence
} from "../modules/political/index.js";
import { PoliticalPresentationSession } from "../stores/political-presentation-session.js";

const DEFAULTS = Object.freeze({
  alpha: Object.freeze({ color: "#112233", source: "authored", paletteId: "palette-a" }),
  beta: Object.freeze({ color: "#445566", source: "generated", paletteId: null }),
  gamma: Object.freeze({ color: "#778899", source: "generated", paletteId: null })
});

test("the installed policy and exact reviewed roster include Anti-Slavers and Fishmen", () => {
  assert.deepEqual(POLITICAL_VIEW_POLICY, {
    id: "localAuthoredBalance",
    label: "Local Authored Balance — Experimental",
    townMetric: "residentReferences",
    sourceMix: "authoredLocal",
    confidenceRule: "share55Margin10"
  });
  assert.deepEqual(
    DEFAULT_POLITICAL_PARTICIPANT_IDS,
    [
      "58229-Dialogue.mod",
      "48743-Dialogue.mod",
      "513-gamedata.base",
      "1209-gamedata.base",
      "48814-Dialogue.mod",
      "97072-Dialogue.mod",
      "48753-Dialogue.mod",
      "41162-Dialogue.mod",
      "56595-Dialogue.mod",
      "66292-rebirth.mod",
      "16860-gamedata.base",
      "14508-gamedata.base",
      "51646-Dialogue.mod",
      "96175-rebirth.mod",
      "1214-gamedata.base",
      "14491-rebirth.mod",
      "42235-rebirth.mod",
      "55101-rebirth.mod",
      "1305-gamedata.base",
      "42257-rebirth.mod",
      "56644-Dialogue.mod",
      "18007-rebirth.mod",
      "16855-gamedata.base",
      "518-gamedata.base",
      "62806-rebirth.mod",
      "200-gamedata.base",
      "49377-rebirth.mod",
      "48791-Dialogue.mod",
      "42022-rebirth.mod",
      "51357-rebirth.mod",
      "54587-rebirth.mod",
      "42097-rebirth.mod",
      "62805-rebirth.mod",
      "54297-rebirth.mod",
      "51652-rebirth.mod",
      "1085-gamedata.base",
      "95512-rebirth.mod",
      "11624-Dialogue (10).mod",
      "62792-rebirth.mod",
      "42088-rebirth.mod",
      "63028-Dialogue.mod",
      "1084-gamedata.base",
      "56777-Dialogue.mod",
      "51638-rebirth.mod",
      "1233-gamedata.base",
      "96261-rebirth.mod",
      "1083-gamedata.base",
      "1088-gamedata.base",
      "defaultEmpireFactionSID",
      "42264-gamedata.base",
      "18000-gamedata.base",
      "96359-rebirth.mod"
    ].sort()
  );
  assert.equal(new Set(DEFAULT_POLITICAL_PARTICIPANT_IDS).size, 52);
  assert.ok(Object.isFrozen(DEFAULT_POLITICAL_PARTICIPANT_IDS));
});

test("Anti-Slaver conditional spawns become pressure only after progression while Fishmen remain eligible", () => {
  const spawn = (id, factionId, value, state) => ({
    id,
    areaId: "area",
    kind: "homelessSpawn",
    state,
    factionId,
    exclusionReason: null,
    evidenceIndeterminate: false,
    relativeWeight: { valid: true, value },
    areaScalar: { valid: true, value: 1 }
  });
  const anti = "58229-Dialogue.mod";
  const fishmen = "96359-rebirth.mod";
  const projection = (antiState) => ({
    available: true,
    factions: [{ id: anti }, { id: fishmen }],
    diagnostics: [],
    geometries: [{
      key: "1,2,3",
      areaIds: ["area"],
      cellCount: 10,
      excluded: false,
      indeterminate: false,
      records: [
        spawn("anti", anti, 3, antiState),
        spawn("fish", fishmen, 1, "current")
      ]
    }]
  });
  const evaluate = (value, participantIds = [anti, fishmen]) => evaluatePoliticalInfluence({
    projection: projection(value),
    participantIds,
    townMetric: POLITICAL_VIEW_POLICY.townMetric,
    sourceMix: POLITICAL_VIEW_POLICY.sourceMix,
    confidenceRule: POLITICAL_VIEW_POLICY.confidenceRule
  }).areas[0];
  assert.equal(evaluate("conditional").winnerId, fishmen);
  assert.equal(evaluate("current").winnerId, anti);
  assert.equal(evaluate("current").status, "dominant");
  assert.equal(evaluate("current", []).status, "filtered");
});

test("political presentation snapshots are immutable, validated, and no-op aware", () => {
  const session = new PoliticalPresentationSession({
    defaultsByFactionId: DEFAULTS,
    participantIds: ["alpha", "beta"]
  });
  const changes = [];
  session.subscribe((change) => changes.push(change));
  const initial = session.getSnapshot();

  assert.deepEqual(initial.participantIds, ["alpha", "beta"]);
  assert.equal(initial.opacity, 0.7);
  assert.throws(() => initial.participantIds.push("gamma"), TypeError);
  assert.throws(() => (initial.colorsByFactionId.alpha = "#ffffff"), TypeError);
  assert.equal(session.include("alpha"), false);
  assert.equal(session.hide("gamma"), false);
  assert.equal(session.setColor("alpha", "#112233"), false);
  assert.equal(session.setOpacity(0.7), false);
  assert.equal(changes.length, 0);

  assert.equal(session.hide("alpha").type, "hideFaction");
  assert.equal(session.include("gamma").type, "includeFaction");
  assert.equal(session.setColor("beta", "#AABBCC").type, "setFactionColor");
  assert.equal(session.getSnapshot().colorsByFactionId.beta, "#aabbcc");
  assert.equal(session.resetColor("beta").type, "resetFactionColor");
  assert.equal(session.setOpacity(0.35).type, "setOpacity");
  assert.equal(session.restoreDefaults().type, "restoreDefaults");
  assert.strictEqual(session.getSnapshot().defaultsByFactionId, initial.defaultsByFactionId);
  assert.deepEqual(session.getSnapshot().participantIds, ["alpha", "beta"]);
  assert.equal(session.getSnapshot().opacity, 0.7);
  assert.equal(session.restoreDefaults(), false);

  assert.throws(() => session.include("missing"), /Unknown political faction ID/);
  assert.throws(() => session.setColor("alpha", "red"), /#rrggbb/);
  assert.throws(() => session.setOpacity(0.34), /between 0.35 and 1/);
  assert.throws(() => session.setOpacity(1.01), /between 0.35 and 1/);
});

test("new presentation sessions reset per manifest initialization without serializing state", () => {
  const first = new PoliticalPresentationSession({
    defaultsByFactionId: DEFAULTS,
    participantIds: ["alpha"]
  });
  first.hide("alpha");
  first.setColor("alpha", "#abcdef");
  first.setOpacity(0.5);
  const second = new PoliticalPresentationSession({
    defaultsByFactionId: DEFAULTS,
    participantIds: ["alpha"]
  });
  assert.deepEqual(second.getSnapshot().participantIds, ["alpha"]);
  assert.equal(second.getSnapshot().colorsByFactionId.alpha, "#112233");
  assert.equal(second.getSnapshot().opacity, 0.7);
  assert.equal(JSON.stringify(second.getSnapshot()).includes("manifest"), false);
});

test("authored packed colors win while generated fallbacks are deterministic and separated", () => {
  const factions = [
    { id: "gamma", paletteIds: ["invalid"] },
    { id: "alpha", paletteIds: ["palette-z", "palette-a"] },
    { id: "beta", paletteIds: [] },
    { id: "delta", paletteIds: [] },
    { id: "f15", paletteIds: [] },
    { id: "f51", paletteIds: [] }
  ];
  const colourSchemes = [
    { StringId: "palette-z", Values: { "color 1": 0xabcdef } },
    { StringId: "palette-a", Values: { "color 1": 0x123456 } },
    { StringId: "invalid", Values: { "color 1": -1 } }
  ];
  const first = createPoliticalPaletteDefaults({
    factions,
    colourSchemes,
    participantIds: ["alpha", "missing", "beta"]
  });
  const second = createPoliticalPaletteDefaults({
    factions: [...factions].reverse(),
    colourSchemes: [...colourSchemes].reverse(),
    participantIds: ["beta", "alpha", "missing"]
  });

  assert.equal(first.defaultsByFactionId.alpha.color, "#123456");
  assert.equal(first.defaultsByFactionId.alpha.source, "authored");
  assert.equal(first.defaultsByFactionId.alpha.paletteId, "palette-a");
  assert.equal(first.defaultsByFactionId.gamma.source, "generated");
  assert.notEqual(first.defaultsByFactionId.beta.color, first.defaultsByFactionId.delta.color);
  assert.notEqual(first.defaultsByFactionId.f15.color, first.defaultsByFactionId.f51.color);
  assert.deepEqual(first.defaultsByFactionId, second.defaultsByFactionId);
  assert.deepEqual(first.resolvedParticipantIds, ["alpha", "beta"]);
  assert.deepEqual(first.missingParticipantIds, ["missing"]);
  assert.ok(first.diagnostics.some(({ code }) => code === "political_palette_multiple_authored"));
  assert.ok(first.diagnostics.some(({ code }) => code === "political_palette_link_invalid"));
  assert.ok(first.diagnostics.some(({ code }) => code === "political_default_participant_missing"));
  assert.ok(Object.isFrozen(first.defaultsByFactionId));
});

function rasterForArea(area, width = 2, height = 2) {
  return createPoliticalRasterProjection({
    areaIndex: {
      available: true,
      width,
      height,
      copyColorIndexes: () => new Uint32Array(width * height).fill(0x010203)
    },
    influence: { available: true, areas: [{ geometryKey: "1,2,3", ...area }] },
    colorsByFactionId: { alpha: "#112233", beta: "#aabbcc", hidden: "#ff0000" }
  });
}

test("political raster treatments are copied, oriented, transparent where required, and immutable", () => {
  const dominant = rasterForArea({ status: "dominant", winnerId: "alpha", contributions: [] });
  assert.deepEqual([...dominant.copyRgba().slice(0, 4)], [17, 34, 51, 255]);
  const changed = dominant.copyRgba();
  changed[0] = 255;
  assert.equal(dominant.copyRgba()[0], 17);

  const oriented = createPoliticalRasterProjection({
    areaIndex: {
      available: true,
      width: 2,
      height: 1,
      copyColorIndexes: () => new Uint32Array([0x010203, 0x040506])
    },
    influence: {
      available: true,
      areas: [
        { geometryKey: "1,2,3", status: "dominant", winnerId: "alpha", contributions: [] },
        { geometryKey: "4,5,6", status: "dominant", winnerId: "beta", contributions: [] }
      ]
    },
    colorsByFactionId: { alpha: "#112233", beta: "#aabbcc" }
  });
  assert.deepEqual([...oriented.copyRgba()], [17, 34, 51, 255, 170, 187, 204, 255]);

  const disputed = rasterForArea({
    status: "disputed",
    contributions: [
      { factionId: "alpha", participant: true },
      { factionId: "beta", participant: true }
    ]
  });
  assert.deepEqual([...disputed.copyRgba().slice(0, 4)], [17, 34, 51, 255]);
  assert.deepEqual([...disputed.copyRgba().slice(12, 16)], [170, 187, 204, 255]);

  const filtered = rasterForArea({
    status: "filtered",
    winnerId: "hidden",
    contributions: [{ factionId: "hidden", participant: false }]
  });
  assert.deepEqual(
    [...filtered.copyRgba().slice(0, 3)],
    POLITICAL_OUTCOME_COLORS.filtered
  );
  assert.equal([...filtered.copyRgba()].includes(255), false);

  const unattributed = rasterForArea({ status: "unattributed", contributions: [] });
  assert.deepEqual(
    [...unattributed.copyRgba().slice(0, 3)],
    POLITICAL_OUTCOME_COLORS.unattributed
  );
  const indeterminate = rasterForArea({ status: "indeterminate", contributions: [] });
  assert.deepEqual(
    [...indeterminate.copyRgba().slice(0, 3)],
    POLITICAL_OUTCOME_COLORS.indeterminate
  );
  assert.equal(indeterminate.copyRgba()[7], 0);
  assert.equal(indeterminate.copyRgba()[15], 232);
  for (const status of ["noEvidence", "excluded"]) {
    assert.ok(rasterForArea({ status, contributions: [] }).copyRgba().every((value) => value === 0));
  }
  assert.ok(Object.isFrozen(dominant));
  assert.equal(createPoliticalRasterProjection({ areaIndex: null }).available, false);
});

test("disputed painting substitutes neutral gray for hidden contributors", () => {
  const raster = rasterForArea({
    status: "disputed",
    contributions: [
      { factionId: "hidden", participant: false },
      { factionId: "alpha", participant: true }
    ]
  });
  assert.deepEqual(
    [...raster.copyRgba().slice(0, 3)],
    POLITICAL_OUTCOME_COLORS.disputedNeutral
  );
  assert.equal([...raster.copyRgba()].some((value, index) => index % 4 !== 3 && value === 255), false);
});

test("faction palette rows retain current, conditional, and hidden evidence labels", () => {
  const presentation = new PoliticalPresentationSession({
    defaultsByFactionId: DEFAULTS,
    participantIds: ["alpha", "beta"]
  });
  const detail = (value = 1) => ({ valid: true, value });
  const projection = {
    available: true,
    reason: null,
    factions: [
      { id: "alpha", name: "Alpha" },
      { id: "beta", name: "Beta" },
      { id: "gamma", name: "Gamma" }
    ],
    towns: [{ factionId: "alpha", metrics: { residentReferences: detail() } }],
    homelessSpawns: [{ factionId: "alpha", relativeWeight: detail() }],
    nests: [{ factionId: "beta", relativeWeight: detail() }],
    conditional: [{ factionId: "gamma", relativeWeight: detail() }]
  };
  presentation.hide("beta");
  const result = createPoliticalFactionProjection({ projection, presentation });
  assert.deepEqual(
    result.rows.map(({ id, evidenceLabel, included }) => [id, evidenceLabel, included]),
    [
      ["alpha", "Both", true],
      ["beta", "Spawn", false],
      ["gamma", "Conditional", false]
    ]
  );
  assert.ok(Object.isFrozen(result.rows[0].evidence));
});
