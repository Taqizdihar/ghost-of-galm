import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tokenizeWords, punctuationOf, wordVariation, grainParameters, mumblePreset, createChatMumble } from '../src/comms/mumble.js';
import { createTypingProgress, typingTimeline } from '../src/ui/word-typing.js';
import { createWingmanCommandState, WingmanCommand } from '../src/aircraft/commands.js';
import { createWingman } from '../src/aircraft/wingman.js';
import { getWingmanAircraft } from '../src/aircraft/catalog.js';
import { EMPTY_MANIFEST, validateManifest, eligibleLines, weightedLine, priorityFor,
  createWingmanRadioDirector } from '../src/audio/wingman-radio.js';
import { routeConfirmedEvent } from '../src/audio/gameplay-events.js';

test('words, punctuation and visible reveal share one clock; reveal cancels callbacks', () => {
  const words = tokenizeWords('Short, longer? Yes! Wait…');
  assert.deepEqual(words.map(w => w.punctuation), ['comma', 'question', 'exclamation', 'ellipsis']);
  assert.equal(words.at(-1).isLastWord, true);
  assert.equal(punctuationOf('Fine.'), 'period');
  const shown = [], progress = createTypingProgress('One, two? Yes!', 'COMBAT', word => shown.push(word.word));
  assert.equal(progress.advance(0), 0);
  progress.advance(1000);
  assert.deepEqual(shown, ['One,', 'two?', 'Yes!']);
  progress.cancel(); progress.advance(10000);
  assert.equal(shown.length, 3);
  const early = [], cancelled = createTypingProgress('One two three', 'HANGAR', w => early.push(w.word));
  cancelled.advance(120); cancelled.cancel(); cancelled.advance(10000);
  assert.deepEqual(early, ['One']);
  assert.ok(typingTimeline('A sentence. '.repeat(100)).at(-1).revealAt <= 8000);
});

test('mumble variation is stable; punctuation and validated mode/emotion affect bounded grains', () => {
  assert.deepEqual(wordVariation('Same answer', 2), wordVariation('Same answer', 2));
  assert.notDeepEqual(wordVariation('Same answer', 1), wordVariation('Same answer', 2));
  const words = tokenizeWords('Ready? Fire!');
  const question = grainParameters('Ready? Fire!', words[0], 'COMBAT', 'urgent');
  const plain = grainParameters('Ready Fire!', { ...words[0], punctuation: 'none' }, 'COMBAT', 'urgent');
  assert.ok(question.frequency > plain.frequency);
  const exclaim = grainParameters('Ready? Fire!', words[1], 'COMBAT', 'urgent');
  const calm = grainParameters('Ready? Fire!', { ...words[1], punctuation: 'none' }, 'COMBAT', 'urgent');
  assert.ok(exclaim.gain > calm.gain);
  assert.ok(mumblePreset('COMBAT', 'urgent').gain > mumblePreset('HANGAR', 'reflective').gain);
  assert.deepEqual(mumblePreset('bad', 'malicious'), mumblePreset('HANGAR', 'calm'));
  assert.ok(question.duration < .25);
});

test('mumble follows word callbacks and global mute; cancellation stops active grain', async () => {
  let plays = 0, stops = 0;
  const audio = { muted: true, playMumbleGrain: () => { plays++; return { stop: () => stops++, ended: new Promise(() => {}) }; } };
  const mumble = createChatMumble(audio), reply = { text: 'Hello there.', mode: 'COMBAT', emotion: 'calm' };
  mumble.begin(reply); mumble.word(tokenizeWords(reply.text)[0]); assert.equal(plays, 0);
  audio.muted = false; mumble.word(tokenizeWords(reply.text)[0]); assert.equal(plays, 1);
  mumble.cancel(); assert.equal(stops, 1); assert.equal(mumble.snapshot().active, false);
  mumble.setEnabled(false); mumble.begin(reply); mumble.word(tokenizeWords(reply.text)[0]); assert.equal(plays, 1);
});

test('manifest rejects malformed entries and accepts a completely empty library', () => {
  assert.deepEqual(validateManifest(EMPTY_MANIFEST), EMPTY_MANIFEST);
  assert.deepEqual(validateManifest({ version: 0 }).pools['event.playerKill'], []);
  const valid = { id: 'pixy_evt_player_kill_001', file: 'reactions/player-kill/pixy_evt_player_kill_001.mp3',
    subtitle: 'Verified transcript.', weight: 2, cooldownMs: 10000, contexts: ['STANDARD'], preload: 'core' };
  const result = validateManifest({ ...EMPTY_MANIFEST, pools: { 'event.playerKill': [valid, { ...valid, id: 'bad' }, { ...valid, file: '../private.mp3' }] } });
  assert.equal(result.pools['event.playerKill'].length, 1);
  assert.equal(result.pools['event.playerKill'][0].id, valid.id);
  assert.equal(validateManifest({ ...EMPTY_MANIFEST, pools: { 'event.playerKill': [{ ...valid,
    id: 'pixy_amb_standard_001', file: 'ambient/standard/pixy_amb_standard_001.mp3' }] } }).pools['event.playerKill'].length, 0);
});

test('selection enforces weight, cooldown, no repeat, category, encounter and boss phase', () => {
  const lines = [
    { id: 'a', weight: 1, cooldownMs: 1000, contexts: ['STANDARD'], excludeContexts: [], encounterId: '', phaseId: '' },
    { id: 'b', weight: 3, cooldownMs: 0, contexts: ['BOSS'], excludeContexts: [], encounterId: 'air-destroyer', phaseId: 'phase-02' },
  ];
  assert.equal(weightedLine(lines, () => .1).id, 'a'); assert.equal(weightedLine(lines, () => .5).id, 'b');
  assert.equal(eligibleLines(lines, { encounterCategory: 'STANDARD', encounterId: '', phaseId: '' }, [], new Map(), 1000).length, 1);
  assert.equal(eligibleLines(lines, { encounterCategory: 'ELITE', encounterId: '', phaseId: '' }, [], new Map(), 1000).length, 0);
  assert.equal(eligibleLines(lines, { encounterCategory: 'BOSS', encounterId: 'air-destroyer', phaseId: 'phase-01' }, [], new Map(), 1000).length, 0);
  assert.equal(eligibleLines(lines, { encounterCategory: 'BOSS', encounterId: 'air-destroyer', phaseId: 'phase-02' }, [], new Map(), 1000).length, 1);
  assert.equal(eligibleLines(lines, { encounterCategory: 'STANDARD' }, ['a'], new Map([['a', 999]]), 1000).length, 0);
  assert.equal(eligibleLines(lines, { encounterCategory: 'STANDARD' }, [], new Map([['a', 500]]), 1000).length, 0);
  assert.equal(eligibleLines(lines, { encounterCategory: 'STANDARD' }, [], new Map(), 1000, 800, 500).length, 0);
  assert.ok(priorityFor('boss.air-destroyer.phase-02') > priorityFor('event.playerKill'));
  assert.ok(priorityFor('command.attack') > priorityFor('ambient.standard'));
});

test('empty director is silent and does not fetch MP3', async () => {
  const calls = [], audio = { muted: false, duckFlight: () => {}, playRadio: async (_bytes, options) => {
    calls.push(options); return { stop: () => {}, ended: new Promise(() => {}) };
  } };
  const director = createWingmanRadioDirector({ audio, fetchImpl: async url => {
    calls.push(url); return { ok: true, json: async () => EMPTY_MANIFEST, arrayBuffer: async () => new ArrayBuffer(2) };
  }, now: () => 1000, random: () => 0, getContext: () => ({ encounterCategory: 'STANDARD' }) });
  await director.load();
  assert.equal(director.trigger('event.playerKill'), false);
  assert.equal(calls.some(c => typeof c === 'string' && c.endsWith('.mp3')), false);
  assert.equal(director.snapshot().audioAvailable, false);
});

test('critical radio preempts ambient without overlapping, while lower priority is dropped', async () => {
  let stops = 0, clock = 1000;
  const audio = { muted: false, duckFlight: () => {}, playRadio: async () => ({
    stop: () => stops++, ended: new Promise(() => {}),
  }) };
  const director = createWingmanRadioDirector({ audio, now: () => clock, random: () => 0,
    getContext: () => ({ encounterCategory: 'STANDARD' }),
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }) });
  director.setManifest({ ...EMPTY_MANIFEST, pools: {
    'ambient.standard': [{ id: 'pixy_amb_standard_001', file: 'ambient/standard/pixy_amb_standard_001.mp3', subtitle: 'Ambient.', weight: 1 }],
    'event.gameOver': [{ id: 'pixy_evt_game_over_001', file: 'reactions/game-over/pixy_evt_game_over_001.mp3', subtitle: 'Critical.', weight: 1 }],
  } });
  assert.equal(director.trigger('ambient.standard'), true);
  await new Promise(resolve => setImmediate(resolve));
  clock += 1;
  assert.equal(director.trigger('event.gameOver'), true);
  assert.equal(stops, 1);
  assert.equal(director.trigger('ambient.standard'), false);
  assert.equal(director.snapshot().currentKey, 'event.gameOver');
  director.cancel(); assert.equal(stops, 1); // Critical fetch may still be pending.
});

test('wingman command state and real flight brain preserve evasion while suppressing proactive attacks', () => {
  const commands = createWingmanCommandState();
  assert.equal(commands.accept(WingmanCommand.REGROUP, false, true), false);
  assert.equal(commands.accept(WingmanCommand.REGROUP, true, false), false);
  assert.equal(commands.accept(WingmanCommand.REGROUP, true, true), true);
  assert.equal(commands.accept(WingmanCommand.REGROUP, true, true), false);
  commands.reset(); assert.equal(commands.current, WingmanCommand.ATTACK);
  const scene = new THREE.Scene(), player = { position: new THREE.Vector3(0, 460, 1400), heading: 0, pitch: 0, speed: 880 };
  let missiles = 0;
  const make = () => createWingman({ mesh: new THREE.Group(), definition: getWingmanAircraft('wingman-01'), assetStatus: 'loaded' }, scene, player, () => 0,
    { hasMissile: () => false, fireMissile: () => missiles++, fireCannon: () => {}, damageEnemy: () => {} });
  const wingman = make(), enemy = { id: 1, alive: true, speed: 150, mesh: new THREE.Group() };
  enemy.mesh.position.copy(wingman.mesh.position).add(new THREE.Vector3(0, 0, -1600));
  wingman.regroupRemaining = 0; wingman.missileCooldown = 0;
  assert.equal(wingman.setCommand(WingmanCommand.REGROUP, true), true);
  for (let i = 0; i < 30; i++) wingman.update(.05, [enemy]);
  assert.equal(wingman.target, null); assert.equal(missiles, 0);
  wingman.update(.05, [enemy], true); assert.equal(wingman.aiState, 'EVADE');
  assert.equal(wingman.setCommand(WingmanCommand.ATTACK, true), true);
  wingman.evadeRemaining = 0; wingman.regroupRemaining = 0; wingman.update(.05, [enemy]);
  assert.equal(wingman.target, enemy);
  assert.equal(make().command, WingmanCommand.ATTACK);
});

test('confirmed events route only semantic keys and remain separate from chat requests', () => {
  const recorded = [], triggered = [];
  const conversation = { record: type => { recorded.push(type); return true; } };
  const radio = { trigger: key => triggered.push(key) };
  for (const type of ['PLAYER_DESTROYED_TARGET', 'PLAYER_HIT', 'WINGMAN_HIT', 'COMBAT_STARTED', 'COMBAT_ENDED', 'GAME_OVER'])
    routeConfirmedEvent(type, conversation, radio, true);
  assert.deepEqual(triggered, ['event.playerKill', 'event.playerHit', 'event.wingmanHit', 'event.combatStart', 'event.combatEnd', 'event.gameOver']);
  routeConfirmedEvent('PLAYER_HIT', conversation, radio, false);
  assert.equal(triggered.length, 6); assert.equal(recorded.length, 7);
});
