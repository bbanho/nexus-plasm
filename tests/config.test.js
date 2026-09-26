import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { loadConfigFrom, expandPath } from '../lib/core/config.js';

async function writeConfig(content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plasm-config-'));
  const file = path.join(dir, 'config.yaml');
  await fs.writeFile(file, content, 'utf-8');
  return file;
}

describe('config loading', () => {
  // Regression: the old parser only attempted YAML when the file started with
  // the literal 'max_items:' or 'ollama:'. A config starting with 'gemini:'
  // or a comment parsed to {} with no error — every setting silently ignored.
  test('parses YAML that does not start with max_items or ollama', async () => {
    const file = await writeConfig([
      'default_llm: gemini',
      'gemini:',
      '  base_url: https://example.invalid',
      '  default_model: gemini-2.5-flash',
      '',
    ].join('\n'));
    const cfg = await loadConfigFrom(file);
    assert.equal(cfg.default_llm, 'gemini');
    assert.equal(cfg.gemini.default_model, 'gemini-2.5-flash');
  });

  test('parses YAML behind a leading comment', async () => {
    const file = await writeConfig([
      '# nexus-plasm',
      'max_items: 20',
      'ollama:',
      '  base_url: http://localhost:11434',
      '',
    ].join('\n'));
    const cfg = await loadConfigFrom(file);
    assert.equal(cfg.max_items, 20);
    assert.equal(cfg.ollama.base_url, 'http://localhost:11434');
  });

  test('accepts JSON as well as YAML', async () => {
    const file = await writeConfig(JSON.stringify({ default_llm: 'ollama', max_items: 7 }));
    const cfg = await loadConfigFrom(file);
    assert.equal(cfg.max_items, 7);
  });

  test('missing file yields an empty config, not a crash', async () => {
    const cfg = await loadConfigFrom('/nonexistent/plasm/config.yaml');
    assert.deepEqual(cfg, {});
  });

  test('resolves ${ENV_VAR} references for provider keys', async () => {
    process.env.PLASM_TEST_KEY = 'from-env';
    const file = await writeConfig([
      'gemini:',
      '  api_key_env: PLASM_TEST_KEY',
      '',
    ].join('\n'));
    const cfg = await loadConfigFrom(file);
    assert.equal(cfg.gemini.api_key, 'from-env');
    delete process.env.PLASM_TEST_KEY;
  });

  // Regression (B13): the shipped config documents paths as ~/... . Without
  // expansion the stack file was created at './~/.local/share/...' inside the
  // working directory, so state scattered per-CWD and never matched the docs.
  test('expands ~ in configured paths', async () => {
    const file = await writeConfig([
      'paths:',
      '  stack_file: ~/.local/share/nexus-plasm/stack.json',
      '  log_file: ~/.local/share/nexus-plasm/logs/plasm.log',
      '',
    ].join('\n'));
    const cfg = await loadConfigFrom(file);
    assert.equal(cfg.paths.stack_file, path.join(os.homedir(), '.local/share/nexus-plasm/stack.json'));
    assert.ok(!cfg.paths.stack_file.includes('~'), 'no literal tilde may survive');
  });

  test('expandPath handles ~, $HOME, ${HOME} and relative forms', () => {
    const home = os.homedir();
    assert.equal(expandPath('~'), home);
    assert.equal(expandPath('~/x'), path.join(home, 'x'));
    assert.equal(expandPath('$HOME/x'), path.join(home, 'x'));
    assert.equal(expandPath('${HOME}/x'), path.join(home, 'x'));
    assert.equal(expandPath('/abs/path'), '/abs/path');
    assert.equal(expandPath(''), '');
    assert.equal(expandPath(null), null);
    assert.ok(path.isAbsolute(expandPath('rel/path')), 'relative paths resolve against CWD');
  });
});
