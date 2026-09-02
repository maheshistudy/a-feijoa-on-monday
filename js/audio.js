/* ============================================================
   audio.js — synthesized sound effects (no audio files needed)
   All sounds are built from oscillators + filtered noise.
   ============================================================ */

const Sfx = (() => {
  let ctx = null;
  let master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
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

  function noiseBurst(t0, dur, peak = 0.3, filterFreq = 2000, type = 'bandpass') {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = 0.8;
    const g = ctx.createGain();
    env(g, t0, 0.005, peak, dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /* -------- public sounds -------- */

  // soft ui tap
  function tap() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 660, t, 0.09, 0.25, 520);
  }

  // sparkle burst chime
  function sparkle() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [1240, 1660, 2090, 2480].forEach((f, i) =>
      osc('sine', f, t + i * 0.045, 0.22, 0.12, f * 1.15));
  }

  // egg wobble — rubbery low warble
  function wobble(intensity = 1) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
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

  // POP! crack — noise snap + pitch drop
  function crackPop() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    noiseBurst(t, 0.09, 0.5, 3400, 'highpass');
    osc('square', 520, t + 0.01, 0.12, 0.28, 90);
    osc('sine', 900, t + 0.02, 0.3, 0.3, 180);
    noiseBurst(t + 0.06, 0.25, 0.14, 900, 'bandpass');
  }

  // springy bounce for the hatch landing
  function boing() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(360, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.24);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.38);
    env(g, t, 0.01, 0.35, 0.5);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.55);
  }

  // moon / sun shimmer — soft rising glissando cluster
  function shimmer() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      osc('sine', f, t + i * 0.07, 0.6, 0.09, f * 1.06));
    noiseBurst(t, 0.7, 0.05, 6000, 'highpass');
  }

  // page turn whoosh
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
    env(g, t, 0.08, 0.32, 0.52);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.7);
  }

  // arrow-ready ding
  function chime() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    osc('sine', 880, t, 0.5, 0.16, 880);
    osc('sine', 1318, t + 0.09, 0.55, 0.12, 1318);
  }

  // munch (ready for the eating pages)
  function munch() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    noiseBurst(t, 0.07, 0.4, 1200, 'bandpass');
    noiseBurst(t + 0.11, 0.07, 0.35, 900, 'bandpass');
    osc('triangle', 200, t, 0.08, 0.2, 120);
  }

  // unlock/resume on first user gesture
  function unlock() { ensure(); }

  return { tap, sparkle, wobble, crackPop, boing, shimmer, whoosh, chime, munch, unlock };
})();
