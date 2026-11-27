/** Native button key behavior for interactive Leaflet marker elements. */
export function enableMarkerKeyboardActivation(marker) {
  let element = null;
  const activate = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    // Prevent Leaflet's legacy keypress route from activating a second time.
    L.DomEvent.stop(event);
    if (!event.repeat) marker.fire("click", { originalEvent: event });
  };
  const detach = () => {
    element?.removeEventListener("keydown", activate);
    element = null;
  };
  marker.on("add", () => {
    detach();
    element = marker.getElement();
    element?.addEventListener("keydown", activate);
  });
  marker.on("remove", detach);
}
