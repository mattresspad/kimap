// modules/paint-tools.js

import { kenshiAssetUrl } from './asset-url.js';
import {
    DOCUMENT_TYPES,

    DocumentRecordState,
    createPaintPlanDocument,
    documentFileName,
    downloadDocumentFile,

    normalizePaintPlanDocument,
    parseDocumentFileText,

} from './documents/index.js';
import { PaintInteractionSession } from '../stores/tool-interaction-sessions.js';

let map;
let paintLayer;
let ghostLayer;
let paintStore;
let activeOrigin;
let activeCreatedAt;
let requestIconPopoverToggle;
let requestIconPopoverClose;
const paintDocumentState = new DocumentRecordState(DOCUMENT_TYPES.PAINT_PLAN);
const paintDocumentSubscribers = new Set();
const paintInteraction = new PaintInteractionSession();

// --- STATE VARIABLES ---
let startLatLng = null;
let tempShape = null;
let selectedPaintId = null; 
let activeColor = '#ff8800'; 
let activeIcon = 'skull';    

// Dragging State
let isDragging = false;
let dragItemId = null;
let dragStartLatLng = null;
let dragOriginalGeo = null;

// Icons Configuration (Updated with Geometry Icons)
const ICONS = {
    'cursor': 'icons/cursor-arrow.svg',
    'move': 'icons/move-arrows.svg', 
    'tools': 'icons/paint-palette.svg',
    'up': 'icons/move-up-arrow.svg',     
    'down': 'icons/move-down-arrow.svg', 
    'delete': 'icons/paint-delete.svg',
    'note': 'icons/sticky-note.svg',
    // Geometry Tools
    'draw-box': 'icons/draw-box.svg',      // NEW
    'draw-line': 'icons/draw-line.svg',    // NEW
    'draw-circle': 'icons/draw-circle.svg',// NEW
    'draw-arrow': 'icons/draw-arrow.svg',  // NEW
    // Stickers
    'skull': 'icons/skull.svg',
    'swords': 'icons/crossed-swords.svg',
    'check-mark': 'icons/check-mark.svg',
    'pickaxe': 'icons/pickaxe.svg',
    'star': 'icons/star.svg',
    'target': 'icons/target-reticle.svg',
    'fire': 'icons/fire.svg',
    'warning': 'icons/warning.svg',
    'prison': 'icons/prisoner.svg'
};

// --- 1. WORKBENCH TOOL SHELF ---
function mountPaintToolShelf(host, popoverHost) {
    if (!host) throw new TypeError('A Plan Tools Paint host is required.');
    if (!popoverHost) throw new TypeError('A map popover host is required.');
    const container = document.createElement('div');
    container.className = 'paint-control-container';
    container.innerHTML = `
            <div id="paint-toolbar">
                <div class="toolbar-section">
                    <div class="section-label">Selection</div>
                    <div class="section-content">
                        <button type="button" id="tool-btn-select" class="paint-sub-btn" title="Select Object" aria-label="Select paint item">
                            <img src="${kenshiAssetUrl(ICONS.cursor)}" alt="">
                        </button>
                        <button type="button" id="tool-btn-move" class="paint-sub-btn" title="Move Selected" aria-label="Move selected paint item">
                            <img src="${kenshiAssetUrl(ICONS.move)}" alt="">
                        </button>
                        <div style="width:1px; height:20px; background:#555; margin:0 4px;"></div>
                        <button type="button" id="paint-layer-up" class="paint-sub-btn" title="Bring Forward" aria-label="Bring selected paint item forward" disabled>
                            <img src="${kenshiAssetUrl(ICONS.up)}" alt="">
                        </button>
                        <button type="button" id="paint-layer-down" class="paint-sub-btn" title="Send Backward" aria-label="Send selected paint item backward" disabled>
                            <img src="${kenshiAssetUrl(ICONS.down)}" alt="">
                        </button>
                        <button type="button" id="paint-layer-del" class="paint-sub-btn" title="Delete" aria-label="Delete selected paint item" disabled>
                            <img src="${kenshiAssetUrl(ICONS.delete)}" alt="">
                        </button>
                    </div>
                </div>

                <div class="toolbar-section">
                    <div class="section-label">Color</div>
                    <div class="section-content">
                        <div id="color-wrapper" class="color-wrapper" style="background-color: ${activeColor};" title="Change Color">
                            <input type="color" id="paint-color-picker" class="paint-color-picker-hidden" value="${activeColor}" aria-label="Paint color">
                        </div>
                    </div>
                </div>

                <div class="toolbar-section">
                    <div class="section-label">Geometry</div>
                    <div class="section-content">
                        <button type="button" id="tool-btn-box" class="paint-sub-btn" title="Box" aria-label="Draw box">
                            <img src="${kenshiAssetUrl(ICONS['draw-box'])}" alt="">
                        </button>
                        <button type="button" id="tool-btn-line" class="paint-sub-btn" title="Line (Shift to Snap)" aria-label="Draw line">
                            <img src="${kenshiAssetUrl(ICONS['draw-line'])}" alt="">
                        </button>
                        <button type="button" id="tool-btn-arrow" class="paint-sub-btn" title="Arrow (Shift to Snap)" aria-label="Draw arrow">
                            <img src="${kenshiAssetUrl(ICONS['draw-arrow'])}" alt="">
                        </button>
                        <button type="button" id="tool-btn-circle" class="paint-sub-btn" title="Circle" aria-label="Draw circle">
                            <img src="${kenshiAssetUrl(ICONS['draw-circle'])}" alt="">
                        </button>
                    </div>
                </div>

                <div class="toolbar-section">
                    <div class="section-label">Icons & Notes</div>
                    <div class="section-content">
                        <div class="icon-dropdown-container">
                            <button type="button" id="tool-btn-icon-main" class="paint-sub-btn" title="Place Icon" aria-label="Place icon" aria-haspopup="true" aria-expanded="false">
                                <img id="current-icon-img" src="${kenshiAssetUrl(ICONS[activeIcon])}" alt="">
                            </button>
                        </div>
                        <button type="button" id="tool-btn-note" class="paint-sub-btn" title="Sticky Note" aria-label="Place sticky note">
                            <img src="${kenshiAssetUrl(ICONS.note)}" alt="">
                        </button>
                    </div>
                </div>

                <div class="toolbar-section">
                    <div class="section-label">Layer</div>
                    <div class="section-content">
                        <label class="paint-toggle-label">
                            <input type="checkbox" id="paint-toggle-visible" checked> View
                        </label>
                    </div>
                </div>
            </div>`;
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    host.replaceChildren(container);

    document.getElementById('icon-grid-popover')?.remove();
    const iconPopover = document.createElement('div');
    iconPopover.id = 'icon-grid-popover';
    iconPopover.className = 'map-anchored-popover paint-icon-popover';
    iconPopover.setAttribute('role', 'group');
    iconPopover.setAttribute('aria-label', 'Paint icon choices');
    iconPopover.hidden = true;
    iconPopover.innerHTML = generateIconGrid();
    L.DomEvent.disableClickPropagation(iconPopover);
    L.DomEvent.disableScrollPropagation(iconPopover);
    popoverHost.appendChild(iconPopover);
}

function generateIconGrid() {
    const excluded = ['cursor', 'tools', 'note', 'up', 'down', 'delete', 'move', 'draw-box', 'draw-line', 'draw-circle', 'draw-arrow'];
    return Object.keys(ICONS).filter(k => !excluded.includes(k)).map(k => `
        <button type="button" class="icon-grid-btn${k === activeIcon ? ' active' : ''}" data-icon="${k}" aria-label="Place ${k} icon" aria-pressed="${String(k === activeIcon)}">
            <img src="${kenshiAssetUrl(ICONS[k])}" alt="">
        </button>
    `).join('');
}

// --- 2. INITIALIZATION ---
export function initPaintModule(deps) {
    map = deps.map;
    paintStore = deps.paintStore;
    activeOrigin = { ...deps.documentOrigin };
    activeCreatedAt = new Date().toISOString();
    requestIconPopoverToggle = deps.onIconPopoverToggle;
    requestIconPopoverClose = deps.onIconPopoverClose;
    if (typeof requestIconPopoverToggle !== 'function' || typeof requestIconPopoverClose !== 'function') {
        throw new TypeError('Paint icon popover callbacks are required.');
    }
    map.createPane('paintPane');
    map.getPane('paintPane').style.zIndex = 450;
    paintLayer = L.layerGroup().addTo(map);
    ghostLayer = L.layerGroup().addTo(map);
    mountPaintToolShelf(deps.toolHost, deps.popoverHost);

    // Subscribe to Store
    paintStore.subscribe((items) => {
        renderPaintItems(items);
        renderPaintManagerList(items);
        paintDocumentState.markDirty();
        renderPaintDocumentStatus();
    });
    map.on('click', onMapClick);
    map.on('mousemove', onMapMouseMove);
    map.on('mouseup', onMapMouseUp);
    map.on('dblclick', (e) => { 
        if(paintInteraction.getSnapshot().active) L.DomEvent.stop(e);
    });
}

// --- 3. UI SETUP ---
export function setupPaintUI() {
    console.log("Setting up Paint UI listeners...");
    synchronizePaintToolsPresentation(paintInteraction.getSnapshot());

    setupToolButton('tool-btn-select', 'select', null);
    setupToolButton('tool-btn-move', 'move', null);
    setupToolButton('tool-btn-box', 'draw', 'box');
    setupToolButton('tool-btn-line', 'draw', 'line');
    setupToolButton('tool-btn-arrow', 'draw', 'arrow'); // NEW
    setupToolButton('tool-btn-circle', 'draw', 'circle');
    setupToolButton('tool-btn-note', 'place', 'note');

    // Icon Picker Logic
    const iconBtn = document.getElementById('tool-btn-icon-main');
    const iconPopover = document.getElementById('icon-grid-popover');
    if (iconBtn && iconPopover) {
        iconBtn.onclick = (e) => {
            activateTool('place', 'icon', iconBtn);
            requestIconPopoverToggle();
            e.stopPropagation();
        };

        iconPopover.querySelectorAll('.icon-grid-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                activeIcon = btn.dataset.icon;
                document.getElementById('current-icon-img').src = kenshiAssetUrl(ICONS[activeIcon]);
                iconPopover.querySelectorAll('.icon-grid-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                requestIconPopoverClose({ restoreFocus: true });
                activateTool('place', 'icon', iconBtn);
            };
        });
    }

    // Color Picker Logic
    const colorInput = document.getElementById('paint-color-picker');
    const colorWrapper = document.getElementById('color-wrapper');
    if(colorInput && colorWrapper) {
        colorInput.oninput = (e) => {
            activeColor = e.target.value;
            colorWrapper.style.backgroundColor = activeColor;
        };
    }

    // Layer Controls
    document.getElementById('paint-layer-up').onclick = () => {
        if (selectedPaintId) paintStore.moveItem(selectedPaintId, 1);
    };
    document.getElementById('paint-layer-down').onclick = () => {
        if (selectedPaintId) paintStore.moveItem(selectedPaintId, -1);
    };
    document.getElementById('paint-layer-del').onclick = () => {
        if (selectedPaintId) {
            paintStore.removeItem(selectedPaintId);
            deselectAll();
        }
    };

    const visCheck = document.getElementById('paint-toggle-visible');
    if (visCheck) {
        visCheck.onchange = (e) => {
            if (e.target.checked) map.addLayer(paintLayer);
            else map.removeLayer(paintLayer);
        };
    }

    setupManagerWindow();
}

// --- 4. INTERACTION LOGIC ---

function synchronizePaintToolsPresentation(snapshot) {
    const toolbar = document.getElementById('paint-toolbar');
    toolbar?.setAttribute('data-tools-open', String(snapshot.toolsOpen));
    toolbar?.setAttribute('data-tool-state', snapshot.toolState);
}

function resolvePaintToolButton(state, mode) {
    const id = {
        'select:null': 'tool-btn-select',
        'move:null': 'tool-btn-move',
        'draw:box': 'tool-btn-box',
        'draw:line': 'tool-btn-line',
        'draw:arrow': 'tool-btn-arrow',
        'draw:circle': 'tool-btn-circle',
        'place:icon': 'tool-btn-icon-main',
        'place:note': 'tool-btn-note'
    }[`${state}:${String(mode)}`];
    return id ? document.getElementById(id) : null;
}

function activateTool(state, mode, btnElement) {
    document.querySelectorAll('.paint-sub-btn').forEach(button => {
        button.style.backgroundColor = '';
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
    });
    if (btnElement) {
        btnElement.classList.add('active');
        btnElement.setAttribute('aria-pressed', 'true');
    }
    
    const change = paintInteraction.activate(state, mode);
    synchronizePaintToolsPresentation(paintInteraction.getSnapshot());
    const mc = document.getElementById('map-container');
    if (state === 'draw' || state === 'place') mc.style.cursor = 'crosshair';
    else if (state === 'move') mc.style.cursor = 'move';
    else if (state === 'select') mc.style.cursor = 'default';
    else mc.style.cursor = '';

    if(state === 'draw') map.dragging.disable(); 
    else map.dragging.enable();
    return change;
}

/**
 * Snaps a target point to the nearest 45-degree increment relative to start.
 */
function snapToAngle(start, current) {
    // 1. Convert to pixel points for accurate angle calculation
    const p1 = map.project(start);
    const p2 = map.project(current);
    
    // 2. Calculate angle in radians
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    
    // 3. Snap to nearest 45 degrees (PI/4)
    // We add PI to normalize, snap, then subtract to get range correct
    const snapIncrement = Math.PI / 4;
    const snappedAngle = Math.round(angle / snapIncrement) * snapIncrement;
    
    // 4. Calculate distance
    const dist = p1.distanceTo(p2);
    
    // 5. Project new point
    const newPixel = p1.add(L.point(Math.cos(snappedAngle) * dist, Math.sin(snappedAngle) * dist));
    
    // 6. Convert back to LatLng
    return map.unproject(newPixel);
}

function onMapClick(e) {
    const { toolState, drawingMode } = paintInteraction.getSnapshot();
    if (toolState === 'off') return;
    if (e.originalEvent) e.originalEvent.kimapPlanGestureConsumed = true;
    if (isDragging) return;

    if (toolState === 'select') {
        deselectAll();
        return; 
    }

    if (toolState === 'move') {
        return;
    }

    // DRAW/PLACE MODES
    if (toolState === 'draw') {
        let currentLatLng = e.latlng;

        // Apply Snapping on Click as well
        if (startLatLng && (drawingMode === 'line' || drawingMode === 'arrow')) {
            if (e.originalEvent.shiftKey) {
                currentLatLng = snapToAngle(startLatLng, currentLatLng);
            }
        }

        if (!startLatLng) {
            startLatLng = currentLatLng;
            
            if (drawingMode === 'box') tempShape = L.rectangle([startLatLng, startLatLng], { color: activeColor }).addTo(ghostLayer);
            else if (drawingMode === 'line' || drawingMode === 'arrow') tempShape = L.polyline([startLatLng, startLatLng], { color: activeColor }).addTo(ghostLayer);
            else if (drawingMode === 'circle') tempShape = L.circle(startLatLng, { radius: 1, color: activeColor }).addTo(ghostLayer);
        } else {
            // FINISH DRAWING
            if (drawingMode === 'box') paintStore.addItem('box', [startLatLng, currentLatLng], { color: activeColor });
            else if (drawingMode === 'line') paintStore.addItem('line', [startLatLng, currentLatLng], { color: activeColor });
            else if (drawingMode === 'arrow') paintStore.addItem('arrow', [startLatLng, currentLatLng], { color: activeColor }); // NEW
            else if (drawingMode === 'circle') {
                const radius = map.distance(startLatLng, currentLatLng);
                paintStore.addItem('circle', startLatLng, { color: activeColor, radius: radius });
            }
            startLatLng = null;
            ghostLayer.clearLayers();
        }
    } else if (toolState === 'place') {
        if (drawingMode === 'icon') {
            paintStore.addItem('icon', e.latlng, { iconType: activeIcon });
        } else if (drawingMode === 'note') {
            const text = prompt("Note text:");
            if(text) paintStore.addItem('note', e.latlng, { text: text });
        }
    }
}

function onMapMouseMove(e) {
    const { toolState, drawingMode } = paintInteraction.getSnapshot();
    // Drawing Preview
    if (toolState === 'draw' && startLatLng && tempShape) {
        let currentLatLng = e.latlng;

        // SNAPPING LOGIC (Visual Feedback)
        if ((drawingMode === 'line' || drawingMode === 'arrow') && e.originalEvent.shiftKey) {
            currentLatLng = snapToAngle(startLatLng, currentLatLng);
        }

        if (drawingMode === 'box') tempShape.setBounds([startLatLng, currentLatLng]);
        else if (drawingMode === 'line' || drawingMode === 'arrow') tempShape.setLatLngs([startLatLng, currentLatLng]);
        else if (drawingMode === 'circle') {
            const radius = map.distance(startLatLng, currentLatLng);
            tempShape.setRadius(radius);
        }
    }

    // Moving Logic
    if (toolState === 'move' && isDragging && dragItemId && dragStartLatLng) {
        const deltaLat = e.latlng.lat - dragStartLatLng.lat;
        const deltaLng = e.latlng.lng - dragStartLatLng.lng;

        const layer = getLayerById(dragItemId);
        if (layer) {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                const orig = dragOriginalGeo;
                layer.setLatLng(L.latLng(orig.lat + deltaLat, orig.lng + deltaLng));
            } else if (layer instanceof L.Polyline || layer instanceof L.Rectangle) {
                const newLatLngs = dragOriginalGeo.map(pt => L.latLng(pt.lat + deltaLat, pt.lng + deltaLng));
                layer.setLatLngs(newLatLngs);
            }
        }
    }
}

function onMapMouseUp(_event) {
    if (paintInteraction.getSnapshot().toolState === 'move' && isDragging && dragItemId) {
        const layer = getLayerById(dragItemId);
        if (layer) {
            let finalGeo;
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                finalGeo = layer.getLatLng();
            } else {
                finalGeo = layer.getLatLngs();
                if(finalGeo.length === 1 && Array.isArray(finalGeo[0])) finalGeo = finalGeo[0];
            }
            updateItemGeometry(dragItemId, finalGeo);
        }

        isDragging = false;
        dragItemId = null;
        dragStartLatLng = null;
        dragOriginalGeo = null;
        map.dragging.enable();
        
        setTimeout(() => { isDragging = false; }, 50);
    }
}

// --- 5. RENDERER ---

function renderPaintItems(items) {
    paintLayer.clearLayers();
    items.forEach(item => {
        let layer;
        const isSelected = (item.id === selectedPaintId);
        const color = item.properties.color || '#ff8800';
        const weight = isSelected ? 5 : (item.type === 'line' || item.type === 'arrow' ? 3 : 2);
        const dashArray = isSelected ? '10, 10' : null;
        
        const opts = { color: color, weight: weight, dashArray: dashArray, className: isSelected ? 'paint-selected-vector' : '' };

        if (item.type === 'box') {
            layer = L.rectangle(item.geometry, opts);
        } 
        else if (item.type === 'line') {
            layer = L.polyline(item.geometry, opts);
        } 
        else if (item.type === 'circle') {
            layer = L.circle(item.geometry, { ...opts, radius: item.properties.radius });
        } 
        else if (item.type === 'arrow') {
            // Draw Main Line
            const line = L.polyline(item.geometry, opts);
            
            // Draw Arrowhead
            const points = item.geometry;
            if (points && points.length === 2) {
                const p1 = map.project(points[0]);
                const p2 = map.project(points[1]);
                
                // Angle of the line
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const headLen = 15; // Length of arrow wings
                const angleOffset = Math.PI / 7; // Angle of wings

                // Wing 1
                const w1x = p2.x - headLen * Math.cos(angle - angleOffset);
                const w1y = p2.y - headLen * Math.sin(angle - angleOffset);
                // Wing 2
                const w2x = p2.x - headLen * Math.cos(angle + angleOffset);
                const w2y = p2.y - headLen * Math.sin(angle + angleOffset);

                const wing1 = map.unproject(L.point(w1x, w1y));
                const wing2 = map.unproject(L.point(w2x, w2y));

                // Create a small polyline for the head
                const arrowHead = L.polyline([wing1, points[1], wing2], { ...opts, fill: false });
                
                // Group them
                layer = L.layerGroup([line, arrowHead]);
                
                // Monkey-patch for Dragging Logic (since logic expects single layer methods)
                layer.on = function(type, fn) {
                    line.on(type, fn);
                    arrowHead.on(type, fn);
                };
                layer.setLatLngs = function(latlngs) {
                    // Update main line
                    line.setLatLngs(latlngs); 
                    // Re-calc arrow head (expensive but accurate)
                    // ... For simple dragging, we might just redraw on mouseup to save perf.
                    // This is complex. Simpler approach for now:
                    // If moving an arrow, it behaves like a group. 
                    // UpdateItemGeometry will handle the save.
                }
                // For 'getLayerById' to return something useful for Dragging logic, 
                // we might need to attach the paintID to the internal layers or the group.
                layer.getLatLngs = () => line.getLatLngs();
            } else {
                layer = line; // Fallback
            }
        }
        else if (item.type === 'icon') {
            const iconUrl = kenshiAssetUrl(ICONS[item.properties.iconType] || ICONS['tools']);
            const cls = 'paint-custom-icon' + (isSelected ? ' paint-selected-element' : '');
            const icon = L.icon({ iconUrl: iconUrl, iconSize: [32, 32], iconAnchor: [16, 32], className: cls });
            layer = L.marker(item.geometry, { icon: icon });
        } 
        else if (item.type === 'note') {
            const note = document.createElement('div');
            note.className = 'sticky-note-content';
            note.textContent = item.properties.text;
            note.style.cssText = 'background:#ffeb3b;padding:5px;font-size:12px;border-radius:3px;box-shadow:2px 2px 4px rgba(0,0,0,0.3);color:black;min-width:100px;';
            note.style.border = isSelected ? '2px solid cyan' : '1px solid #999';
            const icon = L.divIcon({ className: 'sticky-note-wrapper', html: note, iconSize: [null, null], iconAnchor: [50, 10] });
            layer = L.marker(item.geometry, { icon: icon });
        }

        if (layer) {
            // Attach ID to the layer (or all sublayers if group)
            if(layer.eachLayer) {
                layer.eachLayer(l => l.paintId = item.id);
            } else {
                layer.paintId = item.id;
            }

            // MOUSE DOWN (Start Dragging)
            const handleMouseDown = (e) => {
                if (paintInteraction.getSnapshot().toolState === 'move') {
                    L.DomEvent.stopPropagation(e);
                    isDragging = true;
                    dragItemId = item.id;
                    dragStartLatLng = e.latlng;
                    map.dragging.disable();

                    if (item.type === 'box' || item.type === 'line' || item.type === 'arrow') {
                        dragOriginalGeo = item.geometry.map(ll => L.latLng(ll.lat, ll.lng));
                    } else {
                        dragOriginalGeo = L.latLng(item.geometry.lat, item.geometry.lng);
                    }
                }
            };

            // CLICK (Selection / Delete)
            const handleClick = (e) => {
                if (isDragging) return;
                if (paintInteraction.getSnapshot().toolState === 'select') {
                    L.DomEvent.stopPropagation(e);
                    selectItem(item.id);
                } else if(e.originalEvent.shiftKey) {
                    paintStore.removeItem(item.id);
                }
            };

            // Bind events
            if(layer.eachLayer) {
                layer.eachLayer(l => { l.on('mousedown', handleMouseDown); l.on('click', handleClick); });
            } else {
                layer.on('mousedown', handleMouseDown);
                layer.on('click', handleClick);
            }

            layer.addTo(paintLayer);
        }
    });
    updateLayerButtons();
}

// --- 6. MANAGER WINDOW LOGIC (Same as before) ---
function setupManagerWindow() {
    const undoBtn = document.getElementById('paint-undo-btn');
    if(undoBtn) undoBtn.onclick = () => { if(paintStore.undo()) logPaintAction("Undid last action"); };

    const delBtn = document.getElementById('paint-delete-btn');
    if(delBtn) delBtn.onclick = () => {
        if (selectedPaintId) {
            paintStore.removeItem(selectedPaintId);
            selectedPaintId = null;
            logPaintAction("Deleted selected item");
            updateManagerButtons();
        }
    };

    const clearBtn = document.getElementById('paint-clear-all-btn');
    if(clearBtn) clearBtn.onclick = () => {
        if(confirm("Clear ALL paint items?")) {
            const items = paintStore.getItems();
            items.forEach(i => paintStore.removeItem(i.id));
            logPaintAction("Cleared all items");
        }
    };

    const listContainer = document.getElementById('paint-list-container');
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            listContainer.querySelectorAll('li').forEach(item => item.classList.remove('active'));
            selectedPaintId = li.dataset.id;
            li.classList.add('active');
            updateManagerButtons();
        });
    }

    setupPaintIO();
}

function renderPaintManagerList(items) {
    const listContainer = document.getElementById('paint-list-container');
    if (!listContainer) return;
    if (items.length === 0) {
        const empty = document.createElement('p');
        empty.style.padding = '10px';
        empty.style.color = '#888';
        const emphasis = document.createElement('em');
        emphasis.textContent = 'No items drawn.';
        empty.appendChild(emphasis);
        listContainer.replaceChildren(empty);
        selectedPaintId = null;
        updateManagerButtons();
        return;
    }
    const list = document.createElement('ul');
    items.forEach(item => {
        const row = document.createElement('li');
        row.dataset.id = item.id;
        row.classList.toggle('active', item.id === selectedPaintId);
        const label = document.createElement('strong');
        label.textContent = item.type.toUpperCase();
        const details = document.createElement('small');
        details.textContent = item.type === 'note'
            ? `"${item.properties.text}"`
            : item.type === 'icon' ? item.properties.iconType : 'Geometry';
        row.append(label, details);
        list.appendChild(row);
    });
    listContainer.replaceChildren(list);
}

function updateManagerButtons() {
    const delBtn = document.getElementById('paint-delete-btn');
    if (delBtn) delBtn.disabled = !selectedPaintId;
}

function logPaintAction(msg) {
    const log = document.getElementById('paint-log-content');
    if(log) {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
    }
}

// --- 7. EXPORT / IMPORT (API) ---
function setupPaintIO() {
    const fileExportBtn = document.getElementById('paint-file-export-btn');
    const fileInput = document.getElementById('paint-file-import-input');
    if (fileExportBtn) {
        fileExportBtn.onclick = () => {
            const name = paintDocumentState.getSnapshot().name ?? 'paint-plan';
            downloadDocumentFile(buildPaintDocument(), documentFileName(name, DOCUMENT_TYPES.PAINT_PLAN));
            logPaintAction(`Exported "${name}" as JSON.`);
        };
    }
    if (fileInput) {
        fileInput.onchange = async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            try {
                const imported = parseDocumentFileText(await file.text(), normalizePaintPlanDocument);
                replacePaintDocument(imported);
                paintDocumentState.clear({ dirty: true });
                renderPaintDocumentStatus();
                logPaintAction(`Imported ${String(imported.items.length)} paint items from JSON.`);
            } catch (error) {
                logPaintAction(`Import failed: ${error.message}`);
            } finally {
                fileInput.value = '';
            }
        };
    }
}

function buildPaintDocument() {
    return createPaintPlanDocument({
        origin: activeOrigin,
        items: paintStore.getItems(),
        createdAt: activeCreatedAt,
        updatedAt: new Date().toISOString()
    });
}

function replacePaintDocument(documentValue) {
    const normalized = normalizePaintPlanDocument(documentValue);
    paintStore.loadItems(normalized.items);
    activeOrigin = { ...normalized.origin };
    activeCreatedAt = normalized.createdAt;
    selectedPaintId = null;
    return normalized;
}

function renderPaintDocumentStatus() {
    const status = document.getElementById('paint-document-status');
    const state = getPaintDocumentStatus();
    if (status) status.textContent = state.dirty ? 'Changes in this session. Export JSON to keep a copy.' : 'Ready for file import or export.';

    paintDocumentSubscribers.forEach(subscriber => {
        try {
            subscriber(state);
        } catch (error) {
            console.error('Paint document subscriber failed.', error);
        }
    });
}

/**
 * Returns read-only paint document metadata plus the current item count.
 */
export function getPaintDocumentStatus() {
    return Object.freeze({
        ...paintDocumentState.getSnapshot(),
        itemCount: paintStore?.getItems().length ?? 0
    });
}

/**
 * Subscribes to paint document/status changes. Returns an unsubscribe callback.
 */
export function subscribePaintDocumentStatus(subscriber) {
    if (typeof subscriber !== 'function') throw new TypeError('A paint document subscriber is required.');
    paintDocumentSubscribers.add(subscriber);
    return () => paintDocumentSubscribers.delete(subscriber);
}


// --- HELPER FUNCTIONS ---

function updateItemGeometry(id, newGeo) {
    if (typeof paintStore.updateItem === 'function') {
        paintStore.updateItem(id, { geometry: newGeo });
        logPaintAction("Item moved");
    } else {
        const items = paintStore.getItems();
        const oldItem = items.find(i => i.id === id);
        if (oldItem) {
            paintStore.removeItem(id);
            paintStore.addItem(oldItem.type, newGeo, oldItem.properties); 
            logPaintAction("Item moved (Fallback)");
        }
    }
}

function getLayerById(id) {
    let found = null;
    paintLayer.eachLayer(l => {
        if (l.paintId === id) found = l;
        // Check group layers
        if (l.eachLayer && !found) {
            l.eachLayer(sub => { if(sub.paintId === id) found = l; });
        }
    });
    return found;
}

function selectItem(id) {
    selectedPaintId = id;
    renderPaintItems(paintStore.getItems());
}

function deselectAll() {
    selectedPaintId = null;
    renderPaintItems(paintStore.getItems());
}

function updateLayerButtons() {
    const disabled = (selectedPaintId === null);
    const up = document.getElementById('paint-layer-up');
    const down = document.getElementById('paint-layer-down');
    const del = document.getElementById('paint-layer-del');
    if(up) up.disabled = disabled;
    if(down) down.disabled = disabled;
    if(del) del.disabled = disabled;
}

function setupToolButton(id, state, mode) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => activateTool(state, mode, btn);
}

function resetPaintToolButtons() {
    document.querySelectorAll('.paint-sub-btn').forEach(button => {
        button.style.backgroundColor = '';
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
    });
}

export function isPaintActive() {
    return paintInteraction.getSnapshot().active;
}

export function getPaintInteractionState() {
    return paintInteraction.getSnapshot();
}

export function subscribePaintInteraction(subscriber) {
    return paintInteraction.subscribe(subscriber);
}

export function openPaintTools({ toolState = 'off', drawingMode = null } = {}) {
    let change;
    if (toolState === 'off') {
        change = paintInteraction.open();
        synchronizePaintToolsPresentation(paintInteraction.getSnapshot());
        map?.dragging?.enable();
    } else {
        change = activateTool(
            toolState,
            drawingMode,
            resolvePaintToolButton(toolState, drawingMode)
        );
    }
    return change !== false;
}

export function startPaintDrawing(drawingMode = 'box') {
    return openPaintTools({ toolState: 'draw', drawingMode });
}

function clearPaintGestureState() {
    const hadGesture =
        paintInteraction.getSnapshot().active ||
        startLatLng !== null ||
        tempShape !== null ||
        isDragging;
    if (!hadGesture) return false;

    if (isDragging && paintStore && paintLayer) renderPaintItems(paintStore.getItems());
    startLatLng = null;
    tempShape = null;
    isDragging = false;
    dragItemId = null;
    dragStartLatLng = null;
    dragOriginalGeo = null;
    ghostLayer?.clearLayers();
    requestIconPopoverClose?.({ restoreFocus: false });
    document.getElementById('map-container')?.style.removeProperty('cursor');
    map?.dragging?.enable();
    resetPaintToolButtons();
    return true;
}

export function closePaintTools() {
    const hadGesture = clearPaintGestureState();
    const change = paintInteraction.close();
    synchronizePaintToolsPresentation(paintInteraction.getSnapshot());
    return hadGesture || change !== false;
}

/**
 * Cancels the current Paint gesture/tool without changing the PaintStore document.
 * Returns true only when an interaction was active.
 */
export function cancelPaintInteraction() {
    const hadGesture = clearPaintGestureState();
    if (!hadGesture) return false;
    paintInteraction.cancel();
    synchronizePaintToolsPresentation(paintInteraction.getSnapshot());
    return true;
}
