import { ollamaGenerate, ollamaChat } from './ollama.js';
import { geminiGenerate, geminiChat } from './gemini.js';

export async function processWithOllama({ text, preset, config }) {
  const c = config?.ollama || {};
  if (preset === 'chat') {
    return ollamaChat({
      baseUrl: c.base_url,
      model: c.default_model,
      messages: [{ role: 'user', content: text }],
      timeoutMs: c.timeout_ms,
    });
  }
  const prompt = preset ? `${preset}\n\n${text}` : text;
  return ollamaGenerate({
    baseUrl: c.base_url,
    model: c.default_model,
    prompt,
    timeoutMs: c.timeout_ms,
  });
}

export async function processWithGemini({ text, preset, config }) {
  const c = config?.gemini || {};
  const apiKey = c.api_key || process.env.GEMINI_API_KEY || process.env[c.api_key_env];
  if (!apiKey) {
    throw new Error('Missing Gemini API key');
  }

  if (preset === 'chat') {
    return geminiChat({
      baseUrl: c.base_url,
      model: c.default_model,
      messages: [{ role: 'user', content: text }],
      apiKey,
      timeoutMs: c.timeout_ms,
    });
  }

  const prompt = preset ? `${preset}\n\n${text}` : text;
  return geminiGenerate({
    baseUrl: c.base_url,
    model: c.default_model,
    prompt,
    apiKey,
    timeoutMs: c.timeout_ms,
  });
}

export async function process({ text, preset, config }) {
  if (!text) return '';
  const provider = (config?.default_llm || 'ollama').toLowerCase();

  if (provider === 'gemini') {
    return processWithGemini({ text, preset, config });
  }
  return processWithOllama({ text, preset, config });
}
