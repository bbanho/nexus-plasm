// Provider port — environment-agnostic contract.
//
// A provider is anything that turns text into text. It knows nothing about
// clipboards, keybindings, or window managers. Adapters own transport and
// credential handling; the core only sees this shape.

/**
 * @typedef {Object} ProviderPort
 * @property {string} name
 * @property {(req: {prompt: string}) => Promise<string>} generate
 * @property {(req: {messages: Array<{role: string, content: string}>}) => Promise<string>} chat
 */

export class ProviderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ProviderError';
    if (cause) this.cause = cause;
  }
}
