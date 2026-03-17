const EASE_COLORS = (ease) => {
  if (ease >= 90) return '#22c55e';
  if (ease >= 70) return '#84cc16';
  if (ease >= 60) return '#eab308';
  if (ease >= 50) return '#f97316';
  if (ease >= 30) return '#ef4444';
  return '#dc2626';
};

const EASE_LABEL = (ease) => {
  if (ease >= 90) return 'Very Easy';
  if (ease >= 70) return 'Easy';
  if (ease >= 60) return 'Standard';
  if (ease >= 50) return 'Fairly Difficult';
  if (ease >= 30) return 'Difficult';
  return 'Very Difficult';
};

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getTab();

  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    return;
  }

  try {
    const url = new URL(tab.url);
    document.getElementById('page-host').textContent = url.hostname;
  } catch {}

  let data;
  try {
    data = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
  } catch {}

  document.getElementById('loading').classList.add('hidden');

  if (!data?.fk) {
    document.getElementById('error').classList.remove('hidden');
    return;
  }

  const { fk, hem, bionicActive } = data;
  const color = EASE_COLORS(fk.ease);

  document.getElementById('score-num').textContent = fk.ease;
  document.getElementById('score-num').style.color = color;
  document.getElementById('score-sub').textContent = EASE_LABEL(fk.ease);
  document.getElementById('score-badge').style.borderColor = color;

  document.getElementById('meta-grade').textContent = `Grade ${fk.grade}`;
  document.getElementById('meta-words').textContent = fk.wordCount.toLocaleString();
  const minutes = Math.ceil(fk.wordCount / 238);
  document.getElementById('meta-time').textContent = minutes < 1 ? '<1 min' : `${minutes} min`;

  document.getElementById('chip-vlong').textContent = `${hem.veryLongSentences.length} very hard`;
  document.getElementById('chip-long').textContent = `${hem.longSentences.length} hard`;
  document.getElementById('chip-passive').textContent = `${hem.passiveSentences.length} passive`;
  document.getElementById('chip-adverb').textContent = `${hem.adverbs.length} adverbs`;

  document.getElementById('main').classList.remove('hidden');

  const bionicBtn = document.getElementById('btn-bionic');
  bionicBtn.textContent = bionicActive ? 'Remove Bionic' : 'Bionic Reading';
  if (bionicActive) bionicBtn.classList.add('active');

  bionicBtn.addEventListener('click', async () => {
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'toggleBionic' });
    bionicBtn.textContent = result.active ? 'Remove Bionic' : 'Bionic Reading';
    bionicBtn.classList.toggle('active', result.active);
  });

  document.getElementById('btn-panel').addEventListener('click', async () => {
    await chrome.tabs.sendMessage(tab.id, { action: 'openPanel' });
    window.close();
  });
});
