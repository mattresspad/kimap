import { deepFreeze } from "./scenario/utils.js";

const DEFAULT_CLEARANCE = 6;
const DEFAULT_MAX_CANDIDATES = 4096;
const BEND_PENALTY = 12;
const LOCAL_STUB_PENALTY = 2;

function edgeKey(sourceId, targetId) {
  return `${sourceId}\0${targetId}`;
}

function finiteNumber(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return Object.is(value, -0) ? 0 : value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a nonempty string.`);
  }
  return value;
}

function normalizeRect(rect, label) {
  if (!rect || typeof rect !== "object") throw new TypeError(`${label} must be a rectangle.`);
  const normalized = {
    left: finiteNumber(rect.left, `${label}.left`),
    right: finiteNumber(rect.right, `${label}.right`),
    top: finiteNumber(rect.top, `${label}.top`),
    bottom: finiteNumber(rect.bottom, `${label}.bottom`)
  };
  if (normalized.left >= normalized.right || normalized.top >= normalized.bottom) {
    throw new TypeError(`${label} must have positive width and height.`);
  }
  return normalized;
}

function normalizeCards(cards) {
  if (!Array.isArray(cards)) throw new TypeError("Research routing cards must be an array.");
  const byId = new Map();
  for (const [index, card] of cards.entries()) {
    if (!card || typeof card !== "object") {
      throw new TypeError(`Research routing card ${String(index)} must be an object.`);
    }
    const id = nonEmptyString(card.id, `Research routing card ${String(index)} ID`);
    if (byId.has(id)) throw new TypeError(`Duplicate Research routing card ID '${id}'.`);
    if (!Number.isInteger(card.levelIndex) || card.levelIndex < 0) {
      throw new TypeError(`Research routing card '${id}' levelIndex must be nonnegative.`);
    }
    if (!Number.isInteger(card.categoryIndex) || card.categoryIndex < 0) {
      throw new TypeError(`Research routing card '${id}' categoryIndex must be nonnegative.`);
    }
    const rect = normalizeRect(card.rect, `Research routing card '${id}' rect`);
    byId.set(id, {
      id,
      levelIndex: card.levelIndex,
      categoryIndex: card.categoryIndex,
      rect,
      centerY: (rect.top + rect.bottom) / 2
    });
  }
  return byId;
}

function normalizeEdges(edges) {
  if (!Array.isArray(edges)) throw new TypeError("Research routing edges must be an array.");
  const unique = new Map();
  for (const [index, edge] of edges.entries()) {
    if (!edge || typeof edge !== "object") {
      throw new TypeError(`Research routing edge ${String(index)} must be an object.`);
    }
    const sourceId = nonEmptyString(
      edge.sourceId,
      `Research routing edge ${String(index)} sourceId`
    );
    const targetId = nonEmptyString(
      edge.targetId,
      `Research routing edge ${String(index)} targetId`
    );
    const key = edgeKey(sourceId, targetId);
    if (!unique.has(key)) unique.set(key, { edgeKey: key, sourceId, targetId });
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.targetId.localeCompare(right.targetId)
  );
}

function normalizeVerticalChannels(channels) {
  if (!Array.isArray(channels)) {
    throw new TypeError("Research routing vertical channels must be an array.");
  }
  const ids = new Set();
  return channels
    .map((channel, index) => {
      if (!channel || typeof channel !== "object") {
        throw new TypeError(
          `Research routing vertical channel ${String(index)} must be an object.`
        );
      }
      const id = nonEmptyString(
        channel.id,
        `Research routing vertical channel ${String(index)} ID`
      );
      if (ids.has(id))
        throw new TypeError(`Duplicate Research routing vertical channel ID '${id}'.`);
      ids.add(id);
      const x = finiteNumber(channel.x, `Research routing vertical channel '${id}' x`);
      const top = finiteNumber(channel.top, `Research routing vertical channel '${id}' top`);
      const bottom = finiteNumber(
        channel.bottom,
        `Research routing vertical channel '${id}' bottom`
      );
      if (top >= bottom) {
        throw new TypeError(`Research routing vertical channel '${id}' must have positive length.`);
      }
      return { id, x, top, bottom };
    })
    .sort((left, right) => left.x - right.x || left.id.localeCompare(right.id));
}

function normalizeHorizontalChannels(channels) {
  if (!Array.isArray(channels)) {
    throw new TypeError("Research routing horizontal channels must be an array.");
  }
  const ids = new Set();
  return channels
    .map((channel, index) => {
      if (!channel || typeof channel !== "object") {
        throw new TypeError(
          `Research routing horizontal channel ${String(index)} must be an object.`
        );
      }
      const id = nonEmptyString(
        channel.id,
        `Research routing horizontal channel ${String(index)} ID`
      );
      if (ids.has(id)) {
        throw new TypeError(`Duplicate Research routing horizontal channel ID '${id}'.`);
      }
      ids.add(id);
      const y = finiteNumber(channel.y, `Research routing horizontal channel '${id}' y`);
      const left = finiteNumber(channel.left, `Research routing horizontal channel '${id}' left`);
      const right = finiteNumber(
        channel.right,
        `Research routing horizontal channel '${id}' right`
      );
      if (left >= right) {
        throw new TypeError(
          `Research routing horizontal channel '${id}' must have positive length.`
        );
      }
      return { id, y, left, right, outer: channel.outer === true };
    })
    .sort((left, right) => left.y - right.y || left.id.localeCompare(right.id));
}

function normalizeInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Research routing input must be an object.");
  }
  const clearance =
    input.clearance === undefined
      ? DEFAULT_CLEARANCE
      : finiteNumber(input.clearance, "Research routing clearance");
  if (clearance < 0) throw new TypeError("Research routing clearance must be nonnegative.");
  const maxCandidates = input.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
    throw new TypeError("Research routing maxCandidates must be a positive integer.");
  }
  if (!input.channels || typeof input.channels !== "object") {
    throw new TypeError("Research routing channels must be an object.");
  }
  return {
    cardsById: normalizeCards(input.cards),
    edges: normalizeEdges(input.edges),
    vertical: normalizeVerticalChannels(input.channels.vertical),
    horizontal: normalizeHorizontalChannels(input.channels.horizontal),
    clearance,
    maxCandidates
  };
}

function point(x, y) {
  return { x, y };
}

function samePoint(left, right) {
  return left.x === right.x && left.y === right.y;
}

function simplifyPoints(points) {
  const deduplicated = [];
  for (const candidate of points) {
    if (!samePoint(deduplicated.at(-1) ?? {}, candidate)) deduplicated.push(candidate);
  }
  const simplified = [];
  for (const candidate of deduplicated) {
    while (simplified.length >= 2) {
      const before = simplified.at(-2);
      const previous = simplified.at(-1);
      const collinear =
        (before.x === previous.x && previous.x === candidate.x) ||
        (before.y === previous.y && previous.y === candidate.y);
      if (!collinear) break;
      simplified.pop();
    }
    simplified.push(candidate);
  }
  return simplified;
}

function segmentLength(start, end) {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
}

function routeLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += segmentLength(points[index - 1], points[index]);
  }
  return length;
}

function bendCount(points) {
  let bends = 0;
  for (let index = 2; index < points.length; index += 1) {
    const first = points[index - 2];
    const middle = points[index - 1];
    const last = points[index];
    if ((first.x === middle.x) !== (middle.x === last.x)) bends += 1;
  }
  return bends;
}

function segmentIntersectsRectInterior(start, end, rect) {
  if (start.x === end.x) {
    if (!(start.x > rect.left && start.x < rect.right)) return false;
    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    return Math.max(low, rect.top) < Math.min(high, rect.bottom);
  }
  if (start.y === end.y) {
    if (!(start.y > rect.top && start.y < rect.bottom)) return false;
    const low = Math.min(start.x, end.x);
    const high = Math.max(start.x, end.x);
    return Math.max(low, rect.left) < Math.min(high, rect.right);
  }
  return true;
}

function inflatedObstacles(cardsById, clearance, sourceId, targetId) {
  const obstacles = [];
  for (const card of cardsById.values()) {
    if (card.id === sourceId || card.id === targetId) continue;
    obstacles.push({
      left: card.rect.left - clearance,
      right: card.rect.right + clearance,
      top: card.rect.top - clearance,
      bottom: card.rect.bottom + clearance
    });
  }
  return obstacles;
}

function pathIsClear(points, obstacles) {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start.x !== end.x && start.y !== end.y) return false;
    if (obstacles.some((obstacle) => segmentIntersectsRectInterior(start, end, obstacle))) {
      return false;
    }
  }
  return true;
}

function relationStrategies(source, target) {
  if (source.levelIndex < target.levelIndex) {
    return [
      {
        direction: "forward",
        sourceSide: "right",
        targetSide: "left",
        requiresOuter: false,
        allowOuterFallback: true
      }
    ];
  }
  if (source.levelIndex > target.levelIndex) {
    return [
      {
        direction: "backward",
        sourceSide: "right",
        targetSide: "left",
        requiresOuter: true
      }
    ];
  }
  if (source.categoryIndex === target.categoryIndex) {
    return [
      {
        direction: "same-level",
        sourceSide: "right",
        targetSide: "right",
        requiresOuter: false,
        allowOuterFallback: false
      },
      {
        direction: "same-level",
        sourceSide: "left",
        targetSide: "left",
        requiresOuter: false,
        allowOuterFallback: false
      },
      {
        direction: "same-level",
        sourceSide: "right",
        targetSide: "left",
        requiresOuter: true,
        fallback: true
      }
    ];
  }
  return [
    {
      direction: "same-level",
      sourceSide: "right",
      targetSide: "left",
      requiresOuter: true
    }
  ];
}

function portFor(card, side) {
  return point(side === "left" ? card.rect.left : card.rect.right, card.centerY);
}

function eligibleVerticalChannels(vertical, port, side, clearance) {
  const eligible = vertical
    .filter(
      (channel) =>
        channel.top <= port.y &&
        channel.bottom >= port.y &&
        (side === "left" ? channel.x <= port.x - clearance : channel.x >= port.x + clearance)
    )
    .sort(
      (left, right) =>
        Math.abs(left.x - port.x) - Math.abs(right.x - port.x) ||
        left.x - right.x ||
        left.id.localeCompare(right.id)
    );
  const nearestDistance = Math.abs((eligible[0]?.x ?? port.x) - port.x);
  return eligible.filter((channel) => Math.abs(channel.x - port.x) === nearestDistance);
}

function channelContainsY(channel, y) {
  return channel.top <= y && channel.bottom >= y;
}

function horizontalContainsX(channel, x) {
  return channel.left <= x && channel.right >= x;
}

function candidateSignature(sourceLane, targetLane, horizontal) {
  return `${sourceLane.id}\0${targetLane.id}\0${horizontal?.id ?? "direct"}`;
}

function buildCandidate(sourcePort, targetPort, sourceLane, targetLane, horizontal, obstacles) {
  let rawPoints;
  if (horizontal === null) {
    if (sourceLane.x !== targetLane.x) return null;
    if (!channelContainsY(sourceLane, targetPort.y)) return null;
    rawPoints = [
      sourcePort,
      point(sourceLane.x, sourcePort.y),
      point(sourceLane.x, targetPort.y),
      targetPort
    ];
  } else {
    if (
      !channelContainsY(sourceLane, horizontal.y) ||
      !channelContainsY(targetLane, horizontal.y) ||
      !horizontalContainsX(horizontal, sourceLane.x) ||
      !horizontalContainsX(horizontal, targetLane.x)
    ) {
      return null;
    }
    rawPoints = [
      sourcePort,
      point(sourceLane.x, sourcePort.y),
      point(sourceLane.x, horizontal.y),
      point(targetLane.x, horizontal.y),
      point(targetLane.x, targetPort.y),
      targetPort
    ];
  }
  const points = simplifyPoints(rawPoints);
  if (points.length < 2 || !pathIsClear(points, obstacles)) return null;
  const sourceStub = [sourcePort, point(sourceLane.x, sourcePort.y)];
  const targetStub = [point(targetLane.x, targetPort.y), targetPort];
  const localStubLength = segmentLength(...sourceStub) + segmentLength(...targetStub);
  return {
    points,
    sourceStub,
    targetStub,
    score:
      routeLength(points) + bendCount(points) * BEND_PENALTY + localStubLength * LOCAL_STUB_PENALTY,
    signature: candidateSignature(sourceLane, targetLane, horizontal),
    usedOuterRail: horizontal?.outer === true
  };
}

function betterCandidate(current, candidate) {
  if (candidate === null) return current;
  if (current === null) return candidate;
  if (candidate.score !== current.score)
    return candidate.score < current.score ? candidate : current;
  return candidate.signature.localeCompare(current.signature) < 0 ? candidate : current;
}

function searchCandidates({
  sourcePort,
  targetPort,
  sourceLanes,
  targetLanes,
  horizontal,
  obstacles,
  allowDirect,
  maxCandidates
}) {
  let examined = 0;
  let best = null;
  if (allowDirect) {
    for (const sourceLane of sourceLanes) {
      for (const targetLane of targetLanes) {
        if (sourceLane.x !== targetLane.x) continue;
        if (examined >= maxCandidates) return { candidate: best, limited: true, examined };
        examined += 1;
        best = betterCandidate(
          best,
          buildCandidate(sourcePort, targetPort, sourceLane, targetLane, null, obstacles)
        );
      }
    }
  }
  for (const sourceLane of sourceLanes) {
    for (const targetLane of targetLanes) {
      if (sourceLane.x === targetLane.x) continue;
      for (const horizontalLane of horizontal) {
        if (examined >= maxCandidates) return { candidate: best, limited: true, examined };
        examined += 1;
        best = betterCandidate(
          best,
          buildCandidate(sourcePort, targetPort, sourceLane, targetLane, horizontalLane, obstacles)
        );
      }
    }
  }
  return { candidate: best, limited: false, examined };
}

function searchRelation(relation, source, target, obstacles, normalized, maxCandidates) {
  const sourcePort = portFor(source, relation.sourceSide);
  const targetPort = portFor(target, relation.targetSide);
  const sourceLanes = eligibleVerticalChannels(
    normalized.vertical,
    sourcePort,
    relation.sourceSide,
    normalized.clearance
  );
  const targetLanes = eligibleVerticalChannels(
    normalized.vertical,
    targetPort,
    relation.targetSide,
    normalized.clearance
  );
  let examined = 0;
  let limited = false;
  let candidate = null;
  let fallback = relation.fallback === true;

  if (!relation.requiresOuter) {
    const interior = searchCandidates({
      sourcePort,
      targetPort,
      sourceLanes,
      targetLanes,
      horizontal: normalized.horizontal.filter(({ outer }) => !outer),
      obstacles,
      allowDirect: true,
      maxCandidates
    });
    candidate = interior.candidate;
    limited = interior.limited;
    examined += interior.examined;
    const remaining = maxCandidates - examined;
    if (candidate === null && remaining > 0 && !limited && relation.allowOuterFallback === true) {
      const outer = searchCandidates({
        sourcePort,
        targetPort,
        sourceLanes,
        targetLanes,
        horizontal: normalized.horizontal.filter(({ outer: isOuter }) => isOuter),
        obstacles,
        allowDirect: false,
        maxCandidates: remaining
      });
      candidate = outer.candidate;
      limited = outer.limited;
      examined += outer.examined;
      fallback = candidate !== null;
    }
  } else {
    const outer = searchCandidates({
      sourcePort,
      targetPort,
      sourceLanes,
      targetLanes,
      horizontal: normalized.horizontal.filter(({ outer }) => outer),
      obstacles,
      allowDirect: false,
      maxCandidates
    });
    candidate = outer.candidate;
    limited = outer.limited;
    examined += outer.examined;
  }
  return { candidate, examined, limited, fallback };
}

function routeEdge(edge, normalized) {
  const source = normalized.cardsById.get(edge.sourceId);
  const target = normalized.cardsById.get(edge.targetId);
  if (!source) return { omitted: { ...edge, reason: "missing-source" } };
  if (!target) return { omitted: { ...edge, reason: "missing-target" } };
  if (source.id === target.id) return { omitted: { ...edge, reason: "self-edge" } };

  const obstacles = inflatedObstacles(
    normalized.cardsById,
    normalized.clearance,
    source.id,
    target.id
  );
  let remaining = normalized.maxCandidates;
  let limited = false;
  let candidate = null;
  let fallback = false;
  let relation = null;
  for (const strategy of relationStrategies(source, target)) {
    if (remaining < 1) break;
    const result = searchRelation(strategy, source, target, obstacles, normalized, remaining);
    remaining -= result.examined;
    limited ||= result.limited;
    if (result.candidate === null) continue;
    relation = strategy;
    candidate = result.candidate;
    fallback = result.fallback;
    break;
  }
  if (candidate === null && remaining < 1) limited = true;

  if (candidate === null || relation === null) {
    return { omitted: { ...edge, reason: limited ? "search-limit" : "no-route" } };
  }
  return {
    route: {
      ...edge,
      direction: relation.direction,
      sameCell:
        source.levelIndex === target.levelIndex && source.categoryIndex === target.categoryIndex,
      sourceSide: relation.sourceSide,
      targetSide: relation.targetSide,
      usedOuterRail: candidate.usedOuterRail,
      fallback,
      points: candidate.points
    },
    sourceStub: candidate.sourceStub,
    targetStub: candidate.targetStub
  };
}

function pointKey(candidate) {
  return `${String(candidate.x)},${String(candidate.y)}`;
}

function busKey(kind, nodeId, side, points) {
  return `${kind}\0${nodeId}\0${side}\0${pointKey(points[0])}\0${pointKey(points[1])}`;
}

function createBuses(routed) {
  const groups = new Map();
  const add = (kind, nodeId, side, points, key) => {
    if (samePoint(points[0], points[1])) return;
    const id = busKey(kind, nodeId, side, points);
    const group = groups.get(id) ?? { kind, nodeId, side, points, edgeKeys: [] };
    group.edgeKeys.push(key);
    groups.set(id, group);
  };
  for (const entry of routed) {
    add(
      "egress",
      entry.route.sourceId,
      entry.route.sourceSide,
      entry.sourceStub,
      entry.route.edgeKey
    );
    add(
      "ingress",
      entry.route.targetId,
      entry.route.targetSide,
      entry.targetStub,
      entry.route.edgeKey
    );
  }
  return [...groups.values()]
    .filter(({ edgeKeys }) => edgeKeys.length > 1)
    .map((bus) => ({ ...bus, edgeKeys: [...bus.edgeKeys].sort() }))
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.nodeId.localeCompare(right.nodeId) ||
        left.side.localeCompare(right.side) ||
        pointKey(left.points[0]).localeCompare(pointKey(right.points[0])) ||
        pointKey(left.points[1]).localeCompare(pointKey(right.points[1]))
    );
}

/**
 * Routes exact-ID Research edges through measured, pre-authorized orthogonal channels.
 * The function owns no DOM or session state and omits an edge when no bounded safe route exists.
 */
export function routeResearchTreeEdges(input) {
  const normalized = normalizeInput(input);
  const routed = [];
  const omitted = [];
  for (const edge of normalized.edges) {
    const result = routeEdge(edge, normalized);
    if (result.route) routed.push(result);
    else omitted.push(result.omitted);
  }
  return deepFreeze({
    routes: routed.map(({ route }) => route),
    buses: createBuses(routed),
    omitted
  });
}
