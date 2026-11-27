import { getTheaterDestination } from "./top-bar/model.js";

function emptyMessage(container, message) {
  if (!container) return;
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const text = document.createElement("p");
  text.textContent = message;
  empty.appendChild(text);
  container.replaceChildren(empty);
}

let activeGraphSimulation = null;

function conditionSummary(step) {
  if (step.edgeStatus === "base") return "Base Town";
  if (step.conditions.length === 0) return "No world-state prerequisites";
  return step.conditions.map((condition) => condition.text).join(" AND ");
}

function createPathStep(step) {
  const element = document.createElement("div");
  element.className = "path-step";
  element.dataset.status = step.edgeStatus;

  const name = document.createElement("strong");
  name.textContent = step.townName;
  const id = document.createElement("small");
  id.className = "string-id";
  id.textContent = step.townId;
  const owner = document.createElement("small");
  const ownerText = document.createElement("em");
  ownerText.textContent = `Owner: ${step.ownerName}`;
  owner.appendChild(ownerText);
  const conditions = document.createElement("small");
  conditions.textContent = `Condition: ${conditionSummary(step)}`;

  element.append(name, document.createElement("br"), id, document.createElement("br"), owner);
  element.append(document.createElement("br"), conditions);
  return element;
}

function createArrow(direction, assetUrl) {
  const wrapper = document.createElement("div");
  wrapper.className = `path-arrow ${direction === "down" ? "vertical align-right" : "horizontal"}`;
  const image = document.createElement("img");
  image.src = assetUrl(direction === "down" ? "icons/path-down.svg" : "icons/path-right.svg");
  image.alt = direction === "down" ? "down to" : "to";
  wrapper.appendChild(image);
  return wrapper;
}

export function renderOverridePaths(projection, assetUrl) {
  const container = document.getElementById("override-path-display");
  if (!container) return;
  container.replaceChildren();
  if (!projection || projection.paths.length === 0) {
    emptyMessage(container, "This town is a final state with no further overrides.");
    return;
  }

  if (projection.diagnostics.length > 0) {
    const diagnostics = document.createElement("aside");
    diagnostics.className = "override-diagnostics";
    const heading = document.createElement("strong");
    heading.textContent = "Override diagnostics";
    const list = document.createElement("ul");
    for (const entry of projection.diagnostics) {
      const item = document.createElement("li");
      item.textContent = entry.message;
      list.appendChild(item);
    }
    diagnostics.append(heading, list);
    container.appendChild(diagnostics);
  }

  projection.paths.forEach((path, pathIndex) => {
    const pathContainer = document.createElement("div");
    pathContainer.className = "path-container";
    const heading = document.createElement("h4");
    heading.textContent = `Path ${String(pathIndex + 1)}`;
    pathContainer.appendChild(heading);

    const rows = [];
    for (let start = 0; start < path.length; start += 2) {
      const row = document.createElement("div");
      row.className = `path-row${rows.length % 2 === 1 ? " reverse" : ""}`;
      const firstStep = path[start];
      const secondStep = path[start + 1];
      row.appendChild(createPathStep(firstStep));
      if (secondStep) {
        row.appendChild(createArrow("right", assetUrl));
        row.appendChild(createPathStep(secondStep));
      }
      rows.push(row);
      pathContainer.appendChild(row);
      if (start + 2 < path.length) {
        pathContainer.appendChild(createArrow("down", assetUrl));
      }
    }
    container.appendChild(pathContainer);
  });
}

function graphMarkerStatus(edge) {
  if (edge.status === "active") return "active";
  if (edge.status === "locked" || edge.status === "indeterminate") return "implausible";
  return "inactive";
}

export function renderOverrideGraph(projection, assetUrl, onSelectTown = null) {
  const d3 = globalThis.d3;
  const container = d3?.select("#override-flowchart-display");
  if (!container) return;
  activeGraphSimulation?.stop();
  activeGraphSimulation = null;
  container.selectAll("*").remove();
  if (!projection || projection.nodes.length === 0) {
    container.append("p").text("No override data for this town.");
    return;
  }

  const nodes = projection.nodes.map((node) => ({ ...node, label: node.name }));
  const edges = projection.edges.map((edge) => ({
    ...edge,
    source: edge.sourceId,
    target: edge.targetId,
    markerStatus: graphMarkerStatus(edge)
  }));
  const node = container.node();
  const width = node.getBoundingClientRect().width;
  const height = node.getBoundingClientRect().height;
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);
  const group = svg.append("g");
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(edges)
        .id((entry) => entry.id)
        .distance(250)
        .strength(0.5)
    )
    .force("charge", d3.forceManyBody().strength(-800))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(100));
  activeGraphSimulation = simulation;

  svg
    .append("defs")
    .selectAll("marker")
    .data(["active", "inactive", "implausible"])
    .join("marker")
    .attr("id", (status) => `arrow-${status}`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 35)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5");

  const links = group
    .append("g")
    .selectAll("path")
    .data(edges)
    .join("path")
    .attr("class", (edge) => `link override-${edge.status}`)
    .attr("marker-end", (edge) => `url(#arrow-${edge.markerStatus})`);

  const edgeLabels = group
    .append("g")
    .selectAll("g")
    .data(edges)
    .join("g")
    .attr("class", "edge-label");
  edgeLabels.append("rect").attr("class", "edge-label-bg");
  edgeLabels
    .append("text")
    .selectAll("tspan")
    .data((edge) => [
      {
        text: edge.isActive
          ? "ACTIVE LINEAGE"
          : edge.availableFromActiveNode
            ? "AVAILABLE NEXT"
            : edge.status.toUpperCase()
      },
      ...(edge.historicallyTraversed
        ? [{ text: `Traversed ${String(edge.traversalCount)} time(s)` }]
        : []),
      {
        text: `Priority: ${String(edge.conditionCount)} condition(s), reference ${String(edge.referencePosition + 1)}`
      },
      ...(edge.conditions.length > 0 ? edge.conditions : [{ text: "No world-state prerequisites" }])
    ])
    .join("tspan")
    .attr("x", 0)
    .attr("dy", "1.2em")
    .text((entry) => entry.text);

  const closeButtons = edgeLabels
    .append("g")
    .attr("class", "close-label-btn")
    .on("click", (event) => {
      event.stopPropagation();
      d3.select(event.currentTarget.parentNode).classed("active", false);
    });
  closeButtons.append("rect").attr("width", 16).attr("height", 16).attr("rx", 3);
  closeButtons
    .append("image")
    .attr("href", assetUrl("icons/close-icon.svg"))
    .attr("width", 16)
    .attr("height", 16);

  const graphNodes = group.append("g").selectAll("g").data(nodes).join("g").attr("class", "node");
  graphNodes.append("rect").attr("width", 150).attr("height", 60).attr("x", -75).attr("y", -30);
  graphNodes
    .append("text")
    .text((entry) => entry.label)
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em");

  graphNodes.on("click", (event, entry) => {
    event.stopPropagation();
    onSelectTown?.(entry.id);
  });

  graphNodes.call(
    d3
      .drag()
      .on("start", (event, entry) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        entry.fx = entry.x;
        entry.fy = entry.y;
      })
      .on("drag", (event, entry) => {
        entry.fx = event.x;
        entry.fy = event.y;
      })
      .on("end", (event, entry) => {
        if (!event.active) simulation.alphaTarget(0);
        entry.fx = null;
        entry.fy = null;
      })
  );

  links.on("click", (event, edge) => {
    event.stopPropagation();
    const label = edgeLabels.filter((entry) => entry === edge);
    label.classed("active", !label.classed("active"));
  });
  svg.on("click", () => edgeLabels.classed("active", false));

  simulation.on("tick", () => {
    links.attr(
      "d",
      (edge) => `M${edge.source.x},${edge.source.y} L${edge.target.x},${edge.target.y}`
    );
    graphNodes.attr("transform", (entry) => `translate(${entry.x},${entry.y})`);
    edgeLabels.attr(
      "transform",
      (edge) =>
        `translate(${(edge.source.x + edge.target.x) / 2}, ${(edge.source.y + edge.target.y) / 2})`
    );
    edgeLabels.each(function sizeLabel() {
      const textElement = d3.select(this).select("text").node();
      if (!textElement) return;
      const box = textElement.getBBox();
      d3.select(this)
        .select(".edge-label-bg")
        .attr("x", box.x - 4)
        .attr("y", box.y - 4)
        .attr("width", box.width + 8)
        .attr("height", box.height + 8);
      d3.select(this)
        .select(".close-label-btn")
        .attr("transform", `translate(${box.x + box.width - 8}, ${box.y - 8})`);
    });
  });
  svg.call(
    d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => group.attr("transform", event.transform))
  );
}

export function initTownOverridesModule(
  windowManager,
  projectionProvider,
  assetUrl,
  onSelectTown = null
) {
  const pane = document.getElementById("pane-overrides");
  const townList = document.getElementById("override-town-list");
  const tabs = document.getElementById("overrides-tabs");
  if (!pane || !townList || !tabs) return null;

  let selectedBaseTownId = null;
  let currentProjection = null;

  function showProjection(projection) {
    currentProjection = projection;
    renderOverridePaths(projection, assetUrl);
    if (document.getElementById("override-flowchart-display")?.classList.contains("active")) {
      renderOverrideGraph(projection, assetUrl, onSelectTown);
    }
  }

  function refresh() {
    const lens = projectionProvider();
    townList.replaceChildren();
    if (!lens || lens.roots.length === 0) {
      selectedBaseTownId = null;
      currentProjection = null;
      const item = document.createElement("li");
      item.textContent = "No override networks available.";
      townList.appendChild(item);
      emptyMessage(
        document.getElementById("override-path-display"),
        "Scenario override analysis is unavailable."
      );
      if (document.getElementById("override-flowchart-display")?.classList.contains("active")) {
        renderOverrideGraph(null, assetUrl, onSelectTown);
      }
      return;
    }

    for (const root of lens.roots) {
      const item = document.createElement("li");
      item.textContent = root.baseTownName;
      item.dataset.townId = root.baseTownId;
      if (selectedBaseTownId === root.baseTownId) item.classList.add("active");
      item.addEventListener("click", () => {
        selectedBaseTownId = root.baseTownId;
        for (const sibling of townList.children) sibling.classList.remove("active");
        item.classList.add("active");
        showProjection(root);
        onSelectTown?.(root.baseTownId);
      });
      townList.appendChild(item);
    }

    const selected = lens.byBaseTownId[selectedBaseTownId];
    if (selected) {
      showProjection(selected);
    } else {
      selectedBaseTownId = null;
      currentProjection = null;
      emptyMessage(
        document.getElementById("override-path-display"),
        "Select a base town to inspect its override paths."
      );
      if (document.getElementById("override-flowchart-display")?.classList.contains("active")) {
        renderOverrideGraph(null, assetUrl, onSelectTown);
      }
    }
  }

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest(".pane-tab");
    if (!button) return;
    for (const sibling of tabs.querySelectorAll(".pane-tab")) sibling.classList.remove("active");
    for (const content of document.querySelectorAll("#override-content-wrapper .tab-content")) {
      content.classList.remove("active");
    }
    button.classList.add("active");
    document.getElementById(`override-${button.dataset.tab}-display`)?.classList.add("active");
    if (button.dataset.tab === "flowchart" && currentProjection) {
      renderOverrideGraph(currentProjection, assetUrl, onSelectTown);
    }
  });

  windowManager.register(
    "overrides",
    getTheaterDestination("overrides")?.label,
    pane,
    refresh
  );

  function selectTown(townId) {
    const lens = projectionProvider();
    if (!lens) return false;
    const root = lens.roots.find((entry) => entry.nodes.some((node) => node.id === townId));
    if (!root) return false;
    selectedBaseTownId = root.baseTownId;
    refresh();
    windowManager.open("overrides");
    return true;
  }

  return { refresh, selectTown };
}
