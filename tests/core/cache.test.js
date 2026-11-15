'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ResultCache } = require('../../src/core/cache');

test('stores and retrieves results', () => {
    const cache = new ResultCache();

    cache.set('maður', true);

    assert.equal(cache.get('maður'), true);
});

test('evicts least recently used entries', () => {
    const cache = new ResultCache(2);

    cache.set('a', 1);
    cache.set('b', 2);

    cache.get('a');
    cache.set('c', 3);

    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
});

test('supports false and null results', () => {
    const cache = new ResultCache();

    cache.set('invalid', false);
    cache.set('unknown', null);

    assert.equal(cache.get('invalid'), false);
    assert.equal(cache.get('unknown'), null);
});

test('clears all entries', () => {
    const cache = new ResultCache();

    cache.set('a', true);
    cache.clear();

    assert.equal(cache.size, 0);
});

test('rejects invalid capacity', () => {
    assert.throws(() => new ResultCache(0), RangeError);
});