/** Presentation-only bookmarks; these never copy domain or navigation state. */
export function captureInspectorReading(container, scroller) {
  return {
    scrollTop: scroller.scrollTop,
    focus: container.contains(document.activeElement) ? document.activeElement : null,
    disclosures: [...container.querySelectorAll("details")].map((node, index) => ({
      node,
      key: node.dataset.referenceGroup ?? node.id ?? "",
      index,
      open: node.open
    }))
  };
}

export function restoreInspectorReading(container, scroller, reading, { focus = false } = {}) {
  if (!reading) return;
  const details = [...container.querySelectorAll("details")];
  for (const saved of reading.disclosures) {
    const target = container.contains(saved.node)
      ? saved.node
      : saved.key
        ? details.find((node) => (node.dataset.referenceGroup || node.id) === saved.key)
        : details[saved.index];
    if (!target) continue;
    target.open = saved.open;
    // Lazy reference groups need their retained contents before scroll restoration.
    if (target.open) target.dispatchEvent(new Event("toggle"));
  }
  if (focus && reading.focus?.isConnected && container.contains(reading.focus)) {
    reading.focus.focus({ preventScroll: true });
  }
  scroller.scrollTop = reading.scrollTop;
}
