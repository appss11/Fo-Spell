'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SuggestionCodeLensProvider,
} = require('../../src/ui/suggestionCodeLensProvider');

class MockCodeLens {
    constructor(range, command) {
        this.range = range;
        this.command = command;
    }
}

class MockEventEmitter {
    constructor() {
        this.listeners = [];
        this.event = listener => {
            this.listeners.push(listener);
            return { dispose: () => {
                this.listeners = this.listeners.filter(item => item !== listener);
            }};
        };
    }

    fire() {
        for (const listener of this.listeners) listener();
    }

    dispose() {
        this.listeners = [];
    }
}

const vscode = {
    CodeLens: MockCodeLens,
    EventEmitter: MockEventEmitter,
};

test('creates clickable lenses for the top three recommendations', () => {
    const uri = { toString: () => 'file:///notes.txt' };
    const range = { start: 4, end: 10 };
    const findings = new Map([[
        uri.toString(),
        [{
            range,
            suggestions: ['føroyskt', 'føroyskur', 'føroysk', 'extra'],
        }],
    ]]);

    const provider = new SuggestionCodeLensProvider(vscode, findings);
    const lenses = provider.provideCodeLenses({ uri });

    assert.equal(lenses.length, 3);
    assert.deepEqual(lenses.map(lens => lens.command.title), [
        'Use "føroyskt"',
        'Use "føroyskur"',
        'Use "føroysk"',
    ]);
    assert.ok(lenses.every(lens =>
        lens.command.command === 'faroese.applySuggestion'
    ));
    assert.deepEqual(lenses[0].command.arguments, [
        uri, range, 'føroyskt',
    ]);

    provider.dispose();
});

test('refresh notifies VS Code to recompute lenses', () => {
    const provider = new SuggestionCodeLensProvider(vscode, new Map());
    let refreshes = 0;
    provider.onDidChangeCodeLenses(() => refreshes++);

    provider.refresh();

    assert.equal(refreshes, 1);
    provider.dispose();
});

test('returns no lenses for documents without findings', () => {
    const provider = new SuggestionCodeLensProvider(vscode, new Map());
    assert.deepEqual(
        provider.provideCodeLenses({ uri: { toString: () => 'missing' } }),
        []
    );
    provider.dispose();
});
