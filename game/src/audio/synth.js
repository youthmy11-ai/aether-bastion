/**
 * Procedural Web Audio API sound effects synthesizer (zero external audio files).
 */

/**
 * Creates a procedural WebAudio SFX engine with mute control.
 * @param {boolean} initialMuted
 */
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
        master.gain.value = 0.26;
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

  function tone(type, f0, f1, dur, vol, delay = 0) {
    const audio = ensureContext();
    if (!audio || !master) return;
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
  }

  function noise(dur, freq, vol) {
    const audio = ensureContext();
    if (!audio || !master || !noiseBuffer) return;
    const t0 = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = 1.1;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  return {
    unlock() { ensureContext(); },
    isMuted() { return muted; },
    setMuted(next) { muted = Boolean(next); if (!muted) ensureContext(); return muted; },
    toggleMute() { return this.setMuted(!muted); },
    shoot(scale = 1) { tone('triangle', 680 * scale, 240 * scale, 0.06, 0.12); },
    crit() { tone('sawtooth', 980, 380, 0.085, 0.13); },
    deflect() { tone('sine', 1240, 880, 0.065, 0.11); },
    kill(heavy = false) {
      noise(heavy ? 0.24 : 0.13, heavy ? 320 : 540, heavy ? 0.34 : 0.2);
      tone('sawtooth', heavy ? 170 : 240, 52, heavy ? 0.22 : 0.12, heavy ? 0.22 : 0.14);
    },
    crystal(combo = 1) {
      const f = Math.min(1320, 520 + combo * 42);
      tone('sine', f, f * 1.28, 0.075, 0.12);
    },
    buildTurret() {
      tone('triangle', 340, 680, 0.1, 0.16, 0);
      tone('sine', 680, 960, 0.12, 0.16, 0.06);
    },
    dash() { noise(0.14, 1400, 0.16); tone('sine', 290, 620, 0.11, 0.15); },
    emp() {
      noise(0.36, 220, 0.38);
      tone('sawtooth', 250, 48, 0.34, 0.26);
      tone('triangle', 740, 140, 0.26, 0.2, 0.03);
    },
    pylonBlast() { noise(0.3, 420, 0.34); tone('triangle', 480, 110, 0.25, 0.22); },
    overcharge() { tone('triangle', 440, 880, 0.18, 0.18, 0); tone('sine', 660, 1320, 0.2, 0.16, 0.08); },
    hit() { noise(0.16, 260, 0.32); tone('square', 150, 55, 0.16, 0.24); },
    sniperWarn() { tone('sine', 960, 1180, 0.07, 0.07); },
    upgradeOpen() { tone('triangle', 392, 523, 0.11, 0.16, 0); tone('triangle', 523, 784, 0.16, 0.18, 0.08); },
    upgradePick() { tone('sine', 523, 784, 0.11, 0.18, 0); tone('sine', 784, 1046, 0.15, 0.18, 0.07); },
    bossWarn() { tone('sawtooth', 120, 72, 0.32, 0.24, 0); tone('sawtooth', 110, 66, 0.36, 0.24, 0.2); },
    victory() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i += 1) tone('triangle', notes[i], notes[i] * 1.02, 0.26, 0.18, i * 0.1);
    },
    over() { tone('sawtooth', 260, 140, 0.2, 0.2, 0); tone('sawtooth', 180, 72, 0.32, 0.22, 0.16); },
  };
}
