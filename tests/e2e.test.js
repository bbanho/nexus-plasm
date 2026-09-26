import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { loadStack, push, pop, peek, list, clear, size, setMaxItems } from '../lib/core/stack.js';

// End-to-end over the FIFO with a real temp stack file and an injected
// clipboard port. No display server involved, so this runs anywhere.
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'plasm-e2e-'));
const stackFile = path.join(tmp, 'stack.json');

const fakeClipboard = {
  name: 'fake',
  detectName: async () => 'fake',
  available: async () => true,
  read: async () => 'do clipboard',
  write: async () => true,
  hasImage: async () => false,
};

describe('clipboard FIFO end-to-end', () => {
  test('push / peek / pop roundtrip preserves order', async () => {
    await clear(stackFile);
    await push('hello world', stackFile);
    await push('foo bar', stackFile);

    assert.equal(await peek(stackFile), 'foo bar', 'LIFO: newest on top');

    const all = await list(stackFile);
    assert.equal(all.length, 2);
    assert.deepEqual(all, ['foo bar', 'hello world']);

    assert.equal(await pop(stackFile), 'foo bar');
    assert.equal(await size(stackFile), 1);
    assert.equal(await pop(stackFile), 'hello world');
    assert.equal(await pop(stackFile), null, 'pop on empty returns null, not undefined');
  });

  test('dedupes consecutive identical pushes', async () => {
    await clear(stackFile);
    await push('mesmo', stackFile);
    await push('mesmo', stackFile);
    assert.equal(await size(stackFile), 1);
  });

  test('ignores blank pushes', async () => {
    await clear(stackFile);
    await push('   ', stackFile);
    await push('', stackFile);
    assert.equal(await size(stackFile), 0);
  });

  test('enforces maxItems, keeping the newest', async () => {
    await clear(stackFile);
    await setMaxItems(3, stackFile);
    for (const t of ['a', 'b', 'c', 'd', 'e']) await push(t, stackFile);
    const items = await list(stackFile);
    assert.equal(items.length, 3);
    assert.deepEqual(items, ['e', 'd', 'c']);
  });

  test('two stacks in the same process do not share state', async () => {
    // Regression: the old stack.js kept the FIFO in a mutable module global,
    // so concurrent users clobbered each other.
    const other = path.join(tmp, 'other.json');
    await clear(stackFile);
    await clear(other);
    await push('um', stackFile);
    await push('dois', other);
    assert.deepEqual(await list(stackFile), ['um']);
    assert.deepEqual(await list(other), ['dois']);
  });

  test('roundtrips through the injected clipboard port', async () => {
    await clear(stackFile);
    const read = await fakeClipboard.read();
    await push(read, stackFile);
    const pasted = await pop(stackFile);
    assert.equal(pasted, 'do clipboard');
    assert.equal(await fakeClipboard.write(pasted), true);
  });

  test('loadStack returns a copy, not the internal array', async () => {
    await clear(stackFile);
    await push('original', stackFile);
    const snapshot = await loadStack(stackFile);
    snapshot[0] = 'mutado';
    assert.equal(await peek(stackFile), 'original');
  });
});
