import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import { createFakeRunner } from './helpers/fake-runner.js';
import { createOllamaProvider } from '../lib/adapters/provider/ollama.js';
import { createGeminiProvider } from '../lib/adapters/provider/gemini.js';

// A minimal in-process HTTP server stands in for the upstream so we assert on
// what actually goes over the wire (headers, body, timeout) without a network.
import http from 'node:http';

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  // keep-alive sockets outlive server.close() and then get handed to the NEXT
  // test's port, producing a bogus ECONNREFUSED. One transport, one lifecycle.
  server.keepAliveTimeout = 0;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

describe('ollama provider', () => {
  test('generate returns the response field', async () => {
    await withServer(
      (req, res) => {
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ response: 'olá do ollama' }));
        });
      },
      async (baseUrl) => {
        const p = createOllamaProvider({ baseUrl, default_model: 'qwen2.5:7b', timeout_ms: 5000 });
        assert.equal(await p.generate({ prompt: 'oi' }), 'olá do ollama');
      }
    );
  });

  // config.yaml is snake_case; the legacy processor.js was camelCase. The
  // adapter must accept both so an old config never silently talks to the
  // wrong host.
  test('accepts both snake_case and camelCase config keys', async () => {
    let seenModel = null;
    await withServer(
      (req, res) => {
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => {
          seenModel = JSON.parse(body).model;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ response: 'ok' }));
        });
      },
      async (baseUrl) => {
        await createOllamaProvider({ baseUrl, model: 'camel', timeoutMs: 5000 }).generate({ prompt: 'x' });
        assert.equal(seenModel, 'camel');
        await createOllamaProvider({ base_url: baseUrl, default_model: 'snake', timeout_ms: 5000 })
          .generate({ prompt: 'x' });
        assert.equal(seenModel, 'snake');
      }
    );
  });

  // Regression: timeout_ms was accepted by every provider function and then
  // never used, so one hung upstream call froze the process forever.
  test('honours timeout_ms instead of hanging forever', async () => {
    await withServer(
      () => { /* never responds */ },
      async (baseUrl) => {
        const p = createOllamaProvider({ baseUrl, default_model: 'm', timeout_ms: 150 });
        await assert.rejects(() => p.generate({ prompt: 'oi' }), /timed out|timeout/i);
      }
    );
  });
});

describe('gemini provider', () => {
  test('generate returns the first candidate text', async () => {
    await withServer(
      (req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'olá do gemini' }] } }] }));
      },
      async (baseUrl) => {
        const p = createGeminiProvider({
          base_url: baseUrl,
          default_model: 'gemini-2.0-flash',
          api_key: 'secret-key',
          timeout_ms: 5000,
        });
        assert.equal(await p.generate({ prompt: 'oi' }), 'olá do gemini');
      }
    );
  });

  // Regression: the API key was sent BOTH as x-goog-api-key header AND as
  // `key` inside the JSON body, so it landed in proxy logs and traces.
  test('sends the key in the header only, never in the JSON body', async () => {
    let seenHeader = null;
    let seenBody = null;
    await withServer(
      (req, res) => {
        seenHeader = req.headers['x-goog-api-key'] || null;
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => {
          seenBody = body;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
        });
      },
      async (baseUrl) => {
        const p = createGeminiProvider({
          base_url: baseUrl,
          default_model: 'gemini-2.0-flash',
          api_key: 'secret-key',
          timeout_ms: 5000,
        });
        await p.generate({ prompt: 'segredo' });
      }
    );
    assert.equal(seenHeader, 'secret-key');
    assert.equal(seenBody.includes('secret-key'), false, 'key must not appear in the request body');
  });

  test('refuses to build a request without a key', async () => {
    const p = createGeminiProvider({ base_url: 'http://x', default_model: 'm', timeout_ms: 100 });
    await assert.rejects(() => p.generate({ prompt: 'x' }), /key/i);
  });

  test('honours timeout_ms', async () => {
    await withServer(
      () => { /* never responds */ },
      async (baseUrl) => {
        const p = createGeminiProvider({
          base_url: baseUrl,
          default_model: 'm',
          api_key: 'k',
          timeout_ms: 150,
        });
        await assert.rejects(() => p.generate({ prompt: 'x' }), /timed out|timeout/i);
      }
    );
  });
});

describe('runner injection', () => {
  test('fake runner records calls for adapter-level assertions', async () => {
    const runner = createFakeRunner({ bins: { echo: 1 }, responses: { echo: 'oi' } });
    assert.equal((await runner.run('echo', ['x'])).stdout, 'oi');
    assert.equal(runner.calls[0].bin, 'echo');
  });
});
