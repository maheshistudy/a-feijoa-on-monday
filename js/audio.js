/* ==========================================================================
   Sound for Pip's Big Garden Munch
   - narrate(): plays assets/audio/<file>.mp3 when STORY.recordings is true,
     otherwise (or if the file is missing) uses the browser's built-in voice.
   - say():     short spoken line for a tapped object.
   - sfx():     synthesized sound effects (WebAudio) — no files needed.
   Everything is wrapped so that a missing feature never breaks the book.
   ========================================================================== */
const Sound = (() => {
  let ctx = null, current = null, voice = null;
  const cache = new Map();
  const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  function pickVoice() {
    if (!hasTTS) return null;
    const voices = speechSynthesis.getVoices() || [];
    const order = ['en-NZ', 'en-AU', 'en-GB', 'en-IE', 'en'];
    for (const lang of order) {
      const v = voices.find((v) => (v.lang || '').replace('_', '-').startsWith(lang) && !/male/i.test(v.name))
             || voices.find((v) => (v.lang || '').replace('_', '-').startsWith(lang));
      if (v) return v;
    }
    return voices[0] || null;
  }
  if (hasTTS) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };

  // Call inside a user gesture (the "Tap to begin" button). Never throws.
  async function unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !ctx) ctx = new AC();
      if (ctx && ctx.state === 'suspended') await ctx.resume();
    } catch (e) { ctx = null; }
    try {
      voice = pickVoice();
      if (hasTTS) speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
    } catch (e) {}
  }

  function stop() {
    try { if (current && current.pause) { current.pause(); current.currentTime = 0; } } catch (e) {}
    try { if (hasTTS) speechSynthesis.cancel(); } catch (e) {}
    current = null;
  }

  async function fileExists(url) {
    if (!(window.STORY && STORY.recordings)) return false;      // skip probing until you add MP3s
    if (cache.has(url)) return cache.get(url);
    try {
      const r = await fetch(url, { method: 'HEAD' });
      const ok = r.ok && /audio|octet/.test(r.headers.get('content-type') || '');
      cache.set(url, ok); return ok;
    } catch { cache.set(url, false); return false; }
  }

  async function narrate(text, file, onWord, onEnd) {
    stop();
    const words = text.split(/\s+/).length;

    if (file && await fileExists(`assets/audio/${file}.mp3`)) {
      const a = new window.Audio(`assets/audio/${file}.mp3`);
      current = a;
      a.addEventListener('loadedmetadata', () => {
        const per = (a.duration * 1000) / words;
        for (let i = 0; i < words; i++) setTimeout(() => { if (current === a) onWord && onWord(i); }, per * i);
      });
      a.addEventListener('ended', () => { if (current === a) { current = null; onEnd && onEnd(); } });
      a.play().catch(() => {});
      return;
    }

    if (!hasTTS) { fakeHighlight(words, onWord, onEnd); return; }
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 0.88; u.pitch = 1.08; u.lang = (voice && voice.lang) || 'en-NZ';
      let idx = 0;
      u.onboundary = (e) => { if (e.name === 'word') { onWord && onWord(idx); idx++; } };
      u.onend = () => { if (current === u) { current = null; onEnd && onEnd(); } };
      u.onerror = () => { if (current === u) { current = null; fakeHighlight(words, onWord, onEnd); } };
      current = u;
      speechSynthesis.speak(u);
      // Browsers without boundary events (Safari): timer-based highlighting
      setTimeout(() => { if (idx === 0 && current === u) fakeHighlight(words, onWord, null); }, 700);
    } catch (e) { fakeHighlight(words, onWord, onEnd); }
  }

  function fakeHighlight(words, onWord, onEnd) {
    const per = 340;
    for (let i = 0; i < words; i++) setTimeout(() => onWord && onWord(i), per * i);
    setTimeout(() => onEnd && onEnd(), per * words + 200);
  }

  async function say(text, file) {
    stop();
    if (file && await fileExists(`assets/audio/${file}.mp3`)) {
      const a = new window.Audio(`assets/audio/${file}.mp3`); current = a; a.play().catch(() => {}); return;
    }
    if (!hasTTS) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 0.9; u.pitch = 1.25; current = u;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---- Synthesized sound effects ------------------------------------ */
  function tone(freq, dur, type = 'sine', gain = .25, slideTo = null, when = 0) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .05);
    } catch (e) {}
  }
  function noise(dur, gain = .2, when = 0, filterHz = 1200) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterHz;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(ctx.destination); s.start(t);
    } catch (e) {}
  }
  const SFX = {
    tap:     () => tone(660, .08, 'triangle', .18, 880),
    pop:     () => { tone(300, .18, 'sine', .35, 900); noise(.08, .15, 0, 3000); },
    wobble:  () => { tone(220, .12, 'sine', .2, 180); tone(220, .12, 'sine', .2, 180, .14); tone(220, .12, 'sine', .2, 180, .28); },
    munch:   () => { noise(.12, .3, 0, 900); noise(.1, .22, .13, 700); },
    lick:    () => tone(400, .25, 'sine', .15, 700),
    yuck:    () => tone(320, .35, 'sawtooth', .12, 160),
    yum:     () => { tone(523, .12, 'triangle', .2); tone(659, .12, 'triangle', .2, null, .12); tone(784, .2, 'triangle', .22, null, .24); },
    ding:    () => tone(1046, .5, 'sine', .2),
    shimmer: () => { for (let i = 0; i < 6; i++) tone(1200 + i * 220, .18, 'sine', .08, null, i * .07); },
    whoosh:  () => noise(.5, .2, 0, 600),
    rumble:  () => { tone(70, .5, 'sawtooth', .18, 55); tone(70, .5, 'sawtooth', .18, 55, .5); },
    hum:     () => tone(196, .8, 'sine', .12),
    flutter: () => { for (let i = 0; i < 5; i++) noise(.06, .12, i * .12, 1500); },
    count:   () => tone(880, .12, 'triangle', .2),
    sneeze:  () => { tone(500, .08, 'square', .1, 700); noise(.25, .3, .1, 2500); },
  };
  function sfx(name) { try { (SFX[name] || SFX.tap)(); } catch (e) {} }

  return { unlock, narrate, say, sfx, stop };
})();
