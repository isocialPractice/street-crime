// js/entities/inventory.js - what the player carries
//
// A fixed number of slots, in order. Each slot holds one kind of item and how
// many of it: a stack, up to the item's "stack" in the catalog (js/entities/
// items.js), so three coins take one slot and two keys take two. The slots
// keep their order as things come and go, the way an item screen shows them.
//
// The inventory knows nothing of what items do; it counts them. Using,
// combining and taking live with the catalog, and report through the level
// map's event bus from there.

class Inventory {
    // slots   how many slots, default 8. stackOf(id) says how many of an item
    //         share a slot; by default the current catalog's "stack".
    constructor(slots = 8, stackOf = null) {
        this.slots = Math.max(1, Math.floor(slots) || 8);
        this.stackOf = stackOf || (id => (typeof itemDef === 'function' ? itemDef(id)?.stack : 1) || 1);
        this.items = [];             // [{ item, count }], at most this.slots long
        this.onChange = null;        // called after any change, with this
    }

    // add - put n of an item in: onto a stack of it with room first, then
    // into free slots. Returns how many went in; fewer than n when it is full.
    add(item, n = 1) {
        const stack = Math.max(1, this.stackOf(item));
        let left = Math.max(0, Math.floor(n));
        for (const slot of this.items) {
            if (!left) break;
            if (slot.item !== item || slot.count >= stack) continue;
            const take = Math.min(left, stack - slot.count);
            slot.count += take;
            left -= take;
        }
        while (left && this.items.length < this.slots) {
            const take = Math.min(left, stack);
            this.items.push({ item, count: take });
            left -= take;
        }
        const added = Math.floor(n) - left;
        if (added) this._changed();
        return added;
    }

    // room - how many of an item would still fit.
    room(item) {
        const stack = Math.max(1, this.stackOf(item));
        const onStacks = this.items.filter(slot => slot.item === item)
            .reduce((sum, slot) => sum + (stack - slot.count), 0);
        return onStacks + (this.slots - this.items.length) * stack;
    }

    // remove - take n of an item out, from its last slot first. Returns how
    // many came out.
    remove(item, n = 1) {
        let left = Math.max(0, Math.floor(n));
        for (let i = this.items.length - 1; i >= 0 && left; i--) {
            const slot = this.items[i];
            if (slot.item !== item) continue;
            const take = Math.min(left, slot.count);
            slot.count -= take;
            left -= take;
            if (!slot.count) this.items.splice(i, 1);
        }
        const removed = Math.floor(n) - left;
        if (removed) this._changed();
        return removed;
    }

    // replaceAt - put a different item in a slot, keeping its place: what a
    // combination leaves behind.
    replaceAt(index, item, count = 1) {
        if (index < 0 || index >= this.items.length) return false;
        this.items[index] = { item, count };
        this._changed();
        return true;
    }

    count(item) {
        return this.items.reduce((sum, slot) => sum + (slot.item === item ? slot.count : 0), 0);
    }

    has(item) {
        return this.count(item) > 0;
    }

    // total - items carried, of every kind.
    total() {
        return this.items.reduce((sum, slot) => sum + slot.count, 0);
    }

    // entries - a copy of the slots, for storing and showing.
    entries() {
        return this.items.map(slot => ({ ...slot }));
    }

    clear() {
        if (!this.items.length) return;
        this.items = [];
        this._changed();
    }

    // load - replace what is carried with entries, as entries() gives them.
    load(entries) {
        this.items = [];
        for (const slot of Array.isArray(entries) ? entries : []) {
            if (slot && typeof slot.item === 'string') this.add(slot.item, slot.count || 1);
        }
        this._changed();
    }

    _changed() {
        if (typeof this.onChange === 'function') this.onChange(this);
    }
}
