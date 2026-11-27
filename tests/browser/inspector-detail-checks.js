export async function detailChecks({ doc, view, get, click, search, check, delay, visible }) {
  const open = async (details) => {
    details.open = true;
    details.dispatchEvent(new view.Event("toggle"));
    await delay();
  };
  const lists = (selector) => {
    const matched = [...doc.querySelectorAll(selector)].filter(visible);
    check(matched.length > 0, "numbered Inspector lists are visible");
    for (const list of matched) {
      const rows = [...list.children].filter((node) => node.tagName === "LI");
      check(list.tagName === "OL" && rows.length > 0, "displayed rows use an ordered list");
      check(
        view.getComputedStyle(list).paddingLeft === "0px" &&
          view.getComputedStyle(list).counterReset.includes("inspector-row"),
        "each disclosure resets numbering and removes inherited indentation"
      );
      const bounds = list.getBoundingClientRect();
      for (const row of rows) {
        const body = row.querySelector(".inspector-list-entry");
        const rect = body.getBoundingClientRect();
        check(
          Math.abs(row.getBoundingClientRect().left - bounds.left) <= 1 &&
            rect.left > bounds.left &&
            rect.left < bounds.left + 40 &&
            rect.right <= bounds.right + 1,
          "number column begins at content edge, details fit beside it"
        );
      }
    }
    return matched;
  };
  await search("Lost Town", "Town");
  const population = [...doc.querySelectorAll(".inspector-presence details")].find(visible);
  await open(population);
  const residents = lists("#inspector-section-population .inspector-numbered-list")[0];
  const names = [...residents.querySelectorAll(".reference-link")].map((node) => node.textContent);
  check(
    names.length === 5 &&
      names[0] === "_ruined empty building (NO SELL)" &&
      names[4] === "lost library intact",
    "Lost Town retains its five residents in authored display order"
  );
  const longName = residents.querySelector(".reference-link");
  const originalText = longName.textContent;
  longName.textContent = "UnbrokenName".repeat(20);
  check(longName.scrollWidth <= longName.clientWidth + 1, "long unbroken population labels wrap");
  longName.textContent = originalText;
  const overrides = get("#inspector-section-scenario details");
  await open(overrides);
  check(
    get(".inspector-override-notice").textContent === "No connected overrides." &&
      visible(get(".inspector-override-notice")) &&
      !visible(get(".inspector-override-path")) &&
      !visible(get(".inspector-override-branches")),
    "isolated Lost Town has only No connected overrides"
  );

  const scroller = get("#info-panel-content");
  scroller.scrollTop = 90;
  const position = scroller.scrollTop;
  const firstResident = residents.querySelector(".reference-link");
  firstResident.click();
  await delay();
  check(
    get("#info-panel-title").textContent === originalText,
    "population entry keeps its reference destination"
  );
  const mapContext = get("#info-panel-map-context-btn");
  const mapIcon = mapContext.querySelector("img");
  const mapSource = mapIcon.src;
  mapIcon.src = "/__fixture-missing-icon.svg";
  await delay();
  check(
    mapContext.textContent.trim() === "Map Context" && visible(mapContext.querySelector("span")),
    "Map Context remains visibly labelled without artwork"
  );
  mapIcon.src = mapSource;
  click("#info-panel-map-context-btn");
  await delay();
  check(
    population.open &&
      overrides.open &&
      get("#inspector-section-population .inspector-presence ol") === residents &&
      Math.abs(scroller.scrollTop - position) <= 1,
    "Map Context retains population DOM, disclosures and scroll"
  );

  await search("Black Desert Ninjas", "Squad");
  const groups = [...doc.querySelectorAll(".reference-lazy-list")];
  check(
    groups.length > 1 && groups.every((group) => !group.querySelector("ol")),
    "reference relationships remain lazy before disclosure"
  );
  for (const group of groups) await open(group);
  const relationships = lists(".reference-relationship-list");
  const rowNames = relationships.map((list) => list.textContent);
  const referenceBody = get("#info-panel-reference-content").firstElementChild;
  scroller.scrollTop = 120;
  const refPosition = scroller.scrollTop;
  click("#info-panel-map-context-btn");
  await delay();
  click("#info-panel-return-reference-btn");
  await delay();
  check(
    get("#info-panel-reference-content").firstElementChild === referenceBody &&
      Math.abs(scroller.scrollTop - refPosition) <= 1 &&
      relationships.every((list, index) => list.textContent === rowNames[index]),
    "returning retains lazy relationship DOM, metadata and reading position"
  );
  const link = relationships.flatMap((list) => [
    ...list.querySelectorAll("[data-reference-action=push]")
  ])[0];
  const destination = link.textContent;
  link.click();
  await delay();
  check(
    get("#info-panel-title").textContent === destination,
    "relationship keeps its primary destination"
  );
  click("#info-panel-reference-back-btn");
  await delay();
  check(
    get("#info-panel-title").textContent === "Black Desert Ninjas",
    "relationship Back keeps its return destination"
  );

  await search("The Black Desert", "Spawn Area");
  lists("#inspector-section-population .inspector-numbered-list");
  const weather = get(".inspector-weather-list");
  const effects = [...weather.querySelectorAll("li")];
  check(
    effects.map((effect) => effect.textContent).join("|") === "Acidic Ground|Acidic Water|Gas",
    "Black Desert keeps alphabetical recorded weather labels"
  );
  check(
    effects.every((effect, index) => {
      const icon = effect.querySelector("img");
      const rect = effect.getBoundingClientRect();
      return (
        icon.src.includes("/inspector-") &&
        view.getComputedStyle(icon).filter === "none" &&
        icon.getBoundingClientRect().width === 17 &&
        icon.getBoundingClientRect().height === 17 &&
        (index === 0 || rect.top >= effects[index - 1].getBoundingClientRect().bottom)
      );
    }),
    "weather has vertical 17px authored-color icons"
  );
  const icon = effects[0].querySelector("img");
  const source = icon.src;
  icon.src = "/__fixture-missing-icon.svg";
  await delay();
  check(
    effects[0].textContent === "Acidic Ground" && visible(effects[0].querySelector("span")),
    "missing weather artwork retains its readable effect label"
  );
  icon.src = source;
}
