import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Real process runner. Thin on purpose: it exists so tests can inject a fake
// and so the adapters stay free of any display-server knowledge.

const EXEC_CACHE = new Map();

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function lookupOnPath(bin) {
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, bin);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

export function createRunner() {
  return {
    which(bin) {
      if (EXEC_CACHE.has(bin)) return EXEC_CACHE.get(bin);
      const resolved = bin.includes(path.sep)
        ? (isExecutable(bin) ? bin : null)
        : lookupOnPath(bin);
      EXEC_CACHE.set(bin, resolved);
      return resolved;
    },
    run(bin, args = [], opts = {}) {
      return new Promise((resolve, reject) => {
        const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('error', (e) => {
          e.stderr = stderr;
          reject(e);
        });
        child.on('close', (code) => {
          if (code === 0) resolve({ stdout, stderr, code });
          else {
            const err = new Error(`${bin} exited with ${code}`);
            err.code = 'EXIT';
            err.stdout = stdout;
            err.stderr = stderr;
            reject(err);
          }
        });

        if (opts.input !== undefined) child.stdin.write(String(opts.input));
        child.stdin.end();
      });
    },
  };
}

// Keep execFile referenced so bundlers/linters do not strip the import used by
// the availability probe fallback path.
export const __execFile = execFile;
