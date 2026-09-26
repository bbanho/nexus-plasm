import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { loadStack, push } from '../lib/core/stack.js';
import { startWatch, stopWatch } from '../lib/core/daemon.js';

const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'plasm-daemon-legacy-'));
const STACK = path.join(TMP, 'stack.json');
const LOG = path.join(TMP, 'logs', 'plasm.log');
const PID = path.join(TMP, 'plasm-watch.pid');

const clipboard = {
  name: 'fake',
  detectName: async () => 'fake',
  available: async () => true,
  read: async () => 'clipboard text from daemon test',
  write: async () => true,
  hasImage: async () => false,
};

describe('daemon watch loop', () => {
  test('pushes observed clipboard text once, then dedupes', async () => {
    await fs.mkdir(path.dirname(STACK), { recursive: true });
    await fs.writeFile(STACK, JSON.stringify({ items: [], maxItems: 50, dedupe: true }, null, 2), 'utf-8');

    const handle = await startWatch({
      stackPath: STACK,
      logPath: LOG,
      pidPath: PID,
      pollIntervalMs: 10,
      debounceMs: 5,
      clipboard,
      quiet: true,
    });

    await new Promise((r) => setTimeout(r, 120));
    await handle.stop();

    const items = await loadStack(STACK);
    assert.equal(items[0], 'clipboard text from daemon test');
    assert.equal(items.length, 1, 'identical polls must not duplicate entries');
  });

  test('stopWatch reports cleanly when nothing is running', async () => {
    assert.equal(await stopWatch({ pidPath: path.join(TMP, 'absent.pid') }), false);
  });
});
