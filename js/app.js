/* ============================================================
   app.js — storybook engine (v2)

   Places the designer's layers (STORY + LAYOUT), plays the
   recorded narration with word highlighting driven by the audio
   element's own currentTime, gates the two navigation arrows,
   invites exactly one tap at a time, and replays a page in full
   whenever it is entered — forwards, backwards or again.

   Nothing here draws, typesets or speaks: every pixel and every
   sound the child sees or hears (apart from the small synthesized
   tap effects) comes from the artwork and recordings.
   ============================================================ */

(() => {
  const $ = (sel) => document.querySelector(sel);

  const stage     = $('#stage');
  const world     = $('#world');
  const scene     = $('#scene');
  const sprites   = $('#sprites');
  const fx        = $('#fx');
  const captions  = $('#captions');
  const hand      = $('#hand');
  const backBtn   = $('#arrow-back');
  const nextBtn   = $('#arrow-next');
  const muteBtn   = $('#mute-btn');
  const splash    = $('#splash');
  const beginBtn  = $('#begin-btn');
  const ending    = $('#ending');
  const againBtn  = $('#again-btn');
  const turner    = $('#turner');
  const timeline  = $('#timeline');

  const params   = new URLSearchParams(location.search);
  const SELFTEST = params.has('selftest');
  const FAST     = SELFTEST || params.has('fast');
  const SHOW_TL  = params.has('envelope');
  if (params.has('boxes')) document.body.classList.add('show-boxes');

  /* ================= State ================= */

  let pageIndex = -1;              // -1 = cover
  let pageToken = 0;               // bumps on every page load; stale timers check it
  let phase = 'cover';             // cover | settle | narrate | invite | complete
  let muted = false;
  let turning = false;

  // per-page progress
  let tasksNeeded = 0, tasksDone = 0;
  let narrated = false, afterStarted = false, nextArmed = false;
  let pending = [];                // elements still waiting for a tap (for hints)
  let idleTimer = null;
  const runs = [];                 // how many times each page has been loaded (self-test)

  const later = (ms, fn) => {
    const t = pageToken;
    return setTimeout(() => { if (t === pageToken) fn(); }, FAST ? Math.min(ms, 60) : ms);
  };
  const pct = (v) => parseFloat(v);
  const pxRect = (x, y, w, h) => px(x, y, w, h);
  const placeAt = (el, r) => Object.assign(el.style, px(r.x, r.y, r.w, r.h));

  /* ================= Preloading ================= */

  const imgCache = {};
  function preloadImg(s) { if (!s || imgCache[s]) return; const i = new Image(); i.src = s; imgCache[s] = i; }
  function preloadPage(p) {
    if (!p) return;
    preloadImg(src(p.bg));
    (p.objects || []).forEach(o => { if (o.layout) preloadImg(src(o.layout)); if (o.tap && o.tap.mask) preloadImg(src(o.tap.mask)); });
    (p.caption || []).forEach(c => preloadImg(asset(IMG + LAYOUT.captions[c].file)));
    if (p.narration) Voice.preload(p.narration);
    (p.objects || []).forEach(o => { if (o.tap && o.tap.say) Voice.preload(o.tap.say); });
  }

  /* ================= Voice: the recordings ================= */

  const Voice = (() => {
    // iOS unlocks media elements one at a time on a user gesture, so the whole book uses just two:
    // one for narration, one for the single-word clips. Both are unlocked by the cover's Start tap.
    const narrEl = new Audio(), clipEl = new Audio();
    narrEl.preload = 'auto'; clipEl.preload = 'auto';
    let narrId = null;
    const warmed = {};
    function preload(id) {              // warms the browser cache for the next page
      if (!LAYOUT.audio[id] || warmed[id] || window.BUNDLE_ASSETS) return;
      warmed[id] = true;
      const w = new Audio(); w.preload = 'auto'; w.src = audio(id);
    }
    function stop() {
      narrEl.onended = null;
      if (narrId) { try { narrEl.pause(); } catch (e) {} }
      narrId = null;
      Sfx.setDucked(false);
    }
    // returns the element; onFail is called if the browser refuses to play (no gesture yet, no audio)
    function narrate(id, onFail) {
      stop();
      narrId = id;
      narrEl.muted = muted;
      narrEl.src = audio(id);
      try { narrEl.currentTime = 0; } catch (e) {}
      Sfx.setDucked(true);
      const p = narrEl.play();
      if (p && p.catch) p.catch(() => { if (narrId === id) { Sfx.setDucked(false); onFail(); } });
      return narrEl;
    }
    function say(id) {
      if (!LAYOUT.audio[id]) return;
      try { clipEl.pause(); } catch (e) {}
      clipEl.muted = muted;
      clipEl.src = audio(id);
      const p = clipEl.play(); if (p && p.catch) p.catch(() => {});
    }
    function unlock() {                 // call inside a user gesture
      clipEl.muted = true; clipEl.src = audio('p03-number');
      const p = clipEl.play();
      if (p && p.then) p.then(() => { clipEl.pause(); clipEl.muted = muted; }).catch(() => { clipEl.muted = muted; });
    }
    function setMuted(m) { narrEl.muted = m; clipEl.muted = m; }
    function pause() { if (narrId && !narrEl.paused) narrEl.pause(); }
    function resume() { if (narrId && narrEl.paused && !narrEl.ended) { const p = narrEl.play(); if (p && p.catch) p.catch(() => {}); } }
    return { preload, narrate, say, stop, setMuted, pause, resume, unlock };
  })();
  /* ================= Scene ================= */

  function showScene(id) { scene.src = src(id); }

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

  /* ============ Caption panels + narration sync ============ */

  let panels = [];       // [{ id, el, boxes: [el], first: global index of its first word }]
  let words = [];        // [{ el, panel }] in reading order, for the current page
  let narrToken = 0;
  let lastNarration = null;
  let litIndex = -1;

  function buildCaptions(page) {
    captions.innerHTML = '';
    panels = []; words = [];
    let first = 0;
    (page.caption || []).forEach((cid, k) => {
      const c = LAYOUT.captions[cid];
      const el = document.createElement('div');
      el.className = 'panel' + (k === 0 ? ' show' : '');
      el.dataset.id = cid;
      placeAt(el, c);
      const img = document.createElement('img');
      img.src = asset(IMG + c.file); img.alt = '';
      el.appendChild(img);
      const boxes = c.words.map(([x, y, w, h]) => {
        const b = document.createElement('div');
        b.className = 'w';
        b.style.left = x + '%'; b.style.top = y + '%'; b.style.width = w + '%'; b.style.height = h + '%';
        el.appendChild(b);
        return b;
      });
      const panel = { id: cid, el, boxes, first };
      boxes.forEach(b => words.push({ el: b, panel }));
      first += boxes.length;
      panels.push(panel);
      captions.appendChild(el);
      el.addEventListener('pointerdown', () => {
        if (turning || !lastNarration) return;
        Sfx.tap();
        narrate(lastNarration.page, lastNarration.done);
      });
    });
  }

  function showPanel(panel) {
    panels.forEach(p => p.el.classList.toggle('show', p === panel));
  }

  function light(i, page) {
    if (i === litIndex) return;
    if (litIndex >= 0 && words[litIndex]) words[litIndex].el.classList.remove('lit');
    const prev = litIndex;
    litIndex = i;
    if (i >= 0 && words[i]) {
      words[i].el.classList.add('lit');
      showPanel(words[i].panel);
    }
    // fire every event crossed since the last lit word (a slow frame may skip several words)
    (page.events || []).forEach(ev => { if (ev.word > prev && ev.word <= i) runEffect(ev); });
    if (SHOW_TL) tlLight(i);
  }

  // timeline strip for ?envelope=1 — the derived word spans with a moving playhead
  let tlWords = [], tlHead = null;
  function buildTimeline(tm) {
    timeline.innerHTML = ''; tlWords = [];
    if (!SHOW_TL) return;
    timeline.classList.remove('hidden');
    tm.words.forEach(([s, e]) => {
      const d = document.createElement('div'); d.className = 'tw';
      d.style.left = (s / tm.duration * 100) + '%'; d.style.width = ((e - s) / tm.duration * 100) + '%';
      timeline.appendChild(d); tlWords.push(d);
    });
    tlHead = document.createElement('div'); tlHead.className = 'head'; timeline.appendChild(tlHead);
  }
  function tlLight(i) { tlWords.forEach((d, k) => d.classList.toggle('lit', k === i)); }
  function tlHeadAt(t, dur) { if (tlHead) tlHead.style.left = (t / dur * 100) + '%'; }

  function stopNarration() {
    narrToken++;
    Voice.stop();
    if (litIndex >= 0 && words[litIndex]) words[litIndex].el.classList.remove('lit');
    litIndex = -1;
  }

  // Play the page's recording and light words from its playhead. Falls back to a silent
  // read-along at the same timings if the browser will not play audio.
  function narrate(page, done) {
    stopNarration();
    lastNarration = { page, done };
    const token = narrToken;
    const tm = LAYOUT.timings[page.id] || { duration: 0, words: [] };
    const starts = tm.words.map(w => w[0]);
    showPanel(panels[0]);
    buildTimeline(tm);
    let finished = false;
    let clock = null;
    const finish = () => {
      if (finished || token !== narrToken) return;
      finished = true;
      clearInterval(pump); clearTimeout(safety);
      if (litIndex >= 0 && words[litIndex]) words[litIndex].el.classList.remove('lit');
      litIndex = -1;
      Sfx.setDucked(false);
      if (done) done();
    };
    const indexAt = (t) => {
      let i = -1;
      for (let k = 0; k < starts.length; k++) { if (starts[k] <= t) i = k; else break; }
      return i;
    };
    const tick = () => {
      if (finished || token !== narrToken || !clock) return;
      const t = clock();
      light(indexAt(t), page);
      if (SHOW_TL) tlHeadAt(t, tm.duration);
      if (t >= tm.duration) finish();
    };
    let pump = setInterval(tick, 40);
    const raf = () => { if (!finished && token === narrToken) { tick(); requestAnimationFrame(raf); } };
    requestAnimationFrame(raf);
    let safety = null;

    const startSim = () => {
      const speed = FAST ? 30 : 1;
      const t0 = performance.now();
      let paused = 0, pauseAt = null;
      clock = () => ((pauseAt !== null ? pauseAt : performance.now()) - t0 - paused) / 1000 * speed;
      simPause = () => { if (pauseAt === null) pauseAt = performance.now(); };
      simResume = () => { if (pauseAt !== null) { paused += performance.now() - pauseAt; pauseAt = null; } };
      safety = setTimeout(finish, tm.duration / speed * 1000 + 150);
    };
    if (FAST || !LAYOUT.audio[page.narration]) { startSim(); return; }

    const a = Voice.narrate(page.narration, () => { if (!finished && token === narrToken) startSim(); });
    clock = () => a.currentTime;
    a.onended = () => finish();
    safety = setTimeout(finish, (tm.duration + 4) * 1000);
  }
  let simPause = () => {}, simResume = () => {};

  /* ================= Mute ================= */

  function setMuted(m) {
    muted = m;
    Sfx.setMuted(m);
    Voice.setMuted(m);
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
  }
  muteBtn.addEventListener('click', () => { Sfx.unlock(); setMuted(!muted); if (!muted) Sfx.tap(); });

  /* ================= Navigation state ================= */

  function setNav() {
    const onPage = pageIndex >= 0;
    backBtn.classList.toggle('hidden', !onPage);
    nextBtn.classList.toggle('hidden', !onPage);
    backBtn.disabled = !(onPage && narrated);
    nextBtn.disabled = !(onPage && nextArmed);
    nextBtn.classList.toggle('armed', onPage && nextArmed);
  }

  function armNext() {
    if (nextArmed) return;
    nextArmed = true;
    phase = 'complete';
    pending.forEach(el => el.classList.remove('pending'));
    setNav();
    Sfx.chime();
    const [cx, cy] = elCenter(nextBtn);
    sparkleBurst(cx, cy, '#fff3b0', 14);
    resetIdleHint();
  }
  function checkArmed() { if (narrated && tasksDone >= tasksNeeded) armNext(); }

  function maybeAfter(page) {
    if (!narrated || tasksDone < tasksNeeded || afterStarted) return;
    afterStarted = true;
    (page.after || []).forEach(runEffect);
    checkArmed();
  }
  function taskDone(page, el) {
    tasksDone++;
    if (el) { pending = pending.filter(p => p !== el); el.classList.remove('pending'); }
    maybeAfter(page);
    checkArmed();
  }

  function runEffect(eff) {
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
    hand.style.left = Math.min(hx, s.width * 0.93) + 'px';
    hand.style.top  = Math.min(hy, s.height * 0.9) + 'px';
    hand.classList.remove('hidden');
    hand.classList.remove('tapping');
    void hand.offsetWidth;
    hand.classList.add('tapping');
    setTimeout(hideHand, 1900);
  }

  function showHandOnCover() {
    const r = LAYOUT.img[STORY.cover.hand];
    Object.assign(hand.style, { left: (r.x / SCENE_W * 100) + '%', top: (r.y / SCENE_H * 100) + '%' });
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
      if (pageIndex < 0) { showHandOnCover(); resetIdleHint(); return; }
      if (phase === 'invite' && pending[0]) {
        const target = pending[0];
        const anim = target.closest('.sprite') ? target.closest('.sprite').querySelector('.anim') : target;
        anim.classList.remove('anim-hint'); void anim.offsetWidth; anim.classList.add('anim-hint');
        showHandAt(target);
      } else if (nextArmed) {
        showHandAt(nextBtn);
      }
      resetIdleHint();
    }, pageIndex < 0 ? 4000 : 5000);
  }

  /* ================= Voronoi cells for multi-fruit sprites ================= */

  function clipPoly(poly, a, b, c) {
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
    Object.assign(el.style, obj.rect || rectOf(obj.layout));
    if (obj.z) el.style.zIndex = obj.z;
    const anim = document.createElement('div'); anim.className = 'anim';
    const body = document.createElement('div'); body.className = 'body';
    if (obj.origin) { anim.style.transformOrigin = obj.origin; body.style.transformOrigin = obj.origin; }
    if (obj.layout && !(obj.tap && obj.tap.type === 'bite')) {
      const img = document.createElement('img');
      img.src = src(obj.layout); img.alt = '';
      body.appendChild(img);
    }
    anim.appendChild(body);
    el.appendChild(anim);
    if (obj.hidden) el.classList.add('is-hidden');
    if (obj.reveal) el.classList.add('reveal', 'is-veiled');
    if (obj.breathe && !obj.hidden) body.classList.add('anim-breathe');
    if (obj.tap) {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireTap(el.querySelector('.cell') || el); }
      });
    }
    return el;
  }

  function fireTap(el) {
    const [x, y] = elCenter(el);
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
  }

  function markPending(el) { el.classList.add('tappable'); pending.push(el); if (phase !== 'narrate' && phase !== 'settle') el.classList.add('pending'); }
  function startInviting() { pending.forEach(el => el.classList.add('pending')); }

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
      Voice.say(obj.tap.say);
      resetIdleHint();
    });
  }

  function setupBite(page, obj, sp) {
    const body = sp.querySelector('.body');
    const cells = obj.tap.cells || [[50, 50]];
    const polys = cells.length > 1 ? voronoi(cells) : [null];
    const img = src(obj.layout), mask = src(obj.tap.mask);
    cells.forEach((c, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.backgroundImage = `url("${img}")`;
      if (polys[i]) cell.style.clipPath = polys[i];
      cell.style.transformOrigin = c[0] + '% ' + c[1] + '%';
      body.appendChild(cell);
      markPending(cell);
      let bitten = false;
      cell.addEventListener('pointerdown', (e) => {
        resetIdleHint();
        if (bitten) return;
        bitten = true;
        cell.classList.remove('pending');
        cell.classList.remove('anim-chomp'); void cell.offsetWidth; cell.classList.add('anim-chomp');
        later(140, () => {
          cell.classList.add('bitten');
          cell.style.webkitMaskImage = `url("${mask}")`;
          cell.style.maskImage = `url("${mask}")`;
        });
        Sfx.munch();
        sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor || '#fff3b0', 8);
        crumbBurst(e.clientX, e.clientY, obj.tap.crumbColor || '#8a5a2b');
        if (obj.tap.say) Voice.say(obj.tap.say);
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

  function setupReveal(page, obj, sp) {
    let done = false;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      resetIdleHint();
      (Sfx[obj.tap.sound] || Sfx.munch)();
      sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor || '#fff3b0', 8);
      crumbBurst(e.clientX, e.clientY, obj.tap.crumbColor || '#8a5a2b');
      if (done) return;
      done = true;
      sp.classList.remove('is-veiled');
      later(500, () => taskDone(page, sp));
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
      playAnim(sp.querySelector('.body'), 'anim-happy');
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
    let done = false;
    markPending(sp);
    sp.addEventListener('pointerdown', (e) => {
      if (done) return;
      done = true;
      resetIdleHint();
      pending = pending.filter(p => p !== sp); sp.classList.remove('pending', 'tappable');
      playAnim(anim, 'anim-shake');
      Sfx.wobble(2);
      sparkleBurst(e.clientX, e.clientY, '#e6ffcc');
      later(550, () => {
        Sfx.crackPop();
        sparkleBurst(e.clientX, e.clientY, '#ffd94d', 16);
        if (!obj.tap.keep) playAnim(anim, 'anim-crack');
        later(300, () => flyButterfly(page, sp, bf.el, bf.obj));
      });
    });
  }

  function flyButterfly(page, fromEl, bfEl, bfObj) {
    const from = fromEl.getBoundingClientRect();
    const wr = sprites.getBoundingClientRect();
    const x0 = (from.left + from.width / 2 - wr.left) / wr.width * 100;
    const y0 = (from.top + from.height * 0.35 - wr.top) / wr.height * 100;
    const rect = bfObj.rect || rectOf(bfObj.layout);
    const w = pct(rect.width), h = pct(rect.height);
    const x1 = pct(rect.left) + w / 2, y1 = pct(rect.top) + h / 2;
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
    later(dur + 600, () => { if (!landed) step(t0 + dur); });    // frames may stall (hidden tab, headless)
    const step = (now) => {
      if (landed) return;
      let t = Math.min(1, (now - t0) / dur);
      const e = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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
      if (obj.tap.say) Voice.say(obj.tap.say);
      resetIdleHint();
    });
  }

  /* ================= Page rendering ================= */

  // Every entry — forwards, backwards, or replay — runs the page from the top.
  function loadPage(idx) {
    const page = STORY.pages[idx];
    pageIndex = idx;
    pageToken++;
    runs[idx] = (runs[idx] || 0) + 1;
    tasksNeeded = 0; tasksDone = 0;
    narrated = false; afterStarted = false; nextArmed = false;
    phase = 'settle';
    pending = [];
    sprites.innerHTML = '';
    fx.innerHTML = '';
    hideHand();
    document.body.classList.remove('on-cover');
    setNav();

    showScene(page.bg);
    buildCaptions(page);
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
      switch (tap.type) {
        case 'shake':  tasksNeeded++; setupShake(page, obj, sp); break;
        case 'say':    setupSay(page, obj, sp); break;
        case 'bite':   tasksNeeded += (tap.cells || [[50, 50]]).length; setupBite(page, obj, sp); break;
        case 'hatch':  tasksNeeded++; setupHatch(page, obj, sp, els); break;
        case 'reveal': tasksNeeded++; setupReveal(page, obj, sp); break;
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
        sparkleBurst(e.clientX, e.clientY, h.sparkColor || '#fff3b0');
        resetIdleHint();
      });
    });

    later(350, () => {
      phase = 'narrate';
      narrate(page, () => {
        narrated = true;
        phase = tasksDone >= tasksNeeded ? 'complete' : 'invite';
        setNav();
        startInviting();
        maybeAfter(page);
        checkArmed();
        resetIdleHint();
      });
    });
    resetIdleHint();
  }

  /* ================= Navigation ================= */

  function turnTo(idx, opts = {}) {
    if (turning) return;
    turning = true;
    stopNarration();
    hideHand();
    const instant = !!opts.instant;
    if (!instant) {
      Sfx.whoosh();
      turner.classList.remove('turning', 'back'); void turner.offsetWidth;
      turner.classList.add('turning'); if (opts.back) turner.classList.add('back');
      world.classList.add('world-out');
    }
    captions.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
    setTimeout(() => {
      world.classList.remove('world-out');
      world.classList.add('world-in');
      loadPage(idx);
      setTimeout(() => { world.classList.remove('world-in'); turning = false; }, FAST ? 60 : 700);
    }, instant ? 0 : (FAST ? 40 : 430));
  }

  function showCover() {
    stopNarration();
    pageIndex = -1; phase = 'cover'; nextArmed = false; narrated = false;
    sprites.innerHTML = ''; captions.innerHTML = '';
    hideHand();
    setNav();
    document.body.classList.add('on-cover');
    splash.style.display = '';
    splash.classList.remove('gone');
    resetIdleHint();
  }

  function showEnding() {
    stopNarration();
    captions.innerHTML = '';
    backBtn.classList.add('hidden'); nextBtn.classList.add('hidden');
    hideHand();
    phase = 'ending';
    ending.classList.remove('hidden');
    Sfx.glitter();
    later(300, () => { const r = ending.getBoundingClientRect(); sparkleBurst(r.left + r.width / 2, r.top + r.height * .4, '#ffb347', 24); });
  }

  nextBtn.addEventListener('click', () => {
    if (nextBtn.disabled || turning) return;
    Sfx.tap();
    const next = pageIndex + 1;
    if (next < STORY.pages.length) turnTo(next);
    else showEnding();
  });

  backBtn.addEventListener('click', () => {
    if (backBtn.disabled || turning) return;
    Sfx.tap();
    if (pageIndex === 0) { Sfx.whoosh(); showCover(); }
    else turnTo(pageIndex - 1, { back: true });
  });

  againBtn.addEventListener('click', () => {
    Sfx.tap();
    ending.classList.add('hidden');
    showCover();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && !nextBtn.disabled && pageIndex >= 0) { e.preventDefault(); nextBtn.click(); }
    else if (e.key === 'ArrowLeft' && !backBtn.disabled && pageIndex >= 0) { e.preventDefault(); backBtn.click(); }
    else if ((e.key === 'Enter' || e.key === ' ') && pageIndex < 0 && !splash.classList.contains('gone') && document.activeElement === document.body) { e.preventDefault(); beginBtn.click(); }
  });

  /* ================= Cover ================= */

  // the designer's Start arrow and hand, placed where drawn
  placeAt(beginBtn, LAYOUT.img[STORY.cover.arrow]);
  placeAt(backBtn, LAYOUT.img['arrow-back']);
  placeAt(nextBtn, LAYOUT.img['arrow-next']);

  let starting = false;
  function startStory() {
    if (starting) return;
    starting = true;
    Sfx.unlock();
    if (!FAST) Voice.unlock();
    Sfx.chirp();
    hideHand(); clearTimeout(idleTimer);
    const [cx, cy] = elCenter(beginBtn);
    sparkleBurst(cx, cy, '#fff3b0', 18);
    const go = () => { splash.classList.add('gone'); setTimeout(() => { turnTo(0, { instant: true }); starting = false; }, FAST ? 30 : 300); };
    if (FAST) { later(50, go); return; }
    // "A Feijoa on Monday", in the child's voice, then the first page
    const dur = (LAYOUT.timings.cover && LAYOUT.timings.cover.duration) || 3;
    let went = false;
    const once = () => { if (!went) { went = true; go(); } };
    const a = Voice.narrate(STORY.cover.narration, () => setTimeout(once, 900));
    a.onended = once;
    setTimeout(once, (dur + 1.5) * 1000);
  }
  beginBtn.addEventListener('pointerdown', () => Sfx.unlock());
  beginBtn.addEventListener('click', startStory);
  window.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });

  preloadPage(STORY.pages[0]); preloadPage(STORY.pages[1]);
  Voice.preload(STORY.cover.narration);
  resetIdleHint();

  /* ================= Portrait phones ================= */

  function checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth && Math.min(window.innerWidth, window.innerHeight) < 600;
    const was = document.body.classList.contains('portrait');
    document.body.classList.toggle('portrait', portrait);
    if (portrait && !was) { Voice.pause(); simPause(); }
    if (!portrait && was) { Voice.resume(); simResume(); }
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();

  /* ================= Service worker ================= */
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !SELFTEST && !window.BUNDLE_ASSETS) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  /* ================= Dev helpers: ?page=N, ?selftest, ?rotatecheck ================= */

  if (params.has('page')) {
    const n = Math.max(0, Math.min(STORY.pages.length - 1, parseInt(params.get('page'), 10) || 0));
    splash.classList.add('gone'); splash.style.display = 'none';
    turnTo(n, { instant: true });
  }

  if (params.has('rotatecheck')) {
    setTimeout(() => {
      const shown = getComputedStyle($('#rotate')).display !== 'none';
      document.title = shown ? 'ROTATE SHOWN' : 'ROTATE HIDDEN';
    }, 300);
  }

  if (SELFTEST) {
    const report = $('#test-report');
    report.classList.remove('hidden');
    const lines = [];
    let fails = 0;
    const log = (s) => { lines.push(s); report.textContent = lines.join('\n'); };
    const fail = (s) => { fails++; log('FAIL: ' + s); };
    const state = () => `[page ${pageIndex} phase ${phase} turning ${turning} back ${backBtn.disabled ? 'off' : 'on'} next ${nextBtn.disabled ? 'off' : 'on'} tasks ${tasksDone}/${tasksNeeded}]`;
    window.addEventListener('error', (e) => fail(`js error: ${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
    window.addEventListener('unhandledrejection', (e) => fail('unhandled rejection: ' + (e.reason && e.reason.message || e.reason)));
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const waitFor = async (fn, ms) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) return false; await sleep(30); } return true; };
    const imagesOk = () => {
      const all = [scene, ...sprites.querySelectorAll('img'), ...captions.querySelectorAll('img'), hand.querySelector('img'), backBtn.querySelector('img'), nextBtn.querySelector('img')];
      return all.every(im => im.complete && im.naturalWidth > 0);
    };
    const cellsOk = () => [...sprites.querySelectorAll('.cell')].every(c => { const u = c.style.backgroundImage.match(/url\("(.+)"\)/); return u && imgCache[u[1]] ? imgCache[u[1]].naturalWidth > 0 : true; });

    async function runPage(i, expectBack) {
      const ok = await waitFor(() => pageIndex === i && !turning, 4000);
      if (!ok) { fail(`page ${i} did not load ` + state()); return; }
      const page = STORY.pages[i];
      // 1. while narrating, neither arrow is enabled
      await waitFor(() => phase === 'narrate', 2000);
      if (phase === 'narrate' && (!backBtn.disabled || !nextBtn.disabled)) fail(`page ${i}: an arrow is enabled during narration`);
      // 2. caption boxes match the timings
      const tm = LAYOUT.timings[page.id];
      const boxes = captions.querySelectorAll('.w').length;
      if (!tm || boxes !== tm.words.length) fail(`page ${i}: ${boxes} word boxes vs ${tm ? tm.words.length : 'no'} timings`);
      // 3. narration ends → back enabled, next still gated while tasks remain
      const ended = await waitFor(() => phase !== 'narrate' && phase !== 'settle', 6000);
      if (!ended) fail(`page ${i}: narration never finished`);
      if (backBtn.disabled) fail(`page ${i}: back arrow not enabled after narration`);
      if (tasksNeeded > tasksDone && !nextBtn.disabled) fail(`page ${i}: next arrow enabled before the activity was done`);
      if (i === 7 && !sprites.querySelector('.anim-queasy')) fail('page 7: stomachache reaction did not fire');
      if (i === 7 && !captions.querySelector('.panel[data-id="p08b"]')) fail('page 7: second caption panel missing');
      // 4. tap everything that wants a tap (multi-tap objects get several rounds)
      for (let round = 0; round < 4; round++) {
        const targets = [...pending];
        for (const el of targets) { fireTap(el); await sleep(40); }
        if (!pending.length) break;
        await sleep(200);
      }
      sprites.querySelectorAll('.tappable:not(.pending)').forEach(el => fireTap(el));
      const armed = await waitFor(() => nextArmed, 8000);
      if (!armed) fail(`page ${i}: next arrow never armed (tasks ${tasksDone}/${tasksNeeded})`);
      if (!nextBtn.classList.contains('armed')) fail(`page ${i}: next arrow armed but not beckoning`);
      if (!imagesOk()) fail(`page ${i}: an image failed to load`);
      if (!cellsOk()) fail(`page ${i}: a bite cell image failed to load`);
      log(`page ${i} (${page.id}): tasks ${tasksDone}/${tasksNeeded}, arrow ${armed ? 'armed' : 'NOT ARMED'}, words ${boxes}, run ${runs[i]}`);
    }

    (async () => {
      await sleep(200);
      // audio files: every recording resolves, and every timing ends inside its recording
      await Promise.all(Object.keys(LAYOUT.audio).map(id => new Promise(res => {
        const a = new Audio(audio(id));
        const t = setTimeout(() => { fail(`audio ${id}: no metadata within 8 s`); res(); }, 8000);
        a.addEventListener('loadedmetadata', () => {
          clearTimeout(t);
          const tm = LAYOUT.timings[id.replace('-narration', '')];
          if (tm && tm.words.length && tm.words[tm.words.length - 1][1] > a.duration + 0.05) fail(`audio ${id}: timings run past the recording`);
          res();
        });
        a.addEventListener('error', () => { clearTimeout(t); fail(`audio ${id}: failed to load`); res(); });
      })));
      log(`audio: ${Object.keys(LAYOUT.audio).length} recordings checked`);
      // timings monotonic
      Object.entries(LAYOUT.timings).forEach(([k, tm]) => {
        let last = 0;
        tm.words.forEach(([s, e], n) => { if (s < last - 1e-6 || e <= s) fail(`timings ${k}: word ${n} out of order`); last = e; });
      });
      // portrait prompt hidden in a landscape window
      if (getComputedStyle($('#rotate')).display !== 'none') fail('rotate prompt visible in landscape');

      // cover → page 0
      if (backBtn.offsetParent !== null) fail('back arrow visible on the cover');
      beginBtn.click();
      await runPage(0);
      nextBtn.click();
      if (!await waitFor(() => pageIndex === 1 && !turning, 4000)) fail('next arrow did not reach page 1 ' + state());
      // back: page 1 → page 0 replays from the start
      if (!await waitFor(() => phase !== 'narrate' && phase !== 'settle', 6000)) fail('page 1 narration did not finish ' + state());
      backBtn.click();
      const back = await waitFor(() => pageIndex === 0 && !turning, 4000);
      if (!back) fail('back arrow did not return to page 0');
      if (runs[0] !== 2) fail(`page 0 was not reloaded on back (runs=${runs[0]})`);
      if (phase === 'complete' || nextArmed) fail('page 0 did not reset on back');
      log('back: page 1 → page 0 replayed from the top');
      await runPage(0);
      nextBtn.click();
      for (let i = 1; i < STORY.pages.length; i++) {
        await runPage(i);
        nextBtn.click();
        await sleep(100);
      }
      const endOk = await waitFor(() => !ending.classList.contains('hidden'), 3000);
      if (!endOk) fail('ending not shown');
      log(`ending shown: ${endOk}`);
      log(fails ? `RESULT: FAIL (${fails})` : 'RESULT: PASS');
      document.title = fails ? 'TEST FAIL' : 'TEST PASS';
    })();
  }
})();
