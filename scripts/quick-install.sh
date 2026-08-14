#!/usr/bin/env bash
set -euo pipefail

ASCII_ART='
 _   _                      ____ _     ___
| \ | | _____  ___   _ ___  / ___| |   |_ _|
|  \| |/ _ \ \/ / | | / __|| |   | |    | |
| |\  |  __/>  <| |_| \__ \| |___| |___ | |
|_| \_|\___/_/\_\__,_|___/ \____|_____|___|
'

detect_wm() {
  if [ "${XDG_CURRENT_DESKTOP:-}" = "GNOME" ] || [ "${XDG_CURRENT_DESKTOP:-}" = "ubuntu:GNOME" ]; then
    echo "gnome"
  elif [ -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ] || command -v hyprctl >/dev/null 2>&1; then
    echo "hyprland"
  else
    echo "unknown"
  fi
}

is_immutable() {
  command -v rpm-ostree >/dev/null 2>&1 && [ -f /run/ostree-booted ]
}

install_gnome() {
  echo "[gnome] instalando extensão..."
  bash "$HOME/repos/nexus-plasm/scripts/setup-gnome.sh" "$HOME/repos/nexus-plasm" >/dev/null 2>&1 || true
  echo "[gnome] extensão instalada."
}

install_hyprland() {
  echo "[hyprland] copiando binds..."
  mkdir -p "$HOME/.config/hypr"
  cp "$HOME/repos/nexus-plasm/hypr/bindings.conf" "$HOME/.config/hypr/nexus-plasm-bindings.conf" 2>/dev/null || true
  echo "[hyprland] binds copiados para ~/.config/hypr/nexus-plasm-bindings.conf"
  echo "[hyprland] adicione 'source = ~/.config/hypr/nexus-plasm-bindings.conf' no final do hyprland.conf"
}

apply_macro_suggestions() {
  echo "[macros] sugerindo macros..."
  if command -v plasm >/dev/null 2>&1 || [ -x "$HOME/.local/bin/plasm" ]; then
    local suggestions
    suggestions=$("$HOME/.local/bin/plasm" macro-suggest 2>/dev/null || true)
    if [ -n "$suggestions" ]; then
      echo "$suggestions" | grep -o '"trigger":"[^"]*"' | sed 's/"trigger":"//;s/"$//' | while read -r trigger; do
        local action preset
        action=$(echo "$suggestions" | grep -A1 "\"trigger\":\"$trigger\"" | grep '"action":' | head -n1 | sed 's/.*"action":"//;s/".*//' || true)
        preset=$(echo "$suggestions" | grep -A3 "\"trigger\":\"$trigger\"" | grep '"preset":' | head -n1 | sed 's/.*"preset":"//;s/".*//' || true)
        if [ -n "$action" ]; then
          if [ -n "$preset" ]; then
            "$HOME/.local/bin/plasm" macro-add --trigger "$trigger" --action "$action" --preset "$preset" >/dev/null 2>&1 || true
          else
            "$HOME/.local/bin/plasm" macro-add --trigger "$trigger" --action "$action" >/dev/null 2>&1 || true
          fi
          echo "[macros] adicionada: $trigger -> $action"
        fi
      done
    fi
  fi
}

main() {
  clear
  echo "$ASCII_ART"
  echo "quick install"
  echo

  if [ ! -d "$HOME/repos/nexus-plasm" ]; then
    echo "ERRO: repo não encontrado em ~/repos/nexus-plasm"
    echo "Clone primeiro: git clone git@github.com:bbanho/nexus-plasm.git ~/repos/nexus-plasm"
    exit 1
  fi

  if is_immutable; then
    echo "Sistema imutável detectado. Instalação será user-local."
  fi

  local wm
  wm=$(detect_wm)
  echo "WM detectado: $wm"

  case "$wm" in
    gnome) install_gnome ;;
    hyprland) install_hyprland ;;
    *) echo "WM não suportado automaticamente. Use docs/GNOME_SETUP.md ou docs/HYPR_SETUP.md." ;;
  esac

  echo
  echo "[nexus-plasm] binário simbólico..."
  mkdir -p "$HOME/.local/bin"
  ln -sf "$HOME/repos/nexus-plasm/bin/plasm.js" "$HOME/.local/bin/plasm"
  chmod +x "$HOME/repos/nexus-plasm/bin/plasm.js"

  echo "[nexus-plasm] diretórios de estado..."
  mkdir -p "$HOME/.config/nexus-plasm" "$HOME/.local/share/nexus-plasm/logs"

  if [ ! -f "$HOME/.config/nexus-plasm/config.yaml" ]; then
    cp "$HOME/repos/nexus-plasm/config/config.yaml" "$HOME/.config/nexus-plasm/config.yaml"
    echo "[nexus-plasm] config.yaml copiado para ~/.config/nexus-plasm/"
  fi

  echo
  apply_macro_suggestions

  echo
  echo "========================================"
  echo " instalado"
  echo "========================================"
  echo
  echo "Próximo:"
  echo "  1) edite ~/.config/nexus-plasm/config.yaml"
  echo "  2) recarregue o WM ou faça logout/login"
  echo "  3) teste: plasm push && plasm pop"
  echo "  4) macros: plasm macro-suggest"
  echo
}

main "$@"
