const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** All sounds are synthesized locally. Nothing starts until start() is called. */
export class FlightAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engine = null;
    this.muted = false;
    this._starting = null;
    this._lastPlayed = new Map();
    this._flight = { speed: 650, throttle: 0.5, mode: 'menu' };
  }

  async start() {
    if (this._starting) return this._starting;
    this._starting = this._start();
    try {
      await this._starting;
    } finally {
      this._starting = null;
    }
  }

  async _start() {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context || this.context.state === 'closed') {
        const context = new AudioContext();
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(context.destination);

        const bus = context.createGain();
        bus.gain.value = 0.0001;
        bus.connect(this.master);

        const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = (previous + Math.random() * 0.04 - 0.02) / 1.02;
          samples[i] = previous * 3.5;
        }
        this._noiseBuffer = noiseBuffer;
        const noise = context.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.3;
        noise.connect(filter);
        filter.connect(bus);
        noise.start();

        const turbine = context.createOscillator();
        turbine.type = 'sine';
        turbine.frequency.value = 70;
        const turbineGain = context.createGain();
        turbineGain.gain.value = 0.14;
        turbine.connect(turbineGain);
        turbineGain.connect(bus);
        turbine.start();

        const overtone = context.createOscillator();
        overtone.type = 'sine';
        overtone.frequency.value = 141;
        const overtoneGain = context.createGain();
        overtoneGain.gain.value = 0.035;
        overtone.connect(overtoneGain);
        overtoneGain.connect(bus);
        overtone.start();
        this.engine = { bus, filter, turbine, overtone };
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.update(this._flight);
    } catch {
      // A browser may deny audio or lack an output device; flight still works.
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      if (this.master && this.context?.state !== 'closed') {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.context.currentTime, 0.04);
      }
    } catch { /* Audio availability must never interrupt the game. */ }
  }

  update({ speed = 650, throttle = 0.5, mode = 'menu' } = {}) {
    this._flight = { speed, throttle, mode };
    if (!this.engine || this.context?.state !== 'running') return;
    try {
      const t = this.context.currentTime;
      const velocity = clamp(Number.isFinite(speed) ? speed / 1500 : 0.4, 0, 1.5);
      const thrust = clamp(Number.isFinite(throttle) ? throttle : 0.5, 0, 1);
      const frequency = 58 + velocity * 46 + thrust * 12;
      this.engine.bus.gain.setTargetAtTime(mode === 'playing' ? 0.11 + thrust * 0.07 : 0.0001, t, 0.35);
      this.engine.turbine.frequency.setTargetAtTime(frequency, t, 0.25);
      this.engine.overtone.frequency.setTargetAtTime(frequency * 2.012, t, 0.25);
      this.engine.filter.frequency.setTargetAtTime(450 + velocity * 600 + thrust * 400, t, 0.3);
    } catch { /* A suspended or removed audio device is harmless. */ }
  }

  play(name) {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    try {
      const now = this.context.currentTime;
      const cooldown = { gun: 0.065, lock: 0.35, warning: 1.25, hit: 0.12, destroy: 0.15 }[name] || 0.05;
      if (now - (this._lastPlayed.get(name) ?? -Infinity) < cooldown) return;
      this._lastPlayed.set(name, now);

      switch (name) {
        case 'missile':
          this._noise(0.65, 0.6, 2300, 180, 'bandpass');
          this._tone(170, 65, 0.32, 0.08, 'triangle');
          break;
        case 'gun':
          this._noise(0.09, 0.75, 1900, 500, 'highpass');
          this._tone(105, 45, 0.085, 0.2, 'triangle');
          break;
        case 'lock':
          this._tone(940, 940, 0.09, 0.13);
          this._tone(1175, 1175, 0.12, 0.11, 'sine', 0.13);
          break;
        case 'hit':
          this._noise(0.22, 0.7, 1450, 120);
          this._tone(95, 40, 0.2, 0.12, 'triangle');
          break;
        case 'destroy':
          this._noise(1.0, 1.0, 1500, 65);
          this._tone(100, 28, 0.8, 0.22, 'triangle');
          break;
        case 'warning':
          this._tone(580, 470, 0.18, 0.15, 'triangle');
          this._tone(580, 470, 0.18, 0.15, 'triangle', 0.3);
          break;
        case 'victory':
          [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
            this._tone(frequency, frequency, 0.48, 0.1, 'sine', index * 0.16);
          });
          break;
        case 'click':
          this._tone(800, 560, 0.055, 0.075);
          break;
        default:
          break;
      }
    } catch { /* Effects are optional when the audio device is unavailable. */ }
  }

  _tone(from, to, duration, volume, type = 'sine', delay = 0) {
    const context = this.context;
    const time = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + Math.min(0.015, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.025);
  }

  _noise(duration, volume, from, to, filterType = 'lowpass') {
    const context = this.context;
    const time = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this._noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = 0.55;
    filter.frequency.setValueAtTime(from, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(time, Math.random() * 0.7);
    source.stop(time + duration + 0.025);
  }
}
