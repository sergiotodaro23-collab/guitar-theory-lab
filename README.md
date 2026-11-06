# Guitar Theory Lab

Applicazione web per studiare sulla tastiera scale, intervalli e funzioni armoniche, con metronomo e accompagnamento sullo stesso orologio audio. Funziona nel browser, senza account e senza backend: i preset restano nel browser.

## Avvio

Serve Node.js 22.

```bash
npm ci
npm run dev
```

Apri l'indirizzo mostrato dal terminale. In alternativa, `npm run build:single` produce `dist/guitar-theory-lab.html`, un unico file da aprire con doppio clic.

## Le quattro modalità

- **Fretboard Lab**: tastiera a 24 tasti, scale e modi, posizioni CAGED e 3NPS, intervalli dalla seconda all'ottava, sequenze personalizzate, accordo sovrapposto. Con l'**editor avanzato** costruisci percorsi a fasi: per esempio Do maggiore in forma C a salire e in forma G a scendere.
- **Harmony Lab**: Harmonic Context Switch. La stessa posizione resta ferma mentre cambia l'armonia e ogni nota mostra la sua funzione sull'accordo corrente.
- **Arpeggios Lab**: arpeggi di un accordo o di tutta la progressione, con rivolti, direzioni, pattern personalizzati e arpeggi collegati per nota più vicina.
- **Jam Studio**: progressioni modificabili, accompagnamento sintetizzato, loop, scale sovrapposte, aiuti visivi nascondibili.

Scorciatoie: spazio avvia e mette in pausa, N e P cambiano accordo, + e − regolano il BPM.

## Sviluppo

```bash
npm run check      # lint, type-check, test unitari, build
npm run test:e2e   # test nel browser reale con misura della sincronizzazione
```

Vedi `PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/MASTER_SPEC.md` e `docs/ARCHITECTURE.md`.

## Licenza

Copyright © 2026 Sergio Todaro. Guitar Theory Lab è software libero: puoi ridistribuirlo e modificarlo secondo i termini della GNU General Public License, versione 3 o (a tua scelta) successiva. È distribuito senza alcuna garanzia. Il testo completo è in `LICENSE`; per contribuire vedi `CONTRIBUTING.md`.
