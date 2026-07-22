#Requires -Version 5.1
# Simple Header Editor — Windows Installer / Updater
#
# Usage (remote, run in PowerShell):
#   irm https://raw.githubusercontent.com/druppio/ta-mod-headers/main/install.ps1 | iex
#
# Usage (local):
#   .\install.ps1
#
$ErrorActionPreference = 'Stop'

$REPO_OWNER = "druppio"
$REPO_NAME  = "ta-mod-headers"
$BRANCH     = "main"
$RAW_BASE   = "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/$BRANCH"

# ── Helpers ───────────────────────────────────────────────────────────────────
function info    { param($msg) Write-Host "  " -NoNewline; Write-Host "•" -ForegroundColor Cyan -NoNewline;   Write-Host "  $msg" }
function success { param($msg) Write-Host "  " -NoNewline; Write-Host "✓" -ForegroundColor Green -NoNewline;  Write-Host "  $msg" }
function warn    { param($msg) Write-Host "  " -NoNewline; Write-Host "!" -ForegroundColor Yellow -NoNewline; Write-Host "  $msg" }
function err     { param($msg) Write-Host "  " -NoNewline; Write-Host "✗" -ForegroundColor Red -NoNewline;    Write-Host "  $msg"; exit 1 }
function step    { param($msg) Write-Host "`n$msg" -ForegroundColor White }

# ── Detect local vs irm-pipe ──────────────────────────────────────────────────
$SCRIPT_DIR    = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { "" }
$LOCAL_INSTALL = $SCRIPT_DIR -and (Test-Path "$SCRIPT_DIR\manifest.json")

# ── Install directory ─────────────────────────────────────────────────────────
$INSTALL_DIR = "$env:USERPROFILE\Documents\SimpleHeaderEditor"

# ── Detect existing install & available version ───────────────────────────────
$INSTALLED_VERSION = ""
if (Test-Path "$INSTALL_DIR\manifest.json") {
    $INSTALLED_VERSION = (Get-Content "$INSTALL_DIR\manifest.json" -Raw | ConvertFrom-Json).version
}

$AVAILABLE_VERSION = "unknown"
try {
    if ($LOCAL_INSTALL) {
        $AVAILABLE_VERSION = (Get-Content "$SCRIPT_DIR\manifest.json" -Raw | ConvertFrom-Json).version
    } else {
        $AVAILABLE_VERSION = (Invoke-RestMethod "$RAW_BASE/manifest.json").version
    }
} catch { }

$IS_UPDATE = [bool]$INSTALLED_VERSION

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Simple Header Editor — $(if ($IS_UPDATE) { 'Updater' } else { 'Installer' })" -ForegroundColor White
Write-Host "  Platform : " -NoNewline; Write-Host "Windows" -ForegroundColor Cyan
if ($LOCAL_INSTALL) {
    Write-Host "  Source   : " -NoNewline; Write-Host "local ($SCRIPT_DIR)" -ForegroundColor Cyan
} else {
    Write-Host "  Source   : " -NoNewline; Write-Host "github.com/$REPO_OWNER/$REPO_NAME" -ForegroundColor Cyan
}
if ($IS_UPDATE) {
    Write-Host "  Installed: " -NoNewline; Write-Host "v$INSTALLED_VERSION" -ForegroundColor Yellow
    Write-Host "  Available: " -NoNewline; Write-Host "v$AVAILABLE_VERSION" -ForegroundColor Green
} else {
    Write-Host "  Version  : " -NoNewline; Write-Host "v$AVAILABLE_VERSION" -ForegroundColor Cyan
}
Write-Host ""

# ── Confirmation ──────────────────────────────────────────────────────────────
if ($IS_UPDATE) {
    Write-Host "  This will update your existing installation:" -ForegroundColor White
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "1." -ForegroundColor Cyan -NoNewline; Write-Host " Overwrite extension files in " -NoNewline; Write-Host $INSTALL_DIR -ForegroundColor White
    Write-Host "  " -NoNewline; Write-Host "2." -ForegroundColor Cyan -NoNewline; Write-Host " Open Chrome to " -NoNewline; Write-Host "chrome://extensions" -ForegroundColor White
    Write-Host ""
    Write-Host "  You will then need to click " -NoNewline; Write-Host "↺ Reload" -ForegroundColor White -NoNewline; Write-Host " on the Simple Header Editor card."
    Write-Host "  Your profiles and settings are stored in Chrome and will not be affected." -ForegroundColor Yellow
    Write-Host ""
    $CONFIRM = Read-Host "  Update to v${AVAILABLE_VERSION}? [y/N]"
} else {
    Write-Host "  This installer will:" -ForegroundColor White
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "1." -ForegroundColor Cyan -NoNewline; Write-Host " Download the extension files from GitHub"
    Write-Host "  " -NoNewline; Write-Host "2." -ForegroundColor Cyan -NoNewline; Write-Host " Copy them to " -NoNewline; Write-Host $INSTALL_DIR -ForegroundColor White
    Write-Host "  " -NoNewline; Write-Host "3." -ForegroundColor Cyan -NoNewline; Write-Host " Open Chrome to " -NoNewline; Write-Host "chrome://extensions" -ForegroundColor White
    Write-Host ""
    Write-Host "  You will then need to click " -NoNewline; Write-Host "Load unpacked" -ForegroundColor White -NoNewline; Write-Host " and select the folder above."
    Write-Host "  Nothing is modified outside your home directory." -ForegroundColor Yellow
    Write-Host ""
    $CONFIRM = Read-Host "  Proceed with installation? [y/N]"
}

Write-Host ""
if ($CONFIRM -notmatch '^[yY]') {
    Write-Host "  Cancelled." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# ── Find Chrome ───────────────────────────────────────────────────────────────
step "$(if ($IS_UPDATE) { '1/2' } else { '1/3' })  Locating Chrome"

$CHROME_BIN = $null
$chromeCandidates = @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Chromium\Application\chrome.exe"
)
foreach ($c in $chromeCandidates) {
    if ($c -and (Test-Path $c)) { $CHROME_BIN = $c; break }
}

if (-not $CHROME_BIN) { err "Chrome not found. Install Google Chrome and re-run." }
success "Found: $CHROME_BIN"

# ── Download or copy extension files ─────────────────────────────────────────
step "$(if ($IS_UPDATE) { '2/2' } else { '2/3' })  $(if ($IS_UPDATE) { 'Updating' } else { 'Installing' }) extension files"

$EXTENSION_FILES = @("manifest.json", "background.js", "popup.html", "popup.js", "popup.css")
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

if ($LOCAL_INSTALL) {
    foreach ($f in $EXTENSION_FILES) {
        $src = Join-Path $SCRIPT_DIR $f
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $INSTALL_DIR $f) -Force
        } else {
            warn "Missing local file: $f"
        }
    }
} else {
    info "Downloading from $RAW_BASE ..."
    foreach ($f in $EXTENSION_FILES) {
        try {
            Invoke-WebRequest "$RAW_BASE/$f" -OutFile (Join-Path $INSTALL_DIR $f) -UseBasicParsing
            info "Downloaded $f"
        } catch {
            err "Failed to download $f — check your connection and try again."
        }
    }
}

success "Files ready at: $INSTALL_DIR"

# ── Open Chrome ───────────────────────────────────────────────────────────────
if (-not $IS_UPDATE) { step "3/3  Opening Chrome" }

try {
    Start-Process "chrome://extensions"
} catch {
    Start-Process $CHROME_BIN "chrome://extensions"
}

Start-Sleep 1

# ── Final instructions ────────────────────────────────────────────────────────
Write-Host ""
Write-Host ("━" * 60) -ForegroundColor Green

if ($IS_UPDATE) {
    Write-Host "  Updated to v$AVAILABLE_VERSION — 1 click in Chrome:" -ForegroundColor White
    Write-Host ""
    Write-Host "  Click " -NoNewline; Write-Host "↺ Reload" -ForegroundColor White -NoNewline; Write-Host " on the " -NoNewline; Write-Host "Simple Header Editor" -ForegroundColor White -NoNewline; Write-Host " card."
    Write-Host ""
    Write-Host "  Your profiles and settings are untouched." -ForegroundColor Cyan
} else {
    Write-Host "  Almost done — 2 clicks in Chrome:" -ForegroundColor White
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "1." -ForegroundColor White -NoNewline; Write-Host " Enable " -NoNewline; Write-Host "Developer mode" -ForegroundColor White -NoNewline; Write-Host "  (toggle, top-right)"
    Write-Host "  " -NoNewline; Write-Host "2." -ForegroundColor White -NoNewline; Write-Host " Click " -NoNewline; Write-Host "Load unpacked" -ForegroundColor White -NoNewline; Write-Host "  and select:"
    Write-Host ""
    Write-Host "       $INSTALL_DIR" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Chrome requires this one manual step for unpacked extensions."
}

Write-Host ("━" * 60) -ForegroundColor Green
Write-Host ""
