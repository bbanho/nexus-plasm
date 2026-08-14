import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

export async function readText() {
  const candidates = [
    ['wl-paste', '-n'],
    ['xclip', '-selection', 'clipboard', '-o'],
    ['xsel', '--clipboard', '--output'],
  ];

  for (const cmd of candidates) {
    try {
      const { stdout } = await execAsync(cmd.join(' '), { maxBuffer: 50 * 1024 * 1024 });
      if (stdout !== null && stdout !== undefined) {
        return String(stdout);
      }
    } catch {
      continue;
    }
  }
  return '';
}

export async function writeText(text) {
  const s = String(text ?? '');
  const candidates = [
    ['wl-copy'],
    ['xclip', '-selection', 'clipboard'],
    ['xsel', '--clipboard', '--input'],
  ];

  for (const cmd of candidates) {
    await new Promise((resolve) => {
      const child = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'ignore', 'ignore'] });
      child.stdin.write(s);
      child.stdin.end();
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    }).then((ok) => { if (ok) return true; });
  }
  return false;
}

export async function hasImage() {
  const checks = [
    ['wl-paste', '--list-types'],
    ['xclip', '-selection', 'clipboard', '-t', 'TARGETS', '-o'],
  ];
  for (const cmd of checks) {
    try {
      const { stdout } = await execAsync(cmd.join(' '), { maxBuffer: 1024 * 1024 });
      const out = String(stdout || '');
      if (out.includes('image/png') || out.includes('image/')) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function copyImageTo(imagePath) {
  const target = String(imagePath ?? '');
  if (!target) return false;
  try {
    await execAsync(`wl-copy < ${target}`);
    return true;
  } catch {
    return false;
  }
}

export async function pushToCliphist(text) {
  try {
    await execAsync(`echo ${JSON.stringify(text)} | wl-copy`);
    return true;
  } catch {
    return false;
  }
}
