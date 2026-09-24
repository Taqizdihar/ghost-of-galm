export const RADIO_PRIORITY = Object.freeze({
  CRITICAL: 100, BOSS_PHASE: 90, BOSS_INTRO: 85, COMMAND: 80,
  PLAYER_DANGER: 70, WINGMAN_HIT: 60, PLAYER_HIT: 55, PLAYER_KILL: 50,
  WINGMAN_WEAPON: 45, COMBAT: 40, AMBIENT: 30,
});
export const RADIO_KEYS = Object.freeze([
  'command.attack', 'command.regroup', 'command.attackTarget', 'command.defend',
  'event.playerKill', 'event.playerHit', 'event.playerDanger', 'event.wingmanHit',
  'event.wingmanKill', 'event.wingmanMissile', 'event.combatStart', 'event.combatEnd', 'event.gameOver',
  'ambient.standard', 'ambient.pressure', 'ambient.calm',
]);
export const RADIO_BASE = '/assets/audio/wingman/pixy/';
const EVENT_CHANCE = Object.freeze({
  'event.playerKill': .4, 'event.playerHit': .6, 'event.playerDanger': .75,
  'event.wingmanHit': .6, 'event.wingmanKill': .45, 'event.wingmanMissile': .32,
  'event.combatStart': .7, 'event.combatEnd': .7,
});
const POOL_COOLDOWN = Object.freeze({
  'event.playerKill': 9000, 'event.playerHit': 10000, 'event.playerDanger': 14000,
  'event.wingmanHit': 10000, 'event.wingmanKill': 9000, 'event.wingmanMissile': 12000,
  'event.combatStart': 15000, 'event.combatEnd': 15000,
  'ambient.standard': 45000, 'ambient.pressure': 45000, 'ambient.calm': 45000,
});
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safePath = /^(?:commands|reactions|ambient|elite|bosses)\/(?:[a-z0-9_-]+\/)*pixy_(?:cmd|evt|amb|elite|boss)_[a-z0-9_]+_\d{3}\.mp3$/;
export const RADIO_PATH_PREFIX = Object.freeze({
  'command.attack': 'commands/attack/pixy_cmd_attack_',
  'command.regroup': 'commands/regroup/pixy_cmd_regroup_',
  'command.attackTarget': 'commands/attack-target/pixy_cmd_attack_target_',
  'command.defend': 'commands/defend/pixy_cmd_defend_',
  'event.playerKill': 'reactions/player-kill/pixy_evt_player_kill_',
  'event.playerHit': 'reactions/player-hit/pixy_evt_player_hit_',
  'event.playerDanger': 'reactions/player-danger/pixy_evt_player_danger_',
  'event.wingmanHit': 'reactions/wingman-hit/pixy_evt_wingman_hit_',
  'event.wingmanKill': 'reactions/wingman-kill/pixy_evt_wingman_kill_',
  'event.wingmanMissile': 'reactions/wingman-missile/pixy_evt_wingman_fox2_',
  'event.combatStart': 'reactions/combat-start/pixy_evt_combat_start_',
  'event.combatEnd': 'reactions/combat-end/pixy_evt_combat_end_',
  'event.gameOver': 'reactions/game-over/pixy_evt_game_over_',
  'ambient.standard': 'ambient/standard/pixy_amb_standard_',
  'ambient.pressure': 'ambient/pressure/pixy_amb_pressure_',
  'ambient.calm': 'ambient/calm/pixy_amb_calm_',
});
function expectedPrefix(key) {
  if (RADIO_PATH_PREFIX[key]) return RADIO_PATH_PREFIX[key];
  const [kind, slugName, stage] = key.split('.');
  const stem = slugName.replaceAll('-', '_');
  if (kind === 'elite') return `elite/${slugName}/${stage}/pixy_elite_${stem}_${stage}_`;
  if (kind === 'boss') return `bosses/${slugName}/${stage}/pixy_boss_${stem}_${stage.replaceAll('-', '')}_`;
  return '';
}
const pools = Object.fromEntries(RADIO_KEYS.map(key => [key, []]));
export const EMPTY_MANIFEST = Object.freeze({ version: 1, speaker: 'pixy', format: 'mp3', pools });

export function validRadioContext(context) {
  return { encounterCategory: ['STANDARD', 'ELITE', 'BOSS'].includes(context?.encounterCategory) ? context.encounterCategory : 'STANDARD',
    encounterId: typeof context?.encounterId === 'string' && slug.test(context.encounterId.replaceAll('_', '-')) ? context.encounterId.replaceAll('_', '-') : '',
    phaseId: typeof context?.phaseId === 'string' && slug.test(context.phaseId) ? context.phaseId : '' };
}
export function validateManifest(raw) {
  if (!raw || raw.version !== 1 || raw.speaker !== 'pixy' || raw.format !== 'mp3' || !raw.pools || typeof raw.pools !== 'object') return structuredClone(EMPTY_MANIFEST);
  const seen = new Set(), seenFiles = new Set(), result = {};
  for (const [key, entries] of Object.entries(raw.pools)) {
    if (!RADIO_KEYS.includes(key) && !/^(elite|boss)\.[a-z0-9-]+\.(intro|combat|defeat|phase-[0-9]{2})$/.test(key)) continue;
    const special = key.startsWith('elite.') || key.startsWith('boss.');
    const [, expectedEncounter, expectedPhase] = special ? key.split('.') : [];
    result[key] = Array.isArray(entries) ? entries.flatMap(entry => {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || seen.has(entry.id) || seenFiles.has(entry.file) ||
          !/^pixy_(?:cmd|evt|amb|elite|boss)_[a-z0-9_]+_\d{3}$/.test(entry.id) ||
          typeof entry.file !== 'string' || !safePath.test(entry.file) || !entry.file.startsWith(expectedPrefix(key)) || !entry.file.endsWith(`${entry.id}.mp3`) ||
          typeof entry.subtitle !== 'string' || !entry.subtitle.trim() || entry.subtitle.length > 240 ||
          !Number.isFinite(entry.weight ?? 1) || (entry.weight ?? 1) <= 0 || (entry.weight ?? 1) > 100 ||
          !Number.isFinite(entry.priority ?? 0) || (entry.priority ?? 0) < 0 || (entry.priority ?? 0) > 100 ||
          !Number.isFinite(entry.cooldownMs ?? 0) || (entry.cooldownMs ?? 0) < 0 || (entry.cooldownMs ?? 0) > 3600000 ||
          !['core', 'encounter', 'lazy'].includes(entry.preload ?? 'lazy') ||
          (entry.contexts && (!Array.isArray(entry.contexts) || entry.contexts.some(x => !['STANDARD', 'ELITE', 'BOSS'].includes(x)))) ||
          (entry.excludeContexts && (!Array.isArray(entry.excludeContexts) || entry.excludeContexts.some(x => !['STANDARD', 'ELITE', 'BOSS'].includes(x)))) ||
          (entry.encounterId != null && (typeof entry.encounterId !== 'string' || !slug.test(entry.encounterId))) ||
          (entry.phaseId != null && (typeof entry.phaseId !== 'string' || !slug.test(entry.phaseId))) ||
          (special && (entry.encounterId !== expectedEncounter ||
            (expectedPhase.startsWith('phase-') && entry.phaseId !== expectedPhase)))) return [];
      seen.add(entry.id); seenFiles.add(entry.file);
      return [{ id: entry.id, file: entry.file, subtitle: entry.subtitle, weight: entry.weight ?? 1,
        priority: entry.priority ?? null, cooldownMs: entry.cooldownMs ?? 0,
        contexts: entry.contexts || null, excludeContexts: entry.excludeContexts || [],
        encounterId: entry.encounterId || '', phaseId: entry.phaseId || '', preload: entry.preload ?? 'lazy' }];
    }) : [];
  }
  for (const key of RADIO_KEYS) result[key] ||= [];
  return { version: 1, speaker: 'pixy', format: 'mp3', pools: result };
}
export function eligibleLines(lines, context, recent, lineTimes, now, poolTime = -Infinity, poolCooldown = 0) {
  if (now - poolTime < poolCooldown) return [];
  const possible = lines.filter(line => (!line.contexts || line.contexts.includes(context.encounterCategory)) &&
    !line.excludeContexts.includes(context.encounterCategory) &&
    (!line.encounterId || line.encounterId === context.encounterId) &&
    (!line.phaseId || line.phaseId === context.phaseId) &&
    now - (lineTimes.get(line.id) ?? -Infinity) >= line.cooldownMs);
  const fresh = possible.filter(line => !recent.includes(line.id));
  if (fresh.length) return fresh;
  const alternatives = possible.filter(line => line.id !== recent.at(-1));
  if (alternatives.length) return alternatives;
  // A one-line pool can be reused after real silence; it never fires twice at once.
  return possible.filter(line => now - (lineTimes.get(line.id) ?? -Infinity) >= 10000);
}
export function selectAmbientPool({ incoming = false, recentDangerMs = Infinity, quietMs = 0, nearbyHostiles = 0 } = {}) {
  if (incoming) return null;
  if (recentDangerMs < 18000 || nearbyHostiles >= 4) return 'ambient.pressure';
  if (recentDangerMs > 30000 && quietMs > 22000 && nearbyHostiles <= 1) return 'ambient.calm';
  return 'ambient.standard';
}
export function weightedLine(lines, random = Math.random) {
  const total = lines.reduce((sum, line) => sum + line.weight, 0);
  if (!total) return null;
  let choice = Math.min(.999999, Math.max(0, random())) * total;
  for (const line of lines) { choice -= line.weight; if (choice < 0) return line; }
  return lines.at(-1);
}
export function priorityFor(key) {
  if (key === 'event.gameOver') return RADIO_PRIORITY.CRITICAL;
  if (key.startsWith('boss.') && key.includes('phase')) return RADIO_PRIORITY.BOSS_PHASE;
  if (key.startsWith('boss.')) return RADIO_PRIORITY.BOSS_INTRO;
  if (key.startsWith('command.')) return RADIO_PRIORITY.COMMAND;
  if (key.startsWith('elite.') && key.endsWith('.intro')) return 75;
  if (key.startsWith('elite.') && key.endsWith('.defeat')) return 65;
  if (key.startsWith('elite.')) return 55;
  if (key === 'event.playerDanger') return RADIO_PRIORITY.PLAYER_DANGER;
  if (key === 'event.wingmanHit') return RADIO_PRIORITY.WINGMAN_HIT;
  if (key === 'event.playerHit') return RADIO_PRIORITY.PLAYER_HIT;
  if (key === 'event.playerKill' || key === 'event.wingmanKill') return RADIO_PRIORITY.PLAYER_KILL;
  if (key === 'event.wingmanMissile') return RADIO_PRIORITY.WINGMAN_WEAPON;
  if (key.startsWith('ambient.')) return RADIO_PRIORITY.AMBIENT;
  return RADIO_PRIORITY.COMBAT;
}

export function createWingmanRadioDirector({ audio, fetchImpl = fetch, random = Math.random,
  now = () => performance.now(), getContext = () => ({}), channel = null, onLine = () => {}, onStop = () => {} }) {
  let manifest = structuredClone(EMPTY_MANIFEST), loaded = false, current = null, generation = 0;
  let lastAudio = now(), ambientAt = now() + 30000;
  const recent = [], lineTimes = new Map(), poolTimes = new Map(), cache = new Map();
  const nextAmbient = () => now() + 25000 + random() * 45000;
  async function load() {
    try {
      const response = await fetchImpl(`${RADIO_BASE}manifest.json`);
      if (response.ok) manifest = validateManifest(await response.json());
    } catch { /* Static hosting or audio may be unavailable. */ }
    loaded = true;
    void preload('core');
    return manifest;
  }
  async function bufferFor(line) {
    if (cache.has(line.id)) {
      const cached = cache.get(line.id); cache.delete(line.id); cache.set(line.id, cached);
      return cached;
    }
    const task = (async () => {
      const response = await fetchImpl(RADIO_BASE + line.file);
      if (!response.ok) throw Error('Radio clip unavailable');
      const media = response.headers?.get?.('content-type');
      if (media && !/audio\/(?:mpeg|mp3)|application\/octet-stream/i.test(media)) throw Error('Invalid radio clip');
      const bytes = await response.arrayBuffer();
      return audio.decodeRadio ? audio.decodeRadio(bytes) : bytes;
    })();
    cache.set(line.id, task);
    if (cache.size > 16) cache.delete(cache.keys().next().value);
    try { return await task; } catch (error) { cache.delete(line.id); throw error; }
  }
  async function preload(policy) {
    if (audio.decodeRadio && audio.context?.state !== 'running') return;
    const context = validRadioContext(getContext());
    const keys = policy === 'core' ? ['command.attack', 'command.regroup', 'event.playerDanger', 'event.gameOver', 'event.playerHit', 'event.wingmanHit'] : Object.keys(manifest.pools);
    const list = keys.flatMap(key => (manifest.pools[key] || []).filter(line => line.preload === policy &&
      (!line.encounterId || line.encounterId === context.encounterId) &&
      (!line.contexts || line.contexts.includes(context.encounterCategory))).slice(0, policy === 'core' ? 1 : 2));
    await Promise.allSettled(list.slice(0, 12).map(bufferFor));
  }
  function cancel(releaseChannel = true) {
    const hadCurrent = !!current;
    generation++;
    current?.controller.abort(); current?.playback?.stop(); current = null;
    audio.duckFlight(1);
    onStop();
    if (hadCurrent && releaseChannel) channel?.radioFinished();
  }
  function trigger(key, { probability = null, poolCooldownMs = null } = {}) {
    const context = validRadioContext(getContext());
    if (audio.muted || (channel && !channel.canStartRadio())) return false;
    if (RADIO_KEYS.includes(key) && context.encounterCategory !== 'STANDARD') return false;
    if (key.startsWith('elite.') && (context.encounterCategory !== 'ELITE' || key.split('.')[1] !== context.encounterId)) return false;
    if (key.startsWith('boss.') && (context.encounterCategory !== 'BOSS' || key.split('.')[1] !== context.encounterId)) return false;
    const lines = (manifest.pools[key] || []).filter(line => !key.startsWith('ambient.') ||
      context.encounterCategory === 'STANDARD' || line.contexts?.includes(context.encounterCategory));
    if (!lines.length || random() >= (probability ?? EVENT_CHANCE[key] ?? 1)) return false;
    const eligible = eligibleLines(lines, context, recent, lineTimes, now(), poolTimes.get(key), poolCooldownMs ?? POOL_COOLDOWN[key] ?? 0);
    const line = weightedLine(eligible, random);
    if (!line) return false;
    const basePriority = priorityFor(key);
    // Manifest priority tunes order within its semantic tier without inverting it.
    const priority = line.priority == null ? basePriority : Math.min(basePriority + 1, Math.max(basePriority - 1, line.priority));
    const replacesCommand = current?.key.startsWith('command.') && key.startsWith('command.') && current.key !== key;
    if (current && priority <= current.priority && !replacesCommand) return false;
    if (current) cancel(false);
    else if (channel && !channel.reserveRadio()) return false;
    const controller = new AbortController(), id = generation;
    current = { key, line, priority, controller, playback: null };
    recent.push(line.id); if (recent.length > 8) recent.shift();
    lineTimes.set(line.id, now()); poolTimes.set(key, now());
    lastAudio = now(); ambientAt = nextAmbient();
    void (async () => {
      try {
        const buffer = await bufferFor(line);
        if (id !== generation || controller.signal.aborted) return;
        const playback = await audio.playRadio(buffer, { mode: 'COMBAT', signal: controller.signal });
        if (id !== generation) { playback.stop(); return; }
        current.playback = playback; onLine({ key, lineId: line.id, subtitle: line.subtitle, duration: playback.duration, startedAt: playback.startedAt });
        await playback.ended;
      } catch { /* Missing/invalid MP3 remains optional. */ }
      finally { if (id === generation) { current = null; lastAudio = now(); onStop(); channel?.radioFinished(); } }
    })();
    return true;
  }
  function tick(active, state = {}) {
    if (!active || now() < ambientAt || current || (channel && !channel.canStartRadio())) return;
    ambientAt = nextAmbient();
    if (now() - lastAudio < 20000) return;
    const context = validRadioContext(getContext());
    if (context.encounterCategory !== 'STANDARD') return;
    const key = selectAmbientPool(state);
    if (key && manifest.pools[key]?.length) trigger(key, { probability: .55, poolCooldownMs: 45000 });
  }
  return { load, trigger, tick, cancel, preload,
    setManifest(raw) { cancel(); manifest = validateManifest(raw); loaded = true; },
    setContext() { cancel(); void preload('encounter'); ambientAt = nextAmbient(); },
    elite(stage, encounterId) { return trigger(`elite.${encounterId}.${stage}`); },
    boss(stage, encounterId) { return trigger(`boss.${encounterId}.${stage}`); },
    snapshot() { return { manifestLoaded: loaded, audioAvailable: Object.values(manifest.pools).some(p => p.length),
      availableLineCount: Object.values(manifest.pools).reduce((n, p) => n + p.length, 0),
      currentKey: current?.key ?? null, currentLineId: current?.line.id ?? null, currentSubtitle: current?.playback ? current.line.subtitle : null,
      cacheCount: cache.size, radioBusy: !!current, queueLength: 0, context: validRadioContext(getContext()) }; },
  };
}
