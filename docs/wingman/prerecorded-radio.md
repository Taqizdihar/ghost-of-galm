# Prerecorded Pixy gameplay radio

M7-A provides the empty runtime library below. M7-B will add approved real
Pixy MP3 recordings and populate `manifest.json`. The LLM chat and its
procedural nonverbal mumble are separate from this gameplay radio.

```text
public/assets/audio/wingman/pixy/
├── manifest.json
├── commands/{attack,regroup,attack-target,defend}/
├── reactions/{player-kill,player-hit,player-danger,wingman-hit,wingman-kill,wingman-missile,combat-start,combat-end,game-over}/
├── ambient/{standard,pressure,calm}/
├── elite/_template/{intro,combat,defeat}/
├── bosses/air-destroyer/{intro,phase-01,phase-02,phase-03,defeat}/
└── bosses/_template/{intro,phase-01,defeat}/
```

Each leaf directory contains only `.gitkeep` until an approved MP3 arrives.
`commands/` holds acknowledgements for accepted deterministic controls.
`reactions/` holds confirmed gameplay event lines. `ambient/` holds optional
mission chatter. `elite/` and `bosses/` isolate encounter-specific intro,
combat, phase and defeat lines from ordinary ambient pools. The Air Destroyer
tree is audio preparation only; no boss mechanics exist in M7-A.

## Adding the friend's approved recordings for M7-B

1. Keep raw and lossless masters outside this repository. Export approved
   runtime clips as clean `.mp3` files. Do not bake static, EQ, distortion or
   compression into them; Web Audio applies radio effects when played.
2. Put each MP3 in its matching leaf folder. Use lower-case semantic names and
   three-digit sequence numbers. Do not name a file after its spoken sentence.
3. Add one manifest entry under the matching pool key. Keep `id` equal to the
   filename without `.mp3`, and `file` relative to the Pixy folder. Add the
   exact subtitle/transcript and review the context fields. M7-A does not
   invent any spoken lines or manifest entries.
4. Run `npm test` and `npm run build`, then listen in a browser. M7-B will tune
   gain, filters, ducking and line choice using the real recordings.

Naming examples: `pixy_cmd_attack_001.mp3`, `pixy_cmd_regroup_001.mp3`,
`pixy_evt_player_kill_001.mp3`, `pixy_evt_player_hit_001.mp3`,
`pixy_evt_player_danger_001.mp3`, `pixy_evt_wingman_hit_001.mp3`,
`pixy_evt_wingman_kill_001.mp3`, `pixy_evt_wingman_fox2_001.mp3`,
`pixy_evt_game_over_001.mp3`, `pixy_amb_standard_001.mp3`,
`pixy_amb_pressure_001.mp3`, `pixy_amb_calm_001.mp3`,
`pixy_elite_<encounter-slug>_intro_001.mp3`,
`pixy_elite_<encounter-slug>_combat_001.mp3`,
`pixy_elite_<encounter-slug>_defeat_001.mp3`, and
`pixy_boss_air_destroyer_phase02_001.mp3`. Other Air Destroyer suffixes are
`intro`, `phase01`, `phase03`, and `defeat`. Avoid `final.mp3`, `final2.mp3`,
`new_final.mp3`, and `copy_that.mp3`.

## Manifest entry contract

The empty `manifest.json` has version 1, speaker `pixy`, format `mp3`, and
empty categorized pools. A future entry has stable `id`, relative `file`,
`subtitle`, positive `weight`, optional `priority`, `cooldownMs`,
`contexts` (`STANDARD`, `ELITE`, `BOSS`), `excludeContexts`, optional
`encounterId` and `phaseId`, and `preload` (`core`, `encounter`, `lazy`).
Entry priority is bounded within its semantic event tier so a routine line
cannot outrank a boss phase or critical call.
Malformed entries are discarded. Use encounter-specific keys such as
`elite.<encounter-slug>.intro` or `boss.air-destroyer.phase-02` with matching
`encounterId`; a phase line must also declare `phaseId`. Ordinary ambient
does not play in Elite or Boss contexts. The director only selects a line when
its category, encounter and phase match. Existing encounter IDs containing
underscores normalize to hyphens for radio context matching.

`core` is for acknowledgements and critical common lines; `encounter` is for
the current special encounter; `lazy` is for ambient/flavor. The runtime holds
a small cache and loads MP3s on demand. A missing file or empty pool stays
silent without interrupting flight.
