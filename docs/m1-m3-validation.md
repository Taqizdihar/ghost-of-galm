# M1–M3 validation

Validated on 2026-09-22, on `main`.

## Build and focused tests

- `npm install`: passed; no new dependencies, no reported vulnerabilities.
- `npm run build`: passed. Vite reports a bundle over its 500 kB warning threshold (approximately 760 kB before gzip).
- `npm test`: four Node tests passed, including 100 consecutive simulated rounds, varying compositions, mixed kill ownership, pause, game over/restart, invalid transitions, and detached snapshots.
- `git diff --check`: passed.

## Browser checks

Used Playwright with the local Vite development server. Initial flight/input checks used the unmodified app. Combat and transition checks then used temporary browser response instrumentation to position targets, trigger incoming threats, invoke the real destruction function for remaining enemies, and place the aircraft below the terrain. The instrumentation was not added to application files or the public debug API.

Observed:

- Launch; pitch up/down, roll, rudder, afterburner, and air brake changed flight telemetry.
- Chase/cockpit switching, target cycling, missile lock, missile impact, and cannon destruction worked. A standard target took one missile; an Elite target took two.
- Missile warning, damage, flare deployment, and warning clearance worked.
- Pause/resume via P and Escape, help return, and window-blur pause worked; paused simulation time remained stable.
- Sound toggles and fullscreen entry/exit worked. Audio device output was not assessed by listening.
- Four consecutive rounds used Silent Tide (6), Elite Flight (4), Heavy Contact (1), and Border Patrol (3). Round-local kills reset, total kills/score persisted, and HUD totals followed the selected composition.
- Damaged health (28%), missiles, flares, weapon selection, and flight state carried between rounds without repair/rearm. Incoming warnings and leftover projectiles cleared.
- Injected `wingman` and `environment` destruction sources contributed to completion and separate ownership totals without a wingman implementation.
- Closing intermission kept the run suspended; Select Engagement reopened it.
- Terrain collision ended round 4 with GAME_OVER. Fly Again reset the run, health, and ammunition.
- Six subsequent equal-size encounters kept the renderer geometry count constant at 402; no accumulating aircraft geometries were observed in this sample.
- Mutating snapshot position, encounter summary, and kill-source counts did not affect the simulation.
- At 390 × 844, pointer-based steering, target selection, and cannon fire worked; intermission had no horizontal overflow. Its content scrolls vertically. This was browser emulation, not a physical touchscreen test.
- No browser console errors were observed.

Removed browser instrumentation and checked the production preview: launch, rendering, state snapshot, and pause passed; test hooks were absent.

## Scope and limits

These checks include controlled combat scenarios and accelerated destruction, not a complete unaided multi-round playthrough. Elite/Boss are stat variants using existing procedural aircraft and patrol movement. There is no difficulty escalation, repair/rearm, save system, or M4+ implementation. Both root GLBs retained their original SHA-256 hashes.
