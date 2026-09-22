import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWingman } from '../src/aircraft/wingman.js';
import { getWingmanAircraft, DEFAULT_WINGMAN_ID } from '../src/aircraft/catalog.js';
import { hardpointWorld } from '../src/aircraft/attachments.js';
import { beamIntersection, toCombatDamage, toWingmanDamage } from '../src/combat/damage.js';
import { createRunState } from '../src/game/state.js';
import { createRoundDirector } from '../src/game/round-director.js';

function setup(id = DEFAULT_WINGMAN_ID, callbacks = {}, definition = getWingmanAircraft(id)) {
  const scene = new THREE.Scene();
  const player = { position: new THREE.Vector3(0, 460, 1400), heading: 0, pitch: 0, speed: 880 };
  const events = [];
  const wingman = createWingman({ mesh: new THREE.Group(), definition, assetStatus: 'loaded' }, scene, player, () => 0, {
    hasMissile: () => false, fireMissile: (...args) => events.push(['missile', ...args]),
    fireCannon: (...args) => events.push(['cannon', ...args]), damageEnemy: (...args) => events.push(['damage', ...args]), ...callbacks,
  });
  return { scene, player, wingman, events };
}
function enemyAt(position, id = 0) {
  const mesh = new THREE.Group(); mesh.position.copy(position);
  return { id, alive: true, mesh, collisionRadius: 24, health: 3, reward: 1200, speed: 150 };
}

test('catalog stats and combat adapter preserve the existing player/enemy scale', () => {
  const ghost = getWingmanAircraft(DEFAULT_WINGMAN_ID), pixy = getWingmanAircraft('wingman-02');
  assert.equal(ghost.name, 'The Ghost of Galm'); assert.equal(ghost.maxHP, 1500);
  assert.equal(pixy.maxHP, 2000); assert.equal(ghost.weapons.missile.damage, 30);
  assert.equal(ghost.weapons.cannon.damage, 3);
  assert.equal(toCombatDamage(30), 3); assert.equal(toCombatDamage(3), .3);
  assert.equal(toWingmanDamage(24), 240);
});

test('hardpoints follow translated, rotated and scaled aircraft without mutating the catalog', () => {
  const { wingman } = setup();
  wingman.mesh.position.set(100, 200, 300); wingman.mesh.rotation.set(0, Math.PI / 2, 0); wingman.mesh.scale.setScalar(2);
  const point = hardpointWorld(wingman, 'missileLeft');
  assert.ok(point.distanceTo(new THREE.Vector3(102, 198, 308.6)) < 1e-6);
  assert.deepEqual(wingman.definition.hardpoints.missileLeft, [-4.3, -1, 1]);
});

test('formation is smooth and deterministic; threats trigger evasion and target loss regroups', () => {
  const a = setup(), b = setup();
  for (let i = 0; i < 400; i++) {
    for (const game of [a, b]) {
      game.player.position.z -= game.player.speed / 3.6 * .05;
      const before = game.wingman.mesh.position.clone(); game.wingman.update(.05, []);
      assert.ok(before.distanceTo(game.wingman.mesh.position) < 25);
      assert.ok(game.wingman.mesh.position.distanceTo(game.player.position) > 40);
      assert.ok(game.wingman.mesh.position.y >= 120);
    }
  }
  assert.deepEqual(a.wingman.getSnapshot(), b.wingman.getSnapshot());
  assert.equal(a.wingman.aiState, 'FORMATION');
  const enemy = enemyAt(a.wingman.mesh.position.clone().add(new THREE.Vector3(0, 0, -2200)));
  a.wingman.update(.05, [enemy]); assert.equal(a.wingman.aiState, 'ENGAGE');
  a.wingman.update(.05, [enemy], true); assert.equal(a.wingman.aiState, 'EVADE');
  enemy.alive = false;
  for (let i = 0; i < 40; i++) a.wingman.update(.05, [enemy]);
  assert.equal(a.wingman.target, null);
  assert.ok(['REGROUP', 'FORMATION'].includes(a.wingman.aiState));
});

test('wingman missiles and cannon use wingman damage ownership; final kill clears through director', () => {
  const run = createRunState(); let enemy;
  const director = createRoundDirector(run, () => [enemy]);
  const game = setup(DEFAULT_WINGMAN_ID, {
    fireMissile: (origin, forward, target, damage) => { assert.equal(damage, 3); assert.ok(origin.distanceTo(game.wingman.mesh.position) < 20); director.recordDestruction(target, 'wingman'); },
  });
  enemy = enemyAt(game.wingman.mesh.position.clone().add(new THREE.Vector3(0, 0, -2000)));
  director.startRun(); game.wingman.regroupRemaining = 0; game.wingman.missileCooldown = 0;
  game.wingman.update(.05, [enemy]);
  assert.equal(run.killsBySource.wingman, 1); assert.equal(director.checkRoundComplete(), true);
  assert.equal(run.phase, 'ROUND_CLEAR');
  const cannonGame = setup(DEFAULT_WINGMAN_ID, { hasMissile: () => true });
  const close = enemyAt(cannonGame.wingman.mesh.position.clone().add(new THREE.Vector3(0, 0, -700)));
  cannonGame.wingman.regroupRemaining = 0; cannonGame.wingman.update(.05, [close]);
  assert.ok(cannonGame.events.some(([kind, target, damage, source]) => kind === 'damage' && target === close && damage === .3 && source === 'wingman'));
});

test('linear beam hits only the nearest living hostile intersecting its forward ray', () => {
  const origin = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, -1);
  const near = enemyAt(new THREE.Vector3(0, 0, -500)), far = enemyAt(new THREE.Vector3(0, 0, -1000), 1);
  const off = enemyAt(new THREE.Vector3(100, 0, -100)), behind = enemyAt(new THREE.Vector3(0, 0, 500));
  assert.equal(beamIntersection(origin, forward, [off, far, behind, near], 3200).enemy, near);
  near.alive = false;
  assert.equal(beamIntersection(origin, forward, [near, far], 3200).enemy, far);
  assert.equal(beamIntersection(origin, forward, [off, behind, far], 800), null);
});

test('laser delivers 50 HP/sec for at most five seconds, respects 120 second cooldown, and stops on destruction', () => {
  const definition = structuredClone(getWingmanAircraft('wingman-02'));
  definition.weapons.cannon.range = 0; definition.weapons.missile.range = 0;
  const game = setup('wingman-02', {}, definition), wingman = game.wingman;
  const target = enemyAt(wingman.mesh.position.clone().add(new THREE.Vector3(0, 0, -2500)));
  wingman.regroupRemaining = 0;
  for (let i = 0; i < 100; i++) wingman.update(.05, [target]);
  const dealt = game.events.filter(e => e[0] === 'damage').reduce((sum, e) => sum + e[2], 0);
  assert.ok(Math.abs(dealt - toCombatDamage(50 * 5)) < 1e-6);
  assert.ok(wingman.laserRemaining < 1e-6);
  assert.ok(wingman.laserCooldown > 115 && wingman.laserCooldown < 116);
  wingman.update(.05, [target]); const count = game.events.length;
  for (let i = 0; i < 40; i++) wingman.update(.05, [target]);
  assert.equal(game.events.length, count);
  wingman.laserCooldown = 0; wingman.laserRemaining = 4;
  wingman.damage(2000); wingman.update(.05, [target]);
  assert.equal(wingman.aiState, 'DESTROYED'); assert.equal(wingman.getSnapshot().weapons.laser.active, false);
  assert.equal(wingman.laserRemaining, 0);
});

test('damage, loss and cooldowns survive combat suspension; snapshots remain detached', () => {
  const { wingman } = setup('wingman-02');
  wingman.damage(240); wingman.laserCooldown = 90; wingman.laserRemaining = 3;
  wingman.stopCombat(); assert.equal(wingman.hp, 1760); assert.equal(wingman.laserCooldown, 90);
  assert.equal(wingman.laserRemaining, 0);
  const snapshot = wingman.getSnapshot(); snapshot.position[0] = 999; snapshot.weapons.laser.cooldown = 0;
  assert.notEqual(wingman.mesh.position.x, 999); assert.equal(wingman.laserCooldown, 90);
  wingman.damage(99999); wingman.stopCombat(); wingman.update(1, []);
  assert.equal(wingman.alive, false); assert.equal(wingman.hp, 0); assert.equal(wingman.mesh.visible, false);
});
