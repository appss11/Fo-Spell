'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    tokenize,
    uniqueWords,
} = require('../../src/core/tokenizer');

test('recognizes Faroese characters', () => {
    const tokens = tokenize('føroyskt maður hestur');

    assert.equal(tokens.length, 3);
    assert.equal(tokens[0].word, 'føroyskt');
});

test('recognizes English contractions', () => {
    const tokens = tokenize("don't hasn't");

    assert.equal(tokens.length, 2);
});

test('preserves exact positions', () => {
    const text = 'Eg eri føroyskur';
    const tokens = tokenize(text);

    assert.equal(
        text.slice(tokens[1].start, tokens[1].end),
        'eri'
    );
});

test('deduplicates words case-insensitively', () => {
    const tokens = tokenize('Computer computer COMPUTER');

    assert.deepEqual(uniqueWords(tokens), ['computer']);
});

test('handles empty documents', () => {
    assert.deepEqual(tokenize(''), []);
});