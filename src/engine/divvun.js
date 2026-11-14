'use strict';

const { spawn } = require('node:child_process');

function expandPath(value, home = require('node:os').homedir()) {
  return String(value)
    .replaceAll('${userHome}', home)
    .replace(/^~(?=\/)/, home);
}

function parseResponse(output, originalWord) {
  let response;

  try {
    response = JSON.parse(output);
  } catch {
    throw new Error('Divvun returned invalid JSON.');
  }

  const item = response?.suggest?.[0];

  if (!item || typeof item.is_correct !== 'boolean') {
    throw new Error('Unexpected Divvun response.');
  }

  const suggestions = Array.isArray(item.suggestions)
    ? item.suggestions
        .map(item => item?.value)
        .filter(value =>
          typeof value === 'string' &&
          value.toLocaleLowerCase() !== originalWord.toLocaleLowerCase()
        )
        .slice(0, 6)
    : [];

  return {
    correct: item.is_correct,
    suggestions,
  };
}

async function checkWord(word, options = {}) {
  if (typeof word !== 'string' || !word.trim() || /[\r\n]/.test(word)) {
    throw new TypeError('word must be a non-empty single-line string.');
  }

  const {
    executable = '~/.cargo/bin/divvunspell',
    model = '~/AI/Faroese-Language-Tools/divvun/fo.bhfst',
    timeoutMs = 20000,
    maxOutputBytes = 1024 * 1024,
    spawnImpl = spawn,
  } = options;

  const exe = expandPath(executable);
  const archive = expandPath(model);

  const child = spawnImpl(
    exe,
    ['suggest', '--archive', archive, '--json', word],
    {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Divvun process timed out.'));
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
        finish(new Error('Divvun output exceeded the size limit.'));
        return null;
      }

      return next;
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => {
      if (!settled) stdout = collect(stdout, chunk);
    });

    child.stderr.on('data', chunk => {
      if (!settled) stderr = collect(stderr, chunk);
    });

    child.on('error', error => {
      finish(new Error(`Unable to execute Divvun: ${error.message}`));
    });

    child.on('close', code => {
      if (settled) return;

      if (code !== 0) {
        finish(new Error(
          `Divvun exited with code ${code}` +
          (stderr.trim() ? `: ${stderr.trim()}` : '')
        ));
        return;
      }

      try {
        finish(null, parseResponse(stdout, word));
      } catch (error) {
        finish(error);
      }
    });
  });
}

module.exports = {
  checkWord,
  parseResponse,
  expandPath,
};
