// CHUD · shared helpers
export const CONFIG = { ca: '', x: '' };          // set once the coin is live: ca = mint, x = handle or url

const BUS = new Map();
export const on = (e, f) => { (BUS.get(e) || BUS.set(e, []).get(e)).push(f); };
export const emit = (e, v) => (BUS.get(e) || []).forEach(f => { try { f(v); } catch (err) { console.error(err); } });
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const b64e = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const ok = v => v != null && isFinite(v);

// prices: tiny memecoin prices keep their significant digits
export function px(v) {
  if (!ok(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 1) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: a >= 100 ? 2 : 4 });
  if (a === 0) return '$0';
  if (a >= .0001) return '$' + v.toPrecision(4);
  const s = v.toExponential(3).split('e'); const zeros = -parseInt(s[1], 10) - 1;
  return '$0.0' + subDigits(zeros) + s[0].replace('.', '').replace('-', '').slice(0, 4);
}
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const subDigits = n => String(n).split('').map(d => SUB[+d]).join('');
export function usd(v, d) {
  if (!ok(v)) return '—';
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 1e9) return sg + '$' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return sg + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return sg + '$' + (a / 1e3).toFixed(1) + 'K';
  return sg + '$' + a.toLocaleString('en-US', { minimumFractionDigits: d ?? (a < 100 ? 2 : 0), maximumFractionDigits: d ?? (a < 100 ? 2 : 0) });
}
export const pct = (v, d = 2) => !ok(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(d) + '%';
export const cls = v => !ok(v) ? '' : v > 0 ? 'up' : v < 0 ? 'dn' : '';
export function num(v, d = 2) {
  if (!ok(v)) return '—'; const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(d) + 'B'; if (a >= 1e6) return (v / 1e6).toFixed(d) + 'M'; if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
  if (a >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: a >= 100 ? 0 : 2 });
  return v.toPrecision(3);
}
export const solscan = (x, kind = 'tx') => `https://solscan.io/${kind}/${x}`;
export function toast(msg, kind = '', ms = 6000) {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = msg;
  $('#toasts').appendChild(t); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 450); }, ms);
}
export async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied', 'ok', 2500); } catch { toast('Copy failed. Select it by hand.', 'err'); } }
export const img = url => (/^https:\/\//.test(url || '') ? '/api/img?u=' + encodeURIComponent(url) : url);
export function icon(url, label) {
  const l = esc((label || '?').slice(0, 3)); url = img(url);
  return url ? `<img class="ic" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;ic&quot;>${l}</span>'">` : `<span class="ic">${l}</span>`;
}
export function debounce(f, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; }
export function parseNum(s) { const v = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isFinite(v) ? v : NaN; }
