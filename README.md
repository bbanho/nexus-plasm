# nexus-plasm

Clipboard inteligente para Hyprland/Wayland com pilha FIFO, processamento LLM local e integração com Gemini.

## Conceito

- **Ctrl+C** → insere na pilha FIFO
- **Ctrl+V** → cola último item
- **Super+X** → processa último item com LLM
- **Super+F** → processa toda a pilha
- **Super+Alt+V** → cola tudo concatenado

## Stack

- Wayland: `wl-clipboard`, `wl-paste`, `cliphist`
- WM: Hyprland binds
- LLM local: Ollama (`/api/generate`, `/api/chat`)
- LLM remoto: Gemini Interactions
- CLI: Node.js ou Python

## Estrutura

```
bin/plasm            # CLI principal
lib/
  stack.js           # FIFO storage (JSON + cliphist)
  clipboard.js       # wl-copy / wl-paste / cliphist
  config.js          # ~/.config/nexus-plasm/config.yaml
  ollama.js          # cliente Ollama
  gemini.js          # cliente Gemini Interactions
  processor.js       # presets e roteamento LLM
hypr/
  bindings.conf      # atalhos prontos para hyprland.conf
config/
  config.yaml        # configuração padrão
tests/
  stack.test.js      # FIFO, limites, dedup
docs/
  USAGE.md           # guia completo
```

## Segurança

- Nenhuma credencial hardcoded.
- Chaves API via variáveis de ambiente ou `~/.config/nexus-plasm/.env`.
- Fallback para provedores apenas quando configurado.

## Estado

Implementação inicial em andamento.
