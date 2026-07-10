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
      <input type="text" class="header-name" value="${escapeAttr(header.name)}" placeholder="Name" list="${type === 'request' ? 'requestHeaderSuggestions' : 'responseHeaderSuggestions'}" data-type="${type}" data-index="${index}" spellcheck="false" autocomplete="off">
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

document.addEventListener('DOMContentLoaded', init);
