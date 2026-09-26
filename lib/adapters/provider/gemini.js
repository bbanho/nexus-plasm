import { postJson } from './http.js';
import { ProviderError } from '../../ports/provider.js';

// Same snake_case/camelCase tolerance as the ollama adapter: config.yaml is
// snake_case, the legacy processor.js was camelCase. One shape on disk, both
// accepted at the boundary.
function normalise(cfg = {}) {
  return {
    baseUrl: cfg.base_url ?? cfg.baseUrl ?? 'https://generativelanguage.googleapis.com',
    model: cfg.default_model ?? cfg.model ?? 'gemini-2.0-flash',
    apiKey: cfg.api_key ?? cfg.apiKey
      ?? (cfg.api_key_env ? process.env[cfg.api_key_env] : undefined)
      ?? process.env.GEMINI_API_KEY,
    timeoutMs: Number(cfg.timeout_ms ?? cfg.timeoutMs ?? 120000),
  };
}

export function createGeminiProvider(cfg = {}) {
  const { baseUrl, model, apiKey, timeoutMs } = normalise(cfg);

  async function call(payload) {
    if (!apiKey) throw new ProviderError('Missing Gemini API key (defina GEMINI_API_KEY)');

    // The key travels in the header ONLY. The previous adapter also wrote
    // `key` into the JSON body, which leaks the secret into proxy and
    // request logs.
    const json = await postJson({
      baseUrl,
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      payload,
      headers: { 'x-goog-api-key': apiKey },
      timeoutMs,
    });

    return String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  }

  return {
    name: 'gemini',
    model,

    generate({ prompt }) {
      return call({ contents: [{ parts: [{ text: prompt }] }], generationConfig: {} });
    },

    chat({ messages }) {
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      return call({ contents, generationConfig: {} });
    },
  };
}
