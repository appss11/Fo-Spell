'use strict';

const { spawn } = require('node:child_process');

function parseUnknownWords(output) {
  return new Set(
    output
      .split(/\r?\n/)
      .map(word => word.trim().toLocaleLowerCase())
      .filter(Boolean)
  );
}

async function checkWords(words, options = {}) {
  const {
    hunspellPath = 'hunspell',
    dictionaries = ['fo_FO', 'en_GB', 'en_US'],
    timeoutMs = 30000,
    maxOutputBytes = 4 * 1024 * 1024,
    spawnImpl = spawn,
  } = options;

  if (!Array.isArray(words)) {
    throw new TypeError('words must be an array.');
  }

  if (!Array.isArray(dictionaries) || dictionaries.length === 0) {
    throw new Error('At least one Hunspell dictionary must be enabled.');
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('timeoutMs must be a positive integer.');
  }

  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) {
    throw new RangeError('maxOutputBytes must be a positive integer.');
  }

  if (words.some(word =>
    typeof word !== 'string' || /[\r\n]/.test(word)
  )) {
    throw new TypeError('Every word must be a single-line string.');
  }

  const uniqueWords = [...new Set(words)];

  if (uniqueWords.length === 0) {
    return new Map();
  }

  const normalizedDictionaries = [...new Set(dictionaries)];

  if (normalizedDictionaries.some(dictionary =>
    typeof dictionary !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(dictionary)
  )) {
    throw new TypeError('Invalid dictionary identifier.');
  }

  const child = spawnImpl(
    hunspellPath,
    ['-d', normalizedDictionaries.join(','), '-l'],
    {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Hunspell process timed out.'));
    }, timeoutMs);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (error) reject(error);
      else resolve(result);
    }

    function collect(current, chunk) {
      const next = current + chunk.toString('utf8');

      if (Buffer.byteLength(next, 'utf8') > maxOutputBytes) {
        child.kill();
        finish(new Error('Hunspell output exceeded the size limit.'));
        return null;
      }

      return next;
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => {
      if (settled) return;
      stdout = collect(stdout, chunk);
    });

    child.stderr.on('data', chunk => {
      if (settled) return;
      stderr = collect(stderr, chunk);
    });

    child.on('error', error => {
      finish(new Error(`Unable to execute Hunspell: ${error.message}`));
    });

    child.on('close', (code, signal) => {
      if (settled) return;

      if (code !== 0) {
        finish(new Error(
          `Hunspell exited with code ${code}` +
          (signal ? ` (signal ${signal})` : '') +
          (stderr.trim() ? `: ${stderr.trim()}` : '')
        ));
        return;
      }

      const rejected = parseUnknownWords(stdout);

      const results = new Map(
        uniqueWords.map(word => [
          word.toLocaleLowerCase(),
          !rejected.has(word.toLocaleLowerCase()),
        ])
      );

      finish(null, results);
    });

    child.stdin.on('error', error => {
      if (error.code !== 'EPIPE') {
        finish(error);
      }
    });

    child.stdin.end(uniqueWords.join('\n') + '\n');
  });
}

module.exports = {
  checkWords,
  parseUnknownWords,
};
