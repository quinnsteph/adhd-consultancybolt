async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendMessage(tabId, action) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action });
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getCurrentTab();

  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('error').textContent = 'Cannot analyze browser internal pages.';
    return;
  }

  // Show page URL
  try {
    const url = new URL(tab.url);
    document.getElementById('page-url').textContent = url.hostname;
  } catch {}

  const data = await sendMessage(tab.id, 'analyze');

  document.getElementById('loading').classList.add('hidden');

  if (!data) {
    document.getElementById('error').classList.remove('hidden');
    return;
  }

  document.getElementById('count-internal').textContent = data.internalCount;
  document.getElementById('count-external').textContent = data.externalCount;
  document.getElementById('count-nofollow').textContent = data.nofollowCount;
  document.getElementById('count-dofollow').textContent = data.dofollowCount;

  document.getElementById('stats').classList.remove('hidden');
  document.getElementById('actions').classList.remove('hidden');

  // Store highlight state
  let highlighted = false;

  document.getElementById('btn-highlight').addEventListener('click', async () => {
    await sendMessage(tab.id, 'highlight');
    highlighted = true;
    document.getElementById('btn-highlight').textContent = 'Refresh Highlights';
  });

  document.getElementById('btn-remove').addEventListener('click', async () => {
    await sendMessage(tab.id, 'removeHighlights');
    highlighted = false;
    document.getElementById('btn-highlight').textContent = 'Highlight Links';
  });

  document.getElementById('btn-panel').addEventListener('click', async () => {
    await sendMessage(tab.id, 'openPanel');
    window.close();
  });
});
