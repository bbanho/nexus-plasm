#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const LIB = path.join(__dirname, '..', 'lib');
const STATE_DIR = path.join(os.homedir(), '.local', 'share', 'nexus-plasm');
const STACK_FILE = path.join(STATE_DIR, 'stack.json');
const LOG_FILE = path.join(STATE_DIR, 'logs', 'plasm.log');

function usage() {
  console.log(`
nexus-plasm — clipboard FIFO + LLM processor (agnóstico a ambiente)

Uso:
  plasm push                        Insere o clipboard atual na pilha FIFO
  plasm pop                         Cola o último item
  plasm peek                        Mostra o último item sem remover
  plasm list                        Mostra a pilha atual
  plasm clear                       Limpa a pilha
  plasm process --preset fix-pt     Processa o último item e substitui pelo resultado
  plasm process-all --preset fix-pt Processa todos os itens e substitui pelo resultado
  plasm paste-all                   Cola todo o conteúdo concatenado
  plasm status                      Mostra pilha, backend de clipboard e provider ativo
  plasm doctor                      Diagnóstico de ambiente (sem alterar nada)
  plasm macro                       Lista macros registradas
  plasm macro-add --trigger NOME --action "plasm ..."
  plasm macro-suggest               Sugere macros com base no cache de uso
  plasm daemon [--quiet]            Inicia monitoramento automático do clipboard
  plasm stop                        Para o daemon em execução
  plasm --help

Opções:
  --provider <nome>   ollama|gemini — sobrescreve o provedor padrão
  --model <modelo>    sobrescreve o modelo do provedor
  --preset <nome>     preset de transformação
  --clipboard <nome>  wayland|x11 — força um backend (padrão: auto)
  --quiet             modo silencioso (daemon)
`);
}

function parseCli(argv) {
  if (!argv?.length || argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
    return { command: 'help' };
  }

  const command = argv[0];
  const rest = argv.slice(1);
  const opts = {};

  const withValue = new Set(['--provider', '--model', '--preset', '--clipboard', '--trigger', '--action']);

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (withValue.has(token)) {
      if (rest[i + 1] === undefined) {
        console.error(`Opção ${token} exige um valor.`);
        process.exit(1);
      }
      opts[token.slice(2)] = rest[i + 1];
      i += 1;
    } else if (token === '--all' || token === '-a') {
      opts.all = true;
    } else if (token === '--quiet' || token === '-q') {
      opts.quiet = true;
    } else if (token.startsWith('--')) {
      console.error(`Opção desconhecida: ${token}`);
      process.exit(1);
    }
  }

  return { command, opts };
}

async function main() {
  const { command, opts } = parseCli(process.argv.slice(2));
  if (command === 'help') {
    usage();
    return;
  }

  const { loadConfig } = await import(path.join(LIB, 'core', 'config.js'));
  const { createAutoClipboard } = await import(path.join(LIB, 'adapters', 'clipboard', 'auto.js'));
  const stack = await import(path.join(LIB, 'core', 'stack.js'));
  const { createProcessor } = await import(path.join(LIB, 'core', 'processor.js'));
  const { startWatch, stopWatch } = await import(path.join(LIB, 'core', 'daemon.js'));
  const macros = await import(path.join(LIB, 'core', 'macros.js'));

  const config = await loadConfig();
  const effectiveConfig = { ...config };

  if (opts.provider) effectiveConfig.default_llm = opts.provider;
  if (opts.model) {
    const key = (opts.provider || effectiveConfig.default_llm || 'ollama').toLowerCase();
    effectiveConfig[key] = { ...(effectiveConfig[key] || {}), default_model: opts.model };
  }

  const stackPath = effectiveConfig.paths?.stack_file || STACK_FILE;
  const logPath = effectiveConfig.paths?.log_file || LOG_FILE;
  const pidPath = path.join(STATE_DIR, 'plasm-watch.pid');

  const clipboard = createAutoClipboard(undefined, opts.clipboard || null);
  const processor = createProcessor(effectiveConfig);

  switch (command) {
    case 'push': {
      const text = await clipboard.read();
      if (!text) {
        console.error('Clipboard vazio.');
        process.exit(1);
      }
      await stack.push(text, stackPath);
      console.log(JSON.stringify({ ok: true, size: await stack.size(stackPath), preview: text.slice(0, 80) }));
      break;
    }

    case 'pop': {
      const text = await stack.pop(stackPath);
      if (!text) {
        console.error('Pilha vazia.');
        process.exit(1);
      }
      if (!(await clipboard.write(text))) {
        console.error('Falha ao escrever no clipboard.');
        process.exit(1);
      }
      console.log(JSON.stringify({ ok: true, pasted: text.slice(0, 80) }));
      break;
    }

    case 'peek': {
      const text = await stack.peek(stackPath);
      console.log(text ?? '');
      break;
    }

    case 'list': {
      const items = await stack.list(stackPath);
      console.log(JSON.stringify({ size: items.length, items }, null, 2));
      break;
    }

    case 'clear': {
      await stack.clear(stackPath);
      console.log(JSON.stringify({ ok: true }));
      break;
    }

    case 'process': {
      if (!opts.preset) {
        console.error('Use --preset NOME_DO_PRESET.');
        process.exit(1);
      }
      const text = await stack.peek(stackPath);
      if (!text) {
        console.error('Pilha vazia.');
        process.exit(1);
      }
      const out = await processor.process({ text, preset: opts.preset });
      if (!out) {
        console.error('Sem resposta do LLM.');
        process.exit(1);
      }
      await stack.push(out, stackPath);
      if (!(await clipboard.write(out))) {
        console.error('Processado, mas falhou ao escrever no clipboard.');
        process.exit(1);
      }
      console.log(JSON.stringify({ ok: true, preset: opts.preset, result: out.slice(0, 120) }));
      break;
    }

    case 'process-all': {
      if (!opts.preset) {
        console.error('Use --preset NOME_DO_PRESET.');
        process.exit(1);
      }
      const items = await stack.list(stackPath);
      if (!items.length) {
        console.error('Pilha vazia.');
        process.exit(1);
      }
      const results = [];
      for (const item of items) {
        const out = await processor.process({ text: item, preset: opts.preset });
        if (out) results.push(out);
      }
      await stack.clear(stackPath);
      for (const r of results) await stack.push(r, stackPath);
      const joined = results.join('\n\n---\n\n');
      await clipboard.write(joined);
      console.log(JSON.stringify({ ok: true, count: results.length, preview: joined.slice(0, 120) }));
      break;
    }

    case 'paste-all': {
      const items = await stack.list(stackPath);
      if (!items.length) {
        console.error('Pilha vazia.');
        process.exit(1);
      }
      const joined = items.join('\n\n');
      await clipboard.write(joined);
      await macros.appendLearned({ type: 'chain', from: 'paste-all', to: 'paste-all' });
      console.log(JSON.stringify({ ok: true, count: items.length }));
      break;
    }

    case 'macro': {
      console.log(JSON.stringify({ macros: await macros.loadMacros() }, null, 2));
      break;
    }

    case 'macro-add': {
      if (!opts.trigger || !opts.action) {
        console.error('Use --trigger NOME --action "plasm ...".');
        process.exit(1);
      }
      const macro = await macros.addMacro({ trigger: opts.trigger, action: opts.action, preset: opts.preset || null });
      console.log(JSON.stringify({ ok: true, macro }));
      break;
    }

    case 'macro-suggest': {
      console.log(JSON.stringify({ suggestions: await macros.suggestMacros() }, null, 2));
      break;
    }

    case 'status': {
      const items = await stack.list(stackPath);
      const backend = await clipboard.detectName().catch(() => 'unavailable');
      const hasImage = await clipboard.hasImage().catch(() => false);
      console.log(JSON.stringify({
        stackSize: items.length,
        clipboardBackend: backend,
        hasImage,
        provider: processor.defaultProvider,
        stackPath,
      }, null, 2));
      break;
    }

    case 'doctor': {
      const backend = await clipboard.detectName().catch((e) => `unavailable (${e.message})`);
      const probes = {};
      for (const bin of ['wl-paste', 'wl-copy', 'xclip', 'xsel', 'systemctl', 'gsettings']) {
        probes[bin] = Boolean(await import(path.join(LIB, 'adapters', 'clipboard', 'runner.js'))
          .then((m) => m.createRunner().which(bin)));
      }
      console.log(JSON.stringify({
        clipboardBackend: backend,
        session: {
          XDG_SESSION_TYPE: process.env.XDG_SESSION_TYPE || null,
          XDG_CURRENT_DESKTOP: process.env.XDG_CURRENT_DESKTOP || null,
        },
        configPath: path.join(os.homedir(), '.config', 'nexus-plasm', 'config.yaml'),
        configLoaded: Object.keys(config).length > 0,
        provider: processor.defaultProvider,
        binaries: probes,
        stateDir: STATE_DIR,
        stackFileExists: await stack.list(stackPath).then(() => true, () => false),
      }, null, 2));
      break;
    }

    case 'daemon': {
      await startWatch({
        stackPath,
        logPath,
        pidPath,
        pollIntervalMs: effectiveConfig.daemon?.pollIntervalMs || 1000,
        maxItems: effectiveConfig.max_items || 50,
        dedupe: effectiveConfig.dedupe !== false,
        debounceMs: effectiveConfig.daemon?.debounceMs || 300,
        quiet: Boolean(opts.quiet),
        clipboard,
      });
      break;
    }

    case 'stop': {
      await stopWatch({ pidPath });
      break;
    }

    default:
      console.error(`Comando desconhecido: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
