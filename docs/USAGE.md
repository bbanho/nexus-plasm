# nexus-plasm — Uso

## Instalação

```bash
cp -r ~/repos/nexus-plasm ~/.local/state/nexus-plasm || true
mkdir -p ~/.config/nexus-plasm
cp ~/repos/nexus-plasm/config/config.yaml ~/.config/nexus-plasm/config.yaml
```

Defina a chave Gemini se for usar:

```bash
export GEMINI_API_KEY='sua-chave'
```

Coloque o binário no PATH:

```bash
ln -sf ~/repos/nexus-plasm/bin/plasm.js ~/.local/bin/plasm
chmod +x ~/repos/nexus-plasm/bin/plasm.js
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

## Binds recomendados

```hyprland
bind = SUPER, X, exec, plasm process --preset fix-pt
bind = SUPER, F, exec, plasm process-all --preset fix-pt
bind = SUPER, ALT, V, exec, plasm paste-all
bind = SUPER, V, exec, plasm pop
bind = CTRL, C, exec, plasm push
bind = SUPER, B, exec, plasm status
```
