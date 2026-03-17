(() => {
  let picking = false;
  let tooltip = null;
  let canvas = null;
  let ctx = null;

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  function getPixelColor(x, y) {
    if (!canvas) return null;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2] };
  }

  async function captureScreen() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'captureTab' }, (dataUrl) => {
        const img = new Image();
        img.onload = () => {
          canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve();
        };
        img.src = dataUrl;
      });
    });
  }

  function createTooltip() {
    if (document.getElementById('color-picker-tooltip')) return;
    tooltip = document.createElement('div');
    tooltip.id = 'color-picker-tooltip';
    tooltip.innerHTML = `
      <div id="cp-swatch"></div>
      <div id="cp-values">
        <div id="cp-hex"></div>
        <div id="cp-rgb"></div>
        <div id="cp-hsl"></div>
      </div>
    `;
    document.body.appendChild(tooltip);
  }

  function updateTooltip(x, y, color) {
    if (!tooltip) return;
    const hex = rgbToHex(color.r, color.g, color.b);
    const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const hsl = rgbToHsl(color.r, color.g, color.b);

    tooltip.querySelector('#cp-swatch').style.background = hex;
    tooltip.querySelector('#cp-hex').textContent = hex;
    tooltip.querySelector('#cp-rgb').textContent = rgb;
    tooltip.querySelector('#cp-hsl').textContent = hsl;

    const padding = 16;
    let left = x + padding;
    let top = y + padding;
    if (left + 180 > window.innerWidth) left = x - 190;
    if (top + 80 > window.innerHeight) top = y - 90;

    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.display = 'flex';
  }

  function onMouseMove(e) {
    if (!picking || !canvas) return;
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;
    const color = getPixelColor(Math.round(e.clientX * scaleX), Math.round(e.clientY * scaleY));
    if (color) updateTooltip(e.clientX, e.clientY, color);
  }

  function onClick(e) {
    if (!picking || !canvas) return;
    e.preventDefault();
    e.stopPropagation();
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;
    const color = getPixelColor(Math.round(e.clientX * scaleX), Math.round(e.clientY * scaleY));
    if (!color) return;

    const hex = rgbToHex(color.r, color.g, color.b);
    const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const hsl = rgbToHsl(color.r, color.g, color.b);

    chrome.runtime.sendMessage({ action: 'saveColor', color: { hex, rgb, hsl } });
    navigator.clipboard.writeText(hex);

    stopPicking();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') stopPicking();
  }

  async function startPicking() {
    picking = true;
    document.body.style.cursor = 'crosshair';
    createTooltip();
    await captureScreen();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stopPicking() {
    picking = false;
    document.body.style.cursor = '';
    if (tooltip) { tooltip.style.display = 'none'; }
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'startPicker') {
      startPicking().then(() => sendResponse({ ok: true }));
      return true;
    }
  });
})();
