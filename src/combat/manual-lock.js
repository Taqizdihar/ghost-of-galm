export function createManualLock() {
  let targetId = null, elapsed = 0;
  const reset = () => { targetId = null; elapsed = 0; };
  return {
    reset,
    toggle(target) {
      if (!target?.alive || target.id === targetId) reset();
      else { targetId = target.id; elapsed = 0; }
    },
    update(dt, target, inEnvelope) {
      if (!target?.alive || target.id !== targetId) { reset(); return false; }
      const wasLocked = elapsed >= .65;
      // Losing the envelope resets acquisition, retaining this explicit request only.
      elapsed = inEnvelope ? Math.min(.65, elapsed + dt) : 0;
      return !wasLocked && elapsed >= .65;
    },
    getSnapshot() { return { requested: targetId !== null, targetId, elapsed, locked: elapsed >= .65, lockedTargetId: elapsed >= .65 ? targetId : null }; },
  };
}
