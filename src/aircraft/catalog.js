function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

// All attachments use the normalized wrapper: +X right, +Y up, -Z forward.
export const playerAircraft = freeze({
  id: 'f15c', name: 'F-15C Eagle', type: 'procedural', collisionRadius: 12, maxHP: 100, missileCapacity: 120,
  hardpoints: { missileLeft: [-3.45, -.8, 1], missileRight: [3.45, -.8, 1], cannon: [1, 0, -10], exhaust: [0, -.28, 10], impact: [0, 0, 0] },
});
const standardWeapons = {
  missile: { damage: 30, cooldown: 8, range: 6000, minDot: .985 },
  cannon: { damage: 3, cooldown: .12, range: 1400, minDot: .999 },
};
export const wingmanAircraft = freeze([
  {
    id: 'wingman-01', name: 'The Ghost of Galm', type: 'gltf',
    path: 'assets/aircraft/wingman/wingman-01.glb', maxHP: 1500, collisionRadius: 14,
    visual: { rotation: [0, Math.PI, 0], length: 24, offset: [0, 0, 0], hiddenNodes: [] },
    hardpoints: { missileLeft: [-4.3, -1, 1], missileRight: [4.3, -1, 1], cannon: [1, 0, -9], exhaust: [0, -.5, 10], impact: [0, 0, 0] },
    weapons: { ...standardWeapons },
  },
  {
    id: 'wingman-02', name: "Pixy's Prototype", type: 'gltf',
    path: 'assets/aircraft/wingman/wingman-02.glb', maxHP: 2000, collisionRadius: 16,
    visual: { rotation: [0, Math.PI, 0], length: 27, offset: [0, 0, 0], hiddenNodes: ['mrgn_landingOn', 'mrgn_landingOnLight', 'mrgn_refuelOn'] },
    hardpoints: { missileLeft: [-4, -1, 1], missileRight: [4, -1, 1], cannon: [1, .2, -9], laser: [0, 1.92, 1.66], exhaust: [0, 0, 10], impact: [0, 0, 0] },
    weapons: { ...standardWeapons, laser: { damagePerSecond: 50, duration: 5, cooldown: 120, range: 3200, radius: 2 } },
  },
]);
export const DEFAULT_WINGMAN_ID = 'wingman-01';
export function getWingmanAircraft(id) {
  const entry = wingmanAircraft.find(aircraft => aircraft.id === id);
  if (!entry) throw new Error(`Unknown wingman aircraft: ${id}`);
  return entry;
}
