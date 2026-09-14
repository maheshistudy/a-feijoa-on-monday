/* ============================================================
   audio.js — synthesized sound effects (no audio files needed)
   All sounds are built from oscillators + filtered noise, tuned
   to be soft and playful for small ears.
   ============================================================ */

const Sfx = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(gainNode, t0, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function osc(type, freq, t0, dur, peak = 0.4, freqEnd = null, dest = null) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    env(g, t0, 0.008, peak, dur);
    o.connect(g).connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(t0, dur, peak = 0.3, filterFreq = 2000, type = 'bandpass', q = 0.8) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = ctx.createGain();
    env(g, t0, 0.005, peak, dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /* -------- public sounds -------- */

  function tap() {
    if (!ensure()) return;
    osc('sine', 660, ctx.currentTime, 0.09, 0.25, 520);
  }

  function sparkle() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [1240, 1660, 2090, 2480].forEach((f, i) => osc('sine', f, t + i * 0.045, 0.22, 0.1, f * 1.15));
  }

  // soft rubbery egg wobble
  function wobble(intensity = 1) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 150 + 40 * intensity;
    lfo.type = 'sine'; lfo.frequency.value = 9 + 3 * intensity;
    lfoG.gain.value = 32 * intensity;
    lfo.connect(lfoG).connect(o.frequency);
    env(g, t, 0.015, 0.3, 0.5);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.6);
    lfo.start(t); lfo.stop(t + 0.6);
  }

  // little rubber-ball bounce
  function bounce() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 300, t, 0.14, 0.32, 140);
    osc('sine', 420, t + 0.16, 0.1, 0.18, 220);
  }

  // POP! crack — noise snap + pitch drop
  function crackPop() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    noiseBurst(t, 0.09, 0.5, 3400, 'highpass');
    osc('square', 520, t + 0.01, 0.12, 0.25, 90);
    osc('sine', 900, t + 0.02, 0.3, 0.3, 180);
    noiseBurst(t + 0.06, 0.25, 0.14, 900, 'bandpass');
  }

  function pop() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 700, t, 0.12, 0.3, 260);
    noiseBurst(t, 0.04, 0.2, 2500, 'highpass');
  }

  // springy boing for hatching / landing
  function boing() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(360, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.24);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.38);
    env(g, t, 0.01, 0.35, 0.5);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.55);
  }

  // moon / sun shimmer
  function shimmer() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046, 1318].forEach((f, i) => osc('sine', f, t + i * 0.07, 0.6, 0.09, f * 1.06));
    noiseBurst(t, 0.7, 0.05, 6000, 'highpass');
  }

  // page turn
  function whoosh() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.6);
    const g = ctx.createGain();
    env(g, t, 0.08, 0.3, 0.52);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.7);
  }

  // arrow-ready ding
  function chime() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 880, t, 0.5, 0.16, 880);
    osc('sine', 1318, t + 0.09, 0.55, 0.12, 1318);
    osc('sine', 1760, t + 0.18, 0.6, 0.08, 1760);
  }

  // munch — two crunchy bites, pitch varies a little each time
  function munch() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const v = 0.85 + Math.random() * 0.3;
    noiseBurst(t, 0.07, 0.42, 1200 * v, 'bandpass');
    noiseBurst(t + 0.12, 0.07, 0.36, 900 * v, 'bandpass');
    osc('triangle', 210 * v, t, 0.08, 0.2, 120);
    osc('triangle', 180 * v, t + 0.12, 0.08, 0.16, 100);
  }

  // yum! — cheerful rising two-note
  function yum() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 520, t, 0.18, 0.22, 660);
    osc('sine', 780, t + 0.14, 0.32, 0.2, 990);
  }

  // fantail — quick bright chirps
  function chirp() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const pattern = [[0, 3200, 4200, 0.07], [0.11, 3600, 2600, 0.08], [0.24, 3000, 4400, 0.06],
                     [0.33, 3800, 2800, 0.07], [0.55, 3400, 4600, 0.06], [0.64, 4200, 3000, 0.09]];
    pattern.forEach(([d, f0, f1, dur]) => osc('sine', f0, t + d, dur, 0.09, f1));
  }

  // tummy gurgle
  function gurgle() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const d = i * 0.13;
      osc('sine', 120 + i * 18, t + d, 0.11, 0.22, 80 + i * 10);
      noiseBurst(t + d, 0.09, 0.05, 400, 'lowpass');
    }
    osc('triangle', 90, t + 0.8, 0.35, 0.15, 60);
  }

  // hush — soft breathy sigh for the cocoon
  function hush() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    noiseBurst(t, 1.2, 0.08, 1400, 'lowpass', 0.5);
    osc('sine', 330, t, 1.1, 0.06, 262);
    osc('sine', 262, t + 0.6, 0.9, 0.05, 220);
  }

  // rising slide — growing big
  function grow() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 220, t, 0.7, 0.22, 660);
    osc('triangle', 110, t, 0.7, 0.1, 330);
    [880, 1100, 1320].forEach((f, i) => osc('sine', f, t + 0.55 + i * 0.07, 0.35, 0.1, f));
  }

  // wing flutter — rapid soft puffs
  function flutter(n = 6) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < n; i++) noiseBurst(t + i * 0.09, 0.05, 0.12, 1800 - i * 60, 'bandpass', 0.6);
  }

  // glitter — a run of tiny bells
  function glitter() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [1568, 1976, 2349, 2637, 3136, 2349, 3520].forEach((f, i) => osc('sine', f, t + i * 0.06, 0.28, 0.07, f * 1.02));
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
  }

  function unlock() { ensure(); }

  return { tap, sparkle, wobble, bounce, crackPop, pop, boing, shimmer, whoosh, chime,
           munch, yum, chirp, gurgle, hush, grow, flutter, glitter, setMuted, unlock };
})();
