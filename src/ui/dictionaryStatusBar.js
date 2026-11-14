'use strict';

const DICTIONARIES = Object.freeze([
    {
        setting: 'checkFaroese',
        label: 'FO',
        name: 'Faroese',
        command: 'faroese.toggleFaroese',
    },
    {
        setting: 'checkEnglishGB',
        label: 'EN',
        name: 'English (UK)',
        command: 'faroese.toggleEnglishGB',
    },
    {
        setting: 'checkEnglishUS',
        label: 'EN-US',
        name: 'English (US)',
        command: 'faroese.toggleEnglishUS',
    },
]);

class DictionaryStatusBar {
    constructor(vscode, getSettings) {
        if (
            !vscode?.window?.createStatusBarItem ||
            typeof getSettings !== 'function'
        ) {
            throw new TypeError('VS Code and a settings reader are required.');
        }

        this.vscode = vscode;
        this.getSettings = getSettings;
        this.items = DICTIONARIES.map((dictionary, index) => {
            const item = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                100 - index
            );

            item.name = `Fo-Spell: ${dictionary.name}`;
            item.command = dictionary.command;
            item.show();

            return { item, dictionary };
        });

        this.update();
    }

    update() {
        const settings = this.getSettings();

        for (const { item, dictionary } of this.items) {
            const enabled = Boolean(settings[dictionary.setting]);

            item.text = enabled
                ? `$(check) ${dictionary.label}`
                : dictionary.label;

            item.tooltip = `${dictionary.name} dictionary is ${enabled ? 'enabled' : 'disabled'}. Click to ${enabled ? 'disable' : 'enable'} it.`;
        }
    }

    dispose() {
        for (const { item } of this.items) {
            item.dispose();
        }
    }
}

module.exports = {
    DictionaryStatusBar,
    DICTIONARIES,
};
