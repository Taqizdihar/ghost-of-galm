import { Phase } from '../game/state.js';

export const EVENTS = Object.freeze(['PLAYER_DESTROYED_TARGET', 'PLAYER_HIT', 'WINGMAN_HIT',
  'DETECTED_HOSTILE_DESTROYED', 'COMBAT_STARTED', 'COMBAT_ENDED', 'GAME_OVER']);

export function conversationMode(phase) {
  if (phase === Phase.COMBAT || phase === Phase.GAME_OVER) return 'COMBAT';
  if (phase === Phase.INTERMISSION || phase === Phase.ROUND_CLEAR) return 'INTERMISSION';
  return 'HANGAR'; // READY is a preflight break; pause retains its underlying phase.
}

// A conservative sensor boundary for conversation, independent of radar edge markers.
export function isDetectedHostile(enemy, observer) {
  if (!enemy.alive || enemy.hidden === true || enemy.detected === false) return false;
  const p = enemy.mesh?.position;
  return !!p && Math.hypot(p.x - observer.x, p.y - observer.y, p.z - observer.z) <= 8000;
}

export function buildWingmanContext({ phase, wingman, observer, enemies = [], selectedId, events = [] }) {
  const active = [Phase.COMBAT, Phase.ROUND_CLEAR, Phase.INTERMISSION, Phase.GAME_OVER].includes(phase);
  return {
    mode: conversationMode(phase),
    wingman: wingman ? {
      aircraft: wingman.definition.name,
      hp: Math.ceil(wingman.hp), maxHP: wingman.definition.maxHP,
      alive: wingman.alive, state: wingman.aiState,
      special: !wingman.definition.weapons.laser ? 'NONE' : wingman.laserRemaining > 0 ? 'ACTIVE' : wingman.laserCooldown > 0 ? 'COOLDOWN' : 'READY',
    } : null,
    contacts: active ? enemies.filter(e => isDetectedHostile(e, observer)).map(e => {
      const p = e.mesh.position, dx = p.x - observer.x, dz = p.z - observer.z;
      return {
        type: ['MIG-29', 'SU-27'].includes(e.name) ? e.name : 'UNKNOWN',
        bearing: (Math.round(Math.atan2(dx, -dz) * 180 / Math.PI / 10) * 10 + 360) % 360,
        range: Math.round(Math.hypot(dx, p.y - observer.y, dz) / 500) * 500,
        selected: e.id === selectedId,
      };
    }).sort((a, b) => a.range - b.range).slice(0, 16) : [],
    events: events.filter(event => EVENTS.includes(event)).slice(-8),
  };
}
