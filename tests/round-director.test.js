import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState, Phase, presentationMode } from '../src/game/state.js';
import { createRoundDirector } from '../src/game/round-director.js';
import { encounters, expandEncounter, enemyCount } from '../src/game/encounters.js';

function setup() {
  const run = createRunState();
  let enemies;
  const director = createRoundDirector(run, encounter => {
    enemies = expandEncounter(encounter).map((member, id) => ({ ...member, id, alive: true }));
    return enemies;
  });
  return { run, director, get enemies() { return enemies; } };
}

test('hangar suspends progression and returns to its entry phase without repairing or resetting the run', () => {
  const game = setup();
  assert.equal(game.director.enterHangar(), true); assert.equal(game.run.phase, Phase.HANGAR);
  assert.equal(game.director.startRun(), false); game.director.leaveHangar();
  game.director.startRun(); assert.equal(game.director.enterHangar(), false);
  for (const enemy of game.enemies) game.director.recordDestruction(enemy, 'wingman');
  game.director.checkRoundComplete(); game.director.update(1);
  const before = game.director.getSnapshot(); game.director.enterHangar(); game.director.update(100);
  assert.equal(game.run.score, before.score); assert.equal(game.run.round, before.round);
  assert.equal(game.run.elapsed, before.elapsed); assert.equal(game.director.nextRound('border_patrol'), false);
  game.director.leaveHangar(); assert.equal(game.run.phase, Phase.INTERMISSION);
  game.director.nextRound('border_patrol'); assert.equal(game.run.round, 2);
  assert.equal(game.run.killsBySource.wingman, 6);
});

test('100 consecutive rounds retain score and total ownership, with variable compositions', () => {
  const game = setup();
  game.director.startRun();
  let score = 0, total = 0;
  for (let round = 1; round <= 100; round++) {
    assert.equal(game.run.round, round);
    assert.equal(game.run.roundKills, 0);
    assert.equal(game.enemies.length, enemyCount(game.run.currentEncounter));
    for (const [index, enemy] of game.enemies.entries()) {
      assert.equal(game.director.recordDestruction(enemy, index % 2 ? 'wingman' : 'player'), true);
      assert.equal(game.director.recordDestruction(enemy), false);
      score += enemy.reward; total++;
    }
    assert.equal(game.director.checkRoundComplete(), true);
    assert.equal(game.run.phase, Phase.ROUND_CLEAR);
    assert.equal(game.run.score, score);
    assert.equal(game.run.totalKills, total);
    assert.equal(game.run.killsBySource.player + (game.run.killsBySource.wingman || 0), total);
    assert.equal(game.director.nextRound('border_patrol'), false);
    game.director.update(1);
    assert.equal(game.run.phase, Phase.INTERMISSION);
    assert.equal(game.director.nextRound(encounters[round % encounters.length].id), true);
  }
});

test('completion depends on living enemies, regardless of kill counters or source', () => {
  const game = setup(); game.director.startRun();
  game.run.roundKills = 600;
  assert.equal(game.director.checkRoundComplete(), false);
  game.run.roundKills = 0;
  for (const enemy of game.enemies) game.director.recordDestruction(enemy, 'environment');
  assert.equal(game.run.killsBySource.player, undefined);
  assert.equal(game.director.checkRoundComplete(), true);
});

test('pause suspends time and clear transition; game over cannot continue a round', () => {
  const game = setup(); game.director.startRun();
  game.director.update(2);
  game.director.setPaused(true); game.director.update(30);
  assert.equal(game.run.phase, Phase.COMBAT);
  assert.equal(presentationMode(game.run), 'paused');
  assert.equal(game.run.elapsed, 2);
  assert.equal(game.director.recordDestruction(game.enemies[0]), false);
  game.director.setPaused(false);
  for (const enemy of game.enemies) game.director.recordDestruction(enemy);
  game.director.checkRoundComplete();
  game.director.setPaused(true); game.director.update(30);
  assert.equal(game.run.phase, Phase.ROUND_CLEAR);
  game.director.setPaused(false); game.director.update(1);
  game.director.nextRound('heavy_contact');
  game.director.endRun();
  assert.equal(game.run.phase, Phase.GAME_OVER);
  assert.equal(game.director.nextRound('border_patrol'), false);
  assert.equal(game.director.checkRoundComplete(), false);
  game.director.startRun();
  assert.equal(game.run.round, 1);
  assert.equal(game.run.score, 0);
  assert.equal(game.run.totalKills, 0);
  assert.deepEqual(game.run.killsBySource, {});
});

test('snapshots detach nested data; invalid and repeated transitions leave the run intact', () => {
  const game = setup();
  assert.equal(game.director.nextRound('border_patrol'), false);
  game.director.startRun();
  assert.equal(game.director.startRun(), false);
  assert.equal(game.director.recordDestruction({ alive: true, reward: 99999 }), false);
  const oldEnemy = game.enemies[0];
  for (const enemy of game.enemies) game.director.recordDestruction(enemy);
  game.director.checkRoundComplete(); game.director.update(1);
  const snapshot = game.director.getSnapshot();
  snapshot.killsBySource.player = -1; snapshot.currentEncounter.title = 'MUTATED';
  assert.equal(game.run.killsBySource.player, 6);
  assert.equal(game.run.currentEncounter.title, 'SILENT TIDE');
  assert.throws(() => game.director.nextRound('missing'), /Unknown encounter/);
  assert.equal(game.run.phase, Phase.INTERMISSION);
  assert.equal(game.run.round, 1);
  game.director.nextRound('border_patrol');
  oldEnemy.alive = true;
  assert.equal(game.director.recordDestruction(oldEnemy), false);
  assert.equal(game.director.nextRound('heavy_contact'), false);
});
