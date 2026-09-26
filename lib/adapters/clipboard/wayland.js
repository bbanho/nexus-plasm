// Wayland clipboard adapter: wl-clipboard only. No WM awareness.
export function createWaylandClipboard(runner) {
  return {
    name: 'wayland',

    async available() {
      return Boolean(runner.which('wl-paste')) && Boolean(runner.which('wl-copy'));
    },

    async read() {
      const { stdout } = await runner.run('wl-paste', ['-n']);
      return String(stdout ?? '');
    },

    // Returns true only when the write actually landed. The previous
    // implementation returned from inside a .then() callback, so it always
    // reported failure and still ran every backend in the list.
    async write(text) {
      try {
        await runner.run('wl-copy', [], { input: text });
        return true;
      } catch {
        return false;
      }
    },

    async hasImage() {
      try {
        const { stdout } = await runner.run('wl-paste', ['--list-types']);
        return String(stdout || '').includes('image/');
      } catch {
        return false;
      }
    },
  };
}
