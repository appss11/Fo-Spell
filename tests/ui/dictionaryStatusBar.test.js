'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DictionaryStatusBar } = require('../../src/ui/dictionaryStatusBar');

function createVscodeMock() {
    const items = [];
    return {
        items,
        vscode: {
            StatusBarAlignment: { Right: 2 },
            window: {
                createStatusBarItem(alignment, priority) {
                    const item = {
                        alignment,
                        priority,
                        showCalled: false,
                        disposed: false,
                        show() { this.showCalled = true; },
                        dispose() { this.disposed = true; },
                    };
                    items.push(item);
                    return item;
                },
            },
        },
    };
}

test('creates three visible status-bar dictionary toggles', () => {
    const { vscode, items } = createVscodeMock();
    const settings = {
        checkFaroese: true,
        checkEnglishGB: false,
        checkEnglishUS: false,
    };

    const bar = new DictionaryStatusBar(vscode, () => settings);

    assert.equal(items.length, 3);
    assert.deepEqual(items.map(item => item.command), [
        'faroese.toggleFaroese',
        'faroese.toggleEnglishGB',
        'faroese.toggleEnglishUS',
    ]);
    assert.ok(items.every(item => item.showCalled));
    assert.match(items[0].text, /FO/);
    assert.match(items[0].text, /check/);
    assert.equal(items[1].text, 'EN');
    assert.equal(items[2].text, 'EN-US');

    bar.dispose();
    assert.ok(items.every(item => item.disposed));
});

test('updates labels and tooltips when dictionary settings change', () => {
    const { vscode, items } = createVscodeMock();
    const settings = {
        checkFaroese: true,
        checkEnglishGB: false,
        checkEnglishUS: false,
    };
    const bar = new DictionaryStatusBar(vscode, () => settings);

    settings.checkFaroese = false;
    settings.checkEnglishGB = true;
    bar.update();

    assert.equal(items[0].text, 'FO');
    assert.match(items[0].tooltip, /disabled/);
    assert.match(items[1].text, /EN/);
    assert.match(items[1].text, /check/);
    assert.match(items[1].tooltip, /enabled/);

    bar.dispose();
});

test('rejects missing dependencies', () => {
    assert.throws(() => new DictionaryStatusBar(null, () => ({})), /VS Code/);
});
