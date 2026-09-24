export const RADIO_EVENT = Object.freeze({
  PLAYER_DESTROYED_TARGET: 'event.playerKill', PLAYER_HIT: 'event.playerHit',
  WINGMAN_HIT: 'event.wingmanHit', COMBAT_STARTED: 'event.combatStart',
  COMBAT_ENDED: 'event.combatEnd', GAME_OVER: 'event.gameOver',
});

export function routeConfirmedEvent(type, conversation, radio, wingmanAlive) {
  const recorded = conversation.record(type);
  const key = RADIO_EVENT[type];
  if (key && wingmanAlive) radio.trigger(key);
  return recorded;
}
