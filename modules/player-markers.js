// modules/player-markers.js

import { kenshiAssetUrl } from './asset-url.js';
import {
    DOCUMENT_TYPES,

    DocumentRecordState,
    createMarkerSetDocument,
    documentFileName,
    downloadDocumentFile,

    normalizeMarkerSetDocument,
    parseDocumentFileText,

} from './documents/index.js';

// --- Module-level variables ---
// We'll get these from script.js during initialization
let map;
let playerMarkerLayer;
let playerMarkerStore;
let selectedMarkerId = null;
let documentOrigin;
let activeOrigin;
let activeCreatedAt;
const markerDocumentState = new DocumentRecordState(DOCUMENT_TYPES.MARKER_SET);
const markerDocumentSubscribers = new Set();
const markerInteractionSubscribers = new Set();
const inactiveMarkerInteraction = Object.freeze({ placementActive: false });
let placementInteractionUnsubscribe = null;

let playerMarkerIcon = null;

function getPlayerMarkerIcon() {
    if (!playerMarkerIcon) {
        playerMarkerIcon = L.icon({
            iconUrl: kenshiAssetUrl('icons/default-player-marker.svg'),
            iconSize:     [32, 32],
            iconAnchor:   [16, 32],
            popupAnchor:  [0, -32],
            className: 'player-marker-icon'
        });
    }

    return playerMarkerIcon;
}

/**
 * Initializes the player marker module.
 * This is called by script.js and passes in all dependencies.
 */
export function initPlayerMarkerModule(deps) {
    // Connect dependencies
    map = deps.map;
    playerMarkerLayer = deps.playerMarkerLayer;
    playerMarkerStore = deps.playerMarkerStore;
    documentOrigin = { ...deps.documentOrigin };
    activeOrigin = { ...documentOrigin };
    activeCreatedAt = new Date().toISOString();

    setupPlayerMarkerMapInteraction();

    // The subscription now lives here
    playerMarkerStore.subscribe(() => {
        const markers = playerMarkerStore.getMarkers();
        renderPlayerMarkers(markers); // Updates the map
        renderMarkerList(markers);    // Updates the new window
        markerDocumentState.markDirty();
        renderMarkerDocumentStatus();
    });
    placementInteractionUnsubscribe?.();
    placementInteractionUnsubscribe = playerMarkerStore.subscribePlacementInteraction(change => {
        synchronizePlacementControls(change.snapshot.placementActive);
        for (const subscriber of [...markerInteractionSubscribers]) {
            try {
                subscriber(change);
            } catch (_error) {
                // Presentation subscribers cannot roll back a committed interaction change.
            }
        }
    });
    synchronizePlacementControls(playerMarkerStore.isPlacementModeActive());
    setupWindowControls();
    // Initialize API listeners
    setupImportExportListeners();
}

/**
 * Creates and adds the custom Player Marker Hub control to the map.
 * (This was setupPlayerMarkerHubControl)
 */
function setupPlayerMarkerMapInteraction() {
    map.on('click', (e) => {
        if (!playerMarkerStore.isPlacementModeActive()) return;
        if (e.originalEvent) e.originalEvent.kimapPlanGestureConsumed = true;

        const markerName = prompt("Enter a name for your new marker:", `Outpost ${playerMarkerStore.nextId}`);
        if (markerName) {
            const newMarker = playerMarkerStore.addMarker(e.latlng, { name: markerName, description: "" });
            showPlayerMarkerPanel(newMarker.id); // <-- CHANGED
            logAction(`Created marker "${markerName}"`, 'add');
        }
        
        cancelPlayerMarkerPlacement();
    });
}

function synchronizePlacementControls(active, { collapseTools = false } = {}) {
    const mapContainer = document.getElementById('map-container');

    mapContainer?.classList.toggle('placing-mode', active);
    if (collapseTools) mapContainer?.classList.remove('marker-tools-expanded');
}

/**
 * Starts marker placement without mutating marker document content.
 * Returns false when placement was already active or the module is not initialized.
 */
export function startPlayerMarkerPlacement() {
    if (!playerMarkerStore) return false;
    return playerMarkerStore.activatePlacementMode() !== false;
}

/**
 * Cancels the current marker-placement gesture without changing marker data.
 * Returns true only when placement was active.
 */
export function cancelPlayerMarkerPlacement() {
    if (!playerMarkerStore?.isPlacementModeActive()) return false;
    const changed = playerMarkerStore.deactivatePlacementMode();
    synchronizePlacementControls(false, { collapseTools: true });
    return changed !== false;
}

export function getPlayerMarkerInteractionState() {
    return playerMarkerStore?.getPlacementInteractionState() ?? inactiveMarkerInteraction;
}

export function subscribePlayerMarkerInteraction(subscriber) {
    if (typeof subscriber !== 'function') {
        throw new TypeError('Marker interaction subscriber must be a function.');
    }
    markerInteractionSubscribers.add(subscriber);
    return () => markerInteractionSubscribers.delete(subscriber);
}

/**
 * Renders the markers onto the Leaflet map layer.
 */
function renderPlayerMarkers(markers) {
    if (!playerMarkerLayer) return;
    
    playerMarkerLayer.clearLayers();

    markers.forEach(markerData => {
        const marker = L.marker([markerData.lat, markerData.lng], {
            icon: getPlayerMarkerIcon(),
            title: markerData.name // Adds default browser tooltip
        }).addTo(playerMarkerLayer);

        // Wire the map click to the new function
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e); 
            showPlayerMarkerPanel(markerData.id); 
        });
    });
}

/**
 * Renders the list of markers in the new management window.
 */
function renderMarkerList(markers) {
    const listContainer = document.getElementById('pm-list-container');
    if (!listContainer) return; // Window isn't open or doesn't exist

    if (markers.length === 0) {
        const empty = document.createElement('p');
        const emphasis = document.createElement('em');
        emphasis.textContent = 'No markers placed.';
        empty.appendChild(emphasis);
        listContainer.replaceChildren(empty);
        selectedMarkerId = null; 
        updateControlButtons();
        return;
    }

    const list = document.createElement('ul');
    markers.forEach(marker => {
        const item = document.createElement('li');
        item.dataset.markerId = marker.id;
        item.classList.toggle('active', marker.id === selectedMarkerId);
        const name = document.createElement('strong');
        name.textContent = marker.name;
        const coordinates = document.createElement('small');
        coordinates.textContent = `(${marker.lat.toFixed(2)}, ${marker.lng.toFixed(2)})`;
        item.append(name, coordinates);
        list.appendChild(item);
    });
    listContainer.replaceChildren(list);
}

/**
 * --- NEW FUNCTION ---
 * Sets up the one-time click listeners for the marker window.
 */
function setupWindowControls() {
    const listContainer = document.getElementById('pm-list-container');
    const controlsContainer = document.getElementById('pm-list-controls');
    
    // Buttons
    const renameBtn = controlsContainer.querySelector('button:nth-child(1)');
    const editNotesBtn = controlsContainer.querySelector('button:nth-child(2)');
    const deleteBtn = controlsContainer.querySelector('button:nth-child(3)');
    const clearAllBtn = document.getElementById('pm-clear-all-btn');

    // List Selection Logic
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            
            selectedMarkerId = li.dataset.markerId;
            listContainer.querySelectorAll('li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            updateControlButtons();
        });
    }

    // --- 1. Rename Logic ---
    if (renameBtn) {
        renameBtn.addEventListener('click', () => {
            if (!selectedMarkerId) return;
            const marker = playerMarkerStore.getMarkers().find(m => m.id === selectedMarkerId);
            if (!marker) return;

            const newName = prompt("Rename marker:", marker.name);
            if (newName && newName.trim() !== "") {
                playerMarkerStore.updateMarker(selectedMarkerId, { name: newName });
                logAction(`Renamed "${marker.name}" to "${newName}"`, 'edit');
            }
        });
    }

    // --- 2. Edit Notes Logic ---
    if (editNotesBtn) {
        editNotesBtn.addEventListener('click', () => {
            if (!selectedMarkerId) return;
            const marker = playerMarkerStore.getMarkers().find(m => m.id === selectedMarkerId);
            
            // Simple prompt for now (could be a modal later)
            const newNote = prompt("Edit notes:", marker.description);
            if (newNote !== null) {
                playerMarkerStore.updateMarker(selectedMarkerId, { description: newNote });
                logAction(`Updated notes for "${marker.name}"`, 'edit');
            }
        });
    }

    // --- 3. Delete Logic (Updated) ---
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!selectedMarkerId) return;
            const marker = playerMarkerStore.getMarkers().find(m => m.id === selectedMarkerId);
            
            if (confirm(`Are you sure you want to delete "${marker.name}"?`)) {
                const name = marker.name; // Save name for log
                playerMarkerStore.removeMarker(selectedMarkerId);
                
                logAction(`Deleted "${name}"`, 'delete');
                closePlayerMarkerPanel(); // <-- Close the panel!
                
                selectedMarkerId = null;
                updateControlButtons();
            }
        });
    }

    // --- 4. Clear All Logic ---
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            const count = playerMarkerStore.getMarkers().length;
            if (count === 0) {
                logAction("No markers to clear.", 'system');
                return;
            }

            const confirmed = confirm(
                `WARNING: You are about to delete ALL ${count} markers.\n\n` +
                `If you haven't exported them, they will be lost forever.\n\n` +
                `Are you sure you want to continue?`
            );

            if (confirmed) {
                // We need a method in the store for this, or loop delete
                // Let's loop for now, or add clearAll to store later.
                // Since we don't have clearAll in store yet, we iterate IDs.
                const allIds = playerMarkerStore.getMarkers().map(m => m.id);
                allIds.forEach(id => playerMarkerStore.removeMarker(id));
                
                logAction(`Cleared all ${count} markers.`, 'delete');
                closePlayerMarkerPanel();
                selectedMarkerId = null;
                updateControlButtons();
            }
        });
    }
}

// --- Helper: Logger ---
function logAction(message, type = 'system') {
    const logContent = document.getElementById('pm-log-content');
    if (!logContent) return;

    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" });
    entry.textContent = `[${time}] ${message}`;
    
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight; // Auto-scroll
}

/**
 *
 * Enables/disables the control buttons based on selection.
 */
function updateControlButtons() {
    // Select all buttons in the control list
    const buttons = document.getElementById('pm-list-controls').querySelectorAll('button');
    if (!buttons) return;

    // Enable or disable all buttons based on if we have a selection
    const isDisabled = (selectedMarkerId === null);
    buttons.forEach(btn => btn.disabled = isDisabled);
}

/**
 * Populates and displays the dedicated Player Marker panel.
 */
export function showPlayerMarkerPanel(markerId) {

    const panel = document.getElementById('player-marker-panel');
    const title = document.getElementById('pm-panel-title');
    const content = document.getElementById('pm-panel-content');
    const zoomBtn = document.getElementById('pm-panel-zoom-btn');
    
    // 1. Prevent silent HTML fails
    if (!panel || !title || !content || !zoomBtn) {
        console.error("? Marker Panel Error: Missing HTML elements. Check for duplicate IDs in index.html!");
        return;
    }

    // 2. Safely find the data
    const markerData = playerMarkerStore.getMarkers().find(m => String(m.id) === String(markerId));

    if (!markerData) {
        console.error("? Marker Panel Error: Could not find data in store for ID:", markerId);
        return;
    }

    // 3. Populate document-sourced values through text APIs.
    title.textContent = markerData.name || "Unknown Marker";
    const container = document.createElement('div');
    container.className = 'pm-panel-container';
    const description = document.createElement('div');
    description.className = 'pm-desc';
    description.textContent = markerData.description || 'No description provided.';
    const metadata = document.createElement('div');
    metadata.className = 'pm-meta';
    metadata.textContent = `Coordinates: ${markerData.lat.toFixed(4)}, ${markerData.lng.toFixed(4)}`;
    container.append(description, metadata);
    content.replaceChildren(container);
    
    // 5. Wire up Zoom
    zoomBtn.onclick = () => {
         if (map) map.flyTo([markerData.lat, markerData.lng], 0);
    };

    // 6. Display the panel
    panel.classList.remove('hidden');
}

/**
 * Closes the panel (used when deleting the currently viewed marker).
 */
export function closePlayerMarkerPanel() {
    const panel = document.getElementById('player-marker-panel');
    if (panel) panel.classList.add('hidden');
}

function setupImportExportListeners() {
    const fileExportBtn = document.getElementById('pm-file-export-btn');
    const fileInput = document.getElementById('pm-file-import-input');
    if (fileExportBtn) {
        fileExportBtn.onclick = () => {
            const name = markerDocumentState.getSnapshot().name ?? 'markers';
            downloadDocumentFile(buildMarkerDocument(), documentFileName(name, DOCUMENT_TYPES.MARKER_SET));
            logAction(`Exported "${name}" as JSON.`);
        };
    }
    if (fileInput) {
        fileInput.onchange = async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            try {
                const imported = parseDocumentFileText(await file.text(), normalizeMarkerSetDocument);
                replaceMarkerDocument(imported);
                markerDocumentState.clear({ dirty: true });
                renderMarkerDocumentStatus();
                logAction(`Imported ${String(imported.markers.length)} markers from JSON.`, 'add');
            } catch (error) {
                logAction(`Import failed: ${error.message}`, 'delete');
            } finally {
                fileInput.value = '';
            }
        };
    }
}

function buildMarkerDocument() {
    return createMarkerSetDocument({
        origin: activeOrigin,
        markers: playerMarkerStore.getMarkers(),
        createdAt: activeCreatedAt,
        updatedAt: new Date().toISOString()
    });
}

function replaceMarkerDocument(documentValue) {
    const normalized = normalizeMarkerSetDocument(documentValue);
    playerMarkerStore.loadMarkers(normalized.markers);
    activeOrigin = { ...normalized.origin };
    activeCreatedAt = normalized.createdAt;
    selectedMarkerId = null;
    closePlayerMarkerPanel();
    return normalized;
}

function renderMarkerDocumentStatus() {
    const status = document.getElementById('pm-document-status');
    const state = getPlayerMarkerDocumentStatus();
    if (status) status.textContent = state.dirty ? 'Changes in this session. Export JSON to keep a copy.' : 'Ready for file import or export.';

    markerDocumentSubscribers.forEach(subscriber => {
        try {
            subscriber(state);
        } catch (error) {
            console.error('Marker document subscriber failed.', error);
        }
    });
}

/**
 * Returns read-only marker document metadata plus the current marker count.
 */
export function getPlayerMarkerDocumentStatus() {
    return Object.freeze({
        ...markerDocumentState.getSnapshot(),
        itemCount: playerMarkerStore?.getMarkers().length ?? 0
    });
}

/**
 * Subscribes to marker document/status changes. Returns an unsubscribe callback.
 */
export function subscribePlayerMarkerDocumentStatus(subscriber) {
    if (typeof subscriber !== 'function') throw new TypeError('A marker document subscriber is required.');
    markerDocumentSubscribers.add(subscriber);
    return () => markerDocumentSubscribers.delete(subscriber);
}

