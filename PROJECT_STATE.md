# Stato del progetto

Versione 0.1.0 (package.json). Ultimo aggiornamento: 6 novembre 2026, branch `claude/serene-hopper-ubi687`.

Per riprendere: leggi questo file, poi `docs/ROADMAP.md` (registro con stati) e, solo se serve, `docs/MASTER_SPEC.md`.

## Verificato in questa sessione

- `npm run check`: verde, 313 test unitari.
- `npm run test:e2e`: verde, 50 casi su Chromium headless (`e2e/*.spec.ts`; gli e2e dell'ingresso usano un WAV come microfono finto; screenshot di confronto in `test-results/visual/`).
- CI GitHub: run #1 su `main` verde.
- Dettagli e limiti in `docs/QA_REPORT.md`.

## Funziona

- Quattro modalità: Fretboard Lab, Harmony Lab (Harmonic Context Switch, sei focus), Arpeggios Lab, Jam Studio (progressioni, comping, loop).
- **Arpeggios Lab**: un accordo o la progressione, posizione di cinque tasti, rivolti, quattro direzioni, pattern personalizzati, arpeggi collegati per nota più vicina.
- Tastiera 0–24 tasti a celle uniformi, CAGED (5 forme) e 3NPS (7 pattern), intervalli 2ª–8ª, sequenze personalizzate.
- **Percorsi a fasi** (nuovo): ogni fase con scala, forma CAGED/3NPS/range di tasti, ottava, sequenza, direzione, note per movimento e ripetizioni. Fasi sul battere, tastiera che segue la fase in riproduzione.
- **Editor avanzato** (nuovo): dialog ampio con blocchi fase riordinabili, modelli, errori con alternativa applicabile, anteprima (battute, durata, striscia delle fasi, tastiera, note, transizione).
- Minore melodica jazz (scala) e classica (percorso).
- **Cambio di metrica in riproduzione**: il transport non si ferma, la nuova metrica parte alla stanghetta successiva (anche verso 6/8, dove il BPM conta gli ottavi).
- **Accordi multipli**: fino a 8 accordi con builder (fondamentale, qualità, basso), slash chord e rivolti, forme eseguibili cercate sul manico e contornate sulla tastiera, diagrammi, invio a Harmony Lab come progressione.
- **Scale multiple**: fino a 5 scale (principale + 4) con `+ Aggiungi scala`, visibilità, colore, opacità, zona, riordino e confronto delle note.
- Targhetta con versione reale e autore.
- Metronomo e scheduler con un solo clock audio, preset versionati, sessione salvata.

## Limiti noti

- Aspetto **Studio** (banco da lavoro, predefinito su tablet e computer, materiali da validare) e **Semplificata** (console, unica su smartphone verticale). Due layout sullo stesso stato, vedi D-16 e D-17. Asset rigenerabili con `python3 tools/studio-assets/render.py`.
- Solo accordatura standard; nessuna vista per mancini.
- Ingresso chitarra, Live Monitor e accordatore verificati solo con segnali sintetici: mai provati con una chitarra e un'interfaccia reali.
- Firefox e WebKit non testati (browser assenti nell'ambiente).
- Vulnerabilità solo nelle dipendenze di sviluppo (Vitest 3), vedi QA.

## Licenza

GPL-3.0-or-later, scelta dal proprietario (`LICENSE`, `CONTRIBUTING.md`, `docs/DECISIONS.md` D-08).

## In attesa

- Tag `v0.1.0`: approvato, ma il push dei tag è bloccato dall'ambiente cloud. Va pubblicato dal sito GitHub o da un clone locale.

## Prossimo task

prove dell'ingresso con hardware reale (P3-04), poi amp modeling (studio di fattibilità). Dettagli in `docs/ROADMAP.md`.
