'use strict';

const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    checkFaroese: true,
    checkEnglishGB: false,
    checkEnglishUS: false,
    useDivvun: true,
    showReviewWarnings: false,
    checkOnType: true,
    dictionary: 'fo_FO',
    hunspellPath: 'hunspell',
    divvunPath: '${userHome}/.cargo/bin/divvunspell',
    modelPath: '${userHome}/AI/Faroese-Language-Tools/divvun/fo.bhfst',
    maxUniqueWords: 300,
});

function readSettings(configuration) {
    const result = {};

    for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
        result[key] = configuration.get(key, fallback);
    }

    return Object.freeze(result);
}

function getActiveDictionaries(settings) {
    const dictionaries = [];

    if (settings.checkFaroese) {
        dictionaries.push(settings.dictionary);
    }

    if (settings.checkEnglishGB) {
        dictionaries.push('en_GB');
    }

    if (settings.checkEnglishUS) {
        dictionaries.push('en_US');
    }

    return [...new Set(dictionaries)];
}

module.exports = {
    DEFAULT_SETTINGS,
    readSettings,
    getActiveDictionaries,
};