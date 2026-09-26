# DECISIONS.md — Decisões arquiteturais e operacionais

Formato:
- ID: `DEC-XXX`
- Data: `YYYY-MM-DD`
- Decisão: texto curto e atômico
- Motivo: por que essa opção foi escolhida
- Consequências: efeitos colaterais, trade-offs e custos
- Requisitos relacionados: IDs ou descrições
- Tarefas vinculadas: IDs ou descrições

---

## DEC-002 — Núcleo agnóstico ao desktop, integração por plugin
- Data: 2026-09-26
- Decisão: o core (ports + core) não conhece nenhum ambiente de desktop. Todo
  acoplamento a WM/GNOME vive em `plugins/<ambiente>/`.
- Motivo: Hyprland foi abandonado. Uma ferramenta de clipboard deve ser
  reaproveitável em GNOME, Sway, ou um TTY — trocar de ambiente não pode exigir
  fork.
- Consequências: mais arquivos (adapter por ambiente), mas o core é testável sem
  display server e o `nexus-stable` duplicado deixa de ter motivo de existir.
- Requisitos relacionados: funcionar em Wayland, X11 e headless.
- Tarefas vinculadas: `feat/env-agnostic-ports`.

## DEC-003 — GNOME por `gsettings`, não por addon do Shell
- Data: 2026-09-26
- Decisão: atalhos globais via
  `org.gnome.settings-daemon.plugins.media-keys.custom-keybindings`. Nenhum
  `gnome-extension/` no core.
- Motivo: a API do GNOME Shell é interna e removida entre releases —
  `imports.misc.extensionUtils` deixou de existir no GNOME 45, e o addon
  anterior declarava `shell-version` 42–46 num shell 50.3, ou seja, não carregava.
  `custom-keybindings` é a mesma interface que o próprio GNOME usa e é estável
  desde o 3.x. Um addon nosso seria um passivo de manutenção trimestral
  competindo com um plugin MIT que o usuário já tem instalado
  (`clipboard-history@alexsaveau.dev`).
- Consequências: sem indicator de menu no painel (aceito: o plugin de histórico
  já cobre a UI). Em troca, zero-break em upgrades de GNOME.
- Requisitos relacionados: não quebrar em upgrade de shell; não duplicar o
  gerenciador de clipboard já instalado.
- Tarefas vinculadas: `plugins/gnome/plasm-gnome-hooks`.

## DEC-004 — Portas e adapters (hexagonal) em vez de if-chains
- Data: 2026-09-26
- Decisão: `ClipboardPort` e `ProviderPort` descrevem o contrato;
  `lib/adapters/*` implementa; `lib/core/*` consome apenas as portas.
- Motivo: a duplicação de listas de binários (`daemon.js` reimplementando
  `wl-paste`/`xclip`/`xsel`) foi a causa raiz do bug de timeout perdido. Uma
  listadefined em um lugar só não diverge.
- Consequências: adapters são testáveis com runner injetado, sem display server.
  Custa uma camada a mais em arquivos pequenos.
- Requisitos relacionados: cobertura de teste sem display; zero regressão ao
  adicionar ambiente.
- Tarefas vinculadas: `lib/ports`, `lib/adapters`, `lib/core`.

## DEC-005 — `available()` exige leitura E escrita
- Data: 2026-09-26
- Decisão: um backend só é considerado disponível se puder ler o clipboard e
  escrever de volta.
- Motivo: a função do plasm é `clipboard -> LLM -> clipboard`. Um backend
  somente-leitura serve para meia função e falharia no meio do caminho, sem que
  a detecção tivesse avisado.
- Consequências: em um host com `wl-paste` e sem `wl-copy`, o auto-detect cai
  para X11 em vez de escolher um backend inutilizável.
- Requisitos relacionados: detecção correta de backend.
- Tarefas vinculadas: `tests/clipboard-port.test.js`.

## DEC-006 — Segredo só no header
- Data: 2026-09-26
- Decisão: credenciais de provider via header (`x-goog-api-key`), nunca no
  corpo JSON.
- Motivo: o adapter anterior escrevia a chave em `payload.key` além do header.
  Corpo de requisição é capturado por proxy, APM e trace de rede; header
  autenticado é tratado como segredo pela infraestrutura.
- Consequências: um proxy mal configurado que exija `?key=` precisaria de
  adaptação explícita, o que é desejável.
- Requisitos relacionados: AGENTS.md — nenhuma credencial exposta.
- Tarefas vinculadas: `lib/adapters/provider/gemini.js`.

## DEC-007 — O daemon não é habilitado por padrão
- Data: 2026-09-26
- Decisão: `plasm-daemon.service` é fornecido, documentado, mas não instalado
  nem habilitado.
- Motivo: com `clipboard-history@alexsaveau.dev` já observando o clipboard, um
  poller em paralelo captura de volta o resultado que o próprio plasm escreve —
  laço de realimentação. Atalhos explícitos são previsíveis e debugáveis.
- Consequências: não há captura automática fora da caixa. Quem quiser, instala
  a unidade consciously.
- Requisitos relacionados: não duplicar observação de clipboard.
- Tarefas vinculadas: `plugins/gnome/plasm-daemon.service`.

## DEC-008 — Atalhos com `Super` exclusivamente
- Data: 2026-09-26
- Decisão: nenhum acelerador global começa com `<Control>` isolado.
- Motivo: `custom-keybindings` é global e tem precedência sobre a tecla dentro
  do aplicativo. Um `<Control>c` global desfuncionaliza *copiar* em todo
  programa com foco, silenciosamente.
- Consequências: `push` deixa de ser Ctrl+C puro (agora `Super+c`). A troca é
  deliberada: perder um atalho é melhor que quebrar o clipboard do sistema.
- Requisitos relacionados: DEC-003.
- Tarefas vinculadas: `tests/gnome-hooks.test.js`.

## DEC-001 — Stack local e imutabilidade
- Data: 2026-08-14
- Decisão: Usar apenas paths em `~/.local` e `~/.config`, sem tocar em `/usr`.
- Motivo: Bluefin/Fedora imutável e instalação multi-usuário segura.
- Consequências: instalação user-local; Wizard GNOME não precisa de `sudo`.
- Requisitos relacionados: suporte a qualquer WM/Wayland; offline-first.
- Tarefas vinculadas: criar wizard GNOME; validar binds no host.
