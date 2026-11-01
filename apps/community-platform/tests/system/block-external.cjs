// Test-process preload only. No application or production config imports this.
const originalFetch = globalThis.fetch;
globalThis.fetch = function loopbackFetch(input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    return Promise.reject(new Error(`System harness blocked external fetch to ${url.origin}`));
  }
  return originalFetch.call(this, input, options);
};
