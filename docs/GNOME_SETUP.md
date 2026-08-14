# Integração com GNOME

## Visão geral

No GNOME, você não tem `hyprland.conf`, mas pode obter o mesmo comportamento por:

- **Configurações nativas do GNOME** para binds simples
- **Custom shortcuts** para `Super+X`, `Super+F`, `Super+Alt+V`
- **Extensões recomendadas** para clipboard history visual
- **GNOME Tweaks / dconf** para ajustes avançados

## Passo 1 — instalar dependências

```bash
sudo dnf install -y wl-clipboard cliphist gnome-tweaks dconf-editor
```

Extensões úteis (opcional):

```bash
# GNOME Shell extensions
sudo dnf install -y gnome-shell-extension-clipboard-indicator
# ou instale via https://extensions.gnome.org
```

## Passo 2 — custom shortcuts

Abra **Configurações → Teclado → Atalhos personalizados → +**

Cole estes binds:

| Nome | Comando | Atalho |
|---|---|---|
| Plasm Push | `plasm push` | `Ctrl+C` |
| Plasm Pop | `plasm pop` | `Ctrl+V` |
| Plasm Process Last | `plasm process --preset fix-pt` | `Super+X` |
| Plasm Process All | `plasm process-all --preset fix-pt` | `Super+F` |
| Plasm Paste All | `plasm paste-all` | `Super+Alt+V` |
| Plasm Status | `plasm status` | `Super+B` |

> Observação: se `Ctrl+C`/`Ctrl+V` já estiverem ocupados por copiar/colar padrão, use combinações alternativas, como `Ctrl+Alt+C` e `Ctrl+Alt+V`.

## Passo 3 — clipboard indicator

Se instalou a extensão **Clipboard Indicator**:

- Atalho para histórico: `Ctrl+Shift+V`
- Configure para persistir entre reinicializações
- Use como camada visual da pilha; a fonte oficial continua sendo `~/.local/share/nexus-plasm/stack.json`

## Passo 4 — dconf (opcional)

Para binds mais avançados ou fallback:

```bash
# Exemplo: Super+X via gsettings
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings \
  "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/']"

gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ \
  name 'Plasm Process' \
  command 'plasm process --preset fix-pt' \
  binding '<Super>x'
```

## Passo 5 — validar

```bash
plasm status
plasm list
```

## Diferenças vs Hyprland

- GNOME não usa `bind = ...` centralizado
- Binds ficam em **Configurações → Teclado → Atalhos personalizados**
- Persistência é por sessão do GNOME Shell
- Clipboard visual é opcional via extensão

## Observação

- O daemon continua funcionando: `plasm daemon`
- Logs: `~/.local/share/nexus-plasm/logs/plasm.log`
