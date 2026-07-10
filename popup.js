const HEADER_SUGGESTIONS = {
  request: [
    'Authorization', 'Content-Type', 'Accept', 'Origin', 'Referer',
    'User-Agent', 'Cookie', 'X-Api-Key', 'X-Auth-Token', 'X-Requested-With',
    'X-CSRF-Token', 'X-Forwarded-For', 'X-Real-IP', 'X-Correlation-ID',
    'X-Request-ID', 'X-Client-ID', 'Accept-Language', 'Accept-Encoding',
    'Cache-Control', 'Pragma', 'If-None-Match', 'If-Modified-Since',
    'Range', 'Host', 'Connection', 'Content-Length', 'Content-Encoding',
    'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'Sec-Fetch-Dest', 'DNT'
  ],
  response: [
    'Access-Control-Allow-Origin', 'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers', 'Access-Control-Allow-Credentials',
    'Access-Control-Expose-Headers', 'Access-Control-Max-Age',
    'Content-Type', 'Content-Security-Policy', 'Content-Security-Policy-Report-Only',
    'Referrer-Policy', 'X-Frame-Options', 'X-Content-Type-Options',
    'Strict-Transport-Security', 'Permissions-Policy', 'Cache-Control',
    'X-XSS-Protection', 'Set-Cookie', 'Location', 'WWW-Authenticate',
    'ETag', 'Last-Modified', 'Vary', 'Content-Encoding', 'Content-Length',
    'Server', 'X-Powered-By'
  ]
};

let profiles = [];
let currentProfileIndex = 0;
let saveTimer = null;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createProfile(name) {
  return { id: makeId(), name, enabled: true, urlFilter: '', requestHeaders: [], responseHeaders: [] };
}

function createHeader() {
  return { id: makeId(), name: '', value: '', enabled: true };
}

function getCurrentProfile() {
  return profiles[currentProfileIndex];
}

async function save() {
  await chrome.storage.local.set({ profiles });
  showStatus('Saved');
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

function showStatus(msg) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; }, 1500);
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function init() {
  const data = await chrome.storage.local.get('profiles');
  profiles = data.profiles || [];

  if (!profiles.length) {
    profiles = [createProfile('Default Profile')];
    await save();
  }

  renderProfileSelect();
  renderCurrentProfile();
}

function renderProfileSelect() {
  const select = document.getElementById('profileSelect');
  select.innerHTML = '';
  profiles.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.enabled ? p.name : `○ ${p.name}`;
    if (i === currentProfileIndex) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderCurrentProfile() {
  const profile = getCurrentProfile();
  if (!profile) return;

  document.getElementById('profileEnabled').checked = profile.enabled;
  document.getElementById('urlFilter').value = profile.urlFilter || '';
  document.querySelector('.container').classList.toggle('profile-off', !profile.enabled);

  renderHeadersList('requestHeadersList', profile.requestHeaders, 'request');
  renderHeadersList('responseHeadersList', profile.responseHeaders, 'response');
}

function renderHeadersList(containerId, headers, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!headers.length) {
    container.innerHTML = '<div class="empty-state">No headers — click + Add</div>';
    return;
  }

  headers.forEach((header, index) => {
    const row = document.createElement('div');
    row.className = `header-row${header.enabled ? '' : ' row-disabled'}`;
    row.innerHTML = `
      <input type="checkbox" class="header-checkbox" ${header.enabled ? 'checked' : ''} data-type="${type}" data-index="${index}">
      <input type="text" class="header-name" value="${escapeAttr(header.name)}" placeholder="Name" data-type="${type}" data-index="${index}" spellcheck="false" autocomplete="off">
      <input type="text" class="header-value" value="${escapeAttr(header.value)}" placeholder="Value" data-type="${type}" data-index="${index}" spellcheck="false">
      <button class="delete-btn" data-type="${type}" data-index="${index}" title="Remove">×</button>
    `;
    container.appendChild(row);
  });
}

// --- Profile controls ---

document.getElementById('profileSelect').addEventListener('change', e => {
  currentProfileIndex = parseInt(e.target.value, 10);
  renderCurrentProfile();
});

document.getElementById('addProfileBtn').addEventListener('click', async () => {
  const name = prompt('Profile name:', `Profile ${profiles.length + 1}`);
  if (!name || !name.trim()) return;
  profiles.push(createProfile(name.trim()));
  currentProfileIndex = profiles.length - 1;
  await save();
  renderProfileSelect();
  renderCurrentProfile();
});

document.getElementById('renameProfileBtn').addEventListener('click', async () => {
  const name = prompt('Rename profile:', getCurrentProfile().name);
  if (!name || !name.trim()) return;
  getCurrentProfile().name = name.trim();
  await save();
  renderProfileSelect();
});

document.getElementById('deleteProfileBtn').addEventListener('click', async () => {
  if (profiles.length <= 1) { alert('Cannot delete the last profile.'); return; }
  if (!confirm(`Delete "${getCurrentProfile().name}"?`)) return;
  profiles.splice(currentProfileIndex, 1);
  currentProfileIndex = Math.min(currentProfileIndex, profiles.length - 1);
  await save();
  renderProfileSelect();
  renderCurrentProfile();
});

document.getElementById('profileEnabled').addEventListener('change', async e => {
  getCurrentProfile().enabled = e.target.checked;
  document.querySelector('.container').classList.toggle('profile-off', !e.target.checked);
  renderProfileSelect();
  await save();
});

// URL filter
document.getElementById('urlFilter').addEventListener('input', e => {
  getCurrentProfile().urlFilter = e.target.value;
  debouncedSave();
});

// Add header buttons
document.getElementById('addRequestHeader').addEventListener('click', async () => {
  getCurrentProfile().requestHeaders.push(createHeader());
  await save();
  renderHeadersList('requestHeadersList', getCurrentProfile().requestHeaders, 'request');
  // Focus last name input
  const inputs = document.querySelectorAll('#requestHeadersList .header-name');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

document.getElementById('addResponseHeader').addEventListener('click', async () => {
  getCurrentProfile().responseHeaders.push(createHeader());
  await save();
  renderHeadersList('responseHeadersList', getCurrentProfile().responseHeaders, 'response');
  const inputs = document.querySelectorAll('#responseHeadersList .header-name');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

// --- Delegated events for dynamic header rows ---

document.addEventListener('change', async e => {
  if (!e.target.classList.contains('header-checkbox')) return;
  const { type, index } = e.target.dataset;
  const i = parseInt(index, 10);
  const profile = getCurrentProfile();
  const headers = type === 'request' ? profile.requestHeaders : profile.responseHeaders;
  headers[i].enabled = e.target.checked;
  e.target.closest('.header-row').classList.toggle('row-disabled', !headers[i].enabled);
  await save();
});

document.addEventListener('input', e => {
  const { type, index } = e.target.dataset;
  if (type === undefined) return;
  const i = parseInt(index, 10);
  const profile = getCurrentProfile();
  const headers = type === 'request' ? profile.requestHeaders : profile.responseHeaders;

  if (e.target.classList.contains('header-name')) {
    headers[i].name = e.target.value;
    debouncedSave();
  } else if (e.target.classList.contains('header-value')) {
    headers[i].value = e.target.value;
    debouncedSave();
  }
});

document.addEventListener('click', async e => {
  if (!e.target.classList.contains('delete-btn')) return;
  const { type, index } = e.target.dataset;
  const i = parseInt(index, 10);
  const profile = getCurrentProfile();
  const listId = type === 'request' ? 'requestHeadersList' : 'responseHeadersList';

  if (type === 'request') {
    profile.requestHeaders.splice(i, 1);
    await save();
    renderHeadersList(listId, profile.requestHeaders, type);
  } else {
    profile.responseHeaders.splice(i, 1);
    await save();
    renderHeadersList(listId, profile.responseHeaders, type);
  }
});

// Tab key moves from name → value input
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.shiftKey) return;
  if (e.target.classList.contains('header-name')) {
    e.preventDefault();
    e.target.closest('.header-row').querySelector('.header-value').focus();
  }
});

// --- Export / Import ---

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'header-editor-profiles.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Expected a JSON array of profiles');
    profiles = imported;
    currentProfileIndex = 0;
    await save();
    renderProfileSelect();
    renderCurrentProfile();
    showStatus('Imported!');
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
  e.target.value = '';
});

// ── Autocomplete ──────────────────────────────────────────────────────────────

const acDropdown = document.getElementById('headerAutocomplete');
let acActiveIndex = -1;
let acItems = [];

function showAutocomplete(input) {
  const type = input.dataset.type;
  if (!type) return;
  const query = input.value.toLowerCase();
  const list = HEADER_SUGGESTIONS[type] || [];
  const filtered = query ? list.filter(h => h.toLowerCase().includes(query)) : list;

  if (!filtered.length) { hideAutocomplete(); return; }

  acItems = filtered;
  acActiveIndex = -1;
  acDropdown.innerHTML = '';

  filtered.forEach((name, i) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    // Highlight matching segment
    if (query) {
      const idx = name.toLowerCase().indexOf(query);
      item.innerHTML = escapeAttr(name.slice(0, idx))
        + `<mark>${escapeAttr(name.slice(idx, idx + query.length))}</mark>`
        + escapeAttr(name.slice(idx + query.length));
    } else {
      item.textContent = name;
    }
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      selectAutocomplete(input, name);
    });
    acDropdown.appendChild(item);
  });

  const rect = input.getBoundingClientRect();
  acDropdown.style.top = (rect.bottom + 2) + 'px';
  acDropdown.style.left = rect.left + 'px';
  acDropdown.style.width = Math.max(rect.width, 220) + 'px';
  acDropdown.classList.remove('hidden');
}

function hideAutocomplete() {
  acDropdown.classList.add('hidden');
  acActiveIndex = -1;
  acItems = [];
}

function setActiveItem(index) {
  const items = acDropdown.querySelectorAll('.autocomplete-item');
  items.forEach(el => el.classList.remove('ac-active'));
  if (index >= 0 && index < items.length) {
    acActiveIndex = index;
    items[index].classList.add('ac-active');
    items[index].scrollIntoView({ block: 'nearest' });
  } else {
    acActiveIndex = -1;
  }
}

function selectAutocomplete(input, name) {
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  hideAutocomplete();
  input.closest('.header-row')?.querySelector('.header-value')?.focus();
}

document.addEventListener('focusin', e => {
  if (e.target.classList.contains('header-name')) showAutocomplete(e.target);
  else hideAutocomplete();
});

document.addEventListener('focusout', e => {
  if (e.target.classList.contains('header-name')) {
    setTimeout(hideAutocomplete, 150);
  }
});

document.addEventListener('keydown', e => {
  if (acDropdown.classList.contains('hidden')) return;
  const count = acItems.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveItem((acActiveIndex + 1) % count);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveItem((acActiveIndex - 1 + count) % count);
  } else if (e.key === 'Enter' && acActiveIndex >= 0) {
    e.preventDefault();
    const input = document.activeElement;
    if (input.classList.contains('header-name')) selectAutocomplete(input, acItems[acActiveIndex]);
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
}, true);

// Re-filter on typing (input event for header-name is already handled above for save;
// we just need to also refresh the dropdown)
document.addEventListener('input', e => {
  if (e.target.classList.contains('header-name')) showAutocomplete(e.target);
});

document.addEventListener('DOMContentLoaded', init);
