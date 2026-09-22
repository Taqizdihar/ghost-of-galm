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

Select **Launch Sortie**, choose GALM 2's aircraft in Flight Operations, then launch round 1, a six-aircraft Silent Tide patrol. GALM 1 remains the procedural F-15C. Destroy every hostile to clear the round, then select the next engagement and **Continue Sortie**, or open **Hangar / Change GALM 2** first. Rounds have no final limit; losing GALM 1 ends the run.

Health, missiles, flares, aircraft position, and flight state carry between rounds. There is no intermission repair or rearm; the cannon has unlimited ammunition. GALM 2's HP, destruction and weapon cooldowns also persist. Combat and its timers stop during intermission/hangar. Closing the encounter dialog leaves the run suspended; **Select Engagement** reopens it. Closing the hangar returns to the selected encounter. **Fly Again** after aircraft loss, or **Restart Run** from pause, opens aircraft selection for a fresh run.

Use **Tab** to select a living hostile, then **L** (or touch **LOCK**) to request missile lock. Keep it within the existing forward/range envelope for 0.65 seconds: **ACQ** becomes **LOCK**. Missiles require completed lock. Press L again to cancel; cycling or destroying the target clears the request. Leaving the envelope resets acquisition but retains your request for that same target. The cannon needs no lock. Deploy flares when a missile warning appears, and keep clear of terrain.

GALM 2 follows a formation offset, independently engages enemies, breaks defensively when threatened, and regroups after losing a target. Its local deterministic AI uses shared missiles and cannon hits; wingman kills count toward round completion and score. Enemies alternate their existing timed missile threats between nearby friendly aircraft. Wingman loss does not end your run or trigger an automatic replacement next round.

| GALM 2 aircraft | HP | Missile / cannon damage | Special |
| --- | --- | --- | --- |
| The Ghost of Galm (default) | 1,500 | 30 / 3 per bullet | None |
| Pixy's Prototype | 2,000 | 30 / 3 per bullet | Linear Laser: 50 damage/sec, 5 sec burst, 120 sec cooldown |

The laser follows the aircraft's forward axis from its configured emitter and damages the nearest intersecting hostile. It stops on wingman loss or combat end. Cooldown starts at activation and advances only during combat. **Provisional hangar rule:** confirming a different wingman aircraft supplies a full-health replacement with fresh weapon timers. Keeping the same aircraft preserves its damage or destruction. Opening the hangar never repairs/rearms GALM 1.

Available encounters:

| Encounter | Category | Contacts | Durability | Reward per aircraft |
| --- | --- | --- | --- | --- |
| Silent Tide | Standard | 6 | 1 missile / 3 cannon hits | 1,200 |
| Border Patrol | Standard | 3 | 1 missile / 3 cannon hits | 1,200 |
| Elite Flight | Elite prototype | 4 | 2 missiles / 6 cannon hits | 2,200 |
| Heavy Contact | Boss prototype | 1 | 4 missiles / 12 cannon hits | 6,000 |

Elite and Boss use the existing procedural aircraft and patrol behavior with different stats. They do not include advanced AI, boss phases, or special weapons.

The HUD includes a pitch ladder, compass, airspeed, altitude, targeting cues, weapons, square radar, and aircraft status. The heading-relative radar retains its 8 km scale and north marker, clamps distant contacts to square edges, and distinguishes GALM 1's center symbol, cyan GALM 2 diamond/“2”, hostile dots and the amber selected hostile. Hold **V** to look behind from Chase or Cockpit; release restores the selected camera immediately. Sound starts muted; use the speaker button to enable the synthesized engine and combat effects.

| Input | Action |
| --- | --- |
| W / Up arrow | Pitch up |
| S / Down arrow | Pitch down |
| A / D or Left / Right arrows | Bank and turn |
| Q / E | Rudder left / right |
| Shift | Afterburner |
| B | Air brake |
| Space | Fire selected weapon |
| Tab | Cycle living hostile targets; clear lock |
| L | Request / cancel missile lock |
| 1 / 2 | Select missiles / cannon |
| F | Deploy flares |
| C | Switch chase / cockpit camera |
| V (hold) | Rear view; release to restore selected camera |
| Esc / P | Pause or resume |
| H | Show flight controls |

Small screens and larger touchscreens show steering, fire, target and LOCK buttons. Weapon/camera buttons and the flight-controls dialog remain available. Leaving the browser tab pauses an active sortie.

## Project files

- `src/main.js`: flight controls, combat, rendering, and interface integration.
- `src/game/state.js`: run state and phases; pause is a separate suspension flag.
- `src/game/round-director.js`: run lifecycle, round transitions, kill ownership, rewards, and detached snapshots.
- `src/game/encounters.js`: immutable encounter catalog and composition expansion.
- `src/combat/enemies.js`: procedural encounter spawning and disposal of replaced aircraft.
- `src/ui/intermission.js`: encounter selection interface.
- `src/ui/hangar.js`: preflight/intermission wingman selection.
- `src/aircraft/catalog.js`: aircraft stats, normalization, collision radii and wrapper-local hardpoints.
- `src/aircraft/assets.js`: procedural/GLB visual loading, local Draco decoder and visible fallback; disposal on replacement.
- `src/aircraft/attachments.js`: local-to-world hardpoints and forward direction.
- `src/aircraft/wingman.js`: deterministic formation/engagement/evasion/regrouping, HP and weapons, lightweight laser effect.
- `src/combat/damage.js`: centralized unit conversion and forward beam intersection.
- `src/combat/manual-lock.js`: manual lock request/acquisition lifecycle.
- `src/world.js`: procedural terrain, ocean, sky, and aircraft geometry.
- `src/hud.js`: canvas flight instruments and tactical radar.
- `src/audio.js`: procedural Web Audio engine and combat sounds.
- `src/style.css`: responsive interface styling.

## Development checks

Run `npm test` for the lightweight Node tests and `npm run build` for production validation. No test dependency is required. Tests cover consecutive rounds, kill ownership, hangar transitions, deterministic wingman flight, weapons, laser duration/cooldown, damage/destruction, hardpoints, manual locking, square radar bounds and snapshot isolation. See [M4–M5 validation](docs/m4-m5-validation.md) for browser checks and their limits.

`window.__flight.getState()` returns a detached debugging snapshot, including phase, round, score, kill sources, encounter and flight telemetry, selected wingman aircraft, HP/alive/AI/target state, weapon timers, model loading status/normalization, manual lock and rear view. It exposes no mutable simulation or Three.js references.

Round progression is `READY → HANGAR → COMBAT → ROUND_CLEAR → INTERMISSION → COMBAT`, with optional `INTERMISSION → HANGAR → INTERMISSION → COMBAT` and `GAME_OVER` on player loss. Pause remains separate. RoundDirector checks living enemies independently of kill ownership. Add compositions and stats to the encounter catalog to define another encounter.

M1–M5 are implemented within the current scope: one fixed player aircraft and two wingman choices. Final Elite/Boss mechanics, advanced dogfighting, physical landing, conversation/voice services and saves remain out of scope. `boss_air-destroyer.glb` remains untouched at the repository root for M9.

## Aircraft assets and combat units

The supplied wingman GLBs live in `public/assets/aircraft/wingman/`. Both use Draco compression; GLTFLoader and the decoder/WASM come from the existing Three.js package and are bundled locally. No CDN or new dependency is required. Only the selected GLB is loaded. Failed loading produces a console error, HUD notice and visible procedural substitute.

Original geometry, skinning and materials remain intact. A wrapper applies a 180° yaw correction, centers the exported bounds and scales the models to 24 m (Ghost) / 27 m (Pixy) in length, comparable to the procedural aircraft. Pixy's duplicated deployed landing-gear/refueling nodes are hidden at runtime. Attachments use normalized wrapper coordinates: +X right, +Y up, −Z forward. Missile/cannon/laser origins are transformed into world space at use time.

Catalog HP/damage are authoritative. The adapter uses **10 wingman HP = 1 existing combat unit**: a 30-damage wingman missile deals 3 existing enemy HP, a 3-damage bullet deals 0.3, and the laser deals 5/sec. A legacy 24-unit incoming hit deals 240 wingman HP. Player weapons, enemy HP and their existing time-to-kill are unchanged. Wingman cannon rate/AI and replacement rules remain tuning items.

Scenery, player/enemy aircraft, interface and flight sounds remain procedural. Wingman visuals are supplied external assets; their authorship/license/redistribution terms still need to be recorded before public distribution. Draco's bundled decoder is Apache-2.0 licensed (see the Three.js package's `examples/jsm/libs/draco/README.md`). No soundtrack or voice recordings are included. This is an independent fan project, unaffiliated with Bandai Namco. Ace Combat and related names belong to their respective owners.
