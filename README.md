# nexus-plasm

> Clipboard FIFO + LLM processor. Agnóstico a ambiente de desktop.

Copia um bloco, empilha, processa com um LLM (Ollama local ou Gemini) e devolve
ao clipboard. Sem janelas de chat, sem perder contexto.

## Arquitetura

O núcleo não sabe qual desktop você usa. Tudo que é específico de ambiente vive
em `plugins/`.

```
lib/
  ports/       clipboard.js, provider.js      contratos (nenhum shell, nenhum WM)
  adapters/
    clipboard/ runner.js, wayland.js, x11.js, auto.js
    provider/  http.js, ollama.js, gemini.js
  core/        stack.js, daemon.js, processor.js, config.js, macros.js
plugins/
  gnome/       plasm-gnome-hooks, plasm-daemon.service
```

Regra: **adapters falam com o mundo, ports descrevem o contrato, core só fala
com ports.** Trocar de ambiente é escrever um adapter — nunca um fork.

## Comandos

```bash
plasm push                        # clipboard atual -> pilha
plasm pop                         # cola o último item
plasm peek | list | clear
plasm process --preset fix-pt     # processa o topo, escreve o resultado
plasm process-all --preset fix-pt
plasm paste-all
plasm status                      # pilha + backend + provider
plasm doctor                      # diagnóstico, não altera nada
plasm daemon [--quiet]            # watcher automático
plasm stop
```

Opções: `--provider ollama|gemini`, `--model`, `--preset`, `--clipboard wayland|x11`.

## Configuração

`~/.config/nexus-plasm/config.yaml` (veja `config/config.yaml`):

```yaml
max_items: 50
dedupe: true
default_llm: ollama          # ou gemini

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

daemon:
  pollIntervalMs: 1000
  debounceMs: 300
```

A chave da API vem do ambiente, nunca do arquivo.

## GNOME

Não há — nem deve haver — um addon do GNOME Shell. A integração usa
`gsettings custom-keybindings`, a mesma interface que o próprio GNOME usa, e é
estável desde o GNOME 3.x. Um addon quebra a cada release do shell; o histórico
de clipboard já é papel do plugin `clipboard-history@alexsaveau.dev` (MIT).

```bash
# ver o plano (nada é alterado)
./plugins/gnome/plasm-gnome-hooks --dry-run

# aplicar — grava backup antes de escrever
./plugins/gnome/plasm-gnome-hooks --apply

# desfazer
./plugins/gnome/plasm-gnome-hooks --rollback
```

Todos os aceleradores usam `Super`. Nenhum atalho global pode sequestrar uma tecla
que você digita o dia inteiro — `<Control>c` global quebraria *copiar* em todo
aplicativo.

### Captura automática (opcional)

`plugins/gnome/plasm-daemon.service` roda o watcher sob systemd de usuário:

```bash
install -Dm755 plugins/gnome/plasm-daemon.service \
  ~/.config/systemd/user/plasm-daemon.service
systemctl --user enable --now plasm-daemon.service
```

**Não é o padrão, de propósito.** Com o plugin de histórico já observando o
clipboard, dois consumidores criam realimentação: o resultado que o plasm
escreve seria capturado de novo. Prefira os atalhos explícitos.

## Outros ambientes

O núcleo funciona em qualquer lugar com `wl-clipboard` ou `xclip`. Para um WM
específico, escreva um adapter e um manifest em `plugins/`. Hyprland, por
exemplo, é só um `bindings.conf` apontando para o mesmo `plasm`.

## Desenvolvimento

```bash
npm install
npm test
```

53 testes. Nenhuma correção entra sem teste — ver `BUGS.md` para o ledger de
defeitos e `DECISIONS.md` para as decisões arquiteturais.
