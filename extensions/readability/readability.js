// ─────────────────────────────────────────────────────────────────────────────
// Shared readability algorithms (used by both content.js and popup.js)
// ─────────────────────────────────────────────────────────────────────────────

const Readability = (() => {

  // ── Syllable counting (English approximation) ──────────────────────────────
  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  // ── Tokenise text into sentences and words ─────────────────────────────────
  function tokenize(text) {
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.split(/\s+/).length > 2);

    const words = text
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z']/g, ''))
      .filter((w) => w.length > 0);

    return { sentences, words };
  }

  // ── Flesch-Kincaid ─────────────────────────────────────────────────────────
  function fleschKincaid(text) {
    const { sentences, words } = tokenize(text);
    if (!words.length || !sentences.length) return null;

    const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllableCount / words.length;

    const ease = Math.max(
      0,
      Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord)
    );

    const grade = Math.max(
      0,
      0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
    );

    return {
      ease: Math.round(ease),
      grade: Math.round(grade * 10) / 10,
      wordCount: words.length,
      sentenceCount: sentences.length,
      syllableCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
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

  // ── Hemingway analysis ─────────────────────────────────────────────────────

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

  // Passive voice: "was/were/is/are/been/being + past participle"
  const PASSIVE_RE = /\b(was|were|is|are|been|being|be)\s+(\w+ed|built|done|made|known|seen|found|given|taken|shown|told|written|sent|kept|brought|left|heard|felt|held|paid|set|led|read|won|lost|let|put|cut|hit|run|hung|sat|stood|met|bought|thought|caught|taught|fought|sought|got|forgotten|broken|spoken|chosen|driven|given|hidden|risen|stolen|taken|written|beaten|bitten|blown|drawn|fallen|flown|grown|thrown|worn|woven|shaken|sworn|torn|woken|ridden|risen|proven)\b/gi;

  function hemingwayAnalysis(text) {
    const { sentences } = tokenize(text);
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    const longSentences = [];     // > 25 words — hard
    const veryLongSentences = []; // > 35 words — very hard
    const passiveSentences = [];
    const adverbInstances = [];
    const complexWordInstances = [];

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

  // ── Hard words (>3 syllables, not proper nouns) ───────────────────────────
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
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count, syllables: countSyllables(word) }));
  }

  // ── Bionic reading ─────────────────────────────────────────────────────────
  function bionicWord(word) {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length <= 1) return word;
    const boldLen = Math.max(1, Math.ceil(clean.length * 0.45));
    // Preserve leading/trailing punctuation
    const leading = word.match(/^[^a-zA-Z]*/)?.[0] || '';
    const trailing = word.match(/[^a-zA-Z]*$/)?.[0] || '';
    const core = word.slice(leading.length, word.length - trailing.length);
    return `${leading}<b>${core.slice(0, boldLen)}</b>${core.slice(boldLen)}${trailing}`;
  }

  return { fleschKincaid, fleschEaseLabel, hemingwayAnalysis, getHardWords, bionicWord, countSyllables };
})();

if (typeof module !== 'undefined') module.exports = Readability;
