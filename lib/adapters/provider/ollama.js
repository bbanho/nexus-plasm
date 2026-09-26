import { postJson } from './http.js';

// config.yaml speaks snake_case (base_url/default_model/timeout_ms) but the
// original processor.js passed camelCase to these functions. Normalise here
// so both call styles keep working and only one shape is stored in config.
function normalise(cfg = {}) {
  return {
    baseUrl: cfg.base_url ?? cfg.baseUrl ?? 'http://localhost:11434',
    model: cfg.default_model ?? cfg.model ?? 'qwen2.5:7b',
    timeoutMs: Number(cfg.timeout_ms ?? cfg.timeoutMs ?? 120000),
  };
}

export function createOllamaProvider(cfg = {}) {
  const { baseUrl, model, timeoutMs } = normalise(cfg);

  return {
    name: 'ollama',
    model,

    async generate({ prompt }) {
      const json = await postJson({
        baseUrl,
        path: '/api/generate',
        payload: { model, prompt, stream: false },
        timeoutMs,
      });
      return String(json?.response ?? '');
    },

    async chat({ messages }) {
      const json = await postJson({
        baseUrl,
        path: '/api/chat',
        payload: { model, messages, stream: false },
        timeoutMs,
      });
      return String(json?.message?.content ?? '');
    },
  };
}
