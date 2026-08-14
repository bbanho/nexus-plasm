#!/usr/bin/env bash
set -euo pipefail

APP_NAME="nexus-plasm"
EXT_UUID="nexus-plasm@bbanho"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/${EXT_UUID}"
PLASM_BIN="$HOME/.local/bin/plasm"
CONFIG_DIR="$HOME/.config/nexus-plasm"
STATE_DIR="$HOME/.local/share/nexus-plasm"
LOG_DIR="$STATE_DIR/logs"

is_gnome() {
  [ "${XDG_CURRENT_DESKTOP:-}" = "GNOME" ] || [ "${XDG_CURRENT_DESKTOP:-}" = "ubuntu:GNOME" ] || [ -n "${GNOME_SHELL_SESSION_MODE:-}" ]
}

is_immutable() {
  command -v rpm-ostree >/dev/null 2>&1 && [ -f /run/ostree-booted ]
  return $?
}

ensure_dirs() {
  mkdir -p "$CONFIG_DIR" "$STATE_DIR" "$LOG_DIR"
  mkdir -p "$HOME/.local/share/gnome-shell/extensions"
}

install_extension() {
  local repo_root="${1:-$HOME/repos/nexus-plasm}"
  local src="$repo_root/gnome-extension"
  if [ ! -d "$src" ]; then
    echo "ERRO: extensão não encontrada em $src" >&2
    exit 1
  fi
  rm -rf "$EXT_DIR"
  mkdir -p "$EXT_DIR"
  cp "$src"/* "$EXT_DIR/"
  echo "Extensão instalada em $EXT_DIR"
}

enable_extension() {
  if ! command -v gnome-extensions >/dev/null 2>&1; then
    echo "AVISO: gnome-extensions não encontrado; habilite manualmente em GNOME Extensions." >&2
    return 0
  fi
  gnome-extensions enable "$EXT_UUID" || true
}

ask_yes_no() {
  local prompt="$1"
  local default="${2:-N}"
  local answer
  while true; do
    printf "%s [%s] " "$prompt" "$default"
    read -r answer
    case "$answer" in
      [Yy]* ) return 0 ;;
      [Nn]* ) return 1 ;;
      "" ) [ "$default" = "Y" ] && return 0 || return 1 ;;
      * ) echo "Responda Y/N." ;;
    esac
  done
}

main() {
  if ! is_gnome; then
    echo "Este wizard é para GNOME. Abortando."
    exit 1
  fi

  if is_immutable; then
    echo "Sistema imutável detectado."
    if ! ask_yes_no "Continuar com instalação user-local (sem tocar no sistema)?" Y; then
      exit 1
    fi
  fi

  ensure_dirs
  install_extension "$@"
  enable_extension

  cat <<EOF

Instalação GNOME local concluída.

- Extensão: $EXT_DIR
- Estado: $STATE_DIR
- Config: $CONFIG_DIR

Próximo:
1) Reinicie o GNOME Shell: Alt+F2, digite r, Enter.
2) Habilite a extensão em https://extensions.gnome.org/local/ ou pelo GNOME Tweaks.
3) Abra Configurações → Teclado → Atalhos personalizados e crie:
   - plasm push
   - plasm pop
   - plasm process --preset fix-pt
   - plasm process-all --preset fix-pt
   - plasm paste-all
   - plasm status
EOF
}

main "$@"
