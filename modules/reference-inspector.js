const LIFE_STATUS = Object.freeze({ 0: "Dead", 1: "Alive", 2: "Imprisoned" });

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

function factList(entries) {
  const list = element("dl", "inspector-fact-list");
  for (const [term, description, className = ""] of entries.filter(([, value]) => value !== null)) {
    const row = element("div", "inspector-fact-row");
    row.append(element("dt", "", term), element("dd", className, String(description)));
    list.appendChild(row);
  }
  return list;
}

function relationshipButton(relationship, groupLabel) {
  if (!relationship.navigable) {
    const label = element(
      "span",
      "reference-unresolved",
      relationship.name || relationship.entityId
    );
    label.title =
      relationship.resolution === "ambiguous"
        ? "This exact ID resolves to more than one supported record kind."
        : "The referenced exact ID is not available in this manifest.";
    return label;
  }
  const button = element("button", "reference-link", relationship.name || relationship.entityId);
  button.type = "button";
  button.dataset.referenceAction = "push";
  button.dataset.entityType = relationship.entityType;
  button.dataset.entityId = relationship.entityId;
  button.dataset.referenceGroup = groupLabel;
  button.dataset.referenceLinkKey = [
    relationship.direction,
    relationship.category,
    relationship.position,
    relationship.entityType,
    relationship.entityId
  ].join(":");
  button.title = `Open ${relationship.entityType} reference`;
  return button;
}

function materializeRelationshipList(details, relationships, groupLabel) {
  if (details.dataset.materialized === "true") return;
  details.dataset.materialized = "true";
  const list = element("ol", "inspector-numbered-list reference-relationship-list");
  list.setAttribute("role", "list");
  for (const relationship of relationships) {
    const item = element("li", "reference-relationship-row");
    const content = element("div", "inspector-list-entry");
    const identity = element("div", "reference-relationship-identity");
    identity.appendChild(relationshipButton(relationship, groupLabel));
    const provenance = element(
      "small",
      "reference-provenance",
      relationship.provenanceOnly
        ? `${relationship.category} · provenance only`
        : relationship.category
    );
    const authored = [
      `position ${String(relationship.position + 1)}`,
      relationship.value0 === null ? null : `Value0 ${String(relationship.value0)}`,
      relationship.value1 === null ? null : `Value1 ${String(relationship.value1)}`
    ]
      .filter(Boolean)
      .join(" · ");
    content.append(identity, provenance, element("small", "reference-authored-detail", authored));
    item.appendChild(content);
    list.appendChild(item);
  }
  details.appendChild(list);
}

function relationshipSections(projection) {
  const fragment = document.createDocumentFragment();
  const groups = new Map();
  for (const relationship of projection.relationships) {
    const label = relationship.category || "Related records";
    (groups.get(label) ?? groups.set(label, []).get(label)).push(relationship);
  }
  for (const [label, relationships] of [...groups].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const details = element("details", "neo-accordion reference-lazy-list");
    details.dataset.referenceGroup = label;
    const summary = element("summary", "", `${label} (${String(relationships.length)})`);
    details.appendChild(summary);
    details.addEventListener(
      "toggle",
      () => {
        if (details.open) materializeRelationshipList(details, relationships, label);
      },
      { once: true }
    );
    fragment.appendChild(details);
  }
  return fragment;
}

function appearanceList(projection) {
  const details = element("details", "neo-accordion reference-appearance-list");
  details.open = true;
  details.appendChild(
    element("summary", "", `Appearance evidence (${String(projection.appearances.length)})`)
  );
  const note = element(
    "p",
    "context-source-note",
    "These are authored parent relationships, not an exact NPC position or a guaranteed random-member spawn."
  );
  details.appendChild(note);
  if (projection.appearances.length === 0) {
    details.appendChild(
      element("p", "is-unavailable", "No authored map-linked appearance was found.")
    );
    return details;
  }
  const list = element("ul", "neo-list reference-evidence-list");
  for (const appearance of projection.appearances) {
    const item = element("li", "reference-evidence-row");
    item.dataset.appearanceState = appearance.state;
    const status = element("strong", "reference-evidence-status", appearance.state);
    const description = element("span", "", appearance.name || "Unmapped relationship");
    item.append(status, description);
    if (appearance.parentType && appearance.parentId) {
      const button = element("button", "action-btn reference-show-map", "Show on Map");
      button.type = "button";
      button.dataset.referenceAction = "show-map";
      button.dataset.entityType = appearance.parentType === "spawnArea" ? "spawnArea" : "town";
      button.dataset.entityId = appearance.parentId;
      if (appearance.occurrenceId && appearance.parentType === "town") {
        button.dataset.instanceId = appearance.occurrenceId;
      }
      item.appendChild(button);
    }
    list.appendChild(item);
  }
  details.appendChild(list);
  return details;
}

function overview(projection) {
  const section = element("section", "inspector-section reference-overview");
  section.append(element("h4", "inspector-section-heading", "Reference Overview"));
  const entries = [
    ["Type", projection.identity.subtype],
    ["Stable ID", projection.identity.stableId, "is-monospace"],
    [
      "Scenario",
      projection.scenario.available
        ? "Current scenario projected"
        : "Unavailable — static relationships only"
    ]
  ];
  if (projection.scenario.characterLifeStatus !== null) {
    entries.push([
      "Life status",
      LIFE_STATUS[projection.scenario.characterLifeStatus] ?? "Unknown"
    ]);
  }
  if (projection.scenario.factionRelation) {
    entries.push([
      "Player relation",
      `${String(projection.scenario.factionRelation.value)} (${projection.scenario.factionRelation.classification})`
    ]);
  }
  section.appendChild(factList(entries));
  return section;
}

function authoredFacts(projection) {
  const facts = [];
  if (projection.facts.bounty) {
    facts.push(["Bounty", `c.${String(projection.facts.bounty.amount ?? 0)}`]);
    facts.push(["Bounty chance", String(projection.facts.bounty.chance ?? 0)]);
    facts.push(["Bounty fuzz", String(projection.facts.bounty.fuzz ?? 0)]);
  }
  if (projection.facts.value !== null) facts.push(["Authored value", projection.facts.value]);
  if (projection.facts.weight !== null) facts.push(["Authored weight", projection.facts.weight]);
  if (facts.length === 0 && projection.authoredConditions.length === 0) return null;
  const section = element("section", "inspector-section");
  section.append(element("h4", "inspector-section-heading", "Authored Facts"));
  if (facts.length > 0) section.appendChild(factList(facts));
  if (projection.authoredConditions.length > 0) {
    const details = element("details", "neo-accordion");
    details.appendChild(
      element("summary", "", `Conditions (${String(projection.authoredConditions.length)})`)
    );
    const list = element("ul", "neo-list");
    for (const condition of projection.authoredConditions) {
      list.appendChild(
        element(
          "li",
          "",
          `${condition.name} · required Value0 ${String(condition.value0 ?? "unknown")}`
        )
      );
    }
    details.appendChild(list);
    section.appendChild(details);
  }
  return section;
}

/** Safe, once-wired renderer for curated reference content in the Context Inspector. */
export function createReferenceInspector({ container, onNavigate, onShowOnMap } = {}) {
  if (!container) throw new TypeError("Reference inspector requires a container element.");
  if (typeof onNavigate !== "function" || typeof onShowOnMap !== "function") {
    throw new TypeError("Reference inspector requires navigation and map callbacks.");
  }
  let currentProjection = null;
  container.addEventListener("click", (event) => {
    const action = event.target.closest("[data-reference-action]");
    if (!action || !container.contains(action)) return;
    if (action.dataset.referenceAction === "push") {
      onNavigate(
        { entityType: action.dataset.entityType, entityId: action.dataset.entityId },
        action
      );
    } else if (action.dataset.referenceAction === "show-map") {
      onShowOnMap(
        {
          entityType: action.dataset.entityType,
          entityId: action.dataset.entityId,
          instanceId: action.dataset.instanceId || null
        },
        action
      );
    }
  });

  return Object.freeze({
    render(projection) {
      currentProjection = projection;
      container.replaceChildren();
      if (!projection?.available) {
        container.appendChild(
          element(
            "p",
            "context-error",
            "This exact reference is unavailable in the loaded manifest."
          )
        );
        return;
      }
      const facts = authoredFacts(projection);
      container.append(overview(projection));
      if (facts) container.appendChild(facts);
      const relationships = element("section", "inspector-section");
      relationships.append(
        element("h4", "inspector-section-heading", "Relationships"),
        relationshipSections(projection)
      );
      if (projection.relationships.length === 0) {
        relationships.appendChild(
          element("p", "is-unavailable", "No supported direct relationships.")
        );
      }
      container.append(relationships, appearanceList(projection));
    },
    clear() {
      currentProjection = null;
      container.replaceChildren();
    },
    getProjection() {
      return currentProjection;
    }
  });
}
