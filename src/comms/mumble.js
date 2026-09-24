const MODE = Object.freeze({
  COMBAT: { pace: .82, gain: .82, lowPass: 2900 },
  INTERMISSION: { pace: 1, gain: .68, lowPass: 3700 },
  HANGAR: { pace: 1.14, gain: .55, lowPass: 4800 },
});
const EMOTION = Object.freeze({
  calm: [1, 1], focused: [.95, 1], urgent: [1.12, 1.08], concerned: [.94, .94],
  amused: [1.04, 1.04], reflective: [.84, .92], strained: [1.05, .96], relieved: [.95, 1.03],
});
export function mumblePreset(mode, emotion) {
  const base = MODE[mode] || MODE.HANGAR;
  const [energy, pitch] = EMOTION[emotion] || EMOTION.calm;
  return { ...base, energy, pitch };
}
export function punctuationOf(word) {
  if (/…|\.\.\.$/.test(word)) return 'ellipsis';
  if (/\?+["'’”)]*$/.test(word)) return 'question';
  if (/!+["'’”)]*$/.test(word)) return 'exclamation';
  if (/\.+["'’”)]*$/.test(word)) return 'period';
  if (/[,;:]+["'’”)]*$/.test(word)) return 'comma';
  return 'none';
}
export function tokenizeWords(text) {
  return [...text.matchAll(/\S+/gu)].map((match, index, all) => ({
    word: match[0], index, end: match.index + match[0].length,
    punctuation: punctuationOf(match[0]), isLastWord: index === all.length - 1,
  }));
}
export function wordVariation(message, index) {
  let seed = 2166136261;
  for (const char of message) seed = Math.imul(seed ^ char.codePointAt(0), 16777619);
  seed = Math.imul(seed ^ index, 16777619) >>> 0;
  const next = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  return { pitch: .94 + next() * .12, timbre: .9 + next() * .2, length: .9 + next() * .2, noise: .85 + next() * .3 };
}
export function grainParameters(message, token, mode, emotion) {
  const preset = mumblePreset(mode, emotion), variation = wordVariation(message, token.index);
  const letters = [...token.word.replace(/[^\p{L}\p{N}]/gu, '')].length;
  return {
    duration: Math.min(.22, (.055 + Math.min(letters, 14) * .011) * variation.length * preset.pace),
    frequency: 142 * variation.pitch * preset.pitch * (token.punctuation === 'question' ? 1.08 : 1),
    gain: .028 * preset.gain * preset.energy * (token.punctuation === 'exclamation' ? 1.14 : 1),
    lowPass: preset.lowPass * variation.timbre,
    noise: variation.noise,
  };
}

// The UI reveals words; this module only sounds each callback. It owns no timer.
export function createChatMumble(audio) {
  let enabled = true, active = false, message = '', mode = 'HANGAR', emotion = 'calm';
  const grains = new Set();
  function cancel() {
    active = false;
    for (const grain of grains) grain.stop();
    grains.clear();
  }
  return {
    begin(reply) { cancel(); message = reply.text; mode = reply.mode; emotion = reply.emotion; active = enabled && !!message; },
    word(token) {
      if (!active || !enabled || audio.muted) return;
      const grain = audio.playMumbleGrain(grainParameters(message, token, mode, emotion));
      if (grain) { grains.add(grain); grain.ended.then(() => grains.delete(grain)); }
      if (token.isLastWord) active = false;
    },
    cancel,
    setEnabled(value) { enabled = !!value; if (!enabled) cancel(); },
    snapshot() { return { enabled, active: active || grains.size > 0 }; },
  };
}
