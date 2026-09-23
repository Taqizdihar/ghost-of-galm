# M6 — Wingman text conversation validation

Validated September 23, 2026 on `main`. M1–M5 gameplay remains the baseline.
The canonical `docs/wingman/lorebook.md` and aircraft/Boss assets were not edited.

## Architecture and changes

- `server/`: optional FastAPI endpoint, environment configuration, canonical
  lorebook loading, strict Pydantic request/response models, prompt construction,
  bounded history, provider interface and Ollama implementation. The separate
  `server/tests/mock_app.py` serves synthetic dialogue only when explicitly run.
- `src/comms/`: dedicated allowlisted context builder, request timeout/abort/
  validation, session conversation memory and confirmed-event throttling.
- `src/ui/wingman-chat.{js,css}`: tactical PX placeholder, status, latest exchange,
  keyboard/touch form, cancellable local typing animation, reveal action and
  reduced-motion support. The same panel moves into modal dialogs for access.
- `src/main.js`: narrow UI/input/event integration, separate AWACS channel and
  detached conversational status in `window.__flight.getState()`.
- `src/audio.js`: procedural radio-static effect on the existing muted master bus.
- `src/hud.js`, `src/ui/{hangar,intermission}.js`: current-operation PILOT 1/PIXY
  labels and PX radar marker. Historical lore and prior validation records remain
  historical. `vite.config.js` provides same-origin development/preview proxying.
- `.env.example`, `.gitignore`, `README.md`, `AGENTS.md`: safe local configuration,
  setup, canonical identity rules and completed M1–M5 / active M6 status.
- `tests/conversation.test.js`, `server/tests/test_chat.py`: focused contracts,
  boundaries and failure tests without a real model.

The precise payload, mode mapping, history policy and reaction cooldowns are
documented in the README. There is no gameplay command receiver in this layer.
The frontend sends no `window.__flight` snapshot, provider configuration or lore.

## Automated validation

- `npm.cmd install --ignore-scripts`: passed with the existing frontend dependency
  set. The `.cmd` launcher avoids the machine's PowerShell script policy.
- `npm.cmd test`: 21 passing tests, including the original 14 gameplay tests.
  Tests cover 100 consecutive rounds, ownership, hangar persistence, local AI,
  laser damage/timing, lock and radar geometry, plus context omission/detection,
  modes, bounded/detached history, stale replies, duplicate sends, malformed
  responses, abort/deadline, event dedup/cooldown/backoff, text input detection
  and static's mute/device handling.
- `python -m unittest discover -s server/tests -v`: ten passing tests covering
  canonical loading, role separation, context rejection, bounded history,
  response/mode/event contracts, reasoning-markup rejection, provider failures
  and timeout/concurrent-request handling. Ollama HTTP behavior uses `httpx.MockTransport`.
- `npm.cmd run build`: passed. Vite retains the existing warning for the main
  chunk exceeding 500 kB; no new frontend dependency was added.
- The installed FastAPI/Starlette test stack emits a deprecation notice for its
  httpx TestClient compatibility path; tests still pass.

## Browser and live API checks

Used Chromium/Playwright with Vite and an explicitly started FastAPI mock provider.
Regular DOM/keyboard interactions verified:

- Chat appears below navigation and above the mission panel at 1440 × 900 and
  390 × 844. The left stack scrolls when expanded; radar and touch controls remain
  outside it. Chat remains interactive inside preflight/hangar dialogs.
- Enter focuses chat. Typed W/A/S/D/Q/E/F/L/C/V/P/H/1/2, Space and ArrowUp do not
  change heading, selected camera/weapon, missiles or flares. Escape restores
  flight input; camera toggle, held rear view and pause/resume still work.
- The live relative API returns synthetic HANGAR and COMBAT replies. The response
  animates locally and the reveal action shows the complete text. Preflight
  conversation is retained into the first combat round.
- Captured requests contain only `mode`, own `wingman` status, quantized detected
  `contacts`, and confirmed `events`, with bounded dialogue in separate fields.
  The user message “Attack that target.” remains ordinary text, with no command
  path or AI-state mutation from the response handler.
- A controlled HTTP 503 displays exactly
  `COMMS INTERRUPTED. TEMPORARILY UNAVAILABLE.`. During that check elapsed combat
  time advanced by 1.38 seconds, and player and wingman positions both advanced.
  No canned Pixy dialogue replaced the failure state.

For deterministic event/progression checks, temporary interception appended a
test fixture to the served development `main.js` **in the browser only**. It
called existing damage, destruction, director and flight functions. No fixture
was written into application source, production output or the shipped snapshot.
Observed:

- A real player-hit path requested `PLAYER_HIT`; the request contained the event
  but no player HP. A nearby wingman-hit event recorded condition and respected
  the existing reaction cooldown.
- Player condition (76 HP) and wingman condition (1,260 HP) survived intermission
  and opening/cancelling the hangar. The selected Border Patrol encounter survived.
- Switching aircraft loaded Pixy's Prototype GLB at 2,000 HP. Round 2 had three
  hostiles, retained 7,200 score and retained the player's condition. Both GLBs
  loaded successfully during the checks.
- Terrain collision produced GAME_OVER and its dedicated short reaction request,
  preserving the game-over dialog and read-only snapshot.

The normal `server.app:app` was also started separately and queried over HTTP
with no reachable Ollama. It returned HTTP 503 with exactly the controlled error
detail; no provider exceptions, prompts or private configuration were exposed.

Normal runtime checks had no serious JavaScript/page errors. An intentionally
failed 503 request produces the browser's expected failed-network diagnostic.
Test-harness setup retries were not application failures.

The final production preview was tested without source interception. Chat/API
proxying, partial typing followed by full reveal, Tab to Send, Escape back to
controls, GLB loading, manual missile lock, spending one missile and pause all
passed. No test hook was present. During an earlier unpaused production check,
the autonomous wingman cleared all six hostiles and entered intermission; a lock
assertion that outlived those targets was rerun immediately after launch.

## Limits before M7

- **No real Ollama inference was performed.** The local Ollama API was unavailable
  and no model was downloaded. Mocked responses validate plumbing, not Qwen's
  personality, English fluency, canonical fidelity or resistance to adversarial
  prompts. Those need a real-model evaluation. System-role separation is tested;
  semantic obedience by an LLM is not guaranteed by a unit test.
- Full canonical lore is loaded server-side; the Ollama context window is set to
  32,768 tokens. Cold-start latency and memory use depend on local hardware. The
  default backend/browser deadlines are 20/25 seconds.
- Detection uses a conservative 8 km distance/visibility filter; M1–M5 has no
  richer sensor/occlusion simulation. Browser context is validated structurally,
  not independently authenticated against a server-side simulation.
- Static was verified through audio-path/mute tests, not by listening. Mobile
  validation used browser emulation, not a physical device or soft keyboard.
- Controlled progression checks and existing unit coverage are not an unaided
  endurance playthrough or a new combat balancing pass.
- No voice, STT, microphone, persistent memory, LLM gameplay commands, advanced
  enemy AI or Boss/Elite behavior was added. Public deployment hardening and
  real-model latency/persona evaluation remain separate work.
