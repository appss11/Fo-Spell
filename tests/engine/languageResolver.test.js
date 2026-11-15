'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveWords } = require('../../src/engine/languageResolver');

const settings = {
  enabled: true,
  checkFaroese: true,
  useDivvun: true,
  showReviewWarnings: false,
};

test('Hunspell acceptance takes priority over Divvun', async () => {
  let divvunCalls = 0;

  const result = await resolveWords(['colour'], {
    settings,
    checkHunspell: async () => new Map([['colour', true]]),
    checkDivvun: async () => {
      divvunCalls++;
      return { correct: false, suggestions: [] };
    },
  });

  assert.equal(result.get('colour').status, 'accepted');
  assert.equal(divvunCalls, 0);
});

test('Divvun confirms a Faroese spelling error', async () => {
  const result = await resolveWords(['foroyskt'], {
    settings,
    checkHunspell: async () => new Map([['foroyskt', false]]),
    checkDivvun: async () => ({
      correct: false,
      suggestions: ['føroyskt'],
    }),
  });

  assert.equal(result.get('foroyskt').status, 'error');
  assert.deepEqual(result.get('foroyskt').suggestions, ['føroyskt']);
});

test('Divvun can recognize a word Hunspell rejected', async () => {
  const result = await resolveWords(['maður'], {
    settings,
    checkHunspell: async () => new Map([['maður', false]]),
    checkDivvun: async () => ({
      correct: true,
      suggestions: [],
    }),
  });

  assert.equal(result.get('maður').status, 'accepted');
});

test('uncertain words remain unmarked by default', async () => {
  const result = await resolveWords(['unknown'], {
    settings,
    checkHunspell: async () => new Map([['unknown', false]]),
    checkDivvun: async () => {
      throw new Error('Divvun unavailable');
    },
  });

  assert.equal(result.get('unknown').status, 'unmarked');
});

test('uncertain words can generate review warnings', async () => {
  const result = await resolveWords(['unknown'], {
    settings: { ...settings, showReviewWarnings: true },
    checkHunspell: async () => new Map([['unknown', false]]),
    checkDivvun: async () => {
      throw new Error('Divvun unavailable');
    },
  });

  assert.equal(result.get('unknown').status, 'review');
});

test('Divvun is not called when Faroese is disabled', async () => {
  let called = false;

  const result = await resolveWords(['unknown'], {
    settings: { ...settings, checkFaroese: false },
    checkHunspell: async () => new Map([['unknown', false]]),
    checkDivvun: async () => {
      called = true;
      return { correct: false, suggestions: [] };
    },
  });

  assert.equal(called, false);
  assert.equal(result.get('unknown').status, 'unmarked');
});

test('disabled extension returns disabled results', async () => {
  const result = await resolveWords(['maður'], {
    settings: { ...settings, enabled: false },
    checkHunspell: async () => {
      throw new Error('Should not run');
    },
    checkDivvun: async () => {
      throw new Error('Should not run');
    },
  });

  assert.equal(result.get('maður').status, 'disabled');
});
