import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'share', 'nexus-plasm');
const DEFAULT_MACROS_FILE = path.join(DEFAULT_STATE_DIR, 'macros.json');
const DEFAULT_LEARNED_FILE = path.join(DEFAULT_STATE_DIR, 'learned.json');

async function ensureStateDir() {
  await fs.mkdir(DEFAULT_STATE_DIR, { recursive: true });
}

export async function loadMacros() {
  try {
    const raw = await fs.readFile(DEFAULT_MACROS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.macros)) throw new Error('Invalid macros format');
    return data.macros;
  } catch {
    return [];
  }
}

export async function saveMacros(macros) {
  await ensureStateDir();
  const data = { macros, updated_at: new Date().toISOString() };
  await fs.writeFile(DEFAULT_MACROS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function addMacro(macro) {
  const macros = await loadMacros();
  const item = {
    id: `macro_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    ...macro,
  };
  macros.unshift(item);
  await saveMacros(macros);
  return item;
}

export async function loadLearned() {
  try {
    const raw = await fs.readFile(DEFAULT_LEARNED_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.events)) throw new Error('Invalid learned format');
    return data.events;
  } catch {
    return [];
  }
}

export async function appendLearned(event) {
  const events = await loadLearned();
  events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    ...event,
  });
  await fs.writeFile(DEFAULT_LEARNED_FILE, JSON.stringify({ events, updated_at: new Date().toISOString() }, null, 2), 'utf-8');
}

export async function suggestMacros() {
  const events = await loadLearned();
  const macros = await loadMacros();
  const existing = new Set(macros.map(m => `${m.trigger}:${m.action}`));
  const suggestions = [];

  // Rule 1: high-frequency push+process pairs
  const counts = new Map();
  for (const e of events) {
    if (e.type === 'chain' && e.from === 'push' && e.to === 'process') {
      const key = `${e.preset || 'fix-pt'}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  for (const [preset, count] of counts.entries()) {
    const trigger = `super+x_auto_${preset}`;
    const action = `process --preset ${preset}`;
    if (!existing.has(`${trigger}:${action}`) && count >= 3) {
      suggestions.push({ trigger, action, reason: `Alta frequência: ${count} ocorrências`, preset });
    }
  }

  // Rule 2: frequent paste-all after process-all
  let paCount = 0;
  for (const e of events) {
    if (e.type === 'chain' && e.from === 'process-all' && e.to === 'paste-all') paCount += 1;
  }
  if (paCount >= 2) {
    const trigger = 'super+alt+v_auto_process';
    const action = 'process-all --preset fix-pt && paste-all';
    if (!existing.has(`${trigger}:${action}`)) {
      suggestions.push({ trigger, action, reason: `Combo frequente: ${paCount} ocorrências`, preset: 'fix-pt' });
    }
  }

  return suggestions;
}
