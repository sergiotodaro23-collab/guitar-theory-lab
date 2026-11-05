# Guitar Theory Lab

Web app local-first per studiare scale, intervalli e funzioni armoniche. React + TypeScript strict, nessun backend.

- Comandi: `npm run check` (lint, types, unit, build), `npm run test:e2e` (Playwright).
- Stato e prossimi passi: `PROJECT_STATE.md`. Moduli e contratti: `docs/ARCHITECTURE.md`. GitHub e release: `docs/GITHUB_AND_RELEASES.md`.
- Regole: i motori in `src/{theory,fretboard,harmony,exercises,timeline,jam,persistence}` restano puri e senza DOM. Un solo clock: `TimelineScheduler` su `AudioContext.currentTime`. L'interfaccia non crea timer musicali.
- Ogni regola musicale nuova entra con un test su un caso da manuale.
- Interfaccia in italiano, codice in inglese. Feature branch per le modifiche significative.
