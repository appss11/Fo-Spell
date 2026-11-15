'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkWord } = require('../../src/engine/divvun');

const executable = '~/.cargo/bin/divvunspell';
const model = '~/AI/Faroese-Language-Tools/divvun/fo.bhfst';

test('real Divvun accepts maður', async () => {
  const result = await checkWord('maður', {
    executable,
    model,
  });

  assert.equal(result.correct, true);
});

test('real Divvun accepts føroyskt', async () => {
  const result = await checkWord('føroyskt', {
    executable,
    model,
  });

  assert.equal(result.correct, true);
});

test('real Divvun identifies an incorrect Faroese spelling', async () => {
  const result = await checkWord('foroyskt', {
    executable,
    model,
  });

  assert.equal(result.correct, false);
  assert.ok(result.suggestions.length > 0);
});
