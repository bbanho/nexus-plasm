# AGENTS.md — Regras canônicas para agentes em nexus-plasm

## Objetivo
Permitir que agentes implementem mudanças sob supervisão, com invariantes, escopo fechado e evidência obrigatória.

## Invariantes (não negociáveis)
- Nenhuma credencial hardcoded no repositório.
- Chaves via `~/.config/nexus-plasm/.env` ou secret manager; nunca em `config.yaml` versionado.
- Isolamento multi-tenant/cliente: toda leitura/escrita de estado deve usar paths no home do usuário (`~/.local/...`, `~/.config/...`).
- Operações destrutivas requerem confirmação explícita ou flag `--force`.
- Qualquer mudança de schema de arquivo ou CLI exige atualização de docs e teste.
- Nada de side effects globais em imports; módulos devem exportar funções puras sempre que possível.

## Workflow padrão
1. O humano define um *brief de decisão* (`DECISIONS.md`).
2. Um agente **conductor** cria uma `changes/<change-id>/` completa.
3. Agentes **executores** implementam apenas requisitos fechados.
4. Um agente **verificador** preenche `evidence.md` e valida DoD.
5. Mudanças só entram em `main` após DoD comprovado.

## Formato canônico de change
Cada change deve conter:
- `proposal.md`
- `spec.md`
- `tasks.md`
- `evidence.md`
- `context.lock.json`

## Política de branches e worktree
- Branch base: `main`
- Nomes de feature: `feat/<change-id>-<slug>`
- Worktree preferencial: `.worktrees/<change-id>`
- Nada de commits diretos em `main`
- Rebase preferido; merge permitido apenas com conflito resolvido e documentado

## Testes e DoD
- Testes devem ser automatizados e rodar com `npm run test`.
- Nenhum PR sem pelo menos 1 teste relacionado à mudança.
- DoD = teste verde + documentação atualizada + evidência preenchida.

## Referência oficial
- Este arquivo é a fonte única de verdade operacional.
- Decisões arquiteturais duradouras devem ser registradas em `DECISIONS.md`.
