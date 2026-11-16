// Pure Web Audio API procedural sound effects synthesizer (zero external files).
export function createAudio(initialMuted = false) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = Boolean(initialMuted);

  function ensureContext() {
    if (muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) {
      try {
        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = 0.28;
        master.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 0.45);
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      } catch {
        ctx = null;
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(type, freqStart, freqEnd, duration, volume, delay = 0) {
    const audio = ensureContext();
    if (!audio || !master) return;
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqStart), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  function noise(duration, filterFreq, volume, q = 1.2) {
    const audio = ensureContext();
    if (!audio || !master || !noiseBuffer) return;
    const t0 = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.Q.value = q;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + duration + 0.01);
  }

  return {
    unlock() { ensureContext(); },
    isMuted() { return muted; },
    setMuted(next) { muted = Boolean(next); if (!muted) ensureContext(); return muted; },
    toggleMute() { return this.setMuted(!muted); },
    shoot(pitchScale = 1) { tone('triangle', 680 * pitchScale, 240 * pitchScale, 0.065, 0.14); },
    crit() { tone('sawtooth', 980, 360, 0.09, 0.14); },
    deflect() { tone('sine', 1240, 880, 0.07, 0.12); },
    kill(isHeavy = false) {
      noise(isHeavy ? 0.24 : 0.14, isHeavy ? 320 : 520, isHeavy ? 0.36 : 0.22);
      tone('sawtooth', isHeavy ? 170 : 240, 52, isHeavy ? 0.22 : 0.13, isHeavy ? 0.24 : 0.16);
    },
    crystal(combo = 1) {
      const f = Math.min(1320, 520 + combo * 42);
      tone('sine', f, f * 1.28, 0.08, 0.13);
    },
    dash() { noise(0.14, 1400, 0.18, 0.8); tone('sine', 290, 620, 0.12, 0.16); },
    emp() {
      noise(0.38, 220, 0.42, 0.9);
      tone('sawtooth', 260, 48, 0.36, 0.3);
      tone('triangle', 760, 140, 0.28, 0.22, 0.03);
    },
    pylonBlast() {
      noise(0.32, 420, 0.36, 1.0);
      tone('triangle', 480, 110, 0.26, 0.24);
    },
    overcharge() {
      tone('triangle', 440, 880, 0.18, 0.2, 0);
      tone('sine', 660, 1320, 0.22, 0.18, 0.08);
    },
    hit() { noise(0.18, 260, 0.34, 1.0); tone('square', 150, 55, 0.18, 0.26); },
    sniperWarn() { tone('sine', 960, 1180, 0.08, 0.08); },
    upgradeOpen() {
      tone('triangle', 392, 523, 0.12, 0.18, 0);
      tone('triangle', 523, 659, 0.14, 0.18, 0.08);
      tone('triangle', 659, 784, 0.2, 0.2, 0.16);
    },
    upgradePick() {
      tone('sine', 523, 784, 0.12, 0.2, 0);
      tone('sine', 784, 1046, 0.16, 0.2, 0.07);
    },
    bossWarn() {
      tone('sawtooth', 120, 75, 0.35, 0.26, 0);
      tone('sawtooth', 110, 68, 0.38, 0.26, 0.22);
    },
    victory() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i += 1) tone('triangle', notes[i], notes[i] * 1.02, 0.28, 0.2, i * 0.1);
    },
    over() {
      tone('sawtooth', 260, 140, 0.22, 0.22, 0);
      tone('sawtooth', 180, 72, 0.35, 0.24, 0.16);
    },
  };
}
