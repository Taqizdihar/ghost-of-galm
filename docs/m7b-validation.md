# M7-B validation — prerecorded Pixy radio

M7-B runs on `main`. The canonical lorebook and existing MP3 binaries were not
changed. Generic radio is active only in STANDARD encounters. Elite/Boss folders,
hooks and encounter prototypes remain untouched by this integration.

## Asset inventory and manifest

The builder reads `public/assets/audio/wingman/pixy/Pixy Voiceline Script.md`,
matches each actual generic MP3 by suggested filename and save-to path, and uses
its exact `Voiceline` sentence as the subtitle. Only quotation wrappers are
removed. It writes stable IDs, safe relative paths and centralized defaults to
`manifest.json`. It excludes and reports unmapped recordings rather than
guessing speech. A second generation produces identical bytes.

| Pool | Files |
| --- | ---: |
| command.attack | 12 |
| command.regroup | 12 |
| command.attackTarget | 10 |
| command.defend | 10 |
| event.playerKill | 15 |
| event.playerHit | 12 |
| event.playerDanger | 12 |
| event.wingmanHit | 12 |
| event.wingmanKill | 12 |
| event.wingmanMissile | 12 |
| event.combatStart | 10 |
| event.combatEnd | 10 |
| event.gameOver | 8 |
| ambient.standard | 15 |
| ambient.pressure | 12 |
| ambient.calm | 12 |
| **Total** | **186** |

Commands total 44, reactions 103 and ambient 39. Missing or mismatched
MP3/script mappings: **0**. `ffprobe` recognized all 186 MP3s with positive
durations from 0.72 to 5.40 seconds. Elite/Boss clips were not added to the
runtime manifest.

## Radio behavior

Accepted ATTACK and REGROUP orders always attempt an acknowledgement; a repeated
order is rejected by the gameplay command state. Probabilities and pool
cooldowns: player kill 40%/9 s, player hit 60%/10 s, player danger 75%/14 s,
wingman hit 60%/10 s, wingman kill 45%/9 s, wingman missile 32%/12 s, combat
start/end 70%/15 s, game over 100%. Ambient uses a 25–70 s randomized interval,
at least 20 s since prior radio, a 45 s pool cooldown and a 55% draw. Local
incoming warning, recent damage, quiet time and nearby hostile count choose
pressure, standard or calm. An active warning suppresses ambient. Selection
uses weights and an eight-ID recent window; line and pool cooldowns can yield
silence. Current generic lines require STANDARD context; future Elite/Boss
semantic hooks remain.

Playback uses high/low-pass filters, mild compression and saturation, a short
transmission static edge, and a voice bus. Flight audio ducks to 0.62 for
COMBAT radio and restores smoothly to 1. The browser decodes a few core
command/danger/game-over candidates after audio unlock, then uses a bounded
16-entry decoded AudioBuffer LRU. Other recordings load lazily.

## Automated checks

- `npm install --no-audit --no-fund`: passed.
- `npm run audio:manifest` and `npm run audio:check`: passed, deterministic.
- `npm test`: 40/40 passed. Tests cover script parsing, exact subtitles,
  inventory and file existence, ID/path/category/context validation, empty and
  missing pools, probability/cooldown/priority/no-repeat selection, contextual
  ambient, command acceptance and replacement, exclusive channel ownership, queued chat,
  failure/reset safety, unchanged M6 context allowlist, final mumble grain, 20-contact composition/spawn
  separation, round completion and private ammo context.
- `python -m unittest discover -s server/tests -v`: 14/14 passed. The old TTS
  endpoint still returns 404.
- `npm run build`: passed. Vite reported its existing large JavaScript chunk
  advisory; no build error.

## Browser checks

Chromium loaded the production preview manifest with 186 entries and no console
warning or error. A fresh Silent Tide sortie showed `00 / 20`, 20 living
contacts and 120 missiles. The new spawn arrangement had 572 m minimum
aircraft separation in the deterministic first-round spawn test. Keyboard
`L` acquired a valid selected hostile and firing one missile changed the HUD
from 120 to 119. The chase view, radar, wingman model and controls remained
available. Round-to-round ammo persistence is covered by code review; a full
20-contact browser clear has not been completed in this validation pass.

Real MP3 requests, Web Audio playback starts, script-derived subtitle appearance
and natural disappearance were observed for command and combat-start clips.
Natural wingman missile, wingman kill, player hit and player danger requests
also appeared while the 20-contact round played. A REGROUP clip showed
`Pixy` above `<< I'm with you. >>`; the subtitle disappeared when the clip
ended. A browser instrumented the flight gain target at 0.62 on speech start
and 1 after it ended. Muting during a live ATTACK clip immediately hid its
subtitle, stopped radio and returned the channel to IDLE. Crashing the player
started a real `event.gameOver` MP3 with `<< Talk to me, Kid. >>`. A fresh run
after that loss again showed 20 enemies and 120 missiles.

In a mocked-backend browser test, a message submitted while command radio was
reserved displayed locally with `WAITING FOR RADIO CHANNEL`. The backend
request count stayed zero during the current clip, then became one when it
ended. An ATTACK order while that chat request was pending changed the gameplay
command immediately; no Pixy MP3 started. The mocked reply finished revealing
and the channel returned to IDLE. No stale bark played afterward.

Measured in headless Chromium from command click to visible playback subtitle:
one cold, newly fetched REGROUP line took **50.8 ms** and one warm, predecoded
ATTACK line took **6.0 ms**. These are representative local preview samples,
not device-wide latency guarantees.

The camera button strip is gone; `C` and held `V` remain controls. Chat is
upper-left, the mission panel upper-right, AO/weather directly beneath it,
cyan subtitles top-center, and PIXY ORDER beside the lower-left radar. The
desktop radar is **224 × 224 CSS px** backed by a 448 × 448 canvas. Responsive
sizes are 176 px on a short laptop, 160 px at 800 px width, 108 px on mobile,
and 90 px in the narrow/short case. At 1440×900, 1046×658, 800×700, 390×844
and 320×700, browser bounding boxes showed no overlap among chat/mission,
orders/weapons, orders/AWACS or orders/touch controls, and no horizontal
overflow. `C` still switched chase to cockpit, held `V` entered rear view and
release restored the selected view; the old camera overlay was absent. With
20 enemies alive, 120 Chromium animation frames measured a 33.2 ms median
and 50.1 ms 95th percentile frame interval. This headless software-rendered
browser result is only a rough performance signal, not a hardware GPU benchmark.

This environment could play and decode the committed recordings in Chromium,
but it has no audio input path for the agent to hear the result. Subjective
intelligibility, voice gain, EQ and static quality still need a human listening
pass on speakers/headphones. Cold/warm measurements and decoder checks do not
establish subjective sound quality.
