# Studio V6 — Registro di avanzamento

Stati come in `CLAUDE.md`: implementato, testato con segnali sintetici, verificato con hardware reale, parziale, mancante. Aggiornato: 13 novembre 2026.

## Fase corrente

P1 (shell) conclusa con i lotti 1 e 2; P2 avviata con il lotto 3 (taccuino); lotti 4 (mixer), 5 (Preset Library) e 6 (rig: fuzz, EQ, suoni, metronomo) fatti. Prossimo: riordino dei pedali (resto del lotto 6), poi lotto 7, legenda e tastiera secondaria.

## Lotti

| Lotto | Branch | PR | Unione | Stato |
|---|---|---|---|---|
| Mappa Graphify | `claude/hopeful-…` | #13 | unita | fatto |
| 1 · Shell V6 | `claude/peaceful-galileo-9ukuvh` | #14 | unita (CI verde) | implementato |
| 2 · Rack destro | `claude/studio-v6-rack` | #15 | unita (CI verde) | implementato; audio testato con segnale sintetico |
| 3 · Taccuino V6 | `claude/studio-v6-notebook` | #16 | unita (CI verde) | parziale: ordine, Dettagli, Voice leading; legenda a doppia pagina nel lotto 7 |
| 4 · Mixer a fader lunghi | `claude/studio-v6-mixer` | #17 | unita (CI verde) | implementato |
| 5 · Libreria preset | `claude/studio-v6-presets` | #18 | vedi PR | implementato |
| 6 · Rig: fuzz, EQ, riordino, preset | `claude/studio-v6-rig` | — | — | parziale: fuzz, EQ, suoni, quinto timbro; riordino mancante |
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

## Lotto 4 — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Mixer largo quanto il taccuino, fader lunghi anche a 1280 × 720 (corsa ≥ 90 px) | implementato | `e2e/studio-v6-shell.spec.ts` |
| Misuratore reale per canale (Click, Note, Accordi, Basso, Batteria) e Master | implementato | e2e: si muovono in riproduzione, si spengono col muto, restano spenti i canali senza traccia |
| Misuratore della chitarra (ingresso, prima dell'ascolto) | implementato, non misurato in e2e | — |
| Fader, muto e solo sui guadagni reali | implementato (già coperto) | `e2e/studio-v57.spec.ts` (livello in uscita) |
| Solo del backing, nel mixer e nella rail | implementato | unit `appearance.test.ts`, e2e |

Limiti dichiarati del lotto 4: nessun misuratore per il gruppo Backing né per la backing track importata; il Solo non include la backing track importata.

## Lotto 5 — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Finestra Preset Library dall'header: ricerca, filtri combinabili (laboratorio, tipo, tonalità, difficoltà, origine) | implementato | unit `presetLibrary.test.ts`, `e2e/studio-v6-shell.spec.ts` |
| Carica (anche cambiando laboratorio), salva lo studio corrente, rinomina, elimina; persistenza al ricaricamento | implementato | e2e, `e2e/app.spec.ts` |
| Descrizione dei preset letta dai dati | implementato | unit |
| Preset su progressione con la tonalità dell'analisi | corretto | unit |

Limiti dichiarati del lotto 5: nessun filtro per tecnica e stile (i preset non portano quei dati); la difficoltà esiste solo sui preset di partenza; la modifica di un preset è rinomina o sovrascrittura con lo stesso nome.

## Lotto 6 — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Fuzz: clipper asimmetrico, tono e livello, sul grafo prima dell'overdrive | implementato, testato con segnale sintetico (livello misurato a 30 dB di escursione) | unit `rig.test.ts` (curva limitata, monotona, zero a zero), `e2e/guitar-rig.spec.ts` |
| EQ a tre bande dopo il cabinet | implementato, testato con segnale sintetico (taglio e boost misurati in uscita) | unit (manopole ±12 dB), e2e |
| Catena letta dal grafo con i nuovi stadi | implementato | e2e (`chain`, `active`) |
| Sette suoni di partenza con selettore nel rack; spostare un controllo torna a «Personale» | implementato | unit (ogni suono riconosciuto, cosa suona), e2e |
| Sessioni salvate prima: pedali nuovi spenti, gli altri intatti | implementato | unit |
| Quinto timbro del metronomo «Morbido» | implementato | unit (cinque timbri, forma del suono) |

Limiti dichiarati del lotto 6:

- Riordino, aggiunta e rimozione dei pedali: mancanti. La catena è fissa.
- I suoni di partenza sono impostazioni del rig DSP interno, non modelli di amplificatori; nessun NAM (lotto 9).
- Nessuna prova con chitarra e scheda audio reali.

## Test

| Momento | `npm run check` | `npm run test:e2e` |
|---|---|---|
| Baseline su `c034a9c` | verde, 464 unit | 118 su 119: instabile `studio-v57-shell` «tuner and interface without input» (corsa tra il focus del cassetto e la pressione del tasto) |
| Lotto 1 (PR #14) | verde, 465 unit | 128 su 128 in esecuzioni per file e ripetute; nella corsa completa un caso instabile di lettura dell'accordatore (`live-a2`, attesa sul segno invece che sul valore assoluto) corretto nel test |
| Lotto 2 (PR #15) | verde, 467 unit | 128 su 128 in locale e in CI |
| Lotto 3 | verde, 473 unit | corsa completa locale 129 su 130 (un test degli arpeggi cercava la striscia degli accordi sulla scheda Esercizi: aggiunta lì); i file toccati rieseguiti verdi; corsa completa verde in CI sulla PR #16 |
| Lotto 4 (PR #17) | verde, 473 unit | 131 su 131 in locale |
| Lotto 5 (PR #18) | verde, 478 unit | 132 su 132 in locale e in CI |
| Lotto 6 | verde, 484 unit | 133 su 133 in locale; CI sulla PR #19 |

Test resi deterministici nel lotto 1, senza cambiare ciò che verificano: l'helper `openDevice` aspetta il focus del cassetto; `chooseLook` legge la shell dopo il frame successivo a un ridimensionamento; `live-stability` misura il picco su un loop intero del file di prova (prima dipendeva da quale nota cadeva nella finestra).

## Blocchi

Nessuno.

## Prossimo lotto consigliato

Riordino dei pedali (resto del lotto 6): scelta dell'ordine dentro le due file pre e post, senza cambiare la posizione dell'amplificatore e del cabinet; poi il lotto 7: legenda a doppia pagina (Scale a sinistra, Accordi a destra) con numero, simbolo per ruolo, nome, colore tra 12 e visibilità, sopra `scaleLayers` e `chordLayers`; note sovrapposte composte; tastiera secondaria in palissandro con overlay indipendente. Poi lotto 8 (motore esercizi condiviso), lotto 9 (fattibilità NAM). Fuzz, EQ, suoni di partenza e quinto timbro sono già nel lotto 6 (D-48).
