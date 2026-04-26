// ── AUDIO ENGINE (GALAXY THEME) ──────────────────────────────────────────────
// Import and call initAudio() on first user interaction to unlock AudioContext.
// All play* functions are safe to call at any time — they no-op if sound is off.

let ctx: AudioContext | null = null;
let soundOn = false;

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
  } else {
    if (ctx) playSystemsOffline();
  }
  return soundOn;
}

// HOVER — retro pixel console blip
export function playTick() {
  if (!soundOn) return;
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.connect(g);
  g.connect(c.destination);
  o.frequency.setValueAtTime(520, c.currentTime);
  o.frequency.setValueAtTime(640, c.currentTime + 0.03);
  g.gain.setValueAtTime(0.08, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  o.start();
  o.stop(c.currentTime + 0.09);
}

// CARD PLAY — sharp laser zap forward
export function playCardPlay() {
  if (!soundOn) return;
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.connect(g);
  g.connect(c.destination);
  o.frequency.setValueAtTime(300, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.18);
  g.gain.setValueAtTime(0.13, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  o.start();
  o.stop(c.currentTime + 0.21);
}

// MODAL OPEN — spaceship powering up sweep
export function playModalOpen() {
  if (!soundOn) return;
  const c = getCtx();

  // Rising sweep
  const o1 = c.createOscillator();
  const g1 = c.createGain();
  o1.type = "sawtooth";
  o1.connect(g1);
  g1.connect(c.destination);
  o1.frequency.setValueAtTime(80, c.currentTime);
  o1.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.35);
  g1.gain.setValueAtTime(0.0, c.currentTime);
  g1.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.1);
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
  o1.start();
  o1.stop(c.currentTime + 0.42);

  // Layered high ping at the end
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = "sine";
  o2.connect(g2);
  g2.connect(c.destination);
  o2.frequency.setValueAtTime(900, c.currentTime + 0.3);
  o2.frequency.exponentialRampToValueAtTime(1100, c.currentTime + 0.5);
  g2.gain.setValueAtTime(0.0, c.currentTime + 0.28);
  g2.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.35);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.55);
  o2.start(c.currentTime + 0.28);
  o2.stop(c.currentTime + 0.56);

  // Subtle noise burst (engine ignition texture)
  const buf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = 2000;
  const gn = c.createGain();
  gn.gain.setValueAtTime(0.07, c.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  src.connect(filt);
  filt.connect(gn);
  gn.connect(c.destination);
  src.start();
}

// MODAL CLOSE — laser zap down
export function playModalClose() {
  if (!soundOn) return;
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.connect(g);
  g.connect(c.destination);
  o.frequency.setValueAtTime(700, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.22);
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.24);
  o.start();
  o.stop(c.currentTime + 0.25);
}

// VICTORY — ascending fanfare
export function playVictory() {
  if (!soundOn) return;
  const c = getCtx();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.connect(g);
    g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.12;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.start(t);
    o.stop(t + 0.26);
  });
}

// DEFEAT — descending sad tones
export function playDefeat() {
  if (!soundOn) return;
  const c = getCtx();
  const notes = [392, 311, 261, 196];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.14;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.start(t);
    o.stop(t + 0.3);
  });
}

// SCROLL REVEAL — deep space whoosh
export function playWhoosh() {
  if (!soundOn) return;
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(200, c.currentTime);
  filt.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.3);
  filt.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  src.connect(filt);
  filt.connect(g);
  g.connect(c.destination);
  src.start();
}

// SYSTEMS ONLINE — sound toggle ON jingle
function playSystemsOnline() {
  const c = getCtx();
  const notes = [261, 329, 392, 523];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t);
    o.stop(t + 0.2);
  });
}

// SYSTEMS OFFLINE — sound toggle OFF descending
function playSystemsOffline() {
  const c = getCtx();
  const notes = [523, 392, 261, 130];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(c.destination);
    o.frequency.value = freq;
    const t = c.currentTime + i * 0.07;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.start(t);
    o.stop(t + 0.16);
  });
}