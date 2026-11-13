# Studio V5.7 — asset e font

Copiati da `GTL-V5.7-handoff/` (archivio originale, con scene Blender e script).

## Render dei dispositivi (`assets/`)

- 24 file @2x (WebP e PNG), verificati contro `GTL-V5.7-handoff/assets/MANIFEST.json`: dimensioni in pixel, byte e hash SHA-256 (16 cifre) identici.
- Modellati e renderizzati con Blender 5.2.3 (Cycles), materiali procedurali: nessuna texture, HDRI, immagine di stock o modello di terzi.
- Sorgenti: scene in `GTL-V5.7-handoff/blender/blend/`, script in `GTL-V5.7-handoff/blender/scripts/`.
- **Licenza: GPL-3.0-or-later**, come il resto del software (decisione D-40 del proprietario, 8 novembre 2026).
- Importati dai componenti con `import`: Vite li copia con hash in `dist/assets/`, quindi funzionano con `npm run dev`, `npm run build` e la build a file singolo (`base: './'`). I bordi a nove fette (`plate9`, `lcd9`, `rail-wood9`, `key-*`) sono referenziati dal CSS con percorsi relativi, risolti da Vite allo stesso modo.
- Geometria: ogni corpo è renderizzato con un margine d'ombra (cornice più grande del dispositivo, scostamento −16/−12 px) per non tagliare l'ombra. I controlli interattivi (manopole, fader, tasti) restano elementi HTML sopra il render: nulla è appiattito nell'immagine.

## Font (`fonts/`)

| Famiglia | Pesi | Licenza |
|---|---|---|
| Barlow | 400, 500, 600 | SIL OFL 1.1 (`fonts/barlow/LICENSE`) |
| Cormorant Garamond | 500, 600 | SIL OFL 1.1 (`fonts/cormorant-garamond/LICENSE`) |
| IBM Plex Mono | 500, 600 | SIL OFL 1.1 (`fonts/ibm-plex-mono/LICENSE`) |
| Barlow Condensed | 500, 600, 700 | SIL OFL 1.1, dal pacchetto `@fontsource/barlow-condensed` già in uso |

I font mantengono la loro licenza originale; non sono rilicenziati sotto GPL.

## Studio V6

Dal lotto 2 della V6 (rack destro) i corpi renderizzati `amp-body@2x.webp` e `iface-body@2x.webp`, con interruttori a bilanciere e a levetta, non sono più importati: testata e scheda audio sono moduli del rack disegnati in CSS, con le manopole renderizzate `knob-gold` e `knob-alu`. I file restano nel repository con le loro scene Blender.
