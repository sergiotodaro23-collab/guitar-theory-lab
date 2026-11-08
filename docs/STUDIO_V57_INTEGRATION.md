# Studio V5.7 — integrazione incrementale

## Preflight · 8 novembre 2026

- Base: `main` a `b36c008` (handoff), dopo la PR #10. Clone pulito; lavoro su `feat/studio-v57-integration`, senza modificare main.
- Letti `PROJECT_STATE.md`, `MASTER_SPEC.md`, `ROADMAP.md`, `DECISIONS.md`, README e contratti React dell'handoff. Alcuni stati storici sono superati dal codice: il Solo esiste già per i cinque bus musicali (D-33).
- Handoff originale conservato in `GTL-V5.7-handoff/`: 24 asset, 513.120 byte totali, tutti corrispondenti a dimensioni e hash del manifest; presenti 24 scene Blender. Nessuna dipendenza del prototipo aggiunta all'app.
- Baseline: typecheck, build e 435 test unitari passano. Il lint iniziale fallisce con 702 errori perché include il prototipo archiviato. La configurazione ora esclude solo l'archivio; tutti i componenti adattati in `src/` restano verificati. `npm run check` passa dopo questa separazione.
- I primi tentativi e2e erano bloccati dall'ambiente (server locale non consentito, poi Chromium assente). Browser installato; baseline completa in corso al momento del commit di preflight.
- `npm ci` segnala 10 vulnerabilità delle dipendenze (8 moderate, 2 critiche): nessun aggiornamento forzato nel redesign.

## Provenienza e licenze

Il README dell'handoff dichiara render originali/procedurali e font SIL OFL, con licenze incluse, ma lascia la licenza dei render da decidere al proprietario. La licenza del repository è GPL-3.0-or-later: non si presume che risolva automaticamente questa nota. L'integrazione richiesta viene preparata in una PR draft; la compatibilità/licenza esplicita dei render rimane da chiarire prima del merge/rilascio. Nessuna dichiarazione di titolarità viene riscritta.

**Aggiornamento 8 novembre 2026:** il proprietario ha confermato la licenza **GPL-3.0-or-later** per render, scene Blender e script (D-40). I font restano SIL OFL 1.1.

## Incrementi

1. Separazione dell'archivio dai controlli di produzione e baseline (Codex, `4e62cdd`).
2. Mixer V5.7 adattato allo stato e al routing esistenti (Codex, `4a23ed2`).
3. Asset e font importati e verificati, licenza registrata (D-40).
4. Regole pure della shell con test unitari (`src/ui/studio/v57/layout.ts`).
5. Shell V5.7 completa come aspetto Studio (D-41): rail, console con LCD, tastiera con divisore, taccuino per laboratorio, cassetto dei dispositivi. Il mixer di Codex è riusato nel cassetto (scala imposta dal taccuino), non duplicato.

## Struttura

| File | Ruolo |
|---|---|
| `src/ui/studio/StudioShell.tsx` | Composizione: rail, console, tastiera, divisore, taccuino. Calcola l'altezza della tastiera dal rapporto salvato. |
| `src/ui/studio/v57/layout.ts` | Regole pure: `fitScale` dei dispositivi, `splitHeight` del divisore, schede per laboratorio, `lcdModel`, preferenze salvate, mappature delle manopole. Testate in `layout.test.ts`. |
| `src/ui/studio/v57/uiStore.ts` | Stato solo d'interfaccia (cassetto, schede scelte, popover, preferenze). Nessuno stato musicale. |
| `Rail.tsx`, `Console.tsx`, `FretboardPanel.tsx`, `Notebook.tsx`, `NextFretboard.tsx` | Le parti della shell, tutte sullo store e sul motore esistenti. |
| `DeviceDrawer.tsx`, `RotaryKnob.tsx`, `devices.tsx`, `MixerDevice.tsx` | Cassetto e dispositivi (porting dei componenti React dell'handoff). |
| `v57.css`, `devices.css`, `fonts.css` | Stile portato dal prototipo con prefisso `v57-`/`gtl-`; immagini a nove fette dai render. |
| `src/app/rig.ts`, `src/audio/guitarRig.ts`, `src/ui/studio/v57/rig.tsx` | Guitar Rig (D-42): modello puro con test, grafo Web Audio sul ramo d'ascolto, cassetto con testata, Cabinet IR e pedaliera. |

Modifiche ai componenti condivisi, solo di presentazione: `Board` accetta `foot="external"` (legenda e ispettore resi altrove) e `layerMarks`; `Fretboard` disegna le scale sovrapposte come barrette sotto la nota (`layerMarks="bars"`) oltre ai puntini d'angolo (predefiniti, Semplificata invariata). `Transport` espone `useCurrentChordText` e `withModeLabels`; `panels` espone le opzioni di accordatura e il caricamento dei preset, così la barra della tastiera non duplica la logica.

## Classificazione dei controlli

Categorie: **1** collegato a una funzione di produzione esistente; **2** richiede (e ha ricevuto) un adattamento; **3** non supportato dal motore: disattivato o dichiarato.

| Controllo V5.7 | Cat. | Implementazione |
|---|---|---|
| Rail: Fretboard, Harmony, Arpeggios Lab, Jam Studio | 1 | `settings.mode` con `withModeLabels`, come la Semplificata. Stato condiviso tra laboratori. |
| Rail: dispositivi | 1 | Aprono il cassetto; un dispositivo alla volta, il tasto attivo lo chiude. |
| Rail: Impostazioni e aspetto | 2 | Pannello con il selettore Studio/Semplificata (reale), i preset di studio completi e l'avviso di licenza (`AppFooter`). |
| Rail: comprimi/espandi | 2 | Preferenza `gtl.v5.railX`. |
| Play / Pausa / Stop | 1 | `engine.toggle()`, `engine.pause()`, `engine.stop()`. |
| Display esteso/compatto | 2 | Preferenza `gtl.v5.lcdX`. |
| LCD: tonalità, scala, note | 2 | `lcdModel`: scala studiata (Fretboard, Arpeggi su accordo) o tonalità della progressione (Harmony, Jam, Arpeggi su progressione). |
| LCD: accordo e funzione | 2 | Testo come il trasporto di produzione; numerale da `numeralOf` del motore armonico. |
| LCD: BPM | 1 | Campo numerico reale (`bpm`), −/+ con `engine.nudgeBpm`, Tap con `useTap`. |
| LCD: metrica, click | 1 | `MeterSelect`, `ClickSelect`; spie dei battiti dal playhead (orologio audio). |
| LCD: riga di contesto (stato, battuta, posizione, next, click) | 2 | Dal playhead e dalle impostazioni. |
| Swing, Accenti | 1 | `Knob` e `AccentGrid` esistenti, sulla console. |
| Visualizzazione: etichette | 1 | `LabelModeSelector`. |
| Visualizzazione: nota rilevata | 1 | `liveOnBoard`, condiviso con la Semplificata. |
| Visualizzazione: target, riproduzione, frecce, scale sovrapposte | 2 | Filtri di sola visualizzazione (attributi CSS sul pannello); nessun calcolo cambia. |
| Visualizzazione: barrette / puntini | 2 | `Fretboard` `layerMarks`; legenda coerente («barretta sotto la nota»). |
| Visualizzazione: pulsazione / bagliore / statica | 2 | CSS sulla nota suonata e sulla nota rilevata probabile; disattivato con riduzione del movimento. |
| Visualizzazione: densità, «scala e accordo sulla stessa nota» | 3 | Non portati: la priorità dei ruoli sulle note è già decisa dal motore dei marker (D-11, D-09). |
| Barra: accordatura | 1 | Stessa logica di `TuningField` (`neckTuningChange`). |
| Barra: preset | 1 | Stessa logica di `PresetsPanel` (`loadStudyPreset`). |
| Divisore | 2 | Trascinamento, frecce, Pagina su/giù, Home/End, doppio clic; `gtl.v5.fbR`; la tastiera non supera l'altezza naturale per la sua larghezza. |
| Schede del taccuino | 2 | Per laboratorio (`tabsFor`), pannelli di produzione invariati; frecce, Home, Fine. |
| Legenda | 1 | La legenda di `Board`, resa nella scheda; accanto il tutor esistente. |
| Ispettore delle note | 1 | Scheda galleggiante sulla tastiera quando una nota è fissata. |
| Next Fretboard | 2 | Anteprima di sola lettura dal motore dei marker per l'accordo successivo (vista per accordo inclusa). Nel prodotto l'avanzamento automatico esiste già (`changeMode`), quindi la nota del prototipo «non implementato» non è stata copiata. |
| Mixer: fader, mute, solo, master, ascolto chitarra | 1 | Codex, `4a23ed2`: livelli reali 0..1, Solo esistente (D-33). |
| Mixer: LED e Out | 1/2 | LED = canale aperto (non presenza di segnale); Out = livello reale dell'analizzatore. Nessun meter per bus: il motore non ne ha. |
| Guitar Rig: testata (gain, bass, middle, treble, presence, output, power, bypass) | 2 | D-42: DSP interno reale (clipper morbido e tone stack) sul ramo d'ascolto; power spento = silenzio, bypass = amp e cabinet esclusi. Il modello NAM è la fase P4-01: etichetta «DSP interno · modello NAM: fase P4-01». |
| Guitar Rig: Cabinet IR | 2 | Convoluzione reale: 4x12 e 1x12 sintetizzati (non misurati) o un file IR scelto dall'utente (in memoria per la visita). |
| Guitar Rig: pedali Compressor, Overdrive (pre), Chorus, Delay, Reverb (post) | 2 | Nodi Web Audio reali; interruttore a pedale con LED, manopole con tastiera, trascinamento e doppio clic. |
| Accordatore: lettura | 1 | `useLive().pitch` → `tunerReading` con l'accordatura e il La scelti; LED «in accordo» a ±`IN_TUNE_CENTS` e lettura stabile. |
| Accordatore: interruttore a pedale | 2 | Attiva la lettura; se l'ingresso è spento lo avvia (l'ascolto resta spento). Mai ripristinato al ricaricamento. |
| Accordatore: calibrazione | 1 | `tunerA4`, manopola 435–445 Hz (il campo numerico della scheda Ingresso copre 415–466). |
| Accordatore: note di riferimento | 2 | `engine.previewNote` (suono delle note, La 440 Hz); non sono sinusoidi calibrate. |
| Interfaccia: canale 1/2 | 2 | `inputChannel` `left`/`right` con `liveInput.route`; «Entrambi» resta nella scheda Ingresso. |
| Interfaccia: gain | 1 | `inputGain` 0–4× con `liveInput.setGain`, lettura in dB reali. |
| Interfaccia: «Segnale test DEMO» | 2 | Sostituito dall'accensione reale dell'ingresso: il prodotto non simula segnali. |
| Interfaccia: ascolto | 1 | `liveInput.setMonitor`, disattivato a ingresso spento; mai acceso all'apertura. |
| Interfaccia: meter e display | 1 | Livello RMS, saturazione, dispositivo e frequenza dalla diagnostica, nota rilevata. |

## Guitar Rig e NAM

Il rig (D-42) è descritto in `docs/DECISIONS.md` e la fattibilità del NAM in `docs/NAM_FEASIBILITY.md`. Sotto, lo stato dei punti d'ingresso prima del rig, mantenuto per la storia.

### NAM: punti d'ingresso per lo studio di fattibilità (fase futura, non implementata)

Nessun codice NAM, nessun modello scaricato, nessuna modifica alla catena audio in questa integrazione.

- **Punto d'innesto (aggiornato con D-42)**: lo stadio `amp` di `src/audio/guitarRig.ts`. Un modello NAM sostituisce il preamp interno (waveshaper + tone stack) dentro lo stesso stadio, con dry/wet, power e bypass già gestiti; `AmpModel` in `src/app/rig.ts` riceve il valore `'nam'`.
- **Posizione nel grafo**: in `src/audio/liveInput.ts` il segnale va `source → splitter → mono → gain → analyser/worklet` (analisi, sempre sul segnale secco) e `gain → monitor → destinazione`. Il processore va inserito solo sul ramo d'ascolto, tra `gain` e `monitor`: l'analisi dell'altezza deve restare sul segnale secco.
- **WebAssembly + AudioWorklet**: il core NAM (C++) compilato in WASM ed eseguito in un `AudioWorkletProcessor` con blocchi di 128 campioni; il caricamento del worklet può seguire lo schema di `gtl-capture` (modulo come testo, `Blob`). Pesi del modello caricati dall'utente da file locale (nessun download, app local-first).
- **Compatibilità dei modelli**: verificare architetture supportate (WaveNet, LSTM), frequenza di campionamento del modello (tipicamente 48 kHz) rispetto a quella del contesto, ricampionamento se diverse, e la licenza di ogni modello prima di distribuirlo (deve essere compatibile con GPL-3.0, D-08).
- **Misure da fare**: latenza aggiunta (worklet + eventuale lookahead) sommata a `baseLatency`/`outputLatency` già esposte nella diagnostica; tempo CPU per blocco (`performance.now()` nel worklet, budget 128/48000 s ≈ 2,7 ms) su macchine di riferimento; xrun/glitch percepibili; comportamento con `liveInput.setMonitor` spento (il processore va fermato).
- **Vincoli**: un solo clock (`TimelineScheduler`), nessun timer musicale nell'interfaccia, ascolto mai acceso automaticamente, onestà dello stato (`connected` vero solo se l'audio passa davvero dal processore).

## Verifiche

Vedi `docs/QA_REPORT.md` (sezione Studio V5.7) per comandi ed esiti.
