import * as THREE from 'three';
import { aircraftForward, hardpointWorld } from './attachments.js';
import { beamIntersection, toCombatDamage } from '../combat/damage.js';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

export function createWingman(asset, scene, player, terrainHeight, combat) {
  const wingman = {
    ...asset, hp: asset.definition.maxHP, alive: true, aiState: 'FORMATION', target: null,
    missileCooldown: 3, cannonCooldown: 0, laserCooldown: 0, laserRemaining: 0,
    speed: player.speed / 3.6, age: 0, evadeRemaining: 0, regroupRemaining: 4,
  };
  const definition = wingman.definition;
  const velocity = new THREE.Vector3();
  const destination = new THREE.Vector3(), aim = new THREE.Vector3();
  const basis = new THREE.Matrix4(), orientation = new THREE.Quaternion();
  const laser = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xff526a, transparent: true, opacity: .85, depthWrite: false }));
  laser.visible = false; laser.frustumCulled = false;
  if (definition.weapons.laser) scene.add(laser);
  let missileSide = false;
  let laserHitCooldown = 0;

  function formationPosition() {
    return destination.set(75, 28, 110).applyAxisAngle(UP, -player.heading).add(player.position);
  }
  wingman.mesh.position.copy(formationPosition());
  wingman.mesh.position.y = Math.max(wingman.mesh.position.y, terrainHeight(destination.x, destination.z) + 160);
  wingman.mesh.rotation.set(player.pitch, -player.heading, 0, 'YXZ');
  scene.add(wingman.mesh);

  wingman.stopCombat = () => {
    wingman.laserRemaining = 0; laser.visible = false; wingman.target = null;
    wingman.regroupRemaining = 3;
    wingman.aiState = wingman.alive ? 'REGROUP' : 'DESTROYED';
  };
  wingman.damage = amount => {
    if (!wingman.alive || !Number.isFinite(amount) || amount <= 0) return false;
    wingman.hp = Math.max(0, wingman.hp - amount);
    wingman.evadeRemaining = 4;
    if (!wingman.hp) {
      wingman.alive = false; wingman.mesh.visible = false; wingman.stopCombat();
      combat.onDestroyed?.(hardpointWorld(wingman, 'impact'));
    }
    return true;
  };
  wingman.dispose = () => { laser.removeFromParent(); laser.geometry.dispose(); laser.material.dispose(); };

  wingman.update = (dt, enemies, underThreat = false) => {
    if (!wingman.alive) return;
    wingman.age += dt;
    for (const timer of ['missileCooldown', 'cannonCooldown', 'laserCooldown', 'evadeRemaining', 'regroupRemaining']) wingman[timer] = Math.max(0, wingman[timer] - dt);
    if (underThreat) wingman.evadeRemaining = Math.max(wingman.evadeRemaining, 1.5);
    const position = wingman.mesh.position;
    const playerDistance = position.distanceTo(player.position);
    if (wingman.target && (!wingman.target.alive || position.distanceTo(wingman.target.mesh.position) > 9500)) {
      wingman.target = null; wingman.regroupRemaining = 2;
    }
    if (!wingman.target && wingman.regroupRemaining <= 0 && playerDistance < 8000) {
      // Stable distance/id ordering; no random decisions or network inference.
      wingman.target = enemies.filter(e => e.alive && e.mesh.position.distanceTo(player.position) < 8500)
        .sort((a, b) => position.distanceToSquared(a.mesh.position) - position.distanceToSquared(b.mesh.position) || a.id - b.id)[0] || null;
    }
    formationPosition();
    if (wingman.evadeRemaining > 0) {
      wingman.aiState = 'EVADE';
      const side = Math.floor(wingman.age / 4) % 2 ? 1 : -1;
      destination.copy(position).add(aircraftForward(wingman.mesh).multiplyScalar(700));
      destination.x += side * 500; destination.y += 220;
    } else if (wingman.target && playerDistance < 9500 && wingman.regroupRemaining <= 0) {
      wingman.aiState = 'ENGAGE'; destination.copy(wingman.target.mesh.position);
    } else {
      wingman.aiState = position.distanceTo(destination) > 220 ? 'REGROUP' : 'FORMATION';
      if (playerDistance >= 9500) { wingman.target = null; wingman.regroupRemaining = 3; }
    }
    // Look ahead over terrain, then limit the next step to preserve safe clearance.
    destination.y = Math.max(destination.y, terrainHeight(destination.x, destination.z) + 170, 170);
    const ahead = position.clone().addScaledVector(aircraftForward(wingman.mesh), 900);
    const aheadGround = terrainHeight(ahead.x, ahead.z);
    if (aheadGround + 220 > position.y) destination.y = Math.max(destination.y, aheadGround + 300);
    const distance = position.distanceTo(destination);
    aim.copy(destination).sub(position);
    let desiredSpeed;
    if (wingman.aiState === 'FORMATION' || wingman.aiState === 'REGROUP') {
      const playerVelocity = new THREE.Vector3(Math.sin(player.heading) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.heading) * Math.cos(player.pitch)).multiplyScalar(player.speed / 3.6);
      aim.multiplyScalar(.7).add(playerVelocity);
      desiredSpeed = clamp(aim.length(), 100, 430);
    } else desiredSpeed = wingman.aiState === 'EVADE' ? 320 : clamp((wingman.target?.speed || 150) + (distance - 500) * .3, 110, 370);
    aim.normalize();
    basis.lookAt(new THREE.Vector3(), aim, UP); orientation.setFromRotationMatrix(basis);
    wingman.mesh.quaternion.rotateTowards(orientation, dt * (wingman.aiState === 'EVADE' ? 1.3 : .95));
    wingman.speed = THREE.MathUtils.damp(wingman.speed, desiredSpeed, 2, dt);
    aircraftForward(wingman.mesh, velocity).multiplyScalar(wingman.speed * dt);
    const next = position.clone().add(velocity);
    const floor = Math.max(0, terrainHeight(next.x, next.z)) + 120;
    if (next.y < floor) next.y = Math.max(terrainHeight(next.x, next.z) + 30, Math.min(floor, position.y + 180 * dt));
    // Separation steering near GALM 1. No friendly collision or damage.
    const separation = next.clone().sub(player.position);
    if (separation.length() < 45) next.addScaledVector(separation.lengthSq() ? separation.normalize() : new THREE.Vector3(1, 0, 0), 80 * dt);
    position.copy(next);
    wingman.mesh.updateMatrixWorld(true);

    const target = wingman.target;
    const forward = aircraftForward(wingman.mesh);
    const delta = target?.mesh.position.clone().sub(position);
    const range = delta?.length() ?? Infinity;
    const dot = delta?.normalize().dot(forward) ?? -1;
    const canEngage = wingman.aiState === 'ENGAGE' && target?.alive;
    const { missile, cannon, laser: special } = definition.weapons;
    if (canEngage && !wingman.missileCooldown && range > 250 && range < missile.range && dot > missile.minDot && !combat.hasMissile(target)) {
      missileSide = !missileSide;
      combat.fireMissile(hardpointWorld(wingman, missileSide ? 'missileLeft' : 'missileRight'), forward, target, toCombatDamage(missile.damage));
      wingman.missileCooldown = missile.cooldown;
    }
    if (canEngage && !wingman.cannonCooldown && range < cannon.range && dot > cannon.minDot) {
      const origin = hardpointWorld(wingman, 'cannon');
      const hit = beamIntersection(origin, forward, enemies, cannon.range);
      combat.fireCannon(origin, forward);
      if (hit) combat.damageEnemy(hit.enemy, toCombatDamage(cannon.damage), 'wingman');
      wingman.cannonCooldown = cannon.cooldown;
    }
    if (!special) return;
    const origin = hardpointWorld(wingman, 'laser');
    const hit = beamIntersection(origin, forward, enemies, special.range, special.radius);
    if (canEngage && !wingman.laserCooldown && !wingman.laserRemaining && hit?.enemy === target) {
      wingman.laserRemaining = special.duration; wingman.laserCooldown = special.cooldown;
    }
    const activeTime = Math.min(dt, wingman.laserRemaining);
    laserHitCooldown = Math.max(0, laserHitCooldown - dt);
    laser.visible = activeTime > 0;
    if (laser.visible) {
      const length = hit?.distance ?? special.range;
      laser.position.copy(origin).addScaledVector(forward, length / 2);
      laser.quaternion.setFromUnitVectors(UP, forward); laser.scale.set(.8, length, .8);
      if (hit) {
        combat.damageEnemy(hit.enemy, toCombatDamage(special.damagePerSecond * activeTime), 'wingman');
        if (!laserHitCooldown) { combat.laserHit?.(origin.clone().addScaledVector(forward, length)); laserHitCooldown = .15; }
      }
      wingman.laserRemaining = Math.max(0, wingman.laserRemaining - dt);
    }
  };
  wingman.getSnapshot = () => ({
    aircraftId: definition.id, name: definition.name, hp: wingman.hp, maxHP: definition.maxHP,
    alive: wingman.alive, aiState: wingman.aiState, targetId: wingman.target?.alive ? wingman.target.id : null,
    position: wingman.mesh.position.toArray(), forward: aircraftForward(wingman.mesh).toArray(),
    assetStatus: wingman.assetStatus, normalization: wingman.normalization ? structuredClone(wingman.normalization) : null,
    weapons: { missileCooldown: wingman.missileCooldown, cannonCooldown: wingman.cannonCooldown,
      laser: definition.weapons.laser ? { active: laser.visible, remaining: wingman.laserRemaining, cooldown: wingman.laserCooldown } : null },
  });
  return wingman;
}
