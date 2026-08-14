# nexus-plasm

> Clipboard FIFO + LLM processor para Hyprland/Wayland.

Atalhos globais de clipboard com pilha FIFO, presets de texto e integração com **Ollama** e **Gemini Interactions** — sem interfaces pesadas, sem perder contexto.

## Por que o plasm?

- **Pipeline real**: `clipboard -> stack FIFO -> LLM -> clipboard/overlay`
- **Wayland-first**: usa `wl-clipboard`, `wl-paste` e, quando disponível, `cliphist`
- **Multi-provedor**: preferência por modelo local; fallback opcional para Gemini
- **Zero segredos no repo**: chaves via `~/.config/nexus-plasm/.env`
- **Stateless no UI**: sem janelas de chat; resultado volta direto para o clipboard

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+C` | insere o clipboard atual na pilha |
| `Ctrl+V` | cola o último item |
| `Super+X` | processa o último item com LLM |
| `Super+F` | processa toda a pilha |
| `Super+Alt+V` | cola todo o histórico concatenado |
| `Super+B` | mostra status da pilha |

## Exemplo de uso

```bash
# 1) copie algo
echo 'texto de exemplo' | wl-copy

# 2) insira na pilha
plasm push

# 3) processe
plasm process --preset fix-pt

# 4) cole o resultado
plasm pop
```

## Comandos

```bash
plasm push
plasm pop
plasm peek
plasm list
plasm clear
plasm status
plasm process --preset fix-pt
plasm process-all --preset fix-pt
plasm paste-all
plasm --help
```

## Instalação

```bash
git clone git@github.com:bbanho/nexus-plasm.git ~/repos/nexus-plasm
mkdir -p ~/.config/nexus-plasm
cp ~/repos/nexus-plasm/config/config.yaml ~/.config/nexus-plasm/config.yaml
ln -sf ~/repos/nexus-plasm/bin/plasm.js ~/.local/bin/plasm
chmod +x ~/repos/nexus-plasm/bin/plasm.js
```

## Configuração

Edite `~/.config/nexus-plasm/config.yaml`:

```yaml
default_llm: ollama
ollama:
  base_url: http://localhost:11434
  default_model: qwen2.5:7b
  timeout_ms: 120000
gemini:
  base_url: https://generativelanguage.googleapis.com
  default_model: gemini-2.0-flash
  api_key_env: GEMINI_API_KEY
  timeout_ms: 120000
presets:
  fix-pt: "Corrija o português, mantendo o sentido e o tom."
  summarize: "Resuma em no máximo 2 linhas, em português."
  explain-code: "Explique este código de forma concisa, em português."
  translate-en: "Traduza para inglês natural, mantendo termos técnicos quando necessário."
```

## Integração com Hyprland

Adicione ao final de `~/.config/hypr/hyprland.conf`:

```hyprland
# nexus-plasm
bind = SUPER, X, exec, plasm process --preset fix-pt
bind = SUPER, F, exec, plasm process-all --preset fix-pt
bind = SUPER, ALT, V, exec, plasm paste-all
bind = SUPER, V, exec, plasm pop
bind = CTRL, C, exec, plasm push
bind = SUPER, B, exec, plasm status
```

Recarregue:

```bash
hyprctl reload
```

## Arquitetura

```
usuário copia texto
       │
       ▼
plasm push → stack.json
       │
atalho LLM
       │
       ▼
plasm process --preset ...
       │
   Ollama ou Gemini
       │
       ▼
plasm pop / plasm paste-all
       │
       ▼
área de transferência
```

## Segurança

- Nenhuma credencial hardcoded.
- Chaves via `~/.config/nexus-plasm/.env`.
- Escrita/leitura apenas no caminho do usuário: `~/.local/share/nexus-plasm`.

## Status do projeto

- CLI principal implementada
- FIFO stack com dedup e limite configurável
- Clientes Ollama e Gemini Interactions
- Testes passando

```bash
npm run test
```

## Licença

MIT
