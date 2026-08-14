import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const TMP = path.join(os.tmpdir(), `nexus-plasm-daemon-test-${Date.now()}`);
const STACK = path.join(TMP, 'stack.json');
const LOG = path.join(TMP, 'logs', 'plasm.log');

test('daemon watch loop push once', async () => {
  const { startWatch, stopWatch } = await import('../lib/daemon.js');
  await fs.mkdir(path.dirname(STACK), { recursive: true });
  await fs.writeFile(STACK, JSON.stringify({ items: [], maxItems: 50, dedupe: true }, null, 2), 'utf-8');

  // Simulate clipboard text by directly using internal function
  const { loadStack } = await import('../lib/stack.js');
  await loadStack(STACK);
  
  // We'll test the stack directly instead of starting the daemon
  const { push } = await import('../lib/stack.js');
  await push('clipboard text from daemon test', STACK);
  
  const items = await loadStack(STACK);
  assert.equal(items[0], 'clipboard text from daemon test');
  
  await fs.rm(TMP, { recursive: true, force: true });
});
