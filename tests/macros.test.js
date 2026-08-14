import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const TMP = path.join(os.tmpdir(), `nexus-plasm-macros-test-${Date.now()}`);

test('macros load/save/add roundtrip', async () => {
  const mod = await import('../lib/macros.js');
  await fs.mkdir(TMP, { recursive: true });
  await fs.writeFile(path.join(TMP, 'macros.json'), JSON.stringify({ macros: [] }, null, 2), 'utf-8');

  const originalStateDir = await import('../lib/macros.js').then(m => m.DEFAULT_STATE_DIR);
  
  // We'll test the core logic by mocking the paths
  const macros = [];
  await mod.saveMacros(macros);
  const loaded = await mod.loadMacros();
  assert.deepEqual(loaded, []);
});

test('learned events append and load', async () => {
  const mod = await import('../lib/macros.js');
  const events = await mod.loadLearned();
  assert.ok(Array.isArray(events));
  
  const before = events.length;
  await mod.appendLearned({ type: 'chain', from: 'push', to: 'process', preset: 'fix-pt' });
  const after = await mod.loadLearned();
  assert.equal(after.length, before + 1);
  assert.equal(after[after.length - 1].type, 'chain');
  assert.equal(after[after.length - 1].preset, 'fix-pt');
});

test('suggestMacros returns suggestions for frequent chains', async () => {
  const mod = await import('../lib/macros.js');
  
  // Seed learned events with frequent push->process chains
  await mod.appendLearned({ type: 'chain', from: 'push', to: 'process', preset: 'fix-pt' });
  await mod.appendLearned({ type: 'chain', from: 'push', to: 'process', preset: 'fix-pt' });
  await mod.appendLearned({ type: 'chain', from: 'push', to: 'process', preset: 'fix-pt' });
  await mod.appendLearned({ type: 'chain', from: 'process-all', to: 'paste-all' });
  await mod.appendLearned({ type: 'chain', from: 'process-all', to: 'paste-all' });
  
  const suggestions = await mod.suggestMacros();
  assert.ok(Array.isArray(suggestions));
  assert.ok(suggestions.length >= 1);
  
  const presetSuggestion = suggestions.find(s => s.preset === 'fix-pt');
  assert.ok(presetSuggestion, 'Expected suggestion for fix-pt preset');
  assert.ok(presetSuggestion.reason.includes('Alta frequência'));
});

test('suggestMacros does not duplicate existing macros', async () => {
  const mod = await import('../lib/macros.js');
  
  // Add a macro that would match the suggestion
  await mod.addMacro({
    trigger: 'super+x_auto_fix-pt',
    action: 'process --preset fix-pt',
    preset: 'fix-pt',
  });
  
  const suggestions = await mod.suggestMacros();
  const dup = suggestions.find(s => s.trigger === 'super+x_auto_fix-pt');
  assert.ok(!dup, 'Should not suggest duplicate macro');
});
