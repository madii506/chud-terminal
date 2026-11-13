// CHUD · live data straight from the source: Hyperliquid (perps), Jupiter (memes, swaps), GeckoTerminal (candles)
import { emit } from './core.js';

export const HL = 'https://api.hyperliquid.xyz';
export const JUP = 'https://lite-api.jup.ag';
const GT = 'https://api.geckoterminal.com/api/v2';

async function j(url, opt = {}, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: c.signal });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = txt; }
    if (!r.ok) { const e = new Error((d && (d.error || d.message || d.errorMessage)) || ('HTTP ' + r.status)); e.status = r.status; e.body = d; throw e; }
    return d;
  } finally { clearTimeout(t); }
}
export const info = body => j(HL + '/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- the memes Hyperliquid lists as perps
export const MEMES = ['FARTCOIN', 'PUMP', 'WIF', 'kBONK', 'POPCAT', 'kPEPE', 'PENGU', 'TRUMP', 'DOGE', 'kSHIB', 'BRETT', 'MOODENG', 'GOAT', 'PNUT', 'CHILLGUY',
  'MEW', 'BOME', 'SPX', 'kFLOKI', 'TURBO', 'MELANIA', 'AI16Z', 'ZEREBRO', 'GRIFFAIN', 'kNEIRO', 'NEIROETH', 'MEME', 'USELESS', 'VINE', 'TST', 'PURR',
  'YZY', 'FWOG', 'MOG', 'kLUNC', 'BABY', 'ANIME', 'JELLY', 'kDOGS', 'MON', 'HPOS', 'NEIRO', 'PEOPLE', 'BANANA', 'ACT', 'MYRO', 'SLERF', 'WEN', 'TROLL', 'PNUT'];
// Solana mints whose own perp is on Hyperliquid (so the hedge is the same coin, not a proxy)
export const MINT_PERP = {
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'kBONK', 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': 'POPCAT', '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv': 'PENGU',
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN': 'TRUMP', '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': 'FARTCOIN',
  'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn': 'PUMP', 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5': 'MEW',
  'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82': 'BOME', 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump': 'GOAT',
  '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump': 'PNUT', 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump': 'CHILLGUY',
  'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY': 'MOODENG', 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': 'AI16Z',
  '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn': 'ZEREBRO', 'KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP': 'GRIFFAIN',
  'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P': 'MELANIA', 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  'So11111111111111111111111111111111111111112': 'SOL', 'Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk': 'USELESS',
};
export const PERP_MINT = Object.fromEntries(Object.entries(MINT_PERP).map(([m, p]) => [p, m]));
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const FART = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';

// ---------------------------------------------------------------- Hyperliquid perps (one read feeds the whole page)
export const perps = { list: [], by: {}, at: 0 };
export async function loadPerps() {
  const [meta, ctx] = await info({ type: 'metaAndAssetCtxs' });
  const list = meta.universe.map((u, i) => {
    const c = ctx[i] || {}; const mark = +c.markPx, prev = +c.prevDayPx, f = +c.funding;
    return { name: u.name, asset: i, szDec: u.szDecimals, maxLev: u.maxLeverage, delisted: !!u.isDelisted, onlyIso: !!u.onlyIsolated,
      mark, mid: +c.midPx || mark, prev, chg: prev ? (mark / prev - 1) * 100 : null, fund: f, apr: f * 24 * 365 * 100,
      oi: +c.openInterest * mark, vol: +c.dayNtlVlm, meme: MEMES.includes(u.name) };
  }).filter(p => !p.delisted && isFinite(p.mark) && p.mark > 0);
  perps.list = list; perps.by = Object.fromEntries(list.map(p => [p.name, p])); perps.at = Date.now();
  emit('perps', perps);
  return perps;
}
export const candles = (coin, interval, ms) => info({ type: 'candleSnapshot', req: { coin, interval, startTime: Date.now() - ms, endTime: Date.now() } })
  .then(a => a.map(c => ({ t: c.t, o: +c.o, h: +c.h, l: +c.l, c: +c.c, v: +c.v })));
export const account = user => info({ type: 'clearinghouseState', user });
export const spotAccount = user => info({ type: 'spotClearinghouseState', user });
export const agents = user => info({ type: 'extraAgents', user }).catch(() => null);

// live mids over one websocket; reconnects quietly
export const mids = {};
export function liveMids() {
  let ws, tries = 0;
  const open = () => {
    try { ws = new WebSocket('wss://api.hyperliquid.xyz/ws'); } catch { return; }
    ws.onopen = () => { tries = 0; ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } })); };
    ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.channel === 'allMids') { Object.assign(mids, Object.fromEntries(Object.entries(m.data.mids).map(([k, v]) => [k, +v]))); emit('mids', mids); } } catch {} };
    ws.onclose = () => { if (tries++ < 20) setTimeout(open, Math.min(30000, 1500 * tries)); };
  };
  open();
  setInterval(() => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ method: 'ping' })); }, 45000);
}

// ---------------------------------------------------------------- Jupiter: tokens, prices, holdings, swaps
const tokMap = t => t && ({
  mint: t.id, name: t.name, symbol: t.symbol, icon: t.icon, dec: t.decimals, price: t.usdPrice, mcap: t.mcap ?? t.fdv, liq: t.liquidity,
  holders: t.holderCount, verified: !!t.isVerified, organic: t.organicScore, launchpad: t.launchpad, top10: t.audit && t.audit.topHoldersPercentage,
  mintOff: t.audit ? !!t.audit.mintAuthorityDisabled : null, freezeOff: t.audit ? !!t.audit.freezeAuthorityDisabled : null,
  s5m: t.stats5m || {}, s1h: t.stats1h || {}, s6h: t.stats6h || {}, s24h: t.stats24h || {},
});
export const trending = (tf = '1h', limit = 40) => j(`${JUP}/tokens/v2/toptrending/${tf}?limit=${limit}`).then(a => a.map(tokMap));
export const recent = (limit = 40) => j(`${JUP}/tokens/v2/recent?limit=${limit}`).then(a => a.map(tokMap));
export const topOrganic = (tf = '1h', limit = 40) => j(`${JUP}/tokens/v2/toporganicscore/${tf}?limit=${limit}`).then(a => a.map(tokMap));
export const book = coin => info({ type: 'l2Book', coin });
export const fills = user => info({ type: 'userFills', user });
export const poolTrades = pool => j(`${GT}/networks/solana/pools/${pool}/trades`).then(d => (d.data || []).map(x => x.attributes));
export const search = q => j(`${JUP}/tokens/v2/search?query=${encodeURIComponent(q)}`).then(a => a.map(tokMap));
export async function tokens(mints) {
  const out = [];
  for (let i = 0; i < mints.length; i += 90) out.push(...await search(mints.slice(i, i + 90).join(',')).catch(() => []));
  return out;
}
export const holdings = addr => j(`${JUP}/ultra/v1/holdings/${addr}`);
export const order = p => j(`${JUP}/ultra/v1/order?` + new URLSearchParams(p).toString());
export const execute = (signedTransaction, requestId) => j(`${JUP}/ultra/v1/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedTransaction, requestId }) }, 60000);

// ---------------------------------------------------------------- GeckoTerminal candles for any Solana pool
const poolCache = {};
export async function topPool(mint) {
  if (poolCache[mint]) return poolCache[mint];
  const d = await j(`${GT}/networks/solana/tokens/${mint}/pools?page=1`);
  const p = (d.data || [])[0]; if (!p) return null;
  const a = p.attributes || {}, dex = p.relationships && p.relationships.dex && p.relationships.dex.data && p.relationships.dex.data.id;
  return (poolCache[mint] = { address: a.address, name: a.name, dex, base: (p.relationships.base_token.data.id || '').replace('solana_', '') });
}
const TF = { '5m': ['minute', 5, 200], '15m': ['minute', 15, 200], '1h': ['hour', 1, 200], '4h': ['hour', 4, 200], '1d': ['day', 1, 180] };
export async function poolCandles(pool, tf, base) {
  const [k, agg, lim] = TF[tf];
  const d = await j(`${GT}/networks/solana/pools/${pool}/ohlcv/${k}?aggregate=${agg}&limit=${lim}&currency=usd${base ? '&token=' + base : ''}`);
  return (d.data.attributes.ohlcv_list || []).map(r => ({ t: r[0] * 1000, o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })).sort((a, b) => a.t - b.t);
}
