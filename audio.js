// CHUD · the intro's sound, all synthesized: a low drone, a sour shimmer, a slow music box, footsteps in an empty gallery,
// light switches, a chair creak, a CRT waking up, keys, and the dive. Quiet by default, off with one click.
import { store } from './core.js';

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const on = () => store.get('chud:sound', true) !== false;
  // reverb: exponentially decaying noise, a big empty room
  const rev = ctx.createConvolver(); const len = ctx.sampleRate * 3.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  rev.buffer = ir; const wet = ctx.createGain(); wet.gain.value = .55; rev.connect(wet); wet.connect(master);
  const dry = ctx.createGain(); dry.gain.value = .8; dry.connect(master);
  const send = (node, w = .6) => { node.connect(dry); const g = ctx.createGain(); g.gain.value = w; node.connect(g); g.connect(rev); };
  const noiseBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };
  let started = false, drones = [];
  function start() {
    if (started) return; started = true;
    const t = ctx.currentTime;
    // the drone: two detuned saws under a slowly breathing lowpass
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 6;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = .07; lfoG.gain.value = 70; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    const dg = ctx.createGain(); dg.gain.value = 0; dg.gain.linearRampToValueAtTime(.16, t + 2.5);
    [55, 55.7, 82.4].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = i === 2 ? .25 : .5; o.connect(g); g.connect(lp); o.start(); drones.push(o); });
    lp.connect(dg); send(dg, .35);
    // a sour shimmer: a minor second high up, trembling
    const sh = ctx.createGain(); sh.gain.value = 0; sh.gain.linearRampToValueAtTime(.012, t + 4);
    const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 4.3; tg.gain.value = .008; trem.connect(tg); tg.connect(sh.gain); trem.start();
    [1318.5, 1396.9].forEach(f => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(sh); o.start(); drones.push(o); });
    send(sh, 1.2);
    drones.push(lfo, trem);
    // the music box: a slow, wrong little tune
    const notes = [69, 72, 75, 76, 72, 71, 68, 69, 0, 81, 80, 75, 72, 71, 69];
    notes.forEach((n, i) => { if (n) box(440 * Math.pow(2, (n - 69) / 12), t + 1.4 + i * .82 + (i % 3 === 2 ? .12 : 0), i % 4 === 0 ? .09 : .06); });
  }
  function box(f, at, v) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.01;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + .005); g.gain.exponentialRampToValueAtTime(.0005, at + 1.8);
    const g2 = ctx.createGain(); g2.gain.value = .3; o.connect(g); o2.connect(g2); g2.connect(g); send(g, 1.1);
    o.start(at); o2.start(at); o.stop(at + 2); o2.stop(at + 2);
  }
  function hit({ f = 400, type = 'lowpass', q = 1, dur = .12, v = .2, at = ctx.currentTime, tone = 0, w = .5 }) {
    const s = noise(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(.0005, at + dur);
    s.connect(fl); fl.connect(g); send(g, w); s.start(at, Math.random()); s.stop(at + dur + .05);
    if (tone) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(tone, at); o.frequency.exponentialRampToValueAtTime(tone * .5, at + dur); og.gain.setValueAtTime(v * .8, at); og.gain.exponentialRampToValueAtTime(.0005, at + dur); o.connect(og); send(og, w); o.start(at); o.stop(at + dur + .05); }
  }
  const api = {
    ctx, on,
    async begin() { if (!on()) return; try { await ctx.resume(); } catch {} if (ctx.state !== 'running') return; start(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(.42, ctx.currentTime + .8); },
    get running() { return ctx.state === 'running' && started; },
    step(k = 1) { if (!api.running) return; hit({ f: 260, dur: .16, v: .5 * k, tone: 68, w: .7 }); hit({ f: 2400, type: 'bandpass', q: 2, dur: .05, v: .05 * k, w: .6 }); },
    light(i = 0) { if (!api.running) return; const at = ctx.currentTime + i * .0; hit({ f: 3200, type: 'highpass', dur: .03, v: .16, at, w: .9 }); hit({ f: 140, dur: .08, v: .12, at: at + .01, tone: 50, w: .9 }); },
    chair() { if (!api.running) return; const s = noise(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), at = ctx.currentTime; fl.type = 'bandpass'; fl.Q.value = 14; fl.frequency.setValueAtTime(520, at); fl.frequency.linearRampToValueAtTime(1300, at + .7); fl.frequency.linearRampToValueAtTime(800, at + .9); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22, at + .1); g.gain.linearRampToValueAtTime(0, at + .9); s.connect(fl); fl.connect(g); send(g, .5); s.start(at); s.stop(at + 1); },
    sit() { if (!api.running) return; hit({ f: 300, dur: .3, v: .35, tone: 90, w: .5 }); },
    boot() { if (!api.running) return; const at = ctx.currentTime; hit({ f: 120, dur: .25, v: .4, tone: 60, at, w: .4 }); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(180, at); o.frequency.exponentialRampToValueAtTime(760, at + .5); g.gain.setValueAtTime(.0, at); g.gain.linearRampToValueAtTime(.05, at + .05); g.gain.exponentialRampToValueAtTime(.0005, at + .9); o.connect(g); send(g, .6); o.start(at); o.stop(at + 1); hit({ f: 6000, type: 'highpass', dur: .5, v: .04, at, w: .3 }); },
    key() { if (!api.running) return; hit({ f: 2600, type: 'bandpass', q: 3, dur: .035, v: .09 + Math.random() * .04, w: .25 }); },
    ok() { if (!api.running) return; const at = ctx.currentTime; [76, 83].forEach((n, i) => box(440 * Math.pow(2, (n - 69) / 12), at + i * .09, .07)); },
    dive() { if (!api.running) return; const s = noise(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), at = ctx.currentTime; fl.type = 'bandpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(300, at); fl.frequency.exponentialRampToValueAtTime(5200, at + 1.1); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.3, at + .9); g.gain.linearRampToValueAtTime(0, at + 1.25); s.connect(fl); fl.connect(g); send(g, .8); s.start(at); s.stop(at + 1.3); },
    fade(sec = 1.4) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + sec); setTimeout(() => { drones.forEach(o => { try { o.stop(); } catch {} }); drones = []; started = false; }, sec * 1000 + 200); },
    mute() { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.linearRampToValueAtTime(0, t + .3); },
  };
  return api;
}
