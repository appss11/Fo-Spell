'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkWords,
  parseUnknownWords,
} = require('../../src/engine/hunspell');

test('parses rejected words case-insensitively', () => {
  const result = parseUnknownWords('QZXVPLM\nINVALID\n');

  assert.equal(result.has('qzxvplm'), true);
  assert.equal(result.has('invalid'), true);
});

test('accepts an empty word list', async () => {
  const result = await checkWords([]);

  assert.equal(result.size, 0);
});

test('rejects missing dictionary configuration', async () => {
  await assert.rejects(
    checkWords(['maður'], { dictionaries: [] }),
    /At least one/
  );
});

test('rejects invalid input', async () => {
  await assert.rejects(
    checkWords(['valid\ninvalid']),
    /single-line/
  );
});

test('rejects invalid dictionary identifiers', async () => {
  await assert.rejects(
    checkWords(['maður'], { dictionaries: ['fo_FO;invalid'] }),
    /Invalid dictionary/
  );
});

test('deduplicates dictionary names', async () => {
  const result = await checkWords([], {
    dictionaries: ['fo_FO', 'fo_FO'],
  });

  assert.equal(result.size, 0);
});
