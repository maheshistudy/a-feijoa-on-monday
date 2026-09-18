/* analyze-audio.js — derive per-word timings from a narration recording.

   Runs inside headless Edge, driven by tools/build-assets.ps1, which wraps it in a
   page that sets window.JOBS = [{ id, b64 (the MP3), words: [...] }, ...].

   Method (see content/project-info/v2-plan.md §6):
     1. decode the MP3, mix to mono
     2. short-time RMS (25 ms window, 10 ms hop), lightly smoothed, in dB
     3. adaptive threshold between the noise floor and the peak → speech / pause frames
     4. segments = speech runs (short gaps bridged, tiny blips dropped)
     5. words are laid along *speech time* (pauses don't count) in proportion to a
        weight (syllables + a little for length), so long words get longer spans
     6. word boundaries near a pause snap to it — punctuation strongly prefers a pause
     7. the first word starts with the first sound, the last ends with the last

   Output: window.RESULT = { id: { duration, words: [[start,end],...], segments, env (png data url) } }
   and a base64 copy in <pre id="result"> for the caller to read out of the DOM. */

(() => {
  const HOP = 0.010, WIN = 0.025;

  function decodeBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function envelope(buf) {
    const sr = buf.sampleRate, n = buf.length;
    const mono = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels;
    }
    const hop = Math.round(sr * HOP), win = Math.round(sr * WIN);
    const frames = Math.max(1, Math.floor((n - win) / hop) + 1);
    const rms = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let s = 0; const o = f * hop;
      for (let i = 0; i < win; i++) { const v = mono[o + i]; s += v * v; }
      rms[f] = Math.sqrt(s / win);
    }
    const db = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let s = 0, k = 0;
      for (let j = -2; j <= 2; j++) { const q = f + j; if (q >= 0 && q < frames) { s += rms[q]; k++; } }
      db[f] = 20 * Math.log10(s / k + 1e-6);
    }
    return { db, frames, duration: buf.duration };
  }

  function percentile(arr, p) {
    const a = Array.from(arr).sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
  }

  function segmentsOf(db, frames) {
    const floor = percentile(db, 0.12), peak = percentile(db, 0.985);
    const thresh = Math.max(floor + 9, floor + 0.32 * (peak - floor));
    const speech = new Uint8Array(frames);
    for (let f = 0; f < frames; f++) speech[f] = db[f] > thresh ? 1 : 0;
    let segs = [];
    let s = -1;
    for (let f = 0; f <= frames; f++) {
      const on = f < frames && speech[f];
      if (on && s < 0) s = f;
      if (!on && s >= 0) { segs.push([s, f]); s = -1; }
    }
    // bridge short gaps (stops, breaths inside a word), then drop blips
    const merged = [];
    for (const sg of segs) {
      if (merged.length && sg[0] - merged[merged.length - 1][1] < 0.16 / HOP) merged[merged.length - 1][1] = sg[1];
      else merged.push(sg.slice());
    }
    segs = merged.filter(sg => sg[1] - sg[0] >= 0.06 / HOP);
    return { segs, thresh, floor, peak };
  }

  function weight(word) {
    const w = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return 0.6;
    let syl = (w.match(/[aeiouy]+/g) || []).length;
    if (/e$/.test(w) && syl > 1 && !/(le|ee|ye)$/.test(w)) syl--;   // silent e
    syl = Math.max(1, syl);
    return syl + 0.35 + 0.06 * w.length;
  }

  function timings(job, env, seg) {
    const { frames } = env;
    const { segs } = seg;
    const words = job.words;
    if (!words.length || !segs.length) return words.map(() => [0, env.duration]);
    // cumulative speech time per frame
    const inSpeech = new Uint8Array(frames);
    for (const [a, b] of segs) for (let f = a; f < b; f++) inSpeech[f] = 1;
    const cum = new Float32Array(frames + 1);
    for (let f = 0; f < frames; f++) cum[f + 1] = cum[f] + inSpeech[f];
    const total = cum[frames];
    const frameAt = (speechFrames) => {   // first frame where cumulative speech reaches the target
      let lo = 0, hi = frames;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < speechFrames) lo = m + 1; else hi = m; }
      return Math.min(frames - 1, lo);
    };
    const ws = words.map(weight), W = ws.reduce((a, b) => a + b, 0);
    const bounds = [];        // frame index of the start of each word, plus the end
    let acc = 0;
    for (let k = 0; k < words.length; k++) { bounds.push(frameAt(acc / W * total)); acc += ws[k]; }
    bounds.push(segs[segs.length - 1][1]);
    bounds[0] = segs[0][0];
    // pauses between segments: [end of seg j, start of seg j+1]
    const pauses = [];
    for (let j = 0; j + 1 < segs.length; j++) pauses.push({ e: segs[j][1], s: segs[j + 1][0], used: false });
    const out = words.map(() => [0, 0]);
    const ends = words.map((_, k) => bounds[k + 1]);   // end frame of word k (defaults to the next start)
    const snapped = words.map(() => false);
    for (let k = 0; k + 1 < words.length; k++) {
      const b = bounds[k + 1];
      const punct = /[,.!?;:]$/.test(words[k]);
      const near = punct ? 0.45 / HOP : 0.22 / HOP;
      let best = null, bestD = Infinity;
      for (const p of pauses) {
        if (p.used) continue;
        // distance from the boundary to the pause: zero when it already falls inside the pause
        let d = b < p.e ? p.e - b : (b > p.s ? b - p.s : 0);
        if (punct && p.e >= b - 0.1 / HOP) d *= 0.6;   // a comma or full stop "wants" the pause after it
        if (d < near && d < bestD) { best = p; bestD = d; }
      }
      if (best) { best.used = true; ends[k] = best.e; bounds[k + 1] = best.s; snapped[k] = true; }
    }
    for (let k = 0; k < words.length; k++) {
      const s = bounds[k];
      let e = snapped[k] ? ends[k] : bounds[k + 1];
      if (e <= s) e = s + 1;
      out[k] = [s * HOP, e * HOP];
    }
    // keep every word inside the recording, monotonic, and at least 30 ms long
    const MIN = 0.03;
    let end = env.duration;
    for (let k = out.length - 1; k >= 0; k--) {
      out[k][1] = Math.min(out[k][1], end);
      out[k][0] = Math.min(out[k][0], out[k][1] - MIN);
      end = out[k][0];
    }
    let start = 0;
    for (let k = 0; k < out.length; k++) {
      out[k][0] = Math.max(out[k][0], start);
      out[k][1] = Math.max(out[k][1], out[k][0] + MIN);
      start = out[k][1];
    }
    return out.map(([s, e]) => [Math.round(s * 1000) / 1000, Math.round(e * 1000) / 1000]);
  }

  function draw(job, env, seg, words) {
    const W = 1400, H = 220;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const { db, frames, duration } = env;
    const lo = seg.floor - 6, hi = seg.peak + 3;
    const x = (f) => f / frames * W;
    const y = (v) => H - 30 - (v - lo) / (hi - lo) * (H - 60);
    g.fillStyle = '#cfe8cf';
    for (const [a, b] of seg.segs) g.fillRect(x(a), 20, x(b) - x(a), H - 50);
    g.strokeStyle = '#345'; g.beginPath();
    for (let f = 0; f < frames; f++) { const px = x(f), py = y(db[f]); if (f === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
    g.strokeStyle = '#e88'; g.beginPath(); g.moveTo(0, y(seg.thresh)); g.lineTo(W, y(seg.thresh)); g.stroke();
    g.font = '11px sans-serif'; g.textAlign = 'left';
    words.forEach(([s, e], k) => {
      const xs = s / duration * W, xe = e / duration * W;
      g.fillStyle = k % 2 ? 'rgba(255,200,0,.25)' : 'rgba(0,120,255,.18)';
      g.fillRect(xs, H - 28, xe - xs, 26);
      g.fillStyle = '#000';
      g.save(); g.translate(xs + 2, H - 4); g.rotate(-Math.PI / 2); g.fillText(job.words[k], 0, 0); g.restore();
      g.strokeStyle = '#c00'; g.beginPath(); g.moveTo(xs, 10); g.lineTo(xs, H - 30); g.stroke();
    });
    g.fillStyle = '#000'; g.fillText(job.id + '  ' + duration.toFixed(2) + 's  ' + words.length + ' words, ' + seg.segs.length + ' segments', 6, 12);
    return c.toDataURL('image/png');
  }

  async function run() {
    const result = {};
    for (const job of window.JOBS) {
      try {
        const ctx = new OfflineAudioContext(1, 44100, 44100);
        const buf = await ctx.decodeAudioData(decodeBase64(job.b64));
        const env = envelope(buf);
        const seg = segmentsOf(env.db, env.frames);
        const words = job.words.length ? timings(job, env, seg) : [];
        result[job.id] = {
          duration: Math.round(buf.duration * 1000) / 1000,
          words,
          segments: seg.segs.map(([a, b]) => [Math.round(a * HOP * 1000) / 1000, Math.round(b * HOP * 1000) / 1000]),
          env: job.words.length ? draw(job, env, seg, words) : null
        };
      } catch (err) {
        result[job.id] = { error: String(err) };
      }
    }
    window.RESULT = result;
    const json = JSON.stringify(result);
    document.getElementById('result').textContent = btoa(unescape(encodeURIComponent(json)));
    document.title = 'ANALYSIS DONE';
  }

  // keep the virtual clock ticking while decoding happens off the main thread
  const tick = setInterval(() => { if (document.title === 'ANALYSIS DONE') clearInterval(tick); }, 50);
  window.addEventListener('load', run);
})();
