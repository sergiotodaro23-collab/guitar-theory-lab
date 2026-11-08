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

## Incrementi

1. Separazione dell'archivio dai controlli di produzione e baseline.
2. Mixer V5.7 adattato allo stato e al routing esistenti, asset gestiti da Vite, verifiche audio/interfaccia e regressioni Semplificata.
3. Successivi: quaderno, rail, divisore e drawer; accordatore e interfaccia sulla pipeline reale; console e marker. Amp/NAM solo quando esiste un motore reale. Nessuna simulazione viene promossa a funzione del prodotto.

La PR copre i primi due incrementi, non l'intero redesign.
