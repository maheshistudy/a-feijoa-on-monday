/* ============================================================
   app.js — storybook engine
   Renders pages from STORY, handles taps, narration
   highlighting, camera, atmosphere and page turns.
   ============================================================ */

(() => {
  const $ = (sel) => document.querySelector(sel);

  const world     = $('#world');
  const sprites   = $('#sprites');
  const atmo      = $('#atmosphere');
  const fx        = $('#fx');
  const nightImg  = $('#scene-night');
  const dayImg    = $('#scene-day');
  const caption   = $('#caption');
  const capText   = $('#caption-text');
  const arrowBtn  = $('#arrow-btn');
  const splash    = $('#splash');
  const beginBtn  = $('#begin-btn');
  const turner    = $('#turner');
  const stage     = $('#stage');

  let pageIndex = -1;          // -1 = splash
  let narrTimer = null;
  let idleTimer = null;
  let pendingTappables = [];   // sprites that still want attention (for hints)
  let arrowArmed = false;

  /* ================= Scene & atmosphere ================= */

  function showScene(name, crossfade) {
    if (name === 'day') {
      if (crossfade) {
        nightImg.style.opacity = 1;
        dayImg.style.opacity = 0;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            nightImg.style.opacity = 0;
            dayImg.style.opacity = 1;
          }));
      } else {
        nightImg.style.opacity = 0;
        dayImg.style.opacity = 1;
      }
    } else {
      nightImg.style.opacity = 1;
      dayImg.style.opacity = 0;
    }
  }

  function buildAtmosphere(scene) {
    atmo.innerHTML = '';
    if (scene === 'night') {
      // twinkling stars (kept in the sky band)
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('div');
        s.className = 'twinkle';
        s.style.left = (Math.random() * 96 + 2) + '%';
        s.style.top  = (Math.random() * 34 + 2) + '%';
        s.style.animationDelay = (Math.random() * 2.6) + 's';
        s.style.animationDuration = (2 + Math.random() * 2.4) + 's';
        atmo.appendChild(s);
      }
      // fireflies drifting low over the leaf
      for (let i = 0; i < 6; i++) {
        const f = document.createElement('div');
        f.className = 'firefly';
        f.style.left = (Math.random() * 80 + 8) + '%';
        f.style.top  = (Math.random() * 30 + 58) + '%';
        f.style.animationDelay = (Math.random() * 6) + 's, ' + (Math.random() * 2.1) + 's';
        f.style.animationDuration = (9 + Math.random() * 6) + 's, ' + (1.6 + Math.random() * 1.2) + 's';
        atmo.appendChild(f);
      }
    } else {
      // sun glow + slowly rotating rays centred on the drawn sun
      const cx = 50.8, cy = 23.6;             // sun centre (% of scene)
      const glow = document.createElement('div');
      glow.className = 'sun-glow';
      glow.style.width = '34%';
      glow.style.aspectRatio = '1';
      glow.style.left = (cx - 17) + '%';
      glow.style.top  = (cy - 17 * (1316 / 924)) * 1 + '%';
      // aspect-ratio keeps it circular relative to width; nudge with translate
      glow.style.transform = 'translateY(-6%)';
      atmo.appendChild(glow);

      const rays = document.createElement('div');
      rays.className = 'sun-rays';
      rays.style.width = '52%';
      rays.style.aspectRatio = '1';
      rays.style.left = (cx - 26) + '%';
      rays.style.top  = (cy - 26 * (1316 / 924)) + '%';
      atmo.appendChild(rays);

      // drifting clouds — simple flat SVG blobs in the book's style
      const cloudSvg = (w) => `
        <svg viewBox="0 0 220 90" width="${w}" xmlns="http://www.w3.org/2000/svg">
          <g fill="#ffffff" stroke="#23315f" stroke-width="4" stroke-linejoin="round" opacity="0.92">
            <ellipse cx="60" cy="58" rx="52" ry="26"/>
            <ellipse cx="120" cy="44" rx="46" ry="30"/>
            <ellipse cx="168" cy="60" rx="44" ry="22"/>
          </g>
        </svg>`;
      [[2, '10%', 130, 70], [30, '4%', 170, 95], [58, '15%', 110, 120]]
        .forEach(([left, top, w, dur], i) => {
          const c = document.createElement('div');
          c.className = 'cloud';
          c.style.left = left + '%';
          c.style.top = top;
          c.style.animationDuration = dur + 's';
          c.style.animationDelay = (-i * 22) + 's';
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

  /* ================= Sparkles ================= */

  function sparkleBurst(clientX, clientY, color) {
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      s.style.color = color || '#ffe98a';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
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

  /* ============ Narration: read-aloud + synced highlighting ============ */

  let fallbackTimer = null;
  let safetyTimer = null;
  let speechUtterance = null;
  let chosenVoice = null;
  let lastNarration = null;      // for tap-to-replay on the caption

  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    const prefs = ['en-nz', 'en-gb', 'en-au', 'en-us', 'en'];
    for (const p of prefs) {
      const norm = (v) => v.lang.toLowerCase().replace('_', '-');
      const local = vs.find(v => norm(v).startsWith(p) && v.localService);
      if (local) return local;
      const any = vs.find(v => norm(v).startsWith(p));
      if (any) return any;
    }
    return vs[0];
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
  }

  function narrate(text, done) {
    stopNarration();
    lastNarration = { text, done };
    caption.classList.remove('hidden');

    // word spans + each word's character offset within `text`
    const tokens = text.split(/\s+/);
    capText.innerHTML = tokens.map(w => `<span class="w">${w}</span>`).join(' ');
    const words = [...capText.querySelectorAll('.w')];
    const starts = [];
    let pos = 0;
    tokens.forEach(t => {
      const idx = text.indexOf(t, pos);
      starts.push(idx);
      pos = idx + t.length;
    });

    const isWordy = (el) => /[\p{L}\p{N}]/u.test(el.textContent);
    const light = (i) => {
      words.forEach(w => w.classList.remove('lit'));
      if (i >= 0 && i < words.length) words[i].classList.add('lit');
    };
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      stopNarration();
      words.forEach(w => w.classList.remove('lit'));
      if (done) done();
    };

    // timed highlighting — the fallback, and the pacer when the voice
    // plays but the browser gives no word-boundary events
    const startTimedHighlight = (finishWhenDone) => {
      clearInterval(narrTimer);
      let i = 0;
      narrTimer = setInterval(() => {
        while (i < words.length && !isWordy(words[i])) i++;
        if (i >= words.length) {
          clearInterval(narrTimer);
          if (finishWhenDone) finish();
          return;
        }
        light(i); i++;
      }, 330);
    };

    // MP3 hook: drop files at assets/audio/<pageId>.mp3 and, when present,
    // play them here with startTimedHighlight(false) + finish() on 'ended'.

    if (!('speechSynthesis' in window)) { startTimedHighlight(true); return; }

    const u = new SpeechSynthesisUtterance(text);
    speechUtterance = u;
    if (!chosenVoice) chosenVoice = pickVoice();
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; }
    u.rate = 0.88;    // gentle storytime pace
    u.pitch = 1.05;

    let sawBoundary = false;
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      sawBoundary = true;
      clearInterval(narrTimer);          // real boundaries beat the pacer
      let i = starts.findIndex((s, k) =>
        e.charIndex >= s && e.charIndex < s + tokens[k].length + 1);
      if (i === -1) i = starts.filter(s => s <= e.charIndex).length - 1;
      if (i >= 0 && isWordy(words[i])) light(i);
    };
    u.onend = () => { if (speechUtterance === u) finish(); };
    u.onerror = () => { if (speechUtterance === u) startTimedHighlight(true); };

    speechSynthesis.cancel();            // clear any stuck queue (Chrome quirk)
    try {
      speechSynthesis.speak(u);
    } catch (err) {
      startTimedHighlight(true);
      return;
    }

    // watchdog: no boundary events after 1.1s → pace highlights on a timer;
    // if the voice never actually started, the timer also ends the page
    fallbackTimer = setTimeout(() => {
      if (!sawBoundary && !finished) {
        const speaking = speechSynthesis.speaking || speechSynthesis.pending;
        startTimedHighlight(!speaking);
      }
    }, 1100);

    // absolute safety net so the arrow can never get stuck
    safetyTimer = setTimeout(finish, tokens.length * 600 + 6000);
  }

  // tap the caption to hear the page again
  caption.addEventListener('pointerdown', () => {
    if (lastNarration) narrate(lastNarration.text, lastNarration.done);
  });

  /* ================= Arrow ================= */

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
  }

  /* ================= Idle hints ================= */

  function resetIdleHint() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      pendingTappables.forEach(el => {
        el.classList.remove('anim-hint');
        void el.offsetWidth;
        el.classList.add('anim-hint');
      });
      resetIdleHint();
    }, 5000);
  }

  /* ================= Page rendering ================= */

  function makeSprite(obj) {
    const el = document.createElement('div');
    el.className = 'sprite';
    el.id = 'obj-' + obj.id;
    Object.assign(el.style, obj.rect);
    const img = document.createElement('img');
    img.src = obj.img;
    img.alt = '';
    el.appendChild(img);
    if (obj.hiddenAtStart) el.style.opacity = 0;
    if (obj.breathe && !obj.hiddenAtStart) el.classList.add('anim-breathe');
    return el;
  }

  function playAnim(el, cls, after) {
    el.classList.remove('anim-wobble-sm', 'anim-wobble-lg', 'anim-crack', 'anim-hatch', 'anim-hint');
    void el.offsetWidth;
    el.classList.add(cls);
    if (after) el.addEventListener('animationend', after, { once: true });
  }

  function glowAt(rectStyles) {
    const g = document.createElement('div');
    g.className = 'glow-pulse';
    // centre a square glow over the hotspot rect, 1.8× its width
    const l = parseFloat(rectStyles.left), t = parseFloat(rectStyles.top);
    const w = parseFloat(rectStyles.width), h = parseFloat(rectStyles.height);
    const gw = w * 1.9;
    g.style.width = gw + '%';
    g.style.aspectRatio = '1';
    g.style.left = (l + w / 2 - gw / 2) + '%';
    g.style.top = (t + h / 2 - gw / 2 * (1316 / 924)) + '%';
    fx.appendChild(g);
    setTimeout(() => g.remove(), 1500);
  }

  function loadPage(idx) {
    const page = STORY.pages[idx];
    pageIndex = idx;
    pendingTappables = [];
    sprites.innerHTML = '';
    fx.innerHTML = '';
    disarmArrow();

    showScene(page.scene, !!page.crossfadeFrom);
    buildAtmosphere(page.scene);
    setCamera(page.camera, true);

    /* ---- objects ---- */
    const els = {};
    (page.objects || []).forEach(obj => {
      const el = makeSprite(obj);
      els[obj.id] = { el, obj };
      sprites.appendChild(el);
    });

    /* ---- generic taps ---- */
    (page.objects || []).forEach(obj => {
      const { el } = els[obj.id];
      if (!obj.tap) return;
      el.classList.add('tappable');
      if (obj.tap.effect !== 'hatch') pendingTappables.push(el);

      if (obj.tap.effect === 'wobble') {
        el.addEventListener('pointerdown', (e) => {
          playAnim(el, 'anim-wobble-sm');
          Sfx.wobble(1);
          sparkleBurst(e.clientX, e.clientY, obj.tap.sparkColor);
          pendingTappables = pendingTappables.filter(p => p !== el);
          resetIdleHint();
        });
      }

      if (obj.tap.effect === 'hatch') {
        let taps = 0;
        pendingTappables.push(el);
        el.addEventListener('pointerdown', (e) => {
          if (taps >= obj.tap.tapsNeeded) return;
          taps++;
          resetIdleHint();
          if (taps < obj.tap.tapsNeeded) {
            playAnim(el, taps === 1 ? 'anim-wobble-sm' : 'anim-wobble-lg');
            Sfx.wobble(taps);
            sparkleBurst(e.clientX, e.clientY, '#fff3b0');
          } else {
            // --- the big POP ---
            pendingTappables = pendingTappables.filter(p => p !== el);
            Sfx.crackPop();
            sparkleBurst(e.clientX, e.clientY, '#ffd94d');
            sparkleBurst(e.clientX + 20, e.clientY - 10, '#ffffff');
            playAnim(el, 'anim-crack', () => { el.style.display = 'none'; });

            const cat = els['caterpillar'];
            setTimeout(() => {
              cat.el.style.opacity = 1;
              playAnim(cat.el, 'anim-hatch', () => {
                cat.el.classList.add('anim-breathe');
              });
              Sfx.boing();
            }, 380);

            // camera pulls back, caption swaps, arrow enables
            setTimeout(() => {
              if (page.cameraAfter) setCamera(page.cameraAfter, false);
              if (page.afterText) narrate(page.afterText, armArrow);
              else armArrow();
              stage.dispatchEvent(new CustomEvent('storyevent', { detail: 'hatched' }));
            }, 1100);
          }
        });
      }
    });

    /* ---- hotspots (tappable regions on the background art) ---- */
    (page.hotspots || []).forEach(h => {
      const z = document.createElement('div');
      z.className = 'hotspot';
      Object.assign(z.style, h.rect);
      sprites.appendChild(z);
      z.addEventListener('pointerdown', (e) => {
        if (h.tap.effect === 'glow') glowAt(h.rect);
        if (h.tap.sound && Sfx[h.tap.sound]) Sfx[h.tap.sound]();
        sparkleBurst(e.clientX, e.clientY, h.tap.sparkColor);
        resetIdleHint();
      });
    });

    /* ---- narration + arrow condition ---- */
    const arrow = page.arrow || { when: 'narration' };
    narrate(page.text, () => {
      if (arrow.when === 'narration') armArrow();
    });
    resetIdleHint();
  }

  /* ================= Navigation ================= */

  function turnTo(idx) {
    stopNarration();
    Sfx.whoosh();
    turner.classList.remove('turning');
    void turner.offsetWidth;
    turner.classList.add('turning');

    world.classList.add('world-out');
    caption.classList.add('hidden');
    setTimeout(() => {
      world.classList.remove('world-out');
      world.classList.add('world-in');
      loadPage(idx);
      setTimeout(() => world.classList.remove('world-in'), 700);
    }, 430);
  }

  arrowBtn.addEventListener('click', () => {
    if (arrowBtn.disabled) return;
    Sfx.tap();
    const next = pageIndex + 1;
    if (next < STORY.pages.length) {
      turnTo(next);
    } else {
      // Last page of this batch: gentle loop back to the splash for now.
      stopNarration();
      splash.classList.remove('gone');
      caption.classList.add('hidden');
      arrowBtn.classList.add('hidden');
      pageIndex = -1;
    }
  });

  /* ================= Splash ================= */

  beginBtn.addEventListener('pointerdown', () => {
    Sfx.unlock();
    Sfx.tap();
  });
  beginBtn.addEventListener('click', () => {
    splash.classList.add('gone');
    setTimeout(() => turnTo(0), 250);
  });

  // audio unlock on any first touch
  window.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });

  /* ================= Service worker ================= */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
