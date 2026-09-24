// Conservative runtime coloration for clean prerecorded MP3s; tune with M7-B assets.
export const RADIO_PRESETS = Object.freeze({
  COMBAT: Object.freeze({ highPassHz: 300, lowPassHz: 3600, threshold: -22, ratio: 2.5, distortion: .025, staticGain: .012, outputGain: .8, duckGain: .62 }),
  INTERMISSION: Object.freeze({ highPassHz: 160, lowPassHz: 6500, threshold: -20, ratio: 2, distortion: .015, staticGain: .007, outputGain: 1.15, duckGain: .65 }),
  HANGAR: Object.freeze({ highPassHz: 65, lowPassHz: 14000, threshold: -18, ratio: 1.3, distortion: 0, staticGain: 0, outputGain: 1, duckGain: .7 }),
});
export const radioPreset = mode => RADIO_PRESETS[mode] || RADIO_PRESETS.HANGAR;

export async function playRadioClip(audio, encoded, { mode, signal } = {}) {
  const context = audio.context;
  if (signal?.aborted || audio.muted || context?.state !== 'running') throw new Error('Audio unavailable');
  const buffer = await context.decodeAudioData(encoded.slice(0));
  if (signal?.aborted || audio.muted || context.state !== 'running') throw new Error('Audio unavailable');
  const preset = radioPreset(mode), nodes = [], sources = [];
  let finished = false, resolveEnded;
  const ended = new Promise(resolve => { resolveEnded = resolve; });
  const node = value => { nodes.push(value); return value; };
  const finish = () => {
    if (finished) return;
    finished = true;
    signal?.removeEventListener('abort', stop);
    nodes.forEach(n => { try { n.disconnect(); } catch { /* device closed */ } });
    audio.duckFlight(1);
    resolveEnded();
  };
  const stop = () => {
    sources.forEach(source => { try { source.stop(); } catch { /* already ended */ } });
    finish();
  };
  try {
    const source = node(context.createBufferSource()); sources.push(source); source.buffer = buffer;
    const hp = node(context.createBiquadFilter()), lp = node(context.createBiquadFilter());
    hp.type = 'highpass'; hp.frequency.value = preset.highPassHz; hp.Q.value = .5;
    lp.type = 'lowpass'; lp.frequency.value = preset.lowPassHz; lp.Q.value = .5;
    const compressor = node(context.createDynamicsCompressor());
    compressor.threshold.value = preset.threshold; compressor.knee.value = 18;
    compressor.ratio.value = preset.ratio; compressor.attack.value = .008; compressor.release.value = .12;
    const output = node(context.createGain()); output.gain.value = preset.outputGain;
    source.connect(hp); hp.connect(lp); lp.connect(compressor);
    if (preset.distortion) {
      const saturation = node(context.createWaveShaper()), curve = new Float32Array(1024);
      const drive = 1 + preset.distortion * 8;
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i * 2 / (curve.length - 1) - 1) * drive) / Math.tanh(drive);
      saturation.curve = curve;
      compressor.connect(saturation); saturation.connect(output);
    } else compressor.connect(output);
    output.connect(audio.voiceBus);
    const t = context.currentTime;
    if (preset.staticGain) {
      // Local transmission noise only; never part of a saved/reference WAV.
      for (const offset of [0, Math.max(0, buffer.duration - .045)]) {
        const noise = node(context.createBufferSource()); sources.push(noise);
        const noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .045), context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length);
        noise.buffer = noiseBuffer;
        const gain = node(context.createGain()); gain.gain.value = preset.staticGain;
        noise.connect(gain); gain.connect(hp); noise.start(t + offset);
      }
    }
    audio.duckFlight(preset.duckGain);
    source.onended = finish;
    signal?.addEventListener('abort', stop, { once: true });
    source.start(t);
    return { ended, stop, duration: buffer.duration, startedAt: performance.now() };
  } catch (error) { stop(); throw error; }
}
