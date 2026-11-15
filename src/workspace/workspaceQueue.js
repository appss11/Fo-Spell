'use strict';

class WorkspaceCheckQueue {
  constructor(processFile) {
    if (typeof processFile !== 'function') {
      throw new TypeError('processFile must be a function.');
    }

    this.processFile = processFile;
    this.pending = new Map();
    this.active = new Set();
    this.worker = null;
    this.stopped = false;
  }

  enqueue(uri) {
    if (!uri || typeof uri.toString !== 'function') {
      throw new TypeError('A valid URI is required.');
    }

    if (this.stopped) return false;

    const key = uri.toString();

    // Prevent duplicates in both pending and active work.
    if (this.pending.has(key) || this.active.has(key)) {
      return false;
    }

    this.pending.set(key, uri);
    void this.drain();

    return true;
  }

  drain() {
    if (this.worker) return this.worker;
    if (this.stopped) return Promise.resolve();

    this.worker = (async () => {
      while (!this.stopped && this.pending.size > 0) {
        const [key, uri] = this.pending.entries().next().value;

        this.pending.delete(key);
        this.active.add(key);

        try {
          await this.processFile(uri);
        } catch (error) {
          console.error('Fo-Spell workspace check:', error);
        } finally {
          this.active.delete(key);
        }
      }
    })();

    const currentWorker = this.worker;

    currentWorker.finally(() => {
      if (this.worker === currentWorker) {
        this.worker = null;
      }

      if (!this.stopped && this.pending.size > 0) {
        void this.drain();
      }
    });

    return currentWorker;
  }

  async whenIdle() {
    while (this.worker) {
      await this.worker;
    }
  }

  dispose() {
    this.stopped = true;
    this.pending.clear();
  }
}

module.exports = { WorkspaceCheckQueue };
