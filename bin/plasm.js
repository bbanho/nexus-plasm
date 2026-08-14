#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const STACK_FILE = path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'stack.json');

function usage() {
  console.log(`
nexus-plasm

Uso:
  plasm push                        Insere o clipboard atual na pilha FIFO
  plasm pop                         Cola o último item
  plasm peek                        Mostra o último item sem remover
  plasm list                        Mostra a pilha atual
  plasm clear                       Limpa a pilha
  plasm process --preset fix-pt     Processa o último item e substitui pelo resultado
  plasm process-all --preset fix-pt Processa todos os itens e substitui pelo resultado
  plasm paste-all                   Cola todo o conteúdo concatenado
  plasm status                      Mostra tamanho da pilha, imagem no clipboard e LLM ativo
  plasm daemon [--quiet]            Inicia monitoramento automático do clipboard
  plasm stop                        Para o daemon em execução
  plasm --help

Opções:
  --provider ollama|gemini   Sobrescreve o provedor padrão
  --model <modelo>          Sobrescreve o modelo padrão
  --quiet                   Modo silencioso para daemon
`);
}

function parseCli(argv) {
  if (!argv || !argv.length || argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
    return { command: 'help' };
  }

  const command = argv[0];
  const rest = argv.slice(1);
  const opts = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--provider' && rest[i + 1]) {
      opts.provider = rest[i + 1];
      i += 1;
    } else if (token === '--model' && rest[i + 1]) {
      opts.model = rest[i + 1];
      i += 1;
    } else if (token === '--preset' && rest[i + 1]) {
      opts.preset = rest[i + 1];
      i += 1;
    } else if (token === '--all' || token === '-a') {
      opts.all = true;
    } else if (token.startsWith('--')) {
      console.error(`Opção desconhecida: ${token}`);
      exit(1);
    }
  }

  return { command, opts };
}

function exit(code) {
  if (globalThis.process?.exit) {
    globalThis.process.exit(code);
  }
}

async function runCli() {
  const argv = globalThis.process?.argv?.slice?.(2) ?? [];
  const parsed = parseCli(argv);
  if (parsed.command === 'help') {
    usage();
    exit(0);
    return;
  }

  const { loadConfig } = await import(path.join(__dirname, '..', 'lib', 'config.js'));
  const { readText, writeText, hasImage } = await import(path.join(__dirname, '..', 'lib', 'clipboard.js'));
  const { loadStack, push, pop, peek, list, clear, size } = await import(path.join(__dirname, '..', 'lib', 'stack.js'));
  const { process } = await import(path.join(__dirname, '..', 'lib', 'processor.js'));
  const { startWatch, stopWatch } = await import(path.join(__dirname, '..', 'lib', 'daemon.js'));

  const config = await loadConfig();
  const effectiveConfig = { ...config };

  if (parsed.opts.provider) effectiveConfig.default_llm = parsed.opts.provider;
  if (parsed.opts.model) {
    if (!effectiveConfig.ollama) effectiveConfig.ollama = {};
    effectiveConfig.ollama.default_model = parsed.opts.model;
  }

  switch (parsed.command) {
    case 'push': {
      const text = await readText();
      if (!text) {
        console.error('Clipboard vazio.');
        exit(1);
        return;
      }
      await push(text, STACK_FILE);
      console.log(JSON.stringify({ ok: true, size: await size(STACK_FILE), preview: text.slice(0, 80) }));
      break;
    }

    case 'pop': {
      const text = await pop(STACK_FILE);
      if (!text) {
        console.error('Pilha vazia.');
        exit(1);
        return;
      }
      const ok = await writeText(text);
      if (!ok) {
        console.error('Falha ao colar no clipboard.');
        exit(1);
        return;
      }
      console.log(JSON.stringify({ ok: true, pasted: text.slice(0, 80) }));
      break;
    }

    case 'peek': {
      const text = await peek(STACK_FILE);
      console.log(text ?? '');
      break;
    }

    case 'list': {
      const items = await list(STACK_FILE);
      console.log(JSON.stringify({ size: items.length, items }, null, 2));
      break;
    }

    case 'clear': {
      await clear(STACK_FILE);
      console.log(JSON.stringify({ ok: true }));
      break;
    }

    case 'process': {
      if (!parsed.opts.preset) {
        console.error('Use --preset NOME_DO_PRESET.');
        exit(1);
        return;
      }
      const text = await peek(STACK_FILE);
      if (!text) {
        console.error('Pilha vazia.');
        exit(1);
        return;
      }
      const out = await process({ text, preset: parsed.opts.preset, config: effectiveConfig });
      if (!out) {
        console.error('Sem resposta do LLM.');
        exit(1);
        return;
      }
      await push(out, STACK_FILE);
      await writeText(out);
      console.log(JSON.stringify({ ok: true, preset: parsed.opts.preset, result: out.slice(0, 120) }));
      break;
    }

    case 'process-all': {
      if (!parsed.opts.preset) {
        console.error('Use --preset NOME_DO_PRESET.');
        exit(1);
        return;
      }
      const items = await list(STACK_FILE);
      if (!items.length) {
        console.error('Pilha vazia.');
        exit(1);
        return;
      }
      const results = [];
      for (const item of items) {
        const out = await process({ text: item, preset: parsed.opts.preset, config: effectiveConfig });
        if (out) results.push(out);
      }
      await clear(STACK_FILE);
      for (const r of results) await push(r, STACK_FILE);
      const joined = results.join('\n\n---\n\n');
      await writeText(joined);
      console.log(JSON.stringify({ ok: true, count: results.length, preview: joined.slice(0, 120) }));
      break;
    }

    case 'paste-all': {
      const items = await list(STACK_FILE);
      if (!items.length) {
        console.error('Pilha vazia.');
        exit(1);
        return;
      }
      const joined = items.join('\n\n');
      await writeText(joined);
      console.log(JSON.stringify({ ok: true, count: items.length }));
      break;
    }

    case 'status': {
      const items = await list(STACK_FILE);
      const img = await hasImage();
      console.log(JSON.stringify({ stackSize: items.length, hasImage: img, llm: effectiveConfig.default_llm || 'ollama' }, null, 2));
      break;
    }

    case 'daemon': {
      const stackPath = (effectiveConfig.paths && effectiveConfig.paths.stack_file) || STACK_FILE;
      const logPath = (effectiveConfig.paths && effectiveConfig.paths.log_file) || path.join(os.homedir(), '.local', 'share', 'nexus-plasm', 'logs', 'plasm.log');
      await startWatch({
        stackPath,
        logPath,
        pollIntervalMs: effectiveConfig.daemon?.pollIntervalMs || 1000,
        quiet: parsed.opts.quiet || false,
      });
      break;
    }

    case 'stop': {
      await stopWatch();
      break;
    }

    default:
      console.error(`Comando desconhecido: ${parsed.command}`);
      usage();
      exit(1);
  }
}

runCli();
