/* ─────────────────────────────────────────
   harm_particles.js
   Depends on: D3 v7 (loaded before this script)
───────────────────────────────────────── */

const HCOL = { toxic:'#e05a3a', persuasion:'#c9941a', addiction:'#3a7fd4' };
const TBG  = {
  toxic:      'rgba(224,90,58,.16)',
  persuasion: 'rgba(201,148,26,.16)',
  addiction:  'rgba(58,127,212,.16)',
};
const CLEAN_COL = '#2e2c2a';

let W, H, CX, CY;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
let cleanDots = [], harmDots = [];
let currentStep = 0;
let jitterAf = null, animAf = null, timers = [];

const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');

/* ── resize ── */
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width  = W * DPR;
  cv.height = H * DPR;
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX = W / 2;
  CY = H / 2;
}

/* ── seeded rng ── */
function srng(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 >>> 0; return s / 4294967296; };
}

/* ── build particles ── */
function buildParticles(messages) {
  const r1 = srng(42);
  const TOTAL  = Math.max(messages.length, 36288);
  const PACK_R = Math.min(W, H) * 0.38;
  const DR     = PACK_R < 160 ? 2.2 : 2.8;
  const GAP    = DR * 2 + 0.7;

  const pos = [];
  let tries = 0;
  while (pos.length < TOTAL && tries < TOTAL * 18) {
    tries++;
    const a = r1() * Math.PI * 2;
    const d = Math.sqrt(r1()) * PACK_R * 0.97;
    const x = CX + Math.cos(a) * d;
    const y = CY + Math.sin(a) * d;
    let ok = true;
    const from = Math.max(0, pos.length - 150);
    for (let i = from; i < pos.length; i++) {
      const dx = x - pos[i].x, dy = y - pos[i].y;
      if (dx*dx + dy*dy < GAP*GAP) { ok = false; break; }
    }
    if (ok) pos.push({ x, y, dist: d, angle: a });
  }

  const typeArr = messages.filter(m => m.type !== 'clean');
  pos.sort((a, b) => b.dist - a.dist);
  const harmPos  = pos.slice(0, typeArr.length);
  const cleanPos = pos.slice(typeArr.length);

  const ORBIT = Math.min(W, H) * 0.15;
  const CT = {
    toxic:      { x: CX,              y: CY },
    persuasion: { x: CX - ORBIT*1.7,  y: CY + ORBIT*1.2 },
    addiction:  { x: CX + ORBIT*1.7,  y: CY + ORBIT*1.2 },
  };

  const r2 = srng(77);
  harmDots = harmPos.map((p, i) => {
    const t   = typeArr[i].type;
    const spr = Math.min(W, H) * (t === 'toxic' ? 0.17 : 0.09);
    const sa  = r2() * Math.PI * 2;
    const sd  = r2() * spr;
    return {
      x: p.x, y: p.y, ox: p.x, oy: p.y,
      tx: CT[t].x + Math.cos(sa) * sd,
      ty: CT[t].y + Math.sin(sa) * sd,
      r: DR, type: t,
      message: typeArr[i].message,
      colorProgress: 0,
    };
  });

  cleanDots = cleanPos.map(p => ({ x: p.x, y: p.y, ox: p.x, oy: p.y, r: DR }));
}

/* ── draw ── */
function draw(cleanAlpha, step) {
  ctx.clearRect(0, 0, W, H);

  if (cleanAlpha > 0.004) {
    ctx.fillStyle = CLEAN_COL;
    for (const d of cleanDots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.globalAlpha = cleanAlpha * 0.48;
      ctx.fill();
    }
  }

  for (const d of harmDots) {
    const cp = d.colorProgress;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * (1 + cp * 0.38), 0, Math.PI * 2);
    ctx.globalAlpha = step >= 2 ? Math.max(0.55, cp) : 0.48;
    ctx.fillStyle   = cp < 0.02 ? CLEAN_COL : HCOL[d.type];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ── jitter ── */
function stopJitter() {
  if (jitterAf) { cancelAnimationFrame(jitterAf); jitterAf = null; }
}
function startJitter() {
  stopJitter();
  let t = 0;
  const all = [...cleanDots, ...harmDots];
  function f() {
    t += 0.007;
    for (const d of all) {
      d.x = d.ox + Math.sin(t * 1.1 + d.ox * 0.009) * 1.2;
      d.y = d.oy + Math.cos(t * 0.85 + d.oy * 0.009) * 1.2;
    }
    draw(1, 1);
    jitterAf = requestAnimationFrame(f);
  }
  jitterAf = requestAnimationFrame(f);
}

/* ── easing ── */
function ease3(t)  { return 1 - Math.pow(1 - t, 3); }
function easeIO(t) { return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
function lerp(a, b, t) { return a + (b - a) * t; }

function clearAll() {
  timers.forEach(clearTimeout);
  timers = [];
  stopJitter();
  if (animAf) { cancelAnimationFrame(animAf); animAf = null; }
}

/* ─────────────────────────────────────────
   STEP RUNNERS
───────────────────────────────────────── */
function runStep1() {
  clearAll();
  for (const d of cleanDots) { d.x = d.ox; d.y = d.oy; }
  for (const d of harmDots)  { d.x = d.ox; d.y = d.oy; d.colorProgress = 0; }
  document.getElementById('legend')?.classList.remove('show');
  
  draw(1, 1);
  startJitter();
}

function runStep2() {
  clearAll();
  for (const d of cleanDots) { d.x = d.ox; d.y = d.oy; }
  for (const d of harmDots)  { d.x = d.ox; d.y = d.oy; d.colorProgress = 0; }
  document.getElementById('legend')?.classList.add('show');
  

  harmDots.sort((a, b) => {
    const da = (a.ox-CX)**2 + (a.oy-CY)**2;
    const db = (b.ox-CX)**2 + (b.oy-CY)**2;
    return da - db;
  });

  let start = null;
  const FADE = 1500, COLOR = 1900;
  function frame(ts) {
    if (!start) start = ts;
    const el = ts - start;
    const pf = ease3(Math.min(el / FADE, 1));
    const pc = Math.min(Math.max(el - 200, 0) / COLOR, 1);
    const ca = 1 - pf;
    for (let i = 0; i < harmDots.length; i++) {
      const thr = (i / harmDots.length) * 0.55;
      const loc = Math.max(0, pc - thr) / (1 - thr + 0.001);
      harmDots[i].colorProgress = Math.min(ease3(loc) * 1.5, 1);
    }
    draw(ca, 2);
    if (pf < 1 || pc < 1) animAf = requestAnimationFrame(frame);
  }
  animAf = requestAnimationFrame(frame);
}

function runStep3() {
  clearAll();
  for (const d of harmDots) d.colorProgress = 1;
  document.getElementById('legend')?.classList.add('show');
  

  let start = null;
  const DUR = 2800;
  function frame(ts) {
    if (!start) start = ts;
    const p  = Math.min((ts - start) / DUR, 1);
    const ep = easeIO(p);
    for (const d of harmDots) {
      d.x = lerp(d.ox, d.tx, ep);
      d.y = lerp(d.oy, d.ty, ep);
    }
    draw(0, 3);
    if (p < 1) animAf = requestAnimationFrame(frame);
    else drawLabels();
  }
  animAf = requestAnimationFrame(frame);
}

function drawLabels() {
  const ORBIT = Math.min(W, H) * 0.15;
  const cats = [
    { t:'toxic',      l:'Toxic/insults',                   c:'1,318', x: CX,              y: CY - ORBIT*1.85 },
    { t:'persuasion', l:'Persuasion',              c:'192',   x: CX - ORBIT*1.85, y: CY + ORBIT*2.0  },
    { t:'addiction',  l:'Downplay risks', c:'171',   x: CX + ORBIT*1.85, y: CY + ORBIT*2.0  },
  ];
  ctx.globalAlpha = 1;
  for (const c of cats) {
    ctx.textAlign = 'center';
    ctx.font = '300 12px "IBM Plex Mono", monospace';
    ctx.fillStyle = HCOL[c.t];
    ctx.fillText(c.l, c.x, c.y);
    ctx.font = '300 12px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(240,236,228,0.28)';
    ctx.fillText(c.c + ' messages', c.x, c.y + 17);
  }
  ctx.textAlign = 'left';
}

/* ─────────────────────────────────────────
   CHAT BUBBLES — spring pop one by one
───────────────────────────────────────── */
function initChatBubbles() {
  const rows = Array.from(document.querySelectorAll('.chat-row'));

  /* use a single observer on the section so we know when it enters */
  const section = document.getElementById('chat-prologue');
  let triggered = false;

  const secObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !triggered) {
        triggered = true;
        rows.forEach((row, i) => {
          setTimeout(() => {
            row.classList.add('show');
          }, i * 220); /* 220ms stagger between each bubble */
        });
      }
    });
  }, { threshold: 0.15 });

  secObs.observe(section);
}

/* ─────────────────────────────────────────
   STEP SCROLL OBSERVER
───────────────────────────────────────── */
function initObserver() {
  const sections = document.querySelectorAll('.step-section');
  const cards    = document.querySelectorAll('.step-card');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const s = parseInt(entry.target.dataset.step);
      cards.forEach(c => c.classList.remove('visible'));
      entry.target.querySelector('.step-card').classList.add('visible');
      if (s !== currentStep) {
        currentStep = s;
        if      (s === 1) runStep1();
        else if (s === 2) runStep2();
        else              runStep3();
      }
    });
  }, { threshold: 0.45 });

  sections.forEach(s => obs.observe(s));
}

/* ── tooltip ── */
window.addEventListener('mousemove', e => {
  const tt = document.getElementById('tooltip');
  if (currentStep < 2) { tt.style.display = 'none'; return; }
  const mx = e.clientX, my = e.clientY;
  let found = null;
  for (const d of harmDots) {
    if (d.colorProgress < 0.4) continue;
    const dx = mx - d.x, dy = my - d.y;
    if (dx*dx + dy*dy < (d.r+7)*(d.r+7)) { found = d; break; }
  }
  if (found) {
    document.getElementById('tt-msg').textContent = found.message;
    const tg = document.getElementById('tt-type');
    tg.textContent      = found.type === 'addiction' ? 'addiction normalization' : found.type;
    tg.style.background = TBG[found.type];
    tg.style.color      = HCOL[found.type];
    let lx = mx + 16, ty = my - 12;
    if (lx + 260 > W) lx = mx - 268;
    if (ty + 90  > H) ty = my - 96;
    tt.style.left    = lx + 'px';
    tt.style.top     = ty + 'px';
    tt.style.display = 'block';
  } else {
    tt.style.display = 'none';
  }
});

/* ── normalise CSV harm_type ── */
function normaliseType(raw) {
  if (!raw || raw.trim() === '') return 'clean';
  const v = raw.trim().toLowerCase();
  if (v === 'toxic')       return 'toxic';
  if (v === 'persuasion')  return 'persuasion';
  if (v === 'addiction normalization' || v === 'addiction_normalization') return 'addiction';
  return 'clean';
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
resize();

fetch('harm_clean.csv')
  .then(r => { if (!r.ok) throw new Error(); return r.text(); })
  .then(text => {
    const rows = d3.csvParse(text);
    const messages = rows
      .filter(r => r.message && r.message.trim())
      .map(r => ({ message: r.message.trim(), type: normaliseType(r.harm_type) }));
    buildParticles(messages);
    initChatBubbles();
    initObserver();
    currentStep = 1;
    runStep1();
  })
  .catch(() => document.getElementById('error-msg').classList.add('show'));

window.addEventListener('resize', () => {
  resize();
  if (harmDots.length) {
    const msgs = harmDots.map(d => ({ message: d.message, type: d.type }));
    buildParticles(msgs);
    if      (currentStep === 1) runStep1();
    else if (currentStep === 2) runStep2();
    else                        runStep3();
  }
});
