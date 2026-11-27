// modules/town-layout.js

import { kenshiAssetUrl } from './asset-url.js';

const WORLD_MIN = -147456; 
const WORLD_MAX = 147455;  
const DEFAULT_VIEW_WIDTH = 800;
const DEFAULT_VIEW_HEIGHT = 600;
const DEFAULT_VIEW_RADIUS = 4000;

// --- 1. THE CURATOR v2: Icon Support ---
// Define your specific buildings here.
// 'icon': Path to SVG file (relative to your web root)
// 'w/d': Dimensions in Game Units (approximate)
const BUILDING_CONFIG = {
// Visible elements
"Watchtower":      { w: 250, d: 250, type: 'icon', src: 'icons/layouts/test-watchtower2.svg', rotationOffset: 0 },
"Storm House":     { w: 225, d: 225, type: 'icon', src: 'icons/layouts/test-storm-house.svg', rotationOffset: 0 },
"Old Storm House": { w: 225, d: 225, type: 'icon', src: 'icons/layouts/test-storm-house.svg', rotationOffset: 0 },
"Small Shack":     { w: 125, d: 175, type: 'icon', src: 'icons/layouts/test-small-shack2.svg', rotationOffset: 90 },
"Bughouse":        { w: 250, d: 250, type: 'icon', src: 'icons/layouts/test-stationhouse2.svg', rotationOffset: 0 },
"Stationhouse":    { w: 350, d: 350, type: 'icon', src: 'icons/layouts/test-stationhouse2.svg', rotationOffset: 0 },
"Well":            { w: 150, d: 150, type: 'icon', src: 'icons/layouts/well.svg', fixedRotation: true },
"L-House":         { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-l-house.svg', rotationOffset: 90 },
"Y-House":         { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-y-house.svg', rotationOffset: 180 },
"Stephouse":       { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-stephouse.svg', rotationOffset: 180 },
"Snailhouse":      { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-snailhouse.svg', rotationOffset: 90 },
"Longhouse":       { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-longhouse.svg', rotationOffset: 180 },
"Outpost s-I":     { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-outpost-s-iii.svg', rotationOffset: 0 },
"Outpost s-II":    { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-outpost-s-iv.svg', rotationOffset: 45 }, // 45 deg offset makes it an 'X' instead of '+'
"Outpost s-III":   { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-outpost-s-iii.svg', rotationOffset: 0 },
"Outpost s-IV":    { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-outpost-s-iv.svg', rotationOffset: 0 },
"Outpost s-V":     { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-outpost-s-iii.svg', rotationOffset: 0 },
"Swamp House":     { w: 175, d: 175, type: 'icon', src: 'icons/layouts/test-swamp-house.svg', rotationOffset: 0 },
"Swamp Store":     { w: 150, d: 150, type: 'icon', src: 'icons/layouts/test-swamp-store.svg', rotationOffset: 0 },
"Shield Bridge":   { w: 600, d: 600, type: 'icon', src: 'icons/layouts/test-shield-bridge.svg', rotationOffset: 270 },
"Swamp Shack":     { w: 125, d: 125, type: 'icon', src: 'icons/layouts/test-swamp-dome.svg', rotationOffset: 0 },
"Swamp Dome":      { w: 300, d: 300, type: 'icon', src: 'icons/layouts/test-swamp-dome.svg', rotationOffset: 0 },
"Ancient Lab":     { w: 600, d: 600, type: 'icon', src: 'icons/layouts/test-ancient-lab.svg', fixedRotation: true },
"Ancient Citadel": { w: 700, d: 700, type: 'icon', src: 'icons/layouts/test-ancient-citadel.svg', fixedRotation: true },
"Cactus":          { w: 150, d: 150, type: 'icon', src: 'icons/layouts/cactus.svg', fixedRotation: true },
"Riceweed":        { w: 150, d: 150, type: 'icon', src: 'icons/layouts/riceweed.svg', fixedRotation: true },
"Hemp":            { w: 150, d: 150, type: 'icon', src: 'icons/layouts/hemp.svg', fixedRotation: true },
"Vegetable":       { w: 150, d: 150, type: 'icon', src: 'icons/layouts/vegetable.svg', fixedRotation: true },
"Wheat":           { w: 150, d: 150, type: 'icon', src: 'icons/layouts/wheat.svg', fixedRotation: true },
"Cotton":          { w: 150, d: 150, type: 'icon', src: 'icons/layouts/riceweed.svg', fixedRotation: true },
// Modded elements
"Holy House":      { w: 225, d: 225, type: 'icon', src: 'icons/layouts/test-storm-house.svg', rotationOffset: 0 },
"Holy Shack":      { w: 125, d: 175, type: 'icon', src: 'icons/layouts/test-small-shack2.svg', rotationOffset: 90 },
// Hidden elements
"Copper Alloy Bench":               { ignore: true },
"Broken Drone":               { ignore: true },
"Chimney":               { ignore: true },
"Animal Feeder":               { ignore: true },
"Smashed Chest":               { ignore: true },
"Smallbox":               { ignore: true },
"Fabric Chest":               { ignore: true },
"Bench":               { ignore: true },
"Sitting Spot":               { ignore: true },
"Secure Wooden Chest":               { ignore: true },
"Metal Box":               { ignore: true },
"Large Basket":               { ignore: true },
"Boltbox":               { ignore: true },
"Stool":               { ignore: true },
"Stairs":               { ignore: true },
"Junk":               { ignore: true },
"Sitting Pillow":               { ignore: true },
"Table":               { ignore: true },
"Ghostown":               { ignore: true },
"Tank":                   { ignore: true },
"Ramp":                   { ignore: true },
"Barrier":                { ignore: true },
"Rain Collector":         { ignore: true },
"Wall":                   { ignore: true },
"Big Ramp":               { ignore: true },
"Oil Drill":              { ignore: true },
"Gate":                   { ignore: true },
"Tarsand":                { ignore: true },
"Large Dock":             { ignore: true },
"Steel Refinery":         { ignore: true },
"Blast Tube Streetlight": { ignore: true },
"Skeleton Shredder":      { ignore: true },
"Ore Mine":               { ignore: true },
"Metal Table":            { ignore: true },
"Ancient Lab Ramp":       { ignore: true },
"Biofuel Distillery":     { ignore: true },
"Old Stool":              { ignore: true },
"Awning":                 { ignore: true },
"Training Dummy":         { ignore: true },
"Assassination Dummy":    { ignore: true },
"Ore Drill":              { ignore: true },
"Barge Wreck":          { ignore: true },
"Heavy Armour Smithy":    { ignore: true },
"Item Furnace":           { ignore: true },
"Mounted":                { ignore: true },
"Harpoon":                { ignore: true },
"Storage":                { ignore: true },
"Campfire":               { ignore: true },
"Exhaust Fan":            { ignore: true },
"Copper Resource":        { ignore: true },
"Quarry":                 { ignore: true },
"Manual Stone Processor": { ignore: true },
"Stone Processor":        { ignore: true },
"Corpse Furnace":         { ignore: true },
"Plate Beating Station":  { ignore: true },
"Stone Mine":             { ignore: true },
"Iron Refinery":          { ignore: true },
"Weapon Smith":           { ignore: true },
"Camp Bed":               { ignore: true },
"Shade Cover":            { ignore: true },
"Scrap Tent":             { ignore: true },
"City Lamp Post":         { ignore: true },
"Swamp Platform":         { ignore: true },
"Emperor Statue":         { ignore: true },
"Water Tank":             { ignore: true },
"Water Tower":            { ignore: true },
"Food Store":             { ignore: true },
"Iron Resource":          { ignore: true },
"Tank unused":            { ignore: true },
"Lagoon Platform":        { ignore: true },
"Ore Processor":          { ignore: true },
"Split-Rail":             { ignore: true },
"Light Post":             { ignore: true },
"Grain Silo":             { ignore: true },
"Swamp Fence":            { ignore: true },
"Swamp Lookout":          { ignore: true },
"Swamp High Walkway":     { ignore: true },
"Swamp Walkboard":        { ignore: true },
"Mercenary Tent":         { ignore: true },
"High Walkway":           { ignore: true },
"High Walkway Support":   { ignore: true },
"Quad Streetlamp":        { ignore: true },
"Sitting Box":            { ignore: true },
"Flat Shelter":           { ignore: true },
"Prisoner":               { ignore: true },
"Barrel":                 { ignore: true },
"Generator":              { ignore: true },
"Fish":                   { ignore: true },
"Fishing":                { ignore: true },
"Crate":                  { ignore: true },
"Torch":                  { ignore: true },
"Sign":                   { ignore: true },
"Market":                 { ignore: true },
"Wind":                   { ignore: true },
"Spotlight":              { ignore: true },
"Searchlight":            { ignore: true },
"Pontoon":                { ignore: true },
"Outhouse":               { ignore: true }
};

const DEFAULT_SHAPE = { w: 400, d: 400, type: 'rect' };

export function calculateTownLayoutViewport(width, height, radius = DEFAULT_VIEW_RADIUS) {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        throw new TypeError('Town layout viewport dimensions must be positive finite numbers.');
    }
    if (!Number.isFinite(radius) || radius <= 0) {
        throw new TypeError('Town layout radius must be a positive finite number.');
    }

    const aspect = width / height;
    const visibleRadiusX = aspect > 1 ? radius * aspect : radius;
    const visibleRadiusZ = aspect > 1 ? radius : radius / aspect;

    return Object.freeze({ width, height, aspect, visibleRadiusX, visibleRadiusZ });
}

function measureTownLayoutViewport(container, radius = DEFAULT_VIEW_RADIUS) {
    const measuredWidth = Number(container.clientWidth);
    const measuredHeight = Number(container.clientHeight);
    return calculateTownLayoutViewport(
        measuredWidth > 0 ? measuredWidth : DEFAULT_VIEW_WIDTH,
        measuredHeight > 0 ? measuredHeight : DEFAULT_VIEW_HEIGHT,
        radius
    );
}

function normalizeTownRequest(townData, buildingsUrl) {
    const centerX = Number(townData?.Values?.X);
    const centerZ = Number(townData?.Values?.Z);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerZ)) {
        throw new TypeError('Town layout coordinates must be finite numbers.');
    }
    if (typeof buildingsUrl !== 'string' || buildingsUrl.trim() === '') {
        throw new TypeError('A buildings dataset URL is required.');
    }

    return Object.freeze({
        name: typeof townData?.Name === 'string' && townData.Name.trim() ? townData.Name : 'Town',
        centerX,
        centerZ,
        buildingsUrl
    });
}

function filterLocalBuildings(buildings, centerX, centerZ, radius) {
    return buildings.filter(building => {
        if (Math.abs(building.X - centerX) > radius || Math.abs(building.Z - centerZ) > radius) {
            return false;
        }
        return !getBuildingConfig(building.BuildingDefId, building.BuildingName).ignore;
    });
}

function focusLauncher(launcher) {
    if (!launcher || typeof launcher.focus !== 'function') return;
    try {
        launcher.focus({ preventScroll: true });
    } catch (_error) {
        launcher.focus();
    }
}

function requireControllerElement(element, label, method) {
    if (!element || typeof element[method] !== 'function') {
        throw new TypeError(`${label} must provide ${method}().`);
    }
}

/**
 * Owns the map-cover town-layout lifecycle without owning its surrounding workbench composition.
 */
export function createTownLayoutController({
    backdrop,
    title,
    vizContainer,
    loader = null,
    resetButton = null,
    fetchImpl = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
    ResizeObserverClass = globalThis.ResizeObserver,
    requestFrame = typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : callback => setTimeout(callback, 0),
    cancelFrame = typeof globalThis.cancelAnimationFrame === 'function'
        ? globalThis.cancelAnimationFrame.bind(globalThis)
        : frameId => clearTimeout(frameId),
    renderLayoutImpl = renderLayout,
    onError = () => {}
} = {}) {
    requireControllerElement(backdrop?.classList, 'Town layout backdrop classList', 'toggle');
    requireControllerElement(vizContainer, 'Town layout visualization container', 'replaceChildren');
    if (!title || !('textContent' in title)) {
        throw new TypeError('Town layout title element is required.');
    }
    if (typeof fetchImpl !== 'function') {
        throw new TypeError('Town layout controller requires a fetch implementation.');
    }
    if (typeof ResizeObserverClass !== 'function') {
        throw new TypeError('Town layout controller requires ResizeObserver.');
    }
    if (typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
        throw new TypeError('Town layout controller requires animation-frame scheduling functions.');
    }
    if (typeof renderLayoutImpl !== 'function' || typeof onError !== 'function') {
        throw new TypeError('Town layout renderer and error handler must be functions.');
    }

    const buildingCache = new Map();
    let open = false;
    let disconnected = false;
    let requestVersion = 0;
    let currentModel = null;
    let resetView = null;
    let launcher = null;
    let frameId = null;
    let pendingViewport = null;
    let lastViewport = null;

    const reportError = error => {
        try {
            onError(error);
        } catch (_reportingError) {
            // Error reporting must not break viewer cleanup or leave loading chrome behind.
        }
    };

    const setLoading = loading => {
        loader?.classList.toggle('hidden', !loading);
        loader?.setAttribute?.('aria-hidden', String(!loading));
    };

    const setPresented = presented => {
        backdrop.classList.toggle('hidden', !presented);
        backdrop.setAttribute?.('aria-hidden', String(!presented));
    };

    const clearVisualization = () => {
        vizContainer.replaceChildren();
        resetView = null;
        lastViewport = null;
    };

    const showError = () => {
        clearVisualization();
        const errorElement = vizContainer.ownerDocument?.createElement?.('p');
        if (errorElement) {
            errorElement.className = 'town-layout-error';
            errorElement.setAttribute('role', 'status');
            errorElement.textContent = 'Town layout data could not be displayed.';
            vizContainer.replaceChildren(errorElement);
        } else {
            vizContainer.textContent = 'Town layout data could not be displayed.';
        }
    };

    const renderCurrent = viewport => {
        if (!open || !currentModel) return false;
        const nextViewport = viewport ?? measureTownLayoutViewport(vizContainer);
        const localBuildings = filterLocalBuildings(
            currentModel.buildings,
            currentModel.centerX,
            currentModel.centerZ,
            DEFAULT_VIEW_RADIUS
        );
        vizContainer.replaceChildren();
        const nextResetView = renderLayoutImpl(
            vizContainer,
            currentModel.centerX,
            currentModel.centerZ,
            localBuildings,
            DEFAULT_VIEW_RADIUS,
            nextViewport
        );
        resetView = typeof nextResetView === 'function' ? nextResetView : null;
        lastViewport = nextViewport;
        return true;
    };

    const scheduleRender = viewport => {
        pendingViewport = viewport;
        if (frameId !== null) return;
        frameId = requestFrame(() => {
            frameId = null;
            const scheduledViewport = pendingViewport;
            pendingViewport = null;
            if (!open || !currentModel) return;
            try {
                renderCurrent(scheduledViewport);
            } catch (error) {
                showError();
                reportError(error);
            }
        });
    };

    const observer = new ResizeObserverClass(entries => {
        if (!open || !currentModel) return;
        const entry = entries.find(candidate => candidate.target === vizContainer);
        const width = Number(entry?.contentRect?.width);
        const height = Number(entry?.contentRect?.height);
        if (!(width > 0) || !(height > 0)) return;
        const viewport = calculateTownLayoutViewport(width, height);
        if (lastViewport?.width === viewport.width && lastViewport?.height === viewport.height) return;
        scheduleRender(viewport);
    });
    observer.observe(vizContainer);

    const resetHandler = () => resetView?.();
    resetButton?.addEventListener?.('click', resetHandler);

    async function loadBuildings(buildingsUrl) {
        if (buildingCache.has(buildingsUrl)) return buildingCache.get(buildingsUrl);
        const response = await fetchImpl(buildingsUrl);
        if (!response || response.ok === false || typeof response.json !== 'function') {
            throw new Error('The buildings dataset request failed.');
        }
        const buildings = await response.json();
        if (!Array.isArray(buildings)) {
            throw new Error('The buildings dataset must be a JSON array.');
        }
        buildingCache.set(buildingsUrl, buildings);
        return buildings;
    }

    return Object.freeze({
        async open(townData, buildingsUrl, options = {}) {
            if (disconnected) throw new Error('Town layout controller has been disconnected.');
            const request = normalizeTownRequest(townData, buildingsUrl);
            const version = ++requestVersion;
            const activeElement = vizContainer.ownerDocument?.activeElement;
            launcher = options?.launcher?.focus
                ? options.launcher
                : activeElement?.focus
                  ? activeElement
                  : null;
            open = true;
            currentModel = null;
            pendingViewport = null;
            if (frameId !== null) {
                cancelFrame(frameId);
                frameId = null;
            }
            clearVisualization();
            setPresented(true);
            title.textContent = `Layout: ${request.name}`;
            setLoading(!buildingCache.has(request.buildingsUrl));

            try {
                const buildings = await loadBuildings(request.buildingsUrl);
                if (!open || version !== requestVersion) return false;
                currentModel = { ...request, buildings };
                renderCurrent();
                return true;
            } catch (error) {
                if (!open || version !== requestVersion) return false;
                currentModel = null;
                showError();
                reportError(error);
                return false;
            } finally {
                if (open && version === requestVersion) setLoading(false);
            }
        },

        close() {
            if (!open) return false;
            open = false;
            requestVersion += 1;
            currentModel = null;
            pendingViewport = null;
            if (frameId !== null) {
                cancelFrame(frameId);
                frameId = null;
            }
            setLoading(false);
            setPresented(false);
            clearVisualization();
            const focusTarget = launcher;
            launcher = null;
            focusLauncher(focusTarget);
            return true;
        },

        isOpen() {
            return open;
        },

        disconnect() {
            if (disconnected) return false;
            disconnected = true;
            open = false;
            requestVersion += 1;
            currentModel = null;
            pendingViewport = null;
            if (frameId !== null) {
                cancelFrame(frameId);
                frameId = null;
            }
            observer.disconnect();
            resetButton?.removeEventListener?.('click', resetHandler);
            setLoading(false);
            setPresented(false);
            clearVisualization();
            launcher = null;
            return true;
        }
    });
}

function renderLayout(container, centerX, centerZ, buildings, radius, viewport = null) {
    const { width, height, visibleRadiusX, visibleRadiusZ } =
        viewport ?? measureTownLayoutViewport(container, radius);
    
    // --- ASPECT RATIO FIX ---
    // The precomputed viewport keeps 1 game unit equal on both screen axes.

    // --- D3 Scales ---
    const scaleX = d3.scaleLinear()
        .domain([centerX - visibleRadiusX, centerX + visibleRadiusX])
        .range([0, width]);

    // Y-Axis Flipped (North Up)
    const scaleY = d3.scaleLinear()
        .domain([centerZ - visibleRadiusZ, centerZ + visibleRadiusZ])
        .range([0, height]);

    // -------------------------

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("background-color", "#1a1a1a");

    const g = svg.append("g");
    
    // Background Image
    // (This automatically respects the new uniform scale because it uses scaleX/scaleY)
    const mapPath = kenshiAssetUrl('data/overlays/Kenshi_Map.webp');
    g.append("image")
        .attr("href", mapPath)
        .attr("x", scaleX(WORLD_MIN))
        .attr("y", scaleY(WORLD_MIN)) 
        .attr("width", scaleX(WORLD_MAX) - scaleX(WORLD_MIN))
        .attr("height", scaleY(WORLD_MAX) - scaleY(WORLD_MIN)) 
        .attr("preserveAspectRatio", "none")
        .attr("opacity", 0.5); 

    // Groups & Icons
    const buildingGroups = g.selectAll(".building-group")
        .data(buildings)
        .enter()
        .append("g")
        .attr("class", "building-group")
        .attr("transform", d => {
            const x = scaleX(d.X);
            const y = scaleY(d.Z);
            
            const config = getBuildingConfig(d.BuildingDefId, d.BuildingName);

            if (config.fixedRotation) {
                return `translate(${x}, ${y})`;
            }

            const offset = config.rotationOffset || 0;
            const finalRot = (-d.RotationDegrees) + offset;
            
            return `translate(${x}, ${y}) rotate(${finalRot})`;
        });

    buildingGroups.each(function(d) {
        const config = getBuildingConfig(d.BuildingDefId, d.BuildingName);
        const el = d3.select(this);
        
        // Scaled Dimensions
        const pixelW = Math.abs(scaleX(centerX + config.w) - scaleX(centerX));
        const pixelH = Math.abs(scaleY(centerZ + config.d) - scaleY(centerZ));

        if (config.type === 'icon') {
            el.append("image")
                .attr("href", kenshiAssetUrl(config.src))
                .attr("width", pixelW)
                .attr("height", pixelH)
                .attr("x", -pixelW / 2) 
                .attr("y", -pixelH / 2);
        } else {
            el.append("rect")
                .attr("width", pixelW)
                .attr("height", pixelH)
                .attr("x", -pixelW / 2)
                .attr("y", -pixelH / 2)
                .attr("fill", "#6e7f91")
                .attr("stroke", "#000")
                .attr("stroke-width", 1);
        }
        el.append("title").text(d.BuildingName);
    });

    // Zoom Logic
    const zoom = d3.zoom()
        .scaleExtent([0.5, 8]) 
        // Update constraint to match new container dimensions
        .translateExtent([[-width, -height], [width*2, height*2]]) 
        .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    return () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
}

function getBuildingConfig(defId, name) {
    const searchStr = (defId + " " + name).toLowerCase();
    for (const [key, config] of Object.entries(BUILDING_CONFIG)) {
        if (searchStr.includes(key.toLowerCase())) {
            return config;
        }
    }
    return DEFAULT_SHAPE;
}
