# Studio V6 — Audit mirato

Data: 13 novembre 2026. Base: `main` a `c034a9c` (PR #13 già unita; indice Graphify allineato allo stesso commit, 2066 nodi, 6347 archi). `GTL-V5.7-handoff/` è escluso: è il prototipo storico, non codice di produzione.

## Baseline (prima di ogni modifica V6)

| Controllo | Esito |
|---|---|
| `npm run check` (lint, tipi, 464 unit test, build) | verde |
| `npm run test:e2e` (119 casi, Chromium) | vedi `docs/STUDIO_V6_PROGRESS.md` |

Nessun fallimento preesistente noto oltre ai limiti già scritti in `PROJECT_STATE.md` (solo segnali sintetici per l'audio in ingresso, Firefox e WebKit non provati).

## Dubbi lasciati dalla mappa Graphify, risolti

| Dubbio | Risposta verificata nel codice |
|---|---|
| Entry point React dei quattro laboratori | Non esistono viste separate. C'è una sola shell (`src/ui/studio/StudioShell.tsx`, oppure `src/ui/simple/SimpleShell.tsx`); il laboratorio è `settings.mode` (`AppMode`: `fretboard`, `harmony`, `arpeggio`, `jam`). `tabsFor(mode)` in `src/ui/studio/v57/layout.ts` sceglie le schede del taccuino; i contenuti sono i pannelli di `src/ui/panels.tsx` (`ScalePanel`, `ChordsPanel`, `ExercisePanel`, `HarmonyPanel`, `ArpeggioPanel`, `JamPanels`), più `ChordViewPanel`, `ArrangementPanel`, `BackingPanel`, `DrumMachine`, `LivePanels`. |
| Jam ↔ scheduler | `src/app/tracks.ts` (`buildTracks`, puro) traduce le impostazioni nelle tracce `exercise`, `chords`, `comp`, `bass`, `drums` usando `src/jam`. `Engine.syncTracks` (`src/app/engine.ts`) le passa a `TimelineScheduler` (`replaceTrack`, `swapTrackAtNextBar`). La backing track importata parte da `Engine.syncBacking` sullo stesso tempo. |
| MIDI Transport | `Transport` in `src/audio/midi.ts` è un'interfaccia minima (`toggle`, `stop`, `play`); l'implementazione è l'`engine`, collegato dall'istanza `midiInput` usata da `src/ui/LivePanels.tsx`. Solo ingresso MIDI (note, sustain come play/pausa, start/continue/stop). |
| Tastiera principale | `Board` (`src/ui/Board.tsx`), usata da entrambe le shell; disegna `Fretboard` di `src/viz/Fretboard.tsx` con i marker di `src/viz/markers.ts`. La tastiera secondaria è `NextFretboard` (stesso `Fretboard`). |
| Impatto di `TimelineScheduler` | Lo importano solo `src/app/engine.ts` e `src/timeline/timeline.test.ts`. Ogni altra parte passa dall'`engine`. |
| Componenti attivi o obsoleti | Attivi: tutto `src/`. Obsoleto come riferimento: `GTL-V5.7-handoff/` (resta per gli script Blender degli asset). |

## Stato rispetto alla specifica V6

| Area | Stato in `main` prima della V6 | Lavoro V6 |
|---|---|---|
| Header globale | assente (targhetta nella rail) | nuovo |
| Console con LCD | presente (D-41), non comprimibile, senza Master | linguetta, striscia compatta, Master, rotella e trascinamento |
| Rail | laboratori e dispositivi | laboratori, fader chitarra e backing |
| Tastiera principale | 24 tasti, acero, divisore salvato, CAGED/3NPS, overlay, tracking | da conservare; confronto visivo con l'immagine |
| Taccuino | schede per laboratorio, ordine V5.7 | ordine V6 e tre schede condivise |
| Mixer | cassetto sul taccuino, guadagni reali, misuratore solo sul Master | maniglia dedicata; fader lunghi e misuratori per canale da fare |
| Rack destro | assente: rig e ingresso sono dispositivi nel cassetto (D-42) | nuovo, con i moduli esistenti |
| Guitar Rig | testata DSP, Cabinet IR, cinque pedali reali | fuzz, EQ, riordino, preset di suono |
| NAM | non implementato (`docs/NAM_FEASIBILITY.md`) | studio e, se fattibile, percorso minimo |
| Accordatore, metronomo | reali; quattro timbri di click | quinto timbro, pannello metronomo |
| Preset | preset di studio salvati e incorporati | libreria globale con filtri |
| Esercizi | generatore e percorsi a fasi | motore condiviso, valutazione col tracking |

## Problemi noti della specifica, verificati sul codice attuale

| Problema | Verifica |
|---|---|
| Testo sopra le icone nella rail espansa | riprodotto a 1366 × 768; corretto nel lotto 1 |
| Layout che si sposta all'avvio dell'ingresso | coperto da `e2e/live-stability.spec.ts` (verde) |
| Cassetti che coprono solo parte del taccuino | già corretto in D-42, coperto da `e2e/studio-v57-shell.spec.ts` |
| Mixer piccolo nelle finestre basse | riprodotto: a 1280 × 720 il mixer scala a 0,45. Da risolvere con il mixer a fader lunghi |
| Segnale della chitarra nel mixer | il canale Chitarra regola l'ascolto reale; manca un misuratore sul canale |
| Ordine delle schede | da cambiare secondo la V6 |
