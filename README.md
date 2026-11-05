# Guitar Theory Lab

Applicazione web per studiare sulla tastiera scale, intervalli e funzioni armoniche, con metronomo e accompagnamento sullo stesso orologio audio. Funziona nel browser, senza account e senza backend: i preset restano nel browser.

## Avvio

Serve Node.js 22.

```bash
npm ci
npm run dev
```

Apri l'indirizzo mostrato dal terminale. In alternativa, `npm run build:single` produce `dist/guitar-theory-lab.html`, un unico file da aprire con doppio clic.

## Le tre modalità

- **Fretboard Lab**: scale e modi, posizioni CAGED e 3NPS, intervalli dalla seconda all'ottava, sequenze personalizzate, accordo sovrapposto.
- **Harmony Lab**: Harmonic Context Switch. La stessa posizione resta ferma mentre cambia l'armonia e ogni nota mostra la sua funzione sull'accordo corrente.
- **Jam Studio**: progressioni modificabili, accompagnamento sintetizzato, loop, seconda scala, aiuti visivi nascondibili.

Scorciatoie: spazio avvia e mette in pausa, N e P cambiano accordo, + e − regolano il BPM.

## Sviluppo

```bash
npm run check      # lint, type-check, test unitari, build
npm run test:e2e   # test nel browser reale con misura della sincronizzazione
```

Vedi `docs/ARCHITECTURE.md`, `docs/GITHUB_AND_RELEASES.md` e `PROJECT_STATE.md`.
