(() => {
  const HOST = window.location.hostname;

  function isInternal(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.hostname === HOST || url.hostname === '' || href.startsWith('#');
    } catch {
      return true; // relative links are internal
    }
  }

  function getLinkType(anchor) {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return null;
    }

    const rel = (anchor.getAttribute('rel') || '').toLowerCase();
    const hasNofollow = rel.includes('nofollow');
    const internal = isInternal(href);

    return {
      type: internal ? 'internal' : 'external',
      follow: hasNofollow ? 'nofollow' : 'dofollow',
      href: anchor.href,
      text: anchor.innerText.trim() || anchor.getAttribute('aria-label') || '[no text]',
    };
  }

  function analyzeLinks() {
    const anchors = document.querySelectorAll('a[href]');
    const results = { internal: [], external: [], nofollow: [], dofollow: [] };

    anchors.forEach((anchor) => {
      const info = getLinkType(anchor);
      if (!info) return;

      // Remove previous classes
      anchor.classList.remove('seo-link-internal', 'seo-link-external', 'seo-link-nofollow');

      if (info.follow === 'nofollow') {
        anchor.classList.add('seo-link-nofollow');
        results.nofollow.push({ ...info, element: anchor });
      } else if (info.type === 'internal') {
        anchor.classList.add('seo-link-internal');
        results.dofollow.push({ ...info, element: anchor });
        results.internal.push({ ...info, element: anchor });
      } else {
        anchor.classList.add('seo-link-external');
        results.dofollow.push({ ...info, element: anchor });
        results.external.push({ ...info, element: anchor });
      }

      if (info.type === 'internal') results.internal.push({ ...info });
      if (info.type === 'external') results.external.push({ ...info });
    });

    return {
      internalCount: results.internal.length,
      externalCount: results.external.length,
      nofollowCount: results.nofollow.length,
      dofollowCount: results.dofollow.length,
      links: [...results.internal, ...results.external, ...results.nofollow].map(({ element, ...rest }) => rest),
    };
  }

  // Listen for messages from popup or panel
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'analyze') {
      const data = analyzeLinks();
      sendResponse(data);
    }

    if (msg.action === 'highlight') {
      analyzeLinks();
      sendResponse({ ok: true });
    }

    if (msg.action === 'removeHighlights') {
      document.querySelectorAll('a').forEach((a) => {
        a.classList.remove('seo-link-internal', 'seo-link-external', 'seo-link-nofollow');
      });
      sendResponse({ ok: true });
    }

    if (msg.action === 'openPanel') {
      openPanel();
      sendResponse({ ok: true });
    }

    return true; // keep channel open for async
  });

  // ─── Side Panel ──────────────────────────────────────────────────────────────

  function openPanel() {
    if (document.getElementById('seo-link-panel')) return;

    const data = analyzeLinks();

    const panel = document.createElement('div');
    panel.id = 'seo-link-panel';
    panel.innerHTML = `
      <div id="seo-panel-header">
        <span>SEO Link Analyzer</span>
        <button id="seo-panel-close">✕</button>
      </div>
      <div id="seo-panel-stats">
        <span class="seo-stat internal">🟢 Internal: <strong>${data.internalCount}</strong></span>
        <span class="seo-stat external">🟠 External: <strong>${data.externalCount}</strong></span>
        <span class="seo-stat nofollow">🔴 Nofollow: <strong>${data.nofollowCount}</strong></span>
        <span class="seo-stat dofollow">🔵 Dofollow: <strong>${data.dofollowCount}</strong></span>
      </div>
      <div id="seo-panel-filters">
        <button class="seo-filter active" data-filter="all">All</button>
        <button class="seo-filter" data-filter="internal">Internal</button>
        <button class="seo-filter" data-filter="external">External</button>
        <button class="seo-filter" data-filter="nofollow">Nofollow</button>
        <button class="seo-filter" data-filter="dofollow">Dofollow</button>
      </div>
      <input id="seo-panel-search" type="text" placeholder="Search links..." />
      <div id="seo-panel-list"></div>
    `;
    document.body.appendChild(panel);

    const allLinks = data.links;
    renderList(allLinks, panel.querySelector('#seo-panel-list'));

    // Close
    panel.querySelector('#seo-panel-close').addEventListener('click', () => panel.remove());

    // Filters
    panel.querySelectorAll('.seo-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.seo-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        const search = panel.querySelector('#seo-panel-search').value.toLowerCase();
        applyFilters(allLinks, filter, search, panel.querySelector('#seo-panel-list'));
      });
    });

    // Search
    panel.querySelector('#seo-panel-search').addEventListener('input', (e) => {
      const filter = panel.querySelector('.seo-filter.active').dataset.filter;
      applyFilters(allLinks, filter, e.target.value.toLowerCase(), panel.querySelector('#seo-panel-list'));
    });
  }

  function applyFilters(links, filter, search, listEl) {
    let filtered = links;
    if (filter !== 'all') {
      filtered = filtered.filter((l) => {
        if (filter === 'internal') return l.type === 'internal';
        if (filter === 'external') return l.type === 'external';
        if (filter === 'nofollow') return l.follow === 'nofollow';
        if (filter === 'dofollow') return l.follow === 'dofollow';
        return true;
      });
    }
    if (search) {
      filtered = filtered.filter(
        (l) => l.href.toLowerCase().includes(search) || l.text.toLowerCase().includes(search)
      );
    }
    renderList(filtered, listEl);
  }

  function renderList(links, listEl) {
    if (links.length === 0) {
      listEl.innerHTML = '<p class="seo-empty">No links found.</p>';
      return;
    }
    listEl.innerHTML = links
      .map(
        (l) => `
      <div class="seo-link-row seo-row-${l.type} seo-row-${l.follow}">
        <div class="seo-link-row-badges">
          <span class="seo-badge ${l.type}">${l.type}</span>
          <span class="seo-badge ${l.follow}">${l.follow}</span>
        </div>
        <a href="${l.href}" target="_blank" rel="noopener" class="seo-link-row-text">${l.text}</a>
        <div class="seo-link-row-url">${l.href}</div>
      </div>`
      )
      .join('');
  }
})();
