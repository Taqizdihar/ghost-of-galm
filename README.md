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

Select **Launch Sortie** and destroy all six hostile aircraft. Keep the selected target near the center of the HUD until the target locks, then fire a missile. Use the radar and target selector to find the next aircraft. The cannon works at close range. Deploy flares when a missile warning appears, and keep clear of the sea and terrain.

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

- `src/main.js`: flight controls, combat, mission lifecycle, and interface.
- `src/world.js`: procedural terrain, ocean, sky, and aircraft geometry.
- `src/hud.js`: canvas flight instruments and tactical radar.
- `src/audio.js`: procedural Web Audio engine and combat sounds.
- `src/style.css`: responsive interface styling.

The scenery, aircraft geometry, interface, and sound effects are created in code. No original game models, soundtrack, or voice recordings are included. This is an independent fan project and is not affiliated with or endorsed by Bandai Namco. Ace Combat and related names belong to their respective owners.
