'use strict';

const vscode = require('vscode');

const INCLUDE = '**/*.{txt,md,markdown,json,jsonc,jsonl}';

const EXCLUDE = [
  '**/.git/**',
  '**/node_modules/**',
  '**/.venv/**',
  '**/venv/**',
  '**/dist/**',
  '**/build/**',
  '**/releases/**',
  '**/data/**',
  '**/datasets/**',
  '**/dictionaries/**'
].join(',');

const MAX_BYTES = 1024 * 1024;

async function discoverWorkspaceFiles() {
  if (!vscode.workspace.workspaceFolders?.length) {
    return [];
  }

  const uris = await vscode.workspace.findFiles(
    INCLUDE,
    `{${EXCLUDE}}`
  );

  const eligible = [];

  for (const uri of uris) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);

      if (
        stat.type === vscode.FileType.File &&
        stat.size <= MAX_BYTES
      ) {
        eligible.push(uri);
      }
    } catch {
      // Files may disappear during discovery.
    }
  }

  return eligible;
}

module.exports = {
  discoverWorkspaceFiles
};
