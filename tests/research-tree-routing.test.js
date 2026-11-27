import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { routeResearchTreeEdges } from "../modules/research-tree-routing.js";

function card(id, levelIndex, categoryIndex, left, top, right = left + 40, bottom = top + 30) {
  return { id, levelIndex, categoryIndex, rect: { left, top, right, bottom } };
}

function vertical(id, x, top = -20, bottom = 360) {
  return { id, x, top, bottom };
}

function horizontal(id, y, outer = false, left = 0, right = 320) {
  return { id, y, left, right, outer };
}

const STANDARD_CHANNELS = {
  vertical: [
    vertical("left-outer", 4),
    vertical("level-0-1", 90),
    vertical("level-1-2", 190),
    vertical("right-outer", 276)
  ],
  horizontal: [horizontal("top-rail", 0, true), horizontal("category-0-1", 100)]
};

function route(input) {
  return routeResearchTreeEdges({ clearance: 4, channels: STANDARD_CHANNELS, ...input });
}

function assertOrthogonal(points) {
  assert.ok(points.length >= 2);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    assert.ok(start.x === end.x || start.y === end.y, "every route segment is axis-aligned");
    assert.notDeepEqual(start, end, "routes omit duplicate consecutive points");
  }
  for (let index = 2; index < points.length; index += 1) {
    const first = points[index - 2];
    const middle = points[index - 1];
    const last = points[index];
    assert.equal(
      (first.x === middle.x && middle.x === last.x) ||
        (first.y === middle.y && middle.y === last.y),
      false,
      "routes omit redundant collinear points"
    );
  }
}

function segmentIntersectsInterior(start, end, rect) {
  if (start.x === end.x) {
    if (!(start.x > rect.left && start.x < rect.right)) return false;
    return (
      Math.max(Math.min(start.y, end.y), rect.top) < Math.min(Math.max(start.y, end.y), rect.bottom)
    );
  }
  if (!(start.y > rect.top && start.y < rect.bottom)) return false;
  return (
    Math.max(Math.min(start.x, end.x), rect.left) < Math.min(Math.max(start.x, end.x), rect.right)
  );
}

function assertAvoidsNonEndpointCards(result, cards, clearance) {
  const cardsById = new Map(cards.map((entry) => [entry.id, entry]));
  for (const routed of result.routes) {
    const obstacles = [...cardsById.values()]
      .filter(({ id }) => id !== routed.sourceId && id !== routed.targetId)
      .map(({ rect }) => ({
        left: rect.left - clearance,
        right: rect.right + clearance,
        top: rect.top - clearance,
        bottom: rect.bottom + clearance
      }));
    for (let index = 1; index < routed.points.length; index += 1) {
      const start = routed.points[index - 1];
      const end = routed.points[index];
      assert.equal(
        obstacles.some((obstacle) => segmentIntersectsInterior(start, end, obstacle)),
        false,
        `${routed.sourceId} -> ${routed.targetId} avoids every other inflated card`
      );
    }
  }
}

test("Research routing uses orthogonal inner channels for adjacent, skipped, and cross-category edges", () => {
  const cards = [
    card("root", 0, 0, 20, 30),
    card("middle", 1, 0, 120, 30),
    card("target", 2, 1, 220, 130)
  ];
  const result = route({
    cards,
    edges: [
      { sourceId: "root", targetId: "middle" },
      { sourceId: "root", targetId: "target" }
    ]
  });

  assert.deepEqual(result.omitted, []);
  assert.deepEqual(
    result.routes.map(({ sourceId, targetId, direction, usedOuterRail }) => ({
      sourceId,
      targetId,
      direction,
      usedOuterRail
    })),
    [
      { sourceId: "root", targetId: "middle", direction: "forward", usedOuterRail: false },
      { sourceId: "root", targetId: "target", direction: "forward", usedOuterRail: false }
    ]
  );
  for (const routed of result.routes) assertOrthogonal(routed.points);
  assert.ok(
    result.routes.find(({ targetId }) => targetId === "target").points.some(({ y }) => y === 100),
    "the skipped, cross-category edge uses the reserved category channel"
  );
  assertAvoidsNonEndpointCards(result, cards, 4);
});

test("Research routing handles backward, same-level, same-cell, cyclic, and displayed-last edges", () => {
  const cards = [
    card("alpha", 0, 0, 20, 30),
    card("beta", 1, 0, 120, 30),
    card("same-a", 1, 1, 120, 130),
    card("same-b", 1, 1, 120, 170),
    card("unclassified", 2, 1, 220, 130)
  ];
  const result = route({
    cards,
    edges: [
      { sourceId: "alpha", targetId: "beta" },
      { sourceId: "beta", targetId: "alpha" },
      { sourceId: "same-a", targetId: "beta" },
      { sourceId: "same-a", targetId: "same-b" },
      { sourceId: "alpha", targetId: "unclassified" },
      { sourceId: "unclassified", targetId: "alpha" }
    ]
  });

  assert.deepEqual(result.omitted, []);
  const backward = result.routes.find(
    ({ sourceId, targetId }) => sourceId === "beta" && targetId === "alpha"
  );
  const sameLevelOuter = result.routes.find(
    ({ sourceId, targetId }) => sourceId === "same-a" && targetId === "beta"
  );
  const sameCellRoute = result.routes.find(
    ({ sourceId, targetId }) => sourceId === "same-a" && targetId === "same-b"
  );
  const displayedLast = result.routes.find(
    ({ sourceId, targetId }) => sourceId === "alpha" && targetId === "unclassified"
  );
  assert.equal(backward.direction, "backward");
  assert.equal(backward.usedOuterRail, true);
  assert.ok(backward.points.some(({ y }) => y === 0));
  assert.equal(sameLevelOuter.direction, "same-level");
  assert.equal(sameLevelOuter.sameCell, false);
  assert.equal(sameLevelOuter.usedOuterRail, true);
  assert.ok(sameLevelOuter.points.some(({ y }) => y === 0));
  assert.equal(sameCellRoute.direction, "same-level");
  assert.equal(sameCellRoute.sameCell, true);
  assert.equal(sameCellRoute.usedOuterRail, false);
  assert.equal(sameCellRoute.sourceSide, "right");
  assert.equal(sameCellRoute.targetSide, "right");
  assert.equal(
    displayedLast.direction,
    "forward",
    "only displayed levelIndex determines direction"
  );
  assert.equal(
    result.routes.find(({ sourceId }) => sourceId === "unclassified").direction,
    "backward"
  );
  for (const routed of result.routes) assertOrthogonal(routed.points);
  assertAvoidsNonEndpointCards(result, cards, 4);

  const leftFallback = routeResearchTreeEdges({
    cards: [card("stack-a", 1, 0, 120, 30), card("stack-b", 1, 0, 120, 70)],
    edges: [{ sourceId: "stack-a", targetId: "stack-b" }],
    clearance: 4,
    channels: {
      vertical: [vertical("left-only", 90)],
      horizontal: [horizontal("outer", 0, true)]
    }
  });
  assert.equal(leftFallback.routes[0].sourceSide, "left");
  assert.equal(leftFallback.routes[0].targetSide, "left");
  assert.equal(leftFallback.routes[0].usedOuterRail, false);
});

test("Research routing exposes only intentional exact-source and exact-target local buses", () => {
  const cards = [
    card("source-a", 0, 0, 20, 30),
    card("source-b", 0, 1, 20, 130),
    card("target-a", 1, 0, 120, 30),
    card("target-b", 1, 1, 120, 130),
    card("target-shared", 1, 2, 120, 230)
  ];
  const result = route({
    cards,
    edges: [
      { sourceId: "source-a", targetId: "target-a" },
      { sourceId: "source-a", targetId: "target-b" },
      { sourceId: "source-a", targetId: "target-shared" },
      { sourceId: "source-b", targetId: "target-shared" }
    ]
  });

  assert.deepEqual(result.omitted, []);
  const egress = result.buses.find(
    ({ kind, nodeId }) => kind === "egress" && nodeId === "source-a"
  );
  const ingress = result.buses.find(
    ({ kind, nodeId }) => kind === "ingress" && nodeId === "target-shared"
  );
  assert.deepEqual(egress.edgeKeys, [
    "source-a\0target-a",
    "source-a\0target-b",
    "source-a\0target-shared"
  ]);
  assert.deepEqual(ingress.edgeKeys, ["source-a\0target-shared", "source-b\0target-shared"]);
  assert.deepEqual(egress.points, [
    { x: 60, y: 45 },
    { x: 90, y: 45 }
  ]);
  assert.deepEqual(ingress.points, [
    { x: 90, y: 245 },
    { x: 120, y: 245 }
  ]);
  assert.equal(
    result.buses.some(({ nodeId }) => nodeId === "source-b" || nodeId === "target-a"),
    false,
    "a one-edge stub is not presented as a bus"
  );
});

test("Research routes are deterministic across input order, deduplicate exact edges, and never mutate inputs", () => {
  const cards = [
    card("root", 0, 0, 20, 30),
    card("middle", 1, 0, 120, 30),
    card("target", 2, 1, 220, 130)
  ];
  const edges = [
    { sourceId: "root", targetId: "target" },
    { sourceId: "root", targetId: "middle" },
    { sourceId: "root", targetId: "target" }
  ];
  const input = {
    cards,
    edges,
    channels: STANDARD_CHANNELS,
    clearance: 4
  };
  const before = structuredClone(input);
  const first = routeResearchTreeEdges(input);
  const second = routeResearchTreeEdges({
    ...input,
    cards: [...cards].reverse(),
    edges: [...edges].reverse(),
    channels: {
      vertical: [...STANDARD_CHANNELS.vertical].reverse(),
      horizontal: [...STANDARD_CHANNELS.horizontal].reverse()
    }
  });

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(first.routes.length, 2);
  assert.throws(() => first.routes.pop(), TypeError);
  assert.throws(() => {
    first.routes[0].points[0].x = 999;
  }, TypeError);
  assert.throws(() => first.buses.push({}), TypeError);
});

test("Research routing rejects through-card candidates and falls back to an outer rail", () => {
  const cards = [
    card("source", 0, 0, 20, 30),
    card("blocker", 1, 0, 120, 80, 160, 120),
    card("target", 2, 0, 220, 30)
  ];
  const result = routeResearchTreeEdges({
    cards,
    edges: [{ sourceId: "source", targetId: "target" }],
    clearance: 4,
    channels: {
      vertical: [vertical("source-gutter", 90), vertical("target-gutter", 190)],
      horizontal: [horizontal("blocked-inner", 100), horizontal("safe-outer", 0, true)]
    }
  });

  assert.deepEqual(result.omitted, []);
  assert.equal(result.routes[0].fallback, true);
  assert.equal(result.routes[0].usedOuterRail, true);
  assert.ok(result.routes[0].points.some(({ y }) => y === 0));
  assertAvoidsNonEndpointCards(result, cards, 4);
});

test("Research routing isolates missing, self, channel, and bounded-search omissions", () => {
  const cards = [
    card("adjacent-a", 0, 0, 20, 30),
    card("adjacent-b", 1, 0, 120, 30),
    card("far", 2, 1, 220, 130)
  ];
  const ordinary = routeResearchTreeEdges({
    cards,
    edges: [
      { sourceId: "adjacent-a", targetId: "adjacent-b" },
      { sourceId: "adjacent-a", targetId: "far" },
      { sourceId: "missing", targetId: "far" },
      { sourceId: "adjacent-a", targetId: "missing" },
      { sourceId: "far", targetId: "far" }
    ],
    clearance: 4,
    channels: {
      vertical: STANDARD_CHANNELS.vertical,
      horizontal: []
    }
  });

  assert.deepEqual(
    ordinary.routes.map(({ sourceId, targetId }) => [sourceId, targetId]),
    [["adjacent-a", "adjacent-b"]]
  );
  assert.deepEqual(
    ordinary.omitted.map(({ sourceId, targetId, reason }) => [sourceId, targetId, reason]),
    [
      ["adjacent-a", "far", "no-route"],
      ["adjacent-a", "missing", "missing-target"],
      ["far", "far", "self-edge"],
      ["missing", "far", "missing-source"]
    ]
  );

  const bounded = routeResearchTreeEdges({
    cards,
    edges: [{ sourceId: "adjacent-a", targetId: "far" }],
    clearance: 4,
    maxCandidates: 1,
    channels: {
      vertical: STANDARD_CHANNELS.vertical,
      horizontal: [
        horizontal("blocked-first", 45),
        horizontal("safe-second", 100),
        horizontal("outer", 0, true)
      ]
    }
  });
  assert.deepEqual(
    bounded.omitted.map(({ reason }) => reason),
    ["search-limit"]
  );
});

test("Research routing validates measured geometry and remains DOM-independent", () => {
  assert.throws(
    () =>
      routeResearchTreeEdges({
        cards: [card("bad", 0, 0, 20, 30, 10, 60)],
        edges: [],
        channels: STANDARD_CHANNELS
      }),
    /positive width and height/u
  );
  assert.throws(
    () =>
      routeResearchTreeEdges({
        cards: [card("one", 0, 0, 20, 30)],
        edges: [],
        channels: STANDARD_CHANNELS,
        maxCandidates: 0
      }),
    /positive integer/u
  );
  const source = readFileSync(
    new URL("../modules/research-tree-routing.js", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|\bd3\b|ResizeObserver/u);
});
