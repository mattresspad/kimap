// kimap/modules/help-guide.js
import { helpSections } from "../content/help-content.js";
import { rewriteElementAssetUrls } from "./asset-url.js";
import { getTheaterDestination } from "./top-bar/model.js";

export function initHelpGuide(windowManager) {
  const article = document.getElementById("help-article");
  const paneElement = document.getElementById("pane-help"); // The wrapper in the warehouse

  // 1. Inject Content (Standard logic)
  if (article) {
    article.innerHTML = `
            <section id="section-intro">${helpSections.intro}</section>
            <hr>
            <section id="section-management">${helpSections.management}</section>
            <hr>
            <section id="section-markers">${helpSections.markers}</section>
            <hr>
            <section id="section-overlays" tabindex="-1">${helpSections.overlays}</section>
            <hr>
            <section id="guide-context-lists" class="help-section" tabindex="-1" aria-labelledby="guide-context-lists-title">${helpSections.contextLists}</section>
            <hr>
            <section id="guide-factions">${helpSections.factions || ""}</section>
            <hr>
            <section id="guide-characters">${helpSections.characters || ""}</section>
            <div style="height: 200px;"></div>
        `;
    rewriteElementAssetUrls(article, { forceCdn: true });
  } else {
    console.error("Help Guide Error: Could not find #help-article element");
  }

  // 2. Register with Window Manager
  if (windowManager && paneElement) {
    windowManager.register("help", getTheaterDestination("help")?.label, paneElement);
  }

  // 3. Handle Navigation (Used by Tooltips)
  const handleNavigation = (sectionId, options = {}) => {
    // Instead of toggling classes, we ask the Manager to open us
    if (windowManager) {
      windowManager.openAndScrollTo("help", sectionId, {
        ...options,
        scrollContainer: article,
        focusTarget: true
      });
    }
  };

  // Contents links are in-theater navigation, not public map-view URL fragments.
  document.getElementById("help-toc-list")?.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    const sectionId = link.getAttribute("href").slice(1);
    if (article?.contains(document.getElementById(sectionId))) handleNavigation(sectionId);
  });

  return { handleNavigation };
}
