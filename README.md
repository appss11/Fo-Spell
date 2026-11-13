# Faroese Language Tools 0.2.0

Local Faroese spell checking for VS Code using **Hunspell** and **Divvunspell**.

## Install

1. Install Hunspell and the Faroese dictionary (`sudo apt install hunspell myspell-fo`).
2. Install the Divvunspell CLI and obtain the `fo.bhfst` model separately. Neither is bundled.
3. In VS Code, run **Extensions: Install from VSIX...** and select `faroese-language-tools-0.2.0.vsix`.
4. Reload VS Code and open a `.json`, `.txt`, or `.md` document. The extension checks automatically; run **Faroese: Check Current Document** to check manually.
5. Set `faroese.divvunPath` and `faroese.modelPath` in VS Code Settings if your paths differ.

Default paths: `~/.cargo/bin/divvunspell`, `~/AI/Faroese-Language-Tools/divvun/fo.bhfst`.

**Red**: both engines reject a word and Divvun offers a plausible single-character Faroese OCR correction. **Blue**: unrecognized word requiring review, or Divvun unavailable. Accepted words have no underline. These are *heuristics*, not guarantees.

Hover for diagnostic details; press **Ctrl+.** for suggestions or to ignore the word in the current session. Corrections are only applied on explicit selection. No CSV files, logs, or other proofreading output are written. The extension doesn't send document contents to any network service.

For performance, the extension initially checks at most 300 distinct words per document (`faroese.maxUniqueWords`). Increase this for large dictionaries. Divvun is currently invoked once per Hunspell-rejected distinct word, so large documents can take time to analyze. It analyzes JSON string values, not keys; escaped JSON strings are skipped to preserve exact editor ranges.

The extension does not bundle or redistribute Divvun linguistic resources. Check upstream licenses before redistributing them.

## Development

The extension is plain Node.js JavaScript, with no npm install or build step. The VSIX is packaged directly from source. Requires VS Code 1.90+ on Linux with the external tools installed.
