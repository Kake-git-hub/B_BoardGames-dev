export function qs(selector, root = document) {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Not found: ${selector}`);
  return el;
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nowMs() {
  return Date.now();
}

export function randomId(len = 20) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  let bytes = null;
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      bytes = crypto.getRandomValues(new Uint8Array(len));
    }
  } catch (e) {
    bytes = null;
  }
  for (let i = 0; i < len; i++) {
    const v = bytes ? bytes[i] : Math.floor(Math.random() * 256);
    out += alphabet[v % alphabet.length];
  }
  return out;
}

export function parseIntSafe(v, fallback) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
