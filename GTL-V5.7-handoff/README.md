# Guitar Theory Lab — V5.7 design-to-code handoff

Design package for the production React/TypeScript repository. **Nothing in the production repository was modified.**
Source of truth for the visuals: the Claude Design artifact "Fretboard Lab — Studio V5.7" (version 21, 2026-11-08).

## Contents

| Folder | What it is |
|---|---|
| `react/` | Typed React components for the device overlay system (drawer shell, mixer, amp, tuner, interface, rotary knob), tokens, asset map, state/callback contracts. Type-checks with `tsc --noEmit` (TypeScript 5.6, strict). Not wired to audio. |
| `assets/` | 24 rendered hardware assets (@2x) + `MANIFEST.json` (size, hash, blend source, artifact blob id). |
| `blender/` | `scripts/` regenerate every asset; `blend/` the saved scenes (Blender 5.2.3, Cycles, orthographic top camera); the two fonts used for engraved text. |
| `prototype/` | The full interactive prototype: `project/` = artboards exactly as published, `src/` = the build sources (`build.py` assembles `Main.dc.html`), `serve.py` = local server that serves `/_blob/<id>` from `assets/`. |
| `fonts/` | Barlow, Barlow Condensed, Cormorant Garamond, IBM Plex Mono (woff2 + licence). |
| `screenshots/published/` | Captured from the **published artifact** in Chrome (1440×900, 1366×768, 1100×720). |
| `screenshots/local/` | Local Chromium renders (same build, same asset bytes). |
| `tests/` | Playwright scripts and `validation-local.json` (5 viewports). |

## Component map

| Prototype (Main.dc.html) | React handoff | Notes |
|---|---|---|
| `.dvx / .dvscrim / .dvl / .dv` + `closeOv()` | `DeviceDrawer` + `drawer.css` | One device at a time, Esc, focus to close button and back to launcher, exit animation, reduced motion. |
| `.dvm6` mixer, `mixer6` in `renderVals()` | `MixerDevice` (`MIXER` geometry) | Fader 0..100 → dB `-30 + v·0.36`; Solo disabled until `onSoloToggle` exists. |
| `.a6` amp, `amp6` | `AmpDevice` (`AMP`) | Visual demo; `processingConnected` drives the honesty label. |
| `.t6` tuner, `arc`, `tnLed`, `calibK` | `TunerDevice` (`TUNER`) | Reading only from props. |
| `.i6` interface, `gainK`, `ioChans` | `InterfaceDevice` (`IFACE`) | Live monitor never auto-enabled. |
| `rk()` helper | `RotaryKnob` | Static lit body + rotating pointer; −135°..+135°; drag 0.6 units/px; arrows ±2, Shift ±10, Home/End, double-click reset. |
| `GTLMarker.dc.html` | not ported (fretboard is out of scope) | Props documented in `react/src/types.ts` (`VizPrefs`). |
| `fitS()` | `fitScale()` | Device scale = min(1, (nbH−16−note)/h, (nbW−20)/w), floor 0.45. |

Integration order: mount `DeviceDrawer` as the last child of the notebook container (`position:relative; overflow:hidden` — the drawer is clipped to the notebook on purpose, the shadow is inside the render margin), keep the notebook page and tab state outside it, pass the device as children.

## Device animation specification

| Phase | Value |
|---|---|
| Entrance | `translateY(100% + 24px) → −3 px (78%) → +1 px (90%) → 0`, 340 ms, delay 40 ms, `cubic-bezier(.25,1.12,.4,1)` |
| Exit | `0 → −3 px (22%) → translateY(100% + 24px)`, 200 ms, `cubic-bezier(.5,0,.9,.4)`; unmount after 260 ms |
| Slot (rail at the notebook's bottom edge) | scaleY 0→1 in 160 ms; out 200 ms with 80 ms delay |
| Scrim | opacity 0→1 in 200 ms; click closes |
| Device switch | replaces the device immediately (no exit), slot stays |
| Reduced motion | 120 ms opacity fade in; close is immediate; slot static |
| Notebook | never moves; active tab and scroll position preserved |

Inspired by the mechanical panel drop of the Pip-Boy interface: a short overshoot (3 px) and a hard settle, no scale or rotation. No third-party artwork is used.

## Shadow clipping — what was wrong and the fix

* The V5.6 renders were framed 24 px around the device: the soft shadow reached the PNG edge (alpha up to 209 at the border) and was cut by the image itself, and wrappers had `overflow:hidden`.
* Fix: the four device bodies are re-rendered with a 40/32 px shadow margin (render frames 890×490, 930×402, 490×462, 730×312 css px) and an alpha feather on the last 28 css px, so every edge reaches alpha 0. Wrappers are `overflow:visible`; the body image is offset −16/−12 px inside the device canvas, so all live controls keep their coordinates.
* The notebook (`.nb`) uses `overflow:clip` so focusing the close button can never scroll the notebook under the drawer (a browser `focus()` scroll bug seen during testing; `focus({preventScroll:true})` is also used).

## Design tokens and typography

See `react/src/tokens.ts`. Families: Barlow (UI), Barlow Condensed (silk-screen labels, uppercase, letter-spacing .1–.14em), Cormorant Garamond (brand engraving, notebook tabs), IBM Plex Mono (LCD and readouts). Prototype token CSS: `prototype/project/ds/guitar-theory-lab/tokens.css`.

## UI state and callback contracts

See `react/src/types.ts`. Persisted keys (localStorage, always try/catch): `gtl.v5.fbR` divider ratio, `gtl.v5.railX`, `gtl.v5.dens`, `gtl.v5.lcdX`, `gtl.v5.vz` (visualization prefs), `gtl.v5.dev` (mixer/amp/interface/calibration). Live monitor, DEMO signal and tuner on/off are never restored.

## Assets

Use the files in `assets/`; reference them through `react/src/assets.ts` (`ASSET_BASE`). In the Claude artifact they are served from its asset store (`/_blob/<id>`, ids in `assets/MANIFEST.json`) — relative `assets/…` paths do not resolve there.

| File | px | css px | Format | Size | Use | Source scene |
|---|---|---|---|---|---|---|
| `amp-body@2x.webp` | 1860×804 | 930×402 | WEBP | 58 KB | Amp head chassis | `blender/blend/amp-body.blend` |
| `btn-mute-on@2x.png` | 132×76 | 66×38 | PNG | 12 KB | Mixer Mute on | `blender/blend/btn-mute-on.blend` |
| `btn-off@2x.png` | 132×76 | 66×38 | PNG | 11 KB | Mixer Mute/Solo off | `blender/blend/btn-off.blend` |
| `btn-solo-on@2x.png` | 132×76 | 66×38 | PNG | 11 KB | Mixer Solo on (reserved; Solo disabled) | `blender/blend/btn-solo-on.blend` |
| `coil@2x.png` | 56×48 | 28×24 | PNG | 2 KB | Notebook spiral (repeat-y 28×24 css px) | `blender/blend/coil.blend` |
| `fader-cap-master@2x.png` | 120×144 | 60×72 | PNG | 18 KB | Mixer fader cap Master | `blender/blend/fader-cap-master.blend` |
| `fader-cap@2x.png` | 120×144 | 60×72 | PNG | 17 KB | Mixer fader cap (6 ch) | `blender/blend/fader-cap.blend` |
| `footswitch@2x.png` | 220×220 | 110×110 | PNG | 42 KB | Tuner footswitch | `blender/blend/footswitch.blend` |
| `iface-body@2x.webp` | 1460×624 | 730×312 | WEBP | 41 KB | Interface chassis | `blender/blend/iface-body.blend` |
| `key-down@2x.png` | 120×104 | 60×52 | PNG | 13 KB | Hardware key pressed | `blender/blend/key-down.blend` |
| `key-lit@2x.png` | 120×104 | 60×52 | PNG | 13 KB | Hardware key active (amber) | `blender/blend/key-lit.blend` |
| `key-up@2x.png` | 120×104 | 60×52 | PNG | 14 KB | Hardware key idle (nine-slice 30px / 13 css px) | `blender/blend/key-up.blend` |
| `knob-alu@2x.png` | 168×168 | 84×84 | PNG | 32 KB | Interface gain knob body | `blender/blend/knob-alu.blend` |
| `knob-black@2x.png` | 112×112 | 56×56 | PNG | 15 KB | Tuner calib knob body | `blender/blend/knob-black.blend` |
| `knob-gold@2x.png` | 144×144 | 72×72 | PNG | 25 KB | Amp knob body | `blender/blend/knob-gold.blend` |
| `lcd9@2x.webp` | 600×200 | 300×100 | WEBP | 1 KB | LCD bezel+glass (nine-slice 26px / 13 css px) | `blender/blend/lcd9.blend` |
| `mixer-body@2x.webp` | 1780×980 | 890×490 | WEBP | 61 KB | Mixer chassis | `blender/blend/mixer-body.blend` |
| `plate9@2x.webp` | 800×320 | 400×160 | WEBP | 3 KB | Console/fretboard plate (nine-slice 44px / 22 css px) | `blender/blend/plate9.blend` |
| `rail-wood9@2x.webp` | 240×1200 | 120×600 | WEBP | 13 KB | Rosewood rail (nine-slice 40px / 20 css px) | `blender/blend/rail-wood9.blend` |
| `rocker-off@2x.png` | 100×124 | 50×62 | PNG | 14 KB | Amp power off | `blender/blend/rocker-off.blend` |
| `rocker-on@2x.png` | 100×124 | 50×62 | PNG | 14 KB | Amp power on | `blender/blend/rocker-on.blend` |
| `toggle-down@2x.png` | 80×120 | 40×60 | PNG | 9 KB | Amp bypass on | `blender/blend/toggle-down.blend` |
| `toggle-up@2x.png` | 80×120 | 40×60 | PNG | 9 KB | Amp bypass off | `blender/blend/toggle-up.blend` |
| `tuner-body@2x.webp` | 980×924 | 490×462 | WEBP | 41 KB | Tuner pedal chassis | `blender/blend/tuner-body.blend` |

### Provenance and licensing

* All 24 assets were modelled and rendered in this session with Blender 5.2.3 (bpy, Cycles CPU, 64–96 samples, denoise, AgX). Procedural materials only: **no scanned textures, HDRIs, stock images, AI image generation or third-party models**. Geometry, materials and lights are fully defined by the scripts in `blender/scripts/`.
* Original Guitar Theory Lab designs; no third-party logos or trade dress. The reference photos supplied by the owner (Yamaha mixer, Ibanez-style tuner, amp mock-up) were used as art direction only and are **not** included.
* Engraved text in renders uses Barlow Condensed and Cormorant Garamond (SIL Open Font License 1.1, licences in `fonts/`).
* Ownership/licence of the renders themselves: to be decided by the project owner (Sergio Todaro); produced for Guitar Theory Lab.

## Simulated features that must be connected to real application state

| Feature | Prototype behaviour | Needs |
|---|---|---|
| Mixer Chords / Bass / Drums / Guitar | faders and mute move, label "proto · senza audio", LED dark | real audio buses; set `wired: true` per channel |
| Mixer Solo | disabled ("funzione futura") | solo logic, then pass `onSoloToggle` |
| Mixer Click / Notes / Master | real WebAudio gain in the prototype | map to engine gain nodes |
| Amp / NAM | knobs, power, bypass are visual only | NAM/DSP chain; `processingConnected` |
| Tuner reading | only from the declared DEMO signal | real pitch detection (`PitchReading` with `source:'input'`) |
| Tuner reference tones | real WebAudio sine, calibrated | keep or route through the engine |
| Interface device, levels, sample rate, buffer | no device; meter from DEMO only | device enumeration, input metering, monitoring with feedback warning |
| Progression auto-advance | not implemented | sequencer tied to transport |
| Settings panel | minimal popover | full panel |
| Semplificata | labelled navigation placeholder | link to the existing interface |

## Verified test results

Published artifact (Chrome, signed in, Design canvas "Play full screen" on the 1440×900, 1366×768 and 1100×720 artboards): all four devices open and render with every rendered asset loaded (chassis, caps, keys, knobs, switches, footswitch, jack sockets), drawer rises from the bottom edge of the notebook, the notebook stays in place with the active tab, device switching replaces the device, the rail button closes it. Screenshots in `screenshots/published/`.

Findings from the published run:
* In the canvas "Play full screen" view, **Escape is captured by the canvas host and exits play mode** (the device closes with it). Escape inside the app itself works (local tests).
* The published 1100×720 run had the rail expanded (state persisted from the owner's earlier session), so the fretboard scrolled horizontally inside its panel and the LCD context line wrapped; the line is now forced to one row (version 21).

Local Chromium (same build and asset bytes, `tests/validation-local.json`) at 1600×1000, 1440×900, 1366×768, 1280×800, 1100×720: no page-level horizontal scroll; LCD no clipping (expanded and compact); divider mouse + keyboard + double-click reset with 25 fret positions preserved; tabs Arrow/Home/End; Next Fretboard ii–V–I; fader drag and keyboard; Mute on; Solo disabled; amp knob drag; tuner footswitch; interface opens with live monitor off; Esc closes every device and returns focus to the rail button; active tab preserved; reduced motion = fade only, immediate close; rail tooltips on focus.

Not verified: real touch devices, screen readers, Safari/Firefox.

## Rebuild

```
cd prototype/src && python3 build.py          # writes ../project/Main.dc.html (fails if a relative asset path remains)
cd prototype && python3 serve.py               # http://localhost:8766/Main.dc.html (serves /_blob/<id> from ../assets)
cd blender/scripts && S=64 python3 mixer.py all  # requires `pip install bpy==5.2.3`
cd react && npm i && npx tsc --noEmit
```
