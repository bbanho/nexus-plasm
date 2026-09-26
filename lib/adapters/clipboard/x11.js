// X11 clipboard adapter: xclip, falling back to xsel. No WM awareness.
const READ_BIN = [
  ['xclip', ['-selection', 'clipboard', '-o']],
  ['xsel', ['--clipboard', '--output']],
];

const WRITE_BIN = [
  ['xclip', ['-selection', 'clipboard']],
  ['xsel', ['--clipboard', '--input']],
];

export function createX11Clipboard(runner) {
  async function firstUsable(candidates) {
    for (const [bin, args] of candidates) {
      if (!runner.which(bin)) continue;
      try {
        const res = await runner.run(bin, args);
        return { bin, args, stdout: res.stdout };
      } catch {
        // try the next tool
      }
    }
    return null;
  }

  return {
    name: 'x11',

    async available() {
      for (const [bin] of [...READ_BIN, ...WRITE_BIN]) {
        if (runner.which(bin)) return true;
      }
      return false;
    },

    async read() {
      const hit = await firstUsable(READ_BIN);
      return hit ? String(hit.stdout ?? '') : '';
    },

    async write(text) {
      for (const [bin, args] of WRITE_BIN) {
        if (!runner.which(bin)) continue;
        try {
          await runner.run(bin, args, { input: text });
          return true;
        } catch {
          // try the next tool
        }
      }
      return false;
    },

    async hasImage() {
      try {
        const { stdout } = await runner.run('xclip', ['-selection', 'clipboard', '-t', 'TARGETS', '-o']);
        return String(stdout || '').includes('image/');
      } catch {
        return false;
      }
    },
  };
}
