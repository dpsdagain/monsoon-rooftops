// Web Audio API procedural sound engine - no external audio files required!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.rainSource = null;
    this.rainGain = null;
    this.isMuted = false;
    this.hasInitialized = false;

    // Check localStorage for mute preference safely
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.isMuted = window.localStorage.getItem('monsoon_muted') === 'true';
      }
    } catch (e) {
      this.isMuted = false;
    }
  }

  init() {
    if (this.hasInitialized) {
      this.resume();
      return;
    }

    try {
      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.startRainAmbience();
      this.resume();
      this.hasInitialized = true;
    } catch (e) {
      console.warn("AudioContext failed to initialize:", e);
    }
  }

  pause() {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend();
      } catch (e) {}
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {}
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('monsoon_muted', this.isMuted ? 'true' : 'false');
    } catch (e) {}

    if (this.masterGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0.0 : 1.0, t + 0.05);
    }
    return this.isMuted;
  }

  startRainAmbience() {
    if (!this.ctx) return;
    try {
      // Generate 2 seconds of pink/filtered noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = noiseBuffer;
      this.rainSource.loop = true;

      // Bandpass filter for gentle monsoon rain patter
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      this.rainSource.connect(filter);
      filter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);

      this.rainSource.start(0);
    } catch (e) {
      console.warn("Rain noise setup error:", e);
    }
  }

  playJump() {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.12);

      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {}
  }

  playLand() {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.13);
    } catch (e) {}
  }

  playRazor() {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.13);
    } catch (e) {}
  }

  playCellPickup(count) {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      // Arpeggiate higher notes with more cells collected
      const baseFreq = 587.33 + count * 60; // D5 scale
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2.0];

      notes.forEach((freq, idx) => {
        const noteTime = t + idx * 0.055;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.24, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + 0.24);
      });
    } catch (e) {}
  }

  playThunder() {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.8);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 1.05);
    } catch (e) {}
  }

  playGameOver() {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.6);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.75);
    } catch (e) {}
  }

  playVictory() {
    if (!this.ctx) return;
    try {
      this.resume();
      const t = this.ctx.currentTime;
      // Majestic 5-note cyber fanfare: C5, E5, G5, B5, C6
      const fanfare = [523.25, 659.25, 783.99, 987.77, 1046.5];
      fanfare.forEach((freq, idx) => {
        const noteTime = t + idx * 0.12;
        const duration = idx === fanfare.length - 1 ? 0.7 : 0.2;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.3, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + duration + 0.05);
      });
    } catch (e) {}
  }
}

export const sound = new SoundEngine();
