// One Pixy channel covers radio reservation/playback and the full chat request/reveal.
export function createWingmanChannel() {
  let owner = 'IDLE', waiting = null, epoch = 0;
  function startChat(start) {
    owner = 'CHAT'; epoch++;
    try { start(); } catch { owner = 'IDLE'; epoch++; }
  }
  return {
    canStartRadio() { return owner !== 'CHAT' && !waiting; },
    reserveRadio() {
      if (owner === 'CHAT' || waiting) return false;
      owner = 'RADIO'; return true;
    },
    radioFinished() {
      if (owner !== 'RADIO') return;
      owner = 'IDLE';
      if (waiting) { const next = waiting; waiting = null; startChat(next); }
    },
    requestChat(start) {
      if (owner === 'CHAT' || waiting) return false;
      if (owner === 'RADIO') waiting = start;
      else startChat(start);
      return true;
    },
    finishChat(token = epoch) { if (owner === 'CHAT' && token === epoch) { owner = 'IDLE'; epoch++; } },
    cancelChat() { waiting = null; if (owner === 'CHAT') owner = 'IDLE'; epoch++; },
    reset() { waiting = null; owner = 'IDLE'; epoch++; },
    snapshot() { return { owner, epoch, chatWaiting: !!waiting, radioBusy: owner === 'RADIO', chatPending: owner === 'CHAT', chatReplying: false }; },
  };
}
