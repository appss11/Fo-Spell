'use strict';

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
  '**/dictionaries/**',
].join(',');

const MAX_BYTES = 1024 * 1024;

async function discoverWorkspaceFiles(vscode, options = {}) {
  if (!vscode?.workspace) {
    throw new TypeError('A valid VS Code workspace API is required.');
  }

  const {
    maxBytes = MAX_BYTES,
    include = INCLUDE,
    exclude = `{${EXCLUDE}}`,
  } = options;

  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a non-negative safe integer.');
  }

  if (!vscode.workspace.workspaceFolders?.length) {
    return [];
  }

  const uris = await vscode.workspace.findFiles(include, exclude);
  const eligible = [];

  for (const uri of uris) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);

      if (
        stat.type === vscode.FileType.File &&
        stat.size <= maxBytes
      ) {
        eligible.push(uri);
      }
    } catch {
      // Files may disappear or become inaccessible during discovery.
    }
  }

  return eligible;
}

module.exports = {
  discoverWorkspaceFiles,
  INCLUDE,
  EXCLUDE,
  MAX_BYTES,
};
