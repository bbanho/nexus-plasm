# BUGS.md — ledger de defeitos encontrados

Cada entrada: sintoma, causa raiz, onde foi corrigido e o teste que trava o
comportamento. Nenhuma correção entra sem teste (AGENTS.md, DoD).

## Corrigidos em `feat/env-agnostic-ports`

### B1 — `writeText()` nunca retornava sucesso
- **Sintoma:** `plasm pop` escrevia no clipboard e mesmo assim imprimia
  "Falha ao colar no clipboard." O resultado era copiado, mas a CLI mentia.
- **Causa:** o `if (ok) return true` estava dentro de um callback `.then()`, logo
  o `return` saía do callback e não da função. O laço também executava os três
  backends da lista mesmo após o primeiro sucesso.
- **Correção:** `lib/adapters/clipboard/wayland.js`, `x11.js` — cada backend
  retorna `true` imediatamente no primeiro sucesso.
- **Teste:** `tests/clipboard-port.test.js` — "write reports success on the FIRST
  working backend" (falha se o adapter seguir testando outros backends).

### B2 — `timeout_ms` aceito e ignorado
- **Sintoma:** um upstream travado congelava o processo indefinidamente. Em
  `daemon`, isso é deadlock silencioso.
- **Causa:** `geminiGenerate`/`ollamaGenerate` recebiam `timeoutMs` e nunca o
  usavam; não havia `req.setTimeout` em lugar nenhum.
- **Correção:** `lib/adapters/provider/http.js` — `postJson` centraliza e aplica
  o timeout. Um único lugar, impossível de esquecer num adapter novo.
- **Teste:** `tests/provider-port.test.js` — "honours timeout_ms instead of
  hanging forever", com um servidor HTTP que nunca responde.

### B3 — chave da API dentro do corpo JSON
- **Sintoma:** a chave Gemini viajava em `payload.key` além do header.
- **Causa:** `gemini.js` montava o payload com a chave embutida.
- **Risco:** a chave cai em logs de proxy, APM e traces de rede.
- **Correção:** `lib/adapters/provider/gemini.js` — a chave fica só em
  `x-goog-api-key`.
- **Teste:** `tests/provider-port.test.js` — "sends the key in the header only,
  never in the JSON body", inspecionando header e body reais.

### B4 — `startWatch()` nunca gravava o PID file
- **Sintoma:** `plasm stop` não parava nada; lia um arquivo que ninguém criava.
- **Correção:** `lib/core/daemon.js` — grava o PID ao iniciar, remove ao
  encerrar, e limpa arquivos órfãos.
- **Teste:** `tests/daemon-core.test.js` — "startWatch writes a PID file that
  stopWatch can consume".

### B5 — backend de clipboard duplicado dentro do daemon
- **Causa:** `daemon.js` reimplementava a lista `wl-paste`/`xclip`/`xsel` em vez
  de importar `clipboard.js`. Duas listas divergem com o tempo — foi assim que o
  timeout se perdeu.
- **Correção:** o daemon recebe um `ClipboardPort` injetado
  (`createAutoClipboard`), e o core não conhece binário algum.
- **Teste:** `tests/daemon-core.test.js` — a suíte roda com clipboard falso
  injetado; nenhum processo de clipboard é criado.

### B6 — config descartado silenciosamente
- **Sintoma:** qualquer `config.yaml` que não começasse literalmente com
  `max_items:` ou `ollama:` era lido como `{}`. Um config começando com
  `default_llm:` ou um comentário inicial não se aplicava, sem erro.
- **Causa:** sniffing da primeira linha em vez de tentar parse.
- **Correção:** `lib/core/config.js` — tenta JSON, depois YAML, sempre.
- **Teste:** `tests/config.test.js` — "parses YAML that does not start with
  max_items or ollama", "parses YAML behind a leading comment".

### B7 — `node_modules` nunca existiu; dependência `yaml` não instalável
- **Sintoma (grave):** `loadConfig()` **nunca leu um config, em toda a história
  do repositório.** Sem `node_modules`, o `import('yaml')` lançava
  `ERR_MODULE_NOT_FOUND` — engolido pelo `catch` do B6, que devolvia `{}`.
- **Causa:** `yaml` estava no `package.json` sem lockfile, e ninguém rodou
  `npm install`. Todo ajuste de configuração era inoperante.
- **Correção:** `package-lock.json` versionado; `lib/core/config.js` não engole
  falha de import (JSON é o fallback quando o módulo falta).
- **Teste:** `tests/config.test.js` — o `api_key_env` só resolve se o parseu se
  respondeu de fato; a suíte falha se `yaml` estiver ausente.

### B8 — `paste-all` chamava função não importada
- **Sintoma:** `plasm paste-all` lançava `ReferenceError` ao final, **depois** de
  já ter escrito no clipboard.
- **Causa:** `bin/plasm.js` chamava `appendLearned()` mas o import da linha 88
  trazia só `loadMacros, saveMacros, addMacro, suggestMacros`.
- **Correção:** o namespace `macros` é importado inteiro e usado
  `macros.appendLearned(...)`.
- **Teste:** coberto pela suíte de integração; a chamada agora é sempre
  resolvida em `bin/plasm.js`.

### B9 — FIFO em estado global mutável
- **Sintoma:** dois consumidores no mesmo processo (CLI + daemon) compartilhavam e
  sobrescreviam a mesma pilha em memória; `loadStack` devolvia o array interno.
- **Correção:** `lib/core/stack.js` — todo estado é lido do arquivo a cada
  operação; `loadStack` devolve cópia.
- **Teste:** `tests/e2e.test.js` — "two stacks in the same process do not share
  state", "loadStack returns a copy, not the internal array".

### B10 — `postJson` duplicado em dois adapters
- **Causa:** ao criar o adapter do Ollama, a função de transporte foi copiada
  em vez de importada — a mesma classe de divergência do B5, reintroduzida por
  mim durante a refatoração.
- **Correção:** `lib/adapters/provider/http.js` é o único transporte.
- **Teste:** a suíte de providers exercita ambos os adapters contra o mesmo
  helper; `ollama.js` só o importa.

### B11 — convenção de chaves divergente no provider
- **Sintoma:** `config.yaml` usa `base_url`/`default_model` (snake_case), mas o
  `processor.js` legado passava `baseUrl`/`model` (camelCase).
- **Risco:** um config antigo falharia em silêncio ou falaria para o host errado.
- **Correção:** `normalise()` em ambos os adapters aceita as duas formas.
- **Teste:** `tests/provider-port.test.js` — "accepts both snake_case and
  camelCase config keys".

### B12 — `<Control>c` global quebraria Ctrl+C
- **Sintoma:** o plano de hooks original usava `<Control>c` para `push`.
- **Risco:** em GNOME, `custom-keybindings` é global — desviaria a tecla de
  *copiar* em todo aplicativo com foco, silenciosamente.
- **Correção:** todos os aceleradores usam `Super`, que só dispara fora de campos
  de texto.
- **Teste:** `tests/gnome-hooks.test.sh` — asserção de que nenhum acelerador
  começa com `<Control>` isolado.

### B13 — `~` não expandido nos paths do config
- **Sintoma:** com o config carregado pela primeira vez (B7 corrigido), `plasm
  status` reportava `stackPath: "~/.local/share/nexus-plasm/stack.json"` e o
  arquivo de estado era criado **dentro do diretório de trabalho**, em
  `./~/.local/share/nexus-plasm/stack.json`.
- **Causa:** `config/config.yaml` documenta paths com `~/...`, mas nada
  expandia a tilda antes de `path.join`.
- **Impacto:** o estado da pilha espalhava por CWD — cada diretório onde o CLI
  rodava tinha sua própria pilha. Invisível até agora porque B7 impedia o config
  de ser lido.
- **Correção:** `expandPath()` em `lib/core/config.js`, aplicado a todo
  `paths.*` na carga. `~`, `$HOME/`, `${HOME}/` e relativos.
- **Teste:** `tests/config.test.js` — "expands ~ in configured paths" e
  "expandPath handles ~, $HOME, ${HOME} and relative forms".

## Retirados por decisão

### `changes/nexus-energy/` — removido (2026-09-27)
O change descrevia um termostato global Φ (detectar caos via entropia H(T) e
morte térmica via mutual information I(M;T) sobre o grafo NEXUS). Removido por
decisão do Bruno. Três razões, todas verificáveis:

1. **Aponta para arquitetura inexistente.** `context.lock.json` cita
   `ADR-0030 AST Parsing` e `DEC-NEXUS-Φ Energy Function`. A lista de ADRs salta
   de 0029 para 0034 — não há 0030. Não há DEC sobre Φ. O `base_commit` é a
   string literal `FROZEN_UNTIL_REPO_AVAILABLE`.
2. **Tautologia autorreferente, num repo que já documentou isso.**
   `NEXUS/docs/10_Fundacao/REVISAO_CRITICA.md` desmonta exatamente essa família
   de construções (Higgs, φ, curvatura): *"75% das 'hipóteses confirmadas' são
   tautologias — nossos operadores são lentes que nós mesmos fabricamos e depois
   'validamos' medindo o que definimos."* Um limiar fixo sobre métricas
   autodefinidas dispara porque o limiar foi escolhido, não porque algo foi
   descoberto.
3. **Sensor sem substrato.** Φ precisa de `reflections` e `context_events`.
   Ambas as tabelas têm **0 linhas**, junto com `hypothesis`,
   `reasoning_checkpoint` e `module_synthesis` — enquanto `ast_nodes` tem
   616.707 e `ast_edges` 616.155. O termostato teria lido o sistema como "sem
   dados", não como "morto". O problema que ele nomeava (616k nós, zero
   reflexões) é real; o instrumento não conseguia vê-lo.

O problema real foi registrado como card dekah em vez do Φ. O que o termostato
acertava — "morte térmica" como detecção de Learning parado — permanece válido como
critério de **staffing verificável** (tabela X vazia = sistema parado), sem
limiar mágico.

## Pendentes (não corrigidos aqui)

### P2 — nome `gnome-extension/` obsoleto
`gnome-extension/extension.js` usa `imports.misc.extensionUtils`, removido no
GNOME 45+, e `metadata.json` declara `shell-version` 42–46 num shell 50.3. Não
carrega. A integração passou a ser `plugins/gnome/` + `gsettings`; o diretório
antigo deve ser removido.
