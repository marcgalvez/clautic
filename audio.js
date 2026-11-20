/* SOLC · motor de so. Genera en directe un tema per a cada disc amb Web Audio:
   guitarra distorsionada, baix, bateria i soroll de vinil. Cada disc sona diferent
   (tempo, to, progressió i ritme surten del nom del disc i del gènere). */
(() => {
  "use strict";

  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const KEYS = ["Do", "Do#", "Re", "Mi♭", "Mi", "Fa", "Fa#", "Sol", "La♭", "La", "Si♭", "Si"];

  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  /* ---- patrons de bateria (graella de corxeres, 8 passos per compàs) ---- */
  const BEATS = {
    rock:  { k: [0, 3, 4],       s: [2, 6],       h: [0, 1, 2, 3, 4, 5, 6, 7] },
    punk:  { k: [0, 4, 5],       s: [2, 6],       h: [0, 1, 2, 3, 4, 5, 6, 7] },
    skank: { k: [0, 2, 4, 6],    s: [1, 3, 5, 7], h: [] },
    four:  { k: [0, 2, 4, 6],    s: [2, 6],       h: [1, 3, 5, 7], open: true },
    half:  { k: [0, 1],          s: [4],          h: [0, 2, 4, 6] }
  };

  /* ---- progressions (semitons des de la tònica) ---- */
  const PROGS = {
    major: [[0, 5, 7, 5], [0, 7, 5, 7], [0, -2, 5, 0], [0, 5, 0, 7], [0, 7, 9, 5], [5, 7, 0, 0]],
    minor: [[0, 3, 5, 5], [0, 8, 10, 0], [0, 10, 8, 7], [0, 3, 10, 5], [0, 0, 8, 10], [0, 5, 3, 10]]
  };

  /* ---- personalitat de cada gènere ---- */
  const GENRES = {
    "Punk":      { bpm: [168, 196], scale: "major", drive: 7,  verse: ["punk", "mute"],  chorus: ["punk", "open"],    bass: "eighths" },
    "Hardcore":  { bpm: [188, 218], scale: "minor", drive: 9,  verse: ["skank", "open"], chorus: ["punk", "open"],    bass: "eighths" },
    "Oi!":       { bpm: [140, 160], scale: "major", drive: 6,  verse: ["rock", "mute"],  chorus: ["rock", "open"],    bass: "eighths" },
    "Garage":    { bpm: [134, 158], scale: "major", drive: 4,  verse: ["rock", "open"],  chorus: ["punk", "sustain"], bass: "walk" },
    "Rock":      { bpm: [116, 138], scale: "major", drive: 5,  verse: ["rock", "mute"],  chorus: ["rock", "sustain"], bass: "eighths" },
    "Grunge":    { bpm: [94, 114],  scale: "minor", drive: 10, verse: ["half", "none"],  chorus: ["rock", "sustain"], bass: "walk" },
    "Post-punk": { bpm: [128, 152], scale: "minor", drive: 0,  verse: ["four", "arp"],   chorus: ["four", "arpHi"],   bass: "melodic" }
  };

  let ctx, master, analyser, noiseBuf, crackleSrc, timer, song, nextTime, step;
  let distIn, cleanIn;

  function distCurve(amount) {
    const n = 2048, c = new Float32Array(n), k = amount * 12;
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    master = ctx.createGain(); master.gain.value = 0;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .7;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /* cadena de guitarra: distorsionada (amb "pantalla") o neta amb eco */
  function buildBuses(g) {
    distIn = ctx.createGain(); distIn.gain.value = 1;
    const shaper = ctx.createWaveShaper(); shaper.curve = distCurve(g.drive); shaper.oversample = "4x";
    const cab = ctx.createBiquadFilter(); cab.type = "lowpass"; cab.frequency.value = 4200; cab.Q.value = .9;
    const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 900; mid.gain.value = -4;
    const out = ctx.createGain(); out.gain.value = g.drive ? .2 : .32;
    distIn.connect(shaper); shaper.connect(cab); cab.connect(mid); mid.connect(out); out.connect(master);

    cleanIn = ctx.createGain(); cleanIn.gain.value = .55;
    const delay = ctx.createDelay(1); delay.delayTime.value = (60 / song.bpm) * .75;
    const fb = ctx.createGain(); fb.gain.value = .38;
    const wet = ctx.createGain(); wet.gain.value = .45;
    cleanIn.connect(master); cleanIn.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    song.nodes = [distIn, shaper, cab, mid, out, cleanIn, delay, fb, wet];
  }

  /* ---------------- instruments ---------------- */
  function noise(t, dur, type, freq, vol, q = .8) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * .5); src.stop(t + dur + .05);
  }
  function kick(t, vol = .9) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .35);
  }
  function snare(t, vol = .5) {
    noise(t, .18, "highpass", 1200, vol);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + .08);
    g.gain.setValueAtTime(vol * .7, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .12);
  }
  const hat = (t, open) => noise(t, open ? .16 : .035, "highpass", 7500, open ? .12 : .09);
  const crash = (t) => noise(t, 1.4, "highpass", 4500, .2, .4);

  function guitar(t, root, dur, { notes = [0, 7, 12], cutoff = 3500, vol = .5, clean = false } = {}) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .004);
    g.gain.setTargetAtTime(vol * .55, t + .02, Math.max(.05, dur * .4));
    g.gain.setTargetAtTime(0, t + dur, .025);
    f.connect(g); g.connect(clean ? cleanIn : distIn);
    for (const n of notes) for (const det of clean ? [0] : [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = clean ? "triangle" : "sawtooth";
      o.frequency.value = NOTE(root + n); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + .2);
    }
  }
  function bass(t, midi, dur, vol = .32) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = NOTE(midi);
    f.type = "lowpass"; f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t + dur * .9, .02);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .1);
  }

  /* agulla al disc: cop sord + espetecs que continuen tota l'estona */
  function startCrackle(t) {
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * .012;
      if (Math.random() < .0007) d[i] += (Math.random() * 2 - 1) * .9;
    }
    crackleSrc = ctx.createBufferSource(); crackleSrc.buffer = buf; crackleSrc.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = .5;
    const g = ctx.createGain(); g.gain.value = .5;
    crackleSrc.connect(f); f.connect(g); g.connect(master); crackleSrc.start(t);
    kick(t, .5);
  }

  /* ---------------- composició ---------------- */
  function compose(rec) {
    const r = rng(hash(`${rec.artist}|${rec.title}`));
    const g = GENRES[rec.genre] || GENRES.Punk;
    const bpm = Math.round(g.bpm[0] + r() * (g.bpm[1] - g.bpm[0]));
    const key = 40 + Math.floor(r() * 8); // de Mi2 a Si2: on viuen els power chords
    const verse = pick(r, PROGS[g.scale]);
    let chorus = pick(r, PROGS[g.scale]);
    if (chorus === verse) chorus = PROGS[g.scale][(PROGS[g.scale].indexOf(verse) + 1) % PROGS[g.scale].length];
    const sec = (name, prog, [beat, gtr], bars, extra = {}) => ({ name, prog, beat, gtr, bars, ...extra });
    const intro = sec("intro", verse, ["none", g.drive ? "mute" : "arp"], 2);
    const V = sec("verse", verse, g.verse, 8);
    const C = sec("chorus", chorus, g.chorus, 8, { crash: true });
    const B = sec("break", verse, ["half", "none"], 4);
    const loop = [V, C, V, C, B, C];
    return { g, bpm, key, keyName: KEYS[key % 12], stepDur: 60 / bpm / 2, intro, loop, swing: rec.genre === "Garage" ? .08 : 0 };
  }

  function sectionAt(bar) {
    if (bar < song.intro.bars) return { s: song.intro, b: bar };
    let x = (bar - song.intro.bars) % song.loop.reduce((n, s) => n + s.bars, 0);
    for (const s of song.loop) { if (x < s.bars) return { s, b: x }; x -= s.bars; }
  }

  function scheduleStep(i, t) {
    const bar = Math.floor(i / 8), st = i % 8;
    const { s, b } = sectionAt(bar);
    const lastBar = b === s.bars - 1;
    let root = song.key + s.prog[b % s.prog.length];
    while (root > 50) root -= 12;
    while (root < 38) root += 12;
    const sd = song.stepDur;
    if (st % 2 === 1) t += song.swing * sd;

    // bateria
    if (s.beat !== "none") {
      const p = BEATS[s.beat];
      const fill = lastBar && st >= 4;
      if (b === 0 && st === 0 && s.crash) crash(t);
      if (fill) { snare(t, .32 + (st - 4) * .07); if (st === 4) kick(t); }
      else {
        if (p.k.includes(st)) kick(t);
        if (p.s.includes(st)) snare(t);
        if (p.h.includes(st)) hat(t, p.open && st % 2 === 1);
      }
    } else if (s.name === "intro" && lastBar && st >= 4) {
      snare(t, .25 + (st - 4) * .08); // compte d'entrada
    }

    // guitarra
    const mode = s.gtr;
    if (mode === "mute") guitar(t, root, sd * .55, { notes: [0, 7], cutoff: 1300, vol: .55 });
    else if (mode === "open") guitar(t, root, sd * .92, { notes: [0, 7, 12], cutoff: 3800, vol: .62 });
    else if (mode === "sustain" && st === 0) guitar(t, root, sd * 7.6, { notes: [0, 7, 12], cutoff: 3200, vol: .8 });
    else if (mode === "sustain" && st === 6 && lastBar) guitar(t, root, sd * 1.8, { notes: [0, 7], cutoff: 2600, vol: .6 });
    else if (mode === "arp" || mode === "arpHi") {
      const arp = [12, 19, 24, 19, 15, 19, 24, 27];
      const hi = mode === "arpHi" ? 12 : 0;
      const minorThird = song.g.scale === "minor" ? 0 : 1;
      const n = arp[st] === 15 || arp[st] === 27 ? arp[st] + minorThird : arp[st];
      guitar(t, root, sd * 1.6, { notes: [n + hi], cutoff: 4000, vol: .4, clean: true });
    }

    // baix
    if (s.name !== "intro") {
      const bm = song.g.bass, low = root - 12;
      if (bm === "eighths") bass(t, low, sd * .85);
      else if (bm === "walk") bass(t, low + [0, 0, 7, 0, 12, 0, 10, 7][st], sd * .85);
      else if (bm === "melodic") bass(t, low + [0, 0, 12, 0, 7, 0, 10, 12][st], sd * .9, .38);
    }
  }

  function tick() {
    while (nextTime < ctx.currentTime + .12) { scheduleStep(step, nextTime); nextTime += song.stepDur; step++; }
  }

  /* ---------------- API pública ---------------- */
  function stop(fade = .25) {
    clearInterval(timer); timer = null;
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + fade);
    const old = { crackle: crackleSrc, nodes: song && song.nodes };
    crackleSrc = null;
    setTimeout(() => {
      try { old.crackle && old.crackle.stop(); } catch (_) {}
      (old.nodes || []).forEach((n) => { try { n.disconnect(); } catch (_) {} });
    }, fade * 1000 + 300);
  }

  // Cal cridar-la des d'un clic (els navegadors només deixen sonar després d'una interacció).
  function play(rec, delay = 1) {
    init();
    if (ctx.state === "suspended") ctx.resume();
    if (timer || crackleSrc) stop(.08);
    song = compose(rec);
    const t0 = ctx.currentTime + .1;
    master.gain.cancelScheduledValues(t0);
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(.85, t0 + .05);
    buildBuses(song.g);
    startCrackle(t0 + delay * .6);
    nextTime = t0 + delay; step = 0;
    timer = setInterval(tick, 25);
    tick();
    return { bpm: song.bpm, key: song.keyName };
  }

  const levels = new Uint8Array(128);
  function spectrum(bands) {
    if (!analyser || !timer) return null;
    analyser.getByteFrequencyData(levels);
    const out = [], per = Math.floor(64 / bands);
    for (let b = 0; b < bands; b++) {
      let sum = 0;
      for (let j = 0; j < per; j++) sum += levels[b * per + j];
      out.push(sum / per / 255);
    }
    return out;
  }

  window.SolcAudio = { play, stop, spectrum, get playing() { return !!timer; } };
})();
