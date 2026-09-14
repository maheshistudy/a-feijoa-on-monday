/* ============================================================
   app.js — storybook engine
   Renders pages from STORY: backgrounds, sprites, tap
   reactions, read-aloud narration with synced highlighting,
   camera, atmosphere, hints, page turns and the ending.
   ============================================================ */

(() => {
  const $ = (sel) => document.querySelector(sel);

  const stage     = $('#stage');
  const world     = $('#world');
  const sprites   = $('#sprites');
  const atmo      = $('#atmosphere');
  const fx        = $('#fx');
  const sceneA    = $('#scene-a');
  const sceneB    = $('#scene-b');
  const caption   = $('#caption');
  const capText   = $('#caption-text');
  const arrowBtn  = $('#arrow-btn');
  const muteBtn   = $('#mute-btn');
  const hand      = $('#hand');
  const splash    = $('#splash');
  const beginBtn  = $('#begin-btn');
  const ending    = $('#ending');
  const againBtn  = $('#again-btn');
  const turner    = $('#turner');

  const params = new URLSearchParams(location.search);
  const SELFTEST = params.has('selftest');
  const FAST = SELFTEST || params.has('fast');

  let pageIndex = -1;
  let activeScene = sceneA;
  let pageToken = 0;               // bumps on every page load; stale timers check it
  let muted = false;

  // per-page progress
  let tasksNeeded = 0, tasksDone = 0;
  let mainDone = false, afterStarted = false, afterDone = false, arrowArmed = false;
  let pending = [];                // elements still waiting for a tap (for hints)
  let idleTimer = null;

  const later = (ms, fn) => {
    const t = pageToken;
    return setTimeout(() => { if (t === pageToken) fn(); }, FAST ? Math.min(ms, 60) : ms);
  };
  const pct = (v) => parseFloat(v);

  /* ================= Preloading ================= */

  const imgCache = {};
  function preload(src) {
    if (!src || imgCache[src]) return;
    const i = new Image(); i.src = src; imgCache[src] = i;
  }
  function preloadPage(p) {
    if (!p) return;
    preload(p.bg);
    (p.objects || []).forEach(o => { preload(o.img); if (o.tap && o.tap.mask) preload(o.tap.mask); });
  }

  /* ================= Scene & atmosphere ================= */

  function showScene(src, crossfade) {
    const next = activeScene === sceneA ? sceneB : sceneA;
    next.src = src;
    const dur = crossfade ? 'opacity 2.6s ease' : 'none';
    next.style.transition = dur;
    activeScene.style.transition = dur;
    if (crossfade) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        next.style.opacity = 1;
        activeScene.style.opacity = 0;
        activeScene = next;
      }));
    } else {
      next.style.opacity = 1;
      activeScene.style.opacity = 0;
      activeScene = next;
    }
  }

  const cloudSvg = (w) => `
    <svg viewBox="0 0 220 90" width="${w}" xmlns="http://www.w3.org/2000/svg">
      <g fill="#ffffff" stroke="#23315f" stroke-width="4" stroke-linejoin="round" opacity="0.9">
        <ellipse cx="60" cy="58" rx="52" ry="26"/>
        <ellipse cx="120" cy="44" rx="46" ry="30"/>
        <ellipse cx="168" cy="60" rx="44" ry="22"/>
      </g>
    </svg>`;

  function buildAtmosphere(a) {
    atmo.innerHTML = '';
    if (!a) return;
    if (a.type === 'night') {
      for (let i = 0; i < 28; i++) {
        const s = document.createElement('div');
        s.className = 'twinkle';
        s.style.left = (Math.random() * 96 + 2) + '%';
        s.style.top  = (Math.random() * 30 + 2) + '%';
        s.style.animationDelay = (Math.random() * 2.6) + 's';
        s.style.animationDuration = (2 + Math.random() * 2.4) + 's';
        atmo.appendChild(s);
      }
      for (let i = 0; i < 7; i++) {
        const f = document.createElement('div');
        f.className = 'firefly';
        f.style.left = (Math.random() * 80 + 8) + '%';
        f.style.top  = (Math.random() * 30 + 55) + '%';
        f.style.animationDelay = (Math.random() * 6) + 's, ' + (Math.random() * 2.1) + 's';
        f.style.animationDuration = (9 + Math.random() * 6) + 's, ' + (1.6 + Math.random() * 1.2) + 's';
        atmo.appendChild(f);
      }
      return;
    }
    if (a.type === 'day' && a.sun) {
      const [cx, cy] = a.sun;
      const ratio = 3508 / 2480;
      const glow = document.createElement('div');
      glow.className = 'sun-glow';
      glow.style.width = '32%'; glow.style.aspectRatio = '1';
      glow.style.left = (cx - 16) + '%'; glow.style.top = (cy - 16 * ratio) + '%';
      atmo.appendChild(glow);
      const rays = document.createElement('div');
      rays.className = 'sun-rays';
      rays.style.width = '50%'; rays.style.aspectRatio = '1';
      rays.style.left = (cx - 25) + '%'; rays.style.top = (cy - 25 * ratio) + '%';
      atmo.appendChild(rays);
    }
    if (a.clouds !== false) {
      const specs = a.type === 'sky'
        ? [[2, '8%', 150, 80], [34, '3%', 190, 105], [66, '14%', 120, 130]]
        : [[4, '6%', 120, 90], [60, '4%', 150, 120]];
      specs.forEach(([left, top, w, dur], i) => {
        const c = document.createElement('div');
        c.className = 'cloud';
        c.style.left = left + '%'; c.style.top = top;
        c.style.animationDuration = dur + 's';
        c.style.animationDelay = (-i * 25) + 's';
        c.style.opacity = a.type === 'sky' ? .95 : .75;
        c.innerHTML = cloudSvg(w);
        atmo.appendChild(c);
      });
    }
  }

  /* ================= Camera ================= */

  function setCamera(cam, instant) {
    if (instant) world.style.transition = 'none';
    world.style.transformOrigin = cam ? cam.origin : '50% 50%';
    world.style.transform = cam ? `scale(${cam.scale})` : 'none';
    if (instant) requestAnimationFrame(() => { world.style.transition = ''; });
  }

  /* ================= Particles ================= */

  function stagePoint(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  }
  function elCenter(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function sparkleBurst(clientX, clientY, color, n = 12) {
    const [x, y] = stagePoint(clientX, clientY);
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      s.style.color = color || '#ffe98a';
      s.style.left = x + 'px'; s.style.top = y + 'px';
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 70;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist - 20 + 'px');
      s.style.width = s.style.height = (7 + Math.random() * 9) + 'px';
      s.style.animationDelay = (Math.random() * 0.08) + 's';
      stage.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
    Sfx.sparkle();
  }

  function crumbBurst(clientX, clientY, color) {
    const [x, y] = stagePoint(clientX, clientY);
    for (let i = 0; i < 10; i++) {
      const c = document.createElement('div');
      c.className = 'crumb';
      c.style.color = color || '#8a5a2b';
      c.style.left = x + 'px'; c.style.top = y + 'px';
      c.style.setProperty('--dx', ((Math.random() - .5) * 120) + 'px');
      c.style.setProperty('--dy', (50 + Math.random() * 90) + 'px');
      c.style.width = c.style.height = (5 + Math.random() * 7) + 'px';
      stage.appendChild(c);
      setTimeout(() => c.remove(), 1000);
    }
  }

  function zzz(clientX, clientY) {
    const [x, y] = stagePoint(clientX, clientY);
    ['z', 'z', 'Z'].forEach((ch, i) => {
      const z = document.createElement('div');
      z.className = 'zzz';
      z.textContent = ch;
      z.style.left = x + 'px'; z.style.top = y + 'px';
      z.style.fontSize = (14 + i * 8) + 'px';
      z.style.setProperty('--dx', (20 + i * 26) + 'px');
      z.style.setProperty('--dy', (-60 - i * 30) + 'px');
      z.style.animationDelay = (i * 0.35) + 's';
      stage.appendChild(z);
      setTimeout(() => z.remove(), 3200);
    });
  }

  /* ============ Narration: read-aloud + synced highlighting ============ */

  let narrTimer = null, fallbackTimer = null, safetyTimer = null;
  let speechUtterance = null;
  let chosenVoice = null;
  let lastNarration = null;
  let wordPending = false;

  const FEMALE = /female|aria|jenny|michelle|molly|hayley|clara|natasha|libby|sonia|maisie|zira|hazel|heera|susan|samantha|karen|moira|fiona|tessa|victoria|allison|ava|kate|serena|catherine|olivia|freya|nicola|emma|joanna|amy|salli|kimberly|kendra|ivy|nicole|raveena|sara|emily/i;
  const MALE = /\bmale|guy|mitchell|william|david|mark|james|ryan|thomas|george|daniel|alex|fred|oliver|liam|noah|connor|brian|christopher|eric|roger|steffan|sean|richard|matthew|joey|russell|brandon/i;

  function scoreVoice(v) {
    const name = v.name || '';
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    let s = 0;
    if (!lang.startsWith('en')) s -= 10;
    if (lang.startsWith('en-nz')) s += 3;
    else if (lang.startsWith('en-au')) s += 2.4;
    else if (lang.startsWith('en-gb')) s += 2;
    else if (lang.startsWith('en-us')) s += 1.2;
    if (/female/i.test(name)) s += 4;
    else if (FEMALE.test(name)) s += 3;
    if (MALE.test(name) && !/female/i.test(name)) s -= 4;
    if (/natural|neural|online|premium|enhanced/i.test(name)) s += 1.5;
    if (/google/i.test(name)) s += 0.5;
    return s;
  }
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    let best = vs[0], bs = -Infinity;
    vs.forEach(v => { const s = scoreVoice(v); if (s > bs) { bs = s; best = v; } });
    return best;
  }
  if ('speechSynthesis' in window) {
    chosenVoice = pickVoice();
    speechSynthesis.onvoiceschanged = () => { chosenVoice = pickVoice(); };
  }

  function stopNarration() {
    clearInterval(narrTimer);   narrTimer = null;
    clearTimeout(fallbackTimer); fallbackTimer = null;
    clearTimeout(safetyTimer);   safetyTimer = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    speechUtterance = null;
    wordPending = false;
  }

  function canSpeak() {
    return ('speechSynthesis' in window) && !muted && !FAST;
  }

  function narrate(text, done) {
    stopNarration();
    lastNarration = { text, done };
    caption.classList.remove('hidden');
    caption.classList.toggle('long', text.length > 120);

    const tokens = text.split(/\s+/);
    capText.innerHTML = tokens.map(w => `<span class="w">${w}</span>`).join(' ');
    const words = [...capText.querySelectorAll('.w')];
    const starts = [];
    let pos = 0;
    tokens.forEach(t => { const idx = text.indexOf(t, pos); starts.push(idx); pos = idx + t.length; });

    const isWordy = (el) => /[\p{L}\p{N}]/u.test(el.textContent);
    const light = (i) => {
      words.forEach(w => w.classList.remove('lit'));
      if (i >= 0 && i < words.length) words[i].classList.add('lit');
    };
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(narrTimer); narrTimer = null;
      clearTimeout(fallbackTimer); clearTimeout(safetyTimer);
      speechUtterance = null;
      words.forEach(w => w.classList.remove('lit'));
      if (done) done();
    };

    // timed highlighting — fallback, and pacer when the voice gives no word events
    const startTimedHighlight = (finishWhenDone) => {
      clearInterval(narrTimer);
      let i = 0;
      narrTimer = setInterval(() => {
        while (i < words.length && !isWordy(words[i])) i++;
        if (i >= words.length) { clearInterval(narrTimer); if (finishWhenDone) finish(); return; }
        light(i); i++;
      }, FAST ? 25 : 330);
    };

    if (!canSpeak()) { startTimedHighlight(true); return; }

    const u = new SpeechSynthesisUtterance(text);
    speechUtterance = u;
    if (!chosenVoice) chosenVoice = pickVoice();
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; }
    u.rate = 0.88;
    u.pitch = 1.08;

    let sawBoundary = false;
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      sawBoundary = true;
      clearInterval(narrTimer);
      let i = starts.findIndex((s, k) => e.charIndex >= s && e.charIndex < s + tokens[k].length + 1);
      if (i === -1) i = starts.filter(s => s <= e.charIndex).length - 1;
      if (i >= 0 && isWordy(words[i])) light(i);
    };
    u.onend = () => { if (speechUtterance === u) finish(); };
    u.onerror = () => { if (speechUtterance === u) startTimedHighlight(true); };

    speechSynthesis.cancel();
    try { speechSynthesis.speak(u); }
    catch (err) { startTimedHighlight(true); return; }

    fallbackTimer = setTimeout(() => {
      if (!sawBoundary && !finished) {
        const speaking = speechSynthesis.speaking || speechSynthesis.pending;
        startTimedHighlight(!speaking);
      }
    }, 1100);
    safetyTimer = setTimeout(finish, tokens.length * 650 + 7000);
  }

  // speak a single word (fruit names, numbers) without touching the caption
  function say(text) {
    if (!canSpeak() || wordPending) return;
    const u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; }
    u.rate = 0.85; u.pitch = 1.12;
    wordPending = true;
    u.onend = u.onerror = () => { wordPending = false; };
    try { speechSynthesis.speak(u); } catch (e) { wordPending = false; }
  }

  caption.addEventListener('pointerdown', () => {
    if (lastNarration) { Sfx.tap(); narrate(lastNarration.text, lastNarration.done); }
  });

  /* ================= Mute ================= */

  function setMuted(m) {
    muted = m;
    Sfx.setMuted(m);
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
  }
  muteBtn.addEventListener('click', () => { Sfx.unlock(); setMuted(!muted); if (!muted) Sfx.tap(); });

  /* ================= Arrow & task bookkeeping ================= */

  function disarmArrow() {
    arrowArmed = false;
    arrowBtn.disabled = true;
    arrowBtn.classList.remove('hidden');
  }
  function armArrow() {
    if (arrowArmed) return;
    arrowArmed = true;
    arrowBtn.disabled = false;
    Sfx.chime();
    const [cx, cy] = elCenter(arrowBtn);
    sparkleBurst(cx, cy, '#fff3b0', 14);
    resetIdleHint();
  }
  function checkArrow() {
    if (mainDone && tasksDone >= tasksNeeded && afterDone) armArrow();
  }
  function maybeAfter(page) {
    if (!mainDone || tasksDone < tasksNeeded || afterStarted) return;
    afterStarted = true;
    (page.after || []).forEach(runAfterEffect);
    if (page.cameraAfter) setCamera(page.cameraAfter, false);
    if (page.afterText) narrate(page.afterText, () => { afterDone = true; checkArrow(); });
    else { afterDone = true; checkArrow(); }
  }
  function taskDone(page, el) {
    tasksDone++;
    if (el) pending = pending.filter(p => p !== el);
    if (el) el.classList.remove('pending');
    maybeAfter(page);
  }

  function runAfterEffect(eff) {
    const sp = document.getElementById('obj-' + eff.target);
    if (!sp) return;
    const anim = sp.querySelector('.anim');
    if (eff.anim === 'queasy') { anim.classList.add('anim-queasy'); }
    else if (eff.anim === 'happy') { playAnim(anim, 'anim-happy'); }
    if (eff.sound && Sfx[eff.sound]) later(200, () => Sfx[eff.sound]());
    if (eff.sparkle) { const [cx, cy] = elCenter(sp); sparkleBurst(cx, cy, eff.sparkle, 16); }
  }

  /* ================= Idle hints ================= */

  function hideHand() { hand.classList.add('hidden'); hand.classList.remove('tapping'); }

  function showHandAt(el) {
    const r = el.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const hx = r.left + r.width * 0.58 - s.left;
    const hy = r.top + r.height * 0.55 - s.top;
    hand.style.left = Math.min(hx, s.width * 0.92) + 'px';
    hand.style.top  = Math.min(hy, s.height * 0.9) + 'px';
    hand.classList.remove('hidden');
    hand.classList.remove('tapping');
    void hand.offsetWidth;
    hand.classList.add('tapping');
    setTimeout(hideHand, 1900);
  }

  function resetIdleHint() {
    clearTimeout(idleTimer);
    hideHand();
    if (FAST) return;
    idleTimer = setTimeout(() => {
      let target = pending[0];
      if (target) {
        const anim = target.closest('.sprite') ? target.closest('.sprite').querySelector('.anim') : target;
        anim.classList.remove('anim-hint'); void anim.offsetWidth; anim.classList.add('anim-hint');
        showHandAt(target);
      } else if (arrowArmed) {
        target = arrowBtn;
        showHandAt(arrowBtn);
      }
      resetIdleHint();
    }, 4500);
  }

  /* ================= Voronoi cells for multi-fruit sprites ================= */

  function clipPoly(poly, a, b, c) {      // keep side where a*x + b*y <= c
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const fp = a * p[0] + b * p[1] - c, fq = a * q[0] + b * q[1] - c;
      if (fp <= 0) out.push(p);
      if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
        const t = fp / (fp - fq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return out;
  }
  function voronoi(points) {
    return points.map((s, i) => {
      let poly = [[0, 0], [100, 0], [100, 100], [0, 100]];
      points.forEach((o, j) => {
        if (i === j) return;
        const a = o[0] - s[0], b = o[1] - s[1];
        const c = (o[0] * o[0] + o[1] * o[1] - s[0] * s[0] - s[1] * s[1]) / 2;
        poly = clipPoly(poly, a, b, c);
      });
      return 'polygon(' + poly.map(p => p[0].toFixed(1) + '% ' + p[1].toFixed(1) + '%').join(', ') + ')';
    });
  }

  /* ================= Sprites ================= */

  function playAnim(el, cls, after) {
    el.classList.remove('anim-wobble-sm', 'anim-wobble-lg', 'anim-shake', 'anim-pop', 'anim-chomp',
                        'anim-crack', 'anim-hatch', 'anim-hint', 'anim-sway', 'anim-happy');
    void el.offsetWidth;
    el.classList.add(cls);
    if (after) el.addEventListener('animationend', after, { once: true });
  }

  function makeSprite(obj) {
    const el = document.createElement('div');
    el.className = 'sprite';
    el.id = 'obj-' + obj.id;
    Object.assign(el.style, obj.rect);
    if (obj.z) el.style.zIndex = obj.z;
    const anim = document.createElement('div'); anim.className = 'anim';
    const body = document.createElement('div'); body.className = 'body';
    if (obj.origin) { anim.style.transformOrigin = obj.origin; body.style.transformOrigin = obj.origin; }
    if (!(obj.tap && obj.tap.type === 'bite')) {
      const img = document.createElement('img');
      img.src = obj.img; img.alt = '';
      body.appendChild(img);
    }
    anim.appendChild(body);
    el.appendChild(anim);
    if (obj.hidden) el.classList.add('is-hidden');
    if (obj.breathe && !obj.hidden) body.classList.add('anim-breathe');
    return el;
  }

  function markPending(el) { el.classList.add('tappable', 'pending'); pending.push(el); }

  /* ---- tap behaviours ---- */

  function setupShake(page, obj, sp) {
    const anim = sp.querySelector('.anim');
    let done = false;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      playAnim(anim, obj.tap.anim || 'anim-shake');
      (Sfx[obj.tap.sound] || Sfx.bounce)();
      sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor || '#fff3b0');
      resetIdleHint();
      if (!done) { done = true; taskDone(page, sp); }
    });
  }

  function setupSay(page, obj, sp) {
    const anim = sp.querySelector('.anim');
    sp.classList.add('tappable');
    sp.addEventListener('pointerdown', (e) => {
      playAnim(anim, 'anim-pop');
      Sfx.pop();
      sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor || '#fff3b0', 8);
      say(obj.tap.text);
      resetIdleHint();
    });
  }

  function setupBite(page, obj, sp) {
    const body = sp.querySelector('.body');
    const cells = obj.tap.cells || [[50, 50]];
    const polys = cells.length > 1 ? voronoi(cells) : [null];
    cells.forEach((c, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.backgroundImage = `url("${obj.img}")`;
      if (polys[i]) cell.style.clipPath = polys[i];
      cell.style.transformOrigin = c[0] + '% ' + c[1] + '%';
      body.appendChild(cell);
      markPending(cell);
      let bitten = false;
      cell.addEventListener('pointerdown', (e) => {
        resetIdleHint();
        if (bitten) return;
        bitten = true;
        cell.classList.remove('anim-chomp'); void cell.offsetWidth; cell.classList.add('anim-chomp');
        later(140, () => {
          cell.classList.add('bitten');
          cell.style.webkitMaskImage = `url("${obj.tap.mask}")`;
          cell.style.maskImage = `url("${obj.tap.mask}")`;
        });
        Sfx.munch();
        sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor || '#fff3b0', 8);
        crumbBurst(e.clientX, e.clientY, obj.tap.crumbColor || '#8a5a2b');
        if (obj.tap.say) say(obj.tap.say);
        taskDone(page, cell);
      });
    });
    sp.classList.add('tappable');
  }

  function setupHatch(page, obj, sp, els) {
    const anim = sp.querySelector('.anim');
    const cracked = els[obj.tap.cracked], hatched = els[obj.tap.hatched];
    let taps = 0;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      if (taps >= 3) return;
      taps++;
      resetIdleHint();
      if (taps < 3) {
        playAnim(anim, taps === 1 ? 'anim-wobble-sm' : 'anim-wobble-lg');
        Sfx.wobble(taps);
        sparkleBurst(e.clientX, e.clientY, '#fff3b0');
        return;
      }
      // --- the big POP ---
      pending = pending.filter(p => p !== sp); sp.classList.remove('pending', 'tappable');
      Sfx.crackPop();
      sparkleBurst(e.clientX, e.clientY, '#ffd94d');
      sparkleBurst(e.clientX + 20, e.clientY - 10, '#ffffff');
      sp.classList.add('is-hidden');
      cracked.el.classList.remove('is-hidden');
      playAnim(cracked.el.querySelector('.anim'), 'anim-shake');
      later(650, () => {
        cracked.el.classList.add('is-hidden');
        hatched.el.classList.remove('is-hidden');
        playAnim(hatched.el.querySelector('.anim'), 'anim-hatch', () => {
          hatched.el.querySelector('.body').classList.add('anim-breathe');
        });
        Sfx.boing();
        const [cx, cy] = elCenter(hatched.el);
        sparkleBurst(cx, cy, '#ffe98a', 16);
      });
      later(1400, () => taskDone(page, sp));
    });
  }

  function setupGrow(page, obj, sp) {
    const anim = sp.querySelector('.anim');
    let done = false;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      resetIdleHint();
      if (done) { playAnim(sp.querySelector('.body'), 'anim-happy'); Sfx.boing(); sparkleBurst(e.clientX, e.clientY, '#ffe98a', 8); return; }
      done = true;
      anim.classList.add('anim-grow');
      Sfx.grow();
      sparkleBurst(e.clientX, e.clientY, '#ffe98a', 16);
      later(900, () => { const [cx, cy] = elCenter(sp); sparkleBurst(cx, cy, '#fff3b0', 12); });
      later(1000, () => taskDone(page, sp));
    });
  }

  function setupSway(page, obj, sp) {
    const anim = sp.querySelector('.anim');
    let done = false;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      resetIdleHint();
      playAnim(anim, 'anim-sway');
      Sfx.hush();
      zzz(e.clientX, e.clientY - 10);
      sparkleBurst(e.clientX, e.clientY, '#e6f7ff', 6);
      if (!done) { done = true; later(1200, () => taskDone(page, sp)); }
    });
  }

  function setupEmerge(page, obj, sp, els) {
    const anim = sp.querySelector('.anim');
    const bf = els[obj.tap.butterfly];
    let taps = 0;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      if (taps >= 3) return;
      taps++;
      resetIdleHint();
      if (taps < 3) {
        playAnim(anim, 'anim-shake');
        Sfx.wobble(taps);
        sparkleBurst(e.clientX, e.clientY, '#e6ffcc');
        return;
      }
      pending = pending.filter(p => p !== sp); sp.classList.remove('pending', 'tappable');
      Sfx.crackPop();
      sparkleBurst(e.clientX, e.clientY, '#ffd94d', 16);
      playAnim(anim, 'anim-crack');
      later(300, () => flyButterfly(page, sp, bf.el, bf.obj));
    });
  }

  function flyButterfly(page, fromEl, bfEl, bfObj) {
    const from = fromEl.getBoundingClientRect();
    const wr = sprites.getBoundingClientRect();
    // start & end centres in % of the world
    const x0 = (from.left + from.width / 2 - wr.left) / wr.width * 100;
    const y0 = (from.top + from.height * 0.35 - wr.top) / wr.height * 100;
    const w = pct(bfObj.rect.width), h = pct(bfObj.rect.height);
    const x1 = pct(bfObj.rect.left) + w / 2, y1 = pct(bfObj.rect.top) + h / 2;
    const anim = bfEl.querySelector('.anim'), body = bfEl.querySelector('.body');
    bfEl.classList.remove('is-hidden');
    body.classList.add('anim-flap');
    const dur = FAST ? 200 : 4200;
    const t0 = performance.now();
    let lastGlitter = 0, landed = false;
    Sfx.flutter(8);
    later(900, () => Sfx.flutter(8));
    later(1800, () => Sfx.flutter(8));
    later(2700, () => Sfx.glitter());
    // safety net: if frames stop (hidden tab, headless), land anyway
    later(dur + 600, () => { if (!landed) step(t0 + dur); });
    const step = (now) => {
      if (landed) return;
      let t = Math.min(1, (now - t0) / dur);
      const e = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;      // ease in-out
      const cx = x0 + (x1 - x0) * e;
      const cy = y0 + (y1 - y0) * e - Math.sin(t * Math.PI) * 16 + Math.sin(t * Math.PI * 5) * 1.6;
      const s = 0.18 + 0.82 * e;
      bfEl.style.left = (cx - w / 2) + '%';
      bfEl.style.top  = (cy - h / 2) + '%';
      anim.style.transform = `scale(${s}) rotate(${Math.sin(t * Math.PI * 4) * 8}deg)`;
      if (now - lastGlitter > 110 && t < 1) {
        lastGlitter = now;
        const [gx, gy] = elCenter(bfEl);
        sparkleBurst(gx + (Math.random() - .5) * 60, gy + (Math.random() - .5) * 40, Math.random() < .5 ? '#fff3b0' : '#ffb347', 3);
      }
      if (t < 1) requestAnimationFrame(step);
      else {
        landed = true;
        anim.style.transform = '';
        body.classList.remove('anim-flap');
        body.classList.add('anim-flap-slow');
        anim.classList.add('anim-hover');
        const [gx, gy] = elCenter(bfEl);
        sparkleBurst(gx, gy, '#fff3b0', 20);
        bfEl.classList.add('tappable');
        bfEl.addEventListener('pointerdown', (ev) => {
          Sfx.flutter(6); Sfx.glitter();
          sparkleBurst(ev.clientX, ev.clientY, '#ffb347', 12);
          body.classList.remove('anim-flap-slow'); void body.offsetWidth; body.classList.add('anim-flap');
          later(1400, () => { body.classList.remove('anim-flap'); body.classList.add('anim-flap-slow'); });
        });
        taskDone(page, null);
      }
    };
    requestAnimationFrame(step);
  }

  function setupWiggle(page, obj, sp) {
    const anim = sp.querySelector('.anim');
    sp.classList.add('tappable');
    sp.addEventListener('pointerdown', (e) => {
      playAnim(anim, obj.tap.anim || 'anim-wobble-sm');
      (Sfx[obj.tap.sound] || Sfx.boing)();
      sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor || '#ffe98a', 8);
      if (obj.tap.say) say(obj.tap.say);
      resetIdleHint();
    });
  }

  /* ================= Page rendering ================= */

  function loadPage(idx) {
    const page = STORY.pages[idx];
    pageIndex = idx;
    pageToken++;
    tasksNeeded = 0; tasksDone = 0;
    mainDone = false; afterStarted = false; afterDone = false;
    pending = [];
    sprites.innerHTML = '';
    fx.innerHTML = '';
    hideHand();
    disarmArrow();
    document.body.classList.remove('on-cover');

    showScene(page.bg, !!page.crossfade);
    buildAtmosphere(page.atmosphere);
    setCamera(page.camera, true);
    preloadPage(STORY.pages[idx + 1]);

    const els = {};
    (page.objects || []).forEach(obj => {
      const el = makeSprite(obj);
      els[obj.id] = { el, obj };
      sprites.appendChild(el);
    });

    (page.objects || []).forEach(obj => {
      const sp = els[obj.id].el;
      const tap = obj.tap;
      if (!tap) return;
      const required = tap.required !== false;
      switch (tap.type) {
        case 'shake':  if (required) tasksNeeded++; setupShake(page, obj, sp); break;
        case 'say':    setupSay(page, obj, sp); break;
        case 'bite':   tasksNeeded += (tap.cells || [[50, 50]]).length; setupBite(page, obj, sp); break;
        case 'hatch':  tasksNeeded++; setupHatch(page, obj, sp, els); break;
        case 'grow':   tasksNeeded++; setupGrow(page, obj, sp); break;
        case 'sway':   tasksNeeded++; setupSway(page, obj, sp); break;
        case 'emerge': tasksNeeded++; setupEmerge(page, obj, sp, els); break;
        case 'wiggle': setupWiggle(page, obj, sp); break;
      }
    });

    (page.hotspots || []).forEach(h => {
      const z = document.createElement('div');
      z.className = 'hotspot';
      Object.assign(z.style, h.rect);
      sprites.appendChild(z);
      z.addEventListener('pointerdown', (e) => {
        if (h.sound && Sfx[h.sound]) Sfx[h.sound]();
        if (h.say) say(h.say);
        sparkleBurst(e.clientX, e.clientY, h.sparkColor || '#fff3b0');
        resetIdleHint();
      });
    });

    later(page.crossfade ? 900 : 350, () => {
      narrate(page.text, () => { mainDone = true; maybeAfter(page); checkArrow(); });
    });
    resetIdleHint();
  }

  /* ================= Navigation ================= */

  let turning = false;
  function turnTo(idx, instant) {
    if (turning) return;
    turning = true;
    stopNarration();
    if (!instant) {
      Sfx.whoosh();
      turner.classList.remove('turning'); void turner.offsetWidth; turner.classList.add('turning');
      world.classList.add('world-out');
    }
    caption.classList.add('hidden');
    setTimeout(() => {
      world.classList.remove('world-out');
      world.classList.add('world-in');
      loadPage(idx);
      setTimeout(() => { world.classList.remove('world-in'); turning = false; }, 700);
    }, instant ? 0 : 430);
  }

  function showEnding() {
    stopNarration();
    caption.classList.add('hidden');
    arrowBtn.classList.add('hidden');
    hideHand();
    ending.classList.remove('hidden');
    Sfx.glitter();
    later(300, () => { const r = ending.getBoundingClientRect(); sparkleBurst(r.left + r.width / 2, r.top + r.height * .4, '#ffb347', 24); });
    later(500, () => { if (canSpeak()) say('The end!'); });
  }

  arrowBtn.addEventListener('click', () => {
    if (arrowBtn.disabled) return;
    Sfx.tap();
    hideHand();
    const next = pageIndex + 1;
    if (next < STORY.pages.length) turnTo(next);
    else showEnding();
  });

  againBtn.addEventListener('click', () => {
    Sfx.tap();
    ending.classList.add('hidden');
    pageIndex = -1;
    sprites.innerHTML = ''; atmo.innerHTML = '';
    document.body.classList.add('on-cover');
    splash.classList.remove('gone');
  });

  /* ================= Cover ================= */

  let starting = false;
  function startStory() {
    if (starting) return;
    starting = true;
    Sfx.unlock();
    Sfx.chirp();
    const [cx, cy] = elCenter(beginBtn);
    sparkleBurst(cx, cy, '#fff3b0', 18);
    if (canSpeak()) say(STORY.title);
    later(FAST ? 50 : 1300, () => {
      splash.classList.add('gone');
      setTimeout(() => { turnTo(0); starting = false; }, 300);
    });
  }
  beginBtn.addEventListener('pointerdown', () => Sfx.unlock());
  beginBtn.addEventListener('click', startStory);

  window.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });

  // preload the first pages while the cover is up
  preloadPage(STORY.pages[0]); preloadPage(STORY.pages[1]);

  /* ================= Service worker ================= */
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !SELFTEST) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  /* ================= Dev helpers: ?page=N, ?selftest ================= */

  if (params.has('page')) {
    const n = Math.max(0, Math.min(STORY.pages.length - 1, parseInt(params.get('page'), 10) || 0));
    splash.classList.add('gone');
    turnTo(n, true);
  }

  if (SELFTEST) {
    const report = $('#test-report');
    report.classList.remove('hidden');
    const lines = [];
    const log = (s) => { lines.push(s); report.textContent = lines.join('\n'); };
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const fire = (el) => {
      const [x, y] = elCenter(el);
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    };
    const waitFor = async (fn, ms) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) return false; await sleep(30); } return true; };
    (async () => {
      let fails = 0;
      await sleep(200);
      beginBtn.click();
      await waitFor(() => pageIndex === 0, 4000);
      for (let i = 0; i < STORY.pages.length; i++) {
        await waitFor(() => pageIndex === i && !turning, 4000);
        await sleep(150);
        const page = STORY.pages[i];
        // tap everything that wants a tap (multi-tap objects get several)
        for (let round = 0; round < 4; round++) {
          const targets = [...pending];
          for (const el of targets) { fire(el); await sleep(40); }
          if (!pending.length) break;
          await sleep(200);
        }
        // exercise the non-required tappables too
        sprites.querySelectorAll('.tappable:not(.pending)').forEach(el => fire(el));
        const ok = await waitFor(() => arrowArmed, 8000);
        const imgsOk = [...sprites.querySelectorAll('img')].every(im => im.complete && im.naturalWidth > 0);
        const bgOk = activeScene.complete && activeScene.naturalWidth > 0;
        if (!ok || !imgsOk || !bgOk) fails++;
        log(`page ${i} (${page.id}): tasks ${tasksDone}/${tasksNeeded}, arrow ${ok ? 'armed' : 'NOT ARMED'}, sprites ${imgsOk ? 'ok' : 'MISSING'}, bg ${bgOk ? 'ok' : 'MISSING'}`);
        arrowBtn.click();
        await sleep(100);
      }
      const endOk = !ending.classList.contains('hidden');
      if (!endOk) fails++;
      log(`ending shown: ${endOk}`);
      log(fails ? `RESULT: FAIL (${fails})` : 'RESULT: PASS');
      document.title = fails ? 'TEST FAIL' : 'TEST PASS';
    })();
  }
})();
