'use strict';

const { tokenize } = require('./tokenizer');
const { getActiveDictionaries } = require('./settings');
const { resolveWords } = require('../engine/languageResolver');
const { checkWords } = require('../engine/hunspell');
const { checkWord } = require('../engine/divvun');


const SUPPORTED_LANGUAGES = new Set([
    'plaintext',
    'markdown',
    'json',
    'jsonc',
    'jsonl',
]);

function skipJsonTrivia(source, index) {
    while (index < source.length) {
        if (/\s/.test(source[index])) {
            index++;
            continue;
        }

        if (source.startsWith('//', index)) {
            const end = source.indexOf('\n', index + 2);
            index = end === -1 ? source.length : end + 1;
            continue;
        }

        if (source.startsWith('/*', index)) {
            const end = source.indexOf('*/', index + 2);
            index = end === -1 ? source.length : end + 2;
            continue;
        }

        break;
    }

    return index;
}

function extractJsonSpans(source, baseOffset = 0) {
    const spans = [];
    const expression = /"(?:\\.|[^"\\])*"/g;
    let match;

    while ((match = expression.exec(source)) !== null) {
        const quoted = match[0];
        const end = match.index + quoted.length;
        const next = skipJsonTrivia(source, end);

        // Exclude JSON property names.
        if (source[next] === ':') continue;

        // Preserve source offsets without attempting to decode escapes.
        if (quoted.includes('\\')) continue;

        spans.push({
            text: quoted.slice(1, -1),
            offset: baseOffset + match.index + 1,
        });
    }

    return spans;
}

function extractTextSpans(source, languageId) {
    if (languageId === 'json' || languageId === 'jsonc') {
        return extractJsonSpans(source);
    }

    if (languageId === 'jsonl') {
        const spans = [];
        let offset = 0;

        for (const line of source.split('\n')) {
            spans.push(...extractJsonSpans(line, offset));
            offset += line.length + 1;
        }

        return spans;
    }

    return [{ text: source, offset: 0 }];
}

function likelyOCR(word, suggestions) {
    const original = word.toLocaleLowerCase();

    const substitutions = new Set([
        'd:ð',
        'o:ø',
        'a:á',
        'i:í',
        'u:ú',
        'y:ý',
    ]);

    return suggestions.some(suggestion => {
        const candidate = suggestion.toLocaleLowerCase();

        if (
            candidate === original ||
            candidate.length !== original.length
        ) {
            return false;
        }

        let differences = 0;

        for (let index = 0; index < original.length; index++) {
            if (original[index] === candidate[index]) continue;

            differences++;

            if (!substitutions.has(
                    original[index] + ':' + candidate[index]
                )) {
                return false;
            }
        }

        return differences === 1;
    });
}

function createDocumentChecker(options = {}) {
    const {
        hunspellCheck = checkWords,
            divvunCheck = checkWord,
            createRange,
            cache = null,
            personalDictionary = null,
    } = options;

    if (typeof hunspellCheck !== 'function') {
        throw new TypeError('hunspellCheck must be a function.');
    }

    if (typeof divvunCheck !== 'function') {
        throw new TypeError('divvunCheck must be a function.');
    }

    if (typeof createRange !== 'function') {
        throw new TypeError('createRange must be a function.');
    }

    return async function checkDocument(document, settings) {
        if (!document || typeof document.getText !== 'function') {
            throw new TypeError('A valid text document is required.');
        }

        if (!settings || typeof settings !== 'object') {
            throw new TypeError('Settings are required.');
        }

        if (!settings.enabled) return [];

        if (!SUPPORTED_LANGUAGES.has(document.languageId)) {
            return [];
        }

        const dictionaries = getActiveDictionaries(settings);

        if (dictionaries.length === 0) return [];

        const source = document.getText();
        const spans = extractTextSpans(source, document.languageId);
        const maxUniqueWords = settings.maxUniqueWords ?? 300;

        if (!Number.isInteger(maxUniqueWords) ||
            maxUniqueWords < 1
        ) {
            throw new RangeError('maxUniqueWords must be positive.');
        }

        const tokens = [];
        const unique = new Set();

        for (const span of spans) {
            for (const token of tokenize(span.text)) {
                if (personalDictionary?.has(token.word)) {
                    continue;
                }
                if (!unique.has(token.key) &&
                    unique.size >= maxUniqueWords
                ) {
                    continue;
                }

                unique.add(token.key);

                const start = span.offset + token.start;
                const end = span.offset + token.end;

                tokens.push({
                    word: token.word,
                    key: token.key,
                    range: createRange(
                        document.positionAt(start),
                        document.positionAt(end)
                    ),
                });
            }
        }

        if (!tokens.length) return [];

        const results = await resolveWords(
            [...unique], {
                settings,

                checkHunspell: words => hunspellCheck(words, {
                    hunspellPath: settings.hunspellPath,
                    dictionaries,
                }),

                checkDivvun: async word => {
                    const cacheKey = [
                        settings.divvunPath,
                        settings.modelPath,
                        word,
                    ].join('|');

                    if (cache) {
                        const cached = cache.get(cacheKey);
                        if (cached !== undefined) return cached;
                    }

                    const result = await divvunCheck(word, {
                        executable: settings.divvunPath,
                        model: settings.modelPath,
                    });

                    if (cache) cache.set(cacheKey, result);

                    return result;
                },
            }
        );

        const findings = [];

        for (const token of tokens) {
            const result = results.get(token.key);

            if (!result ||
                result.status === 'accepted' ||
                result.status === 'disabled' ||
                result.status === 'unmarked'
            ) {
                continue;
            }

            const suggestions = result.suggestions || [];

            findings.push({
                ...token,
                status: result.status,
                suggestions,
                ocr: result.status === 'error' &&
                    likelyOCR(token.word, suggestions),
            });
        }

        return findings;
    };
}

module.exports = {
    createDocumentChecker,
    extractTextSpans,
    extractJsonSpans,
    likelyOCR,
    SUPPORTED_LANGUAGES,
};