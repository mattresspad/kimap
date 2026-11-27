import { getTheaterDestination } from "./top-bar/model.js";

function createElement(tagName, className = "", text = null) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== null) element.textContent = text;
  return element;
}

function formatNumber(value) {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value) {
  return value === null ? "—" : `${formatNumber(value * 100)}%`;
}

function formatMultiplier(value) {
  return value === null ? "—" : `${formatNumber(value)}×`;
}

function appendDefinitionList(section, rows) {
  const list = createElement("dl", "environment-details__facts");
  for (const [label, value] of rows) {
    const row = createElement("div", "environment-details__fact-row");
    row.append(createElement("dt", "", label), createElement("dd", "", value));
    list.appendChild(row);
  }
  section.appendChild(list);
}

function appendNamedList(section, label, entries, emptyText = "None reported") {
  const group = createElement("div", "environment-details__group");
  group.appendChild(createElement("h5", "", label));
  if (entries.length === 0) {
    group.appendChild(createElement("p", "environment-details__empty", emptyText));
  } else {
    const list = createElement("ul", "environment-details__list");
    for (const entry of entries)
      list.appendChild(createElement("li", "", entry.name ?? entry.label));
    group.appendChild(list);
  }
  section.appendChild(group);
}

function renderDetails(container, area) {
  const fragment = document.createDocumentFragment();

  const profile = createElement("section", "environment-details__section");
  profile.appendChild(createElement("h4", "", "Area Profile"));
  appendDefinitionList(profile, [
    ["Name", area.name],
    ["Stable ID", area.id],
    ["Farm-water usage", formatNumber(area.profile.farmWaterUsage)],
    ["Minimum weather strength", formatNumber(area.profile.weatherStrengthMinimum)],
    ["Maximum weather strength", formatNumber(area.profile.weatherStrengthMaximum)]
  ]);
  fragment.appendChild(profile);

  const environment = createElement("section", "environment-details__section");
  environment.appendChild(createElement("h4", "", "Environment"));
  appendNamedList(environment, "Source Seasons", area.environment.seasons, "No season source");
  appendNamedList(environment, "Source Weather", area.environment.weathers, "No weather source");
  appendNamedList(environment, "Zone Effects", area.environment.zoneEffects);
  appendNamedList(environment, "Weather Effects", area.environment.weatherEffects);
  if (area.environment.unresolved.length > 0) {
    const unavailable = createElement("div", "environment-details__unavailable");
    unavailable.appendChild(createElement("h5", "", "Unavailable References"));
    const list = createElement("ul", "environment-details__list");
    for (const reference of area.environment.unresolved) {
      list.appendChild(createElement("li", "", `${reference.kind}: ${reference.id}`));
    }
    unavailable.appendChild(list);
    environment.appendChild(unavailable);
  }
  fragment.appendChild(environment);

  const resources = createElement("section", "environment-details__section");
  resources.appendChild(createElement("h4", "", "Resources & Fertility"));
  appendDefinitionList(resources, [
    ["Arid", formatPercent(area.resources.fertility.arid)],
    ["Green", formatPercent(area.resources.fertility.green)],
    ["Swamp", formatPercent(area.resources.fertility.swamp)],
    ["Copper", formatMultiplier(area.resources.multipliers.copper)],
    ["Iron", formatMultiplier(area.resources.multipliers.iron)],
    ["Stone", formatMultiplier(area.resources.multipliers.stone)],
    ["Water", formatMultiplier(area.resources.multipliers.water)]
  ]);
  if (area.resources.status !== "available") {
    const missingId = area.resources.sourceId ? ` '${area.resources.sourceId}'` : "";
    resources.appendChild(
      createElement(
        "p",
        "environment-details__unavailable",
        area.resources.status === "unresolved-reference"
          ? `Resource target${missingId} is unavailable.`
          : "No resource target is linked to this area."
      )
    );
  }
  fragment.appendChild(resources);

  container.replaceChildren(fragment);
}

function createAreaButton(area) {
  const button = createElement("button", "environment-area-button", area.name);
  button.type = "button";
  button.dataset.environmentAreaId = area.id;
  button.setAttribute("aria-pressed", "false");
  return button;
}

function appendEffectGroup(card, title, effects) {
  if (effects.length === 0) return;
  const group = createElement("section", "environment-card__group");
  group.appendChild(createElement("h5", "", title));
  const list = createElement("ul", "environment-card__list");
  for (const effect of effects) list.appendChild(createElement("li", "", effect.label));
  group.appendChild(list);
  card.appendChild(group);
}

function createEnvironmentCard(area) {
  const card = createElement("article", "area-block environment-area-card");
  card.dataset.environmentAreaCard = area.id;
  card.appendChild(createAreaButton(area));
  appendEffectGroup(card, "Zone Effects", area.environment.zoneEffects);
  appendEffectGroup(card, "Weather Effects", area.environment.weatherEffects);

  if (area.environment.zoneEffects.length === 0 && area.environment.weatherEffects.length === 0) {
    card.appendChild(createElement("p", "environment-card__empty", "No reported effects"));
  }
  if (area.environment.unresolved.length > 0) {
    card.appendChild(
      createElement(
        "p",
        "environment-card__unavailable",
        "Some linked environment data is unavailable."
      )
    );
  }
  return card;
}

function createResourcesCard(area) {
  const card = createElement("article", "area-block environment-area-card");
  card.dataset.environmentAreaCard = area.id;
  card.appendChild(createAreaButton(area));

  if (area.resources.status !== "available") {
    card.appendChild(
      createElement("p", "environment-card__unavailable", "Resource data unavailable")
    );
    return card;
  }

  const availableFertility = [
    ["Arid", area.resources.fertility.arid],
    ["Green", area.resources.fertility.green],
    ["Swamp", area.resources.fertility.swamp]
  ].filter(([, value]) => value !== null && value > 0);
  if (availableFertility.length === 0) {
    card.appendChild(createElement("p", "environment-card__empty", "No available fertility"));
    return card;
  }

  const list = createElement("ul", "environment-card__list environment-card__fertility");
  for (const [label, value] of availableFertility) {
    const item = createElement("li");
    item.append(createElement("span", `environment-card__fertility-${label.toLowerCase()}`, label));
    item.append(document.createTextNode(`: ${formatPercent(value)}`));
    list.appendChild(item);
  }
  card.appendChild(list);
  return card;
}

function renderAreaLists(projection, seasonsContainer, resourcesContainer) {
  const seasons = document.createDocumentFragment();
  const resources = document.createDocumentFragment();
  for (const area of projection.areas) {
    if (
      area.environment.zoneEffects.length > 0 ||
      area.environment.weatherEffects.length > 0 ||
      area.environment.unresolved.length > 0
    ) {
      seasons.appendChild(createEnvironmentCard(area));
    }
    resources.appendChild(createResourcesCard(area));
  }
  seasonsContainer.replaceChildren(seasons);
  resourcesContainer.replaceChildren(resources);
}

function synchronizeSelectedArea(pane, selectedAreaId) {
  for (const button of pane.querySelectorAll("[data-environment-area-id]")) {
    const selected = button.dataset.environmentAreaId === selectedAreaId;
    button.setAttribute("aria-pressed", String(selected));
    button.closest("[data-environment-area-card]")?.classList.toggle("is-selected", selected);
  }
}

/**
 * Initializes Environment Info with one immutable projection and one delegated selection path.
 */
export function initEnvironmentInfoModule(windowManager, projection) {
  console.log("Environment Info Module Loading...");

  const paneElement = document.getElementById("pane-environment");
  const seasonsContainer = document.getElementById("env-seasons-list");
  const resourcesContainer = document.getElementById("env-resources-list");
  const detailsContainer = document.getElementById("env-details-list");
  if (!paneElement || !seasonsContainer || !resourcesContainer || !detailsContainer) {
    console.error("Environment Info: required pane elements were not found.");
    return;
  }

  let rendered = false;
  let selectedAreaId = null;

  paneElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-environment-area-id]");
    if (!button || !paneElement.contains(button)) return;
    const area = projection?.byId[button.dataset.environmentAreaId];
    if (!area) return;

    selectedAreaId = area.id;
    renderDetails(detailsContainer, area);
    synchronizeSelectedArea(paneElement, selectedAreaId);
  });

  const onShow = () => {
    if (!rendered) {
      if (projection) renderAreaLists(projection, seasonsContainer, resourcesContainer);
      else detailsContainer.textContent = "Environment data is unavailable.";
      rendered = true;
    }
    synchronizeSelectedArea(paneElement, selectedAreaId);
  };

  windowManager.register(
    "environment",
    getTheaterDestination("environment")?.label,
    paneElement,
    onShow
  );

  console.log("Environment Info Module Registered.");
}
