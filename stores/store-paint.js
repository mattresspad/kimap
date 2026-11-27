// stores/store-paint.js

export class PaintStore {
    constructor() {
        this.items = []; 
        this.subscribers = [];
        this.nextId = 0;
    }

    addItem(type, geometry, properties = {}) {
        const newItem = {
            id: `paint_${Date.now()}_${this.nextId++}`,
            type: type,
            geometry: geometry,
            properties: properties,
            visible: true
        };
        this.items.push(newItem);
        this._notify();
        return newItem;
    }

    removeItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this._notify();
    }

    // --- NEW: Z-Index Management ---
    // direction: -1 (Send Backward), 1 (Bring Forward)
    moveItem(id, direction) {
        const index = this.items.findIndex(i => i.id === id);
        if (index === -1) return;

        // Check bounds
        if (direction === -1 && index === 0) return; // Already at bottom
        if (direction === 1 && index === this.items.length - 1) return; // Already at top

        // Swap
        const item = this.items[index];
        this.items.splice(index, 1); // Remove
        this.items.splice(index + direction, 0, item); // Insert at new position

        this._notify();
    }

    undo() {
        if (this.items.length > 0) {
            this.items.pop();
            this._notify();
            return true;
        }
        return false;
    }

    getItems() { return structuredClone(this.items); }
    
    loadItems(newItems) {
        if (!Array.isArray(newItems)) return;
        this.items = structuredClone(newItems);
        this.nextId = this.items.length + 1; 
        this._notify();
    }

    subscribe(cb) { this.subscribers.push(cb); }
    _notify() { this.subscribers.forEach(cb => cb(this.getItems())); }
}
