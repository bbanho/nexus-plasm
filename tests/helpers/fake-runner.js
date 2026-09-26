// Injectable process runner for tests. Clipboard adapters receive a runner so
// every path is exercised without a real display server or clipboard.
export function createFakeRunner({ bins = {}, responses = {} } = {}) {
  const calls = [];

  return {
    calls,
    which(bin) {
      return Boolean(bins[bin]);
    },
    async run(bin, args = [], opts = {}) {
      calls.push({ bin, args, input: opts.input });

      if (!(bin in responses)) {
        const err = new Error(`ENOENT: ${bin}`);
        err.code = 'ENOENT';
        throw err;
      }

      const spec = responses[bin];
      const value = typeof spec === 'function' ? spec({ bin, args, input: opts.input }) : spec;
      if (value && value.__throw) {
        throw new Error(value.__throw);
      }
      return { stdout: value ?? '', code: 0 };
    },
  };
}
