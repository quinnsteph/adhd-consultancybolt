function copyText(text) {
  navigator.clipboard.writeText(text);
}

function renderPalette(palette) {
  const el = document.getElementById('palette');
  if (!palette.length) {
    el.innerHTML = '<p class="empty">No colors saved yet.</p>';
    return;
  }

  el.innerHTML = palette.map((c, i) => `
    <div class="color-row" data-index="${i}">
      <div class="color-swatch" style="background:${c.hex}"></div>
      <div class="color-info">
        <span class="color-hex" data-val="${c.hex}">${c.hex}</span>
        <span class="color-sub" data-val="${c.rgb}">${c.rgb}</span>
        <span class="color-sub" data-val="${c.hsl}">${c.hsl}</span>
      </div>
      <div class="color-actions">
        <button class="btn-copy" data-val="${c.hex}">Copy</button>
        <button class="btn-remove" data-index="${i}">✕</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyText(btn.dataset.val);
      btn.textContent = '✓';
      setTimeout(() => (btn.textContent = 'Copy'), 1000);
    });
  });

  el.querySelectorAll('.color-hex, .color-sub').forEach((span) => {
    span.addEventListener('click', () => {
      copyText(span.dataset.val);
    });
  });

  el.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      chrome.storage.local.get(['palette'], (result) => {
        const palette = result.palette || [];
        palette.splice(Number(btn.dataset.index), 1);
        chrome.storage.local.set({ palette }, loadPalette);
      });
    });
  });
}

function loadPalette() {
  chrome.storage.local.get(['palette'], (result) => {
    renderPalette(result.palette || []);
  });
}

document.getElementById('btn-pick').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
  window.close();
});

document.getElementById('btn-clear-palette').addEventListener('click', () => {
  chrome.storage.local.set({ palette: [] }, loadPalette);
});

loadPalette();
