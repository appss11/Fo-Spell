'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DiagnosticManager,
} = require('../../src/diagnostics/diagnosticManager');

function createMockVSCode() {
  const stored = new Map();

  const collection = {
    set(uri, diagnostics) {
      stored.set(uri, diagnostics);
    },
    delete(uri) {
      stored.delete(uri);
    },
    clear() {
      stored.clear();
    },
    dispose() {},
  };

  class Diagnostic {
    constructor(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }
  }

  return {
    stored,
    api: {
      Diagnostic,
      DiagnosticSeverity: {
        Error: 0,
        Information: 3,
      },
      languages: {
        createDiagnosticCollection: () => collection,
      },
    },
  };
}

test('publishes confirmed spelling errors as errors', () => {
  const { api, stored } = createMockVSCode();
  const manager = new DiagnosticManager(api);

  const range = { start: 0, end: 5 };

  const diagnostics = manager.publish('file:///test.txt', [{
    range,
    status: 'error',
    suggestions: ['føroyskt'],
  }]);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].severity, 0);
  assert.equal(diagnostics[0].code, 'faroese-spelling');
  assert.match(diagnostics[0].message, /føroyskt/);

  assert.equal(stored.get('file:///test.txt').length, 1);
});

test('review diagnostics are disabled by default', () => {
  const { api, stored } = createMockVSCode();
  const manager = new DiagnosticManager(api);

  const diagnostics = manager.publish('file:///test.txt', [{
    range: {},
    status: 'review',
  }]);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(stored.get('file:///test.txt'), []);
});

test('review diagnostics appear when explicitly enabled', () => {
  const { api } = createMockVSCode();
  const manager = new DiagnosticManager(api);

  const diagnostics = manager.publish('file:///test.txt', [{
    range: {},
    status: 'review',
  }], { showReviewWarnings: true });

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].severity, 3);
  assert.equal(diagnostics[0].code, 'linguistic-review');
});

test('accepted and unmarked words produce no diagnostics', () => {
  const { api } = createMockVSCode();
  const manager = new DiagnosticManager(api);

  const diagnostics = manager.publish('file:///test.txt', [
    { range: {}, status: 'accepted' },
    { range: {}, status: 'unmarked' },
  ]);

  assert.equal(diagnostics.length, 0);
});

test('clear removes diagnostics for a document', () => {
  const { api, stored } = createMockVSCode();
  const manager = new DiagnosticManager(api);

  manager.publish('file:///test.txt', [{
    range: {},
    status: 'error',
  }]);

  manager.clear('file:///test.txt');

  assert.equal(stored.has('file:///test.txt'), false);
});

test('clearAll removes all diagnostics', () => {
  const { api, stored } = createMockVSCode();
  const manager = new DiagnosticManager(api);

  manager.publish('file:///one.txt', []);
  manager.publish('file:///two.txt', []);

  manager.clearAll();

  assert.equal(stored.size, 0);
});
