'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  Decorations,
} = require('../../src/diagnostics/decorations');

function createMockVSCode() {
  const types = [];

  return {
    types,
    api: {
      OverviewRulerLane: { Right: 4 },
      window: {
        createTextEditorDecorationType(options) {
          const type = {
            options,
            disposed: false,
            dispose() {
              this.disposed = true;
            },
          };

          types.push(type);
          return type;
        },
      },
    },
  };
}

function createEditor(uri) {
  const calls = [];

  return {
    calls,
    document: {
      uri: { toString: () => uri },
    },
    setDecorations(type, ranges) {
      calls.push({ type, ranges });
    },
  };
}

test('creates separate red and blue decorations', () => {
  const { api, types } = createMockVSCode();
  const decorations = new Decorations(api);

  assert.equal(types.length, 2);
  assert.notEqual(decorations.red, decorations.blue);
});

test('confirmed errors receive red decorations', () => {
  const { api } = createMockVSCode();
  const decorations = new Decorations(api);
  const editor = createEditor('file:///test.txt');
  const range = {};

  decorations.refresh([editor], new Map([
    ['file:///test.txt', [
      { range, status: 'error' },
    ]],
  ]));

  assert.equal(editor.calls[0].type, decorations.red);
  assert.deepEqual(editor.calls[0].ranges, [range]);
});

test('review warnings are hidden by default', () => {
  const { api } = createMockVSCode();
  const decorations = new Decorations(api);
  const editor = createEditor('file:///test.txt');

  decorations.refresh([editor], new Map([
    ['file:///test.txt', [
      { range: {}, status: 'review' },
    ]],
  ]));

  assert.deepEqual(editor.calls[1].ranges, []);
});

test('review warnings appear when enabled', () => {
  const { api } = createMockVSCode();
  const decorations = new Decorations(api);
  const editor = createEditor('file:///test.txt');
  const range = {};

  decorations.refresh(
    [editor],
    new Map([['file:///test.txt', [
      { range, status: 'review' },
    ]]]),
    true
  );

  assert.equal(editor.calls[1].type, decorations.blue);
  assert.deepEqual(editor.calls[1].ranges, [range]);
});

test('disabling review warnings immediately clears blue decorations', () => {
  const { api } = createMockVSCode();
  const decorations = new Decorations(api);
  const editor = createEditor('file:///test.txt');
  const range = {};

  const findings = new Map([['file:///test.txt', [
    { range, status: 'review' },
    { range: {}, status: 'error' },
  ]]]);

  decorations.refresh([editor], findings, true);
  decorations.refresh([editor], findings, false);

  const lastCalls = editor.calls.slice(-2);

  assert.deepEqual(lastCalls[1].ranges, []);
  assert.deepEqual(lastCalls[0].ranges, [findings.get('file:///test.txt')[1].range]);
});

test('clear removes both red and blue markings', () => {
  const { api } = createMockVSCode();
  const decorations = new Decorations(api);
  const editor = createEditor('file:///test.txt');

  decorations.clear([editor]);

  assert.deepEqual(editor.calls[0].ranges, []);
  assert.deepEqual(editor.calls[1].ranges, []);
});

test('dispose releases both decoration types', () => {
  const { api } = createMockVSCode();
  const decorations = new Decorations(api);

  decorations.dispose();

  assert.equal(decorations.red.disposed, true);
  assert.equal(decorations.blue.disposed, true);
});
