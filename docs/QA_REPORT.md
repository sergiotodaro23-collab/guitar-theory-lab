# QA report

## Audit del 6 novembre 2026

Ambiente: container cloud Linux, Node 22.23, npm 10.9, Chromium headless (Playwright 1.63). Firefox e WebKit non installati.

### Repository

- Branch `main` (3b3c314) e `claude/serene-hopper-ubi687`; nessuna PR; nessun tag sul remoto (il `v0.1.0` citato nei documenti non è stato pubblicato).
- CI: workflow `ci.yml` eseguito una volta su `main`, esito verde.
- Licenza: all'audit `UNLICENSED`, senza `LICENSE` né `CONTRIBUTING`. Risolto con GPL-3.0-or-later (D-08).
- Segreti: nessuno nel codice né nella CI.
- Deployment: nessuna configurazione di pubblicazione (Pages o simili). Non eseguito.

### Verifiche eseguite

| Verifica | Risultato |
|----------|-----------|
| `npm run check` (lint, types, 170 test unitari, build) | Verde |
| `npm run test:e2e` (18 casi su build di produzione, Chromium) | Verde |
| Mapping 0–24, forme entro 24 tasti, 17 toniche | Verde |
| Percorsi a fasi (C su / G giù, melodica classica, 3NPS, validazioni, JSON) | Verde |
| Editor: apertura, modelli, aggiunta, riordino, eliminazione, alternativa a un errore, Escape, applica, riproduzione con cambio di forma | Verde (e2e) |
| Editor a 820 px senza overflow orizzontale | Verde (e2e) |
| Cambio di metrica in riproduzione: 4/4 → 3/4 → 6/8 a 120 BPM, click a 0,5 s esatti, nessun doppione, luci aggiornate alla stanghetta | Verde (e2e); 226 unit, 21 e2e dopo il blocco |
| Accordi multipli: builder, slash/rivolto, forma sulla tastiera, selezione, riordino, invio a Harmony Lab | Verde (e2e); 218 unit, 20 e2e dopo il blocco |
| Scale multiple: aggiunta fino a 5, confronto, visibilità, riordino, rimozione, ricarica pagina | Verde (e2e); 181 unit, 19 e2e dopo il blocco |
| Ispezione visiva a 1440×900 e 820×1000 | Controllata su screenshot |
| `npm audit --omit=dev` | 0 vulnerabilità |
| `npm audit` (dev) | 10 (8 moderate, 2 critiche) nella catena Vitest 3 (`tinypool`, `@vitest/mocker`, `minimatch`). Solo strumenti di sviluppo; la correzione richiede Vitest 4 (major). Da pianificare. |

### Problemi aperti trovati durante i test

- `Field` avvolge i controlli in un `<label>`: quando dentro ci sono più pulsanti (i gruppi `Segmented`), l'etichetta si associa solo al primo. Corretto per il selettore delle forme degli accordi; da correggere in tutto il componente.

### Non verificato

- Firefox e Safari/WebKit: browser non disponibili nell'ambiente (P0-09).
- Ascolto reale, latenza di casse e cuffie, chitarra in ingresso: nessun hardware audio.
- Lettori di schermo: solo attributi ARIA controllati nel codice, nessuna prova con NVDA/VoiceOver.

### Divergenze principali dalla specifica

1. Interfaccia in tema scuro "neon", lontana dallo skeuomorfismo realistico richiesto (P2-02).
2. Tre workspace su quattro: manca Arpeggios Lab.
3. Scale e accordi multipli assenti o limitati (seconda scala solo in Jam, un accordo sovrapposto).
4. Nessun input chitarra: niente pitch detection, Live Monitor, Tuner.
5. Jam con sola traccia di comping; nessuna batteria, basso o step sequencer.
6. ~~Cambio di metrica ferma la riproduzione.~~ Risolto (P0-08).
7. Accordature solo standard.

### Problemi risolti in questo blocco

- Tastiera limitata a 22 tasti con celle decrescenti → 24 tasti, celle uniformi.
- Targhetta senza versione né autore → `GUITAR THEORY LAB / v0.1.0 — by Sergio Todaro` dalla versione reale.
- Esercizi limitati a una forma e una direzione → percorsi a fasi con editor avanzato.
- Minore melodica ambigua → "jazz" come scala, "classica" come percorso.
