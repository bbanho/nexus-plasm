import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.config', 'nexus-plasm', 'config.yaml');
const DEFAULT_ENV_PATH = path.join(os.homedir(), '.config', 'nexus-plasm', '.env');

function resolveEnv(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^\$\{(\w+)\}$/);
  if (!m) return value;
  return process.env[m[1]] ?? '';
}

let cached = null;

export async function loadConfig() {
  if (cached) return cached.data;

  let raw = '';
  try {
    raw = await fs.readFile(DEFAULT_CONFIG_PATH, 'utf-8');
  } catch {
    raw = '';
  }

  const trimmed = raw.trim();
  let data = {};
  if (trimmed.startsWith('{')) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      data = {};
    }
  } else if (trimmed.startsWith('max_items:') || trimmed.startsWith('ollama:')) {
    try {
      const mod = await import('yaml');
      data = mod.parse(trimmed);
    } catch {
      data = {};
    }
  } else if (trimmed.length > 0) {
    data = {};
  }

  if (data.ollama?.api_key_env) data.ollama.api_key = resolveEnv(data.ollama.api_key_env);
  if (data.gemini?.api_key_env) data.gemini.api_key = resolveEnv(data.gemini.api_key_env);

  cached = {
    path: DEFAULT_CONFIG_PATH,
    data,
  };
  return cached.data;
}

export function configPath() {
  return DEFAULT_CONFIG_PATH;
}
