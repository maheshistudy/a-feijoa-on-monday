/* ==========================================================================
   Storybook engine v2 — reads STORY (story.js) and runs the book.
   Edit story.js to change the book; this file rarely needs changes.
   ========================================================================== */
(() => {
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), world = $('#world'), bg = $('#bg'), decor = $('#decor'), pageEl = $('#page');
  const cap = $('#caption'), bubble = $('#bubble'), pagenum = $('#pagenum');
  const btnBack = $('#btn-back'), btnNext = $('#btn-next'), btnReplay = $('#btn-replay'), btnFull = $('#btn-full');
  const dots = $('#dots'), splash = $('#splash'), fx = $('#fx');

  let index = -1, state = null, hintTimer = null, uid = 0, cam = { zoom: 1, x: 50, y: 50 };

  /* ---------- Boot ------------------------------------------------------ */
  STORY.pages.forEach(() => dots.appendChild(document.createElement('i')));
  sprinkleStars($('.splash-stars'), 60, 'i');

  $('#btn-start').addEventListener('click', async () => {
    try { await Sound.unlock(); } catch (e) {}
    splash.classList.add('gone');
    go(0);
  });
  btnNext.addEventListener('click', () => go(STORY.pages[index].last ? 0 : index + 1));
  btnBack.addEventListener('click', () => go(index - 1));
  btnReplay.addEventListener('click', () => narrateCurrent());
  btnFull.addEventListener('click', () => {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) {}
  });
  document.addEventListener('keydown', (e) => {
    if (index < 0) return;
    if (e.key === 'ArrowRight' && !btnNext.classList.contains('locked')) btnNext.click();
    if (e.key === 'ArrowLeft') btnBack.click();
    if (e.key === ' ') { e.preventDefault(); narrateCurrent(); }
  });

  /* ---------- Navigation -------------------------------------------------- */
  function go(n) {
    if (n < 0 || n >= STORY.pages.length) return;
    Sound.stop(); clearTimeout(hintTimer);
    bubble.classList.remove('show');
    const leaving = index >= 0;
    pageEl.classList.add('leaving');
    cap.style.opacity = 0; cap.style.animation = 'none';

    setTimeout(() => {
      index = n;
      const page = STORY.pages[n];
      state = { hits: {}, completed: 0, done: page.task === 0 };

      setBackground(page.bg);
      setCamera(page.cam || { zoom: 1, x: 50, y: 50 });
      setDecor(page.bg);

      pageEl.classList.remove('leaving');
      pageEl.innerHTML = '';
      page.items.forEach((item) => pageEl.appendChild(renderItem(item)));

      setCaption(page.text);
      narrateCurrent();

      btnBack.classList.toggle('hidden', n === 0);
      btnNext.classList.toggle('locked', !state.done);
      btnNext.title = page.last ? 'Read it again' : 'Next';
      pagenum.textContent = n + 1;
      [...dots.children].forEach((d, i) => { d.classList.toggle('on', i === n); d.classList.toggle('seen', i < n); });
      scheduleHint();
    }, leaving ? 450 : 0);
  }

  function setBackground(kind) {
    if (bg.classList.contains(kind)) return;
    if (!/night|day/.test(bg.className)) { bg.className = `bg ${kind}`; return; }
    bg.style.setProperty('--next-bg', `url("assets/img/scene-${kind}.jpg")`);
    bg.classList.add('fading');
    setTimeout(() => { bg.className = `bg ${kind}`; bg.style.removeProperty('--next-bg'); }, 1450);
  }

  // The camera zooms the whole drawing (and everything on it) toward a point.
  function setCamera(c) {
    cam = c;
    world.style.setProperty('--zoom', c.zoom);
    world.style.setProperty('--cx', c.x + '%');
    world.style.setProperty('--cy', c.y + '%');
  }
  // Drawing coordinates -> screen coordinates (for the speech bubble)
  function toScreen(x, y) {
    return { x: cam.x + (x - cam.x) * cam.zoom, y: cam.y + (y - cam.y) * cam.zoom };
  }

  /* ---------- Atmosphere ------------------------------------------------- */
  function setDecor(kind) {
    if (decor.dataset.kind === kind) return;
    decor.dataset.kind = kind; decor.innerHTML = '';
    if (kind === 'night') {
      const g = document.createElement('div'); g.className = 'moonglow'; decor.appendChild(g);
      sprinkleStars(decor, 70, 'i', 'star', 0, 30);          // only in the sky, above the hills
      for (let i = 0; i < 7; i++) {
        const f = document.createElement('i'); f.className = 'firefly';
        f.style.left = 15 + Math.random() * 70 + '%'; f.style.top = 50 + Math.random() * 30 + '%';
        f.style.setProperty('--d', 7 + Math.random() * 6 + 's'); f.style.animationDelay = -Math.random() * 8 + 's';
        decor.appendChild(f);
      }
    } else {
      const r = document.createElement('div'); r.className = 'rays'; decor.appendChild(r);
      const g = document.createElement('div'); g.className = 'sunglow'; decor.appendChild(g);
      [[4, 8, 95, .9], [22, 22, 140, .7], [66, 6, 120, 1.1]].forEach(([left, top, dur, size], i) => {
        const c = document.createElement('div'); c.className = 'cloud';
        c.style.left = left + '%'; c.style.top = top + '%'; c.style.width = 12 * size + '%';
        c.style.setProperty('--d', dur + 's'); c.style.animationDelay = -(i * 37) + 's';
        c.innerHTML = SHAPES.cloud; decor.appendChild(c);
      });
    }
  }
  function sprinkleStars(parent, n, tag, cls = '', top0 = 0, top1 = 100) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement(tag); if (cls) s.className = cls + (Math.random() < .15 ? ' big' : '');
      s.style.left = Math.random() * 100 + '%'; s.style.top = top0 + Math.random() * (top1 - top0) + '%';
      s.style.animationDelay = -Math.random() * 3 + 's'; s.style.animationDuration = 1.8 + Math.random() * 2 + 's';
      parent.appendChild(s);
    }
  }

  /* ---------- Objects ------------------------------------------------------ */
  function renderItem(item) {
    const el = document.createElement('div');
    el.className = 'obj' + (item.tap ? ' tap' : '') + (item.idle ? ` idle-${item.idle}` : '') + (item.flip ? ' flip' : '');
    el.dataset.id = item.id;
    el.style.left = item.x + '%'; el.style.top = item.y + '%'; el.style.width = item.w + '%';
    if (item.kind === 'img') {
      const img = document.createElement('img'); img.src = item.src; img.alt = ''; img.draggable = false; el.appendChild(img);
    } else {
      el.innerHTML = SHAPES[item.shape].replace(/__ID__/g, `${item.id}-${uid++}`);
    }
    if (item.tap) el.addEventListener('pointerdown', (e) => onTap(item, el, e), { passive: true });
    return el;
  }

  function onTap(item, el, e) {
    const t = item.tap;
    clearTimeout(hintTimer); scheduleHint();
    sparkle(e.clientX, e.clientY);

    animate(el, t.anim);
    Sound.sfx(t.sfx || 'tap');
    if (t.bite) el.classList.add('bitten');
    if (t.grow) el.style.setProperty('--s', (parseFloat(el.style.getPropertyValue('--s') || 1) * t.grow).toFixed(3));
    if (t.fly) { el.classList.remove('idle-flap'); el.classList.add('anim-fly'); }
    if (t.say) setTimeout(() => Sound.say(t.say, t.sayFile), 120);
    if (t.then) setTimeout(() => Sound.sfx(t.then), 650);

    const hits = (state.hits[item.id] = (state.hits[item.id] || 0) + 1);

    // Pip lunges at the food, and the reaction bubble appears above Pip
    let speaker = item;
    if (t.lunge) {
      const other = pageEl.querySelector(`[data-id="${t.lunge}"]`);
      const otherItem = STORY.pages[index].items.find((i) => i.id === t.lunge);
      if (other) { animate(other, 'lunge'); speaker = otherItem || item; }
    }
    if (t.react) {
      const text = Array.isArray(t.react) ? t.react[Math.min(hits, t.react.length) - 1] : t.react;
      setTimeout(() => showBubble(text, speaker), t.lunge ? 250 : 60);
    }

    const need = t.count || 1;
    if (t.required && hits === need) {
      state.completed++;
      if (t.onComplete === 'hatch') hatch(el, item);
      if (state.completed >= STORY.pages[index].task) completePage();
    }
  }

  function animate(el, name) {
    if (!name) return;
    const cls = `anim-${name}`;
    el.classList.remove(cls); void el.offsetWidth;
    el.classList.add(cls);
    el.firstElementChild.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  function showBubble(text, item) {
    const s = toScreen(item.x + item.w * 0.15, item.y - item.w * 0.32);
    bubble.textContent = text;
    bubble.style.setProperty('--bx', Math.min(80, Math.max(15, s.x)) + '%');
    bubble.style.setProperty('--by', Math.max(12, s.y) + '%');
    bubble.classList.remove('show'); void bubble.offsetWidth; bubble.classList.add('show');
  }

  function hatch(eggEl, item) {
    Sound.sfx('pop');
    const s = toScreen(item.x, item.y); burst(s.x, s.y, 18);
    eggEl.classList.remove('tap'); eggEl.classList.add('anim-gone');
    const pip = renderItem({ id: 'pip', kind: 'img', src: 'assets/img/caterpillar.png', x: item.x + 4, y: item.y - 2, w: 18, idle: 'breathe',
      tap: { anim: 'wiggle', sfx: 'tap', say: "Hello! I'm Pip.", react: "Hi, I'm Pip!" } });
    pip.style.animation = 'none'; pip.style.opacity = 1; pip.classList.add('anim-hatch');
    setTimeout(() => pageEl.appendChild(pip), 350);
  }

  function completePage() {
    const page = STORY.pages[index];
    state.done = true;
    setTimeout(() => {
      btnNext.classList.remove('locked');
      Sound.sfx('ding');
      if (page.after) { setCaption(page.after); narrate(page.after, page.afterAudio); }
    }, 1000);
  }

  /* ---------- Caption + narration ----------------------------------------- */
  function setCaption(text) {
    cap.innerHTML = text.split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    cap.style.opacity = ''; cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = '';
  }
  function narrateCurrent() {
    const page = STORY.pages[index];
    const useAfter = state.done && page.after && cap.textContent.trim().startsWith(page.after.split(' ')[0]);
    narrate(useAfter ? page.after : page.text, useAfter ? page.afterAudio : page.audio);
  }
  function narrate(text, file) {
    const words = [...cap.querySelectorAll('.w')];
    words.forEach((w) => w.classList.remove('on', 'done'));
    Sound.narrate(text, file,
      (i) => words.forEach((w, k) => { w.classList.toggle('on', k === i); w.classList.toggle('done', k < i); }),
      () => words.forEach((w) => w.classList.remove('on', 'done')));
  }

  /* ---------- Feedback ------------------------------------------------------ */
  function sparkle(cx, cy) {
    const r = stage.getBoundingClientRect();
    burst(((cx - r.left) / r.width) * 100, ((cy - r.top) / r.height) * 100, 8);
  }
  function burst(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      const a = (i / n) * Math.PI * 2, d = 5 + Math.random() * 7;
      s.style.left = x + '%'; s.style.top = y + '%';
      s.style.setProperty('--dx', `${Math.cos(a) * d}cqw`); s.style.setProperty('--dy', `${Math.sin(a) * d}cqw`);
      fx.appendChild(s); setTimeout(() => s.remove(), 800);
    }
  }
  function scheduleHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      pageEl.querySelectorAll('.obj.tap').forEach((el, i) => setTimeout(() => {
        el.classList.add('hint');
        el.firstElementChild.addEventListener('animationend', () => el.classList.remove('hint'), { once: true });
      }, i * 250));
      scheduleHint();
    }, 6000);
  }
})();
