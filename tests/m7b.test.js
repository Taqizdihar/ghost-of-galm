import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildManifest, parseRecordingScript } from '../scripts/build-pixy-manifest.mjs';
import { RADIO_KEYS, RADIO_PATH_PREFIX, EMPTY_MANIFEST, validateManifest, eligibleLines,
  weightedLine, selectAmbientPool, createWingmanRadioDirector } from '../src/audio/wingman-radio.js';
import { createWingmanChannel } from '../src/comms/wingman-channel.js';
import { createConversation } from '../src/comms/conversation.js';
import { createChatMumble, tokenizeWords } from '../src/comms/mumble.js';
import { createWingmanCommandState, WingmanCommand } from '../src/aircraft/commands.js';
import { getEncounter, expandEncounter, enemyCount } from '../src/game/encounters.js';
import { createRunState, Phase } from '../src/game/state.js';
import { createRoundDirector } from '../src/game/round-director.js';
import { playerAircraft } from '../src/aircraft/catalog.js';
import { buildWingmanContext } from '../src/comms/context.js';
import { radarPosition } from '../src/hud.js';
import { routeConfirmedEvent } from '../src/audio/gameplay-events.js';
import * as THREE from 'three';
import { spawnEncounter, disposeEnemies } from '../src/combat/enemies.js';

const root = path.resolve('public/assets/audio/wingman/pixy');
const flush = () => new Promise(resolve => setImmediate(resolve));
const line = (key, number = 1) => {
  const id = `${path.posix.basename(RADIO_PATH_PREFIX[key])}${String(number).padStart(3, '0')}`;
  return { id, file: `${RADIO_PATH_PREFIX[key]}${String(number).padStart(3, '0')}.mp3`, subtitle: `Line ${number}.`, weight: 1, cooldownMs: 0,
    contexts: ['STANDARD'], excludeContexts: ['ELITE', 'BOSS'], preload: 'lazy' };
};
function fakeAudio() {
  const active = [];
  return { muted: false, active, duckFlight() {}, async playRadio() {
    let finish;
    const ended = new Promise(resolve => { finish = resolve; });
    const playback = { ended, duration: 2, startedAt: 0, stop: finish, finish };
    active.push(playback); return playback;
  } };
}

test('recording script maps every real generic MP3 to an exact subtitle and deterministic manifest', async () => {
  const sample = parseRecordingScript('**Voiceline:** “Copy, Kid!”\n**Suggested MP3:** `pixy_cmd_attack_001.mp3`\n**Save to:** `public/assets/audio/wingman/pixy/commands/attack/pixy_cmd_attack_001.mp3`');
  assert.equal(sample.entries[0].voiceline, 'Copy, Kid!');
  assert.deepEqual(sample.issues, []);
  const markdown = await readFile(path.join(root, 'Pixy Voiceline Script.md'), 'utf8');
  const parsed = parseRecordingScript(markdown);
  assert.equal(parsed.issues.length, 0);
  assert.ok(parsed.entries.length >= 186);
  assert.equal(parsed.entries.find(e => e.filename === 'pixy_evt_player_kill_001.mp3').voiceline, 'Clean.');
  const first = await buildManifest(), second = await buildManifest();
  assert.deepEqual(first.issues, []);
  assert.equal(first.files.length, 186);
  assert.equal(first.output, second.output);
  assert.equal(first.output, first.previous);
  assert.deepEqual(Object.fromEntries(Object.entries(first.manifest.pools).map(([key, entries]) => [key, entries.length])), {
    'command.attack': 12, 'command.regroup': 12, 'command.attackTarget': 10, 'command.defend': 10,
    'event.playerKill': 15, 'event.playerHit': 12, 'event.playerDanger': 12, 'event.wingmanHit': 12,
    'event.wingmanKill': 12, 'event.wingmanMissile': 12, 'event.combatStart': 10, 'event.combatEnd': 10,
    'event.gameOver': 8, 'ambient.standard': 15, 'ambient.pressure': 12, 'ambient.calm': 12,
  });
  const ids = new Set(), files = new Set();
  for (const [key, entries] of Object.entries(first.manifest.pools)) for (const entry of entries) {
    assert.ok(entry.file.startsWith(RADIO_PATH_PREFIX[key]));
    assert.ok(!ids.has(entry.id) && !files.has(entry.file)); ids.add(entry.id); files.add(entry.file);
    assert.ok(entry.file.endsWith('.mp3') && !entry.file.includes('..'));
    assert.deepEqual(entry.contexts, ['STANDARD']); assert.deepEqual(entry.excludeContexts, ['ELITE', 'BOSS']);
    assert.equal(entry.subtitle, parsed.entries.find(e => e.filename === path.posix.basename(entry.file)).voiceline);
    await access(path.join(root, entry.file));
  }
  assert.equal(ids.size, 186);
  assert.deepEqual(Object.keys(first.manifest.pools), RADIO_KEYS);
  assert.equal(validateManifest(first.manifest).pools['event.playerKill'].length, 15);
  assert.equal(first.output.includes('elite/'), false);
  assert.equal(first.output.includes('bosses/'), false);
});

test('unsafe and mismatched paths are rejected; missing optional clip releases radio', async () => {
  const good = line('command.regroup');
  const invalid = { ...good, file: '../private.mp3' };
  assert.equal(validateManifest({ ...EMPTY_MANIFEST, pools: { 'command.regroup': [invalid] } }).pools['command.regroup'].length, 0);
  assert.equal(validateManifest({ ...EMPTY_MANIFEST, pools: { 'event.playerHit': [good] } }).pools['event.playerHit'].length, 0);
  const channel = createWingmanChannel();
  const radio = createWingmanRadioDirector({ audio: fakeAudio(), channel, random: () => 0,
    fetchImpl: async () => ({ ok: false }), getContext: () => ({ encounterCategory: 'STANDARD' }) });
  radio.setManifest({ ...EMPTY_MANIFEST, pools: { 'command.regroup': [good] } });
  assert.equal(radio.trigger('command.regroup'), true);
  let chatStarted = 0;
  assert.equal(channel.requestChat(() => { chatStarted++; }), true);
  await flush();
  assert.equal(chatStarted, 1);
  assert.equal(channel.snapshot().owner, 'CHAT');
  channel.finishChat(); assert.equal(channel.snapshot().owner, 'IDLE');
  assert.equal(radio.snapshot().currentSubtitle, null);
});

test('radio chances, cooldowns, priorities, context and recent IDs permit silence', async () => {
  let now = 100000, random = .5;
  const audio = fakeAudio(), channel = createWingmanChannel();
  const manifest = { ...EMPTY_MANIFEST, pools: {
    'command.regroup': [line('command.regroup', 1), line('command.regroup', 2)],
    'event.playerKill': [line('event.playerKill')], 'event.playerHit': [line('event.playerHit')],
    'event.playerDanger': [line('event.playerDanger')], 'event.wingmanHit': [line('event.wingmanHit')],
    'event.wingmanKill': [line('event.wingmanKill')], 'event.wingmanMissile': [line('event.wingmanMissile')],
    'event.combatStart': [line('event.combatStart')], 'event.combatEnd': [line('event.combatEnd')],
    'event.gameOver': [line('event.gameOver')], 'ambient.standard': [line('ambient.standard')],
  } };
  let category = 'STANDARD';
  const radio = createWingmanRadioDirector({ audio, channel, now: () => now, random: () => random,
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
    getContext: () => ({ encounterCategory: category }) });
  radio.setManifest(manifest);
  assert.equal(radio.trigger('event.playerKill'), false); // 50% draw exceeds 40%.
  random = 0;
  for (const key of ['event.playerKill', 'event.playerHit', 'event.playerDanger', 'event.wingmanHit',
    'event.wingmanKill', 'event.wingmanMissile', 'event.combatStart', 'event.combatEnd']) {
    assert.equal(radio.trigger(key), true, key);
    await flush(); radio.cancel(); now += 20000;
  }
  assert.equal(radio.trigger('event.playerKill'), true);
  await flush(); radio.cancel();
  assert.equal(radio.trigger('event.playerKill'), false); // Pool cooldown.
  assert.equal(radio.trigger('command.regroup'), true); // Accepted commands have no probability gate.
  await flush();
  assert.equal(radio.trigger('ambient.standard'), false); // Ambient cannot preempt a command.
  assert.equal(radio.trigger('event.gameOver'), true); // Critical preempts the command.
  await flush(); radio.cancel();
  category = 'ELITE'; assert.equal(radio.trigger('command.regroup'), false);
  category = 'BOSS'; assert.equal(radio.trigger('event.gameOver'), false);
  const valid = eligibleLines([line('command.regroup', 1), line('command.regroup', 2)], { encounterCategory: 'STANDARD' },
    ['pixy_cmd_regroup_001'], new Map(), now);
  assert.deepEqual(valid.map(v => v.id), ['pixy_cmd_regroup_002']);
  assert.equal(weightedLine([{ id: 'one', weight: 1 }, { id: 'two', weight: 4 }], () => .5).id, 'two');
});

test('contextual ambient selection avoids an active warning', () => {
  assert.equal(selectAmbientPool({ incoming: true, recentDangerMs: 0 }), null);
  assert.equal(selectAmbientPool({ recentDangerMs: 1000 }), 'ambient.pressure');
  assert.equal(selectAmbientPool({ nearbyHostiles: 6 }), 'ambient.pressure');
  assert.equal(selectAmbientPool({ recentDangerMs: 40000, quietMs: 30000, nearbyHostiles: 1 }), 'ambient.calm');
  assert.equal(selectAmbientPool({ recentDangerMs: 40000, quietMs: 4000, nearbyHostiles: 2 }), 'ambient.standard');
});

test('new confirmed radio-only events do not widen the M6 backend chat allowlist', () => {
  const keys = [], conversation = { record: () => false };
  for (const type of ['PLAYER_DANGER', 'WINGMAN_KILL', 'WINGMAN_MISSILE'])
    routeConfirmedEvent(type, conversation, { trigger: key => keys.push(key) }, true);
  assert.deepEqual(keys, ['event.playerDanger', 'event.wingmanKill', 'event.wingmanMissile']);
  const context = buildWingmanContext({ phase: Phase.COMBAT, wingman: null, observer: { x: 0, y: 0, z: 0 }, enemies: [], selectedId: 0,
    events: ['PLAYER_DANGER', 'WINGMAN_KILL', 'WINGMAN_MISSILE'] });
  assert.deepEqual(context.events, []);
});

test('accepted alternating commands replace stale acknowledgements; repeated order stays silent', async () => {
  const orders = createWingmanCommandState(), audio = fakeAudio();
  const radio = createWingmanRadioDirector({ audio, random: () => 0,
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
    getContext: () => ({ encounterCategory: 'STANDARD' }) });
  radio.setManifest({ ...EMPTY_MANIFEST, pools: {
    'command.regroup': [line('command.regroup')], 'command.attack': [line('command.attack')],
  } });
  assert.equal(orders.accept(WingmanCommand.REGROUP, true, true), true);
  assert.equal(radio.trigger('command.regroup'), true);
  await flush(); assert.equal(radio.snapshot().currentKey, 'command.regroup');
  assert.equal(orders.accept(WingmanCommand.ATTACK, true, true), true);
  assert.equal(radio.trigger('command.attack'), true);
  await flush(); assert.equal(radio.snapshot().currentKey, 'command.attack');
  assert.equal(orders.accept(WingmanCommand.ATTACK, true, true), false);
  radio.cancel();
});

test('chat queued behind active radio waits for the current clip and blocks new radio', async () => {
  const audio = fakeAudio(), channel = createWingmanChannel();
  let requests = 0, resolveRequest;
  const conversation = createConversation({ getContext: () => ({ mode: 'COMBAT' }),
    request: async () => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); } });
  const radio = createWingmanRadioDirector({ audio, channel, random: () => 0,
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
    getContext: () => ({ encounterCategory: 'STANDARD' }) });
  radio.setManifest({ ...EMPTY_MANIFEST, pools: { 'command.regroup': [line('command.regroup')],
    'event.playerKill': [line('event.playerKill')], 'ambient.standard': [line('ambient.standard')] } });
  assert.equal(radio.trigger('command.regroup'), true);
  await flush(); assert.equal(channel.snapshot().owner, 'RADIO');
  assert.equal(conversation.stage('How are you?'), true);
  assert.equal(channel.requestChat(() => { void conversation.dispatchStaged(); }), true);
  assert.equal(conversation.snapshot().waiting, true); assert.equal(requests, 0);
  assert.equal(radio.trigger('event.playerKill'), false);
  assert.equal(radio.trigger('ambient.standard'), false);
  audio.active[0].finish(); await flush();
  assert.equal(requests, 1); assert.equal(channel.snapshot().owner, 'CHAT');
  assert.equal(radio.trigger('event.playerKill'), false);
  resolveRequest({ text: 'Still flying.', emotion: 'calm' }); await flush();
  assert.equal(conversation.snapshot().text, 'Still flying.');
  assert.equal(channel.snapshot().owner, 'CHAT'); // Reply reveal still owns the channel.
  channel.finishChat(); assert.equal(channel.snapshot().owner, 'IDLE');
  assert.equal(radio.trigger('event.playerKill'), true);
  radio.cancel();
});

test('chat error, cancellation, mute and run reset do not strand channel ownership', async () => {
  const channel = createWingmanChannel();
  assert.equal(channel.reserveRadio(), true);
  let starts = 0;
  channel.requestChat(() => starts++);
  channel.radioFinished(); assert.equal(starts, 1);
  assert.equal(channel.snapshot().owner, 'CHAT');
  channel.finishChat(); assert.equal(channel.snapshot().owner, 'IDLE');
  channel.reserveRadio(); channel.requestChat(() => starts++);
  channel.reset(); channel.radioFinished(); assert.equal(starts, 1);
  assert.equal(channel.snapshot().owner, 'IDLE');
  channel.requestChat(() => { throw Error('backend unavailable'); });
  assert.equal(channel.snapshot().owner, 'IDLE');
  channel.requestChat(() => {}); channel.cancelChat();
  assert.equal(channel.snapshot().owner, 'IDLE');
  channel.requestChat(() => {}); const stale = channel.snapshot().epoch;
  channel.reset(); channel.requestChat(() => {});
  channel.finishChat(stale); assert.equal(channel.snapshot().owner, 'CHAT');
  channel.finishChat(); assert.equal(channel.snapshot().owner, 'IDLE');
});

test('chat ownership can wait for the final mumble grain', async () => {
  let finish;
  const audio = { muted: false, playMumbleGrain: () => ({ stop() { finish(); }, ended: new Promise(resolve => { finish = resolve; }) }) };
  const mumble = createChatMumble(audio), channel = createWingmanChannel();
  channel.requestChat(() => {});
  mumble.begin({ text: 'Copy.', mode: 'COMBAT', emotion: 'calm' });
  mumble.word(tokenizeWords('Copy.')[0]);
  const epoch = channel.snapshot().epoch;
  void mumble.whenIdle().then(() => channel.finishChat(epoch));
  await flush(); assert.equal(channel.snapshot().owner, 'CHAT');
  finish(); await flush(); assert.equal(channel.snapshot().owner, 'IDLE');
});

test('Silent Tide has twenty distinct members; completion waits for all and ammo stays private', () => {
  const encounter = getEncounter('silent_tide');
  assert.equal(enemyCount(encounter), 20);
  assert.deepEqual(encounter.enemies.map(group => [group.aircraft, group.count]), [['MIG-29', 10], ['SU-27', 10]]);
  assert.equal(expandEncounter(encounter).length, 20);
  const scene = new THREE.Scene();
  const spawned = spawnEncounter(scene, encounter, { position: new THREE.Vector3(0, 460, 1400), heading: 0 }, () => 0);
  const separation = spawned.flatMap((a, i) => spawned.slice(i + 1).map(b => a.mesh.position.distanceTo(b.mesh.position)));
  assert.equal(spawned.length, 20); assert.ok(Math.min(...separation) > 100);
  disposeEnemies(scene, spawned);
  const run = createRunState(); let enemies = [];
  const director = createRoundDirector(run, next => (enemies = expandEncounter(next).map((e, i) => ({ ...e, id: i, alive: true }))));
  director.startRun(); assert.equal(enemies.length, 20);
  for (const enemy of enemies.slice(0, -1)) director.recordDestruction(enemy, 'wingman');
  assert.equal(director.checkRoundComplete(), false);
  director.recordDestruction(enemies.at(-1), 'player');
  assert.equal(director.checkRoundComplete(), true);
  director.update(1); director.nextRound('border_patrol');
  assert.equal(run.phase, Phase.COMBAT);
  assert.equal(playerAircraft.missileCapacity, 120);
  const context = buildWingmanContext({ phase: Phase.COMBAT, wingman: null, observer: { x: 0, y: 0, z: 0 }, enemies: [], selectedId: 0, events: [] });
  assert.equal(JSON.stringify(context).includes('missile'), false);
  const positions = Array.from({ length: 20 }, (_, i) => radarPosition(i * 300, -i * 400, 0));
  assert.equal(positions.length, 20);
  assert.ok(positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 68 && Math.abs(p.y) <= 68));
  const orders = createWingmanCommandState();
  assert.equal(orders.accept(WingmanCommand.REGROUP, true, true), true);
  assert.equal(orders.accept(WingmanCommand.REGROUP, true, true), false);
});
