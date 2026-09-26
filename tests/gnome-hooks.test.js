#!/usr/bin/env node
// Contract tests for plugins/gnome/plasm-gnome-hooks.
//
// The script mutates real GNOME dconf settings, so these tests read the script's
// own declarations instead of executing it: the invariant worth protecting is
// which accelerators get installed, not gsettings' behaviour.

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'plugins', 'gnome', 'plasm-gnome-hooks');
const source = fs.readFileSync(SCRIPT, 'utf-8');

function hookBlock() {
  const m = source.match(/HOOKS=\(([\s\S]*?)\n\)/);
  assert.ok(m, 'HOOKS array must exist in the hooks script');
  return m[1];
}

function entries() {
  return hookBlock()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'))
    .map((l) => l.replace(/^"|"$/g, '').split('|'));
}

describe('gnome hooks script', () => {
  test('declares every plasm action users need', () => {
    const actions = entries().map((e) => e[2]);
    for (const expected of ['push', 'pop', 'process --preset fix-pt', 'paste-all']) {
      assert.ok(actions.includes(expected), `missing hook for '${expected}'`);
    }
  });

  // Regression (B12): a bare <Control>c global seizes Copy in every focused
  // application on GNOME. Only Super-based chords may be installed.
  test('never binds a bare <Control> chord', () => {
    for (const [name, accel] of entries()) {
      assert.ok(
        !/<Control>(?!<)/.test(accel),
        `hook '${name}' binds bare <Control> (${accel}); that breaks Copy app-wide`
      );
    }
  });

  test('all accelerators start with Super', () => {
    for (const [name, accel] of entries()) {
      assert.ok(accel.startsWith('<Super>'), `hook '${name}' must be Super-prefixed: ${accel}`);
    }
  });

  test('hook names are unique', () => {
    const names = entries().map((e) => e[0]);
    assert.equal(new Set(names).size, names.length, 'duplicate hook names would fight over a slot');
  });

  test('accelerators are unique', () => {
    const accels = entries().map((e) => e[1]);
    const dupes = accels.filter((a, i) => accels.indexOf(a) !== i);
    assert.deepEqual(dupes, [], 'duplicate accelerators would silently shadow each other');
  });

  test('is dry-run by default — no write without --apply', () => {
    assert.ok(source.includes('--apply'), 'must gate writes behind --apply');
    assert.ok(source.includes('--rollback'), 'must offer rollback');
    assert.ok(source.includes('backup'), 'must write a backup before mutating');
  });

  test('uses the stable custom-keybindings schema, not a shell addon', () => {
    assert.ok(
      source.includes('org.gnome.settings-daemon.plugins.media-keys.custom-keybindings'),
      'must use the dconf keybinding schema'
    );
    // Regression: imports.misc.extensionUtils was removed in GNOME 45+; an
    // addon approach breaks on every shell release.
    assert.equal(source.includes('extensionUtils'), false);
  });
});
