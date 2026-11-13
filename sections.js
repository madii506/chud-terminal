// CHUD · the sections under the terminal: live tape, the hedge explainer (real data), hedge math, perps board, trending memes, the wall
import { $, $$, on, esc, px, usd, pct, cls, num, icon, parseNum, reduced, coinIcon } from './core.js';
import { gsap, ScrollTrigger } from './motion.js';
import * as api from './api.js';

export function init() {
  on('perps', P => { tape(P); board(); calcPerps(); });
  if (api.perps.list.length) { tape(api.perps); board(); calcPerps(); }
  on('mids', () => { tapeMids(); boardMids(); });
  hedgeStory(); calc(); memes('1h'); wall(); faq();
  $('#perpSet').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#perpSet button').forEach(x => x.classList.toggle('on', x === b)); B.set = b.dataset.set; board(); };
  $('#memeTf').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#memeTf button').forEach(x => x.classList.toggle('on', x === b)); memes(b.dataset.tf); };
}

// ---------------------------------------------------------------- tape: every meme perp, live
function tape(P) {
  const m = P.list.filter(p => p.meme).sort((a, b) => b.vol - a.vol); if (!m.length) return;
  const item = p => `<span class="tk" data-c="${esc(p.name)}">${coinIcon(p.name, 'ci')}<b>${esc(p.name)}</b><em class="tk-p">${px(p.mark)}</em><em class="${cls(p.chg)}">${pct(p.chg, 1)}</em><span>fund ${(p.fund * 100).toFixed(4)}%</span></span>`;
  const h = m.map(item).join('');
  $('#tapeIn').innerHTML = h + h;
  $('#tapeIn').style.animationDuration = Math.max(40, m.length * 4) + 's';
}
function tapeMids() { $$('#tapeIn .tk').forEach(el => { const v = api.mids[el.dataset.c]; if (v) el.querySelector('.tk-p').textContent = px(v); }); }

// ---------------------------------------------------------------- perps board
const B = { set: 'memes', key: 'vol', dir: -1 };
function board() {
  const L = api.perps.list.filter(p => B.set === 'all' || p.meme); if (!L.length) return;
  const val = p => ({ name: p.name, mark: p.mark, chg: p.chg, fund: p.fund, apr: p.apr, oi: p.oi, vol: p.vol, lev: p.maxLev }[B.key]);
  L.sort((a, b) => { const x = val(a), y = val(b); return typeof x === 'string' ? x.localeCompare(y) * B.dir : ((x ?? -1e18) - (y ?? -1e18)) * B.dir; });
  $('#perpRows').innerHTML = L.map(p => {
    const mint = api.PERP_MINT[p.name];
    return `<tr data-c="${esc(p.name)}"><td><div class="pn">${coinIcon(p.name)}<b>${esc(p.name)}</b>${mint && p.name !== 'SOL' ? '<small>solana</small>' : ''}</div></td><td class="m">${px(api.mids[p.name] || p.mark)}</td><td class="${cls(p.chg)}">${pct(p.chg)}</td><td class="${cls(p.fund)}">${(p.fund * 100).toFixed(4)}%</td><td class="${cls(p.apr)}">${p.apr.toFixed(1)}%</td><td>${usd(p.oi)}</td><td>${usd(p.vol)}</td><td>${p.maxLev}x</td><td class="acts"><button type="button" class="lg" data-x="long" data-n="${esc(p.name)}">Long</button><button type="button" class="sh" data-x="short" data-n="${esc(p.name)}">Short</button>${mint && p.name !== 'SOL' ? `<button type="button" data-h="${esc(p.name)}">Hedge</button>` : ''}</td></tr>`;
  }).join('');
  $$('#perpTbl th').forEach(th => th.classList.toggle('sorted', th.dataset.k === B.key));
}
$('#perpTbl thead').onclick = e => { const th = e.target.closest('th[data-k]'); if (!th) return; if (B.key === th.dataset.k) B.dir *= -1; else { B.key = th.dataset.k; B.dir = th.dataset.k === 'name' ? 1 : -1; } board(); };
$('#perpRows').onclick = e => {
  const q = e.target.closest('button[data-x]');
  if (q) { window.__chudPerp && window.__chudPerp(q.dataset.n, q.dataset.x); document.querySelector('a[href="#terminal"]').click(); return; }
  const b = e.target.closest('button[data-h]'); if (!b) return;
  const name = b.dataset.h, mint = api.PERP_MINT[name];
  if (mint && mint !== api.SOL_MINT && window.__chudPick) window.__chudPick(mint, 'hedge');
  window.__chudHedgePerp && window.__chudHedgePerp(name);
  document.querySelector('a[href="#terminal"]').click();
};
const last = {};
function boardMids() {
  $$('#perpRows tr[data-c]').forEach(tr => {
    const c = tr.dataset.c, v = api.mids[c]; if (!v) return;
    const td = tr.querySelector('.m'); if (last[c] && v !== last[c]) { td.classList.remove('flash-u', 'flash-d'); void td.offsetWidth; td.classList.add(v > last[c] ? 'flash-u' : 'flash-d'); }
    last[c] = v; td.textContent = px(v);
  });
}

// ---------------------------------------------------------------- trending memes (Jupiter)
async function memes(tf) {
  const box = $('#memeCards');
  try {
    const list = (await api.trending(tf, 24)).filter(t => t.mint && t.symbol);
    box.innerHTML = list.map(t => {
      const s = t['s' + tf] || {}, perp = api.MINT_PERP[t.mint];
      const flow = (s.buyVolume || 0) + (s.sellVolume || 0), buys = flow ? (s.buyVolume || 0) / flow * 100 : null;
      return `<button class="card" data-m="${esc(t.mint)}" type="button"><div class="card-h">${icon(t.icon, t.symbol)}<div><b>${esc(t.symbol)}</b><span>${esc(t.name)}</span></div></div>
        <div class="card-p"><b>${px(t.price)}</b><em class="${cls(s.priceChange)}">${pct(s.priceChange, 1)}</em></div>
        <div class="card-m"><div>Mcap<b>${usd(t.mcap)}</b></div><div>Liquidity<b>${usd(t.liq)}</b></div><div>Volume ${tf}<b>${usd(flow)}</b></div><div>Traders<b>${num(s.numTraders || 0, 1)}</b></div></div>
        <div class="pb"><i style="width:${buys != null ? buys.toFixed(0) : 50}%"></i></div>
        <span class="badge ${perp ? '' : 'no'}">${perp ? 'own perp: ' + esc(perp) : 'hedge with SOL'}</span></button>`;
    }).join('');
    if (!reduced()) gsap.fromTo($$('.card', box), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'power3.out', stagger: .03, scrollTrigger: { trigger: box, start: 'top 88%', once: true } });
  } catch { box.innerHTML = '<p class="empty mono">Jupiter is not answering. Try again in a moment.</p>'; }
  box.onclick = e => { const c = e.target.closest('.card'); if (!c) return; window.__chudPick && window.__chudPick(c.dataset.m, 'ape'); document.querySelector('a[href="#terminal"]').click(); };
}

// ---------------------------------------------------------------- the hedge story: a real coin, a real SOL short, the net (7 days, hourly)
async function hedgeStory() {
  const cv = $('#hedgeCv'); let D = null, prog = 0;
  const draw = () => {
    const box = cv.parentElement, dpr = Math.min(2, devicePixelRatio || 1), w = box.clientWidth, h = box.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!D) return;
    const all = [...D.coin, ...D.hedge, ...D.net]; const lo = Math.min(...all, -5), hi = Math.max(...all, 5);
    const pad = 26, y = v => pad + (hi - v) / (hi - lo) * (h - pad * 2 - 30), x = i => pad + i / (D.coin.length - 1) * (w - pad * 2);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(pad, y(0)); g.lineTo(w - pad, y(0)); g.stroke(); g.setLineDash([]);
    g.font = '10.5px JBM, monospace'; g.fillStyle = '#5b5b57'; g.fillText('0%', w - pad - 16, y(0) - 6);
    const line = (arr, col, p, wd) => { const n = Math.max(2, Math.floor(arr.length * Math.min(1, Math.max(0, p)))); g.strokeStyle = col; g.lineWidth = wd; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < n; i++) i ? g.lineTo(x(i), y(arr[i])) : g.moveTo(x(i), y(arr[i])); g.stroke(); if (p > 0 && p < 1.001) { g.fillStyle = col; g.beginPath(); g.arc(x(n - 1), y(arr[n - 1]), 3.5, 0, 7); g.fill(); } };
    line(D.coin, '#3ade7c', prog * 3, 2);
    if (prog > .33) line(D.hedge, '#ff4d5a', (prog - .33) * 3, 2);
    if (prog > .66) line(D.net, '#f2f1ec', (prog - .66) * 3, 2.6);
  };
  new ResizeObserver(draw).observe(cv.parentElement);
  try {
    const coin = 'FARTCOIN', ms = 7 * 864e5;
    const [a, s] = await Promise.all([api.candles(coin, '1h', ms), api.candles('SOL', '1h', ms)]);
    const n = Math.min(a.length, s.length); const A = a.slice(-n), S = s.slice(-n);
    const ra = A.map((k, i) => i ? Math.log(k.c / A[i - 1].c) : 0), rs = S.map((k, i) => i ? Math.log(k.c / S[i - 1].c) : 0);
    const ma = ra.reduce((p, v) => p + v, 0) / n, msol = rs.reduce((p, v) => p + v, 0) / n;
    let cov = 0, vs = 0; for (let i = 1; i < n; i++) { cov += (ra[i] - ma) * (rs[i] - msol); vs += (rs[i] - msol) ** 2; }
    const beta = Math.max(.3, Math.min(4, cov / (vs || 1)));
    const c0 = A[0].c, s0 = S[0].c;
    D = { coin: A.map(k => (k.c / c0 - 1) * 100), hedge: S.map(k => -beta * (k.c / s0 - 1) * 100) };
    D.net = D.coin.map((v, i) => v + D.hedge[i]);
    const dd = arr => { let pk = -1e9, m = 0; for (const v of arr) { const e = 100 + v; pk = Math.max(pk, e); m = Math.min(m, (e / pk - 1) * 100); } return m; };
    $('#hedgeLeg').innerHTML = `<span><i class="sw g"></i>${coin} <b class="${cls(D.coin[n - 1])}">${pct(D.coin[n - 1], 1)}</b></span><span><i class="sw r"></i>SOL short ×${beta.toFixed(2)} <b class="${cls(D.hedge[n - 1])}">${pct(D.hedge[n - 1], 1)}</b></span><span><i class="sw" style="background:#f2f1ec"></i>net <b class="${cls(D.net[n - 1])}">${pct(D.net[n - 1], 1)}</b></span><span>worst dip: bag ${dd(D.coin).toFixed(1)}% · net ${dd(D.net).toFixed(1)}%</span>`;
    $('#hedgeCap').textContent = `${coin} vs a β ${beta.toFixed(2)} SOL short · Hyperliquid · 7d hourly`;
  } catch { $('#hedgeCap').textContent = 'Hyperliquid is not answering right now.'; }
  const beats = $$('#beats li');
  if (reduced()) { prog = 1; draw(); beats.forEach(b => b.classList.add('on')); return; }
  ScrollTrigger.create({
    trigger: '#hedge', start: 'top 70%', end: 'bottom 60%', scrub: .6,
    onUpdate: st => { prog = st.progress * 1.02; draw(); const k = prog < .33 ? 0 : prog < .66 ? 1 : 2; beats.forEach((b, i) => b.classList.toggle('on', i <= k)); },
  });
  gsap.fromTo('.split-chud', { y: 60, rotate: -4, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#hedge', start: 'top 70%', once: true } });
}

// ---------------------------------------------------------------- hedge math
function calcPerps() {
  const sel = $('#cPerp'); if (sel.options.length > 2 || !api.perps.list.length) return;
  const m = api.perps.list.filter(p => p.meme).sort((a, b) => b.vol - a.vol).slice(0, 30);
  const maj = ['SOL', 'BTC', 'ETH'].map(n => api.perps.by[n]).filter(Boolean);
  sel.innerHTML = [...maj, ...m].map(p => `<option value="${esc(p.name)}" ${p.name === 'SOL' ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  calcRun();
}
function calc() {
  ['cBag', 'cPerp', 'cPct', 'cLev', 'cCoin', 'cPerpMv'].forEach(id => $('#' + id).addEventListener('input', calcRun));
  $('#cPerp').innerHTML = '<option value="SOL">SOL</option>';
  calcRun();
}
function calcRun() {
  const bag = parseNum($('#cBag').value) || 0, pc = +$('#cPct').value / 100, lev = +$('#cLev').value, cm = +$('#cCoin').value / 100, pm = +$('#cPerpMv').value / 100;
  const p = api.perps.by[$('#cPerp').value];
  $('#cPctV').textContent = Math.round(pc * 100) + '%'; $('#cLevV').textContent = lev + 'x';
  $('#cCoinV').textContent = (cm > 0 ? '+' : '') + Math.round(cm * 100) + '%'; $('#cPerpV').textContent = (pm > 0 ? '+' : '') + Math.round(pm * 100) + '%';
  const sh = bag * pc, liq = (1 / lev - (p ? 1 / (2 * p.maxLev) : .02));
  const shortPnl = pm >= liq ? -sh / lev : -sh * pm;                                    // a short that gets liquidated loses its margin
  const bagPnl = bag * cm, netPnl = bagPnl + shortPnl;
  const set = (id, v) => { const e = $(id); e.textContent = (v > 0 ? '+' : '') + usd(v); e.className = cls(v); };
  set('#oBag', bagPnl); set('#oShort', shortPnl); set('#oNet', netPnl);
  const f = p ? sh * p.fund * 24 : null;
  $('#oKv').innerHTML = [['Short size', usd(sh)], ['Margin locked', usd(sh / lev)], ['Liquidated if the perp pumps', '≈ +' + (liq * 100).toFixed(0) + '%'], ['Funding now', f == null ? '—' : `${f >= 0 ? 'earn' : 'pay'} ${usd(Math.abs(f))}/day`], ['Unhedged result', usd(bagPnl)], ['Hedge saved', usd(netPnl - bagPnl)]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  const rows = [['Market dumps', -.5, -.15], ['Your coin rugs alone', -.8, 0], ['Everything pumps', 1, .2], ['Coin pumps, market flat', .6, 0]];
  $('#oScen tbody').innerHTML = rows.map(([n, c, q]) => { const s2 = q >= liq ? -sh / lev : -sh * q, u = bag * c, hdg = u + s2; return `<tr><td>${n}</td><td class="${cls(c)}">${c > 0 ? '+' : ''}${c * 100}%</td><td class="${cls(q)}">${q > 0 ? '+' : ''}${q * 100}%</td><td class="${cls(u)}">${usd(u)}</td><td class="${cls(hdg)}">${usd(hdg)}</td></tr>`; }).join('');
}

// ---------------------------------------------------------------- the wall of chuds behind the last band
function wall() {
  const w = $('#wall'); w.innerHTML = Array.from({ length: 36 }, (_, i) => `<img src="/wall-${String(i).padStart(2, '0')}.webp?v=1" alt="" loading="lazy" width="160" height="160">`).join('');
  if (reduced()) return;
  gsap.fromTo($$('img', w), { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, ease: 'back.out(1.6)', stagger: { each: .025, from: 'center', grid: 'auto' }, scrollTrigger: { trigger: '#end', start: 'top 75%', once: true } });
  gsap.fromTo('.end-chud', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#end', start: 'top 70%', once: true } });
}
function faq() { $$('#faqList details').forEach(d => d.addEventListener('toggle', () => { if (d.open) $$('#faqList details').forEach(o => { if (o !== d) o.open = false; }); })); }
