const ALL_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
];

async function applyRules() {
  const { profiles = [] } = await chrome.storage.local.get('profiles');

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
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
  } catch (err) {
    // Try rules one-by-one to skip invalid ones (e.g. bad urlFilter)
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
    for (const rule of newRules) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [], addRules: [rule] });
      } catch {
        // skip invalid rule silently
      }
    }
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

chrome.storage.onChanged.addListener(applyRules);

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
