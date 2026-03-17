chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse(dataUrl);
    });
    return true;
  }

  if (msg.action === 'saveColor') {
    chrome.storage.local.get(['palette'], (result) => {
      const palette = result.palette || [];
      if (!palette.find((c) => c.hex === msg.color.hex)) {
        palette.unshift(msg.color);
        chrome.storage.local.set({ palette: palette.slice(0, 50) });
      }
    });
  }
});
