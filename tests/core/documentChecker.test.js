'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDocumentChecker,
  extractTextSpans,
  likelyOCR,
} = require('../../src/core/documentChecker');

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
  divvunPath: 'divvunspell',
  modelPath: '/models/fo.bhfst',
};

function createDocument(text, languageId = 'plaintext') {
  return {
    languageId,
    getText: () => text,
    positionAt: offset => offset,
  };
}

function createChecker(overrides = {}) {
  return createDocumentChecker({
    createRange: (start, end) => ({ start, end }),
    hunspellCheck: async words =>
      new Map(words.map(word => [word, true])),
    divvunCheck: async () => ({
      correct: true,
      suggestions: [],
    }),
    ...overrides,
  });
}

test('returns no findings when checking is disabled', async () => {
  const checker = createChecker();
  const result = await checker(
    createDocument('maður'),
    { ...settings, enabled: false }
  );

  assert.deepEqual(result, []);
});

test('returns no findings for unsupported languages', async () => {
  const checker = createChecker();
  const result = await checker(
    createDocument('maður', 'python'),
    settings
  );

  assert.deepEqual(result, []);
});

test('returns no findings when every language is disabled', async () => {
  const checker = createChecker();
  const result = await checker(
    createDocument('maður'),
    {
      ...settings,
      checkFaroese: false,
      checkEnglishGB: false,
      checkEnglishUS: false,
    }
  );

  assert.deepEqual(result, []);
});

test('preserves exact source positions', async () => {
  const checker = createChecker({
    hunspellCheck: async words =>
      new Map(words.map(word => [word, false])),
    divvunCheck: async () => ({
      correct: false,
      suggestions: [],
    }),
  });

  const result = await checker(
    createDocument('Hello maður'),
    settings
  );

  const finding = result.find(item => item.word === 'Hello');

  assert.ok(finding);
  assert.deepEqual(finding.range, {
    start: 0,
    end: 5,
  });
});

test('uses all enabled Hunspell dictionaries', async () => {
  let received;

  const checker = createChecker({
    hunspellCheck: async (words, options) => {
      received = options.dictionaries;
      return new Map(words.map(word => [word, true]));
    },
  });

  await checker(createDocument('colour'), settings);

  assert.deepEqual(received, [
    'fo_FO',
    'en_GB',
    'en_US',
  ]);
});

test('uses Divvun to identify Faroese spelling errors', async () => {
  const checker = createChecker({
    hunspellCheck: async words =>
      new Map(words.map(word => [word, false])),
    divvunCheck: async () => ({
      correct: false,
      suggestions: ['føroyskt'],
    }),
  });

  const result = await checker(
    createDocument('foroyskt'),
    settings
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'error');
  assert.equal(result[0].ocr, true);
  assert.deepEqual(result[0].suggestions, ['føroyskt']);
});

test('does not return uncertain findings by default', async () => {
  const checker = createChecker({
    hunspellCheck: async words =>
      new Map(words.map(word => [word, false])),
    divvunCheck: async () => {
      throw new Error('Divvun unavailable');
    },
  });

  const result = await checker(
    createDocument('unknownword'),
    settings
  );

  assert.deepEqual(result, []);
});

test('preserves original spelling and repeated occurrences', async () => {
  const checker = createChecker({
    hunspellCheck: async words =>
      new Map(words.map(word => [word, false])),
    divvunCheck: async () => ({
      correct: false,
      suggestions: ['føroyskt'],
    }),
  });

  const result = await checker(
    createDocument('Foroyskt foroyskt'),
    settings
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].word, 'Foroyskt');
  assert.equal(result[1].word, 'foroyskt');
  assert.deepEqual(result[0].range, {
    start: 0,
    end: 8,
  });
  assert.deepEqual(result[1].range, {
    start: 9,
    end: 17,
  });
});

test('respects the unique-word limit', async () => {
  let checkedWords;

  const checker = createChecker({
    hunspellCheck: async words => {
      checkedWords = [...words];
      return new Map(words.map(word => [word, true]));
    },
  });

  await checker(
    createDocument('one two three four'),
    { ...settings, maxUniqueWords: 2 }
  );

  assert.deepEqual(checkedWords, ['one', 'two']);
});

test('extracts JSON values but skips property names', () => {
  const source = '{"name":"maður","description":"føroyskt"}';
  const spans = extractTextSpans(source, 'json');

  assert.deepEqual(
    spans.map(span => span.text),
    ['maður', 'føroyskt']
  );
});

test('skips escaped JSON strings to preserve source offsets', () => {
  const source = '{"text":"foo\\\\nbar","name":"maður"}';
  const spans = extractTextSpans(source, 'json');

  assert.deepEqual(
    spans.map(span => span.text),
    ['maður']
  );
});

test('supports JSONL records', () => {
  const source = '{"name":"maður"}\n{"name":"føroyskt"}';
  const spans = extractTextSpans(source, 'jsonl');

  assert.deepEqual(
    spans.map(span => span.text),
    ['maður', 'føroyskt']
  );

  assert.ok(spans[1].offset > spans[0].offset);
});

test('detects Faroese OCR character substitutions', () => {
  assert.equal(
    likelyOCR('foroyskt', ['føroyskt']),
    true
  );

  assert.equal(
    likelyOCR('wrong', ['right']),
    false
  );
});

test('handles empty documents', async () => {
  const checker = createChecker();

  assert.deepEqual(
    await checker(createDocument(''), settings),
    []
  );
});

test('skips words in the personal dictionary', async () => {
  const checkedWords = [];

  const checker = createChecker({
    personalDictionary: {
      has: word => word.toLocaleLowerCase() === 'lockwood',
    },
    hunspellCheck: async words => {
      checkedWords.push(...words);
      return new Map(words.map(word => [word, false]));
    },
    divvunCheck: async () => ({
      correct: false,
      suggestions: [],
    }),
  });

  const result = await checker(
    createDocument('LOCKWOOD qzxvplm'),
    settings
  );

  assert.equal(
    checkedWords.some(word =>
      word.toLocaleLowerCase() === 'lockwood'
    ),
    false
  );

  assert.deepEqual(
    result.map(item => item.word),
    ['qzxvplm']
  );
});
