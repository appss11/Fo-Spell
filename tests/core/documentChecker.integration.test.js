'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocumentChecker } = require('../../src/core/documentChecker');
const { checkWords } = require('../../src/engine/hunspell');
const { checkWord } = require('../../src/engine/divvun');

const settings = {
  enabled: true,
  checkFaroese: true,
  checkEnglishGB: true,
  checkEnglishUS: true,
  useDivvun: true,
  showReviewWarnings: false,
  maxUniqueWords: 300,
  dictionary: 'fo_FO',
  hunspellPath: 'hunspell',
  divvunPath: `${process.env.HOME}/.cargo/bin/divvunspell`,
  modelPath: `${process.env.HOME}/AI/Faroese-Language-Tools/divvun/fo.bhfst`,
};

const checker = createDocumentChecker({
  hunspellCheck: checkWords,
  divvunCheck: checkWord,
  createRange: (start, end) => ({ start, end }),
});

function document(text) {
  return {
    languageId: 'plaintext',
    getText: () => text,
    positionAt: offset => offset,
  };
}

test('real engines accept Faroese and English together', async () => {
  const result = await checker(
    document('Hello maður colour color'),
    settings
  );

  assert.deepEqual(result, []);
});

test('real engines reject an invented word', async () => {
  const result = await checker(
    document('qzxvplm'),
    settings
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].word, 'qzxvplm');
  assert.equal(result[0].status, 'error');
});

test('real engines preserve source positions', async () => {
  const result = await checker(
    document('Hello qzxvplm maður'),
    settings
  );

  const finding = result.find(item => item.word === 'qzxvplm');

  assert.ok(finding);
  assert.deepEqual(finding.range, {
    start: 6,
    end: 13,
  });
});
