# Integração com Hyprland

## Passo 1 — instalar dependências Wayland

```bash
sudo dnf install -y wl-clipboard cliphist
```

## Passo 2 — habilitar binds

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

## Passo 3 — recarregar

```bash
hyprctl reload
```

## Passo 4 — validar

```bash
plasm status
plasm list
```

## Observação

- A pilha real está em `~/.local/share/nexus-plasm/stack.json`.
- Logs recomendados: `~/.local/share/nexus-plasm/logs/plasm.log`.
