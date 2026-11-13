# Studio V6 — Mappa del grafo Graphify

Documento di preparazione per la sessione di sviluppo successiva. Descrive la struttura della repository come risulta dal grafo Graphify, con percorsi reali verificati nel checkout. Non modifica codice applicativo.

Stato di verifica: i percorsi citati sono stati controllati con `ls`/`test -e`. I rapporti di dipendenza e i conteggi provengono dal grafo indicizzato, non da una lettura integrale dei file. Dove una relazione non è emersa dalle interrogazioni, è indicata come "non verificato".

---

## 1. Stato dell'indicizzazione Graphify

| Campo | Valore |
|---|---|
| Stato | **Indicizzata e interrogabile** (`status: ready`, `queryable: true`) |
| Verificato con | `list_workspaces`, `list_repositories`, `graph_stats` |
| Workspace | `sergio-s-workspace-15a7b7` (piano **Free**, ruolo owner, attivo) |
| Repository (full name) | `sergiotodaro23-collab/guitar-theory-lab` |
| Repository ID | `272446e7-c63c-4d26-80f2-04db69ff0e73` |
| Branch di default indicizzato | `main` |
| Commit indicizzato | `1c9970f0f0ab8aea60fc0ecc2e96a6d0cf55058c` (coincide con HEAD del branch di lavoro al momento della verifica) |
| Build | `d99de4e3-a7a9-4f9c-a593-11da7deb1000` |
| Indicizzato il | 2026-11-12 10:23 UTC (circa 13 ore prima della verifica) |
| Dimensione grafo | 2066 nodi, 6347 archi, 84 comunità |
| Capacità | `code_context: available`, `patterns: unavailable` |
| Documenti | Sul piano Free viene indicizzato solo `README.md` tra i documenti; `docs/*.md` non è nel grafo |

Limiti da tenere presenti:

- Il grafo descrive il commit `1c9970f`. Ogni modifica successiva non è visibile finché non viene reindicizzata. Prima di un audit, confrontare `git rev-parse HEAD` con il commit indicato.
- Il grafo non contiene i file CSS, i font e gli asset: servono letture dirette.
- Le ricerche in linguaggio naturale possono restituire file non pertinenti (es. `package.json`, `e2e/studio.ts`) per domande generiche. Usare termini di simbolo quando possibile.
- La cartella `GTL-V5.7-handoff/` (prototipo JS e TS) compare spesso tra i risultati. Non è codice di produzione: va esclusa dalle analisi di architettura salvo richiesta esplicita.

---

## 2. Mappa sintetica dei componenti

### 2.1 Shell Studio e componenti V57

Percorsi: `src/ui/studio/` e `src/ui/studio/v57/`.

| Componente | File | Simbolo chiave | Ruolo (da grafo) |
|---|---|---|---|
| Selezione shell | `src/ui/App.tsx` | `App()` | Sceglie `StudioShell` o `SimpleShell` in base all'aspetto effettivo (`effectiveAppearance`) |
| Shell Studio | `src/ui/studio/StudioShell.tsx` | `StudioShell()` | Compone `Console`, `DeviceBay`, `FretboardPanel`, `Rail`; legge `useStudioUi`; usa `clampRatio`/`splitHeight` da `layout.ts` |
| Shell semplice | `src/ui/simple/SimpleShell.tsx` | `SimpleShell()` | Alternativa non-Studio, usa anche `Mixer()` |
| Console | `src/ui/studio/v57/Console.tsx` | `Console()` | Usa `useApp` e `useStudioUi` |
| Notebook / DeviceBay | `src/ui/studio/v57/Notebook.tsx` | `Notebook()`, `DeviceBay()` | Contiene il cassetto dei dispositivi; `DeviceBay` chiama `TunerDevice` |
| Dispositivi (drawer) | `src/ui/studio/v57/devices.tsx`, `DeviceDrawer.tsx` | `TunerDevice()` | Tuner e altri dispositivi aperti dal cassetto |
| Mixer | `src/ui/studio/v57/MixerDevice.tsx` | `MIXER_CANVAS`, `Strip` | Dispositivo mixer; `MixerChannel`/`MixerProps` sono in `GTL-V5.7-handoff/react/src/types.ts` (prototipo, non produzione) |
| Sidebar / rail | `src/ui/studio/v57/Rail.tsx` | `SettingsPanel()` | Pannello impostazioni e barra laterale; usa `useStudioUi` |
| Pannello fretboard | `src/ui/studio/v57/FretboardPanel.tsx` | `Toolbar()`, `VizPopover()` | Barra strumenti e popover di visualizzazione |
| Fretboard secondaria (studio) | `src/ui/studio/v57/NextFretboard.tsx` | `NextFretboard()` | Riusa `Fretboard` da `src/viz/Fretboard.tsx` |
| Hardware / controlli | `HardwareKey.tsx`, `RotaryKnob.tsx`, `hooks.ts` | — | Controlli riusabili; non esplorati in dettaglio con il grafo |
| Pannelli / modali | `src/ui/panels.tsx`, `src/ui/RoutineEditor.tsx` | `MixerShown` | Pannelli condivisi; `RoutineEditor` usa `Fretboard` per l'anteprima |
| Stile | `v57.css`, `mixer.css`, `devices.css`, `fonts.css` | — | Non nel grafo |
| Integrazione V57 | `docs/STUDIO_V57_INTEGRATION.md` | — | Documento di riferimento già nel repository |

### 2.2 Stato UI e store

| Elemento | File | Simbolo | Note |
|---|---|---|---|
| Store UI Studio | `src/ui/studio/v57/uiStore.ts` | `useStudioUi` (Zustand), `StudioUi`, `DeviceId = 'mixer' \| 'amp' \| 'tuner' \| 'iface'` | Stato del cassetto (`device`, `launcher`), tab per modalità (`pickedTab`), tuner, impostazioni e viz |
| Preferenze persistite | `uiStore.ts` + `layout.ts` (`savePref`) | `storage()`, `savePref()` | Salvate in `storage()` per `split`, `railExpanded`, `lcdExpanded`, `viz` |
| Stato non persistito | `uiStore.ts` | `tunerOn`, `referencePc` | Esplicitamente mai ripristinati al reload (commento nel codice) |
| Store applicativo | `src/app/store.ts` | `useApp`, `AppState`, `presetRepository` | `AppState` referenzia `Settings`; `App()`, `Console`, `DeviceBay`, `Toolbar`, `TunerDevice` lo usano |
| Impostazioni | `src/app/settings.ts` | `Settings` (L168), `DEFAULT_SETTINGS` (L182), `sanitizeSettings`, `currentPositionNotes()` (L417) | Tipo centrale: estende `StudySettings`, `HarmonySettings`, `ArpeggioSettings`; contiene `RigSettings` |
| Modalità app | `src/app/settings.ts` | `AppMode`, `MixChannel` (L486) | Modalità e canali mix |

### 2.3 Modello musicale e fretboard

| Elemento | File | Simbolo | Note |
|---|---|---|---|
| Posizioni sulla tastiera | `src/fretboard/positions.ts` | `FretNote`, `FretPosition`, `allFretNotes()`, `fillGaps()`, `midiAt()` | Nodo a più chiamanti (vedi §3) |
| Esportazione fretboard | `src/fretboard/index.ts` | — | Barrel |
| Fretboard visuale | `src/viz/Fretboard.tsx` | `Fretboard()`, `FretGrid`, `MarkerGlyph`, `ArrowLine()`, `fretX()`, `noteX()`, `stringY()`, `LayerStyle` | Componente SVG condiviso |
| Marker | `src/viz/markers.ts` | `buildMarkerLayer()` | Chiama `allFretNotes()` |
| Board (wrapper) | `src/ui/Board.tsx` | `Board()` | Importa `Fretboard` e `LayerMarks`, `LayerStyle` |
| Fretboard principale | `src/ui/Board.tsx` → `src/viz/Fretboard.tsx` | — | Ipotesi: `Board` è la fretboard principale della vista semplice; **non verificato** |
| Motore armonico | `src/harmony/` (`analysis.ts`, `function.ts`, `interchange.ts`, `index.ts`) | — | Presente nel checkout; **non emerso dalle interrogazioni** |
| Esercizi arpeggio | `src/exercises/arpeggio.ts` | `arpeggioSequence()`, `arpeggioNotes()`, `pitchesInWindow()`, `ArpeggioSpec` | Tre livelli separati: note, ordine, diteggiatura |
| Forme arpeggio | `src/exercises/arpShapes.ts` | `cagedArpeggioNotes()`, `cagedWindow()` | Testato da `arpShapes.test.ts` |
| Generatore / routine | `src/exercises/generator.ts`, `routine.ts` | — | `cagedPosition()` è chiamato dai test di routine |
| Viste accordo | `src/app/chordViews.ts` | `viewNotes()` (L106), `viewShapeNotes()` (L88) | Chiamano `allFretNotes()` |
| Scale / Arpeggi / Armonia / Jam (laboratori) | `src/app/settings.ts`, `src/exercises/`, `src/harmony/`, `src/jam/` | `ArpeggioSettings`, `arpeggioBoardNotes()` | I laboratori appaiono nelle impostazioni e nei moduli sopra; **le viste UI dei singoli laboratori non sono state individuate con il grafo** |
| Jam | `src/jam/` (`progression.ts`, `backing.ts`, `bass.ts`, `drums.ts`, `arrangement.ts`, `genres.ts`, `groove.ts`) | — | Motore puro; **non emerso dalle interrogazioni sul grafo**; collegamento con lo scheduler descritto in `ARCHITECTURE.md`, non verificato |
| Persistenza | `src/persistence/presets.ts` | — | Repository dei preset, `persistence.test.ts` |

### 2.4 Audio, tempo, Guitar Rig, tracking, MIDI

| Elemento | File | Simbolo | Note |
|---|---|---|---|
| Clock e scheduler | `src/timeline/scheduler.ts` | `Clock` (L26), `TimerDriver` (L30), `TimelineSink` (L34), `TimelineScheduler` (L55) | Unico orologio musicale del progetto (regola in `CLAUDE.md`) |
| Modello timeline | `src/timeline/model.ts` | `Track` (L195), `ScheduledTrackEvent` (L214), `loopBoundariesInRange()`, `metronomeInRange()`, `nextBarLine()`, `nextBeatLine()` | Nodo di dipendenza di `scheduler.ts` |
| Tempo map | `src/timeline/tempoMap.ts` | `TempoMap`, `buildTempo()` | Usata da `positionAt`/`timeOf` |
| Sink audio Web Audio | `src/audio/webAudioSink.ts` | `click()`, `drum()`, `tone()`, `voice()`, `pluck()`, `bassNote()`, `trackEvent()`, `monitorInput` | Implementa l'interfaccia `TimelineSink` |
| Engine | `src/app/engine.ts` | `Engine` (L25), `previewNote()` (L223) | Collega scheduler, sink e stato; `TimelineScheduler` è importato qui |
| Guitar Rig: motore | `src/audio/guitarRig.ts` | `ampDrive()`, `ampOutGain()`, `cabinetImpulse()`, `chorusDepth()`, `RigState`, `.apply()` | Applicazione del rig al segnale |
| Guitar Rig: modello | `src/app/rig.ts` | `PedalId`, `PRE_PEDALS`, `POST_PEDALS`, `PEDAL_SPECS`, `RigSettings`, `DEFAULT_RIG`, `sanitizeRig()`, `dbToGain()` | Pedali pre: `comp`, `drive`; post: `chorus`, `delay`, `reverb`; ampli `internal`; cab `1x12`, `4x12`, `file` |
| Guitar Rig: UI | `src/ui/studio/v57/rig.tsx` | `RigDevice()`, `Pedal()` | Usa `PEDAL_SPECS`, `AMP_KNOB_IDS`, `POST_PEDALS` |
| Input live | `src/audio/liveInput.ts` | `LiveInput`, `InputChannel`, `LiveState` | Usa `DEFAULT_RIG` e `RigSettings` |
| Tracking (pitch) | `src/pitch/tracker.ts`, `src/pitch/hand.ts` | `push()`, `midiAt()` | `Fretboard.tsx` chiama `push()` in `tracker.ts` (confidenza 0.5, nome omonimo possibile). I metodi `scheduleOneShot()` e `swapTrackAtNextBar()` sono in `scheduler.ts`, non nel tracker |
| MIDI | `src/audio/midi.ts` | `MidiInput` (L43), `useMidi` (L39), `midiPitch()` (L116), interfaccia `Transport` | Note-on/off, CC64 (pedale sustain) alterna play/pause, start/continue/stop |
| Analisi audio | `docs/AUDIO_DIAGNOSTICS.md` | — | Diagnostica di riferimento |

---

## 3. Dipendenze critiche

### 3.1 Nodi ad alta centralità

| Simbolo / file | Chiamanti o importatori noti | Rischio di regressione |
|---|---|---|
| `TimelineScheduler` (`src/timeline/scheduler.ts`, L55) | `engine.ts` (`Engine`), `timeline.test.ts`, `tempoMap.ts`, `model.ts`, `timeline/index.ts` | **Alto.** Impact check: hotspot da 27 nodi, 3 file hotspot con test (`scheduler.ts`, `model.ts`, `engine.ts`). L'output è stato troncato a 30 nodi, quindi l'elenco completo non è disponibile. |
| `TimelineSink` (`scheduler.ts` L34–39) | `webAudioSink.ts`, `timeline.test.ts` (`FakeClock`) | Alto: ogni cambio di firma rompe il sink e i test |
| `allFretNotes()` (`src/fretboard/positions.ts`) | `viewNotes()`, `viewShapeNotes()` (`chordViews.ts`), `currentPositionNotes()` (`settings.ts`), `buildMarkerLayer()` (`markers.ts`), `fretboard.test.ts` | Alto: centrale per fretboard e viste accordo |
| `Settings` (`src/app/settings.ts` L168) | `AppState` (`store.ts`), `LcdSettings`, `DEFAULT_SETTINGS`, `rig.ts` (`RigSettings`), `liveInput.ts` | Alto: forma persistita; modifiche richiedono controllo di `sanitizeSettings` |
| `RigSettings` / `DEFAULT_RIG` (`src/app/rig.ts`) | `guitarRig.ts`, `rig.test.ts`, `rig.tsx` (UI), `settings.ts` (`sanitizeRig`), `liveInput.ts` | Alto: un cambio di default altera i preset salvati |
| `Fretboard()` (`src/viz/Fretboard.tsx`) | `Board.tsx`, `RoutineEditor.tsx`, `NextFretboard.tsx`, `markers.ts`; `tracker.ts` solo come link debole (conf 0.5) | Alto: usato da entrambe le shell |
| `useStudioUi` (`src/ui/studio/v57/uiStore.ts` L43) | `StudioShell`, `Rail`, `Console`, `DeviceBay`, `TunerDevice`, `Toolbar`, `VizPopover` | Medio: chiavi di `savePref` sono contratto con `localStorage` |
| `useApp` (`src/app/store.ts` L31) | `App()`, `Console`, `DeviceBay`, `Toolbar`, `TunerDevice`, `VizPopover` | Medio–alto |
| `MidiInput` (`src/audio/midi.ts` L43) | Chiamato dal punto di avvio (non tracciato); usa `Transport` (`play`, `stop`, `toggle`) | Medio: la sessione MIDI dipende dall'interfaccia `Transport` |

### 3.2 Test collegati (`graphify_tests_for`)

| Target | Test collegati (link di chiamata) | Note |
|---|---|---|
| `src/fretboard/positions.ts` | `fretboard.test.ts`, `exercises.test.ts`, `routine.test.ts`, `hand.test.ts`, `viz.test.ts`, `chordViews.test.ts`, `app.test.ts`, `arpShapes.test.ts`, `arpeggio.test.ts` | 9 test, nessun troncamento. `hand.test.ts` → `midiAt()` è solo un link debole per nome, non conta come copertura |
| `src/timeline/scheduler.ts` | `timeline.test.ts` (con `FakeClock`) | Hotspot con test; la copertura statica non dice quanti rami siano esercitati |
| `src/app/rig.ts` | `rig.test.ts`, `guitarRig.ts` (chiamate a `ampOutGain`, `cabinetImpulse`, `chorusDepth`, `chorusRate`, `compThreshold`, `dbToGain`) | Copertura diretta |
| `src/audio/midi.ts` | `midi.test.ts` | Copertura presente |

### 3.3 Accoppiamenti da tenere sotto controllo

- `settings.ts` importa `rig.ts` e `sanitizeRig()`. Il sanitizzatore è anche il punto di ingresso per i dati salvati: cambiare `DEFAULT_RIG` o le chiavi di `RigSettings` tocca la persistenza.
- `Fretboard.tsx` è importato da `Board.tsx` (vista semplice) e da `NextFretboard.tsx` (Studio). Una modifica al componente tocca entrambe le shell.
- `StudioShell.tsx` chiama `clampRatio()` e `splitHeight()` da `layout.ts`, che ha un test dedicato (`layout.test.ts`).
- `App.tsx` decide la shell in base a `effectiveAppearance(look, width, height)`. Una modifica a questa funzione cambia quale UI viene montata.
- `scheduler.ts` importa `Clock` e `TimerDriver`; il test usa un `FakeClock`, quindi l'interfaccia è il punto di sostituzione per i test senza `AudioContext`.

---

## 4. Componenti riutilizzabili

| Componente / modulo | Dove | Uso |
|---|---|---|
| `Fretboard()` + `MarkerGlyph` + `ArrowLine` | `src/viz/Fretboard.tsx` | Visuale fretboard in entrambe le shell |
| `buildMarkerLayer()` | `src/viz/markers.ts` | Costruzione dei layer di marker |
| `allFretNotes()`, `fillGaps()` | `src/fretboard/positions.ts` | Derivazione delle note sulla tastiera; non va riscritta nella UI (regola `CLAUDE.md`) |
| `arpeggioNotes()`, `pitchesInWindow()` | `src/exercises/arpeggio.ts` | Note e diteggiatura arpeggio |
| `cagedArpeggioNotes()` | `src/exercises/arpShapes.ts` | Forme CAGED per arpeggi |
| `TimelineScheduler` | `src/timeline/scheduler.ts` | Unico clock musicale |
| `TempoMap`, `buildTempo()` | `src/timeline/tempoMap.ts` | Mappa tempo e battute |
| `WebAudioSink` | `src/audio/webAudioSink.ts` | Implementazione di `TimelineSink` |
| `RotaryKnob`, `HardwareKey` | `src/ui/studio/v57/` | Controlli hardware riusabili |
| `presetRepository` | `src/app/store.ts` | Persistenza dei preset |
| `useMidi` (store) | `src/audio/midi.ts` | Stato MIDI osservabile dalla UI |

---

## 5. File principali da consultare durante l'audit

Ordine consigliato per un audit di architettura Studio V6:

| # | File | Motivo |
|---|---|---|
| 1 | `CLAUDE.md` | Regole di progetto (motori puri, unico clock) |
| 2 | `docs/ARCHITECTURE.md` | Moduli e confini ufficiali |
| 3 | `docs/STUDIO_V57_INTEGRATION.md` | Integrazione V57 già fatta |
| 4 | `src/ui/App.tsx` | Selezione shell |
| 5 | `src/ui/studio/StudioShell.tsx` | Composizione Studio |
| 6 | `src/ui/studio/v57/uiStore.ts` | Stato UI e preferenze |
| 7 | `src/app/store.ts`, `src/app/settings.ts` | Stato applicativo e impostazioni |
| 8 | `src/timeline/scheduler.ts` | Clock e sink |
| 9 | `src/app/engine.ts` | Collegamento scheduler → sink |
| 10 | `src/audio/webAudioSink.ts` | Output audio |
| 11 | `src/app/rig.ts`, `src/audio/guitarRig.ts`, `src/ui/studio/v57/rig.tsx` | Guitar Rig |
| 12 | `src/audio/midi.ts` | MIDI e `Transport` |
| 13 | `src/fretboard/positions.ts`, `src/viz/Fretboard.tsx` | Fretboard |
| 14 | `src/exercises/arpeggio.ts`, `src/app/chordViews.ts` | Laboratori arpeggi e accordi |
| 15 | `src/jam/progression.ts`, `src/jam/backing.ts` | Motore Jam (non esplorato con il grafo) |
| 16 | `src/harmony/analysis.ts`, `src/harmony/function.ts` | Motore armonico (non esplorato con il grafo) |
| 17 | `e2e/studio.ts` | Test end-to-end (`openMixer()`) |
| 18 | `docs/QA_REPORT.md`, `docs/ROADMAP.md` | Stato verificato e pianificato |

---

## 6. Query Graphify utili per le sessioni successive

Usare `repository_id = sergiotodaro23-collab/guitar-theory-lab`. Le query con `skeleton: true` costano meno.

| Obiettivo | Strumento | Input |
|---|---|---|
| Dove è definito un simbolo | `graphify_find` | `term: "TimelineScheduler"` |
| Chi chiama un simbolo | `graphify_callers` | `symbol: "allFretNotes"` |
| Dipendenze di un file | `graphify_file_neighbors` | `file: "src/timeline/scheduler.ts"` (con `symbols_only: true` per l'API) |
| Impatto di una modifica | `graphify_impact` | `target: "TimelineScheduler", include_risk: true` |
| Test collegati | `graphify_tests_for` | `target: "src/fretboard/positions.ts"` |
| Import ed export | `graphify_imports_exports` | `file: "src/app/rig.ts"` |
| Percorso di chiamata | `graphify_trace` | `src: "handle", tgt: "..."` (da definire) |
| Corpo di un simbolo | `graphify_node` | `symbol: "useStudioUi"` |
| Ranking file per domanda | `graphify_rank_files` | "Where is the Guitar Rig pedalboard routing?" |
| Spiegazione di un comportamento | `query_graph` | "How is MIDI sustain pedal connected to play and pause?" |
| Stato dell'indice | `graph_stats` | — |

Domande già testate e utili:

- "Where is the Studio UI state store (useStudioUi / uiStore) and the global app settings store defined, and what do they hold?" → `uiStore.ts`, `store.ts`, `settings.ts`.
- "How is MIDI input and the Jam mode connected to the timeline scheduler and the audio sink?" → `midi.ts` collegato a `Transport`; collegamento Jam ↔ scheduler **non emerso**: rifare la domanda con `src/jam/` e `engine.ts`.
- "Where is the audio engine, TimelineScheduler clock, Guitar Rig, tracking, MIDI and pedalboard routing implemented?" → `rig.ts`, `webAudioSink.ts`, `scheduler.ts`, `midi.ts`.

---

## 7. Problemi residui e lacune

1. **Viste dei laboratori.** Il grafo non ha isolato le viste React di Scales, Arpeggios, Harmony e Jam: sono emersi solo i moduli di dominio. Serve una query dedicata su `src/ui/` con simboli di vista.
2. **Collegamento Jam ↔ scheduler.** Non verificato con il grafo. `ARCHITECTURE.md` lo descrive, ma non è stato confermato.
3. **Implementazione di `Transport`.** Il grafo non mostra il tipo che implementa `play`, `stop`, `toggle` per `MidiInput`. Serve una query `graphify_callers` su `MidiInput.handle` o una lettura di `app/engine.ts`.
4. **Fretboard principale.** L'attribuzione di `Board.tsx` come fretboard principale non è confermata dal grafo.
5. **Rumore del prototipo.** `GTL-V5.7-handoff/` compare nei ranking con simboli omonimi (`MixerChannel`, `WS`, `INTV`, `Component`). Ogni audit deve escludere esplicitamente quel percorso.
6. **Documenti non indicizzati.** Il piano Free indicizza solo `README.md` tra i documenti. Questo documento e `docs/ARCHITECTURE.md` non sono interrogabili con Graphify: usarli come riferimento diretto.
7. **Freschezza.** L'indice è al commit `1c9970f`. Dopo ogni nuovo commit occorre verificare che il push abbia reindicizzato il repository (`graph_stats` → `commitSha`).
8. **Capacità `patterns` non disponibile.** Le ricerche di pattern di codice non sono supportate da questo workspace.
9. **Impact troncato.** L'analisi d'impatto di `TimelineScheduler` è stata troncata a 30 nodi; per l'elenco completo usare `gx_node('TimelineScheduler', strict_calls=false)` o aumentare `limit`.
