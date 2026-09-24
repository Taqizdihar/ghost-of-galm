import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RADIO_KEYS, RADIO_PATH_PREFIX, validateManifest } from '../src/audio/wingman-radio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/assets/audio/wingman/pixy');
const scriptPath = path.join(root, 'Pixy Voiceline Script.md');
const manifestPath = path.join(root, 'manifest.json');
const runtimeRoot = 'public/assets/audio/wingman/pixy/';
const folders = ['commands', 'reactions', 'ambient'];
const POOL_DEFAULTS = Object.freeze({
  command: { priority: 80, cooldownMs: 0, preload: 'core' },
  'event.playerKill': { priority: 50, cooldownMs: 9000, preload: 'lazy' },
  'event.playerHit': { priority: 55, cooldownMs: 10000, preload: 'lazy' },
  'event.playerDanger': { priority: 70, cooldownMs: 14000, preload: 'core' },
  'event.wingmanHit': { priority: 60, cooldownMs: 10000, preload: 'lazy' },
  'event.wingmanKill': { priority: 50, cooldownMs: 9000, preload: 'lazy' },
  'event.wingmanMissile': { priority: 45, cooldownMs: 12000, preload: 'lazy' },
  'event.combatStart': { priority: 40, cooldownMs: 15000, preload: 'lazy' },
  'event.combatEnd': { priority: 40, cooldownMs: 15000, preload: 'lazy' },
  'event.gameOver': { priority: 100, cooldownMs: 0, preload: 'core' },
  ambient: { priority: 30, cooldownMs: 45000, preload: 'lazy' },
});

export function parseRecordingScript(markdown) {
  const entries = [], issues = [];
  let entry = {};
  const flush = () => {
    if (!Object.keys(entry).length) return;
    if (entry.voiceline && entry.filename && entry.saveTo) entries.push(entry);
    else issues.push(`Incomplete recording script entry near line ${entry.line}`);
    entry = {};
  };
  markdown.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^\*\*(Voiceline|Suggested MP3|Save to):\*\*\s*(.+?)\s*$/);
    if (!match) return;
    const [, field, raw] = match;
    if (field === 'Voiceline') { flush(); entry.line = index + 1; entry.voiceline = raw.replace(/^[“"]|[”"]$/g, ''); }
    if (field === 'Suggested MP3') entry.filename = raw.replace(/^`|`$/g, '');
    if (field === 'Save to') entry.saveTo = raw.replace(/^`|`$/g, '');
  });
  flush();
  return { entries, issues };
}

async function inventory(directory, relative = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const child = path.posix.join(relative, item.name);
    if (item.isDirectory()) result.push(...await inventory(path.join(directory, item.name), child));
    else if (item.isFile() && item.name.toLowerCase().endsWith('.mp3')) result.push(child);
  }
  return result.sort();
}

export async function buildManifest({ write = false } = {}) {
  const { entries, issues } = parseRecordingScript(await readFile(scriptPath, 'utf8'));
  const script = new Map();
  for (const entry of entries) {
    if (!entry.saveTo.startsWith(runtimeRoot)) continue; // Elite/Boss script examples remain future work.
    const file = entry.saveTo.slice(runtimeRoot.length);
    if (!folders.includes(file.split('/')[0])) continue;
    if (path.posix.basename(file) !== entry.filename) issues.push(`Script filename/path mismatch: ${entry.filename}`);
    if (script.has(entry.filename)) issues.push(`Duplicate script filename: ${entry.filename}`);
    else script.set(entry.filename, { ...entry, file });
  }
  const files = (await Promise.all(folders.map(folder => inventory(path.join(root, folder), folder)))).flat().sort();
  const pools = Object.fromEntries(RADIO_KEYS.map(key => [key, []]));
  const used = new Set();
  for (const file of files) {
    const filename = path.posix.basename(file), transcript = script.get(filename);
    if (!transcript || transcript.file !== file) { issues.push(`Unmatched MP3: ${file}`); continue; }
    const key = RADIO_KEYS.find(key => file.startsWith(RADIO_PATH_PREFIX[key]));
    if (!key || !/^pixy_(?:cmd|evt|amb)_[a-z0-9_]+_\d{3}\.mp3$/.test(filename)) {
      issues.push(`Invalid category or filename: ${file}`); continue;
    }
    const defaults = POOL_DEFAULTS[key] || POOL_DEFAULTS[key.split('.')[0]];
    const id = filename.slice(0, -4);
    if (used.has(id)) { issues.push(`Duplicate line ID: ${id}`); continue; }
    used.add(id);
    pools[key].push({ id, file, subtitle: transcript.voiceline,
      weight: key.startsWith('command.') && transcript.voiceline.length <= 30 ? 2 : 1,
      ...defaults, contexts: ['STANDARD'], excludeContexts: ['ELITE', 'BOSS'] });
  }
  for (const [filename, entry] of script) {
    if (!files.includes(entry.file)) issues.push(`Script has no MP3: ${filename}`);
  }
  const manifest = { version: 1, speaker: 'pixy', format: 'mp3', pools };
  const validated = validateManifest(manifest);
  for (const key of RADIO_KEYS) if (validated.pools[key].length !== pools[key].length) issues.push(`Runtime rejected ${key} entry`);
  const output = `${JSON.stringify(manifest, null, 2)}\n`;
  const previous = await readFile(manifestPath, 'utf8').catch(() => '');
  if (write && previous !== output) await writeFile(manifestPath, output);
  return { manifest, output, previous, files, issues };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const result = await buildManifest({ write: !check });
  for (const [key, lines] of Object.entries(result.manifest.pools)) console.log(`${key}: ${lines.length}`);
  for (const issue of result.issues) console.error(issue);
  if (check && result.output !== result.previous) console.error('Manifest differs from script and MP3 inventory. Run npm run audio:manifest.');
  if (result.issues.length || (check && result.output !== result.previous)) process.exitCode = 1;
}
