import http from 'node:http';
import https from 'node:https';

import { ProviderError } from '../../ports/provider.js';

// Shared JSON transport for OpenAI-style upstreams. The timeout is enforced
// here, once, so no provider can forget it: the old adapters accepted
// timeout_ms and silently dropped it, hanging the daemon on a dead upstream.
export function postJson({ baseUrl, path: reqPath, payload, headers = {}, timeoutMs = 120000 }) {
  const url = new URL(reqPath, baseUrl);
  const mod = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: { 'content-type': 'application/json', ...headers },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new ProviderError(`Resposta inválida do provider (HTTP ${res.statusCode})`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new ProviderError(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (e) => {
      reject(e instanceof ProviderError ? e : new ProviderError(e.message, e));
    });

    req.write(body);
    req.end();
  });
}
