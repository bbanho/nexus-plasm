#!/usr/bin/env bash
set -euo pipefail

# nexus-plasm TUI Wizard
# Navegação: ↑��� navega, SPACE seleciona/desseleciona, ENTER confirma/avança

APP_NAME="nexus-plasm"
REPO_ROOT="$HOME/repos/nexus-plasm"
EXT_UUID="nexus-plasm@bbanho"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/${EXT_UUID}"
PLASM_BIN="$HOME/.local/bin/plasm"
CONFIG_DIR="$HOME/.config/nexus-plasm"
STATE_DIR="$HOME/.local/share/nexus-plasm"
LOG_DIR="$STATE_DIR/logs"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Estado do wizard
SELECTED_ITEMS=()
CURRENT_STEP=0
CURSOR_POS=0

# Configuração das etapas
STEPS=(
  "welcome"
  "detect_env"
  "choose_components"
  "configure_paths"
  "install"
  "finish"
)

# Componentes disponíveis
COMPONENTS=(
  "binary_link:Link simbólico ~/.local/bin/plasm:1"
  "config:Configuração padrão ~/.config/nexus-plasm:1"
  "state_dirs:Diretórios de estado ~/.local/share/nexus-plasm:1"
  "gnome_extension:Extensão GNOME Shell:0"
  "hyprland_binds:Binds Hyprland:0"
  "macro_suggestions:Aplicar sugestões de macros:0"
)

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

# Funções TUI
clear_screen() {
  printf '\033[2J\033[H'
}

hide_cursor() {
  printf '\033[?25l'
}

show_cursor() {
  printf '\033[?25h'
}

save_cursor() {
  printf '\033[s'
}

restore_cursor() {
  printf '\033[u'
}

move_cursor() {
  local row=$1
  local col=$2
  printf '\033[%d;%dH' "$row" "$col"
}

draw_box() {
  local x=$1 y=$2 w=$3 h=$4 title=$5
  local i
  move_cursor "$y" "$x"
  printf '��%*s��' "$((w-2))" | tr ' ' '─'
  for ((i=1; i<h-1; i++)); do
    move_cursor "$((y+i))" "$x"
    printf '│%*s│' "$((w-2))"
  done
  move_cursor "$((y+h-1))" "$x"
  printf '��%*s��' "$((w-2))" | tr ' ' '─'
  if [ -n "$title" ]; then
    move_cursor "$y" "$((x+2))"
    printf ' %s ' "$title"
  fi
}

print_centered() {
  local y=$1 text=$2 width=$3
  local x=$(( (width - ${#text}) / 2 ))
  move_cursor "$y" "$x"
  printf '%s' "$text"
}

# Desenha tela de boas-vindas
draw_welcome() {
  clear_screen
  local width=70 height=20
  local x=$(( (COLUMNS - width) / 2 ))
  local y=$(( (LINES - height) / 2 ))
  
  draw_box "$x" "$y" "$width" "$height" " nexus-plasm TUI Wizard "
  
  local art=(
    "    _   _                      ____ _     ___   "
    "   | \ | | _____  ___   _ ___  / ___| |   |_ _|  "
    "   |  \| |/ _ \ \/ / | | / __|| |   | |    | |   "
    "   | |\  |  __/>  <| |_| \__ \| |___| |___ | |   "
    "   |_| \_|\___/_/\_\__,_|___/ \____|_____|___|  "
  )
  
  local start_y=$((y + 3))
  for i in "${!art[@]}"; do
    move_cursor "$((start_y + i))" "$((x + 5))"
    printf '%s' "${art[i]}"
  done
  
  move_cursor "$((start_y + 6))" "$((x + 5))"
  printf '%sClipboard FIFO + LLM Processor%s' "$CYAN" "$NC"
  
  move_cursor "$((y + height - 3))" "$((x + 2))"
  printf 'Pressione %sENTER%s para continuar...' "$BOLD" "$NC"
  
  read -r
}

# Detecta ambiente
draw_detect_env() {
  clear_screen
  local width=70 height=20
  local x=$(( (COLUMNS - width) / 2 ))
  local y=$(( (LINES - height) / 2 ))
  
  draw_box "$x" "$y" "$width" "$height" " Detecção de Ambiente "
  
  local wm=$(detect_wm)
  local immutable=false
  if is_immutable; then
    immutable=true
  fi
  
  move_cursor "$((y + 3))" "$((x + 3))"
  printf 'WM detectado: %s%s%s' "$GREEN" "$wm" "$NC"
  
  move_cursor "$((y + 5))" "$((x + 3))"
  if [ "$immutable" = true ]; then
    printf 'Sistema: %sImutável (rpm-ostree)%s' "$YELLOW" "$NC"
  else
    printf 'Sistema: %sMutável%s' "$GREEN" "$NC"
  fi
  
  move_cursor "$((y + 7))" "$((x + 3))"
  printf 'Repo: %s' "$REPO_ROOT"
  if [ -d "$REPO_ROOT" ]; then
    printf ' %s���%s' "$GREEN" "$NC"
  else
    printf ' %s��� NÃO ENCONTRADO%s' "$RED" "$NC"
  fi
  
  move_cursor "$((y + 9))" "$((x + 3))"
  printf 'Binário plasm: %s' "$PLASM_BIN"
  
  move_cursor "$((y + height - 3))" "$((x + 2))"
  printf 'Pressione %sENTER%s para continuar...' "$BOLD" "$NC"
  
  read -r
  WM="$wm"
  IMMUTABLE="$immutable"
}

# Desenha seleção de componentes
draw_choose_components() {
  local redraw=true
  while [ "$redraw" = true ]; do
    clear_screen
    local width=70 height=22
    local x=$(( (COLUMNS - width) / 2 ))
    local y=$(( (LINES - height) / 2 ))
    
    draw_box "$x" "$y" "$width" "$height" " Seleção de Componentes "
    
    move_cursor "$((y + 2))" "$((x + 3))"
    printf '%s������%s navega  %sSPACE%s seleciona  %sENTER%s confirma' "$CYAN" "$NC" "$CYAN" "$NC" "$CYAN" "$NC"
    
    local i
    for i in "${!COMPONENTS[@]}"; do
      local comp="${COMPONENTS[i]}"
      local IFS=':'
      read -r id desc enabled <<< "$comp"
      
      local selected=false
      for s in "${SELECTED_ITEMS[@]}"; do
        if [ "$s" = "$id" ]; then
          selected=true
          break
        fi
      done
      
      local row=$((y + 4 + i))
      move_cursor "$row" "$((x + 3))"
      
      if [ "$i" -eq "$CURSOR_POS" ]; then
        printf '%s�� %s%s' "$BOLD" "$NC" "$NC"
      else
        printf '  '
      fi
      
      if [ "$selected" = true ]; then
        printf '%s[���]%s ' "$GREEN" "$NC"
      else
        printf '[ ] '
      fi
      
      printf '%s' "$desc"
      
      # Marcar obrigatórios
      if [ "$enabled" = "1" ]; then
        printf ' %s(obrigatório)%s' "$YELLOW" "$NC"
      fi
    done
    
    move_cursor "$((y + height - 3))" "$((x + 2))"
    printf '%sENTER%s para confirmar seleção' "$BOLD" "$NC"
    
    # Lê tecla
    local key
    IFS= read -rsn1 key
    if [ "$key" = $'\x1b' ]; then
      read -rsn2 key
      case "$key" in
        '[A') # Up
          if [ "$CURSOR_POS" -gt 0 ]; then
            CURSOR_POS=$((CURSOR_POS - 1))
          fi
          ;;
        '[B') # Down
          if [ "$CURSOR_POS" -lt $((${#COMPONENTS[@]} - 1)) ]; then
            CURSOR_POS=$((CURSOR_POS + 1))
          fi
          ;;
      esac
    elif [ "$key" = ' ' ]; then # Space
      local comp="${COMPONENTS[CURSOR_POS]}"
      local IFS=':'
      read -r id desc enabled <<< "$comp"
      
      if [ "$enabled" = "1" ]; then
        # Obrigatório - não pode desmarcar
        continue
      fi
      
      local found=false
      local new_selected=()
      for s in "${SELECTED_ITEMS[@]}"; do
        if [ "$s" = "$id" ]; then
          found=true
        else
          new_selected+=("$s")
        fi
      done
      
      if [ "$found" = false ]; then
        new_selected+=("$id")
      fi
      SELECTED_ITEMS=("${new_selected[@]}")
    elif [ "$key" = '' ]; then # Enter
      redraw=false
    fi
  done
}

# Confirma caminhos
draw_configure_paths() {
  clear_screen
  local width=70 height=20
  local x=$(( (COLUMNS - width) / 2 ))
  local y=$(( (LINES - height) / 2 ))
  
  draw_box "$x" "$y" "$width" "$height" " Configuração de Caminhos "
  
  move_cursor "$((y + 2))" "$((x + 3))"
  printf 'Os seguintes caminhos serão usados:'
  
  local paths=(
    "Binário: $PLASM_BIN"
    "Config:  $CONFIG_DIR"
    "Estado:  $STATE_DIR"
    "Logs:    $LOG_DIR"
  )
  
  local i
  for i in "${!paths[@]}"; do
    move_cursor "$((y + 4 + i))" "$((x + 5))"
    printf '%s' "${paths[i]}"
  done
  
  move_cursor "$((y + height - 5))" "$((x + 3))"
  printf 'Deseja alterar algum caminho? %s[n]%s/' "$BOLD" "$NC"
  printf ' %sENTER%s para continuar com padrões' "$BOLD" "$NC"
  
  read -r
}

# Executa instalação
draw_install() {
  clear_screen
  local width=70 height=22
  local x=$(( (COLUMNS - width) / 2 ))
  local y=$(( (LINES - height) / 2 ))
  
  draw_box "$x" "$y" "$width" "$height" " Instalação "
  
  local steps=(
    "Criando diretórios..."
    "Instalando binário..."
    "Copiando configuração..."
  )
  
  # Adiciona passos baseados na seleção
  for comp in "${SELECTED_ITEMS[@]}"; do
    case "$comp" in
      "gnome_extension") steps+=("Instalando extensão GNOME...") ;;
      "hyprland_binds") steps+=("Copiando binds Hyprland...") ;;
      "macro_suggestions") steps+=("Aplicando sugestões de macros...") ;;
    esac
  done
  
  steps+=("Finalizando...")
  
  local i
  for i in "${!steps[@]}"; do
    move_cursor "$((y + 3 + i))" "$((x + 3))"
    printf '[ ] %s' "${steps[i]}"
  done
  
  move_cursor "$((y + height - 3))" "$((x + 3))"
  printf 'Instalando...'
  
  # Executa instalação real
  ensure_dirs
  
  # 1. Diretórios
  move_cursor "$((y + 3))" "$((x + 3))"
  printf '[%s���%s] Criando diretórios...' "$GREEN" "$NC"
  
  # 2. Binário
  move_cursor "$((y + 4))" "$((x + 3))"
  printf '[ ] Instalando binário...'
  mkdir -p "$HOME/.local/bin"
  ln -sf "$REPO_ROOT/bin/plasm.js" "$PLASM_BIN"
  chmod +x "$REPO_ROOT/bin/plasm.js"
  move_cursor "$((y + 4))" "$((x + 3))"
  printf '[%s���%s] Instalando binário...' "$GREEN" "$NC"
  
  # 3. Config
  move_cursor "$((y + 5))" "$((x + 3))"
  printf '[ ] Copiando configuração...'
  if [ ! -f "$CONFIG_DIR/config.yaml" ]; then
    cp "$REPO_ROOT/config/config.yaml" "$CONFIG_DIR/config.yaml"
  fi
  move_cursor "$((y + 5))" "$((x + 3))"
  printf '[%s���%s] Copiando configuração...' "$GREEN" "$NC"
  
  local step_idx=6
  # Componentes opcionais
  for comp in "${SELECTED_ITEMS[@]}"; do
    move_cursor "$((y + step_idx))" "$((x + 3))"
    case "$comp" in
      "gnome_extension")
        printf '[ ] Instalando extensão GNOME...'
        if [ "$WM" = "gnome" ]; then
          rm -rf "$EXT_DIR"
          mkdir -p "$EXT_DIR"
          cp "$REPO_ROOT/gnome-extension/"* "$EXT_DIR/"
          if command -v gnome-extensions >/dev/null 2>&1; then
            gnome-extensions enable "$EXT_UUID" || true
          fi
        fi
        move_cursor "$((y + step_idx))" "$((x + 3))"
        printf '[%s���%s] Instalando extensão GNOME...' "$GREEN" "$NC"
        ;;
      "hyprland_binds")
        printf '[ ] Copiando binds Hyprland...'
        mkdir -p "$HOME/.config/hypr"
        cp "$REPO_ROOT/hypr/bindings.conf" "$HOME/.config/hypr/nexus-plasm-bindings.conf" 2>/dev/null || true
        move_cursor "$((y + step_idx))" "$((x + 3))"
        printf '[%s���%s] Copiando binds Hyprland...' "$GREEN" "$NC"
        ;;
      "macro_suggestions")
        printf '[ ] Aplicando sugestões de macros...'
        if [ -x "$PLASM_BIN" ]; then
          local suggestions
          suggestions=$("$PLASM_BIN" macro-suggest 2>/dev/null || echo '{}')
          echo "$suggestions" | grep -o '"trigger":"[^"]*"' | sed 's/"trigger":"//;s/"$//' | while read -r trigger; do
            local action preset
            action=$(echo "$suggestions" | grep -A1 "\"trigger\":\"$trigger\"" | grep '"action":' | head -n1 | sed 's/.*"action":"//;s/".*//' || true)
            preset=$(echo "$suggestions" | grep -A3 "\"trigger\":\"$trigger\"" | grep '"preset":' | head -n1 | sed 's/.*"preset":"//;s/".*//' || true)
            if [ -n "$action" ]; then
              if [ -n "$preset" ]; then
                "$PLASM_BIN" macro-add --trigger "$trigger" --action "$action" --preset "$preset" >/dev/null 2>&1 || true
              else
                "$PLASM_BIN" macro-add --trigger "$trigger" --action "$action" >/dev/null 2>&1 || true
              fi
            fi
          done
        fi
        move_cursor "$((y + step_idx))" "$((x + 3))"
        printf '[%s���%s] Aplicando sugestões de macros...' "$GREEN" "$NC"
        ;;
    esac
    step_idx=$((step_idx + 1))
  done
  
  move_cursor "$((y + step_idx))" "$((x + 3))"
  printf '[%s���%s] Finalizando...' "$GREEN" "$NC"
  
  sleep 1
}

# Tela final
draw_finish() {
  clear_screen
  local width=70 height=20
  local x=$(( (COLUMNS - width) / 2 ))
  local y=$(( (LINES - height) / 2 ))
  
  draw_box "$x" "$y" "$width" "$height" " Concluído "
  
  move_cursor "$((y + 3))" "$((x + 3))"
  printf '%s��� Instalação concluída com sucesso!%s' "$GREEN" "$NC"
  
  move_cursor "$((y + 5))" "$((x + 3))"
  printf 'Componentes instalados:'
  
  local items=(
    "��� Binário: $PLASM_BIN"
    "��� Config:  $CONFIG_DIR"
    "��� Estado:  $STATE_DIR"
  )
  
  for comp in "${SELECTED_ITEMS[@]}"; do
    case "$comp" in
      "gnome_extension") items+=("��� Extensão GNOME: $EXT_DIR") ;;
      "hyprland_binds") items+=("��� Binds Hyprland: ~/.config/hypr/nexus-plasm-bindings.conf") ;;
      "macro_suggestions") items+=("��� Macros aplicadas") ;;
    esac
  done
  
  local i
  for i in "${!items[@]}"; do
    move_cursor "$((y + 7 + i))" "$((x + 5))"
    printf '%s' "${items[i]}"
  done
  
  move_cursor "$((y + height - 5))" "$((x + 3))"
  printf 'Próximos passos:'
  move_cursor "$((y + height - 4))" "$((x + 5))"
  printf '1) Edite ~/.config/nexus-plasm/config.yaml (adicione GEMINI_API_KEY se necessário)'
  move_cursor "$((y + height - 3))" "$((x + 5))"
  if [ "$WM" = "gnome" ]; then
    printf '2) Recarregue GNOME: Alt+F2 → r → Enter'
    move_cursor "$((y + height - 2))" "$((x + 5))"
    printf '3) Habilite extensão em https://extensions.gnome.org/local/'
  else
    printf '2) Adicione "source = ~/.config/hypr/nexus-plasm-bindings.conf" no hyprland.conf'
    move_cursor "$((y + height - 2))" "$((x + 5))"
    printf '3) Recarregue Hyprland: hyprctl reload'
  fi
  
  move_cursor "$((y + height - 1))" "$((x + 2))"
  printf 'Pressione %sENTER%s para sair' "$BOLD" "$NC"
  
  read -r
  clear_screen
  show_cursor
}

ensure_dirs() {
  mkdir -p "$CONFIG_DIR" "$STATE_DIR" "$LOG_DIR"
  mkdir -p "$HOME/.local/share/gnome-shell/extensions"
}

cleanup() {
  show_cursor
  clear_screen
}

trap cleanup EXIT INT TERM

main() {
  hide_cursor
  
  # Verifica repo
  if [ ! -d "$REPO_ROOT" ]; then
    echo "ERRO: repo não encontrado em $REPO_ROOT"
    echo "Clone primeiro: git clone git@github.com:bbanho/nexus-plasm.git $REPO_ROOT"
    exit 1
  fi
  
  # Inicializa seleção com obrigatórios
  for comp in "${COMPONENTS[@]}"; do
    local IFS=':'
    read -r id desc enabled <<< "$comp"
    if [ "$enabled" = "1" ]; then
      SELECTED_ITEMS+=("$id")
    fi
  done
  
  # Adiciona componentes baseados no WM
  local wm=$(detect_wm)
  if [ "$wm" = "gnome" ]; then
    SELECTED_ITEMS+=("gnome_extension")
  elif [ "$wm" = "hyprland" ]; then
    SELECTED_ITEMS+=("hyprland_binds")
  fi
  
  draw_welcome
  draw_detect_env
  draw_choose_components
  draw_configure_paths
  draw_install
  draw_finish
}

main "$@"