'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseResponse,
  expandPath,
} = require('../../src/engine/divvun');

test('parses a correct Faroese word', () => {
  const result = parseResponse(
    JSON.stringify({
      suggest: [{
        is_correct: true,
        suggestions: [],
      }],
    }),
    'maður'
  );

  assert.equal(result.correct, true);
  assert.deepEqual(result.suggestions, []);
});

test('parses spelling errors and suggestions', () => {
  const result = parseResponse(
    JSON.stringify({
      suggest: [{
        is_correct: false,
        suggestions: [
          { value: 'føroyskt' },
          { value: 'føroysk' },
        ],
      }],
    }),
    'foroyskt'
  );

  assert.equal(result.correct, false);
  assert.deepEqual(result.suggestions, ['føroyskt', 'føroysk']);
});

test('removes suggestions identical to the original word', () => {
  const result = parseResponse(
    JSON.stringify({
      suggest: [{
        is_correct: false,
        suggestions: [
          { value: 'maður' },
          { value: 'maðr' },
        ],
      }],
    }),
    'maður'
  );

  assert.deepEqual(result.suggestions, ['maðr']);
});

test('rejects malformed JSON', () => {
  assert.throws(
    () => parseResponse('{invalid}', 'maður'),
    /invalid JSON/
  );
});

test('rejects unexpected response structure', () => {
  assert.throws(
    () => parseResponse('{"suggest":[]}', 'maður'),
    /Unexpected Divvun response/
  );
});

test('expands home directory paths', () => {
  assert.equal(
    expandPath('~/models/fo.bhfst', '/home/test'),
    '/home/test/models/fo.bhfst'
  );
});

test('expands userHome configuration paths', () => {
  assert.equal(
    expandPath('${userHome}/models/fo.bhfst', '/home/test'),
    '/home/test/models/fo.bhfst'
  );
});
