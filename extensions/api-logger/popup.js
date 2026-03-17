let allLogs = [];
let activeFilter = 'all';
let searchQuery = '';

function statusColor(status) {
  if (status === 0) return 'error';
  if (status < 300) return 'success';
  if (status < 400) return 'redirect';
  return 'error';
}

function formatDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function render(logs) {
  const list = document.getElementById('log-list');
  if (!logs.length) {
    list.innerHTML = '<p class="empty">No requests logged yet.<br>Reload the page to start capturing.</p>';
    return;
  }

  list.innerHTML = logs.map((log) => `
    <div class="log-row" data-id="${log.id}">
      <span class="method">${log.method}</span>
      <span class="type-badge ${log.type}">${log.type}</span>
      <span class="status ${statusColor(log.status)}">${log.status || 'ERR'}</span>
      <span class="url">${log.url}</span>
      <span class="duration">${formatDuration(log.duration)}</span>
    </div>
  `).join('');

  list.querySelectorAll('.log-row').forEach((row) => {
    row.addEventListener('click', () => {
      const log = allLogs.find((l) => l.id === row.dataset.id);
      if (log) showDetail(log);
    });
  });
}

function applyFilters() {
  let logs = allLogs;
  if (activeFilter === 'fetch') logs = logs.filter((l) => l.type === 'fetch');
  else if (activeFilter === 'xhr') logs = logs.filter((l) => l.type === 'xhr');
  else if (activeFilter === 'error') logs = logs.filter((l) => l.status === 0 || l.status >= 400);
  if (searchQuery) logs = logs.filter((l) => l.url.toLowerCase().includes(searchQuery));
  render(logs);
}

function showDetail(log) {
  document.getElementById('log-list').classList.add('hidden');
  document.querySelector('.filters').classList.add('hidden');
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('hidden');
  document.getElementById('detail-title').textContent = `${log.method} ${log.status}`;

  const fmt = (obj) => JSON.stringify(obj, null, 2);
  let bodyDisplay = log.body;
  try { bodyDisplay = JSON.stringify(JSON.parse(log.body), null, 2); } catch {}

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">URL</div>
      <div class="detail-value url-wrap">${log.url}</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Time · Duration</div>
      <div class="detail-value">${new Date(log.time).toLocaleTimeString()} · ${formatDuration(log.duration)}</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Request Headers</div>
      <pre class="code-block">${fmt(log.reqHeaders)}</pre>
    </div>
    <div class="detail-section">
      <div class="detail-label">Response Headers</div>
      <pre class="code-block">${fmt(log.resHeaders)}</pre>
    </div>
    <div class="detail-section">
      <div class="detail-label">Response Body</div>
      <pre class="code-block">${bodyDisplay}</pre>
    </div>
  `;
}

document.getElementById('detail-back').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
  document.getElementById('log-list').classList.remove('hidden');
  document.querySelector('.filters').classList.remove('hidden');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  chrome.storage.local.set({ api_logs: [] }, () => {
    allLogs = [];
    applyFilters();
  });
});

document.querySelectorAll('.filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyFilters();
  });
});

document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  applyFilters();
});

// Load logs and refresh every 2s
function loadLogs() {
  chrome.storage.local.get(['api_logs'], (result) => {
    allLogs = result.api_logs || [];
    applyFilters();
  });
}

loadLogs();
setInterval(loadLogs, 2000);
