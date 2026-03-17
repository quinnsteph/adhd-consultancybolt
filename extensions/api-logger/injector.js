// Runs in MAIN world — patches fetch and XHR before page scripts load
(() => {
  const dispatch = (data) => {
    window.dispatchEvent(new CustomEvent('__api_log__', { detail: data }));
  };

  // ── Patch fetch ──────────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const method = (args[1]?.method || 'GET').toUpperCase();
    const reqHeaders = Object.fromEntries(
      new Headers(args[1]?.headers || {}).entries()
    );
    const startTime = Date.now();

    try {
      const response = await origFetch.apply(this, args);
      const clone = response.clone();
      let body = '';
      try { body = await clone.text(); } catch {}

      const resHeaders = {};
      response.headers.forEach((v, k) => (resHeaders[k] = v));

      dispatch({
        id: crypto.randomUUID(),
        type: 'fetch',
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        reqHeaders,
        resHeaders,
        body: body.slice(0, 5000),
        duration: Date.now() - startTime,
        time: new Date().toISOString(),
      });

      return response;
    } catch (err) {
      dispatch({
        id: crypto.randomUUID(),
        type: 'fetch',
        method,
        url,
        status: 0,
        statusText: 'Network Error',
        reqHeaders,
        resHeaders: {},
        body: err.message,
        duration: Date.now() - startTime,
        time: new Date().toISOString(),
      });
      throw err;
    }
  };

  // ── Patch XHR ────────────────────────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__log = { method: method.toUpperCase(), url, reqHeaders: {} };
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
    if (this.__log) this.__log.reqHeaders[key] = value;
    return origSetHeader.call(this, key, value);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (!this.__log) return origSend.call(this, body);
    const startTime = Date.now();
    const log = this.__log;

    this.addEventListener('loadend', () => {
      const resHeaders = {};
      (this.getAllResponseHeaders() || '').split('\r\n').forEach((line) => {
        const [k, ...v] = line.split(': ');
        if (k) resHeaders[k] = v.join(': ');
      });

      dispatch({
        id: crypto.randomUUID(),
        type: 'xhr',
        method: log.method,
        url: log.url,
        status: this.status,
        statusText: this.statusText,
        reqHeaders: log.reqHeaders,
        resHeaders,
        body: (this.responseText || '').slice(0, 5000),
        duration: Date.now() - startTime,
        time: new Date().toISOString(),
      });
    });

    return origSend.call(this, body);
  };
})();
