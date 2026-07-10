#!/usr/bin/env bash
# Simple Header Editor — Installer / Updater
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

# ── Detect local vs curl-pipe ─────────────────────────────────────────────────
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

# ── Install directory ─────────────────────────────────────────────────────────
if [[ "$PLATFORM" == "macOS" ]]; then
  INSTALL_DIR="$HOME/Documents/SimpleHeaderEditor"
else
  INSTALL_DIR="$HOME/simple-header-editor"
fi

# ── Checks ────────────────────────────────────────────────────────────────────
command -v curl &>/dev/null || error "curl is required but not installed."

# ── Detect existing install & version ────────────────────────────────────────
INSTALLED_VERSION=""
if [[ -f "$INSTALL_DIR/manifest.json" ]]; then
  INSTALLED_VERSION=$(grep '"version"' "$INSTALL_DIR/manifest.json" | sed 's/.*"\([0-9.]*\)".*/\1/' | head -1)
fi

# Fetch the available version from the source
AVAILABLE_VERSION=""
if [[ "$LOCAL_INSTALL" == true ]]; then
  AVAILABLE_VERSION=$(grep '"version"' "$SCRIPT_DIR/manifest.json" | sed 's/.*"\([0-9.]*\)".*/\1/' | head -1)
else
  AVAILABLE_VERSION=$(curl -fsSL "${RAW_BASE}/manifest.json" 2>/dev/null \
    | grep '"version"' | sed 's/.*"\([0-9.]*\)".*/\1/' | head -1) || true
fi

IS_UPDATE=false
[[ -n "$INSTALLED_VERSION" ]] && IS_UPDATE=true

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Simple Header Editor — $(if $IS_UPDATE; then echo "Updater"; else echo "Installer"; fi)${RESET}"
echo -e "  Platform : ${CYAN}${PLATFORM}${RESET}"
if [[ "$LOCAL_INSTALL" == true ]]; then
  echo -e "  Source   : ${CYAN}local (${SCRIPT_DIR})${RESET}"
else
  echo -e "  Source   : ${CYAN}github.com/${REPO_OWNER}/${REPO_NAME}${RESET}"
fi
if $IS_UPDATE; then
  echo -e "  Installed: ${YELLOW}v${INSTALLED_VERSION}${RESET}"
  echo -e "  Available: ${GREEN}v${AVAILABLE_VERSION}${RESET}"
else
  echo -e "  Version  : ${CYAN}v${AVAILABLE_VERSION}${RESET}"
fi
echo ""

# ── Confirmation ──────────────────────────────────────────────────────────────
if $IS_UPDATE; then
  echo -e "${BOLD}  This will update your existing installation:${RESET}"
  echo ""
  echo -e "  ${CYAN}1.${RESET} Overwrite extension files in ${BOLD}${INSTALL_DIR}${RESET}"
  echo -e "  ${CYAN}2.${RESET} Open Chrome to ${BOLD}chrome://extensions${RESET}"
  echo ""
  echo -e "  You will then need to click ${BOLD}↺ Reload${RESET} on the Simple Header Editor card."
  echo -e "  ${YELLOW}Your profiles and settings are stored in Chrome and will not be affected.${RESET}"
  echo ""
  read -r -p "  Update to v${AVAILABLE_VERSION}? [y/N] " CONFIRM
else
  echo -e "${BOLD}  This installer will:${RESET}"
  echo ""
  echo -e "  ${CYAN}1.${RESET} Download the extension files from GitHub"
  echo -e "  ${CYAN}2.${RESET} Copy them to ${BOLD}${INSTALL_DIR}${RESET}"
  echo -e "  ${CYAN}3.${RESET} Write a Chrome policy to pre-enable Developer mode"
  echo -e "  ${CYAN}4.${RESET} Open Chrome to ${BOLD}chrome://extensions${RESET}"
  echo ""
  echo -e "  You will then need to click ${BOLD}Load unpacked${RESET} and select the folder above."
  echo -e "  ${YELLOW}Nothing is modified outside your home directory.${RESET}"
  echo ""
  read -r -p "  Proceed with installation? [y/N] " CONFIRM
fi

echo ""
case "$CONFIRM" in
  [yY][eE][sS]|[yY]) ;;
  *) echo -e "  ${YELLOW}Cancelled.${RESET}\n"; exit 0 ;;
esac

# ── Find Chrome ───────────────────────────────────────────────────────────────
step "$(if $IS_UPDATE; then echo "1/3"; else echo "1/4"; fi)  Locating Chrome"

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

# ── Download or copy extension files ─────────────────────────────────────────
step "$(if $IS_UPDATE; then echo "2/3"; else echo "2/4"; fi)  $(if $IS_UPDATE; then echo "Updating"; else echo "Installing"; fi) extension files"

EXTENSION_FILES=(manifest.json background.js popup.html popup.js popup.css)
mkdir -p "$INSTALL_DIR"

if [[ "$LOCAL_INSTALL" == true ]]; then
  for f in "${EXTENSION_FILES[@]}"; do
    if [[ -f "$SCRIPT_DIR/$f" ]]; then
      cp "$SCRIPT_DIR/$f" "$INSTALL_DIR/$f"
    else
      warn "Missing local file: $f"
    fi
  done
else
  info "Downloading from ${RAW_BASE} ..."
  for f in "${EXTENSION_FILES[@]}"; do
    if curl -fsSL "${RAW_BASE}/${f}" -o "$INSTALL_DIR/$f"; then
      info "Downloaded $f"
    else
      error "Failed to download $f — check your connection and try again."
    fi
  done
fi

success "Files ready at: ${BOLD}${INSTALL_DIR}${RESET}"

# ── Configure Chrome (fresh install only) ─────────────────────────────────────
if ! $IS_UPDATE; then
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
fi

# ── Open Chrome ───────────────────────────────────────────────────────────────
step "$(if $IS_UPDATE; then echo "3/3"; else echo "4/4"; fi)  Opening Chrome"

if [[ "$PLATFORM" == "macOS" ]]; then
  open -a "Google Chrome" "chrome://extensions" 2>/dev/null || open "chrome://extensions" 2>/dev/null || true
else
  nohup "$CHROME_BIN" "chrome://extensions" &>/dev/null &
fi

sleep 1

# ── Final instructions ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if $IS_UPDATE; then
  echo -e "${BOLD}  Updated to v${AVAILABLE_VERSION} — 1 click in Chrome:${RESET}"
  echo ""
  echo -e "  Click ${BOLD}↺ Reload${RESET} on the ${BOLD}Simple Header Editor${RESET} card."
  echo ""
  echo -e "  ${CYAN}Your profiles and settings are untouched.${RESET}"
else
  echo -e "${BOLD}  Almost done — 2 clicks in Chrome:${RESET}"
  echo ""
  echo -e "  ${BOLD}1.${RESET} Enable ${BOLD}Developer mode${RESET}  (toggle, top-right)"
  echo -e "  ${BOLD}2.${RESET} Click ${BOLD}Load unpacked${RESET}  and select:"
  echo ""
  echo -e "       ${CYAN}${BOLD}${INSTALL_DIR}${RESET}"
  echo ""
  echo -e "  Chrome requires this one manual step for unpacked extensions."
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
