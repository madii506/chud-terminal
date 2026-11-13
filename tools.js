// CHUD · nav tools: funding clock, price alerts, settings, keyboard shortcuts, full screen, share
import { $, $$, esc, store, toast, copy, px } from './core.js';
import * as api from './api.js';
import { scrollTo } from './motion.js';

const panel = (title, html, bind) => { $('#mTitle').textContent = title; const b = $('#mBody'); b.innerHTML = html; $('#modal').hidden = false; b.onclick = null; bind && bind(b); };
export const getSet = () => ({ slip: .03, lev: 3, intro: true, compact: false, ...store.get('chud:set', {}) });

export function init() {
  // funding: Hyperliquid settles every hour on the hour
  const fund = () => { const now = new Date(), s = 3600 - (now.getUTCMinutes() * 60 + now.getUTCSeconds()); $('#navFund b').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  fund(); setInterval(fund, 1000);
  $('#navFund').onclick = () => { scrollTo('#perps', { offset: -10 }); };
  $('#navAlerts').onclick = openAlerts;
  $('#navSet').onclick = openSettings;
  $('#navKeys').onclick = openKeys;
  $('#navFull').onclick = full;
  $('#navShare').onclick = share;
  $('#fsX').onclick = full;
  document.addEventListener('fullscreenchange', onFs);
  applySettings();
  alertsBadge(); setInterval(checkAlerts, 10000); setTimeout(checkAlerts, 4000);
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
    if (document.documentElement.classList.contains('intro')) return;
    if (e.key === '?') openKeys(); else if (e.key === 'f') full(); else if (e.key === 'l') openAlerts(); else if (e.key === ',') openSettings();
  });
  window.__tools = { openAlerts, openSettings, openKeys, full, share };
}

// ---------------------------------------------------------------- share + full screen
export async function share() {
  const t = window.__chud && window.__chud.tok();
  const url = location.origin + '/' + (t ? '?t=' + t.mint : '');
  if (navigator.share && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ title: t ? `${t.symbol} on CHUD` : 'CHUD', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copy(url);
}
// full screen is the whole page with everything but the terminal folded away, so panels and toasts still show
export function full() {
  const d = document.documentElement;
  if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
  if (!d.requestFullscreen) return toast('Full screen is not available in this browser.', 'err', 3000);
  d.requestFullscreen().catch(() => toast('Full screen is not available in this browser.', 'err', 3000));
}
function onFs() {
  document.documentElement.classList.toggle('fs', !!document.fullscreenElement);
  scrollTo(0, { immediate: true });
  setTimeout(() => dispatchEvent(new Event('resize')), 120);
}

// ---------------------------------------------------------------- settings
function applySettings() { const s = getSet(); document.documentElement.classList.toggle('compact', !!s.compact); }
export function openSettings() {
  const s = getSet();
  const seg = (k, opts) => `<div class="seg seg-sm set-seg" data-k="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(s[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  panel('Settings', `
    <div class="m-sec"><span>Perp market order slippage</span>${seg('slip', [[.01, '1%'], [.03, '3%'], [.05, '5%'], [.1, '10%']])}</div>
    <div class="m-sec"><span>Default hedge leverage</span>${seg('lev', [[1, '1x'], [2, '2x'], [3, '3x'], [5, '5x'], [10, '10x']])}</div>
    <div class="m-sec"><span>Intro on load</span>${seg('intro', [[true, 'Play'], [false, 'Skip']])}</div>
    <div class="m-sec"><span>Terminal layout</span>${seg('compact', [[false, 'Full'], [true, 'No coin list']])}</div>
    <div class="m-sec"><span>Sound</span>${seg('sound', [[true, 'On'], [false, 'Off']])}</div>
    <button class="wbtn" id="setReset" type="button"><b>Clear CHUD data</b><em>this browser only</em></button>`, b => {
    b.onclick = e => {
      const btn = e.target.closest('.set-seg button');
      if (btn) {
        const k = btn.parentElement.dataset.k, raw = btn.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : +raw;
        if (k === 'sound') { store.set('chud:sound', v); document.documentElement.classList.toggle('muted', !v); }
        else { const cur = getSet(); cur[k] = v; store.set('chud:set', cur); applySettings(); if (k === 'lev' && window.__chud) window.__chud.setLev(v); }
        $$('button', btn.parentElement).forEach(x => x.classList.toggle('on', x === btn));
        return;
      }
      if (e.target.closest('#setReset')) { try { Object.keys(localStorage).filter(k => k.startsWith('chud:')).forEach(k => localStorage.removeItem(k)); } catch {} toast('Cleared. Reloading…', 'ok', 2000); setTimeout(() => location.reload(), 900); }
    };
  });
  $$('.set-seg[data-k=sound] button', $('#mBody')).forEach(x => x.classList.toggle('on', String(store.get('chud:sound', true) !== false) === x.dataset.v));
}

// ---------------------------------------------------------------- keyboard shortcuts
export function openKeys() {
  const K = [['/', 'Search a coin'], ['⌘K', 'Everything: coins and actions'], ['A', 'Ape tab'], ['H', 'Hedge tab'], ['P', 'Perps tab'], ['B / S', 'Buy or sell side'],
    ['W', 'Star the coin on screen'], ['L', 'Price alerts'], ['F', 'Full-screen terminal'], [',', 'Settings'], ['?', 'This list'], ['Esc', 'Close any panel']];
  panel('Keyboard shortcuts', `<div class="keys">${K.map(([k, d]) => `<div><span class="kbd">${esc(k)}</span><b>${esc(d)}</b></div>`).join('')}</div>`);
}

// ---------------------------------------------------------------- price alerts (checked every 10s while the page is open)
const getA = () => store.get('chud:alerts', []);
const setA = a => { store.set('chud:alerts', a); alertsBadge(); };
function alertsBadge() { const n = getA().length, b = $('#alertN'); b.hidden = !n; b.textContent = n; }
export function openAlerts() {
  const t = window.__chud && window.__chud.tok(), perp = window.__chud && window.__chud.perp();
  const row = (id, sym, now, sug) => `<div class="m-sec"><span>${esc(sym)} · now ${px(now)}</span><div class="al-row"><input id="alPx${id}" type="text" inputmode="decimal" autocomplete="off" value="${now ? +(now * sug).toPrecision(5) : ''}"><em class="al-dir mono" id="alDir${id}"></em><button class="btn btn-sm btn-g" id="alAdd${id}" type="button">Add</button></div></div>`;
  const draw = () => {
    const A = getA(), tp = t && t.price, pp = perp && (api.mids[perp] || (api.perps.by[perp] || {}).mark);
    panel('Price alerts', `${t ? row('T', t.symbol, tp, 1.1) : ''}${perp && (!t || perp !== api.MINT_PERP[t.mint]) ? row('P', perp + ' perp', pp, .95) : ''}
      <div class="m-sec"><span>Active · ${A.length}</span>${A.length ? A.map(a => `<div class="al-item"><b>${esc(a.sym)}</b><span>${a.dir === 'above' ? '↑ above' : '↓ below'} ${px(a.px)}</span><button type="button" data-del="${a.id}">Remove</button></div>`).join('') : '<p class="m-note">No alerts yet. They ring here while CHUD is open, with a sound and a browser notification if you allow it.</p>'}</div>`, b => {
      // the direction follows the price you type: over the current price rings on the way up, under it on the way down
      const dir = id => { const i = $('#alPx' + id), o = $('#alDir' + id); if (!i) return; const v = parseFloat(String(i.value).replace(/[^0-9.]/g, '')), now = id === 'T' ? tp : pp; o.textContent = v > 0 && now ? (v >= now ? '↑ above' : '↓ below') : ''; o.className = 'al-dir mono ' + (v >= now ? 'up' : 'dn'); };
      dir('T'); dir('P'); b.oninput = e => dir(e.target.id === 'alPxT' ? 'T' : 'P');
      b.onclick = async e => {
        const del = e.target.closest('[data-del]'); if (del) { setA(getA().filter(a => String(a.id) !== del.dataset.del)); return draw(); }
        const add = e.target.closest('#alAddT, #alAddP'); if (!add) return;
        const isT = add.id === 'alAddT', v = parseFloat(String($(isT ? '#alPxT' : '#alPxP').value).replace(/[^0-9.]/g, '')), now = isT ? tp : pp;
        if (!(v > 0)) return toast('Enter a price.', 'err', 2500);
        if (!(now > 0)) return toast('No live price yet. Try again in a moment.', 'err', 2500);
        const sym = isT ? t.symbol : perp, dirn = v >= now ? 'above' : 'below';
        setA([...getA(), { id: Date.now(), kind: isT ? 'tok' : 'perp', key: isT ? t.mint : perp, sym, dir: dirn, px: v }]);
        try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch {}
        toast(`Alert set: ${esc(sym)} ${dirn} ${px(v)}`, 'ok', 3000); draw();
      };
    });
  };
  draw();
}
async function checkAlerts() {
  const A = getA(); if (!A.length) return;
  const toks = [...new Set(A.filter(a => a.kind === 'tok').map(a => a.key))];
  let tp = {}; if (toks.length) { try { tp = await api.price(toks.slice(0, 50)); } catch {} }
  const left = [];
  for (const a of A) {
    const now = a.kind === 'perp' ? (api.mids[a.key] || (api.perps.by[a.key] || {}).mark) : tp[a.key] && +tp[a.key].usdPrice;
    if (!(now > 0)) { left.push(a); continue; }
    if (a.dir === 'above' ? now >= a.px : now <= a.px) ring(a, now); else left.push(a);
  }
  if (left.length !== A.length) setA(left);
}
function ring(a, now) {
  toast(`<b>${esc(a.sym)}</b> is ${a.dir} ${px(a.px)} · now ${px(now)}`, 'ok', 12000);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(`CHUD · ${a.sym} ${a.dir} ${px(a.px)}`, { body: `Now ${px(now)}`, icon: '/favicon-192.png' }); } catch {}
  if (store.get('chud:sound', true) === false) return;
  try { const c = new (window.AudioContext || window.webkitAudioContext)(); [0, .14].forEach((d, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = i ? 1318.5 : 987.8; g.gain.setValueAtTime(.0001, c.currentTime + d); g.gain.exponentialRampToValueAtTime(.12, c.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + d + .5); o.connect(g); g.connect(c.destination); o.start(c.currentTime + d); o.stop(c.currentTime + d + .55); }); } catch {}
}
