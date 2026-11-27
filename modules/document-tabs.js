const DOCUMENT_TAB_NAVIGATION_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

export function nextDocumentTabIndex(currentIndex, tabCount, key) {
  if (!Number.isInteger(currentIndex) || currentIndex < 0) {
    throw new RangeError("A valid current document-tab index is required.");
  }
  if (!Number.isInteger(tabCount) || tabCount < 1 || currentIndex >= tabCount) {
    throw new RangeError("A positive document-tab count containing the current index is required.");
  }

  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  return currentIndex;
}

/**
 * Owns only the local Save/Load presentation for one document manager.
 */
export function createDocumentTabController(root) {
  if (!root?.querySelectorAll || !root?.addEventListener) {
    throw new TypeError("A document-tab root is required.");
  }

  const tabs = [...root.querySelectorAll('[role="tab"][data-document-tab]')];
  if (tabs.length < 2) {
    throw new TypeError("A document-tab root requires at least two tabs.");
  }

  const documentRoot = root.ownerDocument ?? globalThis.document;
  const entries = tabs.map((tab) => {
    const id = tab.dataset.documentTab;
    const panelId = tab.getAttribute("aria-controls");
    const panel = panelId ? documentRoot?.getElementById(panelId) : null;
    if (!id || !panel || !root.contains(panel)) {
      throw new TypeError("Every document tab must control a panel inside its root.");
    }
    return { id, tab, panel };
  });

  if (new Set(entries.map(({ id }) => id)).size !== entries.length) {
    throw new TypeError("Document-tab identifiers must be unique within a manager.");
  }

  let activeId =
    entries.find(({ tab }) => tab.getAttribute("aria-selected") === "true")?.id ?? entries[0].id;
  let destroyed = false;

  function synchronize({ focus = false } = {}) {
    for (const entry of entries) {
      const active = entry.id === activeId;
      entry.tab.setAttribute("aria-selected", String(active));
      entry.tab.tabIndex = active ? 0 : -1;
      entry.panel.hidden = !active;
      if (active && focus) entry.tab.focus({ preventScroll: true });
    }
    root.dataset.activeDocumentTab = activeId;
  }

  function activate(id, options = {}) {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) throw new RangeError(`Unknown document tab: ${String(id)}`);

    const changed = activeId !== id;
    activeId = id;
    synchronize(options);
    return changed;
  }

  function onClick(event) {
    const tab = event.target.closest?.('[role="tab"][data-document-tab]');
    if (!tab || !root.contains(tab)) return;
    activate(tab.dataset.documentTab);
  }

  function onKeydown(event) {
    if (!DOCUMENT_TAB_NAVIGATION_KEYS.has(event.key)) return;
    const currentIndex = entries.findIndex(({ tab }) => tab === event.target);
    if (currentIndex < 0) return;

    event.preventDefault();
    const nextIndex = nextDocumentTabIndex(currentIndex, entries.length, event.key);
    activate(entries[nextIndex].id, { focus: true });
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  synchronize();

  return Object.freeze({
    activate,
    getActiveTabId: () => activeId,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      return true;
    }
  });
}
