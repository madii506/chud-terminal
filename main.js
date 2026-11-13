// CHUD · boot: the wordless intro film, the hero chud (turns to you, lenses show SOL live), nav, wallet modal
import { $, $$, on, emit, esc, reduced, store, short, toast, CONFIG, copy, px, pct, usd, icon, brand } from './core.js';
import { smooth, scrollTo, revealAll, rise, gsap, ScrollTrigger } from './motion.js';
import * as api from './api.js';
import * as W from './wallet.js';

const html = document.documentElement;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------------------------------------------------------------- the intro: chud walks a gallery of old pump.fun memes to his PC, logs in
const MEME_MINTS = ['9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump',
  'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY', 'GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump', '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn',
  'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', '3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump', '5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp',
  '6D7NaB2xsLd7cauWu1wKk6KBsJohJmP2qZH9GEfVi5Ui', '8Ki8DpuWNxu9VsS3kQbarsCWMcFGWkzzA8pUPto9zBd5', '25hAyBQfoDhfWx9ay6rarbgvWGwDdNqcHsXS3jQ3mTDJ'];
const soundOn = () => store.get('chud:sound', true) !== false;
html.classList.toggle('muted', !soundOn());
let AUD = null;
const introDone = new Promise(res => {
  const el = $('#intro'), cv = $('#introCv');
  const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  const skip = /[?&]nointro\b/.test(location.search) || reduced() || !webgl;
  let done = false, ctrl = null;
  const end = () => { if (done) return; done = true; html.classList.remove('intro'); if (AUD) AUD.fade(1.6); res(); setTimeout(() => el.remove(), 1300); };
  if (skip || !cv) return end();
  // creepy music, synthesized: it starts if the browser allows sound, otherwise on the first touch
  import('./audio.js?v=1').then(m => { AUD = m.createAudio(); if (AUD && soundOn()) AUD.begin().then(() => { if (!AUD.running) $('#introSnd').classList.add('pulse'); }); }).catch(() => {});
  const sb = $('#introSnd');
  sb.addEventListener('pointerdown', e => e.stopPropagation());
  sb.addEventListener('click', e => { e.stopPropagation(); sb.classList.remove('pulse'); const on = !(soundOn() && AUD && AUD.running); store.set('chud:sound', on); html.classList.toggle('muted', !on); if (AUD) on ? AUD.begin() : AUD.mute(); });
  el.addEventListener('pointerdown', () => {
    if (AUD && soundOn() && !AUD.running) { AUD.begin(); sb.classList.remove('pulse'); return; }   // first touch wakes the sound
    ctrl && ctrl.skip();
  });
  addEventListener('keydown', e => { if (!done && /Escape|Enter| /.test(e.key)) ctrl && ctrl.skip(); });
  const memes = api.tokens(MEME_MINTS).then(l => MEME_MINTS.map(m => l.find(t => t.mint === m)).filter(Boolean).map(t => ({ symbol: t.symbol, icon: t.icon }))).catch(() => []);
  Promise.all([import('./intro3d.js?v=1'), Promise.race([memes, new Promise(r => setTimeout(() => r([]), 2500))])])
    .then(async ([m, list]) => { ctrl = await m.run({ canvas: cv, memes: list, face: '/favicon-192.png?v=1', onDone: end, audio: { step: k => AUD && AUD.step(k), light: i => AUD && AUD.light(i), sit: () => AUD && AUD.sit(), chair: () => AUD && AUD.chair(), boot: () => AUD && AUD.boot(), key: () => AUD && AUD.key(), ok: () => AUD && AUD.ok(), dive: () => AUD && AUD.dive() } }); })
    .catch(end);
  setTimeout(end, 32000);                                     // never hold the page hostage
});

// ---------------------------------------------------------------- hero chud: 15 frames of a turn, two lens states
const hero = (() => {
  const cv = $('#chudCv'), g = cv.getContext('2d');
  const F = { g: [], r: [] }; let state = 'g', cur = 7, want = 7, fade = 1, prev = null, loaded = 0;
  const load = (t, k) => new Promise(r => { const im = new Image(); im.decoding = 'async'; im.onload = () => { loaded++; r(); }; im.onerror = r; im.src = `/hero-${t}_${String(k).padStart(2, '0')}.webp?v=1`; F[t][k] = im; });
  const first = load('g', 7).then(() => draw());
  const rest = () => { for (const t of 'gr') for (let k = 0; k < 15; k++) if (!F[t][k]) load(t, k); };
  function draw() {
    const i = Math.round(cur), a = F[state][i] || F.g[i] || F.g[7];
    g.clearRect(0, 0, 1000, 1000);
    if (prev && fade < 1 && F[prev][i]) { g.globalAlpha = 1 - fade; g.drawImage(F[prev][i], 0, 0, 1000, 1000); }
    if (a && a.complete && a.naturalWidth) { g.globalAlpha = prev ? fade : 1; g.drawImage(a, 0, 0, 1000, 1000); }
    g.globalAlpha = 1;
  }
  let t0 = performance.now(), idle = true, last = 0;
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; idle = false; want = Math.max(0, Math.min(14, (e.clientX / innerWidth) * 14)); last = performance.now(); }, { passive: true });
  function tick(now) {
    if (idle || now - last > 4000) { idle = true; want = 7 + Math.sin((now - t0) / 1600) * 3.2; }
    const nc = cur + (want - cur) * .08;
    if (Math.round(nc) !== Math.round(cur) || fade < 1) { cur = nc; if (fade < 1) fade = Math.min(1, fade + .04); draw(); } else cur = nc;
    requestAnimationFrame(tick);
  }
  const vis = new IntersectionObserver(es => es.forEach(e => { running = e.isIntersecting; }), { threshold: 0 }); let running = true; vis.observe(cv);
  first.then(() => { rest(); if (!reduced()) requestAnimationFrame(tick); });
  return { set(s) { if (s === state) return; prev = state; state = s; fade = 0; draw(); } };
})();

// ---------------------------------------------------------------- live hero numbers + lenses
async function heroLive() {
  try {
    const c = await api.candles('SOL', '15m', 2 * 3600e3);
    if (c.length >= 5) {
      const now = c[c.length - 1].c, then = c[c.length - 5].c, ch = (now / then - 1) * 100;
      $('#lensVal').textContent = (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + '%';
      $('#lensNote').classList.toggle('dn', ch < 0);
      hero.set(ch < 0 ? 'r' : 'g');
    }
  } catch { $('#lensVal').textContent = 'offline'; }
}
import('./market.js?v=1').then(x => x.init()).catch(e => console.error(e));

// ---------------------------------------------------------------- nav, phone sheet, X, CA
addEventListener('scroll', () => $('#nav').classList.toggle('solid', scrollY > 30), { passive: true });
const mb = $('#menuBtn'), ms = $('#mSheet');
mb.addEventListener('click', () => { ms.hidden = !ms.hidden; mb.setAttribute('aria-expanded', String(!ms.hidden)); });
ms.addEventListener('click', e => { if (e.target.closest('a')) ms.hidden = true; });
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const id = a.getAttribute('href'); if (id.length < 2 || !$(id)) return;
  e.preventDefault(); scrollTo(id === '#top' ? 0 : id, { offset: id === '#terminal' ? -70 : -10 });
});
if (CONFIG.x) { const x = $('#navX'); x.hidden = false; x.href = /^https?:/.test(CONFIG.x) ? CONFIG.x : 'https://x.com/' + CONFIG.x.replace(/^@/, ''); }
if (CONFIG.ca) {
  $('#caBox').hidden = false; $('#caTxt').textContent = CONFIG.ca;
  $('#caCopy').onclick = () => copy(CONFIG.ca);
  $('#caBuy').href = 'https://pump.fun/coin/' + CONFIG.ca; $('#caChart').href = 'https://dexscreener.com/solana/' + CONFIG.ca;
}

// ---------------------------------------------------------------- wallet modal (both sides in one place)
export function openWallets(focus) {
  const m = $('#modal'), b = $('#mBody');
  const draw = () => {
    const sw = W.sol.list, ew = W.evm.list.length ? W.evm.list : (W.legacyEvm() ? [{ info: { uuid: 'legacy', name: 'Browser wallet', icon: '' } }] : []);
    const ag = W.agent();
    b.innerHTML = `
      <div class="m-sec"><span>Solana · for aping memes</span>
        ${W.sol.address ? `<button class="wbtn on" data-a="sol-off" type="button"><b>${esc(W.sol.w.name)}</b><em>${short(W.sol.address)} · disconnect</em></button>`
          : sw.length ? sw.map(w => `<button class="wbtn" data-sol="${esc(w.name)}" type="button">${w.icon ? `<img src="${esc(w.icon)}" alt="">` : ''}<b>${esc(w.name)}</b><em>connect</em></button>`).join('')
          : ['phantom.com|Phantom|https://phantom.com/download', 'solflare.com|Solflare|https://solflare.com/download', 'backpack.app|Backpack|https://backpack.app/download'].map(s => { const [d, n, u] = s.split('|'); return `<a class="wbtn" href="${u}" target="_blank" rel="noopener"><img src="${brand(d)}" alt=""><b>${n}</b><em>install ↗</em></a>`; }).join('')}
      </div>
      <div class="m-sec"><span>EVM · for hedging on Hyperliquid</span>
        ${W.evm.address ? `<button class="wbtn on" data-a="evm-off" type="button"><b>${esc(W.evm.name)}</b><em>${short(W.evm.address)} · disconnect</em></button>
            ${ag ? `<button class="wbtn on" data-a="agent-off" type="button"><b>Session key</b><em>${short(ag.address)} · forget</em></button>` : `<button class="wbtn" data-a="agent" type="button"><b>Approve session key</b><em>one signature</em></button>`}`
          : ew.length ? ew.map(d => `<button class="wbtn" data-evm="${esc(d.info.uuid)}" type="button">${d.info.icon ? `<img src="${esc(d.info.icon)}" alt="">` : ''}<b>${esc(d.info.name)}</b><em>connect</em></button>`).join('')
          : ['metamask.io|MetaMask|https://metamask.io/download', 'rabby.io|Rabby|https://rabby.io', 'phantom.com|Phantom|https://phantom.com/download'].map(s => { const [d, n, u] = s.split('|'); return `<a class="wbtn" href="${u}" target="_blank" rel="noopener"><img src="${brand(d)}" alt=""><b>${n}</b><em>install ↗</em></a>`; }).join('')}
        <a class="wbtn" href="https://app.hyperliquid.xyz/trade" target="_blank" rel="noopener"><img src="${brand('hyperliquid.xyz')}" alt=""><b>Deposit USDC on Hyperliquid</b><em>↗</em></a>
      </div>`;
  };
  draw(); m.hidden = false;
  b.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.sol) { t.querySelector('em').textContent = 'check your wallet'; await W.connectSol(t.dataset.sol); toast('Solana wallet connected', 'ok', 3000); }
      else if (t.dataset.evm) { t.querySelector('em').textContent = 'check your wallet'; await W.connectEvm(t.dataset.evm); toast('EVM wallet connected', 'ok', 3000); }
      else if (t.dataset.a === 'sol-off') await W.disconnectSol();
      else if (t.dataset.a === 'evm-off') W.disconnectEvm();
      else if (t.dataset.a === 'agent') { t.querySelector('em').textContent = 'sign in your wallet'; await W.approveAgent(); toast('Session key approved. Hedges now sign without popups.', 'ok'); }
      else if (t.dataset.a === 'agent-off') W.forgetAgent();
    } catch (err) { toast(esc(err.message || String(err)), 'err'); }
    draw();
  };
}
$('#mClose').onclick = () => { $('#modal').hidden = true; };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.currentTarget.hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });
$('#connectBtn').onclick = () => openWallets();
window.__wallets = openWallets;
const navW = () => {
  const n = (W.sol.address ? 1 : 0) + (W.evm.address ? 1 : 0), b = $('#connectBtn');
  b.classList.toggle('on', n > 0); b.querySelector('span').textContent = n === 0 ? 'Connect' : n === 2 ? 'Both connected' : W.sol.address ? short(W.sol.address) : short(W.evm.address);
};
on('sol', navW); on('evm', navW);
// quiet reconnect of wallets this browser used before (no popup unless the wallet allows it silently)
setTimeout(async () => {
  const s = store.get('chud:sol'); if (s) { const w = W.sol.list.find(x => x.name === s); if (w && w.accounts && w.accounts.length) W.connectSol(s).catch(() => {}); }
  const e = store.get('chud:evm'); if (e) { const d = W.evm.list.find(x => x.info.uuid === e); const p = d ? d.provider : W.legacyEvm(); if (p) p.request({ method: 'eth_accounts' }).then(a => { if (a && a[0]) W.connectEvm(d ? e : 'legacy').catch(() => {}); }).catch(() => {}); }
}, 900);

// ---------------------------------------------------------------- nav tools: live SOL, palette, watchlist, positions, replay, sound
const goTerm = () => scrollTo(0);
const tools = {
  palette: () => openPalette(),
  watch: () => { goTerm(); setTimeout(() => { const b = $('#listTab button[data-l=watch]'); b && b.click(); }, 300); },
  pos: () => scrollTo('.desk', { offset: -90 }),
  replay: () => { location.href = location.pathname; },
  sound: () => { const on = !soundOn(); store.set('chud:sound', on); html.classList.toggle('muted', !on); toast(on ? 'Sound on. You will hear it on the next intro.' : 'Sound off.', '', 2500); },
};
$('#navK').onclick = tools.palette; $('#navWatch').onclick = tools.watch; $('#navPos').onclick = tools.pos; $('#navReplay').onclick = tools.replay; $('#navSound').onclick = tools.sound;
$('#navSol').onclick = () => { goTerm(); setTimeout(() => window.__chudHedgePerp && window.__chudHedgePerp('SOL'), 300); };
$('#mSheet').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b) return; ms.hidden = true; tools[b.dataset.act](); });
on('perps', P => { const s = P.by.SOL; if (!s) return; const b = $('#navSol'); b.querySelector('b').textContent = px(api.mids.SOL || s.mark); b.classList.toggle('dn', s.chg < 0); });
on('mids', m => { if (m.SOL) $('#navSol b').textContent = px(m.SOL); });
// the palette: every action, plus a live coin search
const ACTIONS = [
  ['Ape', 'A', 'buy or sell the coin on screen', () => { goTerm(); $('#sideTabs button[data-t=ape]').click(); }],
  ['Hedge', 'H', 'short its perp or SOL', () => { goTerm(); $('#sideTabs button[data-t=hedge]').click(); }],
  ['Perps', 'P', 'long or short anything on Hyperliquid', () => { goTerm(); $('#sideTabs button[data-t=perps]').click(); }],
  ['Hedge the whole bag', '⇣', 'short SOL against everything you hold', () => { goTerm(); setTimeout(() => $('#hedgeAll').click(), 400); }],
  ['Watchlist', '★', 'coins you starred', tools.watch],
  ['Your bag and positions', '◧', 'the desk under the terminal', tools.pos],
  ['Connect wallets', '⇄', 'Solana and Hyperliquid', () => openWallets()],
  ['Meme perps board', '≡', 'funding, open interest, volume', () => scrollTo('#perps', { offset: -10 })],
  ['Trending memes', '↗', 'what the trenches are aping', () => scrollTo('#memes', { offset: -10 })],
  ['How a hedge works', '◑', 'real prices, last 7 days', () => scrollTo('#hedge', { offset: -10 })],
  ['Hedge math', '∑', 'size it before you click', () => scrollTo('#math', { offset: -10 })],
  ['Make your chud', '☺', 'render one and save the PNG', () => scrollTo('#maker', { offset: -10 })],
  ['Replay the intro', '▶', 'walk the gallery again', tools.replay],
  ['Sound on or off', '♪', 'for the intro', tools.sound],
  ['FAQ', '?', 'questions chuds ask', () => scrollTo('#faq', { offset: -10 })],
];
let palSel = 0, palItems = [], palSeq = 0;
function openPalette() {
  const p = $('#pal'), q = $('#palQ'); p.hidden = false; q.value = ''; drawPal([]); setTimeout(() => q.focus(), 20);
  if (window.__lenis) window.__lenis.stop();
}
function closePalette() { $('#pal').hidden = true; if (window.__lenis) window.__lenis.start(); }
function drawPal(coins) {
  const v = $('#palQ').value.trim().toLowerCase();
  const acts = ACTIONS.filter(a => !v || (a[0] + ' ' + a[2]).toLowerCase().includes(v));
  palItems = [...coins.map(t => ({ coin: t })), ...acts.map(a => ({ act: a }))]; palSel = 0;
  $('#palList').innerHTML = (coins.length ? '<p class="ph">Coins</p>' + coins.map((t, i) => `<button type="button" data-i="${i}">${icon(t.icon, t.symbol)}<b>${esc(t.symbol)} <span class="muted" style="font-weight:400">${esc(t.name)}</span></b><em>${usd(t.mcap)}</em></button>`).join('') : '')
    + (acts.length ? '<p class="ph">Actions</p>' + acts.map((a, i) => `<button type="button" data-i="${coins.length + i}"><span class="k">${a[1]}</span><b>${esc(a[0])}</b><em>${esc(a[2])}</em></button>`).join('') : '')
    || '<p class="ph">Nothing matches. Paste a mint to look it up.</p>';
  hlPal();
}
function hlPal() { $$('#palList button').forEach(b => b.classList.toggle('hl', +b.dataset.i === palSel)); }
function runPal(i) { const it = palItems[i]; if (!it) return; closePalette(); if (it.coin) { goTerm(); window.__chudPick && window.__chudPick(it.coin.mint, 'ape'); } else it.act[3](); }
$('#palQ').addEventListener('input', () => {
  drawPal([]); const v = $('#palQ').value.trim(); if (v.length < 2) return;
  const my = ++palSeq; setTimeout(async () => { if (my !== palSeq) return; try { const r = (await api.search(v)).slice(0, 6); if (my === palSeq) drawPal(r); } catch {} }, 250);
});
$('#palQ').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); hlPal(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); hlPal(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPal(palSel); }
  else if (e.key === 'Escape') closePalette();
});
$('#palList').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) runPal(+b.dataset.i); });
$('#pal').addEventListener('click', e => { if (e.target.id === 'pal') closePalette(); });
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#pal').hidden ? openPalette() : closePalette(); } });

// ---------------------------------------------------------------- boot
smooth();
if (html.classList.contains('intro') && window.__lenis) window.__lenis.stop();
api.loadPerps().catch(() => {}); setInterval(() => api.loadPerps().catch(() => {}), 30000);
api.liveMids();
heroLive(); setInterval(heroLive, 60000);
import('./terminal.js?v=1').then(m => m.init()).catch(e => console.error(e));
import('./sections.js?v=1').then(m => m.init()).catch(e => console.error(e));
import('./maker.js?v=1').then(m => m.init()).catch(e => console.error(e));

introDone.then(() => {
  if (window.__lenis) window.__lenis.start();
  window.scrollTo(0, 0);
  if (!reduced()) {
    gsap.from('#term', { y: 30, opacity: 0, scale: .985, duration: 1.1, ease: 'expo.out' });
    gsap.from('#tickers', { y: -12, opacity: 0, duration: .8, ease: 'power3.out', delay: .1 });
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top 72%', once: true } });
    tl.from('.chud-stage', { scale: 1.12, opacity: 0, duration: 1.5, ease: 'expo.out' })
      .from('#mstats > div', { y: 24, opacity: 0, duration: .8, ease: 'power3.out', stagger: .07 }, .15)
      .from('.lens-note', { y: 16, opacity: 0, duration: .8, ease: 'power3.out' }, .4);
  }
  revealAll();
  setTimeout(() => ScrollTrigger.refresh(), 800);
});
