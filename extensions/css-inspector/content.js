(() => {
  let inspecting = false;
  let hoveredEl = null;
  let panel = null;
  let selectedEl = null;

  function getRelevantStyles(el) {
    const computed = window.getComputedStyle(el);
    const props = [
      'display','position','width','height','margin','padding',
      'font-family','font-size','font-weight','color','background-color',
      'border','border-radius','box-shadow','opacity','z-index',
      'flex-direction','align-items','justify-content','gap',
      'grid-template-columns','overflow','cursor','line-height','text-align',
    ];
    return props.map((p) => [p, computed.getPropertyValue(p)]).filter(([, v]) => v && v !== 'none' && v !== 'auto' && v !== 'normal' && v !== '0px');
  }

  function getInlineStyles(el) {
    const style = el.getAttribute('style') || '';
    return style.split(';').map((s) => s.trim()).filter(Boolean);
  }

  function updatePanel(el) {
    if (!panel) return;
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = [...el.classList].map((c) => `.${c}`).join('');
    const selector = `${tag}${id}${cls}`;

    const styles = getRelevantStyles(el);
    const inline = getInlineStyles(el);
    const rect = el.getBoundingClientRect();

    panel.querySelector('#css-selector').textContent = selector;
    panel.querySelector('#css-dims').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}px`;

    panel.querySelector('#css-computed').innerHTML = styles.map(([p, v]) => `
      <div class="css-row">
        <span class="css-prop">${p}</span>
        <span class="css-colon">:</span>
        <input class="css-val" data-prop="${p}" value="${v}" />
        <span class="css-semi">;</span>
      </div>
    `).join('');

    panel.querySelector('#css-inline').value = inline.join(';\n') + (inline.length ? ';' : '');

    // Live-edit computed style inputs
    panel.querySelectorAll('.css-val').forEach((input) => {
      input.addEventListener('change', () => {
        el.style.setProperty(input.dataset.prop, input.value);
      });
    });

    // Live-edit inline textarea
    panel.querySelector('#css-inline').addEventListener('input', (e) => {
      el.setAttribute('style', e.target.value.replace(/\n/g, ' '));
    });
  }

  function createPanel() {
    if (document.getElementById('css-inspector-panel')) return;
    panel = document.createElement('div');
    panel.id = 'css-inspector-panel';
    panel.innerHTML = `
      <div id="css-panel-header">
        <span>CSS Inspector</span>
        <div style="display:flex;gap:6px">
          <button id="css-copy-btn">Copy Styles</button>
          <button id="css-close-btn">✕</button>
        </div>
      </div>
      <div id="css-selected-info">
        <span id="css-selector"></span>
        <span id="css-dims"></span>
      </div>
      <div id="css-tabs">
        <button class="css-tab active" data-tab="computed">Computed</button>
        <button class="css-tab" data-tab="inline">Inline Style</button>
      </div>
      <div id="css-tab-computed" class="css-tab-content">
        <div id="css-computed"></div>
      </div>
      <div id="css-tab-inline" class="css-tab-content hidden">
        <textarea id="css-inline"></textarea>
      </div>
      <div id="css-no-selection">Click any element on the page to inspect it.</div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#css-close-btn').addEventListener('click', () => {
      stopInspecting();
      panel.remove();
      panel = null;
    });

    panel.querySelectorAll('.css-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.css-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelectorAll('.css-tab-content').forEach((c) => c.classList.add('hidden'));
        panel.querySelector(`#css-tab-${tab.dataset.tab}`).classList.remove('hidden');
      });
    });

    panel.querySelector('#css-copy-btn').addEventListener('click', () => {
      if (!selectedEl) return;
      const styles = getRelevantStyles(selectedEl);
      const text = styles.map(([p, v]) => `${p}: ${v};`).join('\n');
      navigator.clipboard.writeText(text);
    });
  }

  function highlight(el) {
    if (hoveredEl) hoveredEl.classList.remove('css-inspector-hover');
    hoveredEl = el;
    el.classList.add('css-inspector-hover');
  }

  function onMouseOver(e) {
    if (!inspecting) return;
    if (panel && panel.contains(e.target)) return;
    highlight(e.target);
  }

  function onClick(e) {
    if (!inspecting) return;
    if (panel && panel.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    selectedEl = e.target;
    panel.querySelector('#css-no-selection').style.display = 'none';
    updatePanel(selectedEl);
  }

  function stopInspecting() {
    inspecting = false;
    if (hoveredEl) hoveredEl.classList.remove('css-inspector-hover');
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
  }

  function startInspecting() {
    inspecting = true;
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'openInspector') {
      createPanel();
      startInspecting();
      sendResponse({ ok: true });
    }
    return true;
  });
})();
