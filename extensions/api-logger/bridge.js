// Runs in isolated world — bridges MAIN world events to extension storage
window.addEventListener('__api_log__', (e) => {
  const log = e.detail;
  chrome.storage.local.get(['api_logs'], (result) => {
    const logs = result.api_logs || [];
    logs.unshift(log);
    // Keep last 200 requests
    chrome.storage.local.set({ api_logs: logs.slice(0, 200) });
  });
});
