# DECISIONS.md — Decisões arquiteturais e operacionais

Formato:
- ID: `DEC-001`
- Data: `YYYY-MM-DD`
- Decisão: texto curto e atômico
- Motivo: por que essa opção foi escolhida
- Consequências: efeitos colaterais, trade-offs e custos
- Requisitos relacionados: IDs ou descrições
- Tarefas vinculadas: IDs ou descrições

Exemplo:

## DEC-001 — Stack local e imutabilidade
- Data: 2026-08-14
- Decisão: Usar apenas paths em `~/.local` e `~/.config`, sem tocar em `/usr`.
- Motivo: Bluefin/Fedora imutável e instalação multi-usuário segura.
- Consequências: instalação user-local; Wizard GNOME não precisa de `sudo`.
- Requisitos relacionados: suporte a qualquer WM/Wayland; offline-first.
- Tarefas vinculadas: criar wizard GNOME; validar binds no host.
