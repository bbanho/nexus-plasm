import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_STACK_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'stack.json');

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

// The FIFO is file-backed state, not a module singleton. The old version kept
// the stack in a mutable module global, so two callers in one process (CLI +
// daemon) shared and clobbered each other's view, and the tests could not run
// in parallel against different paths.
export async function loadStack(stackPath = DEFAULT_STACK_PATH) {
  const raw = await readState(stackPath);
  return raw.items;
}

async function readState(stackPath) {
  try {
    const raw = await fs.readFile(stackPath, 'utf-8');
    const data = JSON.parse(raw);
    return {
      items: Array.isArray(data.items) ? data.items : [],
      maxItems: Number(data.maxItems ?? 50),
      dedupe: data.dedupe ?? true,
    };
  } catch {
    return { items: [], maxItems: 50, dedupe: true };
  }
}

async function writeState(stackPath, state) {
  await ensureDir(stackPath);
  await fs.writeFile(stackPath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function push(item, stackPath = DEFAULT_STACK_PATH) {
  const text = String(item ?? '').trim();
  const state = await readState(stackPath);
  if (!text) return state.items;

  if (state.dedupe && state.items.length > 0 && state.items[0] === text) {
    return state.items;
  }

  state.items.unshift(text);
  if (state.items.length > state.maxItems) state.items.length = state.maxItems;
  await writeState(stackPath, state);
  return state.items;
}

export async function pop(stackPath = DEFAULT_STACK_PATH) {
  const state = await readState(stackPath);
  if (state.items.length === 0) return null;
  const item = state.items.shift();
  await writeState(stackPath, state);
  return item;
}

export async function peek(stackPath = DEFAULT_STACK_PATH) {
  const state = await readState(stackPath);
  return state.items.length > 0 ? state.items[0] : null;
}

export async function list(stackPath = DEFAULT_STACK_PATH) {
  return (await readState(stackPath)).items;
}

export async function clear(stackPath = DEFAULT_STACK_PATH) {
  const state = await readState(stackPath);
  state.items = [];
  await writeState(stackPath, state);
}

export async function size(stackPath = DEFAULT_STACK_PATH) {
  return (await readState(stackPath)).items.length;
}

export async function setMaxItems(n, stackPath = DEFAULT_STACK_PATH) {
  const state = await readState(stackPath);
  state.maxItems = Math.max(1, Math.min(500, Number(n) || 50));
  await writeState(stackPath, state);
  return state.maxItems;
}
