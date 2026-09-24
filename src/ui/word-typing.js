import { tokenizeWords } from '../comms/mumble.js';

export function typingTimeline(text, mode = 'HANGAR') {
  const words = tokenizeWords(text);
  const scale = Math.min(1, 8000 / Math.max(1, text.length * 24));
  let at = 0;
  const timeline = words.map(token => {
    at += Math.max(55, token.word.length * 24 * scale) * (mode === 'COMBAT' ? .83 : mode === 'HANGAR' ? 1.08 : 1);
    const revealAt = at;
    at += ({ comma: 110, period: 220, question: 235, exclamation: 190, ellipsis: 350 }[token.punctuation] || 28) * scale;
    return { ...token, revealAt };
  });
  const fit = Math.min(1, 8000 / Math.max(1, at));
  return timeline.map(token => ({ ...token, revealAt: token.revealAt * fit }));
}

export function createTypingProgress(text, mode, onWordShown = () => {}) {
  const timeline = typingTimeline(text, mode);
  let next = 0, count = 0, cancelled = false;
  return {
    advance(elapsed) {
      if (cancelled) return count;
      while (next < timeline.length && elapsed >= timeline[next].revealAt) {
        count = timeline[next].end;
        onWordShown(timeline[next]); next++;
      }
      return count;
    },
    cancel() { cancelled = true; },
    get done() { return next >= timeline.length || cancelled; },
  };
}
