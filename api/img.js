// CHUD · a same-origin image proxy for token art, so WebGL can draw it (textures need CORS) and lists load fast from the edge cache.
const ALLOW = /(^|\.)(ipfs\.io|dweb\.link|nftstorage\.link|w3s\.link|pinata\.cloud|mypinata\.cloud|arweave\.net|ar-io\.net|ar-io\.dev|irys\.xyz|pump\.fun|jup\.ag|githubusercontent\.com|imgur\.com|cloudfront\.net|amazonaws\.com|googleusercontent\.com|googleapis\.com|bonk\.fun|letsbonk\.fun|4everland\.io|filebase\.io|coingecko\.com|dexscreener\.com|raydium\.io|cf-ipfs\.com|jito\.network|moralis\.io|helius-rpc\.com|solana\.com|solscan\.io|fotofolio\.xyz|bags\.fm|believe\.app|heaven\.xyz|meteora\.ag|daos\.fun|vercel\.app|cdn\.dexscreener\.com|ipfs\.nftstorage\.link|quicknode-ipfs\.com|thirdwebcdn\.com|ipfscdn\.io)$/i;
const sniff = b => b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif' : b[0] === 0x52 && b[8] === 0x57 ? 'image/webp' : b[0] === 0x3c ? 'image/svg+xml' : null;
module.exports = async (req, res) => {
  let u;
  try { u = new URL(String(req.query.u || '')); } catch { res.statusCode = 400; return res.end(); }
  if (u.protocol !== 'https:' || !ALLOW.test(u.hostname)) { res.statusCode = 403; return res.end(); }
  const tries = [u.href];
  const m = u.pathname.match(/\/ipfs\/([^/?#]+)(.*)$/);
  if (m) tries.push(`https://dweb.link/ipfs/${m[1]}${m[2]}`, `https://gateway.pinata.cloud/ipfs/${m[1]}${m[2]}`, `https://ipfs.io/ipfs/${m[1]}${m[2]}`);
  for (const href of [...new Set(tries)]) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 6500);
    try {
      const r = await fetch(href, { signal: c.signal, headers: { 'user-agent': 'chud-img/1', accept: 'image/*' }, redirect: 'follow' });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > 8e6) continue;
      let ct = (r.headers.get('content-type') || '').split(';')[0];
      if (!/^image\//.test(ct)) ct = sniff(buf);
      if (!ct || ct === 'image/svg+xml') continue;
      res.setHeader('Content-Type', ct);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800');
      return res.end(buf);
    } catch {} finally { clearTimeout(t); }
  }
  res.statusCode = 502; res.end();
};
