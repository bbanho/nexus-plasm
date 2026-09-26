import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { createFakeRunner } from './helpers/fake-runner.js';
import { createWaylandClipboard } from '../lib/adapters/clipboard/wayland.js';
import { createX11Clipboard } from '../lib/adapters/clipboard/x11.js';
import { createAutoClipboard } from '../lib/adapters/clipboard/auto.js';
import { ClipboardUnavailable } from '../lib/ports/clipboard.js';

describe('wayland clipboard adapter', () => {
  // Contract: available() means the backend can do BOTH halves of the job
  // (read the clipboard AND write the LLM result back). A read-only wl-paste
  // is not enough for a clipboard FIFO, so it must not be selected.
  test('is unavailable when write tool is missing', async () => {
    const clip = createWaylandClipboard(createFakeRunner({ bins: { 'wl-paste': 1 } }));
    assert.equal(await clip.available(), false);
  });

  test('is available when both wl-paste and wl-copy exist', async () => {
    const yes = createWaylandClipboard(createFakeRunner({ bins: { 'wl-paste': 1, 'wl-copy': 1 } }));
    const no = createWaylandClipboard(createFakeRunner({ bins: {} }));
    assert.equal(await yes.available(), true);
    assert.equal(await no.available(), false);
  });

  test('read returns trimmed clipboard text', async () => {
    const runner = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1 },
      responses: { 'wl-paste': 'olá mundo' },
    });
    const clip = createWaylandClipboard(runner);
    assert.equal(await clip.read(), 'olá mundo');
    assert.deepEqual(runner.calls[0].args, ['-n']);
  });

  // Regression: the old writeText() had `if (ok) return true` inside a
  // .then() callback, so the return never escaped and it always reported
  // false while still having written to the clipboard.
  test('write reports success on the FIRST working backend', async () => {
    const runner = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1 },
      responses: { 'wl-copy': '' },
    });
    const clip = createWaylandClipboard(runner);
    assert.equal(await clip.write('texto'), true);
    assert.equal(runner.calls.length, 1, 'must not fall through to other backends');
    assert.equal(runner.calls[0].input, 'texto');
  });

  test('write reports failure when the backend errors', async () => {
    const runner = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1 },
      responses: { 'wl-copy': { __throw: 'no display' } },
    });
    assert.equal(await createWaylandClipboard(runner).write('x'), false);
  });

  test('hasImage detects image mime in the type list', async () => {
    const withImage = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1 },
      responses: { 'wl-paste': 'text/plain\nimage/png\n' },
    });
    const textOnly = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1 },
      responses: { 'wl-paste': 'text/plain\n' },
    });
    assert.equal(await createWaylandClipboard(withImage).hasImage(), true);
    assert.equal(await createWaylandClipboard(textOnly).hasImage(), false);
  });
});

describe('x11 clipboard adapter', () => {
  test('prefers xclip and falls back to xsel', async () => {
    const runner = createFakeRunner({
      bins: { 'xclip': 1, 'xsel': 1 },
      responses: { xclip: 'via xclip', xsel: 'via xsel' },
    });
    const clip = createX11Clipboard(runner);
    assert.equal(await clip.available(), true);
    assert.equal(await clip.read(), 'via xclip');
    assert.equal(runner.calls[0].bin, 'xclip');
  });

  test('uses xsel when xclip is absent', async () => {
    const runner = createFakeRunner({
      bins: { 'xsel': 1 },
      responses: { xsel: 'via xsel' },
    });
    assert.equal(await createX11Clipboard(runner).read(), 'via xsel');
    assert.equal(runner.calls[0].bin, 'xsel');
  });
});

describe('auto clipboard adapter', () => {
  test('resolves wayland first on a wayland session', async () => {
    const runner = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1, 'xclip': 1 },
      responses: { 'wl-paste': 'wayland text', 'wl-copy': '' },
    });
    const clip = createAutoClipboard(runner);
    assert.equal((await clip.detect()).name, 'wayland');
    assert.equal(await clip.read(), 'wayland text');
  });

  test('resolves x11 when wayland tools are missing', async () => {
    const runner = createFakeRunner({
      bins: { 'xclip': 1 },
      responses: { xclip: 'x11 text' },
    });
    const clip = createAutoClipboard(runner);
    assert.equal((await clip.detect()).name, 'x11');
    assert.equal(await clip.read(), 'x11 text');
  });

  test('detection is cached, not re-probed on every read', async () => {
    const runner = createFakeRunner({
      bins: { 'wl-paste': 1, 'wl-copy': 1 },
      responses: { 'wl-paste': 'a' },
    });
    const clip = createAutoClipboard(runner);
    await clip.read();
    await clip.read();
    await clip.read();
    assert.equal(await clip.detectName(), 'wayland');
    // Three reads = three wl-paste invocations, nothing more. Detection must
    // not spawn extra probe processes per call.
    assert.equal(runner.calls.filter((c) => c.bin === 'wl-paste').length, 3);
    assert.equal(runner.calls.filter((c) => c.bin === 'wl-copy').length, 0);
  });

  test('throws ClipboardUnavailable when nothing is present', async () => {
    const clip = createAutoClipboard(createFakeRunner({ bins: {} }));
    await assert.rejects(() => clip.read(), ClipboardUnavailable);
  });

  test('honours an explicit backend request', async () => {
    const runner = createFakeRunner({
      bins: { 'xclip': 1 },
      responses: { xclip: 'forced' },
    });
    const clip = createAutoClipboard(runner, 'x11');
    assert.equal(await clip.read(), 'forced');
    assert.equal(await clip.detectName(), 'x11');
  });
});
