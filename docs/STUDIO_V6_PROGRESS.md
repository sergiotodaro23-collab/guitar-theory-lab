# Studio V6 — Registro di avanzamento

Stati come in `CLAUDE.md`: implementato, testato con segnali sintetici, verificato con hardware reale, parziale, mancante. Aggiornato: 13 novembre 2026.

## Fase corrente

P1 (shell) conclusa con i lotti 1 e 2; P2 avviata con il lotto 3 (taccuino). Prossimo: lotto 4, mixer a fader lunghi.

## Lotti

| Lotto | Branch | PR | Unione | Stato |
|---|---|---|---|---|
| Mappa Graphify | `claude/hopeful-…` | #13 | unita | fatto |
| 1 · Shell V6 | `claude/peaceful-galileo-9ukuvh` | #14 | unita (CI verde) | implementato |
| 2 · Rack destro | `claude/studio-v6-rack` | #15 | unita (CI verde) | implementato; audio testato con segnale sintetico |
| 3 · Taccuino V6 | `claude/studio-v6-notebook` | #16 | vedi PR | parziale: ordine, Dettagli, Voice leading; legenda a doppia pagina nel lotto 7 |
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

Limiti dichiarati del lotto 1 ancora aperti:

- Nessun «Solo» del backing e nessun tasto «Preset Library» nell'header: arrivano con i lotti 4 e 5. I preset restano nel pannello Impostazioni.
- A 1280 × 720 il mixer nel cassetto scala fino a 0,45: si risolve con il mixer a fader lunghi (lotto 4).
- Il metronomo ha quattro timbri; il quinto è nel lotto 6.

## Lotto 2 — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Rack «Audio & Rig»: espanso, dorso compatto con spie, nascosto; stato salvato; compatto di partenza sotto 1280 px | implementato | `e2e/guitar-rig.spec.ts`, unit `layout.test.ts` |
| Moduli comprimibili con acceso/spento reale (ingresso, ampli, cabinet) | implementato | e2e |
| Scheda audio: avvio/arresto, gain, canale, misuratore, ascolto, stato sul display | testato con segnale sintetico | `e2e/studio-v57-shell.spec.ts`, `e2e/guitar-rig.spec.ts` (WAV come microfono) |
| Amplificatore: sei manopole dentro lo chassis, accensione, bypass, sul DSP reale | testato con segnale sintetico | `e2e/guitar-rig.spec.ts` (livello in uscita misurato) |
| Cabinet / IR: 4x12, 1x12, file dell'utente, acceso/spento | testato con segnale sintetico | idem |
| Pedaliera: i cinque pedali di D-42 su una striscia che scorre, «Tutti off» | testato con segnale sintetico | idem (catena e parametri letti dal grafo) |
| Routing / Uscita: catena attiva letta dal grafo, percorso di analisi e di ascolto, misuratore d'uscita | implementato, sola lettura | e2e sullo stato |
| Piede del rack: nota rilevata sulla tastiera, stato MIDI | implementato | — |
| Metrica e suddivisione nel pannello Metronomo; console più stretta con il rack aperto | implementato | `e2e/accents.spec.ts`, `e2e/drums.spec.ts` |

Limiti dichiarati del lotto 2:

- Ordine dei pedali fisso; niente aggiunta, rimozione o riordino; niente fuzz ed EQ (lotto 6).
- Il routing è descritto, non modificabile.
- Nessun preset di suono del rig (lotto 6). Nessun modello NAM (lotto 9): la testata lo dichiara.
- Nessuna prova con chitarra e scheda audio reali.

## Lotto 3 — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Ordine delle schede per laboratorio e tre schede condivise | implementato | unit `layout.test.ts`, `e2e/studio-v6-shell.spec.ts` |
| Arpeggi diviso in «Arpeggi» (cosa e dove) ed «Esercizi» (come); Harmony in Progressione, Voice leading, Analisi; Jam in Progressione, Basso / Comping, Backing track | implementato, stessi controlli di prima | e2e esistenti sui pannelli |
| Dettagli: scala, formula, note, posizione, accordo, guide tones, numerale, basso, verso il prossimo accordo | implementato | unit `details.test.ts` (ii–V–I in Do, Re dorico, C/E), e2e |
| Voice leading: focus, note comuni e moto delle guide tones dal motore, segue il cambio d'accordo | implementato | e2e |

Limiti dichiarati del lotto 3:

- «Altri strumenti» in Jam: mancante, nessuna scheda finché non c'è una funzione reale.
- Legenda e visualizzazione: è ancora la legenda V5.7 con il tutor; la doppia pagina Scale/Accordi con simboli, 12 colori e note sovrapposte composte è il lotto 7.
- Tastiera secondaria: è l'anteprima del prossimo accordo (acero come la principale); palissandro e scelta indipendente dell'overlay nel lotto 7.
- Con dieci o undici schede la linguetta scorre in orizzontale sotto 1440 px con il rack aperto.

## Test

| Momento | `npm run check` | `npm run test:e2e` |
|---|---|---|
| Baseline su `c034a9c` | verde, 464 unit | 118 su 119: instabile `studio-v57-shell` «tuner and interface without input» (corsa tra il focus del cassetto e la pressione del tasto) |
| Lotto 1 (PR #14) | verde, 465 unit | 128 su 128 in esecuzioni per file e ripetute; nella corsa completa un caso instabile di lettura dell'accordatore (`live-a2`, attesa sul segno invece che sul valore assoluto) corretto nel test |
| Lotto 2 (PR #15) | verde, 467 unit | 128 su 128 in locale e in CI |
| Lotto 3 | verde, 473 unit | corsa completa locale 129 su 130 (un test degli arpeggi cercava la striscia degli accordi sulla scheda Esercizi: aggiunta lì); i file toccati rieseguiti verdi; corsa completa di riferimento in CI sulla PR #16 |

Test resi deterministici nel lotto 1, senza cambiare ciò che verificano: l'helper `openDevice` aspetta il focus del cassetto; `chooseLook` legge la shell dopo il frame successivo a un ridimensionamento; `live-stability` misura il picco su un loop intero del file di prova (prima dipendeva da quale nota cadeva nella finestra).

## Blocchi

Nessuno.

## Prossimo lotto consigliato

Lotto 4: mixer a tutta larghezza con fader lunghi e misuratori per canale (oggi il cassetto scala il telaio renderizzato fino a 0,45 nelle finestre basse), Solo del backing. Servono analizzatori per canale in `src/audio/webAudioSink.ts`: oggi è misurato solo il Master. Poi lotto 5 (Preset Library) e lotto 7 (legenda a doppia pagina, tastiera secondaria in palissandro).
