# Stato del progetto

Versione 0.1.0 (package.json). Ultimo aggiornamento: 8 novembre 2026, branch `claude/lucid-rubin-19dvsp`: integrazione della Studio V5.7 (D-40, D-41), partita dai due commit di Codex. Strategia: **desktop-first** (D-23); ordine operativo in `docs/ROADMAP.md`.

**Piano verso la versione definitiva** (D-56, dal 21 novembre 2026): `docs/FINAL_PLAN.md`.

**Studio V6 in corso** (D-43, dal 13 novembre 2026): stato e prossimo lotto in `docs/STUDIO_V6_PROGRESS.md`. Consolidamento e audit del rig: `docs/STUDIO_V6_CONSOLIDATION.md`.

## Piano verso la versione definitiva (dal 21 novembre 2026): tracker

Ordine operativo in **`docs/FINAL_PLAN.md`** (D-56): fasi F1–F6, attività con ID, dipendenze e criteri di accettazione. I lotti A–F dello sprint del 17 novembre sono confluiti nel piano (corrispondenza nel §4 del piano). Una PR per attività, unita dall'agente con CI verde (D-43).

| Attività | Stato | PR / branch | Prove | Residui · prossima azione |
|---|---|---|---|---|
| Piano e tracker (D-56) | IMPLEMENTED | `claude/project-thread-inqgn7` | — | — |
| M1 · Trasposizione relazionale (D-57) | IMPLEMENTED | #44 | `exercises/relational.test.ts` (caso del proprietario, tutte le tonalità, fasi fisse), e2e in `routine-arpeggio.spec.ts` | Fatto: intervallo con la lettera, fasi «Segue»/«Fissa», modello d'esempio. Relazioni personalizzate in M2 |
| M5 · Sequenze generative (D-63) | IMPLEMENTED | #49 | `exercises/sequences.test.ts`, `e2e/sequences.spec.ts` | — |
| HA1, HA3, HA4 · Armonizzazioni, voicing su gruppi di corde, progressioni (D-67) | IMPLEMENTED | #50 | `harmony/harmonize.test.ts`, `fretboard/stringVoicings.test.ts` | Sostituzioni diatoniche solo nel motore |
| HA5 · Voicing nel laboratorio e 24 preset (D-67) | IMPLEMENTED | #50 | `app/harmonyVoicings.test.ts`, `e2e/harmony-voicings.spec.ts` | Ascolto del proprietario |
| AR2–AR4, AR7 · Linguaggio degli arpeggi e 24 preset (D-68) | IMPLEMENTED (AR4 PARTIAL) | #50 | `exercises/arpPatterns.test.ts`, `app/arpeggioPresets.test.ts`, `e2e/arpeggio-vocabulary.spec.ts` | Arpeggi quartali e sovrapposizioni (AR4), editing nota per nota (AR6) |
| M2 · Fasi ancorate (D-62) | IMPLEMENTED | #48 | `exercises/anchors.test.ts`, `e2e/routine-arpeggio.spec.ts` | — |
| M3 · Ritmo, articolazione, attacco (D-59) | PARTIAL | #45 | `exercises/rhythm.test.ts`, `timeline/countIn.test.ts`, `e2e/rhythm.spec.ts` | Manca il ritmo nell'Arpeggios Lab |
| M4 · Corde e salto di corda (D-59) | PARTIAL | #45 | `exercises/strings.test.ts`, `e2e/strings.spec.ts` | Manca il percorso su tutta la tastiera |
| J3 · Batteria: pedale, crash, cross-stick, crash dopo il fill (D-64); sequencer Advanced (D-65) | IMPLEMENTED | #52, `claude/project-thread-inqgn7` | `jam/kitPieces.test.ts`, `jam/advancedDrums.test.ts`, `jam/arrangement.test.ts`, `e2e/drums.spec.ts`, `e2e/genres.spec.ts` | Ascolto del proprietario |
| J4 · Basso: seconda di passaggio, ghost, staccato, slide, dinamiche (D-64) | IMPLEMENTED | #52 | `jam/bass.test.ts` (walking per grado su ii–V–I), `jam/groove.test.ts` | Ascolto del proprietario |
| J2 · Campioni CC0 (D-60) | PARTIAL | #46 | `docs/AUDIO_ASSETS.md`, `audio/samplerMap.test.ts` (manifest, copertura, intonazione) | Piano elettrico e organo ancora sintetizzati |
| J1 · Sampler (D-60) | PARTIAL | #46 | `audio/samplerMap.test.ts`, `e2e/samples.spec.ts` | Budget CPU (J9); ascolto del proprietario |
| M6 · Quattro livelli (D-61) | IMPLEMENTED | #47 | `exercises/levels.test.ts`, `app/presetLibrary.test.ts`, `e2e/studio-v6-shell.spec.ts` | Preset per ogni livello con FB/HA/AR |
| Integrazione TONE3000 + sticker + due gain | IMPLEMENTED | #38 | 564 unit, 211 e2e | Scheda audio reale non provata (R10) |
| A1 → M1 · Trasposizione degli esercizi avanzati | IMPLEMENTED | #39 | `exercises/transpose.test.ts` | Raffinata da D-57 |
| A2 → AR5 · Arpeggi: note mostrate = note suonate | IMPLEMENTED | #40 | `app/arpCoherence.test.ts` | — |
| A3 → N2/FB3 · Legenda avanzata e forme sovrapposte | PARTIAL | #41 | `viz/legend.test.ts` | Legenda condivisa per intervalli e target, forme di più scale |
| B1 → R1 · Selezione dispositivi audio | PARTIAL | #42 | dispositivi simulati | Da verificare con scheda reale |
| B2, B3 → R2, N1 | MISSING | — | — | Onda 1 |
| C1–C3 → U1, U2 · D1 → M3/J8 · D2 → U3 · E → U5 | MISSING | — | — | Secondo le onde del piano |
| F → R7 · NAM e TONE3000 (R5–R7) | MISSING, sospese (D-58) | — | — | Onda 5; il rig esistente resta intatto |
| Q9 · PWA installabile (D-58) | MISSING | — | — | Onda 4 |

Lavoro in parallelo (dal 21 novembre 2026, approvato dal proprietario), un thread per binario, senza toccare le aree degli altri:
- motore musicale e Jam (J3–J9, M7, M8): thread «motore e Jam»;
- preset di Harmony Lab e Arpeggios Lab: thread dedicato;
- pannello Note e interfaccia Studio: thread dedicato;
- campioni liberi di piano elettrico, organo, spazzole e kit elettronico (J2): thread dedicato.

Prossimo sul binario motore e Jam: humanization deterministica (J6), voice leading del comping (J5, con HA3), M7 e M8.

Per riprendere: leggi questo file, poi `docs/ROADMAP.md` (registro con stati) e, solo se serve, `docs/MASTER_SPEC.md`.

## Verificato in questa sessione

- `npm run check`: verde, 464 test unitari (8 novembre 2026, Studio V5.7 e Guitar Rig).
- `npm run test:e2e`: verde, 119 casi su Chromium headless (`e2e/*.spec.ts`; gli e2e dell'ingresso usano un WAV come microfono finto; screenshot di confronto in `test-results/visual/`).
- CI GitHub: run #1 su `main` verde.
- Dettagli e limiti in `docs/QA_REPORT.md`.

## Funziona

- **Studio V5.7** (D-41, `docs/STUDIO_V57_INTEGRATION.md`): rail con laboratori e dispositivi, console hi-fi con LCD ambra dallo store, tastiera di produzione con divisore salvato, taccuino con schede per laboratorio (pannelli esistenti), Next Fretboard dal motore, cassetto con mixer reale, accordatore e interfaccia sull'ingresso reale, amplificatore solo visivo e dichiarato. Semplificata invariata. Asset GPL-3.0-or-later (D-40).

- Quattro modalità: Fretboard Lab, Harmony Lab (Harmonic Context Switch, sei focus, analisi con interscambio modale e scala di ogni accordo, D-30), Arpeggios Lab, Jam Studio (progressioni, comping, loop).
- **Arpeggios Lab**: un accordo o la progressione, rivolti, quattro direzioni, pattern personalizzati, arpeggi collegati per nota più vicina o per grado target sul battere. Forme decise dal motore (D-27): posizione, CAGED, 1–3 ottave lungo il manico con cambi di posizione e diteggiatura, sweep, salto di corda, ritorno diverso dalla salita; le forme non suonabili vengono rifiutate.
- Tastiera 0–24 tasti a celle uniformi, accordature standard, mezzo tono sotto, Drop D, Open G, DADGAD e personalizzata, etichetta Intervallo (D-36), CAGED (5 forme) e 3NPS (7 pattern), intervalli 2ª–8ª, sequenze personalizzate.
- **Percorsi a fasi** (fasi arpeggio con il loro accordo, D-35): ogni fase con scala, forma CAGED/3NPS/range di tasti, ottava, sequenza, direzione, note per movimento e ripetizioni. Fasi sul battere, tastiera che segue la fase in riproduzione.
- **Editor avanzato** (nuovo): dialog ampio con blocchi fase riordinabili, modelli, errori con alternativa applicabile, anteprima (battute, durata, striscia delle fasi, tastiera, note, transizione).
- Minore melodica jazz (scala) e classica (percorso).
- **Cambio di metrica in riproduzione**: il transport non si ferma, la nuova metrica parte alla stanghetta successiva (anche verso 6/8, dove il BPM conta gli ottavi).
- **Accordi multipli**: fino a 8 accordi con builder (fondamentale, qualità, basso), slash chord e rivolti, forme eseguibili cercate sul manico e contornate sulla tastiera, diagrammi, invio a Harmony Lab come progressione.
- **Scale multiple**: fino a 5 scale (principale + 4) con `+ Aggiungi scala`, visibilità, colore, opacità, zona, riordino e confronto delle note.
- **Jam Studio**: step sequencer con note fantasma e ride (D-19, D-28), otto generi con bilanciamento e suoni propri (tre kit, quattro bassi, cinque suoni d'accordo sintetizzati, D-32) e Fusion riscritta, comping e basso con anticipi, basso generato (D-20), arrangiamenti a sezioni, anche con accordi propri, e solo (D-33, D-39), backing track locale a tempo (D-34), mixer con Click, Note, Accordi, Basso, Batteria, Chitarra, Master e mute.
- **Vista per accordo** (D-26): ogni accordo della progressione può avere la sua tastiera (arpeggio o scala, forma, focus, scale e arpeggi sovrapposti), che cambia con l'accordo in manuale e in automatico; condivisa da Harmony, Jam e Arpeggios; intervallo di tasti libero, colori a scelta, esercizio che segue la vista di ogni accordo (D-29).
- **Layout desktop** (D-24): da 1200 × 720 trasporto e tastiera fissi, pannelli e colonna destra con scorrimento proprio; Click/Accenti in un pannello sovrapposto.
- **Live Monitor 2.0** (D-31): posizione stimata dalla mano (la forma è solo un indizio), sensibilità Precisa/Bilanciata/Rapida, calibrazione in quattro passi e profili per strumento, latenza usata nel riscontro, ingresso MIDI (D-37). Solo segnali sintetici: da provare con la chitarra.
- **Ingresso chitarra, Live Monitor, accordatore** (D-21, D-22): canale d'ingresso, gain, ascolto solo manuale, diagnostica e suono di prova, nota rilevata sulla tastiera come stima, accordatore con modalità cromatica. Layout fermo durante il rilevamento.
- Targhetta con versione reale e autore.
- Metronomo e scheduler con un solo clock audio, preset versionati, sessione salvata.

## Limiti noti

- Aspetto **Studio** (console V5.7, predefinito su tablet e computer) e **Semplificata** (console, unica su smartphone verticale). Due layout sullo stesso stato, vedi D-16 e D-41. Render dei dispositivi in `GTL-V5.7-handoff/blender/` (scene e script); `tools/studio-assets/render.py` genera i pochi asset della base Studio rimasti (tasti, manopola, carta, telefono del tutor).
- **Guitar Rig** (D-42, nel rack destro della Studio V6 da D-44): testata con DSP interno, Cabinet IR (sintetici o file dell'utente) e pedaliera Compressor, Overdrive, Chorus, Delay, Reverb, reali sul ramo d'ascolto della chitarra. Dal 13 novembre 2026 la testata può eseguire un modello **NAM** caricato da file (D-51, `docs/NAM_INTEGRATION.md`): motore vero in WebAssembly, testato con segnali e modelli sintetici, non con capture e chitarra reali. Il catalogo **TONE3000** è collegabile dalla testata (D-52, `docs/TONE3000_INTEGRATION.md`): facoltativo, provato solo contro un servizio simulato, in attesa della chiave pubblicabile del proprietario. Provato solo con un WAV come microfono.
- Solo accordatura standard; nessuna vista per mancini.
- Ingresso chitarra, ascolto, Live Monitor e accordatore: **testati con segnali sintetici** (WAV come microfono). La prova del proprietario con chitarra reale ha trovato tre problemi (layout, ascolto, accordi), corretti in D-22 ma **non ancora riverificati con l'hardware**. Diagnostica: `docs/AUDIO_DIAGNOSTICS.md`.
- Layout desktop fisso (D-24) solo da 1200 × 720: sotto, la pagina scorre. A 1280 × 720 ai pannelli restano circa 150 px.
- Live Monitor: la posizione probabile è troppo legata alla forma selezionata, legati e passaggi veloci si perdono, manca la calibrazione: Live Monitor 2.0 (D-25, P3-10…P3-12) prima della beta stabile. Ascolto confermato funzionante dal proprietario (segnale pulito, senza amp).
- Firefox e WebKit non testati (browser assenti nell'ambiente).
- Vulnerabilità solo nelle dipendenze di sviluppo (Vitest 3), vedi QA.

## Licenza

GPL-3.0-or-later, scelta dal proprietario (`LICENSE`, `CONTRIBUTING.md`, `docs/DECISIONS.md` D-08).

## In attesa

- Tag `v0.1.0`: approvato, ma il push dei tag è bloccato dall'ambiente cloud. Va pubblicato dal sito GitHub o da un clone locale.

## Prossimo task

Revisione della PR della Studio V5.7 da parte del proprietario (merge a sua cura). Poi: prova con hardware reale di accordatore e interfaccia nella Studio V5.7, studio di fattibilità NAM (P4-01).

Dettagli in `docs/ROADMAP.md`.
