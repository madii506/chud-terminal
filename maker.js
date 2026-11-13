// CHUD · the chud maker: the same raymarched clay as our renders, drawn by your GPU, one frame at a time
import { $, $$, esc } from './core.js';
const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform vec3 uCam, uTgt; uniform float uFov;
uniform vec3 uKey, uKeyC, uRimD, uRimC, uFillD, uFillC, uAlb, uBeanie, uLensC, uLensD, uBg0, uBg1, uHood, uCord;
uniform float uAlpha, uSoft, uExp, uSpotX, uSpotY, uSpotR, uTrend, uYaw, uPom, uSmile, uLensOn, uDraw, uSplit, uHeadOnly;

float sdEll(vec3 p, vec3 r){ float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
float sdTorusZ(vec3 p, float R, float r){ vec2 q = vec2(length(p.xy) - R, p.z); return length(q) - r; }
float sdCylZ(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }

// materials: 0 hoodie, 1 skin, 2 drawstring, 3 beanie, 4 lens, 5 frame, 6 mouth
vec3 gLP;
const vec3 LL = vec3(-.152, 1.50, .392), LR = vec3(.152, 1.50, .392); const float LRAD = .128;
vec2 fig(vec3 p){
  gLP = p;
  vec3 q = vec3(abs(p.x), p.yz);
  // the hoodie: chest, torso, shoulders, arms; the hood is down, bunched behind the neck
  float chest = sdEll(p - vec3(0., .55, .0), vec3(.56, .52, .37));
  float torso = sdEll(p - vec3(0., -.50, -.03), vec3(.60, 1.50, .37));
  float sh = sdEll(q - vec3(.50, .70, -.05), vec3(.34, .27, .33));
  float arm = sdCap(q, vec3(.63, .66, -.05), vec3(.76, -1.7, .02), .205);
  float body = smin(chest, torso, .3); body = smin(body, sh, .22); body = smin(body, arm, .06);
  body = smin(body, sdEll(p - vec3(0., 1.00, -.06), vec3(.36, .16, .30)), .12);          // collar
  body = smin(body, sdEll(p - vec3(0., 1.10, -.30), vec3(.44, .24, .22)), .16);          // the hood, down
  if (uHeadOnly > .5) body = 1e3;
  float neck = sdCap(p, vec3(0., .98, .0), vec3(0., 1.22, .0), .15);
  // the head: skull, jaw, ears, nose
  float head = sdEll(p - vec3(0., 1.52, .02), vec3(.34, .40, .35));
  head = smin(head, sdEll(p - vec3(0., 1.36, .07), vec3(.27, .22, .26)), .1);
  head = smin(head, sdEll(q - vec3(.335, 1.50, .0), vec3(.05, .09, .06)), .04);
  head = smin(head, sdEll(p - vec3(0., 1.45, .35), vec3(.042, .06, .045)), .03);
  float skin = smin(head, neck, .08);
  float d = smin(body, skin, .05);
  // the mouth: a line pressed in; uSmile lifts (or drops) its corners
  float mouth = min(sdCap(p, vec3(-.046, 1.312 + uSmile, .334), vec3(0., 1.31, .339), .0075), sdCap(p, vec3(0., 1.31, .339), vec3(.046, 1.312 + uSmile, .334), .0075));
  d = smax(d, -mouth, .01);
  float m = skin < body ? 1. : 0.;
  if (mouth < .012 && p.z > .25) m = 6.;
  // the beanie: a dome, a ribbed fold band, a pom
  vec3 hb = p - vec3(0., 1.62, .0);
  float dome = smax(sdEll(p - vec3(0., 1.74, -.01), vec3(.365, .36, .375)), -(p.y - 1.72), .02);
  float a = atan(p.z, p.x);
  float band = sdCap(vec3(length(p.xz) - .355, p.y, 0.), vec3(0., 1.715, 0.), vec3(0., 1.83, 0.), .045) - .006 * sin(a * 46.);
  float pom = length(p - vec3(0., 2.135, -.02)) - uPom - .006 * sin(p.x * 70.) * sin(p.y * 70.) * sin(p.z * 70.);
  float bean = min(min(dome, band), pom);
  if (bean < d) { d = bean; m = 3.; }
  // the glasses: two round frames, lenses, a bridge, arms back to the ears
  vec3 pl = p - LL, pr = p - LR;
  float fr = min(sdTorusZ(pl, LRAD, .027), sdTorusZ(pr, LRAD, .027));
  fr = min(fr, sdCap(p, vec3(-.03, 1.515, .40), vec3(.03, 1.515, .40), .02));
  fr = min(fr, sdCap(q, vec3(.275, 1.51, .375), vec3(.335, 1.525, .02), .016));
  float lens = min(sdCylZ(pl, LRAD - .004, .008), sdCylZ(pr, LRAD - .004, .008));
  if (fr < d) { d = fr; m = 5.; }
  if (lens < d) { d = lens; m = 4.; }
  // drawstrings
  float st = min(sdCap(q, vec3(.11, 1.0, .33), vec3(.13, .82, .36), .02), sdCap(q, vec3(.13, .82, .36), vec3(.14, .66, .36), .02));
  st = min(st, sdCap(q, vec3(.14, .66, .36), vec3(.142, .60, .36), .029));
  if (st < d && uHeadOnly < .5) { d = st; m = 2.; }
  d = max(d, -(p.y + 1.25));
  if (uHeadOnly > .5) d = max(d, -(p.y - 1.13));
  return vec2(d, m);
}
vec2 map(vec3 p){ vec3 r = p; float c = cos(uYaw), s = sin(uYaw); r.xz = mat2(c, -s, s, c) * r.xz; return fig(r); }
vec3 nrm(vec3 p){ vec2 e = vec2(.0006, -.0006); return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x); }
float shadow(vec3 ro, vec3 rd, float k){ float r = 1., t = .02; for (int i = 0; i < 80; i++) { float h = map(ro + rd * t).x; r = min(r, k * h / t); t += clamp(h, .012, .25); if (r < .002 || t > 8.) break; } return smoothstep(0., 1., clamp(r, 0., 1.)); }
float ao(vec3 p, vec3 n){ float o = 0., s = 1.; for (int i = 1; i <= 6; i++) { float h = .02 + .08 * float(i); o += (h - map(p + n * h).x) * s; s *= .72; } return clamp(1. - 1.6 * o, 0., 1.); }
// a candle chart on a lens: u,v in [-1,1]; trend 1 = up (green), -1 = down
float candles(vec2 uv, float tr){
  float ink = 0.;
  for (int i = 0; i < 5; i++) {
    float fi = float(i), x = -.56 + fi * .28, mid = (-.42 + fi * .21) * tr + (mod(fi, 2.) - .5) * .06;
    float g = clamp(uDraw - fi, 0., 1.); if (g <= 0.) continue;
    float body = step(abs(uv.x - x), .075) * step(abs(uv.y - mid), (.13 + .03 * mod(fi, 3.)) * g);
    float wick = step(abs(uv.x - x), .018) * step(abs(uv.y - mid), .26 * g);
    ink = max(ink, max(body, wick));
  }
  return ink;
}
vec3 bg(vec2 uv){ vec2 c = vec2(uSpotX, uSpotY); float r = length((uv - c) * vec2(uRes.x / uRes.y, 1.)); return mix(uBg1, uBg0, smoothstep(0., uSpotR, r)); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 sp = (2. * gl_FragCoord.xy - uRes) / uRes.y;
  vec3 ww = normalize(uTgt - uCam), uu = normalize(cross(ww, vec3(0, 1, 0))), vv = cross(uu, ww);
  float fl = 1. / tan(radians(uFov) * .5);
  vec3 rd = normalize(sp.x * uu + sp.y * vv + fl * ww), ro = uCam;
  float t = .1; vec2 h = vec2(0.); bool hit = false, lensHit = false; vec3 lensCol = vec3(0.);
  for (int i = 0; i < 280; i++) { h = map(ro + rd * t); if (abs(h.x) < .0003 * t) { hit = true; break; } t += min(h.x, .8); if (t > 14.) break; }
  vec3 back = bg(uv), col = back;
  if (hit) {
    vec3 p = ro + rd * t, n = nrm(p);
    float occ = ao(p, n);
    vec3 L = normalize(uKey);
    float dif = clamp(dot(n, L), 0., 1.), s = dif > .001 ? shadow(p + n * .003, L, uSoft) : 0.;
    float wrap = clamp((dot(n, L) + .45) / 1.45, 0., 1.);
    float fil = clamp(dot(n, normalize(uFillD)), 0., 1.);
    float sky = clamp(.5 + .5 * n.y, 0., 1.);
    float fre = pow(clamp(1. + dot(n, rd), 0., 1.), 2.6);
    float rim = fre * clamp(dot(n, normalize(uRimD)) * .6 + .4, 0., 1.);
    h = map(p); float m = h.y; vec3 lp = gLP;
    vec3 alb = m == 1. || m == 6. ? uAlb : uHood;
    if (m == 2.) alb = uCord;
    if (m == 3.) alb = uBeanie;
    if (m == 5.) alb = vec3(.035, .035, .04);
    if (m == 6.) alb = vec3(.06, .055, .055);
    vec3 lin = uKeyC * dif * s * 1.55 + uKeyC * .22 * wrap * mix(.35, 1., s) + uFillC * fil * .32 * occ + vec3(.62, .64, .7) * sky * .2 * occ + vec3(.30, .28, .26) * clamp(-n.y, 0., 1.) * .08 * occ;
    col = alb * lin * mix(.55, 1., occ);
    vec3 hv = normalize(L - rd); col += uKeyC * pow(clamp(dot(n, hv), 0., 1.), 28.) * dif * s * (m == 5. ? .4 : .06);
    col += uRimC * rim * occ * (m == 5. ? .3 : 1.);
    lensHit = m == 4.;
    if (lensHit) {                                     // a lit screen, with the chart on it and a glassy sheen (display colours, no tone map)
      vec3 c0 = lp.x < 0. ? LL : LR; vec2 lu = (lp.xy - c0.xy) / LRAD;
      bool red = uSplit > .5 && lp.x > 0.;
      float ink = candles(lu, red ? -1. : uTrend);
      vec3 lc = red ? vec3(.95, .27, .30) : uLensC, ld = red ? vec3(.30, .03, .05) : uLensD;
      lensCol = mix(mix(vec3(.018, .02, .022), lc, uLensOn), mix(vec3(.018, .02, .022), ld, uLensOn), ink * step(.02, uLensOn));
      lensCol *= .9 + .1 * smoothstep(1., .1, length(lu));
      lensCol += vec3(1.) * pow(clamp(dot(reflect(rd, n), normalize(vec3(-.4, .8, .5))), 0., 1.), 60.) * .35;
    }
  }
  col = col * uExp;
  col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);
  col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
  if (lensHit) col = clamp(lensCol, 0., 1.);
  float al = uAlpha > .5 ? (hit ? 1. : 0.) : 1.;
  o = vec4(col * al, al);
}`;
const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
const HOOD = { white: [.86, .84, .80], black: [.045, .045, .05], grey: [.32, .32, .34], green: [.06, .34, .16], red: [.50, .05, .06], tan: [.62, .48, .30], navy: [.05, .09, .28], orange: [.80, .28, .05] };
const BEAN = { black: [.05, .05, .056], white: [.80, .78, .74], green: [.06, .30, .15], red: [.45, .05, .06], orange: [.80, .28, .05], yellow: [.80, .58, .06], navy: [.05, .09, .28], grey: [.28, .28, .30] };
const SW = { white: '#e9e6df', black: '#151516', grey: '#5d5d61', green: '#2c7a47', red: '#9c1f25', tan: '#b48f5c', navy: '#22305e', orange: '#d9601c', yellow: '#dcae2c' };
const BG = { black: '#000000', green: '#1fa35a', red: '#c8313d', cream: '#ece6d8', slate: '#2a3242', none: null };
const DEF = { cam: [.3, 1.62, 4.7], tgt: [0, 1.36, 0], fov: 28, key: [-.32, .55, 1.0], keyC: [1.1, 1.04, .97], rimD: [.9, .5, -.5], rimC: [.9, .95, 1.0], fillD: [.8, .25, .7], fillC: [.52, .55, .62],
  alb: [.86, .84, .80], beanie: [.05, .05, .056], lensC: [.22, .88, .48], lensD: [.03, .24, .12], bg0: [0, 0, 0], bg1: [0, 0, 0], soft: 6, alpha: 1, exp: 1, spotX: .5, spotY: .56, spotR: .62,
  trend: 1, yaw: 0, pom: .1, hood: [.86, .84, .80], cord: [.774, .756, .72], smile: 0, lensOn: 1, draw: 5, split: 0, headOnly: 0 };
const ST = { hood: 'white', bean: 'black', lens: 'long', pom: .1, smile: 0, yaw: 0, bg: 'black' };
let gl, prog, U, glc, busy = false, again = false;

function setup() {
  glc = document.createElement('canvas'); glc.width = glc.height = 640;
  gl = glc.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: true, alpha: true });
  if (!gl) throw new Error('no webgl2');
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  U = n => gl.getUniformLocation(prog, n);
}
function params() {
  const p = { ...DEF, hood: HOOD[ST.hood], beanie: BEAN[ST.bean], pom: ST.pom, smile: ST.smile, yaw: ST.yaw };
  if (ST.hood === 'black' || ST.hood === 'navy') p.cord = [.80, .78, .74];
  if (ST.lens === 'short') Object.assign(p, { trend: -1, lensC: [.95, .27, .30], lensD: [.30, .03, .05] });
  if (ST.lens === 'hedged') p.split = 1;
  return p;
}
async function render() {
  if (busy) { again = true; return; }
  busy = true; $('#mkBusy').hidden = false;
  try {
    if (!gl) setup();
    const p = params(), w = 640, h = 640;
    gl.uniform2f(U('uRes'), w, h); gl.uniform3fv(U('uCam'), p.cam); gl.uniform3fv(U('uTgt'), p.tgt); gl.uniform1f(U('uFov'), p.fov);
    for (const [u, k] of [['uKey', 'key'], ['uKeyC', 'keyC'], ['uRimD', 'rimD'], ['uRimC', 'rimC'], ['uFillD', 'fillD'], ['uFillC', 'fillC'], ['uAlb', 'alb'], ['uBeanie', 'beanie'], ['uLensC', 'lensC'], ['uLensD', 'lensD'], ['uBg0', 'bg0'], ['uBg1', 'bg1'], ['uHood', 'hood'], ['uCord', 'cord']]) gl.uniform3fv(U(u), p[k]);
    for (const [u, k] of [['uAlpha', 'alpha'], ['uSoft', 'soft'], ['uExp', 'exp'], ['uSpotX', 'spotX'], ['uSpotY', 'spotY'], ['uSpotR', 'spotR'], ['uTrend', 'trend'], ['uYaw', 'yaw'], ['uPom', 'pom'], ['uSmile', 'smile'], ['uLensOn', 'lensOn'], ['uDraw', 'draw'], ['uSplit', 'split'], ['uHeadOnly', 'headOnly']]) gl.uniform1f(U(u), p[k]);
    gl.viewport(0, 0, w, h); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0);
    const T = 128;
    for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) { gl.scissor(x, y, T, T); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); await new Promise(r => requestAnimationFrame(r)); }
    gl.finish();
    const out = $('#mkCv'), g = out.getContext('2d'); g.clearRect(0, 0, 640, 640);
    if (BG[ST.bg]) { g.fillStyle = BG[ST.bg]; g.fillRect(0, 0, 640, 640); }
    g.drawImage(glc, 0, 0);
  } catch (e) {
    const g = $('#mkCv').getContext('2d'); const im = new Image(); im.onload = () => { g.fillStyle = '#000'; g.fillRect(0, 0, 640, 640); g.drawImage(im, 0, 0, 640, 640); }; im.src = '/hero-g_07.webp?v=1';
    $('#mkSave').disabled = true; $('#mkSave').textContent = 'Needs WebGL2';
  }
  busy = false; $('#mkBusy').hidden = true;
  if (again) { again = false; render(); }
}
function sw(box, map, key, swatch) {
  box.innerHTML = Object.keys(map).map(k => `<button type="button" data-v="${k}" title="${k}" aria-label="${k}" class="${ST[key] === k ? 'on' : ''}" style="background:${swatch(k)}"></button>`).join('');
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; ST[key] = b.dataset.v; $$('button', box).forEach(x => x.classList.toggle('on', x === b)); render(); };
}
function seg(box, key, num) {
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; ST[key] = num ? +b.dataset.v : b.dataset.v; $$('button', box).forEach(x => x.classList.toggle('on', x === b)); render(); };
}
function syncUI() {
  for (const [id, key, num] of [['#mkLens', 'lens'], ['#mkPom', 'pom', 1], ['#mkMouth', 'smile', 1], ['#mkYaw', 'yaw', 1]]) $$(id + ' button').forEach(b => b.classList.toggle('on', (num ? +b.dataset.v : b.dataset.v) === ST[key]));
  for (const [id, key] of [['#mkHood', 'hood'], ['#mkBean', 'bean'], ['#mkBg', 'bg']]) $$(id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === ST[key]));
}
export function init() {
  sw($('#mkHood'), HOOD, 'hood', k => SW[k]); sw($('#mkBean'), BEAN, 'bean', k => SW[k]);
  sw($('#mkBg'), BG, 'bg', k => BG[k] || 'repeating-conic-gradient(#333 0 25%,#111 0 50%) 0 0/10px 10px');
  seg($('#mkLens'), 'lens'); seg($('#mkPom'), 'pom', 1); seg($('#mkMouth'), 'smile', 1); seg($('#mkYaw'), 'yaw', 1);
  $('#mkRand').onclick = () => {
    const r = a => a[Math.floor(Math.random() * a.length)];
    Object.assign(ST, { hood: r(Object.keys(HOOD)), bean: r(Object.keys(BEAN)), lens: r(['long', 'long', 'short', 'hedged']), pom: r([.1, .1, .14, -1]), smile: r([.012, 0, -.011]), yaw: r([-.35, 0, 0, .35]) });
    if (ST.hood === ST.bean && ST.hood !== 'white') ST.bean = 'white';
    syncUI(); render();
  };
  $('#mkSave').onclick = () => { const a = document.createElement('a'); a.download = 'my-chud.png'; a.href = $('#mkCv').toDataURL('image/png'); a.click(); };
  const share = () => { $('#mkShare').href = 'https://x.com/intent/post?text=' + encodeURIComponent(`made my chud. ${ST.lens === 'hedged' ? 'one lens long, one lens short.' : ST.lens === 'short' ? 'lenses red. hedged anyway.' : 'lenses green. never logging off.'}\n\n$CHUD`) + '&url=' + encodeURIComponent(location.origin); };
  share(); $('#mkShare').addEventListener('mouseenter', share);
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); render(); } }, { rootMargin: '400px' });
  io.observe($('#maker'));
}
