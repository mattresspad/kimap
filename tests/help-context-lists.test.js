import assert from "node:assert/strict";
import test from "node:test";
import { helpSections } from "../content/help-content.js";
import { initHelpGuide } from "../modules/help-guide.js";

const SUBJECTS = [
  "key-characters",
  "bounty-targets",
  "deadly-animals",
  "treasure-spots",
  "nest-treasures",
  "fancy-weapon-wielders",
  "narcotics",
  "prospecting",
  "faction-overview"
];

test("Context Lists guide gives each subject one focusable target with a named heading", () => {
  const chapter = helpSections.contextLists;
  assert.match(chapter, /id="guide-context-lists-title">Context Lists</u);
  for (const subject of SUBJECTS) {
    const sectionId = `guide-context-${subject}`;
    const headingId = `${sectionId}-title`;
    assert.equal(
      [...chapter.matchAll(new RegExp(`id="${sectionId}"`, "gu"))].length,
      1,
      `expected one ${sectionId} target`
    );
    assert.match(
      chapter,
      new RegExp(
        `<section id="${sectionId}" class="help-section" tabindex="-1" aria-labelledby="${headingId}">`,
        "u"
      )
    );
    assert.match(chapter, new RegExp(`<h4 id="${headingId}">`, "u"));
  }
});

test("Help navigation opens a Context target in the article and retains return focus", () => {
  const previousDocument = globalThis.document;
  const article = {
    innerHTML: "",
    querySelectorAll: () => [],
    contains: (element) => Boolean(element && article.innerHTML.includes(`id="${element.id}"`))
  };
  const pane = { id: "pane-help" };
  let tocClick;
  const toc = {
    addEventListener: (_type, listener) => {
      tocClick = listener;
    }
  };
  const calls = [];
  const manager = {
    register: (...args) => calls.push(["register", ...args]),
    openAndScrollTo: (...args) => calls.push(["openAndScrollTo", ...args])
  };
  globalThis.document = {
    getElementById(id) {
      if (id === "help-article") return article;
      if (id === "pane-help") return pane;
      if (id === "help-toc-list") return toc;
      return { id };
    }
  };

  try {
    const guide = initHelpGuide(manager);
    assert.match(article.innerHTML, /id="guide-context-lists" class="help-section" tabindex="-1"/u);
    assert.match(article.innerHTML, /id="guide-context-faction-overview"/u);
    assert.equal(calls[0][0], "register");

    const returnFocus = { id: "context-help-button" };
    guide.handleNavigation("guide-context-prospecting", { returnFocus });
    assert.deepEqual(calls.at(-1), [
      "openAndScrollTo",
      "help",
      "guide-context-prospecting",
      { returnFocus, scrollContainer: article, focusTarget: true }
    ]);

    const anchor = { getAttribute: () => "#guide-context-lists" };
    let prevented = false;
    tocClick({
      target: { closest: () => anchor },
      preventDefault: () => {
        prevented = true;
      }
    });
    assert.equal(prevented, true);
    assert.equal(calls.at(-1)[2], "guide-context-lists");
  } finally {
    globalThis.document = previousDocument;
  }
});
