// ── AUDIO ENGINE (GALAXY THEME) ──────────────────────────────────────────────
// Import and call initAudio() on first user interaction to unlock AudioContext.
// All play* functions are safe to call at any time — they no-op if sound is off.

import type { Rarity } from "./cardDefs";

let ctx: AudioContext | null = null;
let soundOn = false;

// ── Background music nodes (kept alive while sound is on) ─────────────────
let bgGain: GainNode | null = null;
let bgNodes: AudioNode[] = [];
let bgArpInterval: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isSoundOn(): boolean {
  return soundOn;
}

export function toggleSound(): boolean {
  soundOn = !soundOn;
  if (soundOn) {
    playSystemsOnline();
    startGalaxyMusic();
  } else {
    stopGalaxyMusic();
    if (ctx) playSystemsOffline();
  }
  return soundOn;
}

// ─────────────────────────────────────────────────────────────────────────────
// GALAXY BACKGROUND MUSIC
// Three layers: deep drone, filtered noise pad, slow pentatonic arpeggio
// ─────────────────────────────────────────────────────────────────────────────

function startGalaxyMusic() {
  const c = getCtx();
  bgGain = c.createGain();
  bgGain.gain.setValueAtTime(0, c.currentTime);
  bgGain.gain.linearRampToValueAtTime(0.09, c.currentTime + 3);
  bgGain.connect(c.destination);
  bgNodes = [];

  // ── Layer 1: Deep sub drone
  const droneFreqs = [55, 55.3, 82.5, 82.7];
  droneFreqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = i % 2 === 0 ? 0.55 : 0.35;
    osc.connect(g);
    g.connect(bgGain!);
    osc.start();
    bgNodes.push(osc, g);
  });

  // ── Layer 2: Noise pad
  const bufLen = c.sampleRate * 4;
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = buf;
  noiseSrc.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 280; lp.Q.value = 0.7;
  const hp = c.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 60;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.12;
  noiseSrc.connect(lp); lp.connect(hp); hp.connect(noiseGain); noiseGain.connect(bgGain!);
  noiseSrc.start();
  bgNodes.push(noiseSrc, lp, hp, noiseGain);

  // ── Layer 3: Pad with tremolo LFO
  const padFreqs = [110, 165, 220, 330];
  padFreqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine"; osc.frequency.value = freq;
    const lfo = c.createOscillator();
    lfo.type = "sine"; lfo.frequency.value = 0.08 + i * 0.02;
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    const padGain = c.createGain(); padGain.gain.value = 0.04;
    lfoGain.connect(padGain.gain);
    osc.connect(padGain); padGain.connect(bgGain!);
    osc.start(); lfo.start();
    bgNodes.push(osc, lfo, lfoGain, padGain);
  });

  // ── Layer 4: Slow pentatonic arpeggio
  const arpNotes = [440, 523, 587, 659, 784, 880, 784, 659, 587, 523];
  let arpIdx = 0;

  function playArpNote() {
    if (!soundOn || !bgGain) return;
    const c2 = getCtx();
    const freq = arpNotes[arpIdx % arpNotes.length];
    arpIdx++;
    const osc = c2.createOscillator();
    osc.type = "sine"; osc.frequency.value = freq;
    const env = c2.createGain();
    env.gain.setValueAtTime(0, c2.currentTime);
    env.gain.linearRampToValueAtTime(0.028, c2.currentTime + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, c2.currentTime + 1.8);
    osc.connect(env); env.connect(c2.destination);
    osc.start(); osc.stop(c2.currentTime + 1.9);
  }

  const arpStart = setTimeout(() => {
    playArpNote();
    bgArpInterval = setInterval(playArpNote, 1600);
  }, 2000);
  bgNodes.push({ disconnect: () => { clearTimeout(arpStart); } } as any);
}

function stopGalaxyMusic() {
  if (bgArpInterval) { clearInterval(bgArpInterval); bgArpInterval = null; }
  if (bgGain && ctx) {
    bgGain.gain.setValueAtTime(bgGain.gain.value, ctx.currentTime);
    bgGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    setTimeout(() => {
      bgNodes.forEach(n => { try { (n as OscillatorNode).stop?.(); n.disconnect?.(); } catch {} });
      bgNodes = []; bgGain = null;
    }, 1600);
  } else { bgNodes = []; bgGain = null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX
// ─────────────────────────────────────────────────────────────────────────────

// HOVER — retro pixel blip
export function playTick() {
  if (!soundOn) return;
  const c = getCtx();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "square"; o.connect(g); g.connect(c.destination);
  o.frequency.setValueAtTime(520, c.currentTime);
  o.frequency.setValueAtTime(640, c.currentTime + 0.03);
  g.gain.setValueAtTime(0.04, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  o.start(); o.stop(c.currentTime + 0.09);
}

// TIMER TICK — urgent countdown blip (different from hover tick)
export function playTimerTick() {
  if (!soundOn) return;
  const c = getCtx();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "square"; o.connect(g); g.connect(c.destination);
  o.frequency.setValueAtTime(880, c.currentTime);
  o.frequency.setValueAtTime(660, c.currentTime + 0.02);
  g.gain.setValueAtTime(0.055, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
  o.start(); o.stop(c.currentTime + 0.08);
}

// ── PER-RARITY CARD PLAY SOUNDS ───────────────────────────────────────────────

// COMMON — basic thud/swish
function playCardCommon() {
  const c = getCtx();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sawtooth"; o.connect(g); g.connect(c.destination);
  o.frequency.setValueAtTime(300, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.18);
  g.gain.setValueAtTime(0.07, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  o.start(); o.stop(c.currentTime + 0.21);
}

// UNCOMMON — brighter zap
function playCardUncommon() {
  const c = getCtx();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sawtooth"; o.connect(g); g.connect(c.destination);
  o.frequency.setValueAtTime(500, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.2);
  g.gain.setValueAtTime(0.07, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
  o.start(); o.stop(c.currentTime + 0.23);
  // Add a second harmonic for shimmer
  const o2 = c.createOscillator(); const g2 = c.createGain();
  o2.type = "sine"; o2.connect(g2); g2.connect(c.destination);
  o2.frequency.setValueAtTime(900, c.currentTime + 0.05);
  o2.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.25);
  g2.gain.setValueAtTime(0.04, c.currentTime + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
  o2.start(c.currentTime + 0.05); o2.stop(c.currentTime + 0.29);
}

// RARE — arcane shimmer + zap
function playCardRare() {
  const c = getCtx();
  // Rising sweep
  const o1 = c.createOscillator(); const g1 = c.createGain();
  o1.type = "sawtooth"; o1.connect(g1); g1.connect(c.destination);
  o1.frequency.setValueAtTime(200, c.currentTime);
  o1.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.12);
  o1.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.3);
  g1.gain.setValueAtTime(0.0, c.currentTime);
  g1.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.06);
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
  o1.start(); o1.stop(c.currentTime + 0.33);
  // Sparkle overtone
  const o2 = c.createOscillator(); const g2 = c.createGain();
  o2.type = "sine"; o2.connect(g2); g2.connect(c.destination);
  o2.frequency.setValueAtTime(1400, c.currentTime + 0.08);
  o2.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.35);
  g2.gain.setValueAtTime(0.05, c.currentTime + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.38);
  o2.start(c.currentTime + 0.08); o2.stop(c.currentTime + 0.39);
}

// CURSED — dark ominous strike
function playCardCursed() {
  const c = getCtx();
  // Low growl
  const o1 = c.createOscillator(); const g1 = c.createGain();
  o1.type = "sawtooth"; o1.connect(g1); g1.connect(c.destination);
  o1.frequency.setValueAtTime(80, c.currentTime);
  o1.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.35);
  g1.gain.setValueAtTime(0.12, c.currentTime);
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.38);
  o1.start(); o1.stop(c.currentTime + 0.4);
  // Sharp crack
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.08), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const ns = c.createBufferSource(); ns.buffer = buf;
  const flt = c.createBiquadFilter(); flt.type = "bandpass"; flt.frequency.value = 1200; flt.Q.value = 0.5;
  const gn = c.createGain(); gn.gain.value = 0.09;
  ns.connect(flt); flt.connect(gn); gn.connect(c.destination);
  ns.start();
}

// CORRUPTED — warped glitch buzz
function playCardCorrupted() {
  const c = getCtx();
  const o1 = c.createOscillator(); const g1 = c.createGain();
  o1.type = "square"; o1.connect(g1); g1.connect(c.destination);
  o1.frequency.setValueAtTime(160, c.currentTime);
  o1.frequency.setValueAtTime(320, c.currentTime + 0.05);
  o1.frequency.setValueAtTime(80,  c.currentTime + 0.10);
  o1.frequency.setValueAtTime(240, c.currentTime + 0.15);
  o1.frequency.setValueAtTime(60,  c.currentTime + 0.22);
  g1.gain.setValueAtTime(0.09, c.currentTime);
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
  o1.start(); o1.stop(c.currentTime + 0.33);
  // Distorted overtone
  const o2 = c.createOscillator(); const g2 = c.createGain();
  o2.type = "sawtooth"; o2.connect(g2); g2.connect(c.destination);
  o2.frequency.setValueAtTime(600, c.currentTime);
  o2.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.28);
  g2.gain.setValueAtTime(0.05, c.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  o2.start(); o2.stop(c.currentTime + 0.31);
}

// LEGENDARY — majestic golden fanfare hit
function playCardLegendary() {
  const c = getCtx();
  // Main chord hit
  [523, 659, 784].forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = i === 0 ? "sawtooth" : "sine";
    o.connect(g); g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.03;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.start(t); o.stop(t + 0.56);
  });
  // Golden shimmer sweep
  const os = c.createOscillator(); const gs = c.createGain();
  os.type = "sine"; os.connect(gs); gs.connect(c.destination);
  os.frequency.setValueAtTime(1200, c.currentTime);
  os.frequency.exponentialRampToValueAtTime(2400, c.currentTime + 0.15);
  os.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.45);
  gs.gain.setValueAtTime(0, c.currentTime);
  gs.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.08);
  gs.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  os.start(); os.stop(c.currentTime + 0.51);
}

// MYTHIC — ethereal resonant strike
function playCardMythic() {
  const c = getCtx();
  // Deep bass impact
  const ob = c.createOscillator(); const gb = c.createGain();
  ob.type = "sine"; ob.connect(gb); gb.connect(c.destination);
  ob.frequency.setValueAtTime(110, c.currentTime);
  ob.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.4);
  gb.gain.setValueAtTime(0.15, c.currentTime);
  gb.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  ob.start(); ob.stop(c.currentTime + 0.46);
  // Rising ethereal sweep
  [880, 1100, 1320].forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(freq, c.currentTime + i * 0.06);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, c.currentTime + i * 0.06 + 0.3);
    g.gain.setValueAtTime(0, c.currentTime + i * 0.06);
    g.gain.linearRampToValueAtTime(0.045, c.currentTime + i * 0.06 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.06 + 0.35);
    o.start(c.currentTime + i * 0.06); o.stop(c.currentTime + i * 0.06 + 0.36);
  });
}

// VOID — cosmic reality-tear sound
function playCardVoid() {
  const c = getCtx();
  // Deep void pulse
  const ob = c.createOscillator(); const gb = c.createGain();
  ob.type = "sine"; ob.connect(gb); gb.connect(c.destination);
  ob.frequency.setValueAtTime(55, c.currentTime);
  ob.frequency.exponentialRampToValueAtTime(27, c.currentTime + 0.6);
  gb.gain.setValueAtTime(0.18, c.currentTime);
  gb.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.65);
  ob.start(); ob.stop(c.currentTime + 0.66);
  // Alien frequency sweep (two diverging oscillators)
  [[440, 880], [660, 220]].forEach(([start, end], i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sawtooth"; o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(start, c.currentTime + i * 0.04);
    o.frequency.exponentialRampToValueAtTime(end, c.currentTime + i * 0.04 + 0.5);
    g.gain.setValueAtTime(0, c.currentTime + i * 0.04);
    g.gain.linearRampToValueAtTime(0.06, c.currentTime + i * 0.04 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.04 + 0.55);
    o.start(c.currentTime + i * 0.04); o.stop(c.currentTime + i * 0.04 + 0.56);
  });
  // Noise burst
  const bufV = c.createBuffer(1, Math.floor(c.sampleRate * 0.15), c.sampleRate);
  const dV = bufV.getChannelData(0);
  for (let i = 0; i < dV.length; i++) dV[i] = (Math.random() * 2 - 1) * (1 - i / dV.length);
  const nsV = c.createBufferSource(); nsV.buffer = bufV;
  const fV = c.createBiquadFilter(); fV.type = "bandpass"; fV.frequency.value = 400; fV.Q.value = 0.3;
  const gnV = c.createGain(); gnV.gain.value = 0.12;
  nsV.connect(fV); fV.connect(gnV); gnV.connect(c.destination);
  nsV.start();
}

// ── Main entry point — plays rarity-specific sound
export function playCardPlay(rarity?: Rarity) {
  if (!soundOn) return;
  switch (rarity) {
    case "uncommon":   return playCardUncommon();
    case "rare":       return playCardRare();
    case "cursed":     return playCardCursed();
    case "corrupted":  return playCardCorrupted();
    case "legendary":  return playCardLegendary();
    case "mythic":     return playCardMythic();
    case "void":       return playCardVoid();
    default:           return playCardCommon(); // common + fallback
  }
}

// MODAL OPEN — spaceship powering up sweep
export function playModalOpen() {
  if (!soundOn) return;
  const c = getCtx();
  const o1 = c.createOscillator(); const g1 = c.createGain();
  o1.type = "sawtooth"; o1.connect(g1); g1.connect(c.destination);
  o1.frequency.setValueAtTime(80, c.currentTime);
  o1.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.35);
  g1.gain.setValueAtTime(0.0, c.currentTime);
  g1.gain.linearRampToValueAtTime(0.065, c.currentTime + 0.1);
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
  o1.start(); o1.stop(c.currentTime + 0.42);

  const o2 = c.createOscillator(); const g2 = c.createGain();
  o2.type = "sine"; o2.connect(g2); g2.connect(c.destination);
  o2.frequency.setValueAtTime(900, c.currentTime + 0.3);
  o2.frequency.exponentialRampToValueAtTime(1100, c.currentTime + 0.5);
  g2.gain.setValueAtTime(0.0, c.currentTime + 0.28);
  g2.gain.linearRampToValueAtTime(0.055, c.currentTime + 0.35);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.55);
  o2.start(c.currentTime + 0.28); o2.stop(c.currentTime + 0.56);

  const buf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter(); filt.type = "highpass"; filt.frequency.value = 2000;
  const gn = c.createGain();
  gn.gain.setValueAtTime(0.038, c.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  src.connect(filt); filt.connect(gn); gn.connect(c.destination);
  src.start();
}

// MODAL CLOSE — laser zap down
export function playModalClose() {
  if (!soundOn) return;
  const c = getCtx();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sawtooth"; o.connect(g); g.connect(c.destination);
  o.frequency.setValueAtTime(700, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.22);
  g.gain.setValueAtTime(0.065, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.24);
  o.start(); o.stop(c.currentTime + 0.25);
}

// VICTORY — ascending fanfare
export function playVictory() {
  if (!soundOn) return;
  const c = getCtx();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "square"; o.connect(g); g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.12;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.start(t); o.stop(t + 0.26);
  });
}

// DEFEAT — descending sad tones
export function playDefeat() {
  if (!soundOn) return;
  const c = getCtx();
  const notes = [392, 311, 261, 196];
  notes.forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.connect(g); g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.14;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.start(t); o.stop(t + 0.3);
  });
}

// DRAW / SKIP — deep space whoosh
export function playWhoosh() {
  if (!soundOn) return;
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(200, c.currentTime);
  filt.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.3);
  filt.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  src.connect(filt); filt.connect(g); g.connect(c.destination);
  src.start();
}

// SYSTEMS ONLINE — sound toggle ON jingle
function playSystemsOnline() {
  const c = getCtx();
  const notes = [261, 329, 392, 523];
  notes.forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.connect(g); g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  });
}

// SYSTEMS OFFLINE — sound toggle OFF descending
function playSystemsOffline() {
  const c = getCtx();
  const notes = [523, 392, 261, 130];
  notes.forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.connect(g); g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.07;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.044, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.start(t); o.stop(t + 0.16);
  });
}