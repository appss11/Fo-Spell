'use strict';

const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

function tokenize(text) {
    const tokens = [];

    for (const match of text.matchAll(WORD_PATTERN)) {
        const word = match[0];

        tokens.push({
            word,
            key: word.toLocaleLowerCase(),
            start: match.index,
            end: match.index + word.length,
        });
    }

    return tokens;
}

function uniqueWords(tokens) {
    return [...new Set(tokens.map(token => token.key))];
}

module.exports = {
    tokenize,
    uniqueWords,
};