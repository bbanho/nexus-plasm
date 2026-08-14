import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadStack, push, pop, peek, list, clear, size, setMaxItems } from '../lib/stack.js';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nexus-plasm-'));
const stackFile = path.join(tmp, 'stack.json');

await clear(stackFile);
let s = await loadStack(stackFile);
assert.deepEqual(s, []);

s = await push('alpha', stackFile);
assert.strictEqual(s[0], 'alpha');
assert.strictEqual(await peek(stackFile), 'alpha');
assert.strictEqual(await size(stackFile), 1);

const popped = await pop(stackFile);
assert.strictEqual(popped, 'alpha');
assert.strictEqual(await peek(stackFile), null);

await push('alpha', stackFile);
await push('beta', stackFile);
await push('alpha', stackFile);
const listed = await list(stackFile);
assert.strictEqual(listed[0], 'alpha');
assert.strictEqual(listed[1], 'beta');

await setMaxItems(2, stackFile);
await push('gamma', stackFile);
assert.strictEqual(await size(stackFile), 2);

await clear(stackFile);
assert.deepEqual(await list(stackFile), []);

rmSync(tmp, { recursive: true, force: true });
console.log('stack ok');
