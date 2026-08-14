import http from 'node:http';

export async function ollamaGenerate({ baseUrl, model, prompt, timeoutMs }) {
  const url = new URL('/api/generate', baseUrl || 'http://localhost:11434');
  const payload = JSON.stringify({ model, prompt, stream: false });

  const result = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || '80',
        path: url.pathname,
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(json.response || '');
          } catch (e) {
            reject(new Error('Invalid JSON from Ollama'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  return String(result);
}

export async function ollamaChat({ baseUrl, model, messages, timeoutMs }) {
  const url = new URL('/api/chat', baseUrl || 'http://localhost:11434');
  const payload = JSON.stringify({ model, messages, stream: false });

  const result = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || '80',
        path: url.pathname,
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(json.message?.content || '');
          } catch (e) {
            reject(new Error('Invalid JSON from Ollama'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  return String(result);
}
