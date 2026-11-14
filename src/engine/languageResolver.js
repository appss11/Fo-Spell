'use strict';

async function resolveWords(words, options = {}) {
  const {
    settings,
    checkHunspell,
    checkDivvun,
  } = options;

  if (!settings || typeof settings !== 'object') {
    throw new TypeError('settings are required.');
  }

  if (typeof checkHunspell !== 'function') {
    throw new TypeError('checkHunspell must be a function.');
  }

  if (typeof checkDivvun !== 'function') {
    throw new TypeError('checkDivvun must be a function.');
  }

  const uniqueWords = [...new Set(
    words.map(word => word.toLocaleLowerCase())
  )];

  if (uniqueWords.some(word => !word)) {
    throw new TypeError('Words must not be empty.');
  }

  if (!settings.enabled) {
    return new Map(uniqueWords.map(word => [
      word,
      { status: 'disabled', suggestions: [] },
    ]));
  }

  const hunspellResults = await checkHunspell(uniqueWords);

  const results = new Map();

  const rejected = [];

  for (const word of uniqueWords) {
    if (hunspellResults.get(word) === true) {
      results.set(word, {
        status: 'accepted',
        suggestions: [],
      });
    } else {
      rejected.push(word);
    }
  }

  if (!settings.checkFaroese || !settings.useDivvun) {
    for (const word of rejected) {
      results.set(word, {
        status: settings.showReviewWarnings
          ? 'review'
          : 'unmarked',
        suggestions: [],
      });
    }

    return results;
  }

  for (const word of rejected) {
    try {
      const result = await checkDivvun(word);

      if (result.correct === true) {
        results.set(word, {
          status: 'accepted',
          suggestions: [],
        });
      } else if (result.correct === false) {
        results.set(word, {
          status: 'error',
          suggestions: result.suggestions || [],
        });
      } else {
        results.set(word, {
          status: settings.showReviewWarnings
            ? 'review'
            : 'unmarked',
          suggestions: [],
        });
      }
    } catch {
      results.set(word, {
        status: settings.showReviewWarnings
          ? 'review'
          : 'unmarked',
        suggestions: [],
      });
    }
  }

  return results;
}

module.exports = { resolveWords };
