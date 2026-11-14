'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  discoverWorkspaceFiles,
  MAX_BYTES,
} = require('../../src/workspace/workspaceScanner');

function createVSCode(files, folders = [{}]) {
  const calls = [];

  const vscode = {
    FileType: {
      File: 1,
      Directory: 2,
    },
    workspace: {
      workspaceFolders: folders,

      async findFiles(include, exclude) {
        calls.push({ include, exclude });
        return files.map(file => file.uri);
      },

      fs: {
        async stat(uri) {
          const file = files.find(item => item.uri === uri);

          if (!file || file.error) {
            throw new Error('File unavailable');
          }

          return {
            type: file.type,
            size: file.size,
          };
        },
      },
    },
  };

  return { vscode, calls };
}

test('discovers eligible workspace files', async () => {
  const files = [
    { uri: 'one.txt', type: 1, size: 100 },
    { uri: 'two.md', type: 1, size: 200 },
  ];

  const { vscode } = createVSCode(files);

  const result = await discoverWorkspaceFiles(vscode);

  assert.deepEqual(result, ['one.txt', 'two.md']);
});

test('returns empty when no workspace is open', async () => {
  const { vscode } = createVSCode([], []);

  assert.deepEqual(
    await discoverWorkspaceFiles(vscode),
    []
  );
});

test('excludes files larger than the configured limit', async () => {
  const { vscode } = createVSCode([
    { uri: 'small.txt', type: 1, size: 100 },
    { uri: 'large.txt', type: 1, size: MAX_BYTES + 1 },
  ]);

  const result = await discoverWorkspaceFiles(vscode);

  assert.deepEqual(result, ['small.txt']);
});

test('excludes directories', async () => {
  const { vscode } = createVSCode([
    { uri: 'folder', type: 2, size: 100 },
  ]);

  assert.deepEqual(
    await discoverWorkspaceFiles(vscode),
    []
  );
});

test('skips files that disappear during discovery', async () => {
  const { vscode } = createVSCode([
    { uri: 'missing.txt', error: true },
    { uri: 'available.txt', type: 1, size: 100 },
  ]);

  assert.deepEqual(
    await discoverWorkspaceFiles(vscode),
    ['available.txt']
  );
});

test('uses the supported file patterns', async () => {
  const { vscode, calls } = createVSCode([]);

  await discoverWorkspaceFiles(vscode);

  assert.match(calls[0].include, /jsonl/);
  assert.match(calls[0].include, /markdown/);
  assert.match(calls[0].exclude, /datasets/);
  assert.match(calls[0].exclude, /dictionaries/);
});

test('supports a custom file-size limit', async () => {
  const { vscode } = createVSCode([
    { uri: 'one.txt', type: 1, size: 500 },
  ]);

  assert.deepEqual(
    await discoverWorkspaceFiles(vscode, { maxBytes: 100 }),
    []
  );
});

test('rejects invalid size limits', async () => {
  const { vscode } = createVSCode([]);

  await assert.rejects(
    discoverWorkspaceFiles(vscode, { maxBytes: -1 }),
    /maxBytes/
  );
});
