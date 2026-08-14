import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_STACK = [];
let stack = [...DEFAULT_STACK];
let maxItems = 50;
let dedupe = true;

const DEFAULT_STACK_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'stack.json');

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadStack(stackPath = DEFAULT_STACK_PATH) {
  try {
    const raw = await fs.readFile(stackPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.items)) throw new Error('Invalid stack format');
    stack = data.items;
    maxItems = Number(data.maxItems ?? 50);
    dedupe = data.dedupe ?? true;
  } catch (e) {
    await persist(stackPath);
  }
  return stack;
}

async function persist(stackPath = DEFAULT_STACK_PATH) {
  await ensureDir(stackPath);
  await fs.writeFile(stackPath, JSON.stringify({ items: stack, maxItems, dedupe }, null, 2), 'utf-8');
}

export async function push(item, stackPath = DEFAULT_STACK_PATH) {
  const text = String(item ?? '').trim();
  if (!text) return stack;

  if (dedupe && stack.length > 0 && stack[0] === text) {
    return stack;
  }

  stack.unshift(text);
  if (stack.length > maxItems) stack.length = maxItems;
  await persist(stackPath);
  return stack;
}

export async function pop(stackPath = DEFAULT_STACK_PATH) {
  if (stack.length === 0) return null;
  const item = stack.shift();
  await persist(stackPath);
  return item;
}

export async function peek(stackPath = DEFAULT_STACK_PATH) {
  await loadStack(stackPath);
  return stack.length > 0 ? stack[0] : null;
}

export async function list(stackPath = DEFAULT_STACK_PATH) {
  await loadStack(stackPath);
  return [...stack];
}

export async function clear(stackPath = DEFAULT_STACK_PATH) {
  stack = [];
  await persist(stackPath);
}

export async function size(stackPath = DEFAULT_STACK_PATH) {
  await loadStack(stackPath);
  return stack.length;
}

export function setMaxItems(n, stackPath = DEFAULT_STACK_PATH) {
  maxItems = Math.max(1, Math.min(500, Number(n) || 50));
  return persist(stackPath);
}
