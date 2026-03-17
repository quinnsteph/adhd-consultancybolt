// Content script — injected into every page
// Imports readability.js via manifest web_accessible_resources workaround:
// we inline the algorithms here to keep it simple as a single content script.

(() => {
  // ── Inline core algorithms (same as readability.js) ──────────────────────

  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  function tokenize(text) {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 2);
    const words = text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z']/g, '')).filter((w) => w.length > 0);
    return { sentences, words };
  }

  function fleschKincaid(text) {
    const { sentences, words } = tokenize(text);
    if (!words.length || !sentences.length) return null;
    const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const avgWPS = words.length / sentences.length;
    const avgSPW = syllableCount / words.length;
    const ease = Math.max(0, Math.min(100, 206.835 - 1.015 * avgWPS - 84.6 * avgSPW));
    const grade = Math.max(0, 0.39 * avgWPS + 11.8 * avgSPW - 15.59);
    return {
      ease: Math.round(ease),
      grade: Math.round(grade * 10) / 10,
      wordCount: words.length,
      sentenceCount: sentences.length,
      syllableCount,
      avgWordsPerSentence: Math.round(avgWPS * 10) / 10,
    };
  }

  function fleschEaseLabel(ease) {
    if (ease >= 90) return { label: 'Very Easy', color: '#22c55e' };
    if (ease >= 70) return { label: 'Easy', color: '#84cc16' };
    if (ease >= 60) return { label: 'Standard', color: '#eab308' };
    if (ease >= 50) return { label: 'Fairly Difficult', color: '#f97316' };
    if (ease >= 30) return { label: 'Difficult', color: '#ef4444' };
    return { label: 'Very Difficult', color: '#dc2626' };
  }

  const COMMON_ADVERBS = new Set([
    'very','really','quite','just','so','too','actually','basically','literally',
    'honestly','extremely','incredibly','absolutely','totally','completely',
    'seriously','obviously','clearly','certainly','probably','definitely',
    'quickly','slowly','suddenly','quietly','loudly','gently','carefully',
    'easily','hardly','nearly','merely','simply','slightly','strongly',
    'usually','generally','recently','finally','ultimately','typically',
  ]);

  const COMPLEX_WORDS = new Set([
    'utilize','utilization','demonstrate','implementation','facilitate','leverage',
    'paradigm','synergy','methodology','commence','terminate','endeavor',
    'ascertain','subsequently','aforementioned','notwithstanding','consequently',
    'approximately','necessarily','significantly','particularly','substantially',
    'accordingly','furthermore','nevertheless','comprehensively','strategically',
    'instantaneously','multifaceted','unprecedented','circumnavigate','ameliorate',
  ]);

  const PASSIVE_RE = /\b(was|were|is|are|been|being|be)\s+(\w+ed|built|done|made|known|seen|found|given|taken|shown|told|written|sent|kept|brought|left|heard|felt|held|paid|set|led|read|won|lost|let|put|cut|hit|run|hung|sat|stood|met|bought|thought|caught|taught|fought|sought|got|forgotten|broken|spoken|chosen|driven|given|hidden|risen|stolen|taken|written|beaten|bitten|blown|drawn|fallen|flown|grown|thrown|worn|woven|shaken|sworn|torn|woken|ridden|risen|proven)\b/gi;

  function hemingwayAnalysis(text) {
    const { sentences } = tokenize(text);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const longSentences = [], veryLongSentences = [], passiveSentences = [];
    const adverbInstances = [], complexWordInstances = [];

    sentences.forEach((s) => {
      const wc = s.split(/\s+/).filter((w) => w.length > 0).length;
      if (wc > 35) veryLongSentences.push(s);
      else if (wc > 25) longSentences.push(s);
      if (PASSIVE_RE.test(s)) passiveSentences.push(s);
      PASSIVE_RE.lastIndex = 0;
    });

    words.forEach((w) => {
      const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (COMMON_ADVERBS.has(clean)) adverbInstances.push(clean);
      if (COMPLEX_WORDS.has(clean)) complexWordInstances.push(clean);
    });

    return {
      longSentences,
      veryLongSentences,
      passiveSentences,
      adverbs: [...new Set(adverbInstances)],
      complexWords: [...new Set(complexWordInstances)],
      totalSentences: sentences.length,
    };
  }

  function getHardWords(text) {
    const freq = {};
    text.split(/\s+/).forEach((raw) => {
      const w = raw.replace(/[^a-zA-Z]/g, '');
      if (w.length < 5) return;
      if (countSyllables(w) >= 3) {
        const lower = w.toLowerCase();
        freq[lower] = (freq[lower] || 0) + 1;
      }
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([word, count]) => ({ word, count, syllables: countSyllables(word) }));
  }

  // ── Bionic reading ─────────────────────────────────────────────────────────

  let bionicActive = false;
  const bionicNodeMap = new WeakMap();

  function bionicWord(word) {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length <= 1) return word;
    const boldLen = Math.max(1, Math.ceil(clean.length * 0.45));
    const leading = word.match(/^[^a-zA-Z]*/)?.[0] || '';
    const trailing = word.match(/[^a-zA-Z]*$/)?.[0] || '';
    const core = word.slice(leading.length, word.length - trailing.length);
    return `${leading}<b>${core.slice(0, boldLen)}</b>${core.slice(boldLen)}${trailing}`;
  }

  function applyBionic() {
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','CODE','PRE'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('#readability-panel')) return NodeFilter.FILTER_REJECT;
          if (node.nodeValue.trim().length < 2) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      const original = node.nodeValue;
      const bionicHtml = original.split(/(\s+)/).map((token) => {
        if (/^\s+$/.test(token)) return token;
        return bionicWord(token);
      }).join('');

      const span = document.createElement('span');
      span.className = 'readability-bionic';
      span.innerHTML = bionicHtml;
      bionicNodeMap.set(span, original);
      node.parentNode.replaceChild(span, node);
    });

    bionicActive = true;
  }

  function removeBionic() {
    document.querySelectorAll('.readability-bionic').forEach((span) => {
      const original = bionicNodeMap.get(span);
      if (original) {
        span.replaceWith(document.createTextNode(original));
      } else {
        span.replaceWith(document.createTextNode(span.innerText));
      }
    });
    bionicActive = false;
  }

  // ── Hemingway highlighting ─────────────────────────────────────────────────

  let hemingwayActive = false;

  function applyHemingway(analysis) {
    removeHemingway();

    // Highlight long sentences in the DOM
    const allText = document.body.innerHTML;
    let modified = allText;

    analysis.veryLongSentences.forEach((s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        modified = modified.replace(
          new RegExp(escaped, 'g'),
          `<mark class="hem-very-long hem-mark">${s}</mark>`
        );
      } catch {}
    });

    analysis.longSentences.forEach((s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        modified = modified.replace(
          new RegExp(escaped, 'g'),
          `<mark class="hem-long hem-mark">${s}</mark>`
        );
      } catch {}
    });

    if (modified !== allText) {
      document.body.innerHTML = modified;
    }

    // Highlight adverbs inline
    analysis.adverbs.forEach((adverb) => {
      highlightWord(adverb, 'hem-adverb');
    });

    // Highlight complex words inline
    analysis.complexWords.forEach((word) => {
      highlightWord(word, 'hem-complex');
    });

    hemingwayActive = true;
  }

  function highlightWord(word, className) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#readability-panel')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const re = new RegExp(`\\b(${word})\\b`, 'gi');
    nodes.forEach((node) => {
      if (!re.test(node.nodeValue)) return;
      re.lastIndex = 0;
      const span = document.createElement('span');
      span.innerHTML = node.nodeValue.replace(re, `<mark class="${className} hem-mark">$1</mark>`);
      node.parentNode.replaceChild(span, node);
    });
  }

  function removeHemingway() {
    document.querySelectorAll('.hem-mark').forEach((el) => {
      el.replaceWith(document.createTextNode(el.textContent));
    });
    hemingwayActive = false;
  }

  // ── Side panel ─────────────────────────────────────────────────────────────

  function getPageText() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,nav,footer,header,#readability-panel').forEach((el) => el.remove());
    return clone.innerText || clone.textContent || '';
  }

  function openPanel() {
    if (document.getElementById('readability-panel')) return;

    const text = getPageText();
    const fk = fleschKincaid(text);
    const hem = hemingwayAnalysis(text);
    const hard = getHardWords(text);
    const easeInfo = fk ? fleschEaseLabel(fk.ease) : null;

    const panel = document.createElement('div');
    panel.id = 'readability-panel';
    panel.innerHTML = `
      <div id="rp-header">
        <span>Readability Suite</span>
        <button id="rp-close">✕</button>
      </div>

      <div id="rp-tabs">
        <button class="rp-tab active" data-tab="score">Score</button>
        <button class="rp-tab" data-tab="hemingway">Hemingway</button>
        <button class="rp-tab" data-tab="words">Hard Words</button>
      </div>

      <!-- Score tab -->
      <div class="rp-content" id="rp-tab-score">
        ${fk ? `
          <div class="rp-score-hero" style="border-color:${easeInfo.color}">
            <div class="rp-score-num" style="color:${easeInfo.color}">${fk.ease}</div>
            <div class="rp-score-label">Flesch Reading Ease</div>
            <div class="rp-score-sublabel" style="color:${easeInfo.color}">${easeInfo.label}</div>
          </div>
          <div class="rp-grade-row">
            <div class="rp-stat">
              <div class="rp-stat-val">Grade ${fk.grade}</div>
              <div class="rp-stat-label">Kincaid Grade</div>
            </div>
            <div class="rp-stat">
              <div class="rp-stat-val">${fk.wordCount.toLocaleString()}</div>
              <div class="rp-stat-label">Words</div>
            </div>
            <div class="rp-stat">
              <div class="rp-stat-val">${fk.sentenceCount}</div>
              <div class="rp-stat-label">Sentences</div>
            </div>
            <div class="rp-stat">
              <div class="rp-stat-val">${fk.avgWordsPerSentence}</div>
              <div class="rp-stat-label">Avg words/sentence</div>
            </div>
          </div>
          <div class="rp-ease-scale">
            <div class="rp-ease-bar">
              <div class="rp-ease-fill" style="width:${fk.ease}%;background:${easeInfo.color}"></div>
              <div class="rp-ease-marker" style="left:${fk.ease}%"></div>
            </div>
            <div class="rp-ease-labels"><span>0 Very Hard</span><span>100 Very Easy</span></div>
          </div>
        ` : '<p class="rp-empty">Not enough text to score.</p>'}
      </div>

      <!-- Hemingway tab -->
      <div class="rp-content hidden" id="rp-tab-hemingway">
        <div class="rp-hem-summary">
          <div class="rp-hem-item very-long">
            <span class="rp-hem-dot"></span>
            <strong>${hem.veryLongSentences.length}</strong> very hard sentences (&gt;35 words)
          </div>
          <div class="rp-hem-item long">
            <span class="rp-hem-dot"></span>
            <strong>${hem.longSentences.length}</strong> hard sentences (&gt;25 words)
          </div>
          <div class="rp-hem-item passive">
            <span class="rp-hem-dot"></span>
            <strong>${hem.passiveSentences.length}</strong> passive voice sentences
          </div>
          <div class="rp-hem-item adverb">
            <span class="rp-hem-dot"></span>
            <strong>${hem.adverbs.length}</strong> weak adverb types used
          </div>
          <div class="rp-hem-item complex">
            <span class="rp-hem-dot"></span>
            <strong>${hem.complexWords.length}</strong> complex/jargon words
          </div>
        </div>
        <div class="rp-hem-legend">
          <div><span class="rp-legend-swatch" style="background:#fde68a"></span> Hard sentence</div>
          <div><span class="rp-legend-swatch" style="background:#fca5a5"></span> Very hard sentence</div>
          <div><span class="rp-legend-swatch" style="background:#bbf7d0"></span> Adverb</div>
          <div><span class="rp-legend-swatch" style="background:#ddd6fe"></span> Complex word</div>
        </div>
        <div class="rp-hem-actions">
          <button id="rp-btn-highlight-hem" class="rp-btn-primary">Highlight on Page</button>
          <button id="rp-btn-remove-hem" class="rp-btn-secondary">Remove</button>
        </div>
        ${hem.adverbs.length ? `
          <div class="rp-section-title">Adverbs found</div>
          <div class="rp-pill-list">${hem.adverbs.map((a) => `<span class="rp-pill adverb">${a}</span>`).join('')}</div>
        ` : ''}
        ${hem.complexWords.length ? `
          <div class="rp-section-title">Complex words</div>
          <div class="rp-pill-list">${hem.complexWords.map((w) => `<span class="rp-pill complex">${w}</span>`).join('')}</div>
        ` : ''}
      </div>

      <!-- Hard words tab -->
      <div class="rp-content hidden" id="rp-tab-words">
        ${hard.length ? `
          <p class="rp-words-hint">Words with 3+ syllables, sorted by frequency</p>
          <div id="rp-hard-list">
            ${hard.map((hw) => `
              <div class="rp-hard-row">
                <span class="rp-hard-word">${hw.word}</span>
                <span class="rp-hard-syl">${hw.syllables} syl</span>
                <span class="rp-hard-count">×${hw.count}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p class="rp-empty">No complex words found.</p>'}
      </div>
    `;

    document.body.appendChild(panel);

    // Tab switching
    panel.querySelectorAll('.rp-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.rp-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelectorAll('.rp-content').forEach((c) => c.classList.add('hidden'));
        panel.querySelector(`#rp-tab-${tab.dataset.tab}`).classList.remove('hidden');
      });
    });

    panel.querySelector('#rp-close').addEventListener('click', () => {
      removeBionic();
      removeHemingway();
      panel.remove();
    });

    panel.querySelector('#rp-btn-highlight-hem')?.addEventListener('click', () => {
      applyHemingway(hem);
    });

    panel.querySelector('#rp-btn-remove-hem')?.addEventListener('click', () => {
      removeHemingway();
    });
  }

  // ── Message listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'openPanel') {
      openPanel();
      sendResponse({ ok: true });
    }

    if (msg.action === 'toggleBionic') {
      if (bionicActive) removeBionic();
      else applyBionic();
      sendResponse({ active: bionicActive });
    }

    if (msg.action === 'getStats') {
      const text = getPageText();
      const fk = fleschKincaid(text);
      const hem = hemingwayAnalysis(text);
      sendResponse({ fk, hem, bionicActive, hemingwayActive });
    }

    return true;
  });
})();
