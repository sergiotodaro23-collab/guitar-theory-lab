# Architettura

Le dipendenze vanno solo verso il basso. I moduli da 1 a 6 e 8 non conoscono DOM né React.

| # | Modulo | Cartella | Contratto principale |
|---|--------|----------|----------------------|
| 1 | Music Theory Engine | `src/theory` | `SpelledNote`, `buildScale`, `parseChord`: note con la lettera, non solo l'altezza |
| 2 | Fretboard & Fingering | `src/fretboard` | `cagedPosition`, `threeNpsPosition`, `fingerPosition` → `FretNote[]` |
| 3 | Exercise Generator | `src/exercises` | `generateSequence(posizione, scala, spec)`, `exerciseTrack`; percorsi: `resolvePhase`, `planRoutine`, `routineTrack` |
| 4 | Chord & Harmony | `src/harmony` | `classifyTone(pc, accordo, {profile})` → `ToneFunction`; `resolveTone`, `commonTones`, `targetingPath` |
| 5 | Metronome & Scheduler | `src/timeline`, `src/audio` | `TimelineScheduler`, `TimelineSink`, `WebAudioSink` |
| 6 | Jam Session Engine | `src/jam` | Modifiche pure a `Progression`, `chordTrack`, `compTrack` |
| 7 | Visualization & Interaction | `src/viz`, `src/ui` | `buildMarkerLayer` puro → `Fretboard` SVG |
| 8 | Preset Persistence | `src/persistence` | `PresetRepository` con schema versionato e validazione |

`src/app` collega i moduli: `settings.ts` (stato salvabile), `tracks.ts` (impostazioni → tracce), `engine.ts` (unico proprietario di AudioContext e scheduler).

## Scale sovrapposte

La scala principale resta nelle impostazioni di studio (`tonic`, `scaleId`, posizione). Fino a quattro `ScaleLayer` in `settings.scaleLayers` aggiungono altre scale. `visibleLayers` le trasforma in `OverlayScale { scale, index, wholeNeck }` per `buildMarkerLayer`, che segna su ogni `Marker` le posizioni di lista in `layers`. Il confronto è `compareScales` nel motore teorico.

## Accordi

- `parseChord` legge anche il basso (`C/E`, `D/C`): `Chord.bass` porta nota, grado e rivolto. `withBass` cambia il basso mantenendo lo spelling dell'accordo.
- `diatonicSeventh(scala, grado)` armonizza le scale eptatoniche.
- `chordVoicings(accordo)` (in `src/fretboard`) restituisce le forme eseguibili lungo il manico.
- `settings.chordLayers` e `activeChord` (Fretboard Lab): solo l'attivo arriva a `buildMarkerLayer`, con `voicing` per il contorno della forma.

## Arpeggi

`src/exercises/arpeggio.ts` tiene separati i tre livelli: le note vengono da `Chord.tones`, l'ordine da `ArpeggioSpec`, la diteggiatura da `arpeggioNotes(accordo, tasto)` (finestra di cinque tasti, `pitchesInWindow`). Su una progressione `progressionArpeggioTrack` riceve gli intervalli degli accordi già calcolati da `chordSpans`, quindi il modulo esercizi non dipende da `jam`. In modalità "collega" ogni accordo parte dalla nota più vicina all'ultima suonata.

## Percorsi a fasi

`Routine` è un dato serializzabile: un elenco di `RoutinePhase` con scala, posizione (`caged`, `3nps`, `range`), ottava, sequenza, direzione, note per movimento e ripetizioni.

```
RoutinePhase ──resolvePhase──▶ forma dal Fretboard Engine + sequenza + problemi (con alternativa)
Routine ──planRoutine──▶ fasi in fila, ognuna chiusa alla stanghetta
Routine ──routineTrack──▶ Track di NotePayload con `phase`
```

Lo scheduler non sa nulla delle fasi. L'engine pubblica `phase` nel playhead leggendo l'ultimo evento suonato, e `boardContext(settings, phase)` sceglie forma e scala da mostrare. Da fermo la tastiera mostra la fase selezionata nel pannello.

## Posizione fisica e funzione armonica

`FretNote` descrive solo corda, tasto e altezza. La funzione nasce da `classifyTone(pitchClass, chord)`, quindi la stessa nota fisica cambia significato senza spostarsi: E è 3 di Cmaj7, 9 di Dm9, 13 di G13.

Le avoid notes non sono una verità assoluta. `AvoidProfile` sceglie la tradizione (chord-scale, dominanti alterate, modale) e il risultato porta `contextual` e `reason`, mostrati all'utente.

## Interfaccia: due aspetti, un solo stato

- `src/ui/App.tsx` sceglie l'aspetto (`look` + `src/ui/appearance.ts`, per dimensione della finestra) e monta `simple/SimpleShell.tsx` o `studio/StudioShell.tsx`; l'editor avanzato è montato sopra entrambi.
- Le shell compongono gli stessi componenti: `Transport.tsx` (pezzi del trasporto), `Board.tsx` (tastiera, legenda, ispettore), `panels.tsx` (pannelli di studio), `AccentGrid.tsx`, `DrumMachine.tsx`, `LivePanels.tsx`, `hardware.tsx` (manopole, fader, meter, canale Chitarra, Master). Nessuna logica musicale nelle shell.
- Layout desktop (D-24): da 1200 × 720 la Semplificata fissa intestazione, trasporto e tastiera; lo scorrimento sta in `[data-testid="scroll-panels"]` (`simple/simple.css`).
- Studio V5.7 (D-41, `docs/STUDIO_V57_INTEGRATION.md`): `studio/StudioShell.tsx` compone rail, console con LCD, tastiera con divisore e taccuino; i pezzi stanno in `studio/v57/` (regole pure in `layout.ts` con test, stato solo d'interfaccia in `uiStore.ts`, dispositivi nel cassetto in `devices.tsx` e `MixerDevice.tsx`). La finestra non scorre: scorre la pagina del taccuino. Asset e font in `studio/v57/assets` e `studio/v57/fonts` (D-40). `studio/studio.css` tiene la base condivisa (token, tastiera, carta, tutor, editor).
- Guitar Rig (D-42): `src/app/rig.ts` (impostazioni e DSP puro: mappature, curve, IR sintetizzate, con test), `src/audio/guitarRig.ts` (grafo Web Audio comp → drive → amp → cabinet → chorus → delay → reverb) inserito da `liveInput` tra il gain d'ingresso e il monitor, solo sul ramo d'ascolto: l'analisi dell'altezza resta sul segnale secco. Il motore inoltra `settings.rig` a `liveInput.setRig`. Il cassetto dei dispositivi (`DeviceBay`) copre tutta la zona del taccuino.
- Ingresso audio: `src/audio/liveInput.ts` (catena, stato in `useLive`), analisi pura in `src/pitch/`.

## Forme di arpeggio

`src/exercises/arpShapes.ts` (puro): `arpeggioPitches` (altezze), `placeLine` (posizioni, programmazione dinamica con stato della mano), `fingerLine` (dita e cambi di posizione), `octaveLine` / `sweepLine` / `skipLine` / `cagedArpeggioNotes`, `descentOf` (ritorno), `arpeggioPlan` (cosa disegnare, cosa suonare, dita). `settings.arpeggioPlanOf` lo applica alle impostazioni; `tracks.ts` lo suona, `Board.tsx` lo disegna con `exact` e `fingers`; `ArpShapePanel.tsx` lo sceglie.

## Analisi armonica

`src/harmony/interchange.ts` (puro): `chordOrigin(chord, tonica, modo)` → tipo (diatonico, secondaria, prestito, cromatico), numerale, modo d'origine, scala proposta. Lo usano `HarmonyAnalysis` (panels), `Board.tsx` con `contextScales` e `ChordViewPanel` per le viste nuove.

## Vista per accordo

`src/app/chordViews.ts` (puro): `ChordView` per id dell'accordo della progressione, `viewNotes` (arpeggio nella forma o scala), `viewOverlays` (scale aggiunte e arpeggi come scale di toni dell'accordo), `viewForChord`. `Board.tsx` sceglie la vista dell'accordo corrente (`useHarmonyContext`) e la passa a `buildMarkerLayer` come note, scala, focus e sovrapposizioni; `ChordViewPanel.tsx` la modifica.

## Timeline condivisa

- Tempo in tick da inizio riproduzione, 480 PPQ. Il BPM conta l'unità della metrica: in 6/8 conta gli ottavi.
- I tick non tornano indietro. Ogni `Track` ha lunghezza e `originTick` propri e si avvolge da sola, quindi un esercizio di 40 note scorre su una progressione di 12 battute restando sulla griglia.
- Il metronomo è derivato dalla metrica con `metronomeInRange`, non memorizzato.
- La metrica è una sequenza di `MeterSegment` (tick d'inizio, numero di battuta, metrica). Un cambio in riproduzione aggiunge un segmento alla stanghetta successiva: battute, click, swing e `TempoMap` leggono il segmento del tick, quindi l'audio già programmato resta valido. Lo stop riparte con un solo segmento.
- `TempoMap` converte tick e secondi con segmenti di tempo: un cambio BPM vale da ciò che non è ancora schedulato, e la posizione già udibile mantiene il vecchio tempo.
- Lo swing è una curva monotona applicata a tick → tempo, con la sua inversa per la lettura visiva.

### Flusso

```
worker timer (25 ms): solo sveglia
        │
TimelineScheduler.pump(): finestra di 120 ms su AudioContext.currentTime
        │
WebAudioSink: oscillatori con tempo assoluto
requestAnimationFrame: positionAt(currentTime - latenza) → trackEventAt → interfaccia
```

L'interfaccia non ha timer musicali: ricava tutto dalla posizione corrente.

### Regole durante la riproduzione

| Azione | Effetto |
|--------|---------|
| BPM | Da ciò che non è ancora schedulato, senza buchi |
| Scala, posizione, esercizio | `swapTrackAtNextBar`: alla battuta successiva |
| Accordi, comping | `replaceTrack`: subito, stessa fase |
| Cambio manuale | One-shot sul prossimo movimento o battuta |
| Metrica | Alla stanghetta successiva: nuovo `MeterSegment`, tracce e progressione ripartono sul nuovo battere |
| Pausa | Annulla l'audio già schedulato, riprende dallo stesso tick |

## Estendere con P1

- Nuovi strumenti (basso, batteria): altri `TrackPayload` e altri generatori di traccia come `compTrack`. Scheduler e interfaccia non cambiano.
- Arpeggi e rivolti: nuovo `ExerciseKind` che filtra la posizione sui gradi dell'accordo.
- Esportazione MIDI: le tracce sono già eventi su tick, quindi basta serializzarle.
