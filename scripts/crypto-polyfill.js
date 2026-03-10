try {
  if (typeof globalThis.crypto === 'undefined') {
    // Use Node's Web Crypto API as a global `crypto` for tools like serialize-javascript
    // eslint-disable-next-line n/global-require, n/no-unsupported-features/node-builtins
    const { webcrypto } = require('crypto');
    if (webcrypto) {
      globalThis.crypto = webcrypto;
    }
  }
} catch {
  // Best-effort polyfill; ignore if not available
}

