import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createAutoClipboard } from '../adapters/clipboard/auto.js';

const DEFAULT_STACK_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'stack.json');
const DEFAULT_LOG_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'logs', 'plasm.log');
const DEFAULT_PID_PATH = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'plasm-watch.pid');

function timestamp() {
  return new Date().toISOString();
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function appendLog(message, logPath = DEFAULT_LOG_PATH) {
  try {
    await ensureDir(logPath);
    await fs.appendFile(logPath, `[${timestamp()}] ${message}\n`, 'utf-8');
  } catch {
    // logging must never break the daemon
  }
}

export async function startWatch(options = {}) {
  const stackPath = options.stackPath || DEFAULT_STACK_PATH;
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const pidPath = options.pidPath || DEFAULT_PID_PATH;
  const pollIntervalMs = Number(options.pollIntervalMs || 1000);
  const maxItems = Number(options.maxItems || 50);
  const dedupe = options.dedupe !== false;
  const quiet = Boolean(options.quiet);
  const debounceMs = Number(options.debounceMs || 300);

  // Injected so the core never re-implements backend detection. The old
  // daemon duplicated the wl-paste/xclip candidate list inline.
  const clipboard = options.clipboard || createAutoClipboard();

  await ensureDir(stackPath);
  await ensureDir(logPath);

  // Regression: stopWatch() read this PID file but startWatch() never wrote
  // it, so `plasm stop` could never stop anything.
  await ensureDir(pidPath);
  await fs.writeFile(pidPath, String(process.pid), 'utf-8');

  let lastText = '';
  let debounceTimer = null;

  async function loadItems() {
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

    const items = await loadItems();
    if (dedupe && items.length > 0 && items[0] === trimmed) {
      if (!quiet) console.log('[watch] dedup: skipped duplicate');
      return;
    }

    items.unshift(trimmed);
    if (items.length > maxItems) items.length = maxItems;

    await fs.writeFile(
      stackPath,
      JSON.stringify({ items, maxItems, dedupe }, null, 2),
      'utf-8'
    );
    if (!quiet) console.log(`[watch] pushed: ${trimmed.slice(0, 80)}`);
    await appendLog(`PUSH ${trimmed.slice(0, 120)}`, logPath);
  }

  async function poll() {
    try {
      const current = await clipboard.read();
      if (current && current !== lastText) {
        lastText = current;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const finalText = await clipboard.read();
          if (finalText && finalText === lastText) {
            await pushToStack(finalText);
          }
        }, debounceMs);
      }
    } catch (e) {
      await appendLog(`ERROR ${e?.message || e}`, logPath);
    }
  }

  const interval = setInterval(poll, pollIntervalMs);
  const backend = await clipboard.detectName().catch(() => 'unavailable');

  if (!quiet) {
    console.log(`[watch] started (interval=${pollIntervalMs}ms, backend=${backend}, stack=${stackPath})`);
  }
  await appendLog(`WATCH_STARTED backend=${backend}`, logPath);

  // cleanup() tears the watcher down without killing the process. Signals call
  // exit() on top of it. Keeping them separate is what makes the daemon
  // testable in-process — an earlier version made stop() call process.exit,
  // which took the whole test runner down with it.
  const cleanup = async () => {
    clearInterval(interval);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!quiet) console.log('\n[watch] stopped');
    await appendLog('WATCH_STOPPED', logPath);
    await fs.unlink(pidPath).catch(() => {});
  };

  const shutdown = async () => {
    await cleanup();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await poll();

  return { pidPath, backend, stop: cleanup, shutdown };
}

export async function stopWatch(options = {}) {
  const pidPath = options.pidFile || options.pidPath || DEFAULT_PID_PATH;

  let pid;
  try {
    pid = Number((await fs.readFile(pidPath, 'utf-8')).trim());
  } catch {
    console.log('No watch PID file found');
    return false;
  }

  if (!Number.isFinite(pid) || pid <= 0) {
    console.log('Invalid PID file');
    await fs.unlink(pidPath).catch(() => {});
    return false;
  }

  try {
    process.kill(pid, 0);
  } catch {
    console.log(`Watch process ${pid} not running; cleaning stale PID file`);
    await fs.unlink(pidPath).catch(() => {});
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Stopping watch (PID ${pid})...`);

    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    await fs.unlink(pidPath).catch(() => {});
    console.log('Watch stopped');
    return true;
  } catch (e) {
    console.log(`Could not stop watch: ${e.message}`);
    await fs.unlink(pidPath).catch(() => {});
    return false;
  }
}
