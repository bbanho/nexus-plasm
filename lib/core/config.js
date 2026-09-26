import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.config', 'nexus-plasm', 'config.yaml');

// Bug (B13): config/config.yaml documents paths as ~/... and .local/share/...
// A literal '~' is not expanded by path.join, so the stack was created inside
// the CWD as './~/.local/share/nexus-plasm/stack.json'. Invisible while B7 kept
// the config from loading at all.
export function expandPath(p) {
  if (typeof p !== 'string' || !p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p.startsWith('$HOME/')) return path.join(os.homedir(), p.slice(6));
  if (p.startsWith('${HOME}/')) return path.join(os.homedir(), p.slice(8));
  return path.resolve(p);
}

// Read + parse only. Pure with respect to the given path, which is what makes
// it testable; loadConfig() below adds the default-path caching.
export async function loadConfigFrom(filePath = DEFAULT_CONFIG_PATH) {
  let raw = '';
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return {};
  }

  const trimmed = raw.trim();
  if (!trimmed) return {};

  let data = {};

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      return {};
    }
  } else {
    // Always try YAML. The old code sniffed the first line and gave up
    // otherwise, so any config not starting with 'max_items:'/'ollama:' was
    // silently dropped to {}.
    try {
      const mod = await import('yaml');
      const parsed = mod.parse(trimmed);
      data = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  for (const provider of ['ollama', 'gemini']) {
    const p = data[provider];
    if (!p || typeof p !== 'object') continue;

    // api_key_env holds the NAME of an env var (gemini-2.x style:
    //   api_key_env: GEMINI_API_KEY). The ${VAR} form is also accepted.
    if (p.api_key_env && !p.api_key) {
      const name = String(p.api_key_env).replace(/^\$\{(\w+)\}$/, '$1');
      p.api_key = process.env[name] ?? '';
    }
  }

  // Every user-supplied path is expanded here, once, so no consumer has to
  // remember to (B13).
  if (data.paths && typeof data.paths === 'object') {
    for (const key of Object.keys(data.paths)) {
      data.paths[key] = expandPath(data.paths[key]);
    }
  }

  return data;
}

let cached = null;

export async function loadConfig() {
  if (cached) return cached;
  cached = await loadConfigFrom(DEFAULT_CONFIG_PATH);
  return cached;
}

export function resetConfigCache() {
  cached = null;
}

export function configPath() {
  return DEFAULT_CONFIG_PATH;
}
