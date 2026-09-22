export const Phase = Object.freeze({
  READY: 'READY', COMBAT: 'COMBAT', ROUND_CLEAR: 'ROUND_CLEAR',
  INTERMISSION: 'INTERMISSION', HANGAR: 'HANGAR', GAME_OVER: 'GAME_OVER',
});

export function createRunState() {
  return {
    phase: Phase.READY, paused: false, round: 0, score: 0,
    roundKills: 0, totalKills: 0, killsBySource: {}, currentEncounter: null,
    elapsed: 0, roundElapsed: 0, hangarReturnPhase: null,
  };
}

// Compatibility at the HUD/audio boundary; pause never changes the run phase.
export function presentationMode(run) {
  if (run.paused) return 'paused';
  return {
    [Phase.READY]: 'ready', [Phase.COMBAT]: 'playing',
    [Phase.ROUND_CLEAR]: 'round-clear', [Phase.INTERMISSION]: 'intermission',
    [Phase.HANGAR]: 'hangar', [Phase.GAME_OVER]: 'lost',
  }[run.phase];
}
