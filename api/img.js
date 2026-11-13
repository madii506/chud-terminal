// CHUD · same-origin image proxy for token art: WebGL can draw it (textures need CORS) and lists load from the edge cache.
// Any public https host. IPFS and Arweave links race several gateways at once; if the link is dead, the mint's logo
// is looked up elsewhere (Trust Wallet's asset repo, GeckoTerminal). Private networks are never fetched.
const dns = require('dns').promises;
const net = require('net');

const MAX = 8e6, UA = { 'user-agent': 'Mozilla/5.0 (compatible; chud-img/2)', accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5' };
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const IPFS_GW = ['https://pump.mypinata.cloud/ipfs/', 'https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://w3s.link/ipfs/', 'https://nftstorage.link/ipfs/', 'https://ipfs.filebase.io/ipfs/'];
const AR_GW = ['https://arweave.net/', 'https://ar-io.net/', 'https://permagate.io/', 'https://gateway.irys.xyz/'];

const sniff = b => b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif'
  : b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 ? 'image/webp' : b.slice(4, 12).toString('latin1').includes('ftypavif') ? 'image/avif'
  : /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(b.slice(0, 600).toString('utf8')) ? 'image/svg+xml' : null;

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const s = ip.toLowerCase();
  if (s.startsWith('::ffff:')) return privateIp(s.slice(7));
  return s === '::' || s === '::1' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb');
}
const hostOk = new Map();
async function safe(u) {
  if (u.protocol !== 'https:' || (u.port && u.port !== '443')) return false;
  const h = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(h)) return false;
  if (net.isIP(h)) return !privateIp(h);
  if (hostOk.has(h)) return hostOk.get(h);
  let ok = false;
  try { const a = await dns.lookup(h, { all: true }); ok = a.length > 0 && a.every(x => !privateIp(x.address)); } catch {}
  hostOk.set(h, ok); return ok;
}

// one candidate: follow up to 3 redirects by hand (each hop checked), read it, make sure it really is an image
async function grab(href, signal) {
  let url = new URL(href);
  for (let hop = 0; hop < 4; hop++) {
    if (!(await safe(url))) throw new Error('blocked');
    const r = await fetch(url, { signal, headers: UA, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); continue; }
    if (!r.ok) throw new Error('http ' + r.status);
    if (+r.headers.get('content-length') > MAX) throw new Error('too big');
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX) throw new Error('size');
    const ct = sniff(buf); if (!ct) throw new Error('not an image');
    return { buf, ct };
  }
  throw new Error('redirects');
}
// the first good answer wins, the rest are cancelled
async function first(hrefs, ms) {
  const list = [...new Set(hrefs.filter(Boolean))]; if (!list.length) return null;
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await Promise.any(list.map(h => grab(h, c.signal))); } catch { return null; } finally { clearTimeout(t); c.abort(); }
}
// the same file on other gateways
function mirrors(u) {
  const out = [u.href];
  let m = u.pathname.match(/\/ipfs\/([^/?#]+)(\/[^?#]*)?/);
  let cid = m && m[1], rest = (m && m[2]) || '';
  if (!cid) { const s = u.hostname.match(/^([a-z0-9]{40,})\.ipfs\./i); if (s) { cid = s[1]; rest = u.pathname === '/' ? '' : u.pathname; } }
  if (cid) IPFS_GW.forEach(g => out.push(g + cid + rest + (g.includes('mypinata') ? '?img-width=512&img-dpr=1' : '')));
  const ar = /(^|\.)(arweave\.net|ar-io\.net|ar-io\.dev|permagate\.io|irys\.xyz)$/i.test(u.hostname) && u.pathname.match(/^\/([A-Za-z0-9_-]{43})(\/.*)?$/);
  if (ar) AR_GW.forEach(g => out.push(g + ar[1] + (ar[2] || '')));
  return out;
}
module.exports = async (req, res) => {
  const t0 = Date.now();
  const raw = String(req.query.u || ''), mint = MINT.test(String(req.query.m || '')) ? String(req.query.m) : null;
  let u = null;
  if (raw) { try { u = new URL(raw); } catch { u = null; } }
  if (!u && !mint) { res.statusCode = 400; return res.end(); }
  let got = u && u.protocol === 'https:' ? await first(mirrors(u), 5500) : null;
  if (!got && mint) got = await gecko(mint, Math.max(1500, 9000 - (Date.now() - t0)));
  if (!got) {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');
    return res.end();
  }
  res.setHeader('Content-Type', got.ct);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // an SVG opened on its own must never run anything on this origin
  if (got.ct === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800');
  return res.end(got.buf);
};

// the logo by mint: Trust Wallet's asset repo, then pump.fun's own record (brand-new coins), then GeckoTerminal
async function json(href, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(href, { signal: c.signal, headers: { accept: 'application/json', 'user-agent': UA['user-agent'] } }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
}
async function gecko(mint, ms) {
  const end = Date.now() + ms, left = () => Math.max(700, end - Date.now());
  const tw = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/${mint}/logo.png`;
  const a = await first([tw], Math.min(2000, left())); if (a) return a;
  const look = [];
  if (/pump$/.test(mint)) look.push(json(`https://frontend-api-v3.pump.fun/coins/${mint}`, Math.min(2500, left())).then(j => j && j.image_uri));
  look.push(json(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`, Math.min(2500, left())).then(j => j && j.data && j.data.attributes && j.data.attributes.image_url));
  for (const img of await Promise.all(look)) {
    if (!img || /missing/i.test(img) || !/^https:\/\//.test(img)) continue;
    let u; try { u = new URL(img); } catch { continue; }
    const got = await first(mirrors(u), left()); if (got) return got;
  }
  return null;
}
module.exports._t = { mirrors, privateIp, sniff, safe };
