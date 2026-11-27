import assert from "node:assert/strict";
import test from "node:test";

import {
  RESEARCH_UNCLASSIFIED_LEVEL_KEY,
  RESEARCH_UNLOCK_GROUPS,
  ResearchBrowserPresentationSession,
  collectResearchPath,
  createResearchBrowserView,
  createResearchGraph,
  selectIndexableResearchRecords
} from "../modules/research-tree-model.js";

function reference(StringId, Name = StringId, Value0 = 0, Value1 = 0, Value2 = 0) {
  return { StringId, Name, Value0, Value1, Value2 };
}

function research(
  StringId,
  Name,
  { level = 1, category = "Core", values = {}, references = {} } = {}
) {
  return {
    StringId,
    Name,
    Values: {
      "blueprint only": false,
      category,
      description: `${Name} description`,
      "is level upgrade": false,
      level,
      money: 0,
      "power capacity increase": 0,
      "power increase": 0,
      "production mult": 1,
      "repeat mult": 1,
      repeats: 0,
      time: 12,
      ...values
    },
    ReferenceCategories: references,
    Referrers: []
  };
}

test("legacy Research indexing skips malformed entries without blocking valid records", () => {
  const valid = research("valid", "Valid");

  assert.deepEqual(selectIndexableResearchRecords({}), []);
  assert.deepEqual(selectIndexableResearchRecords([null, 4, {}, valid]), [valid]);
  assert.deepEqual(selectIndexableResearchRecords({ valid, malformed: null }), [valid]);
  assert.throws(() => selectIndexableResearchRecords([valid]).push(valid), TypeError);
});

test("Research graph joins exact canonical and legacy prerequisites and derives dependents", () => {
  const graph = createResearchGraph([
    research("same-name-a", "Duplicate Name", { level: 0 }),
    research("same-name-b", "Duplicate Name", { level: 2 }),
    research("middle", "Middle", {
      level: 4,
      references: {
        requirements: [reference("same-name-a", "Wrong authored name")],
        requires: [reference("same-name-a"), reference("same-name-b")]
      }
    }),
    research("final", "Final", {
      level: 9,
      references: { requirements: [reference("middle")] }
    })
  ]);

  assert.equal(graph.available, true);
  assert.equal(graph.validCount, 4);
  assert.deepEqual(graph.nodesById.middle.prerequisiteIds, ["same-name-a", "same-name-b"]);
  assert.deepEqual(graph.nodesById["same-name-a"].dependentIds, ["middle"]);
  assert.deepEqual(graph.nodesById.middle.dependentIds, ["final"]);
  assert.equal(graph.nodesById.middle.requirements[0].name, "Duplicate Name");
  assert.deepEqual(graph.edges, [
    { sourceId: "middle", targetId: "final" },
    { sourceId: "same-name-a", targetId: "middle" },
    { sourceId: "same-name-b", targetId: "middle" }
  ]);
  assert.deepEqual(graph.levels, [
    { key: "0", value: 0, label: "Starting Unlocks" },
    { key: "2", value: 2, label: "Level 2" },
    { key: "4", value: 4, label: "Level 4" },
    { key: "9", value: 9, label: "Level 9" }
  ]);
  assert.equal(
    graph.diagnostics.some(({ code }) => code === "unresolved_prerequisite"),
    false
  );
});

test("Research graph preserves known zeroes, missing values, costs, and authored unlock groups", () => {
  const record = research("effects", "Effects", {
    values: {
      "blueprint only": true,
      "is level upgrade": true,
      money: 500,
      time: 0,
      repeats: 5,
      "repeat mult": 1.1,
      "production mult": 0,
      "power increase": 0,
      "power capacity increase": 60
    },
    references: {
      cost: [reference("book", "Ancient Science Book", 0, 2, 0)],
      "enable buildings": [reference("building", "Building", 0)],
      "improve buildings": [reference("improvement", "Improvement", 1)],
      "enable item": [reference("item", "Item")],
      "enable armour": [reference("armour", "Armour")],
      "enable robotics": [reference("robotics", "Robotics")],
      "enable crossbow": [reference("crossbow", "Crossbow")],
      "enable weapon type": [reference("weapon-type", "Weapon Type")],
      "enable weapon model": [reference("weapon-model", "Weapon Model")],
      "blueprint item": [reference("blueprint", "Blueprint")],
      "modded unlock": [reference("modded", "Modded Unlock", 0)]
    }
  });
  delete record.Values.money;
  const graph = createResearchGraph([record]);
  const node = graph.nodesById.effects;

  assert.deepEqual(node.behavior, {
    blueprintOnly: true,
    isLevelUpgrade: true,
    time: 0,
    money: null,
    repeats: 5,
    repeatMultiplier: 1.1,
    productionMultiplier: 0,
    powerIncrease: 0,
    powerCapacityIncrease: 60
  });
  assert.deepEqual(node.costs, [
    { id: "book", name: "Ancient Science Book", value0: 0, value1: 2, value2: 0 }
  ]);
  assert.deepEqual(
    node.unlockGroups.map(({ key, known }) => [key, known]),
    [
      ["buildings", true],
      ["improvements", true],
      ["items", true],
      ["armour", true],
      ["robotics", true],
      ["crossbows", true],
      ["weaponTypes", true],
      ["weaponModels", true],
      ["blueprintItems", true],
      ["unknown:modded unlock", false]
    ]
  );
  assert.equal(node.unlockGroups.at(-1).references[0].value0, 0);
  assert.deepEqual(
    RESEARCH_UNLOCK_GROUPS.map(({ key }) => key),
    [
      "buildings",
      "improvements",
      "items",
      "armour",
      "robotics",
      "crossbows",
      "weaponTypes",
      "weaponModels",
      "blueprintItems"
    ]
  );
  assert.throws(() => {
    node.behavior.time = 4;
  }, TypeError);
  assert.throws(() => {
    node.unlockGroups[0].references.push(reference("other"));
  }, TypeError);
});

test("Research graph diagnoses invalid reference fields without converting them to authored values", () => {
  const target = research("target", "Target");
  const source = research("source", "Source", {
    references: {
      requirements: [
        {
          StringId: "target",
          Name: 42,
          Value0: "1",
          Value1: Number.POSITIVE_INFINITY,
          Value2: null
        }
      ],
      cost: [
        {
          StringId: "book",
          Name: "",
          Value0: Number.NaN,
          Value1: "2",
          Value2: {}
        }
      ]
    }
  });
  const graph = createResearchGraph([target, source]);
  const node = graph.nodesById.source;

  assert.deepEqual(node.requirements[0], {
    id: "target",
    name: "Target",
    value0: null,
    value1: null,
    value2: null,
    status: "resolved"
  });
  assert.deepEqual(node.costs[0], {
    id: "book",
    name: "book",
    value0: null,
    value1: null,
    value2: null
  });
  assert.ok(node.recordDiagnostics.some(({ code }) => code === "invalid_reference_name"));
  assert.equal(
    node.recordDiagnostics.filter(({ code }) => code === "invalid_reference_value").length,
    6
  );
});

test("Research graph classifies internal, uncategorized, and unclassified records explicitly", () => {
  const removed = research("removed", "Removed", {
    values: { REMOVED: true }
  });
  const template = research("RESEARCH_TEMPLATE", "Template");
  const fallback = research("fallback", "Fallback");
  fallback.Name = "";
  delete fallback.Values.category;
  fallback.Values.level = "2";
  fallback.Values.description = 4;
  fallback.Values.REMOVED = "true";
  const graph = createResearchGraph([removed, template, fallback]);

  assert.deepEqual(graph.nodesById.removed.internalReasons, ["removed"]);
  assert.deepEqual(graph.nodesById.RESEARCH_TEMPLATE.internalReasons, ["template"]);
  assert.equal(graph.nodesById.fallback.category, "Uncategorized");
  assert.equal(graph.nodesById.fallback.name, "fallback");
  assert.equal(graph.nodesById.fallback.level, null);
  assert.equal(graph.nodesById.fallback.internal, false);
  assert.equal(graph.nodesById.fallback.levelKey, RESEARCH_UNCLASSIFIED_LEVEL_KEY);
  assert.equal(graph.levels.at(-1).label, "Unclassified");
  assert.ok(
    graph.nodesById.fallback.recordDiagnostics.some(({ code }) => code === "missing_category")
  );
  assert.ok(
    graph.nodesById.fallback.recordDiagnostics.some(({ code }) => code === "unclassified_level")
  );
  assert.ok(graph.nodesById.fallback.recordDiagnostics.some(({ code }) => code === "missing_name"));
  assert.ok(
    graph.nodesById.fallback.recordDiagnostics.some(({ code }) => code === "invalid_description")
  );
  assert.ok(
    graph.nodesById.fallback.recordDiagnostics.some(({ code }) => code === "invalid_removed_flag")
  );
});

test("Research graph collapses identical duplicate IDs and excludes conflicting identities", () => {
  const kept = research("kept", "Kept");
  const conflictOne = research("conflict", "First");
  const conflictTwo = research("conflict", "Second");
  const graph = createResearchGraph([
    kept,
    structuredClone(kept),
    conflictOne,
    conflictTwo,
    null,
    { Name: "Missing ID", Values: {}, ReferenceCategories: {} }
  ]);

  assert.equal(graph.validCount, 1);
  assert.deepEqual(
    graph.nodes.map(({ id }) => id),
    ["kept"]
  );
  assert.equal(graph.nodesById.conflict, undefined);
  assert.ok(
    graph.nodesById.kept.recordDiagnostics.some(({ code }) => code === "identical_duplicate")
  );
  assert.ok(graph.diagnostics.some(({ code }) => code === "conflicting_duplicate"));
  assert.ok(graph.diagnostics.some(({ code }) => code === "malformed_record"));
  assert.ok(graph.diagnostics.some(({ code }) => code === "missing_identity"));

  const unavailable = createResearchGraph([conflictOne, conflictTwo]);
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.reason, "no-valid-research-records");
  assert.equal(unavailable.validCount, 0);
  assert.deepEqual(unavailable.nodes, []);

  const mixedForward = createResearchGraph([
    conflictOne,
    structuredClone(conflictOne),
    conflictTwo
  ]);
  const mixedReverse = createResearchGraph([
    conflictTwo,
    conflictOne,
    structuredClone(conflictOne)
  ]);
  assert.deepEqual(mixedForward, mixedReverse);
});

test("Research graph isolates malformed record collections without disabling valid records", () => {
  const graph = createResearchGraph([
    research("valid", "Valid"),
    { StringId: "malformed", Name: "Malformed", Values: [], ReferenceCategories: [] }
  ]);

  assert.equal(graph.available, true);
  assert.equal(graph.validCount, 2);
  assert.ok(
    graph.nodesById.malformed.recordDiagnostics.some(({ code }) => code === "malformed_values")
  );
  assert.ok(
    graph.nodesById.malformed.recordDiagnostics.some(
      ({ code }) => code === "malformed_reference_categories"
    )
  );
  assert.deepEqual(graph.nodesById.malformed.unlockGroups, []);
});

test("Research graph retains unresolved and self evidence while traversing cycles safely", () => {
  const graph = createResearchGraph([
    research("a", "A", {
      references: {
        requirements: [reference("b"), reference("a"), reference("missing")]
      }
    }),
    research("b", "B", { references: { requirements: [reference("c")] } }),
    research("c", "C", { references: { requires: [reference("a")] } }),
    research("tail", "Tail", { references: { requirements: [reference("c")] } })
  ]);

  assert.deepEqual(graph.nodesById.a.prerequisiteIds, ["b"]);
  assert.deepEqual(
    graph.nodesById.a.unresolvedPrerequisites.map(({ id, status }) => [id, status]),
    [
      ["a", "self"],
      ["missing", "unresolved"]
    ]
  );
  assert.ok(graph.diagnostics.some(({ code }) => code === "cyclic_prerequisites"));
  assert.ok(graph.diagnostics.some(({ code }) => code === "self_prerequisite"));
  assert.ok(graph.diagnostics.some(({ code }) => code === "unresolved_prerequisite"));
  assert.deepEqual(collectResearchPath(graph, "a"), {
    ancestorIds: ["b", "c"],
    dependentIds: ["b", "c", "tail"],
    relatedIds: ["b", "c", "tail"]
  });
  assert.deepEqual(collectResearchPath(graph, "unknown"), {
    ancestorIds: [],
    dependentIds: [],
    relatedIds: []
  });
});

test("Research graph detects a deep cycle with bounded iterative traversal", () => {
  const recordCount = 5_000;
  const records = Array.from({ length: recordCount }, (_, index) =>
    research(`deep-${String(index)}`, `Deep ${String(index)}`, {
      references: {
        requirements: [reference(`deep-${String((index + 1) % recordCount)}`)]
      }
    })
  );
  const graph = createResearchGraph(records);

  assert.equal(graph.validCount, recordCount);
  assert.equal(graph.diagnostics.filter(({ code }) => code === "cyclic_prerequisites").length, 1);
  assert.equal(collectResearchPath(graph, "deep-0").ancestorIds.length, recordCount - 1);
});

test("Research graph ordering is deterministic and never reconciles prerequisites by name", () => {
  const records = [
    research("z", "Same", { category: "Zed", level: 3 }),
    research("a", "Same", { category: "Alpha", level: 1 }),
    research("consumer", "Consumer", {
      category: "Alpha",
      level: 5,
      references: { requirements: [reference("unknown", "Same")] }
    })
  ];
  const first = createResearchGraph(records);
  const second = createResearchGraph([...records].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.nodes.map(({ id }) => id),
    ["consumer", "a", "z"]
  );
  assert.deepEqual(
    first.categories.map(({ name }) => name),
    ["Alpha", "Zed"]
  );
  assert.deepEqual(first.nodesById.consumer.prerequisiteIds, []);
  assert.deepEqual(first.nodesById.consumer.unresolvedPrerequisites[0], {
    id: "unknown",
    name: "Same",
    value0: 0,
    value1: 0,
    value2: 0,
    status: "unresolved"
  });
});

test("Research browser view filters the catalog while preserving board topology and path priority", () => {
  const graph = createResearchGraph([
    research("root", "Root", { level: 0 }),
    research("match", "Matching Research", {
      level: 2,
      references: { requirements: [reference("root")] }
    }),
    research("other", "Other", { category: "Crafting", level: 3 }),
    research("removed", "Matching Removed", {
      category: "Crafting",
      values: { REMOVED: true },
      references: { requirements: [reference("match")] }
    })
  ]);
  const snapshot = {
    query: "matching",
    showInternal: false,
    selectedId: "match",
    openCategoryIds: []
  };
  const view = createResearchBrowserView(graph, snapshot);

  assert.deepEqual(view.boardNodeIds, ["match", "other", "root"]);
  assert.deepEqual(view.boardLevelKeys, ["0", "2", "3"]);
  assert.deepEqual(view.boardCategoryNames, ["Core", "Crafting"]);
  assert.deepEqual(view.jumpSections, [
    {
      category: "Core",
      levels: [
        { key: "0", label: "Starting Unlocks", nodeIds: ["root"] },
        { key: "2", label: "Level 2", nodeIds: ["match"] }
      ]
    },
    {
      category: "Crafting",
      levels: [{ key: "3", label: "Level 3", nodeIds: ["other"] }]
    }
  ]);
  assert.deepEqual(view.matchingIds, ["match"]);
  assert.deepEqual(view.subduedIds, ["other"]);
  assert.deepEqual(view.ancestorIds, ["root"]);
  assert.deepEqual(view.dependentIds, []);
  assert.deepEqual(view.hiddenRelatedIds, ["removed"]);
  assert.deepEqual(
    view.catalogCategories.map(({ name, nodeIds, open }) => [name, nodeIds, open]),
    [["Core", ["match"], true]]
  );
  assert.throws(() => {
    view.boardNodeIds.pop();
  }, TypeError);

  const internalView = createResearchBrowserView(graph, {
    ...snapshot,
    showInternal: true,
    selectedId: "removed"
  });
  assert.ok(internalView.boardNodeIds.includes("removed"));
  assert.deepEqual(internalView.boardLevelKeys, ["0", "1", "2", "3"]);
  assert.deepEqual(internalView.ancestorIds, ["match", "root"]);
});

test("Research browser jump sections expose populated dynamic cells independent of search", () => {
  const graph = createResearchGraph([
    research("start", "Start", { category: "Core", level: 0 }),
    research("advanced", "Advanced", { category: "Core", level: 12 }),
    research("fallback", "Fallback", { category: "Core", level: null }),
    research("craft", "Craft", { category: "Crafting", level: 12 }),
    research("removed", "Removed", {
      category: "Crafting",
      level: 3,
      values: { REMOVED: true }
    })
  ]);
  const visibleView = createResearchBrowserView(graph, { query: "no matching research" });

  assert.deepEqual(visibleView.catalogCategories, []);
  assert.deepEqual(visibleView.jumpSections, [
    {
      category: "Core",
      levels: [
        { key: "0", label: "Starting Unlocks", nodeIds: ["start"] },
        { key: "12", label: "Level 12", nodeIds: ["advanced"] },
        {
          key: RESEARCH_UNCLASSIFIED_LEVEL_KEY,
          label: "Unclassified",
          nodeIds: ["fallback"]
        }
      ]
    },
    {
      category: "Crafting",
      levels: [{ key: "12", label: "Level 12", nodeIds: ["craft"] }]
    }
  ]);
  assert.deepEqual(
    visibleView.jumpSections,
    createResearchBrowserView(graph, { query: "" }).jumpSections
  );
  assert.deepEqual(createResearchBrowserView(graph, { showInternal: true }).jumpSections, [
    visibleView.jumpSections[0],
    {
      category: "Crafting",
      levels: [
        { key: "3", label: "Level 3", nodeIds: ["removed"] },
        { key: "12", label: "Level 12", nodeIds: ["craft"] }
      ]
    }
  ]);
  assert.throws(() => visibleView.jumpSections[0].levels.push({}), TypeError);

  const internalOnlyGraph = createResearchGraph([
    research("RESEARCH_TEMPLATE", "Template", { level: 0 })
  ]);
  assert.deepEqual(createResearchBrowserView(internalOnlyGraph).jumpSections, []);
  assert.deepEqual(
    createResearchBrowserView(internalOnlyGraph, { showInternal: true }).jumpSections,
    [
      {
        category: "Core",
        levels: [{ key: "0", label: "Starting Unlocks", nodeIds: ["RESEARCH_TEMPLATE"] }]
      }
    ]
  );
  assert.deepEqual(createResearchBrowserView(createResearchGraph([])).jumpSections, []);
});

test("Research browser search matches complete stable IDs with locale-independent casing", () => {
  const graph = createResearchGraph([
    research("RESEARCH-ID-ALPHA", "Unrelated display name", { category: "Core", level: 0 })
  ]);

  const view = createResearchBrowserView(graph, { query: "research-id-alpha" });

  assert.deepEqual(view.matchingIds, ["RESEARCH-ID-ALPHA"]);
  assert.equal(view.catalogCategories[0].nodeIds[0], "RESEARCH-ID-ALPHA");
});

test("Research presentation state retains independent browser choices with immutable no-op snapshots", () => {
  const graph = createResearchGraph([
    research("craft", "Craft", { category: "Crafting" }),
    research("core", "Core", { category: "Core" }),
    research("removed", "Removed", { values: { REMOVED: true } })
  ]);
  const session = new ResearchBrowserPresentationSession({ graph });
  const events = [];
  const unsubscribe = session.subscribe((event) => events.push(event));
  session.subscribe(() => {
    throw new Error("observer failures are isolated");
  });
  const initial = session.getSnapshot();

  assert.deepEqual(initial, {
    query: "",
    showInternal: false,
    diagnosticsOpen: false,
    selectedId: null,
    openCategoryIds: ["Core"],
    rovingId: "core",
    jumpTarget: { category: "Core", levelKey: "1" },
    focusIdentity: null,
    boardPosition: { left: 0, top: 0 }
  });
  assert.equal(session.setQuery(""), false);
  assert.equal(session.setCategoryOpen("Core", true), false);
  assert.equal(session.setRovingId("core"), false);
  assert.equal(session.setJumpTarget("Core", "1"), false);
  assert.equal(session.restoreDefaults(), false);
  assert.strictEqual(session.getSnapshot(), initial);

  session.setQuery("craft");
  session.setCategoryOpen("Crafting", true);
  session.setSelectedId("craft");
  session.setRovingId("craft");
  session.setJumpTarget("Crafting", "1");
  session.setFocusIdentity("catalog", "craft");
  session.setBoardPosition(120, 48);
  assert.deepEqual(session.getSnapshot(), {
    query: "craft",
    showInternal: false,
    diagnosticsOpen: false,
    selectedId: "craft",
    openCategoryIds: ["Core", "Crafting"],
    rovingId: "craft",
    jumpTarget: { category: "Crafting", levelKey: "1" },
    focusIdentity: { surface: "catalog", id: "craft" },
    boardPosition: { left: 120, top: 48 }
  });
  assert.deepEqual(
    events.map(({ type }) => type),
    [
      "setQuery",
      "setCategoryOpen",
      "setSelectedId",
      "setRovingId",
      "setJumpTarget",
      "setFocusIdentity",
      "setBoardPosition"
    ]
  );
  assert.equal(session.setBoardPosition(120, 48), false);
  assert.throws(() => {
    session.getSnapshot().boardPosition.left = 2;
  }, TypeError);
  assert.throws(() => {
    session.getSnapshot().jumpTarget.category = "Core";
  }, TypeError);
  unsubscribe();
  session.clearSelection();
  assert.equal(events.length, 7);
});

test("Research presentation retains distinct control and category focus identities", () => {
  const graph = createResearchGraph([research("one", "One")]);
  const session = new ResearchBrowserPresentationSession({ graph });

  session.setFocusIdentity("catalog-search");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "catalog-search",
    id: null
  });
  session.setFocusIdentity("catalog-toggle");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "catalog-toggle",
    id: null
  });
  session.setFocusIdentity("catalog-category", "Core");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "catalog-category",
    id: "Core"
  });
  session.setFocusIdentity("board-jump-category");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "board-jump-category",
    id: null
  });
  session.setFocusIdentity("board-jump-level");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "board-jump-level",
    id: null
  });
  session.setFocusIdentity("board-jump-submit");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "board-jump-submit",
    id: null
  });
  session.setFocusIdentity("inspector-empty");
  assert.deepEqual(session.getSnapshot().focusIdentity, {
    surface: "inspector-empty",
    id: null
  });
  session.setDiagnosticsOpen(true);
  assert.equal(session.getSnapshot().diagnosticsOpen, true);
  assert.equal(session.setDiagnosticsOpen(true), false);
  assert.throws(
    () => session.setFocusIdentity("catalog-category", "Missing"),
    /Unknown Research focus category/
  );
  assert.throws(() => session.setFocusIdentity("catalog-toggle", "one"), /has no record ID/);
});

test("Research presentation internal toggle clears hidden state and defaults use the first category", () => {
  const graph = createResearchGraph([
    research("alpha", "Alpha", { category: "Alpha" }),
    research("removed", "Removed", { category: "Zed", values: { REMOVED: true } })
  ]);
  const session = new ResearchBrowserPresentationSession({ graph });
  assert.deepEqual(session.getSnapshot().openCategoryIds, ["Alpha"]);

  assert.throws(() => session.setSelectedId("removed"), /hidden by the internal-record filter/);
  session.setShowInternal(true);
  session.setSelectedId("removed");
  session.setRovingId("removed");
  session.setFocusIdentity("board", "removed");
  session.setShowInternal(false);
  assert.deepEqual(session.getSnapshot(), {
    query: "",
    showInternal: false,
    diagnosticsOpen: false,
    selectedId: null,
    openCategoryIds: ["Alpha"],
    rovingId: "alpha",
    jumpTarget: { category: "Alpha", levelKey: "1" },
    focusIdentity: null,
    boardPosition: { left: 0, top: 0 }
  });

  const internalOnlyGraph = createResearchGraph([
    research("RESEARCH_TEMPLATE", "Template", { category: "Core" })
  ]);
  const internalOnly = new ResearchBrowserPresentationSession({ graph: internalOnlyGraph });
  assert.equal(internalOnly.getSnapshot().rovingId, null);
  assert.equal(internalOnly.getSnapshot().jumpTarget, null);
  assert.equal(internalOnly.getJumpTargetNodeId(), null);
  const hiddenSnapshot = internalOnly.getSnapshot();
  assert.throws(
    () => internalOnly.setJumpTarget("Core", "1"),
    /not a populated visible board section/
  );
  assert.strictEqual(internalOnly.getSnapshot(), hiddenSnapshot);
  internalOnly.setShowInternal(true);
  assert.equal(internalOnly.getSnapshot().rovingId, "RESEARCH_TEMPLATE");
  assert.deepEqual(internalOnly.getSnapshot().jumpTarget, {
    category: "Core",
    levelKey: "1"
  });
  assert.equal(internalOnly.getJumpTargetNodeId(), "RESEARCH_TEMPLATE");
  assert.deepEqual(internalOnly.getSnapshot().openCategoryIds, ["Core"]);
  internalOnly.setShowInternal(false);
  assert.equal(internalOnly.getSnapshot().rovingId, null);
  assert.equal(internalOnly.getSnapshot().jumpTarget, null);

  const hiddenCoreGraph = createResearchGraph([
    research("RESEARCH_TEMPLATE", "Template", { category: "Core" }),
    research("craft", "Craft", { category: "Crafting" })
  ]);
  const hiddenCore = new ResearchBrowserPresentationSession({ graph: hiddenCoreGraph });
  assert.deepEqual(hiddenCore.getSnapshot().openCategoryIds, ["Crafting"]);
  assert.deepEqual(hiddenCore.getSnapshot().jumpTarget, {
    category: "Crafting",
    levelKey: "1"
  });
});

test("Research jump target resolves the retained roving card or a deterministic first card", () => {
  const graph = createResearchGraph([
    research("first", "Alpha", { category: "Alpha", level: 2 }),
    research("second", "Beta", { category: "Alpha", level: 2 }),
    research("other", "Gamma", { category: "Beta", level: 4 })
  ]);
  const session = new ResearchBrowserPresentationSession({ graph });

  assert.deepEqual(session.getSnapshot().jumpTarget, {
    category: "Alpha",
    levelKey: "2"
  });
  assert.equal(session.getJumpTargetNodeId(), "first");
  session.setRovingId("second");
  assert.equal(session.getJumpTargetNodeId(), "second");

  assert.equal(session.setJumpTarget("Beta", "4").type, "setJumpTarget");
  const betaSnapshot = session.getSnapshot();
  assert.equal(session.getJumpTargetNodeId(), "other");
  assert.equal(session.setJumpTarget("Beta", "4"), false);
  assert.strictEqual(session.getSnapshot(), betaSnapshot);

  session.setRovingId("other");
  session.setJumpTarget("Alpha", "2");
  const beforeResolve = session.getSnapshot();
  assert.equal(session.getJumpTargetNodeId(), "first");
  assert.strictEqual(session.getSnapshot(), beforeResolve);
  assert.equal(session.getSnapshot().selectedId, null);
  assert.equal(session.getSnapshot().query, "");

  assert.throws(() => session.setJumpTarget("Alpha", "4"), /not a populated visible board section/);
  assert.strictEqual(session.getSnapshot(), beforeResolve);
});

test("Research jump target normalizes hidden cells within category before following roving focus", () => {
  const graph = createResearchGraph([
    research("fallback", "A Fallback", { category: "Beta", level: 2 }),
    research("same-visible", "B Same Category", { category: "Alpha", level: 7 }),
    research("same-hidden", "C Hidden Same Category", {
      category: "Alpha",
      level: 3,
      values: { REMOVED: true }
    }),
    research("only-hidden", "D Hidden Only Category", {
      category: "Zed",
      level: 9,
      values: { REMOVED: true }
    })
  ]);
  const session = new ResearchBrowserPresentationSession({ graph });

  session.setShowInternal(true);
  session.setRovingId("same-hidden");
  session.setJumpTarget("Alpha", "3");
  session.setShowInternal(false);
  assert.equal(session.getSnapshot().rovingId, "fallback");
  assert.deepEqual(session.getSnapshot().jumpTarget, {
    category: "Alpha",
    levelKey: "7"
  });
  assert.equal(session.getJumpTargetNodeId(), "same-visible");

  session.setShowInternal(true);
  session.setRovingId("only-hidden");
  session.setJumpTarget("Zed", "9");
  session.setShowInternal(false);
  assert.deepEqual(session.getSnapshot().jumpTarget, {
    category: "Beta",
    levelKey: "2"
  });
  assert.equal(session.getJumpTargetNodeId(), "fallback");

  const emptySession = new ResearchBrowserPresentationSession({ graph: createResearchGraph([]) });
  assert.equal(emptySession.getSnapshot().jumpTarget, null);
  assert.equal(emptySession.getJumpTargetNodeId(), null);
  assert.equal(emptySession.restoreDefaults(), false);
});

test("Research presentation validates callers and restores all defaults", () => {
  const graph = createResearchGraph([
    research("one", "One"),
    research("other", "Other", { category: "Other", level: 2 })
  ]);
  const session = new ResearchBrowserPresentationSession({ graph });

  assert.throws(() => new ResearchBrowserPresentationSession(), /requires a Research graph/);
  assert.throws(() => session.setQuery(null), /must be a string/);
  assert.throws(() => session.setShowInternal(1), /must be a boolean/);
  assert.throws(() => session.setDiagnosticsOpen("yes"), /must be boolean/);
  assert.throws(() => session.setSelectedId("unknown"), /Unknown Research selection ID/);
  assert.throws(() => session.setCategoryOpen("Missing", true), /Unknown Research category/);
  assert.throws(() => session.setCategoryOpen("Core", "yes"), /must be boolean/);
  assert.throws(() => session.setRovingId("unknown"), /Unknown Research roving focus ID/);
  assert.throws(() => session.setJumpTarget("Missing", "1"), /Unknown Research jump category/);
  assert.throws(() => session.setJumpTarget("Core", "missing"), /Unknown Research jump level/);
  assert.throws(() => session.setJumpTarget("Core", "2"), /not a populated visible board section/);
  assert.throws(() => session.setFocusIdentity("other"), /Unknown Research focus surface/);
  assert.throws(() => session.setBoardPosition(-1, 0), /nonnegative finite coordinates/);
  assert.throws(() => session.subscribe(null), /Subscriber must be a function/);

  session.setQuery("one");
  session.setDiagnosticsOpen(true);
  session.setCategoryOpen("Core", false);
  session.setSelectedId("one");
  session.setJumpTarget("Other", "2");
  session.setFocusIdentity("inspector");
  session.setBoardPosition(1, 2);
  assert.equal(session.restoreDefaults().type, "restoreDefaults");
  assert.equal(session.restoreDefaults(), false);
  assert.deepEqual(session.getSnapshot(), {
    query: "",
    showInternal: false,
    diagnosticsOpen: false,
    selectedId: null,
    openCategoryIds: ["Core"],
    rovingId: "one",
    jumpTarget: { category: "Core", levelKey: "1" },
    focusIdentity: null,
    boardPosition: { left: 0, top: 0 }
  });
});
