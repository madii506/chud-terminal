// CHUD · wallets. Solana through Wallet Standard (Phantom, Solflare, Backpack...), EVM through EIP-6963 (Phantom, MetaMask, Rabby...).
// Nothing here ever sees a private key of yours: wallets sign, we only pass bytes and typed data to them.
import { emit, store, b64e, b64d } from './core.js';
import * as api from './api.js';
import * as H from './vendor-hl.js?v=1';

// ---------------------------------------------------------------- Solana
export const sol = { list: [], w: null, account: null, address: null };
const reg = (...ws) => {
  for (const w of ws) {
    if (!w || !w.features || !w.features['solana:signTransaction'] || !w.features['standard:connect']) continue;
    if (!(w.chains || []).some(c => String(c).startsWith('solana:'))) continue;
    if (!sol.list.find(x => x.name === w.name)) sol.list.push(w);
  }
  emit('wallets');
  return () => {};
};
const API = Object.freeze({ register: reg });
try {
  window.addEventListener('wallet-standard:register-wallet', e => { try { e.detail(API); } catch {} });
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: API }));
} catch {}

export async function connectSol(name) {
  const w = sol.list.find(x => x.name === name) || sol.list[0];
  if (!w) throw new Error('No Solana wallet found. Install Phantom, Solflare or Backpack.');
  const r = await w.features['standard:connect'].connect();
  const acc = (r && r.accounts && r.accounts[0]) || w.accounts[0];
  if (!acc) throw new Error('The wallet returned no account.');
  sol.w = w; sol.account = acc; sol.address = acc.address;
  store.set('chud:sol', w.name);
  if (w.features['standard:events']) w.features['standard:events'].on('change', ({ accounts }) => { if (accounts && accounts[0] && accounts[0].address !== sol.address) { sol.account = accounts[0]; sol.address = accounts[0].address; emit('sol'); } });
  emit('sol');
  return sol.address;
}
export async function disconnectSol() { try { sol.w && sol.w.features['standard:disconnect'] && await sol.w.features['standard:disconnect'].disconnect(); } catch {} sol.w = sol.account = sol.address = null; store.del('chud:sol'); emit('sol'); }
export async function signSol(txB64) {
  const f = sol.w.features['solana:signTransaction'];
  const chain = (sol.account.chains || []).find(c => c === 'solana:mainnet') || 'solana:mainnet';
  const [res] = await f.signTransaction({ account: sol.account, transaction: b64d(txB64), chain });
  return b64e(res.signedTransaction);
}
// a swap through Jupiter: order (built for this wallet) -> sign -> Jupiter sends it and reports back
export async function swap({ inputMint, outputMint, amount }) {
  const o = await api.order({ inputMint, outputMint, amount: String(amount), taker: sol.address });
  if (!o.transaction) throw new Error(o.errorMessage || o.error || 'No route for this trade right now.');
  const signed = await signSol(o.transaction);
  const r = await api.execute(signed, o.requestId);
  if (r.status !== 'Success') throw Object.assign(new Error(r.error || 'The swap failed onchain.'), { sig: r.signature });
  return { sig: r.signature, inAmt: r.inputAmountResult || o.inAmount, outAmt: r.outputAmountResult || o.outAmount };
}

// ---------------------------------------------------------------- EVM (Hyperliquid)
export const evm = { list: [], p: null, name: null, address: null, chainId: null };
try {
  window.addEventListener('eip6963:announceProvider', e => {
    const d = e.detail; if (!d || !d.provider || !d.info) return;
    if (!evm.list.find(x => x.info.uuid === d.info.uuid)) evm.list.push(d);
    emit('wallets');
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
} catch {}
export const legacyEvm = () => (typeof window.ethereum !== 'undefined' ? window.ethereum : null);
export async function connectEvm(uuid) {
  const d = evm.list.find(x => x.info.uuid === uuid) || evm.list[0];
  const p = d ? d.provider : legacyEvm();
  if (!p) throw new Error('No EVM wallet found. Phantom, MetaMask or Rabby all work.');
  const accs = await p.request({ method: 'eth_requestAccounts' });
  if (!accs || !accs[0]) throw new Error('The wallet returned no account.');
  evm.p = p; evm.name = d ? d.info.name : 'Wallet'; evm.icon = d ? d.info.icon : null; evm.address = accs[0].toLowerCase();
  evm.chainId = await p.request({ method: 'eth_chainId' });
  store.set('chud:evm', d ? d.info.uuid : 'legacy');
  try { p.on && p.on('accountsChanged', a => { evm.address = a && a[0] ? a[0].toLowerCase() : null; emit('evm'); }); p.on && p.on('chainChanged', c => { evm.chainId = c; }); } catch {}
  emit('evm');
  return evm.address;
}
export function disconnectEvm() { evm.p = evm.address = null; store.del('chud:evm'); emit('evm'); }
async function freshChain() { evm.chainId = await evm.p.request({ method: 'eth_chainId' }).catch(() => evm.chainId); return evm.chainId; }
const signTyped = typed => evm.p.request({ method: 'eth_signTypedData_v4', params: [evm.address, JSON.stringify(typed)] });

// ---------------------------------------------------------------- Hyperliquid exchange (agent = a session key in this browser)
let lastNonce = 0;
const nonce = () => { const n = Math.max(Date.now(), lastNonce + 1); lastNonce = n; return n; };
const agentKey = () => 'chud:agent:' + evm.address;
export const agent = () => (evm.address ? store.get(agentKey()) : null);
export function forgetAgent() { if (evm.address) store.del(agentKey()); emit('evm'); }
async function post(action, signature, n) {
  const r = await fetch(api.HL + '/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, nonce: n, signature, vaultAddress: null }) });
  const d = await r.json().catch(() => ({ status: 'err', response: 'HTTP ' + r.status }));
  if (d.status !== 'ok') throw new Error(typeof d.response === 'string' ? d.response : JSON.stringify(d.response));
  return d.response;
}
export async function approveAgent() {
  if (!evm.address) throw new Error('Connect an EVM wallet first.');
  const cid = await freshChain(), k = H.newKey(), n = nonce();
  const { action, typed } = H.approveAgent(k.address, 'chud', n, cid);
  const sig = await signTyped(typed);
  await post(action, H.splitSig(sig), n);
  store.set(agentKey(), { priv: k.priv, address: k.address, at: Date.now() });
  emit('evm');
  return k.address;
}
export async function agentValid() {
  const a = agent(); if (!a) return false;
  const list = await api.agents(evm.address);
  if (!Array.isArray(list)) return true;                       // can't tell: let the exchange decide
  return list.some(x => String(x.address).toLowerCase() === a.address.toLowerCase() && (!x.validUntil || x.validUntil > Date.now()));
}
async function l1(action) {
  const a = agent(); if (!a) throw new Error('Approve the CHUD session key first.');
  const n = nonce();
  try { return await post(action, H.signL1(a.priv, action, n), n); }
  catch (e) { if (/does not exist|not authorized|agent/i.test(e.message)) { forgetAgent(); throw new Error('Your session key expired. Approve it again.'); } throw e; }
}
// a market order = an IOC limit at a 3% worse price, Hyperliquid style
export async function marketOrder(p, isBuy, size, { reduceOnly = false, lev = null, slip = .03 } = {}) {
  if (lev) await l1(H.leverageAction(p.asset, Math.min(lev, p.maxLev), !p.onlyIso));
  const mid = api.mids[p.name] || p.mid || p.mark;
  const price = H.pxRound(mid * (isBuy ? 1 + slip : 1 - slip), p.szDec);
  const sz = H.szRound(size, p.szDec);
  if (!(sz > 0)) throw new Error('That size rounds to zero on this perp.');
  const res = await l1(H.orderAction(p.asset, isBuy, price, sz, reduceOnly));
  const st = res && res.data && res.data.statuses && res.data.statuses[0];
  if (st && st.error) throw new Error(st.error);
  return st && (st.filled || st.resting) || st;
}
export async function moveToPerps(amount) {
  const cid = await freshChain(), n = nonce();
  const { action, typed } = H.usdClassTransfer(String(amount), true, n, cid);
  const sig = await signTyped(typed);
  return post(action, H.splitSig(sig), n);
}

// a resting limit order (good till cancelled) and a cancel, both signed by the session key
export async function limitOrder(p, isBuy, size, price, { reduceOnly = false, lev = null } = {}) {
  if (lev) await l1(H.leverageAction(p.asset, Math.min(lev, p.maxLev), !p.onlyIso));
  const sz = H.szRound(size, p.szDec); if (!(sz > 0)) throw new Error('That size rounds to zero on this perp.');
  const res = await l1(H.orderAction(p.asset, isBuy, H.pxRound(price, p.szDec), sz, reduceOnly, 'Gtc'));
  const st = res && res.data && res.data.statuses && res.data.statuses[0];
  if (st && st.error) throw new Error(st.error);
  return st && (st.resting || st.filled) || st;
}
export async function cancelOrder(p, oid) {
  const res = await l1({ type: 'cancel', cancels: [{ a: p.asset, o: oid }] });
  const st = res && res.data && res.data.statuses && res.data.statuses[0];
  if (st && st.error) throw new Error(st.error);
  return st;
}
