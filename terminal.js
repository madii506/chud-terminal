// CHUD · the terminal: find a meme, chart it, ape it through Jupiter, hedge it on Hyperliquid, watch the net
import { $, $$, on, emit, esc, px, usd, pct, cls, num, icon, img, debounce, parseNum, toast, solscan, short, store, ok } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';

const S = { tok: null, tf: '15m', side: 'buy', tab: 'ape', perp: null, lev: 3, bag: {}, bagTot: 0, hl: null, candles: [], trendTf: '1h' };
const LAMPORTS = 1e9;

export function init() {
  bindSearch(); bindTabs(); bindApe(); bindHedge(); bindChart(); bindPerps(); bindUnder(); bindKeys();
  loadList();
  const want = new URLSearchParams(location.search).get('t');
  pick(want || api.FART, true);
  on('perps', () => { fillPerpSelect(); fillPx(); hedgeCalc(); pxCalc(); tickers(); if (S.list === 'perps') loadList(); if (S.under === 'perp') under(); });
  on('mids', debounce(() => { hedgeCalc(); pxCalc(); drawHL(); tickerMids(); }, 800));
  on('sol', () => { pills(); apeBtn(); loadBag(); });
  on('evm', () => { pills(); hedgeBtn(); loadHL(); });
  on('wallets', pills);
  pills();
  setInterval(() => { if (W.sol.address) loadBag(); if (W.evm.address) loadHL(); }, 30000);
  setInterval(() => { if (S.tok && document.visibilityState === 'visible') loadChart(); }, 45000);
  setInterval(() => { if (S.under === 'trades' && document.visibilityState === 'visible') under(); }, 12000);
  $('#hedgeAll').onclick = hedgeAll;
  window.__chudPick = (mint, tab) => { pick(mint); if (tab) setTab(tab); };
  window.__chudHedgePerp = name => { setTab('hedge'); S.perp = name; fillPerpSelect(); hedgeCalc(); };
}

// ---------------------------------------------------------------- wallet pills above the terminal
function pills() {
  $('#termWallets').innerHTML =
    `<button class="wpill ${W.sol.address ? 'on' : ''}" data-w="sol" type="button"><i></i>${W.sol.address ? 'SOL ' + short(W.sol.address) : 'Solana wallet'}</button>` +
    `<button class="wpill ${W.evm.address ? 'on' : ''}" data-w="evm" type="button"><i></i>${W.evm.address ? 'HL ' + short(W.evm.address) : 'Hyperliquid'}</button>`;
  $('#termWallets').onclick = e => { if (e.target.closest('.wpill')) window.__wallets(); };
}

// ---------------------------------------------------------------- trending + search
async function loadTrending(tf) { S.trendTf = tf; return loadList(); }
async function loadList() {
  const tf = S.trendTf || '1h', src = S.list || 'trend';
  $('#trendTf').style.visibility = src === 'new' || src === 'perps' || src === 'watch' ? 'hidden' : '';
  if (src === 'perps') return listPerps();
  if (src === 'watch') return listWatch();
  try {
    const list = (await (src === 'new' ? api.recent(60) : src === 'top' ? api.topOrganic(tf, 60) : api.trending(tf, 60))).filter(t => t.mint && t.symbol && !/^(USD|PYUSD|EURC)|USD[A-Z]?$/i.test(t.symbol) && !/xStock|tokenized|Backpack|Securities|Ondo/i.test(t.name || '') && !/x$/.test(t.symbol) && !/^(SOL|WSOL|JitoSOL|mSOL|bSOL|JupSOL|INF|cbBTC|WBTC|WETH)$/i.test(t.symbol)).slice(0, 40);
    S.trend = list;
    $('#trendRows').innerHTML = list.map(t => {
      const ch = (t['s' + tf] || {}).priceChange;
      return `<button class="trow ${S.tok && S.tok.mint === t.mint ? 'on' : ''}" data-m="${esc(t.mint)}" type="button">${icon(t.icon, t.symbol)}<div><b>${esc(t.symbol)}</b><span>${usd(t.mcap)}</span></div><em class="${cls(ch)}">${pct(ch, 1)}</em></button>`;
    }).join('') || '<p class="empty mono" style="padding:12px">Nothing trending right now.</p>';
    emit('trending', list);
  } catch { $('#trendRows').innerHTML = '<p class="empty mono" style="padding:12px">Jupiter is not answering. Try again in a moment.</p>'; }
}
function bindSearch() {
  $('#trendRows').onclick = e => { const b = e.target.closest('.trow'); if (!b) return; if (b.dataset.p) return perpRow(b.dataset.p); pick(b.dataset.m); };
  $('#listTab').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#listTab button').forEach(x => x.classList.toggle('on', x === b)); S.list = b.dataset.l; $('#trendRows').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>'; loadList(); };
  $('#trendTf').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#trendTf button').forEach(x => x.classList.toggle('on', x === b)); loadTrending(b.dataset.tf); };
  const q = $('#q'), box = $('#results');
  let seq = 0;
  const run = debounce(async () => {
    const v = q.value.trim(); if (v.length < 2) { box.hidden = true; return; }
    const my = ++seq;
    try {
      const r = (await api.search(v)).slice(0, 12); if (my !== seq) return;
      box.innerHTML = r.length ? r.map(t => `<button data-m="${esc(t.mint)}" type="button">${icon(t.icon, t.symbol)}<div class="r-n"><b>${esc(t.symbol)} ${t.verified ? '<span style="color:var(--g)">✓</span>' : ''}</b><span>${esc(t.name)} · ${short(t.mint)}</span></div><div class="r-v">${usd(t.mcap)}<br>${api.MINT_PERP[t.mint] ? '<span style="color:var(--g)">perp</span>' : ''}</div></button>`).join('') : '<p class="empty mono" style="padding:14px">No match. Paste the mint to be sure.</p>';
      box.hidden = false;
    } catch { box.hidden = true; }
  }, 300);
  q.addEventListener('input', run);
  q.addEventListener('focus', () => { if (box.innerHTML && q.value.trim().length > 1) box.hidden = false; });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = box.querySelector('button'); if (f) f.click(); } if (e.key === 'Escape') box.hidden = true; });
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; box.hidden = true; q.value = ''; pick(b.dataset.m); };
  document.addEventListener('click', e => { if (!e.target.closest('#results') && !e.target.closest('.search')) box.hidden = true; });
}

// ---------------------------------------------------------------- the selected coin
async function pick(mint, first) {
  if (!mint) return;
  let t = (S.trend || []).find(x => x.mint === mint);
  if (!t) { try { t = (await api.search(mint)).find(x => x.mint === mint); } catch {} }
  if (!t) { if (first && mint !== api.FART) return pick(api.FART); if (!first) toast('That mint was not found on Jupiter.', 'err'); else { $('#tokName').textContent = 'Jupiter is not answering'; setTimeout(() => pick(mint, true), 8000); } return; }
  S.tok = t;
  $$('#trendRows .trow').forEach(b => b.classList.toggle('on', b.dataset.m === mint));
  $('#tokIc').innerHTML = t.icon ? `<img src="${esc(img(t.icon))}" alt="" referrerpolicy="no-referrer">` : esc(t.symbol.slice(0, 3));
  $('#tokSym').textContent = t.symbol; $('#tokName').textContent = t.name + (t.launchpad ? ' · ' + t.launchpad : '');
  head();
  const own = api.MINT_PERP[mint];
  S.perp = own && api.perps.by[own] ? own : (S.perp && api.perps.by[S.perp] ? S.perp : 'SOL');
  if (own && !api.perps.by[own] && api.perps.list.length === 0) S.perp = own;    // perps still loading
  fillPerpSelect();
  const held = S.bag[mint]; if (held && held.usd > 1) $('#hgBag').value = Math.round(held.usd);
  apeBtn(); apeQuote(); hedgeCalc(); loadChart(); under(); starBtn(); betaRun();
  if (!first) history.replaceState(null, '', '?t=' + mint + location.hash);
}
function head() {
  const t = S.tok; if (!t) return;
  const ch = (t.s24h || {}).priceChange;
  $('#tokPx').textContent = px(t.price); const e = $('#tokCh'); e.textContent = pct(ch) + ' 24h'; e.className = cls(ch);
  const st = [['Mcap', usd(t.mcap)], ['Liquidity', usd(t.liq)], ['Holders', num(t.holders, 1)], ['Vol 24h', usd(((t.s24h || {}).buyVolume || 0) + ((t.s24h || {}).sellVolume || 0))]];
  if (ok(t.top10)) st.push(['Top 10', t.top10.toFixed(1) + '%', t.top10 > 40 ? 'bad' : '']);
  if (t.mintOff != null) st.push(['Mint auth', t.mintOff ? 'off' : 'ON', t.mintOff ? 'ok' : 'bad']);
  const own = api.MINT_PERP[t.mint]; st.push(['Perp', own && own !== 'SOL' ? own : own === 'SOL' ? 'SOL' : 'none, hedge SOL', own ? 'ok' : '']);
  const ck = checks(t), pass = ck.filter(c => c[1]).length; st.push(['Chud check', pass + '/' + ck.length, pass >= ck.length - 1 ? 'ok' : pass <= ck.length / 2 ? 'bad' : '']);
  $('#tokStats').innerHTML = st.map(([k, v, c]) => `<div class="${c || ''}">${k}<b>${esc(v)}</b></div>`).join('');
}

// ---------------------------------------------------------------- chart (GeckoTerminal candles, drawn on a canvas)
function bindChart() {
  $('#chartTf').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#chartTf button').forEach(x => x.classList.toggle('on', x === b)); S.tf = b.dataset.tf; loadChart(); };
  const cv = $('#chartCv');
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); S.hover = (e.clientX - r.left) / r.width; drawChart(); });
  cv.addEventListener('pointerleave', () => { S.hover = null; drawChart(); });
  new ResizeObserver(() => drawChart()).observe($('#chart'));
}
async function loadChart() {
  const t = S.tok; if (!t) return;
  const my = t.mint + S.tf; S.chartKey = my;
  $('#chartEmpty').hidden = true;
  try {
    const pool = await api.topPool(t.mint);
    if (!pool) throw new Error('no pool');
    const c = await api.poolCandles(pool.address, S.tf, t.mint);
    if (S.chartKey !== my) return;
    S.candles = c; $('#chartSrc').textContent = (pool.dex || '').replace(/_/g, ' ') + ' · ' + short(pool.address);
    if (!c.length) throw new Error('empty');
    drawChart();
  } catch (e) {
    if (S.chartKey !== my) return;
    S.candles = []; drawChart(); const el = $('#chartEmpty'); el.hidden = false; el.textContent = 'No candles for this coin yet.';
  }
}
function drawChart() {
  const cv = $('#chartCv'), box = $('#chart'), dpr = Math.min(2, devicePixelRatio || 1);
  const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const c = S.candles; if (!c.length) { $('#chartTip').hidden = true; return; }
  const padR = 64, padT = 14, padB = 22, n = c.length, cw = (w - padR - 10) / n;
  let lo = Math.min(...c.map(x => x.l)), hi = Math.max(...c.map(x => x.h)); if (hi === lo) { hi *= 1.01; lo *= .99; }
  const y = v => padT + (hi - v) / (hi - lo) * (h - padT - padB);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.font = '10.5px JBM, monospace'; g.fillStyle = '#5b5b57'; g.textAlign = 'left';
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, yy = Math.round(y(v)) + .5; g.beginPath(); g.moveTo(0, yy); g.lineTo(w - padR + 4, yy); g.stroke(); g.fillText(px(v).replace('$', ''), w - padR + 8, yy + 3); }
  const vmax = Math.max(...c.map(x => x.v)) || 1;
  c.forEach((k, i) => {
    const x = 6 + i * cw + cw / 2, up = k.c >= k.o, col = up ? '#3ade7c' : '#ff4d5a';
    g.fillStyle = up ? 'rgba(58,222,124,.13)' : 'rgba(255,77,90,.13)';
    const vh = (k.v / vmax) * (h * .18); g.fillRect(x - Math.max(1, cw * .35), h - padB - vh, Math.max(1.5, cw * .7), vh);
    g.strokeStyle = col; g.beginPath(); g.moveTo(Math.round(x) + .5, y(k.h)); g.lineTo(Math.round(x) + .5, y(k.l)); g.stroke();
    g.fillStyle = col; const b0 = y(Math.max(k.o, k.c)), b1 = y(Math.min(k.o, k.c)); g.fillRect(x - Math.max(1, cw * .34), b0, Math.max(1.5, cw * .68), Math.max(1, b1 - b0));
  });
  const last = c[n - 1], ly = y(last.c);
  g.setLineDash([3, 4]); g.strokeStyle = 'rgba(242,241,236,.35)'; g.beginPath(); g.moveTo(0, ly); g.lineTo(w - padR + 4, ly); g.stroke(); g.setLineDash([]);
  g.fillStyle = last.c >= last.o ? '#3ade7c' : '#ff4d5a'; g.fillRect(w - padR + 4, ly - 9, padR - 6, 18); g.fillStyle = '#000'; g.fillText(px(last.c).replace('$', ''), w - padR + 8, ly + 4);
  const tip = $('#chartTip');
  if (S.hover != null) {
    const i = Math.max(0, Math.min(n - 1, Math.floor((S.hover * w - 6) / cw))), k = c[i], x = 6 + i * cw + cw / 2;
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, h); g.stroke();
    const d = new Date(k.t);
    tip.hidden = false; tip.innerHTML = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} · O <b>${px(k.o)}</b> H <b>${px(k.h)}</b> L <b>${px(k.l)}</b> C <b>${px(k.c)}</b>`;
  } else { const ch = (last.c / c[0].o - 1) * 100; tip.hidden = false; tip.innerHTML = `${S.tf} · ${n} candles · <b class="${cls(ch)}">${pct(ch)}</b>`; }
}

// ---------------------------------------------------------------- tabs
function bindTabs() { $('#sideTabs').onclick = e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.t); }; }
function setTab(t) { S.tab = t; $$('#sideTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $('#paneApe').hidden = t !== 'ape'; $('#paneHedge').hidden = t !== 'hedge'; $('#panePerps').hidden = t !== 'perps'; if (t === 'hedge') hedgeCalc(); if (t === 'perps') pxCalc(); }

// ---------------------------------------------------------------- ape (Jupiter Ultra)
function bindApe() {
  $('#apeSide').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.side = b.dataset.s; $$('#apeSide button').forEach(x => x.classList.toggle('on', x === b)); apeMode(); };
  $('#apeAmt').addEventListener('input', debounce(apeQuote, 400));
  $('#apeChips').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (S.side === 'buy') $('#apeAmt').value = b.dataset.v; else { const h = S.tok && S.bag[S.tok.mint]; $('#apeAmt').value = h ? +(h.ui * +b.dataset.v).toPrecision(6) : ''; } apeQuote(); };
  $('#apeGo').onclick = apeGo;
  apeMode();
}
function apeMode() {
  const buy = S.side === 'buy';
  $('#apeLbl').textContent = buy ? 'You pay (SOL)' : `You sell (${S.tok ? S.tok.symbol : 'tokens'})`;
  $('#apeChips').innerHTML = buy ? ['0.1', '0.5', '1', '5'].map(v => `<button data-v="${v}" type="button">${v} SOL</button>`).join('') : [['.25', '25%'], ['.5', '50%'], ['1', 'Max']].map(([v, l]) => `<button data-v="${v}" type="button">${l}</button>`).join('');
  if (!buy) { const h = S.tok && S.bag[S.tok.mint]; $('#apeAmt').value = h ? +(h.ui * .5).toPrecision(6) : ''; } else if (!parseNum($('#apeAmt').value)) $('#apeAmt').value = '0.5';
  apeBtn(); apeQuote();
}
function apeBtn() {
  const b = $('#apeGo'), buy = S.side === 'buy';
  b.className = 'btn btn-block ' + (buy ? 'btn-g' : 'btn-r');
  b.textContent = !W.sol.address ? 'Connect a Solana wallet' : buy ? `Ape ${S.tok ? S.tok.symbol : ''}` : `Sell ${S.tok ? S.tok.symbol : ''}`;
}
function rawAmount() {
  const v = parseNum($('#apeAmt').value); if (!(v > 0) || !S.tok) return null;
  return S.side === 'buy' ? Math.round(v * LAMPORTS) : Math.round(v * 10 ** (S.tok.dec ?? 6));
}
let qseq = 0;
async function apeQuote() {
  const amt = rawAmount(), q = $('#apeQuote'), t = S.tok;
  const row = (a, b, c) => `<div><span>${a}</span><b>${b}</b></div><div><span>Price impact</span><b>${c[0]}</b></div><div><span>Route</span><b>${c[1]}</b></div>`;
  if (!amt || !t) { q.innerHTML = row('You get', '—', ['—', '—']); return; }
  const buy = S.side === 'buy', my = ++qseq;
  q.innerHTML = row('You get', '…', ['…', '…']);
  try {
    const p = { inputMint: buy ? api.SOL_MINT : t.mint, outputMint: buy ? t.mint : api.SOL_MINT, amount: String(amt) };
    if (W.sol.address) p.taker = W.sol.address;
    const o = await api.order(p); if (my !== qseq) return;
    if (!o.outAmount) throw new Error(o.errorMessage || o.error || 'no route');
    const out = buy ? +o.outAmount / 10 ** (t.dec ?? 6) : +o.outAmount / LAMPORTS;
    const imp = o.priceImpactPct != null ? (+o.priceImpactPct * (Math.abs(+o.priceImpactPct) < 1 ? 100 : 1)) : null;
    q.innerHTML = row('You get', buy ? `${num(out)} ${esc(t.symbol)}` : `${out.toFixed(4)} SOL`, [imp != null ? Math.abs(imp).toFixed(2) + '%' : '—', esc((o.router || o.swapType || 'jupiter') + (o.routePlan && o.routePlan[0] ? ' · ' + (o.routePlan[0].swapInfo && o.routePlan[0].swapInfo.label || '') : ''))]);
  } catch (e) { if (my === qseq) q.innerHTML = row('You get', 'no route', ['—', esc(String(e.message || '').slice(0, 40))]); }
}
async function apeGo() {
  if (!W.sol.address) return window.__wallets();
  const amt = rawAmount(), t = S.tok; if (!amt || !t) return toast('Enter an amount first.', 'err');
  const b = $('#apeGo'), buy = S.side === 'buy'; b.disabled = true; b.textContent = 'Sign in your wallet…';
  try {
    const r = await W.swap({ inputMint: buy ? api.SOL_MINT : t.mint, outputMint: buy ? t.mint : api.SOL_MINT, amount: amt });
    toast(`${buy ? 'Aped' : 'Sold'} ${esc(t.symbol)}. <a href="${solscan(r.sig)}" target="_blank" rel="noopener">${short(r.sig)}</a>`, 'ok', 9000);
    setTimeout(loadBag, 1500);
  } catch (e) { toast(esc(e.message || 'The swap did not go through.') + (e.sig ? ` <a href="${solscan(e.sig)}" target="_blank" rel="noopener">tx</a>` : ''), 'err'); }
  b.disabled = false; apeBtn(); apeQuote();
}

// ---------------------------------------------------------------- your bag (Jupiter holdings, priced)
async function loadBag() {
  if (!W.sol.address) { S.bag = {}; $('#bagRows').innerHTML = '<p class="empty mono">Connect a Solana wallet to see your bag.</p>'; $('#bagTot').textContent = '—'; net(); return; }
  try {
    const h = await api.holdings(W.sol.address);
    const toks = Object.entries(h.tokens || {}).map(([mint, accs]) => ({ mint, ui: accs.reduce((s, a) => s + (+a.uiAmount || 0), 0) })).filter(x => x.ui > 0);
    const meta = await api.tokens(toks.map(x => x.mint).slice(0, 180));
    const by = Object.fromEntries(meta.map(m => [m.mint, m]));
    const solUi = +h.uiAmount || (+h.amount || 0) / LAMPORTS, solPx = (api.perps.by.SOL || {}).mark;
    const rows = toks.map(x => { const m = by[x.mint] || {}; return { ...x, sym: m.symbol || short(x.mint), icon: m.icon, usd: m.price ? m.price * x.ui : 0 }; })
      .filter(x => x.usd >= .5).sort((a, b) => b.usd - a.usd);
    S.bag = Object.fromEntries(rows.map(r => [r.mint, r]));
    S.bagTot = rows.reduce((s, r) => s + r.usd, 0);
    $('#bagTot').textContent = usd(S.bagTot) + (solUi ? ' · ' + solUi.toFixed(3) + ' SOL' : '');
    $('#bagRows').innerHTML = rows.length ? rows.slice(0, 30).map(r => `<div class="drow">${icon(r.icon, r.sym)}<b>${esc(r.sym)}</b><span>${usd(r.usd)}</span><button data-m="${esc(r.mint)}" type="button">Hedge</button></div>`).join('') : `<p class="empty mono">No memes in this wallet yet. ${solUi ? 'You have ' + solUi.toFixed(3) + ' SOL to ape with.' : ''}</p>`;
    $('#bagRows').onclick = e => { const b = e.target.closest('button'); if (!b) return; pick(b.dataset.m); setTab('hedge'); const r = S.bag[b.dataset.m]; if (r) { $('#hgBag').value = Math.round(r.usd); hedgeCalc(); } };
    if (S.tok && S.bag[S.tok.mint] && S.side === 'sell') apeMode();
    net();
  } catch { $('#bagRows').innerHTML = '<p class="empty mono">Could not read the wallet right now.</p>'; }
}

// ---------------------------------------------------------------- hedge (Hyperliquid)
function bindHedge() {
  $('#hgPerp').onchange = e => { S.perp = e.target.value; hedgeCalc(); betaRun(); };
  $('#tokStar').onclick = () => { if (!S.tok) return; const w = store.get('chud:watch', []), i = w.indexOf(S.tok.mint); i >= 0 ? w.splice(i, 1) : w.unshift(S.tok.mint); store.set('chud:watch', w.slice(0, 60)); starBtn(); if (S.list === 'watch') loadList(); };
  $('#hgBag').addEventListener('input', hedgeCalc);
  $('#hgPct').addEventListener('input', hedgeCalc);
  $('#hgLev').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.lev = +b.dataset.l; hedgeCalc(); };
  $('#hgGo').onclick = hedgeGo;
}
function fillPerpSelect() {
  const sel = $('#hgPerp'), L = api.perps.list; if (!L.length) { sel.innerHTML = `<option>${esc(S.perp || 'SOL')}</option>`; return; }
  const own = S.tok && api.MINT_PERP[S.tok.mint];
  const memes = L.filter(p => p.meme).sort((a, b) => b.vol - a.vol), majors = ['SOL', 'BTC', 'ETH', 'HYPE'].map(n => api.perps.by[n]).filter(Boolean);
  if (!api.perps.by[S.perp]) S.perp = own && api.perps.by[own] ? own : 'SOL';
  const opt = p => `<option value="${esc(p.name)}" ${p.name === S.perp ? 'selected' : ''}>${esc(p.name)}${p.name === own ? '  · this coin' : ''}</option>`;
  sel.innerHTML = `<optgroup label="Market">${majors.map(opt).join('')}</optgroup><optgroup label="Meme perps">${memes.map(opt).join('')}</optgroup>`;
}
function hedgeCalc() {
  const p = api.perps.by[S.perp], own = S.tok && api.MINT_PERP[S.tok.mint];
  const hint = $('#hgHint');
  if (S.tok) {
    if (own && own === S.perp) { hint.textContent = `Same coin: ${S.tok.symbol} has its own perp. A full hedge cancels its moves.`; hint.className = 'hint mono ok'; }
    else if (own && api.perps.by[own]) { hint.textContent = `${S.tok.symbol} has its own perp (${own}). This one is a proxy.`; hint.className = 'hint mono'; }
    else { hint.textContent = `${S.tok.symbol} has no perp. ${S.perp} covers a market dump, not a rug.`; hint.className = 'hint mono'; }
  }
  const levs = [1, 2, 3, 5, 10].filter(x => !p || x <= p.maxLev); if (!levs.includes(S.lev)) S.lev = levs.filter(x => x <= S.lev).pop() || 1;
  $('#hgLev').innerHTML = levs.map(x => `<button data-l="${x}" type="button" class="${x === S.lev ? 'on' : ''}">${x}x</button>`).join('');
  const bag = parseNum($('#hgBag').value) || 0, pc = +$('#hgPct').value; $('#hgPctV').textContent = pc + '%';
  const notional = bag * pc / 100, mark = p ? (api.mids[p.name] || p.mark) : null;
  const size = mark ? notional / mark : null, margin = notional / S.lev;
  const mm = p ? 1 / (2 * p.maxLev) : .02, liqMove = (1 / S.lev - mm) * 100;
  const fundDay = p ? notional * p.fund * 24 : null;
  $('#hgOut').innerHTML = [
    ['Short', notional ? `${usd(notional)} of ${esc(S.perp)}` : '—'],
    ['Size', size ? `${num(size, 3)} ${esc(S.perp)} @ ${px(mark)}` : '—'],
    ['Margin', notional ? usd(margin) : '—'],
    ['Liquidates if it pumps', notional ? `≈ +${liqMove.toFixed(0)}%` : '—'],
    ['Funding now', p ? `<span class="${p.fund >= 0 ? 'up' : 'dn'}">${fundDay >= 0 ? 'earn' : 'pay'} ${usd(Math.abs(fundDay || 0))}/day</span>` : '—'],
  ].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  hedgeBtn();
}
function hedgeBtn() {
  const b = $('#hgGo');
  if (!W.evm.address) { b.textContent = 'Connect for Hyperliquid'; return; }
  if (!W.agent()) { b.textContent = 'Approve session key (once)'; return; }
  const pos = S.hl && S.hl.pos.find(x => x.coin === S.perp && x.szi < 0);
  b.textContent = pos ? `Add to ${S.perp} short` : `Short ${S.perp}`;
}
async function hedgeGo() {
  if (!W.evm.address) return window.__wallets();
  const b = $('#hgGo'); b.disabled = true;
  try {
    if (!W.agent()) { b.textContent = 'Sign in your wallet…'; await W.approveAgent(); toast('Session key approved.', 'ok'); hedgeBtn(); b.disabled = false; return; }
    const p = api.perps.by[S.perp]; if (!p) throw new Error('This perp is not loaded yet.');
    const notional = (parseNum($('#hgBag').value) || 0) * +$('#hgPct').value / 100;
    if (notional < 10) throw new Error('Hyperliquid needs at least $10 per order.');
    const mark = api.mids[p.name] || p.mark;
    b.textContent = 'Sending…';
    const r = await W.marketOrder(p, false, notional / mark, { lev: S.lev });
    toast(r && r.totalSz ? `Short ${esc(p.name)} filled: ${r.totalSz} @ ${px(+r.avgPx)}` : 'Order sent.', 'ok', 9000);
    setTimeout(loadHL, 1200);
  } catch (e) { toast(esc(e.message || String(e)), 'err', 9000); }
  b.disabled = false; hedgeBtn();
}

// ---------------------------------------------------------------- your Hyperliquid account
async function loadHL() {
  if (!W.evm.address) { S.hl = null; $('#hlRows').innerHTML = '<p class="empty mono">Connect for Hyperliquid to see your positions.</p>'; $('#hlTot').textContent = '—'; net(); return; }
  try {
    const [a, sp] = await Promise.all([api.account(W.evm.address), api.spotAccount(W.evm.address).catch(() => null)]);
    const pos = (a.assetPositions || []).map(x => x.position).map(p => ({ coin: p.coin, szi: +p.szi, entry: +p.entryPx, upnl: +p.unrealizedPnl, liq: p.liquidationPx ? +p.liquidationPx : null, val: +p.positionValue, lev: p.leverage && p.leverage.value }));
    const spotUsdc = sp && sp.balances ? +((sp.balances.find(b => b.coin === 'USDC') || {}).total || 0) : 0;
    S.hl = { equity: +a.marginSummary.accountValue, free: +a.withdrawable, pos, spotUsdc };
    drawHL(); net(); hedgeBtn(); pxCalc();
    api.fills(W.evm.address).then(f => { $('#fillRows').innerHTML = (f || []).slice(0, 8).map(x => `<div class="drow hl"><b class="${x.side === 'B' ? 'up' : 'dn'}">${x.side === 'B' ? 'BUY' : 'SELL'} ${esc(x.coin)}</b><span>${num(+x.sz, 3)} @ ${px(+x.px)}</span><span class="${cls(+x.closedPnl)}">${+x.closedPnl ? usd(+x.closedPnl) : ''}</span><span>${new Date(x.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>`).join('') || '<p class="empty mono">No fills yet.</p>'; }).catch(() => {});
  } catch { $('#hlRows').innerHTML = '<p class="empty mono">Could not read Hyperliquid right now.</p>'; }
}
function drawHL() {
  const s = S.hl; if (!s) return;
  $('#hlTot').textContent = usd(s.equity) + ' equity';
  const rows = s.pos.map(p => { const m = api.mids[p.coin]; const up = m ? (m - p.entry) * p.szi : p.upnl; return `<div class="drow hl"><b>${p.szi < 0 ? '<span class="dn">SHORT</span>' : '<span class="up">LONG</span>'} ${esc(p.coin)}</b><span>${usd(Math.abs(p.val))}${p.lev ? ' · ' + p.lev + 'x' : ''}</span><span class="${cls(up)}">${usd(up)}</span><button data-c="${esc(p.coin)}" type="button">Close</button></div>`; }).join('');
  const fund = s.equity < 1 && s.spotUsdc >= 1 ? `<p class="empty mono">${usd(s.spotUsdc)} USDC sits in your spot balance. <button class="btn btn-sm btn-line" id="toPerps" type="button" style="margin-top:8px">Move it to perps</button></p>` : s.equity < 1 ? '<p class="empty mono">No USDC on Hyperliquid yet. <a href="https://app.hyperliquid.xyz/trade" target="_blank" rel="noopener" style="text-decoration:underline">Deposit there</a>, then come back.</p>' : '';
  $('#hlRows').innerHTML = rows || fund || '<p class="empty mono">No open positions.</p>';
  if (rows && fund) $('#hlRows').insertAdjacentHTML('beforeend', fund);
  $('#hlRows').onclick = async e => {
    const c = e.target.closest('button[data-c]');
    if (e.target.id === 'toPerps') { try { await W.moveToPerps(Math.floor(s.spotUsdc * 100) / 100); toast('USDC moved to perps.', 'ok'); setTimeout(loadHL, 1500); } catch (err) { toast(esc(err.message), 'err'); } return; }
    if (!c) return;
    const p = api.perps.by[c.dataset.c], pos = s.pos.find(x => x.coin === c.dataset.c); if (!p || !pos) return;
    if (!W.agent()) { try { await W.approveAgent(); } catch (err) { return toast(esc(err.message), 'err'); } }
    c.disabled = true; c.textContent = '…';
    try { const r = await W.marketOrder(p, pos.szi < 0, Math.abs(pos.szi), { reduceOnly: true }); toast(`Closed ${esc(p.name)}${r && r.avgPx ? ' @ ' + px(+r.avgPx) : ''}.`, 'ok'); setTimeout(loadHL, 1200); }
    catch (err) { toast(esc(err.message), 'err'); c.disabled = false; c.textContent = 'Close'; }
  };
}

// ---------------------------------------------------------------- net: how much of the bag the shorts cover
function net() {
  const bag = S.bagTot || 0, short = S.hl ? S.hl.pos.filter(p => p.szi < 0).reduce((s, p) => s + Math.abs(p.val), 0) : 0;
  const h = bag ? Math.min(1, short / bag) : (short ? 1 : 0);
  $('#netShort').style.width = (h * 100) + '%'; $('#netBag').style.width = (bag ? (1 - h) * 100 : 0) + '%';
  $('#netBagV').textContent = bag ? usd(bag) : '—'; $('#netShortV').textContent = short ? usd(short) : '—';
  $('#netV').textContent = bag ? Math.min(999, short / bag * 100).toFixed(0) + '% hedged' : '—';
  $('#netNote').textContent = !bag && !short ? 'Connect both wallets to see your net.' : bag && !short ? 'Fully exposed. Every dump is yours.' : short > bag * 1.05 ? 'You are net short.' : 'Hedged share of your bag.';
}

// ---------------------------------------------------------------- v2: tickers, perps list, under-chart panel, straight perps, hedge-all, keys
const TICKS = ['SOL', 'BTC', 'ETH', 'HYPE', 'FARTCOIN', 'PUMP', 'WIF', 'kBONK', 'POPCAT', 'PENGU', 'TRUMP', 'kPEPE', 'DOGE'];
function tickers() {
  const L = TICKS.map(n => api.perps.by[n]).filter(Boolean); if (!L.length) return;
  $('#tickers').innerHTML = L.map(p => `<div class="tick" data-p="${esc(p.name)}"><b>${esc(p.name)}</b><span class="tv">${px(api.mids[p.name] || p.mark)}</span><em class="${cls(p.chg)}">${pct(p.chg, 1)}</em></div>`).join('');
  $('#tickers').onclick = e => { const t = e.target.closest('.tick'); if (t) perpRow(t.dataset.p); };
}
function tickerMids() { $$('#tickers .tick').forEach(t => { const v = api.mids[t.dataset.p]; if (v) t.querySelector('.tv').textContent = px(v); }); }
function listPerps() {
  const L = api.perps.list.filter(p => p.meme).sort((a, b) => b.vol - a.vol);
  $('#trendRows').innerHTML = L.length ? L.map(p => `<button class="trow" data-p="${esc(p.name)}" type="button"><span class="ic">${esc(p.name.replace(/^k/, '').slice(0, 3))}</span><div><b>${esc(p.name)}</b><span>${usd(p.vol)} vol · ${p.maxLev}x</span></div><em class="${cls(p.chg)}">${pct(p.chg, 1)}</em></button>`).join('') : '<p class="empty mono" style="padding:12px">Reading Hyperliquid…</p>';
}
function perpRow(name) {
  const mint = api.PERP_MINT[name];
  if (mint && mint !== api.SOL_MINT) pick(mint);
  S.px = name; fillPx(); setTab('perps'); pxCalc();
}
// under the chart
function bindUnder() { $('#underTab').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#underTab button').forEach(x => x.classList.toggle('on', x === b)); S.under = b.dataset.u; under(); }; S.under = 'trades'; }
async function under() {
  const box = $('#underB'), t = S.tok, u = S.under || 'trades'; if (!t) return;
  if (u === 'info') {
    const links = [['Solscan', 'https://solscan.io/token/' + t.mint], ['DexScreener', 'https://dexscreener.com/solana/' + t.mint], ['Jupiter', 'https://jup.ag/tokens/' + t.mint]];
    if (/pump$/.test(t.mint) || /pump/i.test(t.launchpad || '')) links.push(['pump.fun', 'https://pump.fun/coin/' + t.mint]);
    const rows = [['Mint', `<a href="${links[0][1]}" target="_blank" rel="noopener">${short(t.mint)}</a>`], ['Launchpad', esc(t.launchpad || '—')], ['Verified', t.verified ? 'yes' : 'no'],
      ['Holders', num(t.holders, 1)], ['Top 10 hold', ok(t.top10) ? t.top10.toFixed(1) + '%' : '—'], ['Organic score', ok(t.organic) ? t.organic.toFixed(0) : '—'],
      ['Mint authority', t.mintOff == null ? '—' : t.mintOff ? 'revoked' : '<span class="dn">active</span>'], ['Freeze authority', t.freezeOff == null ? '—' : t.freezeOff ? 'revoked' : '<span class="dn">active</span>'], ['Links', links.slice(1).map(([n, h]) => `<a href="${h}" target="_blank" rel="noopener">${n}</a>`).join(' · ')]];
    box.innerHTML = `<div class="infog">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div><div class="checks">${checks(t).map(([n, y]) => `<div class="${y ? 'y' : 'n'}">${n}</div>`).join('')}</div>`; $('#underNote').textContent = 'chud check'; return;
  }
  if (u === 'perp') {
    const p = api.perps.by[S.perp] || api.perps.by.SOL; if (!p) { box.innerHTML = '<p class="empty">Reading Hyperliquid…</p>'; return; }
    const rows = [['Perp', esc(p.name)], ['Mark', px(api.mids[p.name] || p.mark)], ['24h', `<span class="${cls(p.chg)}">${pct(p.chg)}</span>`], ['Funding 1h', `<span class="${cls(p.fund)}">${(p.fund * 100).toFixed(4)}%</span>`], ['Funding APR', `<span class="${cls(p.apr)}">${p.apr.toFixed(1)}%</span>`], ['Open interest', usd(p.oi)], ['Volume 24h', usd(p.vol)], ['Max leverage', p.maxLev + 'x'], ['Shorts', p.fund >= 0 ? 'get paid funding' : 'pay funding']];
    box.innerHTML = `<div class="infog">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div><div class="book" id="book"></div>`; $('#underNote').textContent = esc(p.name) + ' · live book'; drawBook(p.name); return;
  }
  try {
    const pool = await api.topPool(t.mint); if (!pool) throw 0;
    const tr = (await api.poolTrades(pool.address)).slice(0, 40);
    if (S.tok !== t) return;
    $('#underNote').textContent = 'live · last ' + tr.length;
    box.innerHTML = tr.length ? tr.map(x => { const buy = x.kind === 'buy', d = new Date(x.block_timestamp), amt = buy ? +x.to_token_amount : +x.from_token_amount;
      return `<div class="trd"><span class="${buy ? 'b' : 's'}">${buy ? 'BUY' : 'SELL'}</span><span>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).slice(0, 8)}</span><span>${usd(+x.volume_in_usd)}</span><span>${num(amt)} ${esc(t.symbol)}</span><a href="https://solscan.io/tx/${esc(x.tx_hash)}" target="_blank" rel="noopener">${short(x.tx_from_address || x.tx_hash)}</a></div>`; }).join('') : '<p class="empty">No trades yet.</p>';
  } catch { if (S.tok === t) { box.innerHTML = '<p class="empty">No live trades for this coin right now.</p>'; $('#underNote').textContent = ''; } }
}
// straight perps: long or short anything on Hyperliquid
function bindPerps() {
  S.pxSide = 'long'; S.pxLev = 3;
  $('#pxPerp').onchange = e => { S.px = e.target.value; pxCalc(); };
  $('#pxSize').addEventListener('input', pxCalc);
  $('#pxSide').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.pxSide = b.dataset.s; $$('#pxSide button').forEach(x => x.classList.toggle('on', x === b)); pxCalc(); };
  $('#pxLev').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.pxLev = +b.dataset.l; pxCalc(); };
  $('#pxGo').onclick = pxGo;
}
function fillPx() {
  const sel = $('#pxPerp'), L = api.perps.list; if (!L.length) return;
  if (!S.px || !api.perps.by[S.px]) S.px = 'SOL';
  const maj = ['SOL', 'BTC', 'ETH', 'HYPE'].map(n => api.perps.by[n]).filter(Boolean), memes = L.filter(p => p.meme).sort((a, b) => b.vol - a.vol), rest = L.filter(p => !p.meme && !['SOL', 'BTC', 'ETH', 'HYPE'].includes(p.name)).sort((a, b) => b.vol - a.vol);
  const o = p => `<option value="${esc(p.name)}" ${p.name === S.px ? 'selected' : ''}>${esc(p.name)}</option>`;
  sel.innerHTML = `<optgroup label="Majors">${maj.map(o).join('')}</optgroup><optgroup label="Memes">${memes.map(o).join('')}</optgroup><optgroup label="Everything else">${rest.map(o).join('')}</optgroup>`;
}
function pxCalc() {
  const p = api.perps.by[S.px || 'SOL']; if (!p) return;
  const levs = [1, 2, 3, 5, 10, 20].filter(x => x <= p.maxLev); if (!levs.includes(S.pxLev)) S.pxLev = levs.filter(x => x <= S.pxLev).pop() || 1;
  $('#pxLev').innerHTML = levs.map(x => `<button data-l="${x}" type="button" class="${x === S.pxLev ? 'on' : ''}">${x}x</button>`).join('');
  const size = parseNum($('#pxSize').value) || 0, mark = api.mids[p.name] || p.mark, long = S.pxSide === 'long', mm = 1 / (2 * p.maxLev), mv = (1 / S.pxLev - mm) * 100;
  const fDay = size * p.fund * 24 * (long ? -1 : 1);
  $('#pxOut').innerHTML = [['Mark', px(mark)], ['Size', size ? `${num(size / mark, 3)} ${esc(p.name)}` : '—'], ['Margin', size ? usd(size / S.pxLev) : '—'], ['Liquidates on a move of', size ? `≈ ${long ? '-' : '+'}${mv.toFixed(0)}%` : '—'], ['Funding now', `<span class="${fDay >= 0 ? 'up' : 'dn'}">${fDay >= 0 ? 'earn' : 'pay'} ${usd(Math.abs(fDay))}/day</span>`]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  const b = $('#pxGo'); b.className = 'btn btn-block ' + (long ? 'btn-g' : 'btn-r');
  b.textContent = !W.evm.address ? 'Connect for Hyperliquid' : !W.agent() ? 'Approve session key (once)' : `${long ? 'Long' : 'Short'} ${p.name} ${S.pxLev}x`;
}
async function pxGo() {
  if (!W.evm.address) return window.__wallets();
  const b = $('#pxGo'); b.disabled = true;
  try {
    if (!W.agent()) { b.textContent = 'Sign in your wallet…'; await W.approveAgent(); toast('Session key approved.', 'ok'); }
    else {
      const p = api.perps.by[S.px]; const size = parseNum($('#pxSize').value) || 0; if (size < 10) throw new Error('Hyperliquid needs at least $10 per order.');
      b.textContent = 'Sending…';
      const r = await W.marketOrder(p, S.pxSide === 'long', size / (api.mids[p.name] || p.mark), { lev: S.pxLev });
      toast(r && r.totalSz ? `${S.pxSide === 'long' ? 'Long' : 'Short'} ${esc(p.name)} filled: ${r.totalSz} @ ${px(+r.avgPx)}` : 'Order sent.', 'ok', 9000);
      setTimeout(loadHL, 1200);
    }
  } catch (e) { toast(esc(e.message || String(e)), 'err', 9000); }
  b.disabled = false; pxCalc();
}
// one click: short SOL against the whole bag, at the hedge % from the Hedge tab
async function hedgeAll() {
  if (!S.bagTot) return toast(W.sol.address ? 'No bag to hedge yet.' : 'Connect a Solana wallet first, so CHUD can size the hedge.', 'err');
  if (!W.evm.address) return window.__wallets();
  const p = api.perps.by.SOL; if (!p) return;
  const pc = +$('#hgPct').value / 100, notional = S.bagTot * pc;
  if (notional < 10) return toast('That hedge is under Hyperliquid\'s $10 minimum.', 'err');
  const b = $('#hedgeAll'); b.disabled = true; b.textContent = 'Sending…';
  try {
    if (!W.agent()) await W.approveAgent();
    const r = await W.marketOrder(p, false, notional / (api.mids.SOL || p.mark), { lev: S.lev });
    toast(`Short SOL ${usd(notional)} ${r && r.avgPx ? '@ ' + px(+r.avgPx) : ''}: ${Math.round(pc * 100)}% of your bag.`, 'ok', 9000); setTimeout(loadHL, 1200);
  } catch (e) { toast(esc(e.message || String(e)), 'err', 9000); }
  b.disabled = false; b.textContent = 'Hedge the whole bag with SOL';
}
// keys: / search · a ape · h hedge · p perps
function bindKeys() {
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
    if (document.documentElement.classList.contains('intro')) return;
    if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
    else if (e.key === 'a') setTab('ape'); else if (e.key === 'h') setTab('hedge'); else if (e.key === 'p') setTab('perps');
  });
}

// ---------------------------------------------------------------- v3: chud check, watchlist, live order book, beta-sized hedges
function checks(t) {
  const liq = t.liq || 0, top = t.top10;
  return [['Mint authority revoked', t.mintOff === true], ['Freeze authority revoked', t.freezeOff === true], ['Top 10 hold under 30%', ok(top) && top < 30],
    ['Liquidity over $100K', liq >= 1e5], ['Over 1,000 holders', (t.holders || 0) >= 1000], ['Organic score over 50', ok(t.organic) && t.organic >= 50], ['Verified on Jupiter', !!t.verified]];
}
function starBtn() { const b = $('#tokStar'); if (!S.tok) return; const on = store.get('chud:watch', []).includes(S.tok.mint); b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; }
async function listWatch() {
  const w = store.get('chud:watch', []);
  if (!w.length) { $('#trendRows').innerHTML = '<p class="empty mono" style="padding:12px">Star a coin (☆ next to its name) to keep it here.</p>'; return; }
  const list = await api.tokens(w).catch(() => []), by = Object.fromEntries(list.map(t => [t.mint, t]));
  S.trend = [...(S.trend || []), ...list];
  $('#trendRows').innerHTML = w.map(m => by[m]).filter(Boolean).map(t => { const ch = (t.s24h || {}).priceChange; return `<button class="trow ${S.tok && S.tok.mint === t.mint ? 'on' : ''}" data-m="${esc(t.mint)}" type="button">${icon(t.icon, t.symbol)}<div><b>${esc(t.symbol)}</b><span>${usd(t.mcap)}</span></div><em class="${cls(ch)}">${pct(ch, 1)}</em></button>`; }).join('');
}
let bookT = 0;
async function drawBook(coin) {
  clearTimeout(bookT);
  if (S.under !== 'perp' || !$('#book')) return;
  try {
    const b = await api.book(coin), [bids, asks] = b.levels || [[], []];
    const rows = (lv, side) => { const L = lv.slice(0, 9), mx = Math.max(...L.map(x => +x.sz), 1e-9); return L.map(x => `<div class="bk ${side}"><i style="width:${(+x.sz / mx * 100).toFixed(0)}%"></i><span>${px(+x.px)}</span><span>${num(+x.sz, 2)}</span></div>`).join(''); };
    if ($('#book')) $('#book').innerHTML = `<div>${rows(bids, 'b')}</div><div>${rows(asks, 'a')}</div>`;
  } catch {}
  if (document.visibilityState === 'visible') bookT = setTimeout(() => drawBook(coin), 3000);
}
// beta: how hard this coin moves with the perp, from 7 days of hourly candles. A market-neutral hedge is beta x the bag.
const BETA = {};
async function betaRun() {
  const t = S.tok, perp = S.perp || 'SOL', box = $('#hgBeta'); if (!t || !box) return;
  const key = t.mint + ':' + perp; const show = r => {
    if (!r) { box.innerHTML = '<span>Not enough shared price history to size a beta hedge.</span>'; return; }
    const pctN = Math.min(200, Math.max(5, Math.round(r.beta * 100 / 5) * 5));
    box.innerHTML = `<div class="row"><span>β to ${esc(perp)} <b>${r.beta.toFixed(2)}</b> · corr <b>${r.corr.toFixed(2)}</b></span><button type="button" id="useBeta">Use β · ${pctN}%</button></div><span>${r.n} hourly moves. ${r.corr < .35 ? 'Weak link: this hedge covers little of your risk.' : r.corr < .6 ? 'Partial link: it covers market dumps, not coin-only dumps.' : 'Strong link: a beta-sized short cancels most market moves.'}</span>`;
    $('#useBeta').onclick = () => { $('#hgPct').value = pctN; hedgeCalc(); };
  };
  if (BETA[key] !== undefined) return show(BETA[key]);
  box.innerHTML = '<span>Reading how this coin moves with the market…</span>';
  try {
    if (api.MINT_PERP[t.mint] === perp) { BETA[key] = { beta: 1, corr: 1, n: 168 }; return show(BETA[key]); }
    const pool = await api.topPool(t.mint); if (!pool) throw 0;
    const [a, b] = await Promise.all([api.poolCandles(pool.address, '1h', t.mint), api.candles(perp, '1h', 8 * 864e5)]);
    const pm = new Map(b.map(k => [Math.round(k.t / 36e5), k.c]));
    const pairs = []; let prev = null;
    for (const k of a) { const h = Math.round(k.t / 36e5), pc = pm.get(h); if (pc == null) { prev = null; continue; } if (prev) pairs.push([Math.log(k.c / prev[0]), Math.log(pc / prev[1])]); prev = [k.c, pc]; }
    if (pairs.length < 24) { BETA[key] = null; return show(null); }
    const n = pairs.length, mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
    let cxy = 0, vx = 0, vy = 0; for (const [x, y] of pairs) { cxy += (x - mx) * (y - my); vx += (x - mx) ** 2; vy += (y - my) ** 2; }
    const r = { beta: cxy / (vy || 1e-12), corr: cxy / Math.sqrt((vx || 1e-12) * (vy || 1e-12)), n };
    BETA[key] = isFinite(r.beta) ? r : null; if (S.tok === t) show(BETA[key]);
  } catch { if (S.tok === t) box.innerHTML = '<span>Could not read candles for a beta right now.</span>'; }
}
