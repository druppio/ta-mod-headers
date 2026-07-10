#!/usr/bin/env bash
# Simple Header Editor — Installer
#
# Usage (remote):
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/druppio/ta-mod-headers/main/install.sh)"
#
# Usage (local):
#   ./install.sh
#
set -euo pipefail

REPO_OWNER="druppio"
REPO_NAME="ta-mod-headers"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "  ${CYAN}•${RESET}  $*"; }
success() { echo -e "  ${GREEN}✓${RESET}  $*"; }
warn()    { echo -e "  ${YELLOW}!${RESET}  $*"; }
error()   { echo -e "  ${RED}✗${RESET}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}$*${RESET}"; }

# ── Detect if running locally or via curl pipe ────────────────────────────────
SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" && -f "${BASH_SOURCE[0]:-/dev/null}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

LOCAL_INSTALL=false
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/manifest.json" ]]; then
  LOCAL_INSTALL=true
fi

# ── Detect OS ─────────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="macOS" ;;
  Linux)  PLATFORM="Linux" ;;
  *)      error "Unsupported OS: $OS. This script supports macOS and Linux." ;;
esac

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Simple Header Editor — Installer${RESET}"
echo -e "  Platform : ${CYAN}${PLATFORM}${RESET}"
if [[ "$LOCAL_INSTALL" == true ]]; then
  echo -e "  Source   : ${CYAN}local (${SCRIPT_DIR})${RESET}"
else
  echo -e "  Source   : ${CYAN}github.com/${REPO_OWNER}/${REPO_NAME}${RESET}"
fi
echo ""

# ── Checks ────────────────────────────────────────────────────────────────────
command -v curl &>/dev/null || error "curl is required but not installed."

# ── Confirmation ──────────────────────────────────────────────────────────────
if [[ "$PLATFORM" == "macOS" ]]; then
  PREVIEW_DIR="$HOME/Documents/SimpleHeaderEditor"
else
  PREVIEW_DIR="$HOME/simple-header-editor"
fi

echo -e "${BOLD}  This installer will:${RESET}"
echo ""
echo -e "  ${CYAN}1.${RESET} Download the extension files from GitHub"
echo -e "  ${CYAN}2.${RESET} Copy them to ${BOLD}${PREVIEW_DIR}${RESET}"
echo -e "  ${CYAN}3.${RESET} Write a Chrome policy to pre-enable Developer mode"
echo -e "  ${CYAN}4.${RESET} Open Chrome to ${BOLD}chrome://extensions${RESET}"
echo ""
echo -e "  You will then need to click ${BOLD}Load unpacked${RESET} and select the folder above."
echo -e "  ${YELLOW}Nothing is modified outside your home directory.${RESET}"
echo ""

read -r -p "  Proceed with installation? [y/N] " CONFIRM
echo ""

case "$CONFIRM" in
  [yY][eE][sS]|[yY]) ;;
  *) echo -e "  ${YELLOW}Installation cancelled.${RESET}\n"; exit 0 ;;
esac

# ── Find Chrome ───────────────────────────────────────────────────────────────
step "1/4  Locating Chrome"

CHROME_BIN=""
if [[ "$PLATFORM" == "macOS" ]]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  do
    if [[ -x "$candidate" ]]; then CHROME_BIN="$candidate"; break; fi
  done
else
  for candidate in google-chrome google-chrome-stable chromium-browser chromium; do
    if command -v "$candidate" &>/dev/null; then CHROME_BIN="$candidate"; break; fi
  done
fi

[[ -z "$CHROME_BIN" ]] && error "Chrome not found. Install Google Chrome and re-run."
success "Found: $CHROME_BIN"

# ── Install directory ─────────────────────────────────────────────────────────
if [[ "$PLATFORM" == "macOS" ]]; then
  INSTALL_DIR="$HOME/Documents/SimpleHeaderEditor"
else
  INSTALL_DIR="$HOME/simple-header-editor"
fi

mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/icons"

# ── Download or copy extension files ─────────────────────────────────────────
step "2/4  Installing extension files"

EXTENSION_FILES=(manifest.json background.js popup.html popup.js popup.css)
ICON_FILES=(icon16.png icon48.png icon128.png icon16_inactive.png icon48_inactive.png icon128_inactive.png)

if [[ "$LOCAL_INSTALL" == true ]]; then
  # ── Local copy ──────────────────────────────────────────────────
  for f in "${EXTENSION_FILES[@]}"; do
    if [[ -f "$SCRIPT_DIR/$f" ]]; then
      cp "$SCRIPT_DIR/$f" "$INSTALL_DIR/$f"
    else
      warn "Missing local file: $f"
    fi
  done

  HAS_ICONS=false
  for f in "${ICON_FILES[@]}"; do
    if [[ -f "$SCRIPT_DIR/icons/$f" ]]; then
      cp "$SCRIPT_DIR/icons/$f" "$INSTALL_DIR/icons/$f"
      HAS_ICONS=true
    fi
  done
else
  # ── Remote download ─────────────────────────────────────────────
  info "Downloading from ${RAW_BASE} ..."
  for f in "${EXTENSION_FILES[@]}"; do
    if curl -fsSL "${RAW_BASE}/${f}" -o "$INSTALL_DIR/$f"; then
      info "Downloaded $f"
    else
      error "Failed to download $f — check your connection and try again."
    fi
  done

  HAS_ICONS=false
  for f in "${ICON_FILES[@]}"; do
    if curl -fsSL "${RAW_BASE}/icons/${f}" -o "$INSTALL_DIR/icons/$f" 2>/dev/null; then
      HAS_ICONS=true
    fi
  done
fi

success "Extension files ready at: ${BOLD}${INSTALL_DIR}${RESET}"

if [[ "$HAS_ICONS" == false ]]; then
  warn "Icons not found — Chrome will use a default icon."
  warn "Open generate-icons.html in Chrome, download the PNGs, and re-run this script."
fi

# ── Enable Developer mode via Chrome policy (macOS) ───────────────────────────
step "3/4  Configuring Chrome"

if [[ "$PLATFORM" == "macOS" ]]; then
  POLICY_DIR="$HOME/Library/Application Support/Google/Chrome/Managed Preferences"
  mkdir -p "$POLICY_DIR"
  POLICY_FILE="$POLICY_DIR/com.google.Chrome.extensions.json"

  if [[ ! -f "$POLICY_FILE" ]]; then
    printf '{\n  "ExtensionDeveloperModeAllowed": true\n}\n' > "$POLICY_FILE"
    success "Developer mode policy written"
  else
    success "Developer mode policy already in place"
  fi

  defaults write com.google.Chrome ExtensionDeveloperModeAllowed -bool true 2>/dev/null || true
else
  info "Linux: enable Developer mode manually (top-right toggle on chrome://extensions)"
fi

# ── Open Chrome ───────────────────────────────────────────────────────────────
step "4/4  Opening Chrome"

if [[ "$PLATFORM" == "macOS" ]]; then
  open -a "Google Chrome" "chrome://extensions" 2>/dev/null || open "chrome://extensions" 2>/dev/null || true
else
  nohup "$CHROME_BIN" "chrome://extensions" &>/dev/null &
fi

sleep 1

# ── Final instructions ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Almost done — 2 clicks in Chrome:${RESET}"
echo ""
echo -e "  ${BOLD}1.${RESET} Enable ${BOLD}Developer mode${RESET}  (toggle, top-right)"
echo -e "  ${BOLD}2.${RESET} Click ${BOLD}Load unpacked${RESET}  and select:"
echo ""
echo -e "       ${CYAN}${BOLD}${INSTALL_DIR}${RESET}"
echo ""
echo -e "  Chrome requires this one manual step for unpacked extensions."
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
