const ALL_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
];

// ── Icon drawing (OffscreenCanvas — no PNG files needed) ─────────────────────

const ICON_ACTIVE   = { bg: '#000579', arc: '#3699F1', barPrimary: '#3699F1', barSecondary: '#ffffff' };
const ICON_INACTIVE = { bg: '#4b5563', arc: '#9ca3af', barPrimary: '#d1d5db', barSecondary: '#d1d5db' };

function drawIcon(size, active) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const c      = active ? ICON_ACTIVE : ICON_INACTIVE;
  const r      = Math.round(size * 0.2);

  // Rounded rect background
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0,    size, size, r);
  ctx.arcTo(size, size, 0,    size, r);
  ctx.arcTo(0,    size, 0,    0,    r);
  ctx.arcTo(0,    0,    size, 0,    r);
  ctx.closePath();
  ctx.fillStyle = c.bg;
  ctx.fill();

  // TrustArc-inspired swoosh (≥ 48px only — too small to see at 16)
  if (size >= 48) {
    ctx.beginPath();
    ctx.moveTo(size * 0.13, size * 0.36);
    ctx.quadraticCurveTo(size * 0.5, size * 0.04, size * 0.87, size * 0.36);
    ctx.strokeStyle = c.arc;
    ctx.lineWidth   = size * 0.095;
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // Header bars
  const padX   = size * 0.17;
  const barH   = Math.max(1.5, size * 0.075);
  const startY = size >= 48 ? size * 0.49 : size * 0.22;
  const slot   = (size * 0.84 - startY) / 3;

  for (let i = 0; i < 3; i++) {
    const y  = startY + i * slot + (slot - barH) / 2;
    const w  = i === 0 ? (size - padX * 2) * 0.58 : size - padX * 2;
    const br = barH / 2;

    ctx.beginPath();
    ctx.moveTo(padX + br, y);
    ctx.arcTo(padX + w, y,      padX + w, y + barH, br);
    ctx.arcTo(padX + w, y + barH, padX, y + barH,   br);
    ctx.arcTo(padX,   y + barH, padX,   y,          br);
    ctx.arcTo(padX,   y,        padX + w, y,         br);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? c.barPrimary : c.barSecondary;
    ctx.fill();
  }

  return ctx.getImageData(0, 0, size, size);
}

async function setExtensionIcon(isActive) {
  try {
    await chrome.action.setIcon({
      imageData: {
        16:  drawIcon(16,  isActive),
        48:  drawIcon(48,  isActive),
        128: drawIcon(128, isActive)
      }
    });
  } catch {
    // Fallback to static files if OffscreenCanvas unavailable
    const s = isActive ? '' : '_inactive';
    chrome.action.setIcon({
      path: { 16: `icons/icon16${s}.png`, 48: `icons/icon48${s}.png`, 128: `icons/icon128${s}.png` }
    }).catch(() => {});
  }
}

// ── Rule application ─────────────────────────────────────────────────────────

async function applyRules() {
  const { profiles = [] } = await chrome.storage.local.get('profiles');

  const existing     = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  const newRules = [];
  let ruleId = 1;

  for (const profile of profiles) {
    if (!profile.enabled) continue;

    const requestHeaders = (profile.requestHeaders || [])
      .filter(h => h.enabled && h.name.trim())
      .map(h => ({ header: h.name.trim(), operation: 'set', value: h.value }));

    const responseHeaders = (profile.responseHeaders || [])
      .filter(h => h.enabled && h.name.trim())
      .map(h => ({ header: h.name.trim(), operation: 'set', value: h.value }));

    if (!requestHeaders.length && !responseHeaders.length) continue;

    const condition = { resourceTypes: ALL_RESOURCE_TYPES };
    if (profile.urlFilter && profile.urlFilter.trim()) {
      condition.urlFilter = profile.urlFilter.trim();
    }

    const rule = {
      id: ruleId++,
      priority: 1,
      action: { type: 'modifyHeaders' },
      condition
    };

    if (requestHeaders.length) rule.action.requestHeaders = requestHeaders;
    if (responseHeaders.length) rule.action.responseHeaders = responseHeaders;

    newRules.push(rule);
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: newRules });
  } catch {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
    for (const rule of newRules) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [], addRules: [rule] });
      } catch { /* skip invalid rule */ }
    }
  }

  // Icon reflects whether any profile is enabled (not just whether rules exist)
  const isActive = profiles.some(p => p.enabled);
  await setExtensionIcon(isActive);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.profiles) applyRules();
});

chrome.runtime.onInstalled.addListener(async () => {
  const { profiles } = await chrome.storage.local.get('profiles');
  if (!profiles) {
    await chrome.storage.local.set({
      profiles: [{
        id: makeId(),
        name: 'Default Profile',
        enabled: true,
        urlFilter: '',
        requestHeaders: [],
        responseHeaders: []
      }]
    });
  }
  await applyRules();
});
