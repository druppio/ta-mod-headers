# Simple Header Editor

A lightweight Chrome extension for modifying HTTP request and response headers — a clean, privacy-first alternative to ModHeader built on Manifest V3.

---

## Features

- **Request & response header modification** — add, edit, or disable headers per profile
- **Multiple profiles** — switch between named configurations instantly
- **URL filtering** — scope headers to specific domains or patterns
- **Autocomplete** — searchable dropdown of 50+ common headers ordered by usage
- **Dark / Light / System theme** — follows your OS by default, manually overridable
- **Export & Import** — share profiles as JSON files
- **Active/inactive icon** — toolbar icon changes when headers are being applied
- **No tracking, no remote calls** — all data stays in your browser

---

## Installation

### Quick install (macOS & Linux)

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/druppio/ta-mod-headers/main/install.sh)"
```

The script will:
1. Copy the extension to a permanent location (`~/Library/Application Support/SimpleHeaderEditor` on macOS)
2. Attempt to enable Developer mode via Chrome policy (macOS)
3. Open Chrome to `chrome://extensions`
4. Print the exact folder path to load

**Two clicks still required** (Chrome security restriction — no script can bypass this):
- Enable **Developer mode** (top-right toggle)
- Click **Load unpacked** → select the printed path

### From a Release

1. Go to the [Releases](../../releases) page and download the latest `simple-header-editor-vX.X.X.zip`
2. Unzip it and run `install.sh` — or follow the manual steps:
3. Open Chrome → `chrome://extensions`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** → select the unzipped folder

### From Source

```bash
git clone git@github.com:druppio/ta-mod-headers.git
cd ta-mod-headers && ./install.sh
```

---

## Usage

### Adding Headers

1. Click the **Simple Header Editor** icon in your Chrome toolbar
2. Click **+ Add** under **Request Headers** or **Response Headers**
3. Type a header name — an autocomplete dropdown suggests common headers
4. Fill in the value and press **Tab** to move to the next field
5. Headers are saved and applied instantly

### Profiles

| Action | How |
|--------|-----|
| Switch profile | Use the dropdown at the top |
| Enable / disable | Toggle the switch on the right of the profile bar |
| Add profile | Click **+** |
| Rename profile | Click **✎** |
| Delete profile | Click **×** |

When a profile is disabled the toolbar icon switches to its inactive (grey) state.

### URL Filtering

Leave the **URL Filter** field empty to apply headers to **all URLs**.

To scope to specific sites, use the `declarativeNetRequest` pattern syntax:

| Pattern | Matches |
|---------|---------|
| `\|\|example.com` | All requests to `example.com` and subdomains |
| `\|\|api.example.com/v2` | Requests to that path prefix |
| `\|https://example.com/\|` | Exact URL |
| *(empty)* | Everything |

### Export / Import Profiles

- **Export** — saves all profiles as a `.json` file you can share or back up
- **Import** — loads profiles from a previously exported `.json` file (replaces current profiles)

A ready-made test config for [modheader.com/headers](https://modheader.com/headers) is included in the repo as `test-modheader.json`.

### Theme Toggle

Click **◑** in the top-right of the popup to cycle through:

- **◑ System** — follows your OS dark/light preference (default)
- **☀ Light** — always light
- **☾ Dark** — always dark

Your preference is remembered across popup opens.

---

## Generating Icons (contributors)

The extension ships with pre-built icons in `icons/`. If you want to regenerate them:

1. Open `generate-icons.html` in Chrome (drag it into the address bar)
2. Click **Download all 6 icons**
3. Move the downloaded files into the `icons/` folder
4. Reload the extension at `chrome://extensions`

---

## Releasing a New Version

1. Update `"version"` in `manifest.json`
2. Commit and push, then create a tag:

```bash
git tag v1.1.0
git push origin v1.1.0
```

GitHub Actions will automatically build and publish a release with the extension zip attached.

You can also trigger a manual release from the **Actions** tab → **Release** → **Run workflow**.

---

## Tech

- **Manifest V3** Chrome Extension
- `declarativeNetRequest` API for header modification (no broad `webRequest` permissions)
- `OffscreenCanvas` for dynamic active/inactive toolbar icons
- `chrome.storage.local` for profile and theme persistence
- Zero dependencies, no build step

---

## License

MIT
