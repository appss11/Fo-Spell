'use strict';

class ResultCache {
    constructor(maxEntries = 10000) {
        if (!Number.isInteger(maxEntries) || maxEntries < 1) {
            throw new RangeError('maxEntries must be a positive integer.');
        }

        this.maxEntries = maxEntries;
        this.entries = new Map();
    }

    get(key) {
        if (!this.entries.has(key)) {
            return undefined;
        }

        const value = this.entries.get(key);

        // Refresh insertion order for LRU eviction.
        this.entries.delete(key);
        this.entries.set(key, value);

        return value;
    }

    set(key, value) {
        this.entries.delete(key);
        this.entries.set(key, value);

        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            this.entries.delete(oldest);
        }
    }

    delete(key) {
        return this.entries.delete(key);
    }

    clear() {
        this.entries.clear();
    }

    get size() {
        return this.entries.size;
    }
}

module.exports = { ResultCache };