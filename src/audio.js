// audio.js — tiny synthesized sound engine (no asset files; everything is WebAudio).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.muted = false;
  }

  // Must be called from a user gesture (click/keydown) to satisfy autoplay rules.
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }

  _now() { return this.ctx.currentTime; }

  // Core voice: an oscillator with an ADSR-ish gain envelope and optional pitch glide.
  _tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, attack = 0.005, decay = null, dest = null, detune = 0 }) {
    if (!this.enabled || !this.ctx || this.muted) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const d = decay == null ? dur : decay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g);
    g.connect(dest || this.master);
    osc.start(t);
    osc.stop(t + d + 0.05);
  }

  // Filtered noise burst — used for splashes, explosions, sweeps.
  _noise({ dur = 0.3, vol = 0.3, type = 'lowpass', f = 1000, fEnd = null, q = 1 }) {
    if (!this.enabled || !this.ctx || this.muted) return;
    const t = this._now();
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = f; filter.Q.value = q;
    if (fEnd != null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.enabled || !this.ctx || this.muted) return;
    switch (name) {
      case 'cast':      this._tone({ type: 'triangle', f0: 320, f1: 720, dur: 0.16, vol: 0.18 }); break;
      case 'fireball':  this._tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.32, vol: 0.22 });
                        this._noise({ dur: 0.34, vol: 0.16, type: 'lowpass', f: 1800, fEnd: 300 }); break;
      case 'explosion': this._noise({ dur: 0.5, vol: 0.32, type: 'lowpass', f: 1400, fEnd: 120 });
                        this._tone({ type: 'sine', f0: 120, f1: 40, dur: 0.45, vol: 0.25 }); break;
      case 'zap':       this._tone({ type: 'square', f0: 1400, f1: 380, dur: 0.14, vol: 0.16 });
                        this._noise({ dur: 0.12, vol: 0.12, type: 'highpass', f: 2400 }); break;
      case 'frost':     this._noise({ dur: 0.4, vol: 0.2, type: 'bandpass', f: 2600, fEnd: 800, q: 2 });
                        this._tone({ type: 'sine', f0: 900, f1: 1500, dur: 0.3, vol: 0.1 }); break;
      case 'heal':      this._tone({ type: 'sine', f0: 520, f1: 880, dur: 0.5, vol: 0.16 });
                        this._tone({ type: 'sine', f0: 660, f1: 990, dur: 0.5, vol: 0.1, detune: 8 }); break;
      case 'gust':      this._noise({ dur: 0.4, vol: 0.22, type: 'bandpass', f: 500, fEnd: 1600, q: 0.7 }); break;
      case 'hit':       this._tone({ type: 'square', f0: 180, f1: 80, dur: 0.1, vol: 0.16 }); break;
      case 'hurt':      this._tone({ type: 'sawtooth', f0: 240, f1: 90, dur: 0.18, vol: 0.2 });
                        this._noise({ dur: 0.16, vol: 0.12, type: 'lowpass', f: 900 }); break;
      case 'enemyDie':  this._tone({ type: 'square', f0: 160, f1: 60, dur: 0.18, vol: 0.14 });
                        this._noise({ dur: 0.2, vol: 0.12, type: 'lowpass', f: 1200, fEnd: 200 }); break;
      case 'xp':        this._tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.08, vol: 0.08 }); break;
      case 'levelup':   [0, 0.09, 0.18].forEach((d, i) =>
                          setTimeout(() => this._tone({ type: 'triangle', f0: 523 * (1 + i * 0.26), dur: 0.22, vol: 0.16 }), d * 1000)); break;
      case 'hiccup':    this._tone({ type: 'sine', f0: 300, f1: 520, dur: 0.09, vol: 0.18 });
                        setTimeout(() => this._tone({ type: 'sine', f0: 200, f1: 140, dur: 0.12, vol: 0.14 }), 90); break;
      case 'jobDone':   [0, 0.12, 0.24, 0.36].forEach((d, i) =>
                          setTimeout(() => this._tone({ type: 'sine', f0: 440 * Math.pow(1.2, i), dur: 0.2, vol: 0.16 }), d * 1000)); break;
      case 'click':     this._tone({ type: 'square', f0: 600, f1: 900, dur: 0.05, vol: 0.1 }); break;
      case 'gameover':  [0, 0.2, 0.45].forEach((d, i) =>
                          setTimeout(() => this._tone({ type: 'sawtooth', f0: 330 / (1 + i * 0.5), dur: 0.5, vol: 0.18 }), d * 1000)); break;
      case 'win':       [0, 0.13, 0.26, 0.5].forEach((d, i) =>
                          setTimeout(() => this._tone({ type: 'triangle', f0: 523 * Math.pow(1.18, i), dur: 0.3, vol: 0.18 }), d * 1000)); break;
      default: break;
    }
  }
}
