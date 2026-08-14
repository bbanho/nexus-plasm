import http from 'node:http';
import https from 'node:https';

function request(url, payload) {
  const mod = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? '443' : '80'),
        path: `${url.pathname}${url.search}`,
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': payload.apiKey,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(json);
          } catch (e) {
            reject(new Error('Invalid JSON from Gemini'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function geminiGenerate({ baseUrl, model, prompt, apiKey, timeoutMs }) {
  const url = new URL(`${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`);
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {},
  };
  if (apiKey) payload.key = apiKey;

  const json = await request(url, payload);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return String(text ?? '');
}

export async function geminiChat({ baseUrl, model, messages, apiKey, timeoutMs }) {
  const url = new URL(`${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`);
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const payload = {
    contents,
    generationConfig: {},
  };
  if (apiKey) payload.key = apiKey;

  const json = await request(url, payload);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return String(text ?? '');
}
