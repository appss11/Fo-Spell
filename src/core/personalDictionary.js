'use strict';

const STORAGE_KEY = 'foSpell.personalDictionary';
const MAX_WORD_LENGTH = 80;

function normalizeWord(word) {
    if (typeof word !== 'string') return null;

    const value = word.trim().normalize('NFC');

    if (
        !value ||
        value.length > MAX_WORD_LENGTH ||
        !/^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u.test(value)
    ) {
        return null;
    }

    return value.toLocaleLowerCase();
}

class PersonalDictionary {
    constructor(globalState, key = STORAGE_KEY) {
        if (
            !globalState ||
            typeof globalState.get !== 'function' ||
            typeof globalState.update !== 'function'
        ) {
            throw new TypeError('A valid persistent storage API is required.');
        }

        this.storage = globalState;
        this.key = key;
        this.words = new Map();

        const stored = globalState.get(key, []);

        if (Array.isArray(stored)) {
            for (const word of stored) {
                const normalized = normalizeWord(word);

                if (normalized) {
                    this.words.set(normalized, word.normalize('NFC').trim());
                }
            }
        }

        this.writeQueue = Promise.resolve();
    }

    has(word) {
        const normalized = normalizeWord(word);

        return normalized !== null && this.words.has(normalized);
    }

    async add(word) {
        const normalized = normalizeWord(word);

        if (!normalized) {
            throw new TypeError('A valid word is required.');
        }

        if (this.words.has(normalized)) {
            return false;
        }

        this.words.set(normalized, word.trim().normalize('NFC'));

        await this.persist();

        return true;
    }

    async remove(word) {
        const normalized = normalizeWord(word);

        if (!normalized || !this.words.has(normalized)) {
            return false;
        }

        this.words.delete(normalized);

        await this.persist();

        return true;
    }

    list() {
        return [...this.words.values()].sort((a, b) =>
            a.localeCompare(b)
        );
    }

    async clear() {
        this.words.clear();

        await this.persist();
    }

    persist() {
        this.writeQueue = this.writeQueue
            .catch(() => {})
            .then(() => this.storage.update(
                this.key,
                this.list()
            ));

        return this.writeQueue;
    }
}

module.exports = {
    PersonalDictionary,
    normalizeWord,
    STORAGE_KEY,
};
