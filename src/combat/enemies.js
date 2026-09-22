import * as THREE from 'three';
import { createAircraft } from '../world.js';
import { expandEncounter } from '../game/encounters.js';

export function disposeEnemies(scene, enemies) {
  const geometries = new Set(), materials = new Set();
  for (const enemy of enemies) {
    scene.remove(enemy.mesh);
    enemy.mesh.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
  }
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

export function spawnEncounter(scene, encounter, player, terrainHeight) {
  const lateral = [-130, 410, -680, 140, -950, 540];
  const heights = [80, 260, -20, 340, 170, 460];
  return expandEncounter(encounter).map((member, index) => {
    const mesh = createAircraft(THREE, { enemy: true });
    const side = lateral[index % lateral.length];
    const ahead = 2350 + index * 950;
    // Place each new engagement ahead of the aircraft without teleporting the player.
    const x = THREE.MathUtils.clamp(player.position.x + Math.cos(player.heading) * side + Math.sin(player.heading) * ahead, -17000, 17000);
    const z = THREE.MathUtils.clamp(player.position.z + Math.sin(player.heading) * side - Math.cos(player.heading) * ahead, -34000, 11000);
    mesh.position.set(x, Math.max(200, player.position.y + heights[index % heights.length], terrainHeight(x, z) + 215), z);
    mesh.scale.setScalar(1.35);
    scene.add(mesh);
    return {
      id: index, mesh, name: member.aircraft, ai: member.ai, alive: true,
      phase: index * 1.72, baseY: mesh.position.y, speed: member.speed,
      heading: 0, travel: -1, health: member.health, reward: member.reward,
    };
  });
}
