import { createOllamaProvider } from '../adapters/provider/ollama.js';
import { createGeminiProvider } from '../adapters/provider/gemini.js';

// Preset composition lives here; transport lives in the adapters. The core
// only ever sees a provider name and text.
const FACTORIES = {
  ollama: createOllamaProvider,
  gemini: createGeminiProvider,
};

export function createProcessor(config = {}) {
  const defaultProvider = (config.default_llm || 'ollama').toLowerCase();

  async function providerFor(name) {
    const key = (name || defaultProvider).toLowerCase();
    const factory = FACTORIES[key];
    if (!factory) {
      throw new Error(`Provider desconhecido: ${name} (disponíveis: ${Object.keys(FACTORIES).join(', ')})`);
    }
    return factory(config[key] || {});
  }

  return {
    defaultProvider,

    async process({ text, preset, provider }) {
      if (!text) return '';

      const p = await providerFor(provider);
      const messages = [{ role: 'user', content: text }];

      if (preset === 'chat') return p.chat({ messages });

      const prompt = preset ? `${preset}\n\n${text}` : text;
      return p.generate({ prompt });
    },
  };
}

// Back-compat shim for the original named export.
export async function process({ text, preset, config }) {
  return createProcessor(config).process({ text, preset });
}
