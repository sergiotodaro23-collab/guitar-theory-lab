# Roadmap e registro delle attività

Stati: `IMPLEMENTED | PARTIAL | BROKEN | MISSING | BLOCKED`. Requisiti in `docs/MASTER_SPEC.md`. Aggiornato: 7 novembre 2026, direttiva strategica del proprietario dopo la prova con chitarra reale.

Nomenclatura P0–P5 invariata. **Ordine operativo** (direttiva del 7 novembre 2026, desktop-first):
1. stabilità generale, routing audio, bug funzionali (incluse le correzioni UX che impediscono l'uso: P0-14);
2. core didattico: scale e accordi multipli, configurazioni per accordo (P1-14), arpeggi avanzati (P1-12c), Harmony Lab;
3. Jam Studio: groove, suoni, arrangiamenti, mixer (P3-06…P3-08);
4. Live Monitor 2.0: stima della posizione, risposta e sensibilità, calibrazione e profili (P3-10…P3-13), prima della beta stabile;
5. backing track reali (P3-09);
6. ricerca NAM, IR, MIDI, polifonia (P4);
7. design definitivo con Claude Design, accessibilità, ottimizzazione, rilascio.
Le dipendenze tecniche restano vincolanti. Ogni incremento è una PR separata; il merge lo fa il proprietario.

Formato: **ID · Requisito** — stato · dipendenze · moduli. Strategia / test / accettazione.

## P0 — Integrità

| ID | Requisito | Stato | Dip. | Moduli | Strategia · test · accettazione |
|----|-----------|-------|------|--------|---------------------------------|
| P0-01 | Audit del repository | IMPLEMENTED | — | docs | Sintesi in `docs/QA_REPORT.md`. |
| P0-02 | Build, lint, typecheck, unit, e2e verdi | IMPLEMENTED | — | tutto | `npm run check` + `npm run test:e2e` (170 unit, 18 e2e su Chromium). |
| P0-03 | CI GitHub eseguita | IMPLEMENTED | — | `.github` | Run #1 su `main` verde (6/11/2026). Branch protection non applicabile su repo privato Free. |
| P0-04 | Tastiera 0–24 tasti | IMPLEMENTED | — | fretboard, viz | `DEFAULT_FRETS = 24`; test su 6×25 note, fret 24 = due ottave sopra la corda vuota, forme entro 24. |
| P0-05 | Celle uniformi della tastiera | IMPLEMENTED | P0-04 | viz | `fretX` lineare; segnatasti 12 e 24 doppi. |
| P0-06 | Targhetta con versione reale | IMPLEMENTED | — | ui, vite | `__APP_VERSION__` da `package.json`; e2e verifica testo. |
| P0-07 | Timeline condivisa unica | IMPLEMENTED | — | timeline, app | Già presente: `TimelineScheduler` su `AudioContext.currentTime`. |
| P0-08 | Cambio metrica senza fermare la riproduzione | IMPLEMENTED | P0-07 | timeline, app, ui | Segmenti di metrica sulla timeline (`MeterSegment`, `withMeterChange`): il cambio parte alla stanghetta successiva, i tick non ripartono, la `TempoMap` cambia l'unità del BPM (ottavi in 6/8). Tracce e fine progressione ripartono sul nuovo battere; le luci dei movimenti seguono la metrica udita. Funziona anche in pausa; un cambio annullato prima della stanghetta sparisce. Test: 9 unit (griglia continua, 4/4→3/4, 4/4→6/8, BPM durante l'attesa, pausa, stop, tracce, swing), 1 e2e con misura dei click nel browser. |
| P0-09 | Test cross-browser Firefox/WebKit | BLOCKED | — | e2e | Solo Chromium installato nell'ambiente cloud. Aggiungere progetti Playwright quando i browser sono disponibili (CI: `npx playwright install firefox webkit`). |
| P0-11 | Layout stabile durante il Live Monitor | IMPLEMENTED | P3-04 | ui | D-22: spazi riservati per messaggi, lettura, posizioni, riscontro, accordatore; legenda con le voci live fisse a ingresso acceso; barra di livello con `transform`. e2e: 25 campioni in 3 s con note e silenzi, nessuno spostamento di tastiera, legenda, pannelli, trasporto, in entrambi gli aspetti. |
| P0-12 | Routing della chitarra e master | IMPLEMENTED | P3-04 | audio, ui | D-22: canale d'ingresso (entrambi/1/2) in mono, gain, analisi sul segnale pulito, ascolto solo manuale, canale Chitarra e Master nel mixer, suono di prova, diagnostica. e2e: livello reale in uscita nullo ad ascolto spento, presente acceso, nullo con fader Chitarra o Master a zero. **Non verificato con hardware reale.** Procedura: `docs/AUDIO_DIAGNOSTICS.md`. |
| P0-13 | Selezione degli accordi in riproduzione | IMPLEMENTED | — | app, timeline, ui | D-22: due scelte nello stesso movimento non suonano più insieme (l'ultima vince), N N avanza di due, in automatico la scelta non sposta più una selezione nascosta e la striscia spiega perché è bloccata. |
| P0-14 | Layout desktop: trasporto e tastiera sempre visibili, pannelli scorrevoli | IMPLEMENTED | — | ui | D-24: da 1200 × 720 pagina ferma, area pannelli e colonna destra di Studio con scorrimento proprio; Click/Accenti in pannello sovrapposto; sotto soglia la pagina scorre con trasporto agganciato (Semplificata). e2e `desktop-layout.spec.ts`: 4 dimensioni × 2 aspetti, nessuno scorrimento della pagina, trasporto e tastiera in vista, controlli del trasporto non coperti, nulla si muove scorrendo, cambiando workspace e in riproduzione; ridimensionamento; finestra piccola. Limite: a 1280 × 720 restano circa 150 px ai pannelli. |
| P0-15 | Misure leggere di prestazioni | IMPLEMENTED | — | tools, docs | `npm run perf` (`tools/perf/perf.mjs`): costo di YIN per modalità, caricamento, frame, CPU, heap, nodi DOM e ritardo schermo/audio sotto carico; risultati in `docs/PERFORMANCE.md`. Latenza audio reale e altri browser non misurati. |
| P0-10 | Tag `v0.1.0` sul remoto | BLOCKED | — | git | Approvato dal proprietario e creato in locale su `3b3c314`, ma l'ambiente cloud rifiuta il push dei tag (403). Da pubblicare dal sito GitHub o da un clone locale. |

## P1 — Core didattico

| ID | Requisito | Stato | Dip. | Moduli | Strategia · test · accettazione |
|----|-----------|-------|------|--------|---------------------------------|
| P1-01 | Scale e modi, armonica | IMPLEMENTED | — | theory | Test di spelling su 17 toniche. |
| P1-02 | Melodica classica vs jazz | IMPLEMENTED | P1-08 | theory, exercises | Jazz = scala `melodicMinor`; classica = percorso a due fasi (melodica su, naturale giù), test dedicato. |
| P1-03 | CAGED 5 forme, 3NPS 7 pattern | IMPLEMENTED | — | fretboard | Test da manuale su forme in Sol; tutte le tonalità entro 24 tasti. CAGED esclude volutamente la prima posizione con corde vuote (vedi `DECISIONS.md`). |
| P1-04 | Intervalli 2ª–8ª, sequenze personalizzate | IMPLEMENTED | — | exercises | Test sulle terze da manuale. Mancano intervalli cromatici e permutazioni automatiche. |
| P1-05 | Accordature alternative e personalizzate | IMPLEMENTED | P0-04 | fretboard, settings, ui | D-36: cinque preset e accordatura personalizzata, passata a tastiera, esercizi, viste, percorsi, arpeggi, forme d'accordo e Live Monitor; avviso su CAGED/3NPS fuori dallo standard. Unit 2, e2e 2. |
| P1-06 | Scale multiple (fino a 5) | IMPLEMENTED | — | theory, app, viz, ui | Scala principale + fino a 4 `ScaleLayer` (`src/app/scaleLayers.ts`): `+ Aggiungi scala`, lista espandibile, tonica e tipo, zona (posizione o tutta la tastiera), visibilità, colore, opacità, riordino, rimozione, confronto (`compareScales`). Nuove scale nascoste oltre la seconda visibile, avviso di densità. Ogni scala ha un punto colorato in una posizione fissa attorno alla nota. Migrazione della vecchia "seconda scala". Test: 7 unit sul modello, 3 sul confronto, 2 sul marker layer; 1 e2e completo. |
| P1-06b | Forma CAGED/3NPS indipendente per scala sovrapposta | MISSING | P1-06 | viz, ui | Oggi una scala sovrapposta segue la posizione della principale o copre tutta la tastiera. |
| P1-07 | Accordi multipli (fino a 8), Chord Builder, slash, rivolti, voicing | IMPLEMENTED | P1-06 | theory, fretboard, app, viz, ui | `ChordLayer` (`src/app/chordLayers.ts`): accordo principale + `+ Aggiungi accordo` che propone le settime diatoniche della scala; visibilità, selezione, riordino, rimozione. Slash chord e basso indipendente nel parser, nome del rivolto, trasposizione e comping con il basso giusto. Builder fondamentale/qualità/basso. Voicing eseguibili cercati sul manico (`chordVoicings`), contorno sulla tastiera, diagrammi. Sulla tastiera solo l'accordo attivo. "Usa come progressione" li porta in Harmony Lab. Test: 14 forme da manuale, vincoli di basso/estensione/mano, settime diatoniche su maggiore e armonica, slash e rivolti, migrazione; 1 e2e completo. |
| P1-06c | Leggibilità delle sovrapposizioni con forme distinte | MISSING | P1-06 | viz | Contorni, rombi, quadrati, aloni o simboli per scala, senza nascondere il nome della nota; oggi colore più punto in un angolo (D-09). |
| P1-14 | Configurazione per singolo accordo della progressione | IMPLEMENTED | P1-06, P1-07 | app, ui, persistence | D-26: vista per accordo (solo arpeggio o scala con funzioni, scala suggerita, forma CAGED/3NPS/tastiera, focus, 4 scale aggiunte, 8 arpeggi sovrapposti, 4 visibili insieme), cambio automatico con l'accordo in manuale e in automatico, condivisa da Harmony, Jam e Arpeggios, salvata, copiabile, interruttore generale. Unit 17, e2e 3 (esempio ii–V–I in entrambi gli aspetti, riproduzione, persistenza, Jam). Completato (D-29): intervallo di tasti libero (fino a 12 tasti), colore di ogni scala e arpeggio sovrapposto, esercizio che segue la vista di ogni accordo in riproduzione automatica (interruttore). Unit 4, e2e 1 in più. In cambio manuale l'esercizio resta quello generale. |
| P1-07b | Accordi personalizzati (formula libera), altre qualità (11, 9sus4, add11, 7b5…), diteggiatura delle forme | PARTIAL | P1-07 | theory, fretboard | Aggiunte 7b5, madd9, add11, 9sus4, 11 con test di spelling (D-27). Mancano formula libera e dita sulle forme di accordo. |
| P1-08 | Esercizi a fasi: forma/posizione/direzione per fase | IMPLEMENTED | P1-03 | exercises, app, ui | `src/exercises/routine.ts`: fasi dichiarative serializzabili, ottava alta, range di tasti, ripetizioni, suddivisione per fase, inizio fase sul battere. 12 test (C su / G giù, 3NPS, relativa, validazioni, round-trip JSON). |
| P1-09 | Validazione con alternativa | IMPLEMENTED | P1-08 | exercises, ui | `PhaseIssue.fix` applicabile con un clic; e2e su 3NPS di pentatonica. |
| P1-10 | Arpeggi concatenati su progressione, cambio accordo come fase | IMPLEMENTED | P1-07, P1-08 | exercises, harmony | D-35: fase "Arpeggio" con il suo accordo dentro la forma della fase, avvisi per toni fuori scala, correzione per accordi illeggibili, modello ii–V–I arpeggiato. Insieme ad Arpeggios Lab sulla progressione (D-27) copre il concatenamento. Unit 4, e2e 1. |
| P1-11 | Harmony Lab: dominanti secondarie, sostituzioni, voice leading | PARTIAL | P1-07 | harmony | Presenti: context switch, guide tones, note comuni, risoluzioni, targeting. |
| P1-12 | Arpeggios Lab (workspace) | IMPLEMENTED | P1-07 | exercises, fretboard, app, ui | Quarta modalità. Tre livelli separati: note dell'accordo (teoria), pattern (`ArpeggioSpec`: direzione sale/scende/sale-scende/scende-sale, grado di partenza per i rivolti, passi personalizzati), diteggiatura (posizione di cinque tasti, `arpeggioNotes`). Un accordo o la progressione condivisa con Harmony Lab, con arpeggi che ripartono o si collegano per nota più vicina (voice leading, mai più di un tono al cambio su ii–V–I). Guide tones evidenziati, funzioni sulle note, accompagnamento, sincronia con il transport, due preset. Test: 9 unit sul motore, 3 sulle tracce, 1 e2e. |
| P1-12b | Arpeggi per forma CAGED, salti di corda, sweep, target sul battere | IMPLEMENTED | P1-12 | exercises | D-27: CAGED sulla fondamentale dell'accordo (e sulla progressione la forma più vicina alla zona scelta), salto di corda 6-4-2/5-3-1, sweep su 3–6 corde con girata, collegamento "Arriva su un grado" sul battere del cambio. Unit e e2e. |
| P1-12c | Arpeggios Lab avanzato | PARTIAL | P1-12b, P2-01 | exercises, fretboard, ui | D-27. Fatto: quattro livelli separati (teoria → altezze → posizioni → diteggiatura), 1–3 ottave solo se realizzabili (altrimenti null, opzione disattivata), cambi di posizione contati e mostrati, sweep, salto di corda, ritorno diverso dalla salita, partenza da qualsiasi grado, collegamento per nota vicina o per grado target, famiglie: triadi, settime, m7♭5, dim7, sus, add, seste, none, alterati (7alt, 7b9, 7#9, 7b5), 11, 13, slash. Unit 22, e2e 6. Mancano: fasi arpeggio nell'editor dei percorsi (con P1-10), slash chord con il basso come prima nota, voice leading oltre il target, rifinitura delle dita (stesso dito su corde vicine). |
| P1-11b | Harmony Lab: interscambio modale, avoid contestuali per accordo | IMPLEMENTED | P1-11, P1-14 | harmony, ui | D-30: origine di ogni accordo (diatonico, dominante secondaria, prestito da modo parallelo, cromatico), numerale, scala proposta; tabella in Harmony Lab; tastiera, funzioni e avoid che seguono la scala di ogni accordo (interruttore); vista per accordo che parte dalla proposta; due modelli di interscambio. Unit 15, e2e 3. |
| P1-13 | Preset di percorsi | PARTIAL | P1-08 | persistence, app | Il percorso è salvato con i preset di studio; due preset predefiniti. Manca una libreria di soli percorsi. |

## P2 — UX/UI Workbench

| ID | Requisito | Stato | Dip. | Moduli | Strategia · test · accettazione |
|----|-----------|-------|------|--------|---------------------------------|
| P2-01 | Editor avanzato a schermo ampio | IMPLEMENTED | P1-08 | ui | `<dialog>` modale (focus, Escape = annulla, scroll indipendenti, responsive a colonna sotto 900 px), blocchi fase con Scala/Posizione/Sequenza/Direzione e tempo, riordino, duplica, elimina, modelli, anteprima con striscia temporale, tastiera, note e transizione. e2e su desktop e tablet. |
| P2-02 | Due aspetti: Semplificata e Studio | IMPLEMENTED | — | ui | D-16, D-41: Semplificata = console (anche telefono), invariata; Studio = console V5.7 (rail, console hi-fi con LCD, tastiera con divisore, taccuino per laboratorio, cassetto dei dispositivi) sullo stesso store e motore. Selettore d'aspetto nel pannello Impostazioni della Studio. e2e `studio-v57-shell.spec.ts` e suite esistente in entrambi gli aspetti. Non verificato: lettori di schermo, touch reale, Safari/Firefox. |
| P2-03 | Tastiera in legno credibile | IMPLEMENTED | P2-02 | viz | Barrette come rettangoli (il gradiente su una linea di larghezza zero non veniva disegnato), 24 tasti più capotasto verificati da test strutturale e sui pixel in entrambi gli aspetti. Studio: acero renderizzato, segnatasti, marker con luce speculare. Frecce ‹ › e intervallo visibile quando la tastiera scorre. |
| P2-04 | Legenda grande, adattiva, in basso a destra | IMPLEMENTED | — | ui | Solo le categorie presenti (tonica, scala, guide tone, accordo, tensione, avoid, esterna, scale aggiunte, forma, target, nota suonata), con forme oltre ai colori. In Studio sul post-it sotto il telefono. Note rilevate quando esisterà il Live Monitor. |
| P2-05 | Barra etichette con "Intervalli" e layer indipendenti | PARTIAL | — | viz, ui | D-36: etichetta Intervallo (dalla fondamentale dell'accordo o dalla tonica). Mancano i layer di etichette indipendenti. |
| P2-06 | Pannelli comprimibili, modalità Studio/Workbench/Focus | MISSING | — | ui | |
| P2-07 | Mixer | IMPLEMENTED | P2-02 | ui, audio | Studio V5.7: mixer renderizzato a 7 canali nel cassetto (Codex `4a23ed2`): Click, Note, Accordi, Basso, Batteria, Chitarra (ascolto), Master; Mute e Solo reali (D-33), meter d'uscita reale. Nessun meter per bus (il motore non ne ha). |
| P2-08 | Transport: stop/pausa, Click/Accenti 16 indicatori, timbri click | IMPLEMENTED | P0-07 | ui, timeline, audio | D-18: griglia di 16 passi a quattro livelli (2×8 su telefono), pattern dalla metrica o personale, tastiera, passo corrente evidenziato; 4 timbri sintetizzati. Test unitari sul modello e e2e sugli eventi programmati. |
| P2-09 | Tutor pixel-art nel telefono | PARTIAL | P2-02 | ui, `tutor` | D-17: regole locali con test, sprite originale con sei espressioni, modalità Silenzioso/Contesto/Tutor, riducibile. Da fare: riposizionamento libero, più regole (esercizi, errori live). |
| P2-11 | Redesign con Claude Design | IMPLEMENTED | P2-02 | ui | Handoff V5.7 integrato (D-40, D-41, `docs/STUDIO_V57_INTEGRATION.md`): play/pausa/stop distinti, BPM sull'LCD con −/+ e Tap, tastiera ridimensionabile e sempre leggibile, legenda nella sua scheda, anteprima del prossimo accordo (Next Fretboard). Classificazione di ogni controllo nel documento di integrazione. |
| P2-10 | Quattro workspace in navigazione | IMPLEMENTED | P1-12 | ui | Fretboard, Harmony, Arpeggios, Jam; lo stato musicale resta condiviso. |

## P3 — Jam Studio e audio

| ID | Requisito | Stato | Dip. | Moduli | Note |
|----|-----------|-------|------|--------|------|
| P3-01 | Jam multitraccia (batteria, basso, armonia), mute/solo | PARTIAL | — | jam, audio | Batteria (D-19), basso dalla progressione (D-20) e comping come tracce separate con fader e mute. Mancano solo, drone e strumenti armonici alternativi. |
| P3-02 | Drum step sequencer Simple (16 step, A–D, fill) | IMPLEMENTED | — | jam, ui, audio | D-19: 6 pezzi × 16 passi con accento, pattern A–D, fill ogni 2/4/8 battute, cambi alla stanghetta successiva, passo corrente evidenziato, tastiera, 2×8 su telefono, kit sintetizzato, canale Batteria con mute. Livello Advanced (velocity, ghost, probabilità, 32/64 passi, piano roll) non ancora fatto. |
| P3-03 | Generi e almeno 4 pattern per strumento | IMPLEMENTED | P3-01 | jam | D-20: 8 generi × 4 groove di batteria + fill, 4 linee di basso, ritmo degli accordi e swing; tempo suggerito. Pattern scritti per 4/4. |
| P3-04 | Pitch detection, Live Monitor, Tuner | PARTIAL | — | `pitch`, audio, ui | D-21: YIN puro con test sintetici; ingresso con permessi, dispositivi, errori, gain, livello, saturazione; ascolto solo manuale; Live Monitor con nota, frequenza, affidabilità, posizioni possibili e probabile sulla tastiera, riscontro sull'esercizio; accordatore con La configurabile, cinque accordature, modalità cromatica. e2e con un file WAV come microfono finto. Mancano AudioWorklet, calibrazione della latenza e prove con chitarra e interfacce reali. |
| P3-06 | Jam fase A: groove, bilanciamento, Fusion | IMPLEMENTED | P3-03 | jam, audio | D-28: note fantasma e ride, pulsazione dei piatti, comping "Anticipi" e "Colpi sincopati", anticipo del basso, Fusion riscritta, Jazz con ride, Funk con fantasmi, bilanciamento per genere, test di sincronia in 4/4, 3/4 e 6/8. Unit 11, e2e 1 nuovo e 3 aggiornati. Da giudicare all'ascolto dal proprietario. |
| P3-07 | Jam fase B: kit e timbri multipli | IMPLEMENTED | P3-06 | audio | D-32: kit acustico, elettronico e spazzole; basso a dita, plettro, contrabbasso, synth; accordi tastiera, piano elettrico, organo, chitarra pulita (strumming), pad; suoni proposti dal genere. Tutto sintetizzato, nessun campione. Unit 4, e2e 1 (ogni timbro degli accordi produce segnale da solo). Da giudicare all'ascolto. |
| P3-08 | Jam fase C: arrangiamenti | IMPLEMENTED | P3-06 | jam, ui | D-33: sezioni (intro, strofa, ritornello, bridge, assolo, outro) con ripetizioni, groove A–D, fill di transizione, dinamica, band per sezione; tre modelli; sezione in corso; solo nel mixer. Unit 5, e2e 3. Progressione propria per sezione (D-39). Unit 7, e2e 4. |
| P3-09 | Jam fase D: backing track audio locali | PARTIAL | P1-14 | audio, persistence, ui | D-34: file locale decodificato e salvato solo nel browser, riproduzione agganciata al clock (battuta 1 a un offset, BPM manuale o con tap), pausa/stop/ripresa dal punto giusto, loop con la progressione o la canzone, volume, progressione come mappa degli accordi. Unit 5, e2e 1 (traccia di click sintetica). Mancano: time-stretch, stem, analisi armonica automatica, sezioni mappate sul file. |
| P3-10 | Live Monitor 2.0 · stima della posizione | IMPLEMENTED | P3-04 | pitch, ui | D-31: probabilità per posizione da continuità della mano, corda precedente e forma (peso, non filtro); nessuna posizione piena senza contesto (tranne note con un solo posto); la stima segue la mano fuori dalla forma. Unit 5 su sequenze sintetiche, e2e (WAV ripetuto). Non verificato con chitarra reale. |
| P3-11 | Live Monitor 2.0 · risposta ai passaggi veloci e sensibilità | IMPLEMENTED | P3-04 | pitch, audio | D-31: tre modalità Precisa/Bilanciata/Rapida con parametri documentati, frame più corti con sovrapposizione, attacchi riconosciuti. Criteri sintetici rispettati: Rapida 16/16 su sedicesimi legati a 120 BPM senza spurie, Precisa una sola nota su nota tenuta con vibrato. AudioWorklet per i campioni (D-38). Manca la prova con l'hardware del proprietario. |
| P3-12 | Live Monitor 2.0 · calibrazione e profili per strumento | IMPLEMENTED | P3-11 | audio, pitch, persistence, ui | D-31: procedura in quattro passi (silenzio, note tenute, passaggio breve, latenza), profili per chitarra/pickup/scheda/canale, misurato vs impostato a mano, modificabili e ripristinabili. Unit 6, e2e 1 con WAV. La latenza del profilo corregge il riscontro sugli esercizi (D-37). Non verificato con hardware reale. |
| P3-13 | Live Monitor 2.0 · persistenza e dissolvenza dei marker | PARTIAL | P3-11 | ui | Oggi l'opacità segue il livello e sfuma in 260 ms. Da rifinire insieme alla modalità di sensibilità. |
| P3-05 | Catena audio con gain separati e master | PARTIAL | — | audio | Bus click/note/comp/basso/batteria, ingresso chitarra con gain e ascolto separato (D-21). Mancano master e amp modeling. |

## P4 — Avanzate

| ID | Requisito | Stato | Note |
|----|-----------|-------|------|
| P4-01 | Studio NAM / amp modeling (`docs/NAM_FEASIBILITY.md`) | PARTIAL | Pronti la UI (Guitar Rig, D-42) e lo stadio `amp` del grafo in cui innestare il modello. Manca l'inferenza NAM (WASM + AudioWorklet), con misure di CPU e latenza e verifica delle licenze dei modelli. |
| P4-02 | IR cabinet | IMPLEMENTED | D-42: ConvolverNode con due cabinet sintetizzati (unit: energia unitaria, taglio delle alte) o un file IR dell'utente, in memoria per la visita. Nessuna IR di terzi distribuita. |
| P4-07 | Guitar Rig con pedaliera | IMPLEMENTED | D-42: testata DSP interna, Cabinet IR, Compressor, Overdrive, Chorus, Delay, Reverb sul ramo d'ascolto della chitarra, in un unico cassetto della Studio. Unit 9, e2e 3 (controlli, salvataggio, livelli reali con WAV come microfono). Non provato con chitarra e cuffie reali. |
| P4-03 | Sequencer avanzato, MIDI, piano roll | MISSING | Le tracce sono già eventi su tick. |
| P4-04 | Tutor evoluto | MISSING | |
| P4-05 | Studio sperimentale sulla polifonia (accordi, note simultanee) | MISSING | YIN è monofonico: nessuna promessa. Prototipi isolati DSP o ML con misure di precisione, CPU, memoria e latenza; integrazione solo se i risultati lo giustificano. |
| P4-06 | Controller MIDI | IMPLEMENTED | D-37: note MIDI esatte al Live Monitor e alla tastiera, Start/Stop/Continue e pedale di sustain sul trasporto. Unit 2, e2e 1 con dispositivo simulato; non provato con hardware MIDI reale. |

## P5 — Consolidamento

| ID | Requisito | Stato | Note |
|----|-----------|-------|------|
| P5-01 | Licenza open source | IMPLEMENTED | GPL-3.0-or-later (D-08): `LICENSE`, `package.json`, avviso nell'app. |
| P5-02 | CONTRIBUTING, README aggiornati | IMPLEMENTED | `CONTRIBUTING.md` con regole su licenza dei contributi, campioni e modelli. |
| P5-03 | Audit dipendenze | IMPLEMENTED | `npm audit` alla data dell'audit (vedi QA). |
| P5-04 | Accessibilità e performance | PARTIAL | Marker navigabili da tastiera, aria-label, reduced motion; da verificare con audit completo. |

## Prossimo intervento

Su richiesta del proprietario gli incrementi avanzano senza attendere il merge, uno dopo l'altro sullo stesso branch (una PR aggiornata). Fatto: P1-12b, P1-12c (parziale), P3-06, P1-14, P1-11b, P3-10, P3-11 (parziale), P3-12, P3-07, P3-08, P3-09 (parziale), P1-10, P1-05, P2-05 (parziale), P4-06, P0-15, P3-11. Completati i punti locali. 8 novembre 2026: integrazione Studio V5.7 (P2-02, P2-07, P2-11) su `claude/lucid-rubin-19dvsp`, partita dal lavoro di Codex. Restano le attività che richiedono internet (NAM, IR con licenza, browser aggiuntivi), lasciate per ultime.
