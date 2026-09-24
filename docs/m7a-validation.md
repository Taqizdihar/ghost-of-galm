# M7-A validation

M7-A supersedes the earlier [neural TTS experiment](m7-validation.md).
The prior measurements remain historical evidence; the current runtime has no
Chatterbox endpoint or model dependency. The canonical lorebook is unchanged.

## Automated checks

Results on `main` (2026-09-24): `npm install --no-audit --no-fund` succeeded;
`npm test` passed 30 tests; `npm run build` succeeded. A fresh Python 3.11
virtual environment installed `server/requirements.txt` and passed all 14
backend unit tests. The backend returns 404 for the retired TTS route.

- `npm test`: word tokenization, punctuation, deterministic variation, typing
  cancellation, safe manifest validation, empty pools, weighted selection,
  cooldown/no-repeat, context and boss phase filters, priority, ATTACK/REGROUP,
  confirmed event routing, no automatic LLM requests, and M1–M6 regressions.
- `npm run build`: Vite production bundle.
- `python -m unittest discover -s server/tests -v`: text chat backend and
  provider contract; no audio model or private recordings required.
- `python -m pip install -r server/requirements.txt`: lightweight backend
  dependencies only, when a clean environment is available.

## Browser checks and limits

Playwright loaded the Vite game in Chromium with zero console errors or
warnings. The empty manifest loaded, reported `audioAvailable: false`, and
made no MP3 request. With a mocked chat response, Larry's text revealed and
per-word oscillator creation was observed (five words, ten oscillators). A
sortie launched in COMBAT; clicking REGROUP cleared the wingman's target and
set its AI to REGROUP. The `3` key restored ATTACK. Chat input did not change
the order, and routine gameplay made no extra mocked chat request. No TTS
network request appeared. Reveal full stopped later grains (oscillator count
stayed at two), and reduced motion displayed the full reply with zero grains
and an inactive mumble state. Automated tests cover cancellation and mute.
Subjective audio quality cannot be certified by automation.

Browser testing should verify chat typing and first-word mumble, punctuation,
reveal/cancel, global mute, reduced motion, 3/4 commands, mouse/touch buttons,
REGROUP formation and evasion, empty radio pools, and the absence of TTS network
requests. Live Gemini/Ollama dialogue and subjective sound quality need a
configured provider and human listening. Real Pixy MP3 playback is M7-B work.

The manifest and all 27 empty leaf folders are committed as a scaffold.
No fake speech or private recordings are included. The Air Destroyer tree is
audio structure only; no boss gameplay or phases were added.
