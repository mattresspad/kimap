// kimap/content/help-content.js

export const helpSections = {
  overlays: `
  <h3>Overlays</h3>
  <p>World Views changes the map's main surface. Reference layers, including Spawn Borders, Road Network, and Debug Grid, can remain visible above that surface.</p>
  <p><strong>Map Content</strong> contains locations, names, interpretation, and <strong>Reference layers → Landmarks / Road Network</strong>. Road Network's cog opens its existing Plan configuration when enabled.</p>
  <p><strong>World Views</strong> keeps None and Political View at the top, followed by <strong>Geography</strong> (Spawn Areas, Spawn Borders, Biomes), <strong>Fertility</strong>, <strong>Mining &amp; Resources</strong>, and <strong>Weather &amp; Hazards</strong>. Debug Grid stays last. Geography starts expanded; the other groups start collapsed. Open several groups at once if useful. Group choices are remembered until Restore Default Workspace; collapsing a group never turns its layers off. Spawn Borders is an independent checkbox even though it sits beside the geographic surface choices.</p>
  <p>Unpinned choosers close after the pointer has been away from both their launcher frame and panel for <strong>1.2 seconds</strong>. Return to either to cancel closing. Keyboard use keeps the panel open, and touch uses explicit dismissal. Outside clicks close an unpinned chooser immediately; pin it to keep it open while using the map. Escape or its launcher closes it, and opening another chooser hands off to that panel.</p>
  <section id="guide-political-view" class="help-section" tabindex="-1" aria-labelledby="guide-political-title">
    <h4 id="guide-political-title">Political View — Experimental</h4>
    <p><strong>Local Authored Balance — Experimental</strong> compares current authored faction evidence within each mapped area. Its percentages describe a share of that evidence, not territorial ownership, population, or the probability of an encounter. The interpretation may evolve as the political system develops.</p>
    <p>Choose <strong>World Views → Political View</strong> to show it. Selecting another main surface turns Political View off; reference layers remain independent. The cog beside Political View opens <strong>Faction Colors</strong>, including while Political View is off.</p>

    <h5>What contributes evidence?</h5>
    <ul>
      <li><strong>Towns:</strong> qualifying resident-squad references in the effective town, with structural occupant capacity, contribute to that town's current owner. Each loaded map occurrence counts separately. This counts resident references, not individual residents. Bars and roaming squads do not add town pressure; a populated ruin can still qualify.</li>
      <li><strong>Homeless spawns:</strong> positive authored relative weights divide the area's homeless-spawn amount among its current spawn evidence.</li>
      <li><strong>Nests:</strong> positive authored relative weights divide the area's authored nest amount among its current nest evidence.</li>
    </ul>
    <p><strong>Default</strong> and <strong>Active</strong> spawn occurrences contribute current pressure. <strong>Potential</strong> and <strong>Distant</strong> occurrences are conditional evidence, shown separately without adding current pressure. <strong>Eliminated</strong> occurrences remain diagnostic. Scenario changes can alter the effective towns and current spawn evidence.</p>

    <h5>When does a faction dominate?</h5>
    <p>A unique leader must have <strong>at least 55%</strong> of the full local evidence and lead the runner-up by <strong>at least 10 percentage points</strong>. An exact leading tie never qualifies. For example, shares of 60% and 25% have a 35-point margin. Classification uses underlying values, so rounded percentages alone may not explain a boundary result; the point report exposes the confidence details.</p>

    <h5>Reading the map</h5>
    <dl class="help-political-outcomes">
      <dt>Dominant</dt><dd>Solid faction color: one included faction passes the confidence rule.</dd>
      <dt>Disputed</dt><dd>Stripes: the leading evidence is tied or does not meet both thresholds. Hidden or unattributed contributors use neutral stripes.</dd>
      <dt>Filtered</dt><dd>Neutral diagonal pattern: a faction outside the visible roster passes the confidence rule. Its identity and color remain concealed.</dd>
      <dt>Unattributed</dt><dd>Neutral checked pattern: evidence without a single faction identity passes the confidence rule.</dd>
      <dt>Indeterminate</dt><dd>Gold cross-hatching: incomplete or conflicting input prevents a dependable result.</dd>
      <dt>No evidence / excluded</dt><dd>Transparent: no current scoring evidence, or geography intentionally excluded from evaluation. A transparent area is not a claim that nobody is present.</dd>
    </dl>

    <h5>Shares, hidden factions, and unknown ownership</h5>
    <p>The denominator includes <strong>all scoring evidence</strong>, including hidden and non-participant factions. Public reports combine their contributions as <strong>Outside visible roster</strong>, without exposing individual identities or colors. Evidence with no single faction identity stays separate as <strong>Unattributed</strong>.</p>
    <p>Hiding a leader never promotes an included runner-up. Outside visible roster is a combined reporting category, not an extra faction: adding together concealed contributions does not create a new winner. A local report retains the actual leading result and any exact tie.</p>

    <h5>Hover, point reports, and Scorecard</h5>
    <ul>
      <li><strong>Hover:</strong> a bounded local reading. Choose Political in Cursor Controls to read political evidence. The Political tooltip selector in World Views edits the same Reduced, Full, or Hidden preference without changing your chosen subject. Reporting pauses over controls and interactive markers, during map movement or tool gestures, and while popups or theaters suppress map reporting.</li>
      <li><strong>Point probe:</strong> click ordinary map space to hold the complete local report at that point, with its own disclosure and scrolling. With Political selected in Cursor Controls, it exposes contributors, source totals, denominator, confidence details, conditional counts, and relevant diagnostics.</li>
      <li><strong>Expanded Scorecard:</strong> a map-wide ranking of included factions with positive evidence. Equal scores share a rank. Its footer retains outside-roster and unattributed totals, source breakdowns, and coverage counts.</li>
      <li><strong>Compact Scorecard:</strong> Global shows the map-wide leading included evidence and ranked count. Eligible map hover changes it to Local, showing that area's actual leader or status and its positive included-faction count. Environmental or hidden tooltips and dismissing a tooltip with Escape do not turn off this local tracking. Leaving eligible map space restores Global; expanding always shows the map-wide ranking.</li>
    </ul>
    <p>Each mapped, determinate <strong>geometry contributes once</strong> to Scorecard totals. Disconnected components do not multiply its score. Areas sharing one raster color are reported together with their combined area identities. No-evidence geometry counts toward coverage but adds no points; indeterminate, intentionally excluded, and unmapped areas without raster cells are omitted with explicit counts. Percentages are shares of scored evidence, not shares of map area.</p>

    <h5>Configuration and present limits</h5>
    <p><strong>Faction Colors</strong> controls the visible participant roster, retained faction colors, and Political View opacity. Colors and opacity change presentation, not evidence. Hiding a faction removes it from the visible ranking while retaining its contribution in denominators and its chosen color for later re-inclusion. These choices are session-only and survive Focus Map and workspace reset; they are not saved with scenario documents.</p>
    <p>Scorecard color swatches open the exact faction's color control. Faction names open their Reference Inspector records. The crown shortcut opens <strong>Faction Power Ranks</strong>, a separate measure of current town control; its rankings need not match political evidence shares.</p>
    <p><strong>Cursor Controls</strong> opens from the cursor button below Zoom or the <strong>Tooltip &amp; click settings</strong> banner above Surface in World Views. Choose a <strong>Subject</strong> independently for Tooltips and Point Probe: <strong>Political</strong>, <strong>Resources</strong>, <strong>Weather</strong>, <strong>Relations</strong>, or <strong>Squad Presence</strong>. Each subject remembers Reduced, Full, or Hidden hover and Expanded or Collapsed probe disclosure. Relations also offers Hidden probe disclosure, which removes the report section while keeping the point and actions. World Views edits only Political tooltip detail; it does not switch subjects. You can prepare these session-only settings before data or layers are ready; they never activate a layer. Political reports require Political View. Resources and Weather require area data and geography, independently of simulation, World Views, and Scanner expansion. Paint &amp; Plan cursor settings are marked Planned; ordinary Plan Tools remain available.</p>
    <p><strong>Resources</strong> shows Arid, Green, and Swamp fertility as percentages and Copper, Iron, Stone, and Water as authored multipliers. Known zeroes remain visible; an em dash means unavailable, not zero. <strong>Weather</strong> reports Acidic Ground, Acidic Water, Gas, Acid Rain, Duststorm, and Burning. Reduced hover lists recorded hazards and incomplete-data notices; Full hover and Expanded probe show all six statuses. These are authored area conditions, not current weather or a safety rating. Season and weather source lists remain in <strong>Environment Info</strong>.</p>
    <p><strong>Relations</strong> lists factions associated with current authored sources, independently of Political View and its visible roster. Each reporting surface has its own <strong>Allies &amp; enemies</strong> or <strong>Include neutrals</strong> filter, including for town owners. Enemy, Ally, and Neutral use the existing simulation relation classifications. Reduced hover shows names and attitudes; Full adds relation values and source roles. Missing or ambiguous faction links stay unresolved. Neutral does not mean safe, and hostile ownership does not establish an occupied garrison.</p>
    <p><strong>Squad Presence</strong> shows current <strong>Homeless squads</strong> and <strong>Nests</strong> in an area. Only Default and Active occurrences qualify; Potential, Distant, and Eliminated entries do not appear. Town hover shows effective ownership, <strong>Residents</strong> (including labelled Default templates), <strong>Bar squads</strong>, and <strong>Roaming squads</strong>. The town's retained override path determines replacement and inherited categories. Repeated identities are grouped within their role; counts describe authored entries, not simultaneous bodies or encounter probability. Full adds attributable faction details. Nearby towns, campaigns, characters, inventories and loot are outside this report.</p>
    <p>Relations and Squad Presence use a <strong>mouse or other non-touch pointing device at any window width</strong>. They require current scenario analysis; area readings also require raster geography, while town readings do not. Ordinary town markers accept these two hover subjects; Nest markers, Context indicators and player markers retain their existing behavior. On desktop, click a town for the complete <strong>Inspector → Population</strong> groups and exact-reference links. In narrow layouts the compact town popup remains; choose <strong>Open Context</strong> for the same Inspector details. Reduced and Full hover start with at most three and five rows, shortening further when necessary. A shortened area reading directs you to the corresponding Point Probe subject. Touch does not gain hover or these new reports: a touch-origin probe keeps its coordinates and actions with an explanation when either subject is selected.</p>
    <p>Shared raster colors are ambiguous: hover identifies the matched areas, while the probe keeps their readings separate. Full hover may shorten to fit the viewport and explain where to find the complete report. The probe has a keyboard-accessible report scroller; scrolling there does not zoom the map.</p>
    <p><strong>Placement</strong> is independent for each surface. Tooltips can stay <strong>Near cursor</strong> or use <strong>Bottom center</strong>; Point Probe can stay <strong>At point</strong> or use <strong>Bottom center</strong>. A bottom-center tooltip remains live and clears when you leave eligible map space. A held probe takes priority and pauses hover and local Scorecard tracking. Bottom-center readings stay centered in the available map workspace and move above the Scanner/Scorecard when necessary. In very short views they may overlap.</p>
    <p>The complete probe keeps its compact width and a height limit based on the normal expanded Scanner. Its title, coordinates, disclosure and actions stay together; only the report scrolls. Changing placement retains its exact point, gold dot, keyboard focus and report scroll without panning the map. A new map click replaces it; a town click dismisses it and follows the existing Inspector or narrow-popup route. Close, Escape and Restore Default Workspace also dismiss the probe. Focus Map retains the held probe while suppressing hover. Workspace reset restores Near cursor and At point.</p>
    <p>The manager pauses hover reporting and compact Scorecard local tracking while open. Town hover also clears local Scorecard tracking; ordinary eligible map movement restores it. Close the manager to resume on the next eligible pointer movement. Focus Map and layer changes retain its settings; Restore Default Workspace selects Political on both surfaces, returns every subject to Reduced tooltips and Expanded point reports, and restores both Relations filters to Allies &amp; enemies. Switching subject updates an already-open probe while retaining the point and its actions. Political View does not add encounter forecasts, individual squad inventories, or replay reporting. If political evidence is unavailable, ordinary map exploration and other available layers remain usable.</p>
  </section>
`,
  contextLists: `
  <h3 id="guide-context-lists-title">Context Lists</h3>
  <p>Open <strong>Your Workbench → Browse → Context</strong> to follow a particular map question. The dashboard leads directly to subjects or through one collection level: <strong>Treasure Hunting</strong> contains Treasure Spots, Nest Treasures, and Fancy Weapon Wielders; <strong>Shopping List</strong> contains Narcotics. Back returns to the collection or dashboard and restores focus to the originating card.</p>
  <p>Each subject's search narrows its displayed rows without changing its checked map choices. In the Character, Animal, Treasure, and Narcotics lists, check a row or source to show its current and conditional context indicators; <strong>Show All</strong> or <strong>Show Matches</strong> checks the displayed set, and <strong>Clear All</strong> removes that subject's choices. A marker shared by several results opens a chooser. Named reference buttons open exact records; nearby IDs identify them, and geographic actions open map context. Choices are session-only and scenario changes reclassify their mapped evidence. Focus Map and Workbench minimization retain the active route and choices; Restore Default Workspace clears them.</p>
  <p><strong>Current</strong> and <strong>conditional</strong> describe reachable authored parent locations, not an exact character position, guaranteed encounter, item availability, or odds. Missing links and ambiguous geography remain uncertain. If simulation or raster geography is unavailable, visible notices explain which map controls or reports cannot be used while available reference rows remain accessible.</p>

  <section id="guide-context-key-characters" class="help-section" tabindex="-1" aria-labelledby="guide-context-key-characters-title">
    <h4 id="guide-context-key-characters-title">Key Characters</h4>
    <p>These geographically reachable Characters have an exact authored <strong>NPC is</strong> or <strong>NPC is NOT</strong> world-state relationship. Rows show affiliation, tracked life status when available, world-state count, and current or conditional parent placements. The world-state link explains why a Character appears; it does not make a parent town or spawn area an exact NPC position.</p>
  </section>

  <section id="guide-context-bounty-targets" class="help-section" tabindex="-1" aria-labelledby="guide-context-bounty-targets-title">
    <h4 id="guide-context-bounty-targets-title">Bounty Targets</h4>
    <p>Reachable Characters qualify when both authored bounty amount and chance are positive. A listed issuer comes from an exact faction reference when one exists; <strong>Not authored</strong> is different from unresolved issuer evidence. Affiliation and issuer are separate. The map shows reachable parent placements and does not track bounty collection.</p>
  </section>

  <section id="guide-context-deadly-animals" class="help-section" tabindex="-1" aria-labelledby="guide-context-deadly-animals-title">
    <h4 id="guide-context-deadly-animals-title">Deadly Animals</h4>
    <p>Reachable Animals qualify through authored strength of at least 50 or the sum of referenced death-item base values reaching 5,000. The row identifies which reason applies. Death-item values are evidence for the list, not guaranteed trophies or a multiplied yield. Checked indicators mark reachable parent habitats.</p>
  </section>

  <section id="guide-context-treasure-spots" class="help-section" tabindex="-1" aria-labelledby="guide-context-treasure-spots-title">
    <h4 id="guide-context-treasure-spots-title">Treasure Spots</h4>
    <p>A mapped Town qualifies through possible generated vendor stock with an individual supported item value of at least 5,000, or a reachable Character's individual death item at least 5,000. A town row groups its exact map occurrences and keeps possible stock, death-loot provenance, and blocked trade-culture evidence separate. Generated stock is possible; item availability, quantity, price, and theft conditions are not guaranteed. A checked town marks its eligible occurrences.</p>
  </section>

  <section id="guide-context-nest-treasures" class="help-section" tabindex="-1" aria-labelledby="guide-context-nest-treasures-title">
    <h4 id="guide-context-nest-treasures-title">Nest Treasures</h4>
    <p>These Nest Items have an authored value greater than 25 and at least one reachable type-0 Nest debris source. Open a row's source list to inspect and check individual Nests. A reachable source marks geographic evidence, not a guaranteed find.</p>
  </section>

  <section id="guide-context-fancy-weapon-wielders" class="help-section" tabindex="-1" aria-labelledby="guide-context-fancy-weapon-wielders-title">
    <h4 id="guide-context-fancy-weapon-wielders-title">Fancy Weapon Wielders</h4>
    <p>Reachable Characters qualify through an exact authored melee Weapon reference and an Edge Type 1, Edge Type 2, Edge Type 3, or Meitou weapon-level model. Rows list authored weapon types and <strong>possible grades</strong> separately, with grade-source references available on demand. Authored lists do not pair a particular weapon to a grade or guarantee encountered gear or drops. Current and conditional counts refer to parent placements.</p>
  </section>

  <section id="guide-context-narcotics" class="help-section" tabindex="-1" aria-labelledby="guide-context-narcotics-title">
    <h4 id="guide-context-narcotics-title">Narcotics</h4>
    <p>Items with authored item function 8 use Town or Spawn Area vendor paths as possible purchase sources. Carried items and loot do not count as shops. Rows distinguish possible stock, uncertain vendor evidence, and stock blocked by trade culture; none promises quantity, price, or availability. <strong>Show Prohibition</strong> separately displays authored illegal-goods territory for one item, with current and conditional law distinguished. Prohibition does not establish a vendor source or theft rule.</p>
  </section>

  <section id="guide-context-prospecting" class="help-section" tabindex="-1" aria-labelledby="guide-context-prospecting-title">
    <h4 id="guide-context-prospecting-title">Prospecting</h4>
    <p>Select Arid, Green, Swamp, Copper, Iron, Stone, Water, or the recorded weather and zone effects. Every selected criterion must match the <strong>same exact area</strong>; adding a criterion narrows the confirmed area list and its gold map highlight. Search filters area names or exact IDs in the list only. Open <strong>All area readings</strong> for the complete environmental readback, or <strong>Inspect Area</strong> for its map context.</p>
    <p>A numeric criterion starts at <strong>Any positive</strong>. Its minimum slider reaches the highest eligible reading in the loaded manifest, and a raised minimum is inclusive. Rounded labels use ≈; matching uses unrounded authored values. Deselecting a type retains its minimum until <strong>Clear criteria</strong>. Water here is an authored multiplier (×), separate from the Inspector's Water percentage. Weather and zone effects match only when recorded; they are authored conditions, not live weather or a safety rating. Missing readings are not zero or confirmed absence. Shared raster colors use a caution pattern because a pixel cannot identify which linked area occupies it.</p>
  </section>

  <section id="guide-context-faction-overview" class="help-section" tabindex="-1" aria-labelledby="guide-context-faction-overview-title">
    <h4 id="guide-context-faction-overview-title">Faction Overview</h4>
    <p>Choose one baseline map-linked faction by name or exact ID. The selected faction remains selected while search narrows the picker. Its report uses current scenario facts: <strong>Spawn Presence</strong> counts active areas and unique Squad templates; <strong>World-State Characters</strong> counts alive and affiliated tracked Characters; <strong>Town Control</strong> counts unique canonical towns currently owned, gained, and lost. Expand the lists for exact references and map destinations. The map fills current Squad spawn areas and rings every mapped occurrence of a currently owned town; repeated markers may therefore exceed the unique-town count.</p>
    <p><strong>Current mapped presence</strong>, <strong>Conditional evidence only</strong>, and <strong>No current mapped presence</strong> describe this map evidence, not a faction's global existence. Potential or Distant spawns and reachable override ownership do not become current highlights. Shared raster colors carry a caution pattern; missing map anchors and unavailable scenario analysis are explained without inventing a location or a zero. <strong>Open Faction Reference</strong> opens the exact record. <strong>Power Ranks</strong> opens the selected row when ranked, or the general ranking when the faction has no territorial rank. This view does not use Political View's scoring or participant roster.</p>
  </section>
`,
  intro: `
  <h3>Introduction</h3>
  <p>Welcome to the Kenshi Interactive Map. This tool allows you to visualize game data, plan base locations, and track your playthrough's history.</p>
  <h4>Inspector navigation and actions</h4>
  <p>The Inspector's return-arrow button offers <strong>Back</strong> or <strong>Return to Reference</strong> when a return destination is available. Its tooltip and accessible name identify the action. <strong>Map Context</strong> switches to the retained map inspection without discarding your reference trail.</p>
  <p><strong>Map Context</strong>, <strong>View Layout</strong>, and <strong>Copy View</strong> pair their labels with icons. View Layout and Copy View use compact two-line labels. Copy View briefly shows <strong>Copied</strong> after a successful copy, then restores its label after five seconds. Long Inspector names use up to two lines; hover over the title for the complete name. Minimize preserves the inspection for reopening.</p>
  <p><strong>Population</strong> and reference <strong>Relationships</strong> number the displayed rows from 1 within each section. These numbers help you count entries; they do not replace authored positions, counts, or population evidence. Opening an entry keeps its existing reference destination.</p>
  <p>When inspecting an area or a point within it, <strong>Weather</strong> lists recorded effects with individual icons. Missing sources or incomplete evidence remain explicit, even alongside known hazards. These are authored conditions, not current weather or a safety rating. Season and weather source lists remain in <strong>Environment Info</strong>.</p>
  <p><strong>Override Network</strong> shows <strong>No connected overrides.</strong> for towns with no incoming or outgoing override links. A terminal town within a connected network keeps its path and final-state reporting. Unavailable connectivity or scenario analysis is explained separately.</p>
  <h4>Landmarks and shared Context markers</h4>
  <p>Enable <strong>Landmarks</strong> in <strong>Map Content</strong> to explore notable landscape features. Clicking one opens its name, authored description, definition ID, coordinates, and containing spawn area in the Inspector. The same view uses the Inspector sheet on narrow screens. These are static map annotations, independent of simulation.</p>
  <p><strong>Back</strong> returns to the geographic or reference inspection you were reading, preserving its open sections and reading position. Visiting another landmark replaces the current landmark while keeping that return point. Close or Escape returns from the landmark first; with no previous inspection, close hides the Inspector. Minimize, Focus Map, and hiding the landmark layer retain the visit. Choosing another map or reference destination ends it, as does Restore Default Workspace.</p>
  <p>Area readings may be loading, unavailable, or outside known spawn areas. A shared raster color lists each matched area and explains the ambiguity. Landmark artwork stays compact; unvalidated wiki links are not active.</p>
  <p>When several Context results share a marker, click it to choose a result from the themed popup. Long lists scroll inside the popup without zooming the map. Buttons retain their named map or reference destinations, and dismissing the chooser returns keyboard focus to its marker when it remains available.</p>
  <p>For detailed game lore, visit the <a href="https://kenshi.wiki/w/Main_Page" target="_blank">Kenshi Wiki</a>.</p>
`,
  management: `
  <h3>Data Management</h3>
<div id="guide-import-export" class="help-section">
  <h4>Documents and portability</h4>
  <figure class="help-img-right">
  <img src="icons/user-prefs.svg" alt="Document management illustration" width="160" height="160" loading="lazy">
  <figcaption>Scenario, marker, and Paint documents remain separate.</figcaption>
  </figure>
  <p>KiMap manages three independent document families. <strong>Scenario Documents</strong> retain world-state, character-status, faction-relation, and history commands for one exact manifest baseline. <strong>Marker Sets</strong> and <strong>Paint Plans</strong> are portable across manifest baselines.</p>
  <p>Each document manager provides JSON <strong>Export</strong> and <strong>Import</strong> controls for local interchange. Import replaces only that document family's active data after validation; it does not restore or overwrite unrelated selection, layer, theme, viewport, or workspace preferences.</p>
<div class="clearfix">
</div>
</div>
<div id="guide-save-states" class="help-section">
  <h4>Where to find document controls</h4>
  <p>Open <strong>Workspace → Scenario Documents</strong> to import or export a scenario JSON file. These controls are also available in <strong>Global Status</strong>.</p>
  <p><strong>Player Markers</strong> and <strong>Paint Manager</strong> each contain JSON Export and Import controls for their respective files.</p>
</div>
`,
  factions: `
  <h3>Faction Mechanics</h3>
  <p>Your standing with factions determines how they react to you.</p>
  <ul>
    <li><strong>Ally (+60):</strong> They will heal you and defend your outpost.</li>
    <li><strong>Enemy (-10):</strong> They will attack on sight.</li>
  </ul>
`,
  characters: `
  <h3>Character Status</h3>
  <p>Ensure your squad is fed and healthy.</p>
`,
  markers: `
  <h3>Player Markers</h3>
  <p>You can right-click anywhere on the map to create a custom marker. These markers can be organized into groups and exported.</p>
`
};
