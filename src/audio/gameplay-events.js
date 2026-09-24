export const RADIO_EVENT = Object.freeze({
  PLAYER_DESTROYED_TARGET: 'event.playerKill', PLAYER_HIT: 'event.playerHit',
  PLAYER_DANGER: 'event.playerDanger', WINGMAN_KILL: 'event.wingmanKill',
  WINGMAN_MISSILE: 'event.wingmanMissile',
  WINGMAN_HIT: 'event.wingmanHit', COMBAT_STARTED: 'event.combatStart',
  COMBAT_ENDED: 'event.combatEnd', GAME_OVER: 'event.gameOver',
});

export function routeConfirmedEvent(type, conversation, radio, wingmanAlive) {
  const recorded = conversation.record(type);
  const key = RADIO_EVENT[type];
  // Radio receives only calls from confirmed local gameplay hooks. The M6 chat
  // context may decline newer radio-only event names without suppressing audio.
  if (key && wingmanAlive) radio.trigger(key);
  return recorded;
}
