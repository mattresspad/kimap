import {
  EQUIPMENT_LOCKER_SLOTS,
  EquipmentLockerPresentationSession,
  createEquipmentLockerProjection,
  createEquipmentLockerView
} from "./equipment-locker-model.js";
import { getTheaterDestination } from "./top-bar/model.js";

const GRID_NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End"
]);

const KIND_LABELS = Object.freeze({
  weapon: "Weapon",
  crossbow: "Crossbow",
  armour: "Armour",
  bag: "Bag",
  limbReplacement: "Limb Replacement",
  item: "Item",
  mapItem: "Map Item",
  nestItem: "Nest Item",
  character: "Character"
});

const DETAIL_FIELDS = Object.freeze({
  weapon: [
    ["Cut damage multiplier", "cut damage multiplier"],
    ["Blunt damage multiplier", "blunt damage multiplier"],
    ["Pierce damage multiplier", "pierce damage multiplier"],
    ["Attack modifier", "attack mod"],
    ["Defence modifier", "defence mod"],
    ["Indoors modifier", "indoors mod"],
    ["Armour penetration", "armour penetration"],
    ["Bleed multiplier", "bleed mult"],
    ["Animal damage multiplier", "animal damage mult"],
    ["Human damage multiplier", "human damage mult"],
    ["Robot damage multiplier", "robot damage mult"],
    ["Can block", "can block"]
  ],
  crossbow: [
    ["Accuracy deviation at 0 skill", "accuracy deviation at 0 skill"],
    ["Accuracy at perfect skill", "accuracy perfect skill"],
    ["Range", "range"],
    ["Minimum reload time", "reload time min"],
    ["Maximum reload time", "reload time max"],
    ["Shot speed", "shot speed"],
    ["Pierce damage", "pierce damage"],
    ["Skill modifier", "skill mod"]
  ],
  armour: [
    ["Class", "class name"],
    ["Cut defence bonus", "cut def bonus"],
    ["Blunt defence bonus", "blunt def bonus"],
    ["Cut into stun", "cut into stun"],
    ["Hardness", "hardness"],
    ["Combat attack bonus", "combat attk bonus"],
    ["Combat defence bonus", "combat def bonus"],
    ["Combat speed multiplier", "combat speed mult"],
    ["Dexterity multiplier", "dexterity mult"],
    ["Dodge multiplier", "dodge mult"],
    ["Stealth multiplier", "stealth mult"],
    ["Weather protection", "weather protection amount"]
  ],
  bag: [
    ["Storage width", "storage size width"],
    ["Storage height", "storage size height"],
    ["Encumbrance effect", "encumbrance effect"],
    ["Stackable bonus minimum", "stackable bonus minimum"],
    ["Stackable bonus multiplier", "stackable bonus mult"],
    ["Combat speed multiplier", "combat speed mult"],
    ["Athletics multiplier", "athletics mult"]
  ],
  limbReplacement: [
    ["Hit points", "HP"],
    ["Athletics multiplier", "athletics mult"],
    ["Dexterity multiplier", "dexterity mult"],
    ["Strength multiplier", "strength mult"],
    ["Stealth multiplier", "stealth mult"],
    ["Swimming multiplier", "swimming mult"]
  ],
  item: [
    ["Charges", "charges"],
    ["Stackable", "stackable"],
    ["Item function", "item function"],
    ["Quality", "quality"]
  ],
  mapItem: [],
  nestItem: []
});

const SUMMARY_FIELDS = Object.freeze({
  weapon: ["attack mod", "defence mod", "indoors mod", "armour penetration"],
  crossbow: [
    "accuracy deviation at 0 skill",
    "accuracy perfect skill",
    "range",
    "reload time min",
    "reload time max",
    "pierce damage"
  ],
  armour: [
    "combat attk bonus",
    "combat def bonus",
    "combat speed mult",
    "stealth mult",
    "weather protection amount"
  ],
  bag: [
    "encumbrance effect",
    "stackable bonus minimum",
    "stackable bonus mult",
    "combat speed mult",
    "athletics mult"
  ],
  limbReplacement: ["HP", "athletics mult", "dexterity mult", "strength mult", "stealth mult"],
  item: [],
  mapItem: [],
  nestItem: []
});

function createElement(tagName, className = "", text = null) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== null) element.textContent = text;
  return element;
}

function createButton(className, text, action = null) {
  const button = createElement("button", className, text);
  button.type = "button";
  if (action) button.dataset.lockerAction = action;
  return button;
}

function formatAuthoredValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  }
  if (typeof value === "string" && value.trim() !== "") return value;
  return "—";
}

function formatReferenceValues(reference) {
  return `Value0: ${formatAuthoredValue(reference.value0)} · Value1: ${formatAuthoredValue(reference.value1)} · Value2: ${formatAuthoredValue(reference.value2)}`;
}

function appendFacts(container, rows) {
  const list = createElement("dl", "equipment-locker-facts");
  for (const [label, value] of rows) {
    const row = createElement("div", "equipment-locker-facts__row");
    row.append(createElement("dt", "", label), createElement("dd", "", value));
    list.appendChild(row);
  }
  container.appendChild(list);
}

function createRegion(title, className) {
  const region = createElement("section", `equipment-locker-region ${className}`);
  region.appendChild(createElement("h2", "equipment-locker-heading", title));
  return region;
}

function selectedContext(projection, snapshot) {
  const selection = snapshot.selection;
  if (selection?.source === "catalog") {
    const record = projection.recordsByKey[selection.key] ?? null;
    return record ? { record, occurrence: null, location: "catalog" } : null;
  }
  if (selection?.source !== "occurrence") return null;
  const occurrence = snapshot.occurrences.find(({ id }) => id === selection.occurrenceId);
  if (!occurrence) return null;
  const record = projection.recordsByKey[occurrence.itemKey] ?? null;
  if (!record) return null;
  const slotId = Object.keys(snapshot.equipment).find(
    (candidate) => snapshot.equipment[candidate] === occurrence.id
  );
  return {
    record,
    occurrence,
    location: slotId ? "equipment" : "storage",
    slotId: slotId ?? null
  };
}

function createBadge(text, modifier = "") {
  return createElement("span", `equipment-locker-badge${modifier ? ` is-${modifier}` : ""}`, text);
}

function createCatalogRecordButton(record, snapshot) {
  const button = createButton("equipment-locker-catalog-item", "");
  button.dataset.lockerCatalogKind = record.kind;
  button.dataset.lockerCatalogId = record.id;
  button.dataset.lockerCatalogKey = record.key;
  button.dataset.lockerFocus = `catalog:${record.key}`;
  const selected =
    snapshot.selection?.source === "catalog" && snapshot.selection.key === record.key;
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-removed", record.removed);
  button.setAttribute("aria-pressed", String(selected));
  button.append(
    createElement("span", "equipment-locker-catalog-item__name", record.name),
    createElement("span", "equipment-locker-catalog-item__id", record.id)
  );
  const metadata = [];
  if (record.footprint) metadata.push(`${record.footprint.width}×${record.footprint.height}`);
  if (record.compatibleSlotIds?.length > 0) metadata.push("Equippable");
  if (metadata.length > 0) {
    button.appendChild(
      createElement("span", "equipment-locker-catalog-item__meta", metadata.join(" · "))
    );
  }
  if (record.removed) button.appendChild(createBadge("Removed", "removed"));
  return button;
}

function createCatalogToolbar(tab, projection, snapshot, view) {
  const toolbar = createElement("div", "equipment-locker-catalog-toolbar");
  const searchLabel = createElement("label", "equipment-locker-search-field");
  searchLabel.appendChild(createElement("span", "equipment-locker-search__label", `Search ${tab}`));
  const input = createElement("input", "equipment-locker-search");
  input.type = "search";
  input.placeholder = "Name or full stable ID";
  input.value = snapshot.queries[tab];
  input.dataset.lockerSearch = tab;
  input.dataset.lockerFocus = `search:${tab}`;
  searchLabel.appendChild(input);

  const toggle = createElement("label", "equipment-locker-removed-toggle");
  const checkbox = createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = snapshot.showRemoved;
  checkbox.dataset.lockerRemovedToggle = "";
  checkbox.dataset.lockerFocus = `removed:${tab}`;
  toggle.append(checkbox, document.createTextNode(" Show removed records"));

  const count =
    tab === "items"
      ? `${view.eligibleItemCount} portable items`
      : `${view.eligibleCharacterCount} characters`;
  toolbar.append(searchLabel, toggle, createElement("p", "equipment-locker-catalog-count", count));
  if (projection.diagnostics.length > 0) {
    toolbar.appendChild(
      createElement(
        "p",
        "equipment-locker-catalog-note",
        `${projection.diagnostics.length} data note${projection.diagnostics.length === 1 ? "" : "s"} retained.`
      )
    );
  }
  return toolbar;
}

function renderItemsCatalog(panel, projection, snapshot, view) {
  panel.appendChild(createCatalogToolbar("items", projection, snapshot, view));
  const categories = createElement("div", "equipment-locker-categories");
  categories.dataset.lockerPanel = "items";
  for (const category of view.itemCategories) {
    const details = createElement("details", "equipment-locker-category");
    details.dataset.lockerCategory = category.key;
    details.dataset.lockerCategoryTab = "items";
    details.open = category.open;
    const summary = createElement("summary", "equipment-locker-category-summary");
    summary.dataset.lockerFocus = `category:items:${category.key}`;
    const count = view.itemQuery
      ? `Count: ${category.count} of ${category.totalCount}`
      : `Count: ${category.totalCount}`;
    summary.append(
      createElement("span", "equipment-locker-category-name", category.label),
      createElement("span", "equipment-locker-category-count", count)
    );
    const list = createElement("div", "equipment-locker-catalog-list");
    for (const key of category.recordKeys) {
      list.appendChild(createCatalogRecordButton(projection.recordsByKey[key], snapshot));
    }
    details.append(summary, list);
    categories.appendChild(details);
  }
  if (view.itemSearchEmpty) {
    categories.appendChild(
      createElement("p", "equipment-locker-empty", "No portable items match this search.")
    );
  }
  panel.appendChild(categories);
}

function renderCharactersCatalog(panel, projection, snapshot, view) {
  panel.appendChild(createCatalogToolbar("characters", projection, snapshot, view));
  const categories = createElement("div", "equipment-locker-categories");
  categories.dataset.lockerPanel = "characters";
  const details = createElement("details", "equipment-locker-category");
  details.dataset.lockerCategory = "characters";
  details.dataset.lockerCategoryTab = "characters";
  details.open =
    view.characterQuery !== "" || snapshot.openCategoryKeys.characters.includes("characters");
  const summary = createElement("summary", "equipment-locker-category-summary");
  summary.dataset.lockerFocus = "category:characters:characters";
  const countText = view.characterQuery
    ? `Count: ${view.visibleCharacterKeys.length} of ${view.eligibleCharacterCount}`
    : `Count: ${view.eligibleCharacterCount}`;
  summary.append(
    createElement("span", "equipment-locker-category-name", "Authored Templates"),
    createElement("span", "equipment-locker-category-count", countText)
  );
  const list = createElement("div", "equipment-locker-catalog-list");
  for (const key of view.visibleCharacterKeys) {
    const record = projection.recordsByKey[key];
    const button = createCatalogRecordButton(record, snapshot);
    button.dataset.lockerCharacterId = record.id;
    button.appendChild(
      createElement(
        "span",
        "equipment-locker-catalog-item__meta",
        record.loadout.hasEvidence ? "Authored loadout evidence" : "No authored loadout"
      )
    );
    list.appendChild(button);
  }
  details.append(summary, list);
  categories.appendChild(details);
  if (view.characterSearchEmpty) {
    categories.appendChild(
      createElement("p", "equipment-locker-empty", "No characters match this search.")
    );
  }
  panel.appendChild(categories);
}

function renderCatalog(host, projection, snapshot, view) {
  host.className = "equipment-column equipment-locker-region equipment-locker-catalog";
  const heading = createElement("h2", "equipment-locker-heading", "Equipment Catalog");
  const tabs = createElement("div", "equipment-locker-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Equipment Locker catalog");
  for (const tab of ["items", "characters"]) {
    const label = tab === "items" ? "Items" : "Characters";
    const button = createButton("equipment-locker-tab", label);
    button.dataset.lockerTab = tab;
    button.dataset.lockerFocus = `tab:${tab}`;
    button.id = `equipment-locker-tab-${tab}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(snapshot.activeTab === tab));
    button.setAttribute("aria-controls", `equipment-locker-panel-${tab}`);
    button.tabIndex = snapshot.activeTab === tab ? 0 : -1;
    button.classList.toggle("is-active", snapshot.activeTab === tab);
    if (tab === "characters" && !projection.characterAvailable) button.disabled = true;
    tabs.appendChild(button);
  }
  const panels = ["items", "characters"].map((tab) => {
    const panel = createElement("div", "equipment-locker-catalog-panel");
    panel.id = `equipment-locker-panel-${tab}`;
    panel.dataset.lockerPanelRoot = tab;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `equipment-locker-tab-${tab}`);
    panel.tabIndex = -1;
    panel.hidden = tab !== snapshot.activeTab;
    if (!panel.hidden) {
      if (tab === "items") renderItemsCatalog(panel, projection, snapshot, view);
      else renderCharactersCatalog(panel, projection, snapshot, view);
    }
    return panel;
  });
  host.replaceChildren(heading, tabs, ...panels);
  const scroller = host.querySelector(`[data-locker-panel="${snapshot.activeTab}"]`);
  if (scroller) scroller.scrollTop = snapshot.catalogScrollTop[snapshot.activeTab];
}

function createFootprintTile(record, className = "equipment-locker-tile") {
  const tile = createElement("span", className);
  tile.style.setProperty("--locker-w", String(record.footprint?.width ?? 1));
  tile.style.setProperty("--locker-h", String(record.footprint?.height ?? 1));
  tile.append(
    createElement("span", "equipment-locker-tile__name", record.name),
    createElement("span", "equipment-locker-tile__id", record.id)
  );
  if (!record.footprint) tile.appendChild(createBadge("Footprint unavailable", "warning"));
  return tile;
}

function createTargetSelect(record, session) {
  if (record.compatibleSlotIds.length <= 1) return null;
  const wrapper = createElement("label", "equipment-locker-target");
  wrapper.appendChild(createElement("span", "", "Equip to"));
  const select = createElement("select");
  select.dataset.lockerTarget = "";
  select.dataset.lockerFocus = "preview:target";
  const defaultSlot = session.resolveDefaultSlot(record.key);
  for (const slotId of record.compatibleSlotIds) {
    const slot = EQUIPMENT_LOCKER_SLOTS.find(({ id }) => id === slotId);
    const option = createElement("option", "", slot?.label ?? slotId);
    option.value = slotId;
    option.selected = slotId === defaultSlot;
    select.appendChild(option);
  }
  wrapper.appendChild(select);
  return wrapper;
}

function renderPreview(projection, snapshot, session) {
  const region = createRegion("Preview", "equipment-locker-preview");
  const body = createElement("div", "equipment-locker-preview-body");
  const context = selectedContext(projection, snapshot);
  if (!context) {
    body.appendChild(
      createElement(
        "p",
        "equipment-locker-empty",
        "Select an item or character to inspect it without changing the Locker."
      )
    );
    region.appendChild(body);
    return region;
  }
  const { record, occurrence, location } = context;
  const stage = createElement("div", "equipment-locker-preview-stage");
  if (record.kind === "character") {
    stage.appendChild(createBadge("Authored Loadout Template", "template"));
  } else {
    stage.appendChild(createFootprintTile(record));
  }
  const identity = createElement("div", "equipment-locker-preview-identity");
  identity.append(
    createElement("strong", "equipment-locker-preview-name", record.name),
    createElement("span", "equipment-locker-preview-id", record.id),
    createElement("span", "equipment-locker-preview-kind", KIND_LABELS[record.kind] ?? record.kind)
  );
  if (occurrence)
    identity.appendChild(createBadge(location === "equipment" ? "Equipped" : "Stored"));
  if (record.removed) identity.appendChild(createBadge("Removed", "removed"));
  body.append(stage, identity);
  if (record.kind === "character") {
    body.appendChild(
      createElement(
        "p",
        "equipment-locker-catalog-note",
        "This template is read-only. Candidate selection and loadout replacement remain a later guided step."
      )
    );
  } else {
    const target = createTargetSelect(record, session);
    if (target) body.appendChild(target);
    const actions = createElement("div", "equipment-locker-actions");
    const equip = createButton("", "Equip", "equip");
    equip.dataset.lockerFocus = "preview:equip";
    equip.disabled = !record.equipable;
    actions.appendChild(equip);
    if (!occurrence) {
      const store = createButton("", "Add to Storage", "add-storage");
      store.dataset.lockerFocus = "preview:add-storage";
      store.disabled = !record.storable;
      actions.appendChild(store);
    } else {
      if (location === "equipment") {
        const store = createButton("", "Move to Storage", "move-storage");
        store.dataset.lockerFocus = "preview:move-storage";
        store.disabled = !record.storable;
        actions.appendChild(store);
      }
      const remove = createButton("secondary", "Remove", "remove");
      remove.dataset.lockerFocus = "preview:remove";
      actions.appendChild(remove);
    }
    body.appendChild(actions);
  }
  region.appendChild(body);
  return region;
}

function renderEquipment(projection, snapshot) {
  const region = createRegion("Equipment", "equipment-locker-equipment");
  const scroller = createElement("div", "equipment-locker-equipment-scroll");
  scroller.dataset.lockerEquipmentScroller = "";
  const board = createElement("div", "equipment-locker-equipment-board");
  board.setAttribute("aria-label", "Equipped item slots");
  for (const slot of EQUIPMENT_LOCKER_SLOTS) {
    const occurrenceId = snapshot.equipment[slot.id];
    const occurrence = snapshot.occurrences.find(({ id }) => id === occurrenceId);
    const record = occurrence ? projection.recordsByKey[occurrence.itemKey] : null;
    const button = createButton("equipment-locker-slot", "");
    button.dataset.lockerSlot = slot.id;
    button.dataset.lockerGridItem = "equipment";
    button.dataset.lockerFocus = `equipment:${slot.id}`;
    button.tabIndex = snapshot.rovingEquipmentSlotId === slot.id ? 0 : -1;
    button.classList.toggle("is-occupied", Boolean(record));
    button.classList.toggle(
      "is-selected",
      Boolean(occurrenceId && snapshot.selection?.occurrenceId === occurrenceId)
    );
    button.setAttribute(
      "aria-pressed",
      String(Boolean(occurrenceId && snapshot.selection?.occurrenceId === occurrenceId))
    );
    button.setAttribute(
      "aria-label",
      record ? `${slot.label}: ${record.name}, ${record.id}` : `${slot.label}: Empty`
    );
    button.appendChild(createElement("span", "equipment-locker-slot__label", slot.label));
    if (record) {
      button.dataset.lockerOccurrenceId = occurrence.id;
      button.appendChild(createElement("span", "equipment-locker-slot__item-name", record.name));
    } else {
      button.appendChild(createElement("span", "equipment-locker-slot__empty", "Empty"));
    }
    board.appendChild(button);
  }
  scroller.appendChild(board);
  region.appendChild(scroller);
  return region;
}

function detailSection(title) {
  const section = createElement("section", "equipment-locker-detail-section");
  section.appendChild(createElement("h3", "", title));
  return section;
}

function appendReferenceRows(section, record) {
  const references = record.authored.referenceCategories;
  for (const [category, entries] of Object.entries(references)) {
    if (entries.length === 0) continue;
    const group = createElement("div", "equipment-locker-template-group");
    const label =
      category === "ammo" ? "Ammunition" : category === "part coverage" ? "Coverage" : category;
    group.appendChild(createElement("h4", "", label));
    const list = createElement("ul", "equipment-locker-reference-list");
    for (const reference of entries) {
      const row = createElement("li", "equipment-locker-reference-item");
      row.append(
        createElement("strong", "", reference.name),
        createElement("span", "", reference.id ?? "Missing identity"),
        createElement("span", "", formatReferenceValues(reference))
      );
      list.appendChild(row);
    }
    group.appendChild(list);
    section.appendChild(group);
  }
}

function renderItemDetails(container, record) {
  const overview = detailSection("Selected Item");
  appendFacts(overview, [
    ["Name", record.name],
    ["Stable ID", record.id],
    ["Kind", KIND_LABELS[record.kind] ?? record.kind],
    [
      "Footprint",
      record.footprint ? `${record.footprint.width} × ${record.footprint.height}` : "—"
    ],
    [
      "Compatible slots",
      record.compatibleSlotIds.length > 0
        ? record.compatibleSlotIds
            .map((id) => EQUIPMENT_LOCKER_SLOTS.find((slot) => slot.id === id)?.label ?? id)
            .join(", ")
        : "Storage only"
    ],
    ["Weight", record.weight === null ? "—" : `${formatAuthoredValue(record.weight)} kg`],
    ["Authored value", formatAuthoredValue(record.value)]
  ]);
  if (record.description) {
    const description = createElement("p", "equipment-locker-description", record.description);
    description.tabIndex = 0;
    description.setAttribute("aria-label", "Authored item description");
    overview.appendChild(description);
  }
  container.appendChild(overview);
  const fields = DETAIL_FIELDS[record.kind] ?? [];
  if (fields.length > 0) {
    const authored = detailSection("Authored Effects");
    appendFacts(
      authored,
      fields.map(([label, key]) => [label, formatAuthoredValue(record.authored.values[key])])
    );
    container.appendChild(authored);
  }
  const references = detailSection("Authored References");
  appendReferenceRows(references, record);
  if (references.childElementCount > 1) container.appendChild(references);
  appendDataNotes(container, record.diagnostics);
}

function appendDataNotes(container, diagnostics) {
  if (diagnostics.length === 0) return;
  const notes = detailSection("Data Notes");
  const list = createElement("ul", "equipment-locker-reference-list");
  for (const entry of diagnostics)
    list.appendChild(createElement("li", "equipment-locker-reference-item", entry.message));
  notes.appendChild(list);
  container.appendChild(notes);
}

function createCandidateRow(reference, projection, snapshot) {
  const target = reference.targetKey ? projection.recordsByKey[reference.targetKey] : null;
  const hidden = Boolean(target?.removed && !snapshot.showRemoved);
  const wrapper = createElement("li", "equipment-locker-reference-item");
  let identity;
  if (target && !hidden && target.kind !== "weaponManufacturer") {
    identity = createButton("equipment-locker-reference-button", "");
    identity.dataset.lockerCandidateKind = target.kind;
    identity.dataset.lockerCandidateId = target.id;
    identity.dataset.lockerCandidateKey = target.key;
    identity.dataset.lockerFocus = `candidate:${target.key}`;
    identity.append(createElement("strong", "", target.name), createElement("span", "", target.id));
  } else {
    identity = createElement("span", "equipment-locker-reference-button");
    identity.append(
      createElement("strong", "", target?.name ?? reference.name),
      createElement("span", "", target?.id ?? reference.id ?? "Missing identity")
    );
  }
  wrapper.append(identity, createElement("span", "", formatReferenceValues(reference)));
  if (reference.status !== "resolved")
    wrapper.appendChild(createBadge(reference.status, "warning"));
  if (hidden) wrapper.appendChild(createBadge("Hidden removed record", "removed"));
  return wrapper;
}

function appendTemplateGroup(
  container,
  title,
  references,
  projection,
  snapshot,
  competing = false
) {
  if (references.length === 0) return;
  const group = createElement("section", "equipment-locker-template-group");
  group.appendChild(createElement("h4", "", title));
  if (competing) group.appendChild(createBadge("Choice required", "warning"));
  const list = createElement("ul", "equipment-locker-reference-list");
  for (const reference of references)
    list.appendChild(createCandidateRow(reference, projection, snapshot));
  group.appendChild(list);
  container.appendChild(group);
}

function renderCharacterDetails(container, character, projection, snapshot) {
  const overview = detailSection("Authored Loadout Template");
  appendFacts(overview, [
    ["Name", character.name],
    ["Stable ID", character.id],
    ["Armour grade", formatAuthoredValue(character.authored.values["armour grade"])],
    [
      "Armour upgrade chance",
      formatAuthoredValue(character.authored.values["armour upgrade chance"])
    ]
  ]);
  const description = createElement(
    "p",
    "equipment-locker-description",
    "These are authored generation candidates, not a guaranteed or current inventory. This view never changes the Locker."
  );
  description.tabIndex = 0;
  description.setAttribute("aria-label", "Character template explanation");
  overview.appendChild(description);
  container.appendChild(overview);
  if (!character.loadout.hasEvidence) {
    container.appendChild(
      createElement("p", "equipment-locker-empty", "No authored loadout evidence is available.")
    );
    appendDataNotes(container, character.diagnostics);
    return;
  }
  const template = detailSection("Candidates");
  for (const group of character.loadout.slotGroups) {
    appendTemplateGroup(
      template,
      group.label,
      group.candidates,
      projection,
      snapshot,
      group.competing
    );
  }
  appendTemplateGroup(template, "Inventory", character.loadout.inventory, projection, snapshot);
  appendTemplateGroup(
    template,
    "Weapon manufacturers",
    character.loadout.weaponManufacturers,
    projection,
    snapshot
  );
  appendTemplateGroup(
    template,
    "Unresolved evidence",
    character.loadout.unresolved,
    projection,
    snapshot
  );
  container.appendChild(template);
  appendDataNotes(container, character.diagnostics);
}

function renderEquipmentSummary(container, projection, snapshot) {
  const section = detailSection("Equipment Summary");
  const occupied = EQUIPMENT_LOCKER_SLOTS.flatMap((slot) => {
    const occurrenceId = snapshot.equipment[slot.id];
    const occurrence = snapshot.occurrences.find(({ id }) => id === occurrenceId);
    const record = occurrence ? projection.recordsByKey[occurrence.itemKey] : null;
    return record ? [{ slot, record }] : [];
  });
  if (occupied.length === 0) {
    section.appendChild(
      createElement("p", "equipment-locker-empty", "No items are currently equipped.")
    );
    container.appendChild(section);
    return;
  }
  const knownWeights = occupied.filter(({ record }) => record.weight !== null);
  const totalWeight = knownWeights.reduce((total, { record }) => total + record.weight, 0);
  appendFacts(section, [
    ["Occupied slots", String(occupied.length)],
    [
      "Authored weight",
      knownWeights.length === occupied.length
        ? `${formatAuthoredValue(totalWeight)} kg`
        : `${formatAuthoredValue(totalWeight)} kg (incomplete)`
    ]
  ]);
  const list = createElement("div", "equipment-locker-summary-list");
  for (const { slot, record } of occupied) {
    const row = createElement("div", "equipment-locker-summary-row");
    const effects = (SUMMARY_FIELDS[record.kind] ?? [])
      .filter((key) => Object.hasOwn(record.authored.values, key))
      .map((key) => `${key}: ${formatAuthoredValue(record.authored.values[key])}`);
    row.append(
      createElement("strong", "equipment-locker-summary-row__slot", slot.label),
      createElement("span", "equipment-locker-summary-row__name", record.name),
      createElement("span", "equipment-locker-summary-row__id", record.id),
      createElement(
        "span",
        "equipment-locker-summary-row__effects",
        effects.length > 0 ? effects.join(" · ") : "No curated equipped effects authored."
      )
    );
    list.appendChild(row);
  }
  section.appendChild(list);
  container.appendChild(section);
}

function renderDetails(projection, snapshot) {
  const region = createRegion("Details & Effects", "equipment-locker-details");
  const scroller = createElement("div", "equipment-locker-details-scroll");
  const context = selectedContext(projection, snapshot);
  if (!context) {
    scroller.appendChild(
      createElement(
        "p",
        "equipment-locker-empty",
        "Select a catalog or placed record to inspect exact authored facts."
      )
    );
  } else if (context.record.kind === "character") {
    renderCharacterDetails(scroller, context.record, projection, snapshot);
  } else {
    renderItemDetails(scroller, context.record);
  }
  renderEquipmentSummary(scroller, projection, snapshot);
  region.appendChild(scroller);
  return region;
}

function renderStorage(projection, snapshot) {
  const region = createElement("section", "equipment-locker-region equipment-locker-storage");
  const header = createElement("div", "equipment-locker-storage-header");
  header.appendChild(
    createElement(
      "span",
      "equipment-locker-storage-count",
      `${snapshot.storage.placements.length} stored item${snapshot.storage.placements.length === 1 ? "" : "s"}`
    )
  );
  const toggle = createButton(
    "equipment-locker-storage-toggle",
    "Locker Storage",
    "storage-toggle"
  );
  toggle.id = "equipment-locker-storage-toggle";
  toggle.dataset.lockerFocus = "storage:toggle";
  toggle.setAttribute("aria-expanded", String(snapshot.storageExpanded));
  toggle.setAttribute("aria-controls", "equipment-locker-storage-body");
  header.appendChild(toggle);
  const clear = createButton("secondary", "Clear Locker", "clear-request");
  clear.dataset.lockerFocus = "storage:clear";
  clear.disabled = snapshot.occurrences.length === 0;
  header.appendChild(clear);
  region.setAttribute("aria-labelledby", toggle.id);
  region.appendChild(header);
  if (snapshot.clearConfirmationOpen) {
    const confirmation = createElement("div", "equipment-locker-confirmation");
    confirmation.setAttribute("role", "alert");
    confirmation.appendChild(
      createElement("p", "", "Clear every equipped and stored item from this Locker?")
    );
    const actions = createElement("div", "equipment-locker-actions");
    const confirm = createButton("contrast", "Clear Locker", "clear-confirm");
    confirm.dataset.lockerFocus = "clear:confirm";
    const cancel = createButton("secondary", "Cancel", "clear-cancel");
    cancel.dataset.lockerFocus = "clear:cancel";
    actions.append(confirm, cancel);
    confirmation.appendChild(actions);
    region.appendChild(confirmation);
  }
  const body = createElement("div", "equipment-locker-storage-body");
  body.id = "equipment-locker-storage-body";
  body.hidden = !snapshot.storageExpanded;
  const scroller = createElement("div", "equipment-locker-storage-scroll");
  scroller.dataset.lockerStorageScroller = "";
  scroller.dataset.lockerFocus = "storage:grid";
  scroller.tabIndex = snapshot.storage.placements.length === 0 ? 0 : -1;
  scroller.setAttribute("aria-label", "Stored equipment grid");
  const grid = createElement("div", "equipment-locker-storage-grid");
  grid.style.setProperty("--locker-storage-rows", String(snapshot.storage.rows));
  for (const placement of snapshot.storage.placements) {
    const occurrence = snapshot.occurrences.find(({ id }) => id === placement.occurrenceId);
    const record = occurrence ? projection.recordsByKey[occurrence.itemKey] : null;
    if (!record) continue;
    const button = createButton("equipment-locker-tile", "");
    button.dataset.lockerOccurrenceId = occurrence.id;
    button.dataset.lockerGridItem = "storage";
    button.dataset.lockerGridX = String(placement.x);
    button.dataset.lockerGridY = String(placement.y);
    button.dataset.lockerGridWidth = String(placement.width);
    button.dataset.lockerGridHeight = String(placement.height);
    button.dataset.lockerFocus = `storage:${occurrence.id}`;
    button.tabIndex = snapshot.rovingStorageOccurrenceId === occurrence.id ? 0 : -1;
    button.classList.toggle(
      "is-selected",
      snapshot.selection?.source === "occurrence" &&
        snapshot.selection.occurrenceId === occurrence.id
    );
    button.setAttribute(
      "aria-pressed",
      String(
        snapshot.selection?.source === "occurrence" &&
          snapshot.selection.occurrenceId === occurrence.id
      )
    );
    button.style.setProperty("--locker-x", String(placement.x + 1));
    button.style.setProperty("--locker-y", String(placement.y + 1));
    button.style.setProperty("--locker-w", String(placement.width));
    button.style.setProperty("--locker-h", String(placement.height));
    button.setAttribute("aria-label", `${record.name}, ${record.id}`);
    button.append(
      createElement("span", "equipment-locker-tile__name", record.name),
      createElement("span", "equipment-locker-tile__id", record.id)
    );
    grid.appendChild(button);
  }
  if (snapshot.storage.placements.length === 0) {
    grid.appendChild(
      createElement(
        "p",
        "equipment-locker-empty equipment-locker-storage__empty",
        "Storage is empty. Preview an item and add a copy here."
      )
    );
  }
  scroller.appendChild(grid);
  body.appendChild(scroller);
  region.appendChild(body);
  return region;
}

function captureWorkspaceScroll(host) {
  const result = {};
  for (const [key, selector] of Object.entries({
    equipment: "[data-locker-equipment-scroller]",
    storage: "[data-locker-storage-scroller]",
    details: ".equipment-locker-details-scroll"
  })) {
    const element = host.querySelector(selector);
    if (element) result[key] = { left: element.scrollLeft, top: element.scrollTop };
  }
  return result;
}

function restoreWorkspaceScroll(host, positions) {
  for (const [key, selector] of Object.entries({
    equipment: "[data-locker-equipment-scroller]",
    storage: "[data-locker-storage-scroller]",
    details: ".equipment-locker-details-scroll"
  })) {
    const element = host.querySelector(selector);
    const position = positions[key];
    if (element && position) {
      element.scrollLeft = position.left;
      element.scrollTop = position.top;
    }
  }
}

function renderWorkspace(host, projection, session, snapshot, positions = {}) {
  host.className = "equipment-column equipment-locker-workspace";
  const workbench = createElement("div", "equipment-locker-workbench");
  workbench.append(
    renderPreview(projection, snapshot, session),
    renderEquipment(projection, snapshot),
    renderDetails(projection, snapshot),
    renderStorage(projection, snapshot)
  );
  let status = host.querySelector(":scope > [data-locker-status]");
  const existingWorkbench = host.querySelector(":scope > .equipment-locker-workbench");
  if (status) {
    if (existingWorkbench) existingWorkbench.replaceWith(workbench);
    else host.prepend(workbench);
  } else {
    status = createElement("p", "equipment-locker-status");
    status.dataset.lockerStatus = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    host.replaceChildren(workbench, status);
  }
  const message = snapshot.status?.message ?? "";
  if (status.textContent !== message) status.textContent = message;
  const tone = snapshot.status?.tone ?? "neutral";
  status.dataset.tone = tone;
  status.className = `equipment-locker-status is-${tone}`;
  restoreWorkspaceScroll(host, positions);
}

function focusToken(element) {
  return element?.dataset?.lockerFocus ?? null;
}

function findFocusToken(root, token) {
  if (!token) return null;
  return [...root.querySelectorAll("[data-locker-focus]")].find(
    (element) => element.dataset.lockerFocus === token
  );
}

function focusGridTarget(root, group, identity) {
  const target = [...root.querySelectorAll(`[data-locker-grid-item="${group}"]`)].find((element) =>
    group === "equipment"
      ? element.dataset.lockerSlot === identity
      : element.dataset.lockerOccurrenceId === identity
  );
  target?.focus({ preventScroll: true });
}

function numericGridEntry(element) {
  const rect = element.getBoundingClientRect();
  return {
    element,
    id: element.dataset.lockerSlot ?? element.dataset.lockerOccurrenceId,
    x: Number(element.dataset.lockerGridX ?? rect.left),
    y: Number(element.dataset.lockerGridY ?? rect.top),
    width: Number(element.dataset.lockerGridWidth ?? rect.width),
    height: Number(element.dataset.lockerGridHeight ?? rect.height)
  };
}

function gridNavigationTarget(elements, currentElement, key, ctrlKey) {
  const entries = elements
    .map(numericGridEntry)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const current = entries.find(({ element }) => element === currentElement);
  if (!current) return null;
  if (ctrlKey && key === "Home") return entries[0]?.id ?? null;
  if (ctrlKey && key === "End") return entries.at(-1)?.id ?? null;
  const sameRow = entries.filter(({ y }) => y === current.y);
  if (key === "Home") return sameRow[0]?.id ?? current.id;
  if (key === "End") return sameRow.at(-1)?.id ?? current.id;
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;
  const candidates = entries.flatMap((entry) => {
    if (entry === current) return [];
    const dx = entry.x + entry.width / 2 - centerX;
    const dy = entry.y + entry.height / 2 - centerY;
    const valid =
      (key === "ArrowLeft" && dx < 0) ||
      (key === "ArrowRight" && dx > 0) ||
      (key === "ArrowUp" && dy < 0) ||
      (key === "ArrowDown" && dy > 0);
    if (!valid) return [];
    const primary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
    const secondary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
    return [{ ...entry, score: primary * 10 + secondary }];
  });
  candidates.sort(
    (left, right) => left.score - right.score || left.y - right.y || left.x - right.x
  );
  return candidates[0]?.id ?? current.id;
}

/** Initializes the session-retained Equipment Locker dressing room. */
export function initEquipmentLockerModule(windowManager, datasets) {
  const pane = document.getElementById("pane-equipment");
  const root = document.getElementById("equipment-locker-content");
  const catalogHost = document.getElementById("equipment-list-column");
  const workspaceHost = document.getElementById("equipment-simulation-column");
  if (!pane || !root || !catalogHost || !workspaceHost) {
    const message =
      "Equipment Locker is unavailable because its dressing-room interface could not be initialized.";
    console.error(message);
    windowManager.setAvailability("equipment", false, message);
    return null;
  }
  root.classList.add("equipment-locker-shell");
  let projection;
  let projectionFailed = false;
  try {
    projection = createEquipmentLockerProjection(datasets);
  } catch (error) {
    projectionFailed = true;
    console.error(
      "Equipment Locker projection failed; other Reference tools remain available.",
      error
    );
    projection = createEquipmentLockerProjection({});
  }
  let session;
  try {
    session = new EquipmentLockerPresentationSession({ projection });
  } catch (error) {
    console.error("Equipment Locker state could not be initialized.", error);
    windowManager.setAvailability(
      "equipment",
      false,
      "Equipment Locker is unavailable because its session state could not be initialized."
    );
    return null;
  }
  let rendered = false;
  let runtimeFailed = false;
  let unsubscribe = null;
  let pendingFocusToken = null;

  const disableLocker = (error) => {
    if (runtimeFailed) return;
    runtimeFailed = true;
    console.error(
      "Equipment Locker rendering failed; other Reference tools remain available.",
      error
    );
    const message =
      "Equipment Locker is unavailable because its dressing room could not be rendered safely.";
    catalogHost.replaceChildren(createElement("p", "equipment-locker-empty", message));
    workspaceHost.replaceChildren(createElement("p", "equipment-locker-empty", message));
    windowManager.setAvailability("equipment", false, message);
  };

  const render = (snapshot, changeType = "initial", changeDetail = null) => {
    if (changeType === "setCatalogScrollTop" || changeType === "setCatalogFocusIdentity") return;
    const active = pane.contains(document.activeElement) ? document.activeElement : null;
    const activeToken = focusToken(active);
    const queryCaret = active?.matches?.("[data-locker-search]") ? active.selectionStart : null;
    const positions = captureWorkspaceScroll(workspaceHost);
    const view = createEquipmentLockerView(projection, snapshot);
    renderCatalog(catalogHost, projection, snapshot, view);
    renderWorkspace(workspaceHost, projection, session, snapshot, positions);
    rendered = true;
    requestAnimationFrame(() => {
      let explicitTarget = null;
      if (changeType === "requestClear") {
        explicitTarget = findFocusToken(pane, "clear:cancel");
      } else if (changeType === "cancelClear") {
        explicitTarget = findFocusToken(pane, "storage:clear");
      } else if (changeType === "confirmClear") {
        explicitTarget = findFocusToken(pane, "storage:toggle");
      } else if (["addToStorage", "moveOccurrenceToStorage"].includes(changeType)) {
        explicitTarget = findFocusToken(pane, `storage:${changeDetail?.occurrenceId}`);
      } else if (["equipCatalogRecord", "equipOccurrence"].includes(changeType)) {
        explicitTarget = findFocusToken(pane, `equipment:${changeDetail?.slotId}`);
      } else if (changeType === "removeOccurrence") {
        explicitTarget = snapshot.rovingStorageOccurrenceId
          ? findFocusToken(pane, `storage:${snapshot.rovingStorageOccurrenceId}`)
          : findFocusToken(pane, `equipment:${snapshot.rovingEquipmentSlotId}`);
      }
      if (pendingFocusToken) {
        explicitTarget = findFocusToken(pane, pendingFocusToken) ?? explicitTarget;
        if (explicitTarget?.dataset.lockerFocus === pendingFocusToken) pendingFocusToken = null;
      }
      const target = explicitTarget ?? findFocusToken(pane, activeToken);
      if (target) {
        target.focus({ preventScroll: true });
        if (explicitTarget) target.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (queryCaret !== null && target.setSelectionRange)
          target.setSelectionRange(queryCaret, queryCaret);
      }
    });
  };

  const renderSafely = (snapshot, type = "initial", detail = null) => {
    if (runtimeFailed) return false;
    try {
      render(snapshot, type, detail);
      return true;
    } catch (error) {
      disableLocker(error);
      return false;
    }
  };
  unsubscribe = session.subscribe(({ type, detail, snapshot }) =>
    renderSafely(snapshot, type, detail)
  );
  const selected = () => selectedContext(projection, session.getSnapshot());
  const selectedTarget = () => pane.querySelector("[data-locker-target]")?.value ?? null;

  const onClick = (event) => {
    const tab = event.target.closest?.("[data-locker-tab]");
    if (tab && pane.contains(tab)) {
      session.setActiveTab(tab.dataset.lockerTab);
      return;
    }
    const catalogButton = event.target.closest?.("[data-locker-catalog-key]");
    if (catalogButton && catalogHost.contains(catalogButton)) {
      session.selectCatalogRecord(catalogButton.dataset.lockerCatalogKey);
      return;
    }
    const candidate = event.target.closest?.("[data-locker-candidate-key]");
    if (candidate && workspaceHost.contains(candidate)) {
      const target = projection.recordsByKey[candidate.dataset.lockerCandidateKey];
      pendingFocusToken = `catalog:${candidate.dataset.lockerCandidateKey}`;
      session.setActiveTab("items");
      session.setQuery("items", "");
      if (target?.categoryKey) session.setCategoryOpen("items", target.categoryKey, true);
      session.selectCatalogRecord(candidate.dataset.lockerCandidateKey);
      return;
    }
    const slot = event.target.closest?.("[data-locker-slot]");
    if (slot && workspaceHost.contains(slot)) {
      session.setRovingEquipmentSlotId(slot.dataset.lockerSlot);
      if (slot.dataset.lockerOccurrenceId)
        session.selectOccurrence(slot.dataset.lockerOccurrenceId);
      return;
    }
    const stored = event.target.closest?.('[data-locker-grid-item="storage"]');
    if (stored && workspaceHost.contains(stored)) {
      session.setRovingStorageOccurrenceId(stored.dataset.lockerOccurrenceId);
      session.selectOccurrence(stored.dataset.lockerOccurrenceId);
      return;
    }
    const action = event.target.closest?.("[data-locker-action]");
    if (!action || !pane.contains(action)) return;
    const context = selected();
    try {
      switch (action.dataset.lockerAction) {
        case "storage-toggle":
          session.setStorageExpanded(!session.getSnapshot().storageExpanded);
          break;
        case "add-storage":
          if (context?.record) session.addToStorage(context.record.key);
          break;
        case "equip":
          if (!context) break;
          if (context.occurrence) session.equipOccurrence(context.occurrence.id, selectedTarget());
          else session.equipCatalogRecord(context.record.key, selectedTarget());
          break;
        case "move-storage":
          if (context?.occurrence) session.moveOccurrenceToStorage(context.occurrence.id);
          break;
        case "remove":
          if (context?.occurrence) session.removeOccurrence(context.occurrence.id);
          break;
        case "clear-request":
          session.requestClear();
          break;
        case "clear-cancel":
          session.cancelClear();
          break;
        case "clear-confirm":
          session.confirmClear();
          break;
        default:
          break;
      }
    } catch (error) {
      console.warn("Equipment Locker action was rejected without changing the Locker.", error);
      session.reportValidation(
        error instanceof Error ? error.message : "That Locker action could not be completed."
      );
    }
  };

  const onInput = (event) => {
    if (event.target.matches?.("[data-locker-search]") && !event.isComposing) {
      session.setQuery(event.target.dataset.lockerSearch, event.target.value);
    }
  };
  const onChange = (event) => {
    if (event.target.matches?.("[data-locker-removed-toggle]"))
      session.setShowRemoved(event.target.checked);
  };
  const onToggle = (event) => {
    const disclosure = event.target.closest?.("details[data-locker-category]");
    if (!disclosure || !catalogHost.contains(disclosure)) return;
    const tab = disclosure.dataset.lockerCategoryTab;
    if (session.getSnapshot().queries[tab].trim() !== "") {
      if (!disclosure.open) requestAnimationFrame(() => (disclosure.open = true));
      return;
    }
    session.setCategoryOpen(tab, disclosure.dataset.lockerCategory, disclosure.open);
  };
  const onFocusIn = (event) => {
    const token = focusToken(event.target);
    if (token && catalogHost.contains(event.target))
      session.setCatalogFocusIdentity(session.getSnapshot().activeTab, token);
    const gridItem = event.target.closest?.("[data-locker-grid-item]");
    if (gridItem?.dataset.lockerGridItem === "equipment")
      session.setRovingEquipmentSlotId(gridItem.dataset.lockerSlot);
    else if (gridItem?.dataset.lockerGridItem === "storage")
      session.setRovingStorageOccurrenceId(gridItem.dataset.lockerOccurrenceId);
  };
  const onScroll = (event) => {
    const panel = event.target.closest?.("[data-locker-panel]");
    if (panel && catalogHost.contains(panel))
      session.setCatalogScrollTop(panel.dataset.lockerPanel, panel.scrollTop);
  };
  const onKeyDown = (event) => {
    const tab = event.target.closest?.("[data-locker-tab]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const available = [...catalogHost.querySelectorAll("[data-locker-tab]:not(:disabled)")];
      const current = available.indexOf(tab);
      if (current < 0) return;
      let targetIndex = current;
      if (event.key === "Home") targetIndex = 0;
      else if (event.key === "End") targetIndex = available.length - 1;
      else
        targetIndex =
          (current + (event.key === "ArrowLeft" ? -1 : 1) + available.length) % available.length;
      event.preventDefault();
      session.setActiveTab(available[targetIndex].dataset.lockerTab);
      requestAnimationFrame(() =>
        findFocusToken(pane, `tab:${available[targetIndex].dataset.lockerTab}`)?.focus()
      );
      return;
    }
    const gridItem = event.target.closest?.("[data-locker-grid-item]");
    if (!gridItem || !GRID_NAVIGATION_KEYS.has(event.key)) return;
    const group = gridItem.dataset.lockerGridItem;
    const elements = [...pane.querySelectorAll(`[data-locker-grid-item="${group}"]`)];
    const targetId = gridNavigationTarget(elements, gridItem, event.key, event.ctrlKey);
    if (!targetId) return;
    event.preventDefault();
    if (group === "equipment") session.setRovingEquipmentSlotId(targetId);
    else session.setRovingStorageOccurrenceId(targetId);
    requestAnimationFrame(() => focusGridTarget(pane, group, targetId));
  };

  pane.addEventListener("click", onClick);
  pane.addEventListener("input", onInput);
  pane.addEventListener("change", onChange);
  pane.addEventListener("toggle", onToggle, true);
  pane.addEventListener("focusin", onFocusIn);
  pane.addEventListener("scroll", onScroll, true);
  pane.addEventListener("keydown", onKeyDown);

  const onShow = () => {
    if (!rendered && !renderSafely(session.getSnapshot())) return;
    const snapshot = session.getSnapshot();
    requestAnimationFrame(() => {
      const token = snapshot.catalogFocusIdentity[snapshot.activeTab];
      findFocusToken(catalogHost, token)?.focus({ preventScroll: true });
    });
  };
  try {
    windowManager.register("equipment", getTheaterDestination("equipment")?.label, pane, onShow);
    windowManager.setAvailability(
      "equipment",
      projection.available,
      projection.available
        ? ""
        : projectionFailed
          ? "Equipment Locker is unavailable because its manifest data could not be projected safely."
          : "Equipment Locker is unavailable because this manifest contains no valid portable items."
    );
  } catch (error) {
    disableLocker(error);
  }
  return Object.freeze({
    projection,
    session,
    cleanup() {
      unsubscribe?.();
      unsubscribe = null;
      pane.removeEventListener("click", onClick);
      pane.removeEventListener("input", onInput);
      pane.removeEventListener("change", onChange);
      pane.removeEventListener("toggle", onToggle, true);
      pane.removeEventListener("focusin", onFocusIn);
      pane.removeEventListener("scroll", onScroll, true);
      pane.removeEventListener("keydown", onKeyDown);
    }
  });
}
