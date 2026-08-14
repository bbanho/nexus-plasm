import yaml from 'yaml';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.config', 'nexus-plasm', 'config.yaml');
const DEFAULT_ENV_PATH = path.join(os.homedir(), '.config', 'nexus-plasm', '.env');

let cached = null;

function resolveEnv(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^\$\{(\w+)\}$/);
  if (!m) return value;
  return process.env[m[1]] ?? '';
}

export async function loadConfig() {
  if (cached) return cached;

  let raw = '';
  try {
    raw = await fs.readFile(DEFAULT_CONFIG_PATH, 'utf-8');
  } catch {
    raw = fs.readFileSync(path.join(process.cwd(), 'config', 'config.yaml'), 'utf-8');
  }

  const doc = yaml.parse(raw);
  if (doc.ollama?.api_key_env) doc.ollama.api_key = resolveEnv(doc.ollama.api_key_env);
  if (doc.gemini?.api_key_env) doc.gemini.api_key = resolveEnv(doc.gemini.api_key_env);

  cached = {
    path: DEFAULT_CONFIG_PATH,
    data: doc,
  };
  return cached.data;
}

export function configPath() {
  return DEFAULT_CONFIG_PATH;
}
