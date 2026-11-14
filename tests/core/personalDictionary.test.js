'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PersonalDictionary,
    normalizeWord,
    STORAGE_KEY,
} = require('../../src/core/personalDictionary');

function createStorage(initial = []) {
    const data = new Map([[STORAGE_KEY, initial]]);

    return {
        get(key, fallback) {
            return data.has(key) ? data.get(key) : fallback;
        },

        async update(key, value) {
            data.set(key, value);
        },

        data,
    };
}

test('adds and recognizes a word', async () => {
    const storage = createStorage();
    const dictionary = new PersonalDictionary(storage);

    assert.equal(await dictionary.add('Lockwood'), true);
    assert.equal(dictionary.has('Lockwood'), true);
    assert.equal(dictionary.has('LOCKWOOD'), true);
});

test('prevents duplicate words regardless of case', async () => {
    const dictionary = new PersonalDictionary(createStorage());

    assert.equal(await dictionary.add('Clewer'), true);
    assert.equal(await dictionary.add('CLEWER'), false);

    assert.equal(dictionary.list().length, 1);
});

test('supports Faroese characters', async () => {
    const dictionary = new PersonalDictionary(createStorage());

    await dictionary.add('føroyskt');
    await dictionary.add('maður');
    await dictionary.add('Klaksvík');

    assert.equal(dictionary.has('FØROYSKT'), true);
    assert.equal(dictionary.has('MAÐUR'), true);
    assert.equal(dictionary.has('klaksvík'), true);
});

test('supports hyphenated and apostrophe names', async () => {
    const dictionary = new PersonalDictionary(createStorage());

    await dictionary.add("O'Connor");
    await dictionary.add('Anne-Marie');

    assert.equal(dictionary.has("o'connor"), true);
    assert.equal(dictionary.has('anne-marie'), true);
});

test('restores words from persistent storage', async () => {
    const storage = createStorage([
        'Lockwood',
        'Clewer',
        'Davidsen',
    ]);

    const dictionary = new PersonalDictionary(storage);

    assert.equal(dictionary.has('LOCKWOOD'), true);
    assert.equal(dictionary.has('clewer'), true);
    assert.equal(dictionary.list().length, 3);
});

test('removes words', async () => {
    const dictionary = new PersonalDictionary(createStorage());

    await dictionary.add('Lockwood');

    assert.equal(await dictionary.remove('LOCKWOOD'), true);
    assert.equal(dictionary.has('Lockwood'), false);
    assert.equal(await dictionary.remove('Lockwood'), false);
});

test('clears the dictionary', async () => {
    const dictionary = new PersonalDictionary(createStorage());

    await dictionary.add('Lockwood');
    await dictionary.add('Clewer');

    await dictionary.clear();

    assert.deepEqual(dictionary.list(), []);
});

test('rejects invalid words', async () => {
    const dictionary = new PersonalDictionary(createStorage());

    for (const value of ['', '   ', '12345', 'Hello world', null]) {
        await assert.rejects(
            dictionary.add(value),
            TypeError
        );
    }
});

test('normalizes Unicode consistently', () => {
    assert.equal(
        normalizeWord('føroyskt'),
        normalizeWord('føroyskt'.normalize('NFD'))
    );
});

test('uses an independent storage key', async () => {
    const storage = createStorage();
    const dictionary = new PersonalDictionary(storage, 'custom.dictionary');

    await dictionary.add('Lockwood');

    assert.deepEqual(
        storage.get('custom.dictionary', []),
        ['Lockwood']
    );
});

