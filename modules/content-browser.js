// kimap/modules/content-browser.js

import { getTheaterDestination } from "./top-bar/model.js";

function showEmpty(container, message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const text = document.createElement("p");
  text.textContent = message;
  empty.appendChild(text);
  container.replaceChildren(empty);
}

function appendRow(body, key, value) {
  const row = document.createElement("tr");
  const label = document.createElement("td");
  label.className = "fcs-key";
  label.textContent = key;
  const content = document.createElement("td");
  content.className = "fcs-val";
  content.textContent = value == null ? "—" : String(value);
  row.append(label, content);
  body.appendChild(row);
}

export function initContentBrowser(
  windowManager,
  browserData,
  { selectGeographic = null, getGeographicContext = null } = {}
) {
  const paneElement = document.getElementById("pane-content-browser");
  const sidebar = document.getElementById("browser-sidebar");
  const listContainer = document.getElementById("browser-list");
  const detailsContainer = document.getElementById("browser-details");
  const controlsContainer = document.querySelector(".browser-controls");

  const browserConfig = {
    "AI Packages": { data: browserData.aiPackage },
    Animals: { data: browserData.animal },
    Armour: { data: browserData.armour },
    Bags: { data: browserData.bags },
    Biomes: { data: browserData.biome },
    Buildings: { data: browserData.building },
    "Building Swaps": { data: browserData.buildingSwap },
    Campaigns: { data: browserData.factionCampaign },
    Characters: {
      data: browserData.character,
      filterFn: (entry) => entry.Referrers && entry.Referrers.length > 0
    },
    "Colour Schemes": { data: browserData.colourScheme },
    Crossbows: { data: browserData.crossbow },
    Effects: { data: browserData.effects },
    Factions: {
      data: browserData.faction,
      filterFn: (entry) => entry.Referrers && entry.Referrers.length > 0
    },
    "Game Starts": { data: browserData.gameStart },
    Items: { data: browserData.item },
    Manufacturers: { data: browserData.weaponManufacturer },
    "Map Items": { data: browserData.mapItem },
    "Nest Items": { data: browserData.nestItem },
    Races: { data: browserData.race },
    Research: { data: browserData.research },
    Resources: { data: browserData.resources },
    Seasons: { data: browserData.season },
    "Spawn Areas": { data: browserData.spawnArea, entityType: "spawnArea" },
    Squads: { data: browserData.squad },
    Stats: { data: browserData.stats },
    Towns: { data: browserData.town, entityType: "town" },
    "Trade Cultures": { data: browserData.tradeCulture },
    "Vendor Lists": { data: browserData.vendorList },
    Weather: { data: browserData.weather },
    Weapons: { data: browserData.weapon },
    "Weapon Models": { data: browserData.itemMaterialsWeapon },
    "World States": { data: browserData.worldState }
  };

  let currentCategory = null;
  let currentItems = [];
  let showUnreferenced = false;

  function renderGeographicDetails(context) {
    if (!context) {
      showEmpty(detailsContainer, "The selected map context is unavailable.");
      return;
    }
    const heading = document.createElement("h3");
    heading.textContent = context.title;
    const note = document.createElement("p");
    note.className = "context-source-note";
    note.textContent = "Canonical map context";
    const table = document.createElement("table");
    table.className = "fcs-table";
    const body = document.createElement("tbody");
    appendRow(body, "StringId", context.selection.entityId);
    if (context.kind === "town") {
      appendRow(body, "Active town", context.town.currentTown.name);
      appendRow(body, "Owner", context.town.currentTown.ownerName);
      appendRow(body, "Relation", context.town.currentTown.relationValue ?? "Unavailable");
      appendRow(body, "Occurrence", context.town.location?.instanceId ?? "No direct marker");
      appendRow(body, "Override status", context.town.selectedTown.branchStatus ?? "Base town");
    } else {
      appendRow(body, "Spawn occurrences", context.spawnArea?.occurrences?.length ?? 0);
      appendRow(body, "Weather", context.spawnArea?.weather?.join(", ") || "Clear / None");
      appendRow(body, "Diagnostics", context.diagnostics.length);
    }
    table.appendChild(body);
    detailsContainer.replaceChildren(heading, note, table);
  }

  function renderReferenceDetails(item) {
    const heading = document.createElement("h3");
    heading.textContent = item.Name;
    const table = document.createElement("table");
    table.className = "fcs-table";
    const body = document.createElement("tbody");
    for (const [key, value] of Object.entries(item.Values ?? {})) appendRow(body, key, value);
    appendRow(body, "StringId", item.StringId);
    if (item.Type) appendRow(body, "Type", item.Type);
    table.appendChild(body);
    const content = [heading, table];

    if (item.ReferenceCategories) {
      const references = document.createElement("div");
      references.style.marginTop = "1rem";
      for (const [category, entries] of Object.entries(item.ReferenceCategories)) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        const label = document.createElement("strong");
        label.textContent = category;
        const count = document.createElement("small");
        count.textContent = ` (${String(entries.length)})`;
        summary.append(label, count);
        const list = document.createElement("ul");
        for (const entry of entries) {
          const row = document.createElement("li");
          row.append(document.createTextNode(`${entry.Name} `));
          const id = document.createElement("small");
          id.style.opacity = "0.5";
          id.textContent = entry.StringId;
          row.appendChild(id);
          list.appendChild(row);
        }
        details.append(summary, list);
        references.appendChild(details);
      }
      content.push(references);
    }
    detailsContainer.replaceChildren(...content);
  }

  function renderDetails(item) {
    if (currentCategory?.entityType && selectGeographic) {
      const accepted = selectGeographic(currentCategory.entityType, item.StringId);
      if (accepted) renderGeographicDetails(getGeographicContext?.());
      else showEmpty(detailsContainer, "That geographic selection could not be opened.");
      return;
    }
    renderReferenceDetails(item);
  }

  function renderList(items) {
    listContainer.replaceChildren();
    if (items.length === 0) {
      showEmpty(listContainer, "No items found matching criteria.");
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "browser-item-row";
      const name = document.createElement("span");
      name.textContent = item.Name;
      const id = document.createElement("span");
      id.style.opacity = "0.5";
      id.style.fontSize = "0.8em";
      id.textContent = item.StringId;
      row.append(name, document.createTextNode(" "), id);
      row.addEventListener("click", () => {
        for (const sibling of listContainer.querySelectorAll(".browser-item-row")) {
          sibling.classList.remove("selected");
        }
        row.classList.add("selected");
        renderDetails(item);
      });
      fragment.appendChild(row);
    }
    listContainer.appendChild(fragment);
  }

  function applyFilters(searchTerm) {
    if (!currentItems || currentItems.length === 0) return;
    const term = searchTerm.toLowerCase();
    let filtered = currentItems.filter((item) => item.Name.toLowerCase().includes(term));
    if (!showUnreferenced && currentCategory?.filterFn) {
      filtered = filtered.filter(currentCategory.filterFn);
    }
    renderList(filtered);
  }

  function setupControls() {
    controlsContainer.replaceChildren();
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search items...";
    searchInput.id = "browser-search";
    searchInput.addEventListener("input", (event) => applyFilters(event.target.value));
    const label = document.createElement("label");
    label.className = "filter-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.role = "switch";
    input.checked = showUnreferenced;
    input.addEventListener("change", (event) => {
      showUnreferenced = event.target.checked;
      applyFilters(searchInput.value);
    });
    label.append(input, document.createTextNode(" Show Unreferenced"));
    controlsContainer.append(searchInput, label);
  }

  function populateSidebar() {
    sidebar.replaceChildren();
    for (const categoryName of Object.keys(browserConfig).sort()) {
      const configEntry = browserConfig[categoryName];
      const dataMap = configEntry.data;
      if (!dataMap || Object.keys(dataMap).length === 0) continue;
      const button = document.createElement("button");
      button.className = "browser-cat-btn";
      button.textContent = `${categoryName} (${String(Object.keys(dataMap).length)})`;
      button.addEventListener("click", () => {
        for (const sibling of sidebar.querySelectorAll(".browser-cat-btn")) {
          sibling.classList.remove("active");
        }
        button.classList.add("active");
        currentCategory = configEntry;
        currentItems = Object.values(dataMap).sort((left, right) =>
          left.Name.localeCompare(right.Name)
        );
        const searchInput = document.getElementById("browser-search");
        if (searchInput) searchInput.value = "";
        applyFilters("");
        showEmpty(detailsContainer, "Select an item to view details");
      });
      sidebar.appendChild(button);
    }
  }

  const onShow = () => {
    if (sidebar && sidebar.children.length === 0) {
      setupControls();
      populateSidebar();
    }
  };
  if (windowManager && paneElement) {
    windowManager.register(
      "browser",
      getTheaterDestination("browser")?.label,
      paneElement,
      onShow
    );
  }
}
