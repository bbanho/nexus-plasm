import { createRunner } from './runner.js';
import { createWaylandClipboard } from './wayland.js';
import { createX11Clipboard } from './x11.js';
import { ClipboardUnavailable } from '../../ports/clipboard.js';

// Resolving clipboard adapter. Detection happens once and is cached for the
// lifetime of the instance, so the daemon does not re-probe the display server
// on every poll.

const FACTORIES = [
  ['wayland', createWaylandClipboard],
  ['x11', createX11Clipboard],
];

export function createAutoClipboard(runner = createRunner(), requested = null) {
  let resolved = null;
  let resolving = null;

  async function detect() {
    if (requested) {
      const factory = FACTORIES.find(([name]) => name === requested);
      if (!factory) {
        throw new ClipboardUnavailable(`Backend de clipboard desconhecido: ${requested}`);
      }
      const adapter = factory[1](runner);
      if (await adapter.available()) return adapter;
      throw new ClipboardUnavailable(`Backend de clipboard '${requested}' indisponível neste host`);
    }

    for (const [name, factory] of FACTORIES) {
      const adapter = factory(runner);
      if (await adapter.available()) return adapter;
    }

    throw new ClipboardUnavailable(
      'Nenhum backend de clipboard disponível (instale wl-clipboard ou xclip)'
    );
  }

  async function ensure() {
    if (resolved) return resolved;
    if (!resolving) {
      resolving = detect().finally(() => { resolving = null; });
    }
    resolved = await resolving;
    return resolved;
  }

  return {
    async detectName() {
      return (await ensure()).name;
    },
    async detect() {
      return ensure();
    },
    async available() {
      try {
        await ensure();
        return true;
      } catch {
        return false;
      }
    },
    async read() {
      return (await ensure()).read();
    },
    async write(text) {
      return (await ensure()).write(text);
    },
    async hasImage() {
      return (await ensure()).hasImage();
    },
  };
}
