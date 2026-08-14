# nexus-plasm — Uso

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
plasm daemon [--quiet]
plasm stop
plasm --help
```

## Modo daemon

Inicia monitoramento contínuo do clipboard:

```bash
plasm daemon
```

Com modo silencioso:

```bash
plasm daemon --quiet
```

Para parar:

```bash
plasm stop
```

Logs:

```bash
~/.local/share/nexus-plasm/logs/plasm.log
```

## Binds recomendados

```hyprland
bind = SUPER, X, exec, plasm process --preset fix-pt
bind = SUPER, F, exec, plasm process-all --preset fix-pt
bind = SUPER, ALT, V, exec, plasm paste-all
bind = SUPER, V, exec, plasm pop
bind = CTRL, C, exec, plasm push
bind = SUPER, B, exec, plasm status
```

## Observação

- A pilha real está em `~/.local/share/nexus-plasm/stack.json`.
- O daemon usa `wl-paste` como primário no Wayland.
- Logs recomendados: `~/.local/share/nexus-plasm/logs/plasm.log`.
