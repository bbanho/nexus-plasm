import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadStack, push, pop, peek, list, clear, size, setMaxItems } from '../lib/stack.js';
import { readText, writeText } from '../lib/clipboard.js';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'nexus-plasm-e2e-'));
const stackFile = path.join(tmp, 'stack.json');
mkdirSync(path.dirname(stackFile), { recursive: true });
writeFileSync(stackFile, JSON.stringify({ items: [], maxItems: 50, dedupe: true }));

await clear(stackFile);
await push('hello world', stackFile);
await push('foo bar', stackFile);

const top = await peek(stackFile);
assert.strictEqual(top, 'foo bar');

const all = await list(stackFile);
assert.strictEqual(all.length, 2);

const popped = await pop(stackFile);
assert.strictEqual(popped, 'foo bar');
assert.strictEqual(await size(stackFile), 1);

const writeOk = await writeText('nexus-plasm-test');
// Don't assert true because test runner may not have clipboard access
assert.strictEqual(typeof writeOk, 'boolean');

rmSync(tmp, { recursive: true, force: true });
console.log('e2e scaffold ok');
