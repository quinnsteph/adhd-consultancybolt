let activeTab = 'local';
let searchQuery = '';
let editingKey = null;

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function exec(fn, args = []) {
  const tab = await getTab();
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fn,
    args,
  });
  return results[0]?.result;
}

// ── Storage helpers ──────────────────────────────────────────────────────────
const getLocalStorage = () => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  return out;
};

const getSessionStorage = () => {
  const out = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    out[k] = sessionStorage.getItem(k);
  }
  return out;
};

const setLocalItem = (k, v) => localStorage.setItem(k, v);
const setSessionItem = (k, v) => sessionStorage.setItem(k, v);
const removeLocalItem = (k) => localStorage.removeItem(k);
const removeSessionItem = (k) => sessionStorage.removeItem(k);
const clearLocal = () => localStorage.clear();
const clearSession = () => sessionStorage.clear();

async function loadData() {
  const list = document.getElementById('item-list');

  if (activeTab === 'cookies') {
    const tab = await getTab();
    const url = tab.url;
    const cookies = await chrome.cookies.getAll({ url });
    renderCookies(cookies.filter((c) =>
      !searchQuery || c.name.toLowerCase().includes(searchQuery) || c.value.toLowerCase().includes(searchQuery)
    ));
    return;
  }

  const data = await exec(activeTab === 'local' ? getLocalStorage : getSessionStorage);
  if (!data) { list.innerHTML = '<p class="empty">Cannot access storage on this page.</p>'; return; }

  const entries = Object.entries(data).filter(([k, v]) =>
    !searchQuery || k.toLowerCase().includes(searchQuery) || v.toLowerCase().includes(searchQuery)
  );

  if (!entries.length) {
    list.innerHTML = '<p class="empty">No items found.</p>';
    return;
  }

  list.innerHTML = entries.map(([k, v]) => `
    <div class="item-row" data-key="${encodeURIComponent(k)}">
      <div class="item-key">${k}</div>
      <div class="item-value">${v.length > 80 ? v.slice(0, 80) + '…' : v}</div>
      <div class="item-actions">
        <button class="btn-edit" data-key="${encodeURIComponent(k)}" data-val="${encodeURIComponent(v)}">Edit</button>
        <button class="btn-delete" data-key="${encodeURIComponent(k)}">✕</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal(decodeURIComponent(btn.dataset.key), decodeURIComponent(btn.dataset.val), false);
    });
  });

  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const k = decodeURIComponent(btn.dataset.key);
      await exec(activeTab === 'local' ? removeLocalItem : removeSessionItem, [k]);
      loadData();
    });
  });
}

function renderCookies(cookies) {
  const list = document.getElementById('item-list');
  if (!cookies.length) { list.innerHTML = '<p class="empty">No cookies found.</p>'; return; }
  list.innerHTML = cookies.map((c) => `
    <div class="item-row">
      <div class="item-key">${c.name} <span class="cookie-meta">${c.domain}</span></div>
      <div class="item-value">${c.value.length > 80 ? c.value.slice(0, 80) + '…' : c.value}</div>
      <div class="item-actions">
        <button class="btn-delete-cookie" data-name="${encodeURIComponent(c.name)}" data-url="https://${c.domain}${c.path}">✕</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-delete-cookie').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await chrome.cookies.remove({
        url: decodeURIComponent(btn.dataset.url),
        name: decodeURIComponent(btn.dataset.name),
      });
      loadData();
    });
  });
}

function openModal(key = '', value = '', isNew = true) {
  editingKey = isNew ? null : key;
  document.getElementById('modal-title').textContent = isNew ? 'Add Item' : 'Edit Item';
  document.getElementById('modal-key').value = key;
  document.getElementById('modal-key').disabled = !isNew;
  document.getElementById('modal-value').value = value;
  document.getElementById('modal').classList.remove('hidden');
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

document.getElementById('modal-save').addEventListener('click', async () => {
  const key = document.getElementById('modal-key').value.trim();
  const value = document.getElementById('modal-value').value;
  if (!key) return;
  await exec(activeTab === 'local' ? setLocalItem : setSessionItem, [key, value]);
  document.getElementById('modal').classList.add('hidden');
  loadData();
});

document.getElementById('btn-add').addEventListener('click', () => openModal());

document.getElementById('btn-clear-all').addEventListener('click', async () => {
  if (!confirm('Clear all items in this storage?')) return;
  if (activeTab === 'local') await exec(clearLocal);
  else if (activeTab === 'session') await exec(clearSession);
  else {
    const tab = await getTab();
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    for (const c of cookies) await chrome.cookies.remove({ url: tab.url, name: c.name });
  }
  loadData();
});

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    loadData();
  });
});

document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  loadData();
});

loadData();
