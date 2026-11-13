// CHUD · boot: the wordless intro film, the hero chud (turns to you, lenses show SOL live), nav, wallet modal
import { $, $$, on, emit, esc, reduced, store, short, toast, CONFIG, copy, px, pct } from './core.js';
import { smooth, scrollTo, revealAll, rise, gsap, ScrollTrigger } from './motion.js';
import * as api from './api.js';
import * as W from './wallet.js';

const html = document.documentElement;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ---------------------------------------------------------------- the intro: plays once, no words, click to skip
const introDone = new Promise(res => {
  const el = $('#intro'), v = $('#introVid');
  const skip = /[?&]nointro\b/.test(location.search) || reduced();
  let done = false;
  const end = () => { if (done) return; done = true; html.classList.remove('intro'); res(); setTimeout(() => el.remove(), 1200); };
  if (skip || !v) return end();
  el.addEventListener('click', end);
  addEventListener('keydown', end, { once: true });
  v.addEventListener('ended', () => setTimeout(end, 250));
  v.addEventListener('error', end);
  setTimeout(end, 9000);                                       // never hold the page hostage
  const p = v.play(); if (p && p.catch) p.catch(end);
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
on('perps', P => {
  const s = P.by.SOL; if (s) { $('#hsSol').textContent = px(s.mark); const e = $('#hsSolC'); e.textContent = pct(s.chg) + ' 24h'; e.className = s.chg >= 0 ? 'up' : 'dn'; }
  const m = P.list.filter(p => p.meme); $('#hsPerps').textContent = m.length || '—';
  const top = m.slice().sort((a, b) => Math.abs(b.apr) - Math.abs(a.apr))[0];
  if (top) { $('#hsFund').textContent = top.name; const e = $('#hsFundC'); e.textContent = (top.apr >= 0 ? '+' : '') + top.apr.toFixed(0) + '% APR'; e.className = top.apr >= 0 ? 'up' : 'dn'; }
});

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
          : `<p class="m-note">No Solana wallet in this browser. Install <a href="https://phantom.com" target="_blank" rel="noopener">Phantom</a>, Solflare or Backpack, then reload.</p>`}
      </div>
      <div class="m-sec"><span>EVM · for hedging on Hyperliquid</span>
        ${W.evm.address ? `<button class="wbtn on" data-a="evm-off" type="button"><b>${esc(W.evm.name)}</b><em>${short(W.evm.address)} · disconnect</em></button>
            ${ag ? `<button class="wbtn on" data-a="agent-off" type="button"><b>Session key</b><em>${short(ag.address)} · forget</em></button>` : `<button class="wbtn" data-a="agent" type="button"><b>Approve session key</b><em>one signature</em></button>`}`
          : ew.length ? ew.map(d => `<button class="wbtn" data-evm="${esc(d.info.uuid)}" type="button">${d.info.icon ? `<img src="${esc(d.info.icon)}" alt="">` : ''}<b>${esc(d.info.name)}</b><em>connect</em></button>`).join('')
          : `<p class="m-note">No EVM wallet found. Phantom's EVM account, MetaMask or Rabby all work.</p>`}
        <p class="m-note">Hedges trade on your own Hyperliquid account. The session key can place orders, never withdraw, and lives only in this browser. Need USDC there? <a href="https://app.hyperliquid.xyz/trade" target="_blank" rel="noopener">Deposit on Hyperliquid</a>.</p>
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
    const lines = $$('.hero .h1 .ln');
    lines.forEach(l => { l.innerHTML = `<span>${l.innerHTML}</span>`; });
    gsap.from('.chud-stage', { scale: 1.18, opacity: 0, duration: 1.6, ease: 'expo.out' });
    gsap.from(lines.map(l => l.firstChild), { yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: .09, delay: .15 });
    gsap.from(['.kick', '.lede', '.hero .cta', '.hero-stats', '.lens-note'], { y: 26, opacity: 0, duration: 1, ease: 'power3.out', stagger: .08, delay: .35 });
  }
  revealAll();
  setTimeout(() => ScrollTrigger.refresh(), 800);
});
