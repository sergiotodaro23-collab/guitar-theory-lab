# Guitar Theory Lab

Web app local-first per studiare scale, intervalli e funzioni armoniche. React + TypeScript strict, nessun backend. Gratuita e open source.

- Comandi: `npm run check` (lint, types, unit, build), `npm run test:e2e` (Playwright, Chromium).
- Riprendere il lavoro: `PROJECT_STATE.md` → `docs/ROADMAP.md` (registro con stati `IMPLEMENTED | PARTIAL | BROKEN | MISSING | BLOCKED`).
- Requisiti: `docs/MASTER_SPEC.md`. Scelte: `docs/DECISIONS.md`. Verifiche: `docs/QA_REPORT.md`. Moduli: `docs/ARCHITECTURE.md`. GitHub: `docs/GITHUB_AND_RELEASES.md`. Audio: `docs/AUDIO_DIAGNOSTICS.md`.
- Regole: i motori in `src/{theory,fretboard,harmony,exercises,timeline,jam,persistence}` restano puri e senza DOM. Un solo clock: `TimelineScheduler` su `AudioContext.currentTime`. L'interfaccia non crea timer musicali.
- Ogni regola musicale nuova entra con un test su un caso da manuale. Forme e diteggiature vengono dal motore, mai scritte a mano nella UI.
- Interfaccia in italiano, codice in inglese. Feature branch e commit piccoli. Desktop-first (D-23); una PR per incremento. Dal 13 novembre 2026 (D-43) il proprietario autorizza l'agente a unire le proprie PR ordinarie in `main` quando la CI è verde e nessuna protezione del branch lo vieta; mai force push su `main`, mai aggirare controlli falliti.
- Stato di ogni funzione: implementato, testato con segnali sintetici, verificato con hardware reale, parziale, mancante. Mai confonderli.
- Mai dichiarare verificato ciò che non è stato eseguito. Non presentare funzioni pianificate come implementate.
- Serve l'approvazione del proprietario per: licenza, release e tag, deploy, servizi a pagamento, segreti, migrazioni distruttive dei dati, cambi radicali di stack, sostituzione globale della UI (per la Studio V6 l'approvazione c'è: D-43).
- Studio V6: stato in `docs/STUDIO_V6_PROGRESS.md`, piano in `docs/STUDIO_V6_IMPLEMENTATION_PLAN.md`, criteri in `docs/STUDIO_V6_ACCEPTANCE_CRITERIA.md`.
