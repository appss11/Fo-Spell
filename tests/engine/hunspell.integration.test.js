'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkWords } = require('../../src/engine/hunspell');

test('real Hunspell accepts Faroese and English words', async () => {
  const result = await checkWords(
    ['føroyskt', 'maður', 'colour', 'color', 'computer'],
    {
      dictionaries: ['fo_FO', 'en_GB', 'en_US'],
    }
  );

  for (const word of ['føroyskt', 'maður', 'colour', 'color', 'computer']) {
    assert.equal(result.get(word), true, `${word} should be accepted`);
  }
});

test('real Hunspell rejects an invented word', async () => {
  const result = await checkWords(
    ['qzxvplm'],
    {
      dictionaries: ['fo_FO', 'en_GB', 'en_US'],
    }
  );

  assert.equal(result.get('qzxvplm'), false);
});

test('real Hunspell accepts British and American spelling together', async () => {
  const result = await checkWords(
    ['colour', 'color', 'organise', 'organize'],
    {
      dictionaries: ['en_GB', 'en_US'],
    }
  );

  for (const word of ['colour', 'color', 'organise', 'organize']) {
    assert.equal(result.get(word), true);
  }
});
