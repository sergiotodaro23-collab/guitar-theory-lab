# Stato del progetto

Versione 0.1.0 (package.json). Ultimo aggiornamento: 8 novembre 2026, branch `claude/lucid-rubin-19dvsp`: integrazione della Studio V5.7 (D-40, D-41), partita dai due commit di Codex. Strategia: **desktop-first** (D-23); ordine operativo in `docs/ROADMAP.md`.

**Studio V6 in corso** (D-43, dal 13 novembre 2026): stato e prossimo lotto in `docs/STUDIO_V6_PROGRESS.md`.

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
- **Guitar Rig** (D-42, nel rack destro della Studio V6 da D-44): testata con DSP interno, Cabinet IR (sintetici o file dell'utente) e pedaliera Compressor, Overdrive, Chorus, Delay, Reverb, reali sul ramo d'ascolto della chitarra. Il modello NAM non è ancora integrato (P4-01, `docs/NAM_FEASIBILITY.md`). Provato solo con un WAV come microfono.
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
