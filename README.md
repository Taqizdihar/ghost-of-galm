# The Ghost of Galm

A playable, unofficial **Ace Combat Zero** fan tribute built with Three.js and Vite. Fly an F-15C over a procedural coastline, sandy beaches, offshore islands, and mountains in **Operation Silent Tide**.

![The Ghost of Galm flight preview](docs/preview.png)

## Run locally

Use a modern Node.js release and a browser with WebGL enabled.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

The static production site is generated in `dist/`.

## How to play

Select **Launch Sortie** to begin round 1, a six-aircraft Silent Tide patrol. Destroy every contact to clear the round, then select the next engagement and **Continue Sortie**. Rounds have no final limit; losing your aircraft ends the run. The mission panel shows the current round, encounter progress, total flight time, and persistent score.

Health, missiles, flares, aircraft position, and flight state carry between rounds. There is no intermission repair or rearm; the cannon has unlimited ammunition. Combat and its timers stop during intermission. Closing the selection dialog leaves the run suspended; **Select Engagement** reopens it. **Fly Again** after aircraft loss, or **Restart Run** from pause, starts a fresh run.

Keep the selected target near the center of the HUD until the target locks, then fire a missile. Use the radar and target selector to find the next aircraft. The cannon works at close range. Deploy flares when a missile warning appears, and keep clear of the sea and terrain.

Available encounters:

| Encounter | Category | Contacts | Durability | Reward per aircraft |
| --- | --- | --- | --- | --- |
| Silent Tide | Standard | 6 | 1 missile / 3 cannon hits | 1,200 |
| Border Patrol | Standard | 3 | 1 missile / 3 cannon hits | 1,200 |
| Elite Flight | Elite prototype | 4 | 2 missiles / 6 cannon hits | 2,200 |
| Heavy Contact | Boss prototype | 1 | 4 missiles / 12 cannon hits | 6,000 |

Elite and Boss use the existing procedural aircraft and patrol behavior with different stats. They do not include advanced AI, boss phases, or special weapons.

The HUD includes a pitch ladder, compass, airspeed, altitude, targeting cues, weapons, radar, and aircraft status. Chase and cockpit cameras are available. Sound starts muted; use the speaker button to enable the synthesized engine and combat effects.

| Input | Action |
| --- | --- |
| W / Up arrow | Pitch up |
| S / Down arrow | Pitch down |
| A / D or Left / Right arrows | Bank and turn |
| Q / E | Rudder left / right |
| Shift | Afterburner |
| B | Air brake |
| Space | Fire selected weapon |
| Tab | Cycle targets |
| 1 / 2 | Select missiles / cannon |
| F | Deploy flares |
| C | Switch chase / cockpit camera |
| Esc / P | Pause or resume |
| H | Show flight controls |

The flight-controls dialog and weapon/camera buttons offer the same actions on screen. Small touch screens also show steering, fire, and target buttons. Leaving the browser tab pauses an active sortie.

## Project files

- `src/main.js`: flight controls, combat, rendering, and interface integration.
- `src/game/state.js`: run state and phases; pause is a separate suspension flag.
- `src/game/round-director.js`: run lifecycle, round transitions, kill ownership, rewards, and detached snapshots.
- `src/game/encounters.js`: immutable encounter catalog and composition expansion.
- `src/combat/enemies.js`: procedural encounter spawning and disposal of replaced aircraft.
- `src/ui/intermission.js`: encounter selection interface.
- `src/world.js`: procedural terrain, ocean, sky, and aircraft geometry.
- `src/hud.js`: canvas flight instruments and tactical radar.
- `src/audio.js`: procedural Web Audio engine and combat sounds.
- `src/style.css`: responsive interface styling.

## Development checks

Run `npm test` for the lightweight Node tests and `npm run build` for production validation. No test dependency is required. Tests cover consecutive rounds, variable encounter sizes, kill ownership, pause, game over, invalid transitions, and snapshot isolation.

`window.__flight.getState()` returns a detached debugging snapshot, including phase, pause, round, round/total kills, kill sources, encounter summary, living enemy count, score, and flight telemetry. It exposes no mutable simulation references.

Round progression is `READY → COMBAT → ROUND_CLEAR → INTERMISSION → COMBAT`, with `GAME_OVER` on aircraft loss. Completion checks the current encounter's living enemies, independently of player kill counts. The director treats every encounter category identically. Add compositions and stats to the catalog to define another encounter; the selection UI is generated from that catalog.

M1–M3 are implemented. Wingman gameplay, hangar, aircraft selection, conversation/voice services, advanced combat AI, and save systems remain later milestones.

The scenery, aircraft geometry, interface, and sound effects are created in code. No original game models, soundtrack, or voice recordings are included. This is an independent fan project and is not affiliated with or endorsed by Bandai Namco. Ace Combat and related names belong to their respective owners.
