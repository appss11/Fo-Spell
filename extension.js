'use strict';

const vscode = require('vscode');

const { readSettings } = require('./src/core/settings');
const { ResultCache } = require('./src/core/cache');
const { createDocumentChecker } = require('./src/core/documentChecker');
const { DiagnosticManager } = require('./src/diagnostics/diagnosticManager');
const { Decorations } = require('./src/diagnostics/decorations');
const { discoverWorkspaceFiles } = require('./src/workspace/workspaceScanner');
const { WorkspaceCheckQueue } = require('./src/workspace/workspaceQueue');
const { PersonalDictionary } = require('./src/core/personalDictionary');
const { DictionaryStatusBar } = require('./src/ui/dictionaryStatusBar');
const { SuggestionCodeLensProvider } = require('./src/ui/suggestionCodeLensProvider');

const findingsByUri = new Map();
const revisions = new Map();
const timers = new Map();
const ignoredWords = new Set();

let cache;
let checker;
let diagnostics;
let decorations;
let workspaceQueue;
let personalDictionary;
let dictionaryStatusBar;
let suggestionCodeLensProvider;
let warningShown = false;

function getSettings() {
    return readSettings(
        vscode.workspace.getConfiguration('faroese')
    );
}

function refreshDecorations() {
    if (!decorations) return;

    const settings = getSettings();

    decorations.refresh(
        vscode.window.visibleTextEditors,
        findingsByUri,
        settings.showReviewWarnings
    );
}

async function checkDocument(document) {
    const key = document.uri.toString();

    const timer = timers.get(key);
    if (timer) {
        clearTimeout(timer);
        timers.delete(key);
    }

    const revision = (revisions.get(key) || 0) + 1;
    revisions.set(key, revision);

    try {
        const settings = getSettings();
        const findings = await checker(document, settings);

        // Ignore outdated asynchronous results.
        if (revisions.get(key) !== revision) return;

        const filtered = findings.filter(
            finding => !ignoredWords.has(finding.word.toLocaleLowerCase())
        );

        findingsByUri.set(key, filtered);
        suggestionCodeLensProvider?.refresh();

        diagnostics.publish(
            document.uri,
            filtered,
            { showReviewWarnings: settings.showReviewWarnings }
        );

        refreshDecorations();

    } catch (error) {
        console.error('Fo-Spell document check failed:', error);

        if (!warningShown) {
            warningShown = true;
            vscode.window.showWarningMessage(
                'Fo-Spell: Spellchecking failed. See the Output console for details.'
            );
        }
    }
}

function scheduleCheck(document, delay = 400) {
    if (!document || !document.uri) return;

    const settings = getSettings();

    if (!settings.enabled) {
        const key = document.uri.toString();

        clearTimeout(timers.get(key));
        timers.delete(key);
        revisions.set(key, (revisions.get(key) || 0) + 1);
        findingsByUri.delete(key);
        suggestionCodeLensProvider?.refresh();
        diagnostics.clear(document.uri);
        refreshDecorations();
        return;
    }

    const key = document.uri.toString();

    clearTimeout(timers.get(key));

    // Invalidate previous work immediately.
    revisions.set(key, (revisions.get(key) || 0) + 1);

    timers.set(key, setTimeout(() => {
        timers.delete(key);
        void checkDocument(document);
    }, delay));
}

async function scanWorkspace() {
    const files = await discoverWorkspaceFiles(vscode);

    let queued = 0;

    for (const uri of files) {
        if (workspaceQueue.enqueue(uri)) queued++;
    }

    vscode.window.showInformationMessage(
        `Fo-Spell: queued ${queued} files for spelling analysis.`
    );

    return queued;
}

function activate(context) {
    cache = new ResultCache(10000);
    personalDictionary = new PersonalDictionary(context.globalState);

    checker = createDocumentChecker({
        cache,
        personalDictionary,

        createRange: (start, end) =>
            new vscode.Range(start, end),
    });

    diagnostics = new DiagnosticManager(vscode);
    decorations = new Decorations(vscode);
    dictionaryStatusBar = new DictionaryStatusBar(vscode, getSettings);
    suggestionCodeLensProvider = new SuggestionCodeLensProvider(
        vscode,
        findingsByUri
    );

    workspaceQueue = new WorkspaceCheckQueue(async uri => {
        const document = await vscode.workspace.openTextDocument(uri);

        await checkDocument(document);
    });

    context.subscriptions.push(
        workspaceQueue,
        diagnostics,
        dictionaryStatusBar,
        suggestionCodeLensProvider,
        {
            dispose: () => decorations.dispose(
                vscode.window.visibleTextEditors
            ),
        }
    );

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.check',
            () => {
                const editor = vscode.window.activeTextEditor;

                if (editor) {
                    scheduleCheck(editor.document, 0);
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.scanWorkspace',
            scanWorkspace
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.ignore',
            (word, uri) => {
                ignoredWords.add(word.toLocaleLowerCase());

                const document = vscode.workspace.textDocuments.find(
                    item => item.uri.toString() === uri.toString()
                );

                if (document) {
                    scheduleCheck(document, 0);
                }
            }
        )
    );

    // Personal dictionary management.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.addToPersonalDictionary',
            async word => {
                try {
                    const added = await personalDictionary.add(word);

                    if (added) {
                        for (const document of vscode.workspace.textDocuments) {
                            scheduleCheck(document, 0);
                        }
                    }

                    vscode.window.showInformationMessage(
                        added
                            ? `Fo-Spell: "${word}" added to your personal dictionary.`
                            : `Fo-Spell: "${word}" is already saved.`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Fo-Spell: Could not save word: ${error.message}`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.showPersonalDictionary',
            async () => {
                const words = personalDictionary.list();

                if (!words.length) {
                    vscode.window.showInformationMessage(
                        'Fo-Spell: Your personal dictionary is empty.'
                    );
                    return;
                }

                await vscode.window.showQuickPick(words, {
                    placeHolder: 'Your saved personal dictionary'
                });
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.removePersonalDictionary',
            async () => {
                const words = personalDictionary.list();

                if (!words.length) {
                    vscode.window.showInformationMessage(
                        'Fo-Spell: Your personal dictionary is empty.'
                    );
                    return;
                }

                const selected = await vscode.window.showQuickPick(words, {
                    placeHolder: 'Select a word to remove'
                });

                if (!selected) return;

                const removed = await personalDictionary.remove(selected);

                if (removed) {
                    for (const document of vscode.workspace.textDocuments) {
                        scheduleCheck(document, 0);
                    }

                    vscode.window.showInformationMessage(
                        `Fo-Spell: "${selected}" removed.`
                    );
                }
            }
        )
    );

    // Dictionary toggles shown in the bottom status bar.
    const dictionaryToggleCommands = [
        ['faroese.toggleFaroese', 'checkFaroese'],
        ['faroese.toggleEnglishGB', 'checkEnglishGB'],
        ['faroese.toggleEnglishUS', 'checkEnglishUS'],
    ];

    for (const [command, setting] of dictionaryToggleCommands) {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, async () => {
                const configuration = vscode.workspace.getConfiguration('faroese');
                const current = configuration.get(setting, getSettings()[setting]);

                await configuration.update(
                    setting,
                    !current,
                    vscode.ConfigurationTarget.Global
                );

                dictionaryStatusBar.update();
            })
        );
    }

    // Apply a selected suggestion from its inline CodeLens.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'faroese.applySuggestion',
            async (uri, range, suggestion) => {
                if (!uri || !range || typeof suggestion !== 'string') return;

                const edit = new vscode.WorkspaceEdit();
                edit.replace(uri, range, suggestion);
                await vscode.workspace.applyEdit(edit);
            }
        )
    );

    // Show clickable recommended replacements above the affected line.
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [...require('./src/core/documentChecker').SUPPORTED_LANGUAGES]
                .map(language => ({ language })),
            suggestionCodeLensProvider
        )
    );

    // Quick Fix provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            [...require('./src/core/documentChecker').SUPPORTED_LANGUAGES]
                .map(language => ({ language })),

            {
                provideCodeActions(document, range) {
                    const findings =
                        findingsByUri.get(document.uri.toString()) || [];

                    const actions = [];

                    for (const finding of findings) {
                        if (!finding.range.intersection(range)) continue;

                        for (const suggestion of finding.suggestions.slice(0, 5)) {
                            const action = new vscode.CodeAction(
                                `Replace with "${suggestion}"`,
                                vscode.CodeActionKind.QuickFix
                            );

                            const edit = new vscode.WorkspaceEdit();

                            edit.replace(
                                document.uri,
                                finding.range,
                                suggestion
                            );

                            action.edit = edit;
                            actions.push(action);
                        }

                        const addToDictionary = new vscode.CodeAction(
                            `Add "${finding.word}" to Personal Dictionary`,
                            vscode.CodeActionKind.QuickFix
                        );

                        addToDictionary.command = {
                            command: 'faroese.addToPersonalDictionary',
                            title: 'Add to Personal Dictionary',
                            arguments: [finding.word],
                        };

                        actions.push(addToDictionary);

                        const ignore = new vscode.CodeAction(
                            `Ignore "${finding.word}" for this session`,
                            vscode.CodeActionKind.QuickFix
                        );

                        ignore.command = {
                            command: 'faroese.ignore',
                            title: 'Ignore word',
                            arguments: [finding.word, document.uri],
                        };

                        actions.push(ignore);
                    }

                    return actions;
                }
            },

            {
                providedCodeActionKinds: [
                    vscode.CodeActionKind.QuickFix
                ]
            }
        )
    );

    // Configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('faroese')) {
                dictionaryStatusBar.update();

                for (const document of vscode.workspace.textDocuments) {
                    scheduleCheck(document, 0);
                }

                refreshDecorations();
            }
        })
    );

    // Document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (getSettings().checkOnType) {
                scheduleCheck(event.document);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            scheduleCheck(document, 0);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            const key = document.uri.toString();

            clearTimeout(timers.get(key));
            timers.delete(key);

            revisions.set(key, (revisions.get(key) || 0) + 1);

            findingsByUri.delete(key);
            suggestionCodeLensProvider?.refresh();
            diagnostics.clear(document.uri);

            refreshDecorations();
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(refreshDecorations)
    );

    // Check documents already open.
    for (const document of vscode.workspace.textDocuments) {
        scheduleCheck(document, 0);
    }

    // Start sequential workspace checking.
    void scanWorkspace().catch(error => {
        console.error('Fo-Spell workspace scan failed:', error);
    });

    console.log('Fo-Spell 0.3.1 activated.');
}

function deactivate() {
    for (const timer of timers.values()) {
        clearTimeout(timer);
    }

    timers.clear();

    if (workspaceQueue) workspaceQueue.dispose();
    if (cache) cache.clear();

    findingsByUri.clear();
    revisions.clear();
    ignoredWords.clear();
}

module.exports = {
    activate,
    deactivate,
};
