// CHUD · the meme market band: live totals and a treemap of every meme perp on Hyperliquid (size = open interest or volume,
// colour = 24h move), each tile wearing the coin's real logo. Tap a tile to trade it in the terminal.
import { $, $$, on, esc, px, usd, pct, cls, coinIcon } from './core.js';
import * as api from './api.js';
import { gsap, ScrollTrigger } from './motion.js';

let by = 'oi', drawn = false;
export function init() {
  on('perps', paint); if (api.perps.list.length) paint();
  on('mids', () => $$('#heat .tl').forEach(t => { const v = api.mids[t.dataset.c]; if (v) { const e = t.querySelector('.tp'); if (e) e.textContent = px(v); } }));
  $('#heatBy').onclick = e => { const b = e.target.closest('button'); if (!b) return; by = b.dataset.b; $$('#heatBy button').forEach(x => x.classList.toggle('on', x === b)); paint(); };
  $('#heat').onclick = e => { const t = e.target.closest('.tl'); if (!t) return; window.__chudPerp && window.__chudPerp(t.dataset.c, +t.dataset.ch >= 0 ? 'long' : 'short'); document.querySelector('a[href="#terminal"]').click(); };
  new ResizeObserver(() => paint()).observe($('#heat'));
}
function paint() {
  const L = api.perps.list.filter(p => p.meme && p.oi > 0); if (!L.length) return;
  const up = L.filter(p => p.chg > 0).length, oi = L.reduce((s, p) => s + p.oi, 0), vol = L.reduce((s, p) => s + p.vol, 0);
  const fund = L.reduce((s, p) => s + p.apr * p.oi, 0) / (oi || 1), top = L.slice().sort((a, b) => b.chg - a.chg)[0];
  $('#msN').textContent = L.length; $('#msUD').innerHTML = `<span class="up">${up} up</span> · <span class="dn">${L.length - up} down</span>`;
  $('#msOI').textContent = usd(oi); $('#msVol').textContent = usd(vol); $('#msTop').innerHTML = top ? `top: ${esc(top.name)} <span class="${cls(top.chg)}">${pct(top.chg, 1)}</span>` : '—';
  const f = $('#msFund'); f.textContent = (fund >= 0 ? '+' : '') + fund.toFixed(1) + '%'; f.className = cls(fund);
  const box = $('#heat'), W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
  const items = L.map(p => ({ p, v: Math.max(1, by === 'oi' ? p.oi : p.vol) })).sort((a, b) => b.v - a.v).slice(0, 22);
  const rects = squarify(items, 0, 0, W, H);
  box.innerHTML = rects.map(({ p, x, y, w, h }) => {
    const c = Math.max(-12, Math.min(12, p.chg || 0)) / 12, a = .18 + Math.abs(c) * .62;
    const bg = c >= 0 ? `rgba(31,157,85,${a.toFixed(2)})` : `rgba(200,49,61,${a.toFixed(2)})`;
    const big = w > 120 && h > 84, mid = w > 70 && h > 52, tiny = w < 46 || h < 30;
    return `<button class="tl ${big ? 'big' : mid ? 'mid' : 'sm'}" type="button" data-c="${esc(p.name)}" data-ch="${p.chg || 0}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${(w - 3).toFixed(1)}px;height:${(h - 3).toFixed(1)}px;background:${bg}" title="${esc(p.name)} ${pct(p.chg)}">
      ${mid ? coinIcon(p.name, 'hi') : ''}${tiny ? '' : `<b>${esc(p.name)}</b>`}${mid ? `<em>${pct(p.chg, 1)}</em>` : ''}${big ? `<span class="tp">${px(api.mids[p.name] || p.mark)}</span>` : ''}</button>`;
  }).join('');
  if (!drawn) { drawn = true; gsap.from($$('#heat .tl'), { scale: .6, opacity: 0, duration: .7, ease: 'back.out(1.5)', stagger: { each: .02, from: 'start' }, scrollTrigger: { trigger: '#heat', start: 'top 85%', once: true } }); }
}
// squarified treemap (Bruls et al.)
function squarify(items, x, y, w, h) {
  const total = items.reduce((s, i) => s + i.v, 0), area = w * h, out = [];
  let rest = items.map(i => ({ ...i, a: i.v / total * area }));
  while (rest.length) {
    const short = Math.min(w, h); let row = [rest[0]], best = worst(row, short), i = 1;
    while (i < rest.length) { const next = [...row, rest[i]], wv = worst(next, short); if (wv > best) break; row = next; best = wv; i++; }
    const sum = row.reduce((s, r) => s + r.a, 0);
    if (w >= h) { const cw = sum / h; let cy = y; for (const r of row) { const rh = r.a / cw; out.push({ p: r.p, x, y: cy, w: cw, h: rh }); cy += rh; } x += cw; w -= cw; }
    else { const ch = sum / w; let cx = x; for (const r of row) { const rw = r.a / ch; out.push({ p: r.p, x: cx, y, w: rw, h: ch }); cx += rw; } y += ch; h -= ch; }
    rest = rest.slice(row.length);
  }
  return out;
}
function worst(row, s) { const sum = row.reduce((a, r) => a + r.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(s * s * mx / (sum * sum), (sum * sum) / (s * s * mn)); }
