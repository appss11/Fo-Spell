'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WorkspaceCheckQueue,
} = require('../../src/workspace/workspaceQueue');

function uri(value) {
  return { toString: () => value };
}

test('processes queued files sequentially', async () => {
  const processed = [];
  let active = 0;
  let maxActive = 0;

  const queue = new WorkspaceCheckQueue(async file => {
    active++;
    maxActive = Math.max(maxActive, active);

    await new Promise(resolve => setImmediate(resolve));

    processed.push(file.toString());
    active--;
  });

  queue.enqueue(uri('one.txt'));
  queue.enqueue(uri('two.txt'));
  queue.enqueue(uri('three.txt'));

  await queue.whenIdle();

  assert.deepEqual(processed, [
    'one.txt',
    'two.txt',
    'three.txt',
  ]);

  assert.equal(maxActive, 1);

  queue.dispose();
});

test('prevents duplicate pending entries', async () => {
  const processed = [];

  const queue = new WorkspaceCheckQueue(async file => {
    await new Promise(resolve => setImmediate(resolve));
    processed.push(file.toString());
  });

  assert.equal(queue.enqueue(uri('one.txt')), true);
  assert.equal(queue.enqueue(uri('one.txt')), false);

  await queue.whenIdle();

  assert.deepEqual(processed, ['one.txt']);

  queue.dispose();
});

test('accepts new work while another file is processing', async () => {
  const processed = [];
  let release;

  const queue = new WorkspaceCheckQueue(async file => {
    if (file.toString() === 'one.txt') {
      await new Promise(resolve => {
        release = resolve;
      });
    }

    processed.push(file.toString());
  });

  queue.enqueue(uri('one.txt'));

  await new Promise(resolve => setImmediate(resolve));

  queue.enqueue(uri('two.txt'));

  release();

  await queue.whenIdle();

  assert.deepEqual(processed, ['one.txt', 'two.txt']);

  queue.dispose();
});

test('stops accepting new work after disposal', async () => {
  const processed = [];

  const queue = new WorkspaceCheckQueue(async file => {
    processed.push(file.toString());
  });

  queue.dispose();

  assert.equal(queue.enqueue(uri('one.txt')), false);

  await queue.whenIdle();

  assert.deepEqual(processed, []);
});

test('clears pending work on disposal', async () => {
  let release;
  const processed = [];

  const queue = new WorkspaceCheckQueue(async file => {
    if (file.toString() === 'one.txt') {
      await new Promise(resolve => {
        release = resolve;
      });
    }

    processed.push(file.toString());
  });

  queue.enqueue(uri('one.txt'));

  await new Promise(resolve => setImmediate(resolve));

  queue.enqueue(uri('two.txt'));
  queue.dispose();

  release();

  await queue.whenIdle();

  assert.deepEqual(processed, ['one.txt']);
});

test('rejects an invalid processor', () => {
  assert.throws(
    () => new WorkspaceCheckQueue(null),
    /processFile/
  );
});

test('rejects invalid URIs', () => {
  const queue = new WorkspaceCheckQueue(async () => {});

  assert.throws(
    () => queue.enqueue(null),
    /URI/
  );

  queue.dispose();
});
