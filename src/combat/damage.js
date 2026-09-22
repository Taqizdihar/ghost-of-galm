// Existing enemies use 3 HP / 3 missile damage / 1 cannon damage.
// Wingman catalog values use ten HP per prototype combat unit. Player balance is unchanged.
export const WINGMAN_HP_PER_COMBAT_UNIT = 10;
export const toCombatDamage = damage => damage / WINGMAN_HP_PER_COMBAT_UNIT;
export const toWingmanDamage = damage => damage * WINGMAN_HP_PER_COMBAT_UNIT;

// Nearest hostile sphere along a straight beam. Never bends toward a selected target.
export function beamIntersection(origin, direction, enemies, range, beamRadius = 0) {
  let nearest = null;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const delta = enemy.mesh.position.clone().sub(origin);
    const along = delta.dot(direction);
    const radius = (enemy.collisionRadius ?? 24) + beamRadius;
    const perpendicularSq = Math.max(0, delta.lengthSq() - along * along);
    if (perpendicularSq > radius * radius || along + radius < 0) continue;
    const distance = Math.max(0, along - Math.sqrt(radius * radius - perpendicularSq));
    if (distance <= range && (!nearest || distance < nearest.distance)) nearest = { enemy, distance };
  }
  return nearest;
}
