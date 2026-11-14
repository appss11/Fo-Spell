# Fo-Spell 0.3.1

Local, Faroese-first spell checking for VS Code using **Hunspell** and **Divvunspell**.

## Features

- Faroese is enabled by default.
- English (UK) and English (US) are optional dictionaries.
- Toggle **FO**, **EN**, and **EN-US** independently from the bottom-right VS Code status bar.
- Clickable spelling recommendations appear above affected lines; select a recommendation to replace the word.
- Standard VS Code Quick Fix actions remain available with **Ctrl+.**.
- Add unknown names and terms to a persistent Personal Dictionary.
- Workspace scanning, sequential file processing, result caching, and red/blue diagnostics.
- Checking is local; document contents are not sent to a network service.

The three status-bar controls are independent. You can enable more than one dictionary at a time. A checkmark indicates an enabled dictionary.

## Install requirements

1. Install Hunspell and the Faroese dictionary (for example, `sudo apt install hunspell myspell-fo`).
2. Install the Divvunspell CLI and obtain the Faroese `fo.bhfst` model separately. Neither resource is bundled.
3. In VS Code, run **Extensions: Install from VSIX...** and select the packaged `faroese-language-tools-0.3.1.vsix`.
4. Reload VS Code and open a supported text document.
5. Set `faroese.divvunPath` and `faroese.modelPath` in VS Code Settings if your paths differ.

Default paths: `~/.cargo/bin/divvunspell`, `~/AI/Faroese-Language-Tools/divvun/fo.bhfst`.

## Diagnostics and suggestions

**Red** underlines indicate confirmed spelling errors. **Blue** underlines are optional linguistic review warnings and are disabled by default. Hover for diagnostic details. Click a visible **Use "…"** CodeLens recommendation to apply it, or press **Ctrl+.** for the standard Quick Fix menu. Corrections are only applied after an explicit selection.

The Personal Dictionary is stored in VS Code's extension global state and persists across sessions. Use the **Fo-Spell: Show Personal Dictionary** and **Fo-Spell: Remove from Personal Dictionary** commands to manage saved words.

## Performance and scope

The extension initially checks at most 300 distinct words per document (`faroese.maxUniqueWords`). Increase this for large documents. JSON and JSONC checking targets string values, not property names; escaped JSON strings are skipped to preserve exact editor ranges.

The extension currently checks plaintext, Markdown, JSON, JSONC, and JSONL documents. Divvun is only used for Faroese analysis.

## Development

Plain Node.js JavaScript; no npm install or build step is required. Run:

- `npm test`
- `npm run check`

Requires VS Code 1.90+ and the external linguistic tools described above.

The extension does not bundle or redistribute Divvun linguistic resources. Check upstream licenses before redistributing them.
