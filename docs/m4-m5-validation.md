# M4–M5 validation

Validated September 22–23, 2026, on `main`. M1–M3 remain the baseline.

## Build and automated checks

- `npm.cmd install`: passed with existing dependencies. The `.cmd` launcher avoids this Windows environment's PowerShell script-execution restriction.
- `npm.cmd test`: 14 passing Node tests. Covers 100 consecutive rounds, variable encounter sizes, ownership, hangar transitions, deterministic formation/evasion/engagement, hardpoint transforms, missile/cannon callbacks, laser intersection and timing, persistent damage/loss, manual lock, square radar bounds, and detached snapshots.
- `npm.cmd run build`: passed. Main JS is approximately 826 kB / 223 kB gzip. The existing Vite 500 kB chunk warning remains; the Draco wrapper and WASM are separate local assets.
- `git diff --check`: passed.
- No dependencies, frontend frameworks, backend, conversational/voice systems or final Elite/Boss mechanics were introduced.

## Runtime method

Used Chromium through Playwright, the Vite development server, and the final production preview. Regular DOM/keyboard/pointer interactions checked launch, selection, controls and dialogs.

For repeatable combat checks, temporarily intercepted the served development `main.js` response to append browser-only fixtures. These positioned aircraft/targets, advanced the real flight/AI/projectile/director update functions in 0.05-second steps, triggered the existing threat timer, and cleared some enemies through the actual destruction function. No fixtures were written into application files, production output or `window.__flight`. Assertions involving damage/timers used an atomic before/step/after sample to avoid intervening animation frames.

These are controlled runtime scenarios, not an unaided six-round playthrough or a long-duration performance benchmark. Touch controls were exercised using browser pointer emulation, not physical hardware. Audio controls were checked without assessing output by listening.

## Observed behavior

- New run opened Flight Operations with **The Ghost of Galm** selected by default. GALM 1 remained the fixed F-15C.
- Both supplied GLBs decoded successfully, including embedded textures. Visual inspection alongside the procedural aircraft confirmed upright orientation, aligned noses and comparable scale. [Aircraft comparison](m4-m5-aircraft.png): Pixy on the left, Ghost in the center, procedural F-15C on the right.
- Bounds-normalized lengths are 24 m / 27 m. Observed uniform scale corrections are approximately 0.0220276 / 1.124879. Both use a 180-degree wrapper yaw. Original GLB contents were preserved during relocation.
- Autonomous GALM 2 scored three kills during 25 simulated seconds in the default encounter. Shared homing missiles and cannon hits both dealt damage. Wingman kills appeared under `killsBySource.wingman`.
- A controlled final cannon kill by GALM 2 moved the run through ROUND_CLEAR into INTERMISSION. An active defensive break delayed that attack until the wingman returned to engagement.
- An enemy threat selected GALM 2, triggered EVADE, and inflicted 240 wingman HP through the centralized adapter. Destroying GALM 2 left the player's run in COMBAT, hid/disabled the wingman, and stopped its laser.
- Six consecutive rounds exercised direct continuation, hangar cancellation/reopening, unchanged wingman condition, destroyed-wingman persistence, and switching to Pixy's Prototype. Selected encounters and run score persisted. Opening/keeping the same airframe preserved 1,020 wingman HP; later, keeping a destroyed airframe preserved 0 HP. Switching supplied Pixy at 2,000 HP. GALM 1 retained 52 health, 19 missiles and 3 flares across these transitions.
- Pixy's beam was visibly rendered. In an isolated 0.5-second sample it dealt exactly 2.5 existing enemy HP, equivalent to the configured 50 wingman damage/sec. It stopped after the five-second burst, retained roughly 114.5 seconds of cooldown, froze during pause, and carried cooldown into the next round. It stopped on combat end and wingman destruction. Node tests separately verify nearest-hostile intersection, off-axis/behind/out-of-range misses and total five-second damage.
- The square radar, square clipping, north/reference marker, cyan friendly diamond/“2”, hostile dots and amber selected-hostile marker rendered. The remaining circular CSS border was removed after visual review.
- No passive lock occurred. L requested acquisition, a second L cancelled, and cycling/destruction cleared it. Space could not spend a missile before lock; after acquisition it launched and destroyed a target. Cannon fire worked without lock.
- Hold V reversed camera viewing direction in Chase and Cockpit; release restored forward view and the selected camera. Heading stayed unchanged. C still switched cameras.
- At 390 × 844, touch LOCK, missile fire, target selection and pitch input worked; Flight Operations had no horizontal overflow. Larger coarse-pointer screens also receive the touch controls.
- Pitch, roll/rudder, throttle/brake, cannon, player missile warning/damage, flare protection, help, pause/resume, sound toggles and fullscreen remained functional. Terrain collision ended the run; Fly Again returned to aircraft selection and reset score/condition on launch.
- Mutating snapshot player/wingman positions, normalization arrays and kill-source counts did not mutate the simulation.
- Intentionally aborting a GLB request produced the expected network error plus a clear GALM 2 loader error. A procedural substitute became active, with fallback status exposed in HUD/debug data, while combat remained available.

## Final production check

Removed response interception and loaded the final production preview. Both aircraft loaded from the relocated runtime paths; the decoder wrapper/WASM loaded locally. Launch, manual lock/cancel, pause, restart and cancelling/reopening preflight selection passed. No test hook was present and no console/page errors occurred. No request loaded the Boss asset.

## Provisional behavior and limits

- Switching to a different wingman supplies full HP and fresh weapon timers; this is an intentional provisional replacement rule, with no economy or repair/rearm implementation.
- Wingman cannon damage is 0.3 prototype HP per bullet. Player cannon remains 1 HP and player missiles remain 3 HP; existing enemy durability is unchanged. AI firing cadence and relative wingman effectiveness still need extended play balancing.
- Flight AI is a small local state machine. Enemy attacks remain the existing timed threat abstraction, extended to alternate between nearby friendlies. No advanced dogfight or Boss/Elite systems were added.
- Model correction uses wrappers and runtime visibility for alternate deployed gear/refueling nodes. External aircraft authorship/license terms remain to be recorded before public redistribution.
- M6+ systems, persistence, multiple player choices, physical landing and `boss_air-destroyer.glb` integration remain out of scope. The Boss asset remains untouched at the root.
