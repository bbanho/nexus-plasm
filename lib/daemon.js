import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const DEFAULT_STACK_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'stack.json');
const DEFAULT_LOG_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'logs', 'plasm.log');

function timestamp() {
  return new Date().toISOString();
}

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function appendLog(message, logPath = DEFAULT_LOG_PATH) {
  try {
    await ensureDir(logPath);
    const line = `[${timestamp()}] ${message}\n`;
    await fs.appendFile(logPath, line, 'utf-8');
  } catch {
    // ignore log errors
  }
}

export async function startWatch(options = {}) {
  const stackPath = options.stackPath || DEFAULT_STACK_PATH;
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const pollIntervalMs = Number(options.pollIntervalMs || 1000);
  const quiet = Boolean(options.quiet);

  await ensureDir(stackPath);
  await ensureDir(logPath);

  let lastText = '';
  let debounceTimer = null;
  const DEBOUNCE_MS = 300;

  async function loadStack() {
    try {
      const raw = await fs.readFile(stackPath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  }

  async function pushToStack(text) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return;

    const items = await loadStack();
    const dedupe = true; // default for daemon
    if (dedupe && items.length > 0 && items[0] === trimmed) {
      if (!quiet) console.log('[watch] dedup: skipped duplicate');
      return;
    }

    items.unshift(trimmed);
    const maxItems = 50;
    if (items.length > maxItems) items.length = maxItems;

    await fs.writeFile(stackPath, JSON.stringify({ items, maxItems, dedupe }, null, 2), 'utf-8');
    if (!quiet) console.log(`[watch] pushed: ${trimmed.slice(0, 80)}`);
    await appendLog(`PUSH ${trimmed.slice(0, 120)}`, logPath);
  }

  async function readCurrentText() {
    const candidates = [
      ['wl-paste', '-n'],
      ['xclip', '-selection', 'clipboard', '-o'],
      ['xsel', '--clipboard', '--output'],
    ];

    for (const cmd of candidates) {
      try {
        const { spawn } = await import('node:child_process');
        const child = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        
        await new Promise((resolve) => {
          child.on('close', (code) => resolve(code === 0 ? stdout : null));
          child.on('error', () => resolve(null));
        });
        
        if (stdout !== null && stdout !== undefined && String(stdout).length > 0) {
          return String(stdout);
        }
      } catch {
        continue;
      }
    }
    return '';
  }

  async function poll() {
    try {
      const current = await readCurrentText();
      if (current && current !== lastText) {
        lastText = current;
        
        // Debounce
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const finalText = await readCurrentText();
          if (finalText && finalText === lastText) {
            await pushToStack(finalText);
          }
        }, DEBOUNCE_MS);
      }
    } catch (e) {
      await appendLog(`ERROR ${e?.message || e}`, logPath);
    }
  }

  const interval = setInterval(poll, pollIntervalMs);
  
  if (!quiet) {
    console.log(`[watch] started (interval=${pollIntervalMs}ms, stack=${stackPath})`);
  }
  await appendLog('WATCH_STARTED', logPath);

  const shutdown = async () => {
    clearInterval(interval);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!quiet) console.log('\n[watch] stopped');
    await appendLog('WATCH_STOPPED', logPath);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Initial poll
  await poll();
}

export async function stopWatch(options = {}) {
  const pidFile = options.pidFile || path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'plasm-watch.pid');
  
  try {
    const raw = await fs.readFile(pidFile, 'utf-8');
    const pid = Number(raw.trim());
    
    if (!Number.isFinite(pid) || pid <= 0) {
      console.log('Invalid PID file');
      return;
    }

    // Try graceful shutdown
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`Stopping watch (PID ${pid})...`);
      
      // Wait for process to stop
      await new Promise((resolve) => {
        const check = setInterval(() => {
          try {
            process.kill(pid, 0); // Check if process exists
          } catch {
            clearInterval(check);
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(check);
          resolve();
        }, 2000);
      });
      
      await fs.unlink(pidFile).catch(() => {});
      console.log('Watch stopped');
    } catch (e) {
      console.log(`Watch process ${pid} not running or already stopped`);
      await fs.unlink(pidFile).catch(() => {});
    }
  } catch {
    console.log('No watch PID file found');
  }
}
