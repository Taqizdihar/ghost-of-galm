const catalog = [
  {
    id: 'silent_tide', category: 'STANDARD', title: 'SILENT TIDE',
    description: 'Clear a mixed patrol from the coastline.',
    enemies: [
      { aircraft: 'MIG-29', count: 10, ai: 'patrol', health: 3, speed: 118, reward: 1200 },
      { aircraft: 'SU-27', count: 10, ai: 'patrol', health: 3, speed: 125, reward: 1200 },
    ],
  },
  {
    id: 'border_patrol', category: 'STANDARD', title: 'BORDER PATROL',
    description: 'A light patrol. Three contacts, standard airframes.',
    enemies: [{ aircraft: 'MIG-29', count: 3, ai: 'patrol', health: 3, speed: 118, reward: 1200 }],
  },
  {
    id: 'elite_flight', category: 'ELITE', title: 'ELITE FLIGHT',
    description: 'Prototype: four faster, reinforced fighters using patrol behavior.',
    enemies: [{ aircraft: 'SU-27', count: 4, ai: 'patrol', health: 6, speed: 160, reward: 2200 }],
  },
  {
    id: 'heavy_contact', category: 'BOSS', title: 'HEAVY CONTACT',
    description: 'Prototype: one hardened fighter. Standard weapons and patrol behavior.',
    enemies: [{ aircraft: 'SU-27', count: 1, ai: 'patrol', health: 12, speed: 135, reward: 6000 }],
  },
];

// Catalog data is immutable; snapshots can safely copy only the public summary.
export const encounters = Object.freeze(catalog.map(encounter => Object.freeze({
  ...encounter, enemies: Object.freeze(encounter.enemies.map(group => Object.freeze(group))),
})));
export const DEFAULT_ENCOUNTER_ID = 'silent_tide';
export const enemyCount = encounter => encounter.enemies.reduce((sum, group) => sum + group.count, 0);
export function getEncounter(id) {
  const encounter = encounters.find(entry => entry.id === id);
  if (!encounter) throw new Error(`Unknown encounter: ${id}`);
  return encounter;
}

// Interleave groups to retain the original mixed patrol ordering.
export function expandEncounter(encounter) {
  const members = [];
  for (let index = 0; index < Math.max(...encounter.enemies.map(group => group.count)); index++) {
    for (const group of encounter.enemies) {
      if (index < group.count) members.push({ ...group, speed: group.speed + index * 14 });
    }
  }
  return members;
}
