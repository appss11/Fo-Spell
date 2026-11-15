'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    readSettings,
    getActiveDictionaries,
} = require('../../src/core/settings');

test('defaults enable Faroese only', () => {
    const settings = readSettings({
        get: (_, fallback) => fallback,
    });

    assert.deepEqual(
        getActiveDictionaries(settings), ['fo_FO']
    );
});

test('review warnings are disabled by default', () => {
    const settings = readSettings({
        get: (_, fallback) => fallback,
    });

    assert.equal(settings.showReviewWarnings, false);
});

test('disabled languages are excluded', () => {
    const settings = {
        checkFaroese: false,
        checkEnglishGB: true,
        checkEnglishUS: false,
        dictionary: 'fo_FO',
    };

    assert.deepEqual(
        getActiveDictionaries(settings), ['en_GB']
    );
});

test('duplicate dictionaries are removed', () => {
    const settings = {
        checkFaroese: true,
        checkEnglishGB: true,
        checkEnglishUS: false,
        dictionary: 'en_GB',
    };

    assert.deepEqual(
        getActiveDictionaries(settings), ['en_GB']
    );
});