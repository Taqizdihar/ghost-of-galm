# SUPERSEDED: historical M7 neural TTS experiment

This document preserves earlier Chatterbox measurements and validation as
historical evidence. The active M7-A architecture uses procedural chat mumble
and a separate empty prerecorded gameplay-radio manifest. See
[M7-A validation](m7a-validation.md). No Chatterbox installation or inference
is required by the current game.

# M7 voice wingman validation

Status: implementation, automated/browser checks and private sample generation
completed on `main` on 2026-09-23; final voice identity and radio sound remain
pending human listening.
The canonical lorebook was read and left unchanged. M8 microphone/STT, M9 AI,
boss assets and the existing Gemini/Ollama adapters were outside this change.

## Private dataset and preparation

The private Pixy voice root was readable outside the repository. The speaker's
consent was supplied for this task. Three neutral masters were found in
`00_raw/neutral`: session01 (28.0 s), session02 (67.5 s), session03 (44.0 s), all
48 kHz stereo. There were no clipped samples. Original SHA-256 values were
checked before and after preparation and did not change. There are no supplied
combat or relaxed masters, so separate emotional references cannot be compared
yet; the profile supports them if consented recordings are later available.

`python -m server.tools.prepare_voice` wrote timestamped files in the private
`01_curated`, `02_processed` and `03_reference` directories. It detects speech
regions, trims at quiet boundaries, folds stereo to mono, polyphase resamples to
24 kHz and applies a small level adjustment with a -3 dBFS peak ceiling, at most
3 dB boost, and short edge fades. Source gains were +0.48, -0.16 and +1.42 dB.
No denoising, compression, reverb or aggressive EQ was used. The processing
report lives privately in `notes/preparation-20260923T083737125608Z.json`.
Session01 yielded no complete 6–13 second phrase group under automatic quiet
boundary rules; manual listening/cutting may still find a good clip there.

Four private neutral reference candidates were produced:

| Private relative path under voice root | Length | Technical score |
| --- | ---: | ---: |
| `03_reference/primary/20260923T083737125608Z/pixy-neutral-session02-candidate01.wav` | 7.79 s | 0.838 |
| `03_reference/primary/20260923T083737125608Z/pixy-neutral-session02-candidate02.wav` | 9.19 s | 0.766 |
| `03_reference/primary/20260923T083737125608Z/pixy-neutral-session03-candidate01.wav` | 6.47 s | 0.662 |
| `03_reference/primary/20260923T083737125608Z/pixy-neutral-session03-candidate02.wav` | 6.63 s | 0.609 |

`05_final_profiles/profile.json` points provisionally to session02 candidate01
for all modes. The score measures technical properties only. It does **not**
measure identity similarity, acting quality or whether this reference sounds
best. `review_status` remains `pending`. Human listening can select another
relative private reference path, optionally with combat/relaxed alternates.

## Engine and architecture

The optional Python 3.11 environment has official `chatterbox-tts==0.1.7`,
PyTorch/torchaudio 2.6 CPU, FastAPI and existing LLM dependencies. Hardware is an
Intel i7-6500U, 16 GB RAM, Intel HD 520 and AMD Radeon R7 M370. There is no
compatible CUDA device; Chatterbox therefore runs on CPU with two Torch threads.
The installed Resemble Perth watermark package imports `pkg_resources`, which is
absent in a bare virtual environment and removed from Setuptools 82. An explicit
`setuptools==80.10.2` runtime pin restored the required watermark class; this
was checked by importing `PerthImplicitWatermarker`. The first model load failed
at that missing dependency before generating audio, and the pin was added to the
reproducible optional requirements before retrying.
The official Turbo model is loaded lazily, and only its needed meanflow decoder,
Turbo and voice encoder checkpoints are requested. Public model weights cache
outside the repository. Turbo's watermark is unmodified. No training occurred.

`/api/wingman/chat` still supplies validated `{text, mode, emotion}` from the
chosen Gemini or Ollama adapter. The browser displays text, then independently
calls `/api/wingman/tts`. A backend-only profile resolves the reference. The
browser can send no path, filename, model control tag or arbitrary emotion.
The TTS service has one worker, non-overlapping model use, and an in-memory LRU
cache bounded to 24 WAVs, 32 MiB and 15 minutes. Chunks are capped at 220
characters and combined into one clean PCM16 WAV. The cache includes reference
content revision and delivery settings; it holds no raw reference file.

The browser has a bounded priority queue with immediate playback cancellation,
stale response discard and scope cancellation. Game over is highest priority;
warnings can preempt lower speech; routine reactions queue and expire without
interrupting player conversation. Automatic reactions have eight recent phrases,
normalized duplicate suppression, an 18-second cooldown and every-other-kill
filter. The LLM may return silence for ordinary events, while direct chat and
game over still require speech text.

Generated WAV stays clean. Browser Web Audio applies three mode presets: COMBAT
high-pass 300 Hz/low-pass 3600 Hz, INTERMISSION 160/6500 Hz, HANGAR 65/14000 Hz,
with decreasing saturation/static. The procedural flight/effects bus ducks to
60%, 65% or 70%, respectively, with smooth attack/release; the shared master
implements global mute. CHAT contains voice enable, volume and stop controls.
These numeric presets are initial settings, not listening-approved values.

## Verification

- `npm test`: 32 passing Node tests (21 baseline, 11 new voice/comms tests).
- `python -m unittest discover -s server/tests -v`: 26 passing backend tests
  using synthetic WAV fixtures and fake providers, no external API/model.
- Under simultaneous model/browser/build load, one test's 20 ms timeout also
  covered its later cache lookup and flaked. That lookup now uses a normal
  deadline; the 20 ms cancellation assertion remains. The standalone final
  backend run passed all 26 tests.
- `npm run build`: passed, 34 modules; Vite retains an existing >500 kB chunk
  advisory because of the Three.js game bundle.
- Playwright on the running Vite game with mocked `/chat` and `/tts`: Pixy text
  was visible while speech was still preparing. A valid 8-second synthetic WAV
  decoded and played through a running AudioContext; voice state moved through
  synthesizing/playing, and the flight gain ducked and recovered. Global mute
  stopped playback, zeroed master gain and kept text. A 503 TTS response kept the
  displayed reply and showed `VOICE UNAVAILABLE · TEXT COMMS ACTIVE`; a separate
  503 chat response showed the existing comms interruption. Voice OFF suppressed
  synthesis. Browser audio-node test observed one simultaneous voice, routine
  reaction queued behind casual speech, critical preemption, COMBAT duck ~0.602,
  INTERMISSION duck ~0.653, recovery ~0.997. The first HANGAR sample was checked
  early in its smooth attack (~0.939); the later real-WAV test measured its
  settled gain at 0.700. These tests exercise browser playback with synthetic audio;
  a separate real generated WAV browser check is listed below.
- Flight smoke check on the same browser: launch, Pixy's Prototype GLB loaded,
  six Silent Tide contacts, hostile selection, manual lock request, rear view
  hold/release and pause all continued to work. The detached debug snapshot
  contained voice timing/state but no private voice paths.
- Live Gemini check through the restarted backend: a HANGAR chat returned HTTP
  200 with validated mode/emotion in 2,299 ms wall time, with 1,981 ms reported
  as LLM time. The same path in the browser displayed a 58-character response
  in 2,334 ms even while a deliberately failed TTS request showed voice
  unavailable. These are two single samples, not a latency distribution.
- While a real Turbo request was initializing in its separate worker, another
  live Gemini chat still returned HTTP 200 in 4,940 ms wall time (3,469 ms
  reported LLM time). Voice work did not block the chat endpoint, though CPU
  contention made this single LLM request slower.

## Real inference and latency

The required public Turbo checkpoint files (about 3.0 GB combined) were
downloaded and SHA-256 checked in private model cache. The model initialized
successfully on CPU in 122.916 seconds from cached weights, including Python
imports. A 7.79-second neutral reference was readable and conditioned. The
private generated samples and manifest are in
`04_test_output/20260923T093050Z/` under the configured private voice root.
Every output was verified as 24 kHz mono PCM16 WAV; none is in Git or `dist`.

| Private output | Mode / content | Generated audio | CPU generation |
| --- | --- | ---: | ---: |
| `neutral.wav` | INTERMISSION: “Hey, Kid. You ready?” | 1.74 s | 220.445 s, first conditioning |
| `combat.wav` | COMBAT: “Kid, break! Missile!” | 2.22 s | 53.856 s |
| `relaxed.wav` | HANGAR: “Yeah. I'm still here.” | 2.34 s | 46.988 s |
| `reflective.wav` | HANGAR: “Some parts of Galm are better left where they are.” | 2.70 s | 57.422 s |
| `comparison01.wav` | INTERMISSION, session02 candidate02 | 2.10 s | 130.514 s, new conditioning |
| `comparison02.wav` | INTERMISSION, session03 candidate01 | 2.86 s | 123.192 s, new conditioning |

The same seed 7 and neutral text were used for comparisons. Temperature was
0.65 for COMBAT and 0.7 otherwise; repetition penalty was 1.2. WAVs have no
radio processing. Each comparison conditions a different reference, so its
timing is not comparable to already-conditioned repeated lines. These values
show that this CPU cannot provide real-time combat voice. A combat utterance
generated in ~54 seconds normally misses the 45-second combat freshness window
and is intentionally discarded; text still appears. Neutral first-use time
includes one-time library/conditioning work. The previous 180-second voice
deadline would have timed out the first cold request on this machine, so the
voice-only default is now 600 seconds (browser 605), with a 630-second casual
freshness window. Model and network variance may still cause timeouts. The
time-to-scheduled-playback measurement is not acoustic speaker latency.

The first real `/api/wingman/tts` request after backend launch returned HTTP
200 and RIFF WAV bytes in **420.971 seconds** wall time; its generation header
reported **420,173.9 ms**. It was not cached. A repeat of exactly that
INTERMISSION text/mode/emotion returned HTTP 200 in **3.332 seconds** wall time
with `X-TTS-Cache-Hit: true` and generation header 0 ms. Changing only the mode
to HANGAR produced a fresh HTTP 200 WAV in **79.163 seconds** wall time,
generation header **76,660.3 ms**, proving the mode is part of the cache key.
The cold 421-second result leaves little margin under 450 seconds; the default
was increased again to 600 seconds before finalization. These are isolated
measurements on this machine, not performance promises.

In a browser using a controlled chat response and the **actual backend TTS**
cache, the clean generated WAV decoded and played through the game audio chain.
The HANGAR voice started 143 ms after text arrival, the flight bus settled at
0.700 during speech, and returned to 0.996 shortly after it ended. The browser
reported `cached: true` and a running AudioContext. An **uncached** generated-WAV
browser test then displayed “Yeah. I'm still here.” immediately with status
`VOICE / PREPARING…`, while the flight bus stayed at full gain. It later played
successfully and returned to idle; the browser timing snapshot reported
**90,101.2 ms** TTS generation and **90,435 ms** from text arrival to audio
start, `cached: false`. This warm-model request was substantially slower than
the 47-second sample process result, showing CPU load variance. The browser
measure is scheduled Web Audio start, not acoustic device output latency.
Repeating the now-cached generated HANGAR line and clicking global mute during
playback changed the voice state from `playing` to `muted`, stopped speech,
set master gain to 0, allowed flight gain to recover, and left the same text
visible. Thus mute behavior was also verified with actual generated speech.

## Known limits and review

CPU inference cannot be safely interrupted inside a PyTorch kernel. Browser
playback stops immediately and stale audio is discarded, but the server worker
remains busy until inference finishes; the next request may get a voice-only
503. This has no effect on text chat or gameplay. Speech returns one WAV after
all chunks; there is no streaming first sentence. CPU latency and expiry mean
most combat speech will not play on this measured machine. Game sound starts muted until the player enables
it. A deployed domain requires a separate reachable backend with private voice
storage and sufficient compute; a static build alone has no synthesis runtime.

The speaker/user must listen to the private candidates and generated samples
before approving voice similarity, pronunciation, naturalness, emotional
delivery, chosen reference and radio intensity. No subjective approval is
claimed here.
