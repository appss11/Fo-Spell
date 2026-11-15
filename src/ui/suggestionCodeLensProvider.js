'use strict';

class SuggestionCodeLensProvider {
    constructor(vscode, findingsByUri, maxSuggestions = 3) {
        if (
            !vscode?.CodeLens ||
            !vscode?.EventEmitter ||
            !(findingsByUri instanceof Map) ||
            !Number.isInteger(maxSuggestions) ||
            maxSuggestions < 1
        ) {
            throw new TypeError('Valid VS Code APIs and findings are required.');
        }

        this.vscode = vscode;
        this.findingsByUri = findingsByUri;
        this.maxSuggestions = maxSuggestions;
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this.emitter.event;
    }

    provideCodeLenses(document) {
        const findings = this.findingsByUri.get(document.uri.toString()) || [];
        const lenses = [];

        for (const finding of findings) {
            if (!finding.range || !Array.isArray(finding.suggestions)) {
                continue;
            }

            for (const suggestion of finding.suggestions.slice(0, this.maxSuggestions)) {
                if (typeof suggestion !== 'string' || !suggestion.trim()) {
                    continue;
                }

                lenses.push(new this.vscode.CodeLens(finding.range, {
                    title: `Use "${suggestion}"`,
                    command: 'faroese.applySuggestion',
                    arguments: [document.uri, finding.range, suggestion],
                }));
            }
        }

        return lenses;
    }

    refresh() {
        this.emitter.fire();
    }

    dispose() {
        this.emitter.dispose();
    }
}

module.exports = { SuggestionCodeLensProvider };
