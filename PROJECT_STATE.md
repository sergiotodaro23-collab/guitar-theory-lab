# Stato del progetto

Versione 0.1.0 (package.json). Ultimo aggiornamento: 6 novembre 2026, branch `claude/serene-hopper-ubi687`.

Per riprendere: leggi questo file, poi `docs/ROADMAP.md` (registro con stati) e, solo se serve, `docs/MASTER_SPEC.md`.

## Verificato in questa sessione

- `npm run check`: verde, 218 test unitari.
- `npm run test:e2e`: verde, 20 casi su Chromium headless.
- CI GitHub: run #1 su `main` verde.
- Dettagli e limiti in `docs/QA_REPORT.md`.

## Funziona

- Fretboard Lab, Harmony Lab (Harmonic Context Switch, sei focus), Jam Studio (progressioni, comping, loop, seconda scala).
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

- Interfaccia ancora nel tema "neon" di v0.1.0: il design skeuomorfico (P2-02) non è iniziato, salvo la targhetta.
- Solo accordatura standard; nessuna vista per mancini.
- Nessun input audio (pitch, monitor, tuner).
- Firefox e WebKit non testati (browser assenti nell'ambiente).
- Vulnerabilità solo nelle dipendenze di sviluppo (Vitest 3), vedi QA.

## Licenza

GPL-3.0-or-later, scelta dal proprietario (`LICENSE`, `CONTRIBUTING.md`, `docs/DECISIONS.md` D-08).

## In attesa

- Tag `v0.1.0`: approvato, ma il push dei tag è bloccato dall'ambiente cloud. Va pubblicato dal sito GitHub o da un clone locale.

## Prossimo task

P1-12 Arpeggios Lab → P2-02 prototipo skeuomorfico. Dettagli in `docs/ROADMAP.md`.
