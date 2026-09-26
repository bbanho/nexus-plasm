import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { createFakeRunner } from './helpers/fake-runner.js';
import { createWaylandClipboard } from '../lib/adapters/clipboard/wayland.js';

const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'plasm-daemon-'));
const STACK = path.join(TMP, 'stack.json');
const LOG = path.join(TMP, 'logs', 'plasm.log');
const PID = path.join(TMP, 'plasm-watch.pid');

function fakeClipboard(text) {
  return {
    name: 'fake',
    detectName: async () => 'fake',
    available: async () => true,
    read: async () => text,
    write: async () => true,
    hasImage: async () => false,
  };
}

describe('daemon watch', () => {
  // Regression: startWatch() never wrote the PID file, so `plasm stop` had
  // nothing to read and could never terminate a running daemon.
  test('startWatch writes a PID file that stopWatch can consume', async () => {
    const { startWatch, stopWatch } = await import('../lib/core/daemon.js');
    const handle = await startWatch({
      stackPath: STACK,
      logPath: LOG,
      pidPath: PID,
      pollIntervalMs: 10_000,
      clipboard: fakeClipboard('conteudo'),
      quiet: true,
    });

    const pid = Number(await fs.readFile(PID, 'utf-8'));
    assert.equal(pid, process.pid);
    assert.equal(handle.pidPath, PID);

    await handle.stop();
  });

  test('stopWatch cleans a stale PID file instead of throwing', async () => {
    const { stopWatch } = await import('../lib/core/daemon.js');
    await fs.writeFile(PID, '999999', 'utf-8');
    const stopped = await stopWatch({ pidPath: PID });
    assert.equal(stopped, false);
    await assert.rejects(() => fs.access(PID), 'stale PID file must be removed');
  });

  test('stopWatch on a missing PID file is a no-op', async () => {
    const { stopWatch } = await import('../lib/core/daemon.js');
    assert.equal(await stopWatch({ pidPath: path.join(TMP, 'nope.pid') }), false);
  });

  test('pushes clipboard text into the stack', async () => {
    const { startWatch } = await import('../lib/core/daemon.js');
    await fs.writeFile(STACK, JSON.stringify({ items: [], maxItems: 50, dedupe: true }), 'utf-8');

    const handle = await startWatch({
      stackPath: STACK,
      logPath: LOG,
      pidPath: PID,
      pollIntervalMs: 10_000,
      debounceMs: 1,
      clipboard: fakeClipboard('texto observado'),
      quiet: true,
    });

    await new Promise((r) => setTimeout(r, 60));

    const data = JSON.parse(await fs.readFile(STACK, 'utf-8'));
    assert.equal(data.items[0], 'texto observado');
    // config-driven, not hardcoded
    assert.equal(data.maxItems, 50);

    await handle.stop();
  });

  test('respects maxItems from options', async () => {
    const { startWatch } = await import('../lib/core/daemon.js');
    const stack2 = path.join(TMP, 'stack2.json');
    await fs.writeFile(stack2, JSON.stringify({ items: ['a'], maxItems: 2, dedupe: true }), 'utf-8');

    const handle = await startWatch({
      stackPath: stack2,
      logPath: LOG,
      pidPath: PID,
      pollIntervalMs: 10_000,
      debounceMs: 1,
      maxItems: 2,
      clipboard: fakeClipboard('b'),
      quiet: true,
    });

    await new Promise((r) => setTimeout(r, 60));
    const data = JSON.parse(await fs.readFile(stack2, 'utf-8'));
    assert.equal(data.items.length, 2);
    assert.equal(data.maxItems, 2);

    await handle.stop();
  });
});

describe('daemon uses the injected clipboard port', () => {
  test('the core does not shell out to a clipboard tool itself', async () => {
    const runner = createFakeRunner({ bins: { 'wl-paste': 1, 'wl-copy': 1 }, responses: { 'wl-paste': '' } });
    const clip = createWaylandClipboard(runner);
    assert.equal(await clip.read(), '');
    // The daemon's dependency is the port, not the binary list; swapping in a
    // different adapter is the only change an environment needs.
    assert.equal(runner.calls.every((c) => c.bin === 'wl-paste'), true);
  });
});
