// /stores/store-placements.js

import { PlayerMarkerInteractionSession } from './tool-interaction-sessions.js';

export class PlayerMarkerStore {
    constructor() {
        this.markers = []; // An array to hold all marker objects
        this.subscribers = [];
        this.nextId = 0; // Simple ID counter
        this.placementInteraction = new PlayerMarkerInteractionSession();
    }

    /**
     * Adds a new marker to the store.
     * @param {object} latlng - Leaflet latlng object { lat, lng }.
     * @param {object} data - An object with marker details, e.g., { name, description }.
     */
    addMarker(latlng, data = {}) {
        const newMarker = {
            id: `player_marker_${this.nextId++}`,
            lat: latlng.lat,
            lng: latlng.lng,
            name: data.name || `My Town ${this.nextId}`,
            description: data.description || '',
            icon: data.icon || 'default'
        };
        this.markers.push(newMarker);
        this._notify();
        console.log('Added Marker:', newMarker);
        return newMarker;
    }

    /**
     * Removes a marker from the store by its ID.
     * @param {string} markerId - The ID of the marker to remove.
     */
    removeMarker(markerId) {
        this.markers = this.markers.filter(m => m.id !== markerId);
        this._notify();
    }
    
    /**
     * Updates an existing marker's data.
     * @param {string} markerId - The ID of the marker to update.
     * @param {object} newData - An object with the new data to apply.
     */
    updateMarker(markerId, newData) {
        const marker = this.markers.find(m => m.id === markerId);
        if (marker) {
            Object.assign(marker, newData);
            this._notify();
        }
    }

    /**
     * Loads an entire array of markers, replacing the current set. Used for importing.
     * @param {Array<object>} markerArray - The array of marker objects to load.
     */
    loadMarkers(markerArray) {
        // Basic validation
        if (!Array.isArray(markerArray)) {
            console.error("loadMarkers expects an array.");
            return;
        }
        this.markers = structuredClone(markerArray);
        // Ensure our ID counter is higher than any loaded ID to prevent collisions
        const maxId = markerArray.reduce((max, m) => {
            const idNum = parseInt(m.id.split('_').pop(), 10);
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, this.nextId - 1);
        this.nextId = maxId + 1;

        this._notify();
    }

    togglePlacementMode() {
        if (this.isPlacementModeActive()) this.deactivatePlacementMode();
        else this.activatePlacementMode();
        return this.isPlacementModeActive();
    }

    activatePlacementMode() {
        return this.placementInteraction.startPlacement();
    }

    deactivatePlacementMode() {
        return this.placementInteraction.cancelPlacement();
    }

    isPlacementModeActive() {
        return this.placementInteraction.getSnapshot().placementActive;
    }

    getPlacementInteractionState() {
        return this.placementInteraction.getSnapshot();
    }

    subscribePlacementInteraction(callback) {
        return this.placementInteraction.subscribe(callback);
    }

    /**
     * Returns a copy of the current markers array.
     * @returns {Array<object>}
     */
    getMarkers() {
        return structuredClone(this.markers);
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    _notify() {
        this.subscribers.forEach(callback => callback(this.getMarkers()));
    }
}
