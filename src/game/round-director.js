import { createRunState, Phase } from './state.js';
import { DEFAULT_ENCOUNTER_ID, getEncounter } from './encounters.js';

export function createRoundDirector(run, spawnEncounter) {
  let enemies = [];
  let clearElapsed = 0;

  function beginRound(id) {
    const encounter = getEncounter(id);
    const spawned = spawnEncounter(encounter);
    if (!spawned.length) throw new Error('An encounter must contain enemies.');
    enemies = spawned;
    run.currentEncounter = encounter;
    run.round++;
    run.roundKills = 0;
    run.roundElapsed = 0;
    run.phase = Phase.COMBAT;
    run.paused = false;
    clearElapsed = 0;
  }

  return {
    startRun() {
      if (![Phase.READY, Phase.GAME_OVER].includes(run.phase)) return false;
      Object.assign(run, createRunState());
      beginRound(DEFAULT_ENCOUNTER_ID);
      return true;
    },
    reset() {
      Object.assign(run, createRunState());
      enemies = [];
      clearElapsed = 0;
    },
    nextRound(id) {
      if (run.phase !== Phase.INTERMISSION) return false;
      beginRound(id);
      return true;
    },
    recordDestruction(enemy, source = 'player') {
      if (run.phase !== Phase.COMBAT || run.paused || !enemy.alive || !enemies.includes(enemy)) return false;
      enemy.alive = false;
      run.roundKills++;
      run.totalKills++;
      Object.defineProperty(run.killsBySource, source, {
        value: (Object.hasOwn(run.killsBySource, source) ? run.killsBySource[source] : 0) + 1,
        writable: true, enumerable: true, configurable: true,
      });
      run.score += enemy.reward;
      return true;
    },
    checkRoundComplete() {
      if (run.phase !== Phase.COMBAT || run.paused || !enemies.length || enemies.some(enemy => enemy.alive)) return false;
      run.phase = Phase.ROUND_CLEAR;
      clearElapsed = 0;
      return true;
    },
    update(dt) {
      if (run.paused) return;
      if (run.phase === Phase.COMBAT) { run.elapsed += dt; run.roundElapsed += dt; }
      if (run.phase === Phase.ROUND_CLEAR) {
        clearElapsed += dt;
        if (clearElapsed >= .9) run.phase = Phase.INTERMISSION;
      }
    },
    setPaused(paused) {
      if ([Phase.COMBAT, Phase.ROUND_CLEAR].includes(run.phase)) run.paused = paused;
    },
    endRun() {
      if (run.phase !== Phase.COMBAT) return false;
      run.phase = Phase.GAME_OVER;
      run.paused = false;
      return true;
    },
    getSnapshot() {
      const encounter = run.currentEncounter;
      return {
        ...run, killsBySource: { ...run.killsBySource },
        currentEncounter: encounter ? { id: encounter.id, title: encounter.title, category: encounter.category } : null,
        encounterTotal: enemies.length, remainingEnemies: enemies.filter(enemy => enemy.alive).length,
      };
    },
  };
}
