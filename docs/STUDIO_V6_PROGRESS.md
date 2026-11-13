# Studio V6 — Registro di avanzamento

Stati come in `CLAUDE.md`: implementato, testato con segnali sintetici, verificato con hardware reale, parziale, mancante. Aggiornato: 13 novembre 2026.

## Fase corrente

P1 (shell). Lotto 1 concluso; prossimo: lotto 2, rack destro.

## Lotti

| Lotto | Branch | PR | Unione | Stato |
|---|---|---|---|---|
| Mappa Graphify | `claude/hopeful-…` | #13 | unita | fatto |
| 1 · Shell V6 | `claude/peaceful-galileo-9ukuvh` | vedi sotto | vedi sotto | implementato, e2e verdi |
| 2 · Rack destro | — | — | — | mancante |
| 3 · Taccuino V6 | — | — | — | mancante |
| 4 · Mixer a fader lunghi | — | — | — | mancante |
| 5 · Libreria preset | — | — | — | mancante |
| 6 · Rig: fuzz, EQ, riordino, preset | — | — | — | mancante |
| 7 · Legenda a simboli | — | — | — | mancante |
| 8 · Motore esercizi condiviso | — | — | — | mancante |
| 9 · NAM, calibrazione, MIDI | — | — | — | mancante |
| 10 · Rifinitura e QA | — | — | — | mancante |

## Lotto 1 — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Header globale (marchio, Metronomo, Accordatore, Ingresso, Rig), senza trasporto | implementato | `e2e/studio-v6-shell.spec.ts` |
| Console tra le barre laterali, linguetta, striscia compatta con Avvia/Ferma, stato salvato | implementato | idem |
| BPM con rotella e trascinamento verticale entro i limiti del motore; Swing e Master con tastiera, trascinamento, rotella | implementato | idem |
| Rail: laboratori, fader chitarra (ascolto) e backing, muto del backing; nomi che non coprono le icone | implementato | idem |
| Trim e muto di gruppo del backing sul livello reale di accordi, basso, batteria, backing track | implementato | unit (`src/ui/appearance.test.ts`); non misurato sull'uscita audio in e2e |
| Pannello metronomo (acceso/spento, volume, timbro, metrica, suddivisione) | implementato | e2e |
| Maniglia del mixer: il cassetto copre solo il taccuino, tastiera e maniglia ferme | implementato | e2e |
| Risoluzioni 1366 × 768, 1280 × 800, 1280 × 720, 1024 × 768 | implementato | e2e (tutto in vista, pagina del taccuino ≥ 120 px) |

Limiti dichiarati del lotto 1:

- Rig e ingresso sono ancora cassetti (D-42), aperti dall'header: il rack destro è il lotto 2.
- Nessun «Solo» del backing e nessun tasto «Preset Library» nell'header: arrivano con i lotti 4 e 5. I preset restano nel pannello Impostazioni.
- A 1280 × 720 il mixer nel cassetto scala fino a 0,45: si risolve con il mixer a fader lunghi (lotto 4).
- Il metronomo ha quattro timbri; il quinto è nel lotto 6.
- Nessuna prova con chitarra e scheda audio reali in questa sessione.

## Test

| Momento | `npm run check` | `npm run test:e2e` |
|---|---|---|
| Baseline su `c034a9c` | verde, 464 unit | 118 su 119: instabile `studio-v57-shell` «tuner and interface without input» (corsa tra il focus del cassetto e la pressione del tasto) |
| Lotto 1 | verde, 465 unit | 128 su 128 in esecuzioni per file e ripetute; nella corsa completa un caso instabile di lettura dell'accordatore (`live-a2`, attesa sul segno invece che sul valore assoluto) corretto nel test |

Test resi deterministici in questo lotto, senza cambiare ciò che verificano: l'helper `openDevice` aspetta il focus del cassetto; `chooseLook` legge la shell dopo il frame successivo a un ridimensionamento; `live-stability` misura il picco su un loop intero del file di prova (prima dipendeva da quale nota cadeva nella finestra).

## Blocchi

Nessuno.

## Prossimo lotto consigliato

Lotto 2: colonna «Audio & Rig» a destra (espansa, compatta, nascosta) con i moduli Ingresso, Amplificatore, Cabinet IR, Pedaliera, Routing costruiti sui controlli reali di D-42; i cassetti di rig e ingresso vengono ritirati e i loro e2e spostati sul rack.
