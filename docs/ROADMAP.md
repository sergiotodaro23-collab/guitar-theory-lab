# Roadmap e registro delle attività

Stati: `IMPLEMENTED | PARTIAL | BROKEN | MISSING | BLOCKED`. Requisiti in `docs/MASTER_SPEC.md`. Aggiornato: 6 novembre 2026 (v0.1.0 + branch `claude/serene-hopper-ubi687`).

Ordine: P0 integrità → P1 core didattico → P2 UX/UI → P3 Jam e audio → P4 avanzate → P5 consolidamento. È un ordine di lavoro, non una riduzione degli obiettivi.

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
| P0-10 | Tag `v0.1.0` sul remoto | BLOCKED | — | git | Approvato dal proprietario e creato in locale su `3b3c314`, ma l'ambiente cloud rifiuta il push dei tag (403). Da pubblicare dal sito GitHub o da un clone locale. |

## P1 — Core didattico

| ID | Requisito | Stato | Dip. | Moduli | Strategia · test · accettazione |
|----|-----------|-------|------|--------|---------------------------------|
| P1-01 | Scale e modi, armonica | IMPLEMENTED | — | theory | Test di spelling su 17 toniche. |
| P1-02 | Melodica classica vs jazz | IMPLEMENTED | P1-08 | theory, exercises | Jazz = scala `melodicMinor`; classica = percorso a due fasi (melodica su, naturale giù), test dedicato. |
| P1-03 | CAGED 5 forme, 3NPS 7 pattern | IMPLEMENTED | — | fretboard | Test da manuale su forme in Sol; tutte le tonalità entro 24 tasti. CAGED esclude volutamente la prima posizione con corde vuote (vedi `DECISIONS.md`). |
| P1-04 | Intervalli 2ª–8ª, sequenze personalizzate | IMPLEMENTED | — | exercises | Test sulle terze da manuale. Mancano intervalli cromatici e permutazioni automatiche. |
| P1-05 | Accordature alternative e personalizzate | MISSING | P0-04 | fretboard, settings, ui | Le funzioni accettano già `tuning`: aggiungere preset (Drop D, DADGAD, Open G…), editor, persistenza. Test: mapping e forme con tuning diversi. |
| P1-06 | Scale multiple (fino a 5) | IMPLEMENTED | — | theory, app, viz, ui | Scala principale + fino a 4 `ScaleLayer` (`src/app/scaleLayers.ts`): `+ Aggiungi scala`, lista espandibile, tonica e tipo, zona (posizione o tutta la tastiera), visibilità, colore, opacità, riordino, rimozione, confronto (`compareScales`). Nuove scale nascoste oltre la seconda visibile, avviso di densità. Ogni scala ha un punto colorato in una posizione fissa attorno alla nota. Migrazione della vecchia "seconda scala". Test: 7 unit sul modello, 3 sul confronto, 2 sul marker layer; 1 e2e completo. |
| P1-06b | Forma CAGED/3NPS indipendente per scala sovrapposta | MISSING | P1-06 | viz, ui | Oggi una scala sovrapposta segue la posizione della principale o copre tutta la tastiera. |
| P1-07 | Accordi multipli (fino a 8), Chord Builder, slash, rivolti, voicing | IMPLEMENTED | P1-06 | theory, fretboard, app, viz, ui | `ChordLayer` (`src/app/chordLayers.ts`): accordo principale + `+ Aggiungi accordo` che propone le settime diatoniche della scala; visibilità, selezione, riordino, rimozione. Slash chord e basso indipendente nel parser, nome del rivolto, trasposizione e comping con il basso giusto. Builder fondamentale/qualità/basso. Voicing eseguibili cercati sul manico (`chordVoicings`), contorno sulla tastiera, diagrammi. Sulla tastiera solo l'accordo attivo. "Usa come progressione" li porta in Harmony Lab. Test: 14 forme da manuale, vincoli di basso/estensione/mano, settime diatoniche su maggiore e armonica, slash e rivolti, migrazione; 1 e2e completo. |
| P1-07b | Accordi personalizzati (formula libera), altre qualità (11, 9sus4, add11, 7b5…), diteggiatura delle forme | MISSING | P1-07 | theory, fretboard | Le qualità sono quelle del parser; le forme non indicano ancora le dita. |
| P1-08 | Esercizi a fasi: forma/posizione/direzione per fase | IMPLEMENTED | P1-03 | exercises, app, ui | `src/exercises/routine.ts`: fasi dichiarative serializzabili, ottava alta, range di tasti, ripetizioni, suddivisione per fase, inizio fase sul battere. 12 test (C su / G giù, 3NPS, relativa, validazioni, round-trip JSON). |
| P1-09 | Validazione con alternativa | IMPLEMENTED | P1-08 | exercises, ui | `PhaseIssue.fix` applicabile con un clic; e2e su 3NPS di pentatonica. |
| P1-10 | Arpeggi concatenati su progressione, cambio accordo come fase | MISSING | P1-07, P1-08 | exercises, harmony | Nuovo tipo di fase "arpeggio" che segue la traccia accordi. |
| P1-11 | Harmony Lab: dominanti secondarie, sostituzioni, voice leading | PARTIAL | P1-07 | harmony | Presenti: context switch, guide tones, note comuni, risoluzioni, targeting. |
| P1-12 | Arpeggios Lab (workspace) | IMPLEMENTED | P1-07 | exercises, fretboard, app, ui | Quarta modalità. Tre livelli separati: note dell'accordo (teoria), pattern (`ArpeggioSpec`: direzione sale/scende/sale-scende/scende-sale, grado di partenza per i rivolti, passi personalizzati), diteggiatura (posizione di cinque tasti, `arpeggioNotes`). Un accordo o la progressione condivisa con Harmony Lab, con arpeggi che ripartono o si collegano per nota più vicina (voice leading, mai più di un tono al cambio su ii–V–I). Guide tones evidenziati, funzioni sulle note, accompagnamento, sincronia con il transport, due preset. Test: 9 unit sul motore, 3 sulle tracce, 1 e2e. |
| P1-12b | Arpeggi per forma CAGED, salti di corda, sweep, target sul battere | MISSING | P1-12 | exercises | Oggi la posizione è una finestra di tasti scelta a mano. |
| P1-13 | Preset di percorsi | PARTIAL | P1-08 | persistence, app | Il percorso è salvato con i preset di studio; due preset predefiniti. Manca una libreria di soli percorsi. |

## P2 — UX/UI Workbench

| ID | Requisito | Stato | Dip. | Moduli | Strategia · test · accettazione |
|----|-----------|-------|------|--------|---------------------------------|
| P2-01 | Editor avanzato a schermo ampio | IMPLEMENTED | P1-08 | ui | `<dialog>` modale (focus, Escape = annulla, scroll indipendenti, responsive a colonna sotto 900 px), blocchi fase con Scala/Posizione/Sequenza/Direzione e tempo, riordino, duplica, elimina, modelli, anteprima con striscia temporale, tastiera, note e transizione. e2e su desktop e tablet. |
| P2-02 | Due aspetti: Semplificata e Studio | PARTIAL | — | ui | D-16: Semplificata = console (anche telefono), Studio = banco da lavoro con asset renderizzati, `look` auto/semplificata/studio, Studio predefinita su tablet e computer. Coperte le quattro modalità, editor, scale e accordi multipli, legenda, trasporto, mixer, preset. Da fare: revisione del proprietario sulla qualità dei materiali, Firefox/WebKit. |
| P2-03 | Tastiera in legno credibile | IMPLEMENTED | P2-02 | viz | Barrette come rettangoli (il gradiente su una linea di larghezza zero non veniva disegnato), 24 tasti più capotasto verificati da test strutturale e sui pixel in entrambi gli aspetti. Studio: acero renderizzato, segnatasti, marker con luce speculare. Frecce ‹ › e intervallo visibile quando la tastiera scorre. |
| P2-04 | Legenda grande, adattiva, in basso a destra | IMPLEMENTED | — | ui | Solo le categorie presenti (tonica, scala, guide tone, accordo, tensione, avoid, esterna, scale aggiunte, forma, target, nota suonata), con forme oltre ai colori. In Studio sul post-it sotto il telefono. Note rilevate quando esisterà il Live Monitor. |
| P2-05 | Barra etichette con "Intervalli" e layer indipendenti | PARTIAL | — | viz, ui | Etichette presenti tranne intervalli; layer non separati. |
| P2-06 | Pannelli comprimibili, modalità Studio/Workbench/Focus | MISSING | — | ui | |
| P2-07 | Mixer laterale | PARTIAL | P2-02 | ui, audio | Fader Click, Note, Accordi, Basso, Batteria, Mute per canale, meter d'uscita reale. Mancano master, solo, monitor chitarra e gain (dipendono dall'ingresso audio, non implementato). |
| P2-08 | Transport: stop/pausa, Click/Accenti 16 indicatori, timbri click | IMPLEMENTED | P0-07 | ui, timeline, audio | D-18: griglia di 16 passi a quattro livelli (2×8 su telefono), pattern dalla metrica o personale, tastiera, passo corrente evidenziato; 4 timbri sintetizzati. Test unitari sul modello e e2e sugli eventi programmati. |
| P2-09 | Tutor pixel-art nel telefono | PARTIAL | P2-02 | ui, `tutor` | D-17: regole locali con test, sprite originale con sei espressioni, modalità Silenzioso/Contesto/Tutor, riducibile. Da fare: riposizionamento libero, più regole (esercizi, errori live). |
| P2-10 | Quattro workspace in navigazione | IMPLEMENTED | P1-12 | ui | Fretboard, Harmony, Arpeggios, Jam; lo stato musicale resta condiviso. |

## P3 — Jam Studio e audio

| ID | Requisito | Stato | Dip. | Moduli | Note |
|----|-----------|-------|------|--------|------|
| P3-01 | Jam multitraccia (batteria, basso, armonia), mute/solo | PARTIAL | — | jam, audio | Batteria (D-19), basso dalla progressione (D-20) e comping come tracce separate con fader e mute. Mancano solo, drone e strumenti armonici alternativi. |
| P3-02 | Drum step sequencer Simple (16 step, A–D, fill) | IMPLEMENTED | — | jam, ui, audio | D-19: 6 pezzi × 16 passi con accento, pattern A–D, fill ogni 2/4/8 battute, cambi alla stanghetta successiva, passo corrente evidenziato, tastiera, 2×8 su telefono, kit sintetizzato, canale Batteria con mute. Livello Advanced (velocity, ghost, probabilità, 32/64 passi, piano roll) non ancora fatto. |
| P3-03 | Generi e almeno 4 pattern per strumento | IMPLEMENTED | P3-01 | jam | D-20: 8 generi × 4 groove di batteria + fill, 4 linee di basso, ritmo degli accordi e swing; tempo suggerito. Pattern scritti per 4/4. |
| P3-04 | Pitch detection, Live Monitor, Tuner | PARTIAL | — | `pitch`, audio, ui | D-21: YIN puro con test sintetici; ingresso con permessi, dispositivi, errori, gain, livello, saturazione; ascolto solo manuale; Live Monitor con nota, frequenza, affidabilità, posizioni possibili e probabile sulla tastiera, riscontro sull'esercizio; accordatore con La configurabile, cinque accordature, modalità cromatica. e2e con un file WAV come microfono finto. Mancano AudioWorklet, calibrazione della latenza e prove con chitarra e interfacce reali. |
| P3-05 | Catena audio con gain separati e master | PARTIAL | — | audio | Bus click/note/comp/basso/batteria, ingresso chitarra con gain e ascolto separato (D-21). Mancano master e amp modeling. |

## P4 — Avanzate

| ID | Requisito | Stato | Note |
|----|-----------|-------|------|
| P4-01 | Studio NAM / amp modeling (`docs/NAM_FEASIBILITY.md`) | MISSING | PoC isolata con AudioWorklet + WASM, misure di CPU e latenza, licenze. |
| P4-02 | IR cabinet | MISSING | ConvolverNode, IR con licenza compatibile. |
| P4-03 | Sequencer avanzato, MIDI, piano roll | MISSING | Le tracce sono già eventi su tick. |
| P4-04 | Tutor evoluto | MISSING | |

## P5 — Consolidamento

| ID | Requisito | Stato | Note |
|----|-----------|-------|------|
| P5-01 | Licenza open source | IMPLEMENTED | GPL-3.0-or-later (D-08): `LICENSE`, `package.json`, avviso nell'app. |
| P5-02 | CONTRIBUTING, README aggiornati | IMPLEMENTED | `CONTRIBUTING.md` con regole su licenza dei contributi, campioni e modelli. |
| P5-03 | Audit dipendenze | IMPLEMENTED | `npm audit` alla data dell'audit (vedi QA). |
| P5-04 | Accessibilità e performance | PARTIAL | Marker navigabili da tastiera, aria-label, reduced motion; da verificare con audit completo. |

## Prossimo intervento

1. **P3-04** prove con chitarra reale e calibrazione della latenza (serve il proprietario con l'hardware); poi AudioWorklet.
2. **P2-02** revisione del proprietario sui materiali di Studio, rimandata dal proprietario a dopo il completamento delle funzioni (screenshot in `test-results/visual/`).
