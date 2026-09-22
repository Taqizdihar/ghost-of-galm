import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualLock } from '../src/combat/manual-lock.js';
import { radarPosition } from '../src/hud.js';

test('manual lock never acquires passively; toggling, selection, invalidity and envelope loss reset it', () => {
  const lock = createManualLock(), a = { id: 0, alive: true }, b = { id: 1, alive: true };
  lock.update(10, a, true); assert.equal(lock.getSnapshot().locked, false);
  lock.toggle(a); lock.update(.3, a, true); assert.equal(lock.getSnapshot().locked, false);
  assert.equal(lock.update(.4, a, true), true); assert.equal(lock.getSnapshot().lockedTargetId, 0);
  lock.update(.1, a, false); assert.equal(lock.getSnapshot().elapsed, 0);
  assert.equal(lock.getSnapshot().requested, true);
  lock.update(1, a, true); lock.toggle(a); assert.equal(lock.getSnapshot().requested, false);
  lock.toggle(a); lock.update(1, b, true); assert.equal(lock.getSnapshot().requested, false);
  lock.toggle(b); b.alive = false; lock.update(1, b, true); assert.equal(lock.getSnapshot().targetId, null);
  lock.toggle(b); assert.equal(lock.getSnapshot().requested, false);
});

test('square radar rotates with heading and clamps along bearing to edges and corners', () => {
  assert.deepEqual(radarPosition(16000, -16000, 0), { x: 68, y: -68 });
  assert.deepEqual(radarPosition(16000, -8000, 0), { x: 68, y: -34 });
  const northWhenEast = radarPosition(0, -4000, Math.PI / 2);
  assert.ok(Math.abs(northWhenEast.x + 37.5) < 1e-6); assert.ok(Math.abs(northWhenEast.y) < 1e-6);
});
