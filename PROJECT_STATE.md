# Stato del progetto

Versione 0.1.0 (package.json). Ultimo aggiornamento: 6 novembre 2026, branch `claude/serene-hopper-ubi687`.

Per riprendere: leggi questo file, poi `docs/ROADMAP.md` (registro con stati) e, solo se serve, `docs/MASTER_SPEC.md`.

## Verificato in questa sessione

- `npm run check`: verde, 170 test unitari.
- `npm run test:e2e`: verde, 18 casi su Chromium headless.
- CI GitHub: run #1 su `main` verde.
- Dettagli e limiti in `docs/QA_REPORT.md`.

## Funziona

- Fretboard Lab, Harmony Lab (Harmonic Context Switch, sei focus), Jam Studio (progressioni, comping, loop, seconda scala).
- Tastiera 0–24 tasti a celle uniformi, CAGED (5 forme) e 3NPS (7 pattern), intervalli 2ª–8ª, sequenze personalizzate.
- **Percorsi a fasi** (nuovo): ogni fase con scala, forma CAGED/3NPS/range di tasti, ottava, sequenza, direzione, note per movimento e ripetizioni. Fasi sul battere, tastiera che segue la fase in riproduzione.
- **Editor avanzato** (nuovo): dialog ampio con blocchi fase riordinabili, modelli, errori con alternativa applicabile, anteprima (battute, durata, striscia delle fasi, tastiera, note, transizione).
- Minore melodica jazz (scala) e classica (percorso).
- Targhetta con versione reale e autore.
- Metronomo e scheduler con un solo clock audio, preset versionati, sessione salvata.

## Limiti noti

- Interfaccia ancora nel tema "neon" di v0.1.0: il design skeuomorfico (P2-02) non è iniziato, salvo la targhetta.
- Cambiare metrica ferma la riproduzione.
- Solo accordatura standard; nessuna vista per mancini.
- Nessun input audio (pitch, monitor, tuner).
- Firefox e WebKit non testati (browser assenti nell'ambiente).
- Vulnerabilità solo nelle dipendenze di sviluppo (Vitest 3), vedi QA.

## In attesa del proprietario

- Licenza: proposta GPL-3.0-or-later o MIT (`docs/DECISIONS.md`, D-08).
- Pubblicazione del tag `v0.1.0` e di eventuali release.

## Prossimo task

P1-06 scale multiple → P1-07 accordi multipli → P0-08 metrica alla battuta → P2-02 prototipo skeuomorfico. Dettagli in `docs/ROADMAP.md`.
