import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWingmanContext, conversationMode } from '../src/comms/context.js';
import { boundedHistory, createConversation } from '../src/comms/conversation.js';
import { requestWingman, UNAVAILABLE } from '../src/comms/wingman-client.js';
import { isTextEntry } from '../src/ui/wingman-chat.js';
import { FlightAudio } from '../src/audio.js';

const context = () => ({ mode: 'COMBAT', wingman: null, contacts: [], events: [] });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('context explicitly omits private telemetry and undetected/hidden/dead/out-of-range hostiles', () => {
  const enemy = (id, overrides = {}) => ({ id, alive: true, name: 'MIG-29', health: 3,
    ai: 'secret', reward: 1200, mesh: { position: { x: 0, y: 500, z: -2345 } }, ...overrides });
  const input = {
    phase: 'COMBAT', observer: { x: 0, y: 500, z: 0, health: 37, missiles: 19 },
    score: 1000, player: { health: 37, missiles: 19 }, selectedId: 0,
    enemies: [enemy(0), enemy(1, { detected: false }), enemy(2, { hidden: true }), enemy(3, { alive: false }),
      enemy(4, { mesh: { position: { x: 0, y: 500, z: -8001 } } })],
    wingman: { definition: { name: 'The Ghost of Galm', maxHP: 1500, weapons: {} }, hp: 1200, alive: true,
      aiState: 'ENGAGE', target: 'hidden target', position: { secret: 3 } }, events: ['PLAYER_HIT', 'PLAYER_HP_37'],
  };
  const result = buildWingmanContext(input);
  assert.deepEqual(result, { mode: 'COMBAT', wingman: { aircraft: 'The Ghost of Galm', hp: 1200, maxHP: 1500,
    alive: true, state: 'ENGAGE', special: 'NONE' }, contacts: [{ type: 'MIG-29', bearing: 0, range: 2500, selected: true }], events: ['PLAYER_HIT'] });
  result.wingman.hp = 0; result.contacts[0].type = 'UNKNOWN';
  assert.equal(input.wingman.hp, 1200); assert.equal(input.enemies[0].name, 'MIG-29');
  assert.deepEqual(buildWingmanContext({ ...input, phase: 'HANGAR' }).contacts, []);
});

test('mode mapping preserves real progression including pause underlying phase', () => {
  assert.deepEqual(['READY', 'HANGAR', 'COMBAT', 'ROUND_CLEAR', 'INTERMISSION', 'GAME_OVER'].map(conversationMode),
    ['HANGAR', 'HANGAR', 'COMBAT', 'INTERMISSION', 'INTERMISSION', 'COMBAT']);
});

test('history is detached and bounded by messages and characters', () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: String(i), secret: 1 }));
  const result = boundedHistory(turns);
  assert.equal(result.length, 12); assert.equal(result[0].content, '8'); assert.equal(result[0].secret, undefined);
  result[0].content = 'changed'; assert.equal(turns[8].content, '8');
  assert.equal(boundedHistory(turns.map(t => ({ ...t, content: 'a'.repeat(1000) }))).length, 6);
});

test('network rejects HTTP, malformed, reasoning and mode mismatch; supports timeout and abort', async () => {
  const payload = { context: context(), message: 'Hi' };
  for (const data of [null, {}, { text: ' ', mode: 'COMBAT' }, { text: 'Hello', mode: 'HANGAR' }, { text: '<think>secret', mode: 'COMBAT' }]) {
    await assert.rejects(requestWingman(payload, { fetchImpl: async () => ({ ok: true, json: async () => data }) }));
  }
  await assert.rejects(requestWingman(payload, { fetchImpl: async () => ({ ok: false }) }));
  const fetchImpl = (_url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(new Error('aborted'));
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await assert.rejects(requestWingman(payload, { fetchImpl, timeoutMs: 5 }));
  const controller = new AbortController();
  const request = requestWingman(payload, { fetchImpl, signal: controller.signal });
  controller.abort(); await assert.rejects(request);
});

test('duplicate submit, stale completion, failure state and player precedence', async () => {
  let resolve, latest, failures = 0, calls = 0;
  const conversation = createConversation({ getContext: context, onChange: state => { latest = state; },
    onFailure: () => failures++, request: () => { calls++; return new Promise(r => { resolve = r; }); } });
  const first = conversation.send('Hello');
  assert.equal(await conversation.send('Duplicate'), false); assert.equal(calls, 1);
  conversation.setScope('HANGAR'); resolve({ text: 'Stale' }); await first;
  assert.equal(latest.text, ''); assert.equal(latest.pending, false);
  const broken = createConversation({ getContext: context, onChange: state => { latest = state; },
    onFailure: () => failures++, request: async () => { throw new Error('offline'); } });
  await broken.send('You there?');
  assert.equal(latest.error, UNAVAILABLE); assert.equal(latest.text, ''); assert.equal(failures, 1);
  broken.setScope('HANGAR'); assert.equal(latest.error, UNAVAILABLE);
});

test('confirmed events remain sanitized context without automatic LLM requests', async () => {
  let time = 0, calls = [], latest;
  const conversation = createConversation({ now: () => time, getContext: events => ({ ...context(), events }),
    onChange: state => { latest = state; }, request: async payload => { calls.push(payload); return { text: 'Mock answer.', mode: 'COMBAT' }; } });
  assert.equal(conversation.record('PLAYER_HIT', { id: 'hit1' }), true);
  await flush();
  assert.equal(conversation.record('PLAYER_HIT', { id: 'hit1' }), false);
  assert.equal(conversation.record('WINGMAN_HIT', { id: 'hit2' }), true);
  assert.equal(calls.length, 0);
  time = 19000;
  conversation.record('PLAYER_DESTROYED_TARGET', { id: 'kill1' }); await flush();
  conversation.record('GAME_OVER', { id: 'gameover' }); await flush();
  assert.equal(calls.length, 0);
  await conversation.send('What happened?');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].event, undefined);
  assert.deepEqual(calls[0].context.events, ['PLAYER_HIT', 'WINGMAN_HIT', 'PLAYER_DESTROYED_TARGET', 'GAME_OVER']);
  assert.equal(latest.pending, false);
  assert.equal(conversation.record('MADE_UP'), false);
});

test('text entries are protected; radio static uses existing mute/device guard', () => {
  assert.equal(isTextEntry({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextEntry({ isContentEditable: true }), true);
  assert.equal(isTextEntry({ tagName: 'BUTTON' }), false);
  const audio = new FlightAudio(); let noises = 0;
  audio._noise = () => noises++;
  audio.play('radio-static'); assert.equal(noises, 0);
  audio.context = { state: 'running', currentTime: 1 };
  audio.muted = true; audio.play('radio-static'); assert.equal(noises, 0);
  audio.muted = false; audio.play('radio-static'); assert.equal(noises, 1);
  audio._noise = () => { throw new Error('device lost'); };
  audio.context.currentTime = 2;
  assert.doesNotThrow(() => audio.play('radio-static'));
});
