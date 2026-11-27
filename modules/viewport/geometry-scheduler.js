/** One frame, two priorities: a passive widget can never invalidate its report/viewport inputs. */
export function createViewportGeometryScheduler({
  positionViewport,
  positionWidget,
  requestFrame = requestAnimationFrame
}) {
  let frame = null;
  let viewportDirty = false;
  let widgetDirty = false;
  let flushing = false;

  function schedule() {
    if (frame === null && !flushing) frame = requestFrame(flush);
  }
  function flush() {
    frame = null;
    flushing = true;
    try {
      if (viewportDirty) {
        viewportDirty = false;
        widgetDirty = true;
        positionViewport();
      }
      // Report bounds invalidated during viewport fitting are consumed in this same frame.
      if (widgetDirty) {
        widgetDirty = false;
        positionWidget();
      }
    } finally {
      flushing = false;
      if (viewportDirty || widgetDirty) schedule();
    }
  }
  return Object.freeze({
    requestViewport() {
      viewportDirty = true;
      schedule();
    },
    requestWidget() {
      widgetDirty = true;
      schedule();
    }
  });
}
