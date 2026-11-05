# Architettura

Le dipendenze vanno solo verso il basso. I moduli da 1 a 6 e 8 non conoscono DOM né React.

| # | Modulo | Cartella | Contratto principale |
|---|--------|----------|----------------------|
| 1 | Music Theory Engine | `src/theory` | `SpelledNote`, `buildScale`, `parseChord`: note con la lettera, non solo l'altezza |
| 2 | Fretboard & Fingering | `src/fretboard` | `cagedPosition`, `threeNpsPosition`, `fingerPosition` → `FretNote[]` |
| 3 | Exercise Generator | `src/exercises` | `generateSequence(posizione, scala, spec)`, `exerciseTrack` |
| 4 | Chord & Harmony | `src/harmony` | `classifyTone(pc, accordo, {profile})` → `ToneFunction`; `resolveTone`, `commonTones`, `targetingPath` |
| 5 | Metronome & Scheduler | `src/timeline`, `src/audio` | `TimelineScheduler`, `TimelineSink`, `WebAudioSink` |
| 6 | Jam Session Engine | `src/jam` | Modifiche pure a `Progression`, `chordTrack`, `compTrack` |
| 7 | Visualization & Interaction | `src/viz`, `src/ui` | `buildMarkerLayer` puro → `Fretboard` SVG |
| 8 | Preset Persistence | `src/persistence` | `PresetRepository` con schema versionato e validazione |

`src/app` collega i moduli: `settings.ts` (stato salvabile), `tracks.ts` (impostazioni → tracce), `engine.ts` (unico proprietario di AudioContext e scheduler).

## Posizione fisica e funzione armonica

`FretNote` descrive solo corda, tasto e altezza. La funzione nasce da `classifyTone(pitchClass, chord)`, quindi la stessa nota fisica cambia significato senza spostarsi: E è 3 di Cmaj7, 9 di Dm9, 13 di G13.

Le avoid notes non sono una verità assoluta. `AvoidProfile` sceglie la tradizione (chord-scale, dominanti alterate, modale) e il risultato porta `contextual` e `reason`, mostrati all'utente.

## Timeline condivisa

- Tempo in tick da inizio riproduzione, 480 PPQ. Il BPM conta l'unità della metrica: in 6/8 conta gli ottavi.
- I tick non tornano indietro. Ogni `Track` ha lunghezza e `originTick` propri e si avvolge da sola, quindi un esercizio di 40 note scorre su una progressione di 12 battute restando sulla griglia.
- Il metronomo è derivato dalla metrica con `metronomeInRange`, non memorizzato.
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
| Metrica | Ferma la riproduzione: sposterebbe tutte le stanghette |
| Pausa | Annulla l'audio già schedulato, riprende dallo stesso tick |

## Estendere con P1

- Nuovi strumenti (basso, batteria): altri `TrackPayload` e altri generatori di traccia come `compTrack`. Scheduler e interfaccia non cambiano.
- Arpeggi e rivolti: nuovo `ExerciseKind` che filtra la posizione sui gradi dell'accordo.
- Esportazione MIDI: le tracce sono già eventi su tick, quindi basta serializzarle.
