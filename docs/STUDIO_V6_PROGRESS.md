# Studio V6 — Registro di avanzamento

Stati come in `CLAUDE.md`: implementato, testato con segnali sintetici, verificato con hardware reale, parziale, mancante. Aggiornato: 13 novembre 2026.

## Fase corrente

P1 (shell) conclusa con i lotti 1 e 2; P2 avviata con il lotto 3 (taccuino); lotti 4 (mixer), 5 (Preset Library) e 6 (rig: fuzz, EQ, suoni, metronomo, pedaliera configurabile) fatti. Prossimo: lotto 7, legenda e tastiera secondaria.

## Lotti

| Lotto | Branch | PR | Unione | Stato |
|---|---|---|---|---|
| Mappa Graphify | `claude/hopeful-…` | #13 | unita | fatto |
| 1 · Shell V6 | `claude/peaceful-galileo-9ukuvh` | #14 | unita (CI verde) | implementato |
| 2 · Rack destro | `claude/studio-v6-rack` | #15 | unita (CI verde) | implementato; audio testato con segnale sintetico |
| 3 · Taccuino V6 | `claude/studio-v6-notebook` | #16 | unita (CI verde) | parziale: ordine, Dettagli, Voice leading; legenda a doppia pagina nel lotto 7 |
| 4 · Mixer a fader lunghi | `claude/studio-v6-mixer` | #17 | unita (CI verde) | implementato |
| 5 · Libreria preset | `claude/studio-v6-presets` | #18 | vedi PR | implementato |
| 6 · Rig: fuzz, EQ, riordino, preset | `feat/studio-v6-pedal-order` | vedi PR | — | implementato: fuzz, EQ, suoni, quinto timbro (PR #19); pedaliera configurabile (D-49) |
| 7 · Legenda a simboli | — | — | — | mancante |
| 8 · Motore esercizi condiviso | — | — | — | mancante |
| 9 · NAM, calibrazione, MIDI | `claude/charming-einstein-erno4u` | vedi PR | — | parziale: NAM con file locale implementato e testato con segnali e modelli sintetici (D-51); calibrazione e MIDI mancanti |
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

- Ordine dei pedali fisso; niente aggiunta, rimozione o riordino; niente fuzz ed EQ (lotto 6). *Superato dal lotto 6 (D-49): riordino, aggiunta e rimozione ora ci sono; fuzz ed EQ anche.*
- Il routing è descritto, non modificabile.
- Nessun preset di suono del rig (lotto 6). Nessun modello NAM (lotto 9): la testata lo dichiara. *Superato dal lotto 6: i suoni di partenza ci sono (D-48).*
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
| Sette suoni di partenza con selettore nel rack; spostare un controllo torna a «Personale» | implementato | unit (ogni suono riconosciuto, cosa suona), e2e |
| Quinto timbro del metronomo «Morbido» | implementato | unit (cinque timbri, forma del suono) |
| Sessioni salvate prima: pedali nuovi spenti, gli altri intatti | implementato | unit |
| Pedaliera configurabile (D-49): ordine dentro PRE e POST con «←» e «→» da tastiera | implementato, testato con segnale sintetico | unit `pedalChain.test.ts` (ordine iniziale, riordino valido e ai bordi, zone, duplicati, aggiunta e rimozione, salvataggio e ripristino, sessioni precedenti, catena danneggiata, catena vuota), e2e `e2e/pedal-chain.spec.ts` (ordine nel grafo, riordino, rimozione con parametri conservati, riaggiunta, ripristino, salvataggio al ricaricamento, pedale rimosso mai udibile, il suono cambia con l'ordine di circa il 29% sullo stesso segnale) |
| Aggiunta e rimozione dalla catena; «Catena predefinita» riporta ordine e pedali, lascia i parametri | implementato | come sopra |
| Sette suoni di partenza ancora validi e riconosciuti | verificato | unit e e2e (`rig-preset`) |

Limiti dichiarati del lotto 6:

- Un pedale non passa tra PRE e POST, cioè non supera l'amplificatore: non è offerto.
- Ogni tipo di pedale compare una volta sola: nessun secondo overdrive o secondo delay.
- Il riordino è con pulsanti, non con trascinamento.
- Quando la catena cambia mentre il segnale passa, il collegamento avviene subito: un piccolo scatto all'ascolto non è stato verificato con chitarra.
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
| Lotto 6 | verde, 502 unit | 140 su 140 in locale (incluse le 7 prove della pedaliera) |
| Consolidamento (D-50) | verde, 502 unit | rig e pedaliera 12 su 12 in locale (nuova prova: cambio di catena nel silenzio); corsa completa verde in CI sulla PR #21 |
| Lotto 9, parte NAM (D-51) | verde, 516 unit | 148 su 148 in locale (7 prove nuove in `e2e/nam.spec.ts`) |
| TONE3000 (D-52) | verde, 537 unit | 153 su 153 in locale (4 prove nuove in `e2e/tone3000.spec.ts` contro un servizio simulato, 1 nuova sulla latenza del motore) |

Test resi deterministici nel lotto 1, senza cambiare ciò che verificano: l'helper `openDevice` aspetta il focus del cassetto; `chooseLook` legge la shell dopo il frame successivo a un ridimensionamento; `live-stability` misura il picco su un loop intero del file di prova (prima dipendeva da quale nota cadeva nella finestra).

## Consolidamento (13 novembre 2026)

PR #20 (pedaliera configurabile) unita in `main` come `8768765` dopo verifica locale e CI verde. Audit del rig in `docs/STUDIO_V6_CONSOLIDATION.md`: un difetto trovato e corretto (click al cambio di catena, D-50). Il lavoro di Antigravity (`fix/antigravity-v6-qa`, `studio_v6_qa_fixes`) non è sul remoto né in un worktree locale: non è integrato.

| Funzione | Stato | Prova |
|---|---|---|
| Cambio di catena senza click: dissolvenza, riconnessione nel silenzio, risalita | implementato, testato con segnale sintetico | `e2e/pedal-chain.spec.ts` (guadagno d'uscita sotto 0,02 al momento della riconnessione, tre cambi in una dissolvenza, il suono torna) |
| Il modulo Routing segue il grafo dopo una riconnessione differita | implementato | idem |

## Lotto 9 (parte NAM) — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| Motore NAM vero (WASM in AudioWorklet) nello stadio amplificatore, DSP interno come ripiego | implementato, testato con segnali e modelli sintetici | `e2e/nam.spec.ts` (motore attivo letto dal grafo, linearità: metà guadagno, metà livello) |
| Selettore DSP interno / NAM nella testata, modello caricato, metadati, misure, limiti | implementato | e2e |
| Caricamento di file `.nam` locali: A1 (WaveNet, LSTM, Linear) e A2 | implementato; ConvNet non provato | unit `namModel.test.ts`, e2e |
| Rifiuto di file sbagliati, formati non supportati, modelli troppo pesanti; il modello precedente resta | implementato | unit, e2e |
| Cabinet saltato quando il capture lo include | implementato | e2e (catena attiva letta dal grafo) |
| PRE prima dell'ampli, POST dopo il cabinet; analisi sul segnale secco; ascolto mai acceso da solo | implementato | e2e |
| Misure: caricamento, costo per blocco, latenza, continuità, memoria | misurate su questa macchina | `npm run perf:nam`, `docs/NAM_INTEGRATION.md` |

Limiti dichiarati: nessuna prova con chitarra, scheda audio e capture reali; nessun ricampionamento; lo scambio di modello interrompe l'audio per decine di millisecondi; il modello non viene conservato tra le visite; catalogo TONE3000 nella PR successiva.

## TONE3000 (D-52) — cosa c'è

| Funzione | Stato | Prova |
|---|---|---|
| «Sfoglia TONE3000» nella testata: flusso Select in una finestra, OAuth 2.0 con PKCE e `state` | implementato, **testato contro un servizio simulato** | unit `tone3000.test.ts`, `e2e/tone3000.spec.ts` |
| Dettagli del tone, selettore dei modelli, caricamento nel motore NAM, attribuzione sulla testata | implementato, testato contro un servizio simulato | e2e |
| Niente token, codici, indirizzi di download o modelli in memoria permanente | implementato | e2e (contenuto di `localStorage` e `sessionStorage`) |
| Flusso con il servizio TONE3000 reale | **non eseguito**: manca la chiave pubblicabile | — |

## Baseline

Baseline consolidata della V6 per il lavoro su NAM: `main` a `6c493be692dfe5c3b521d9339047e2e9366b5441` (13 novembre 2026, dopo le PR #20 e #21).

## Blocchi

Nessuno.

## Prossimo lotto consigliato

Lotto 7: legenda a doppia pagina (Scale a sinistra, Accordi a destra) con numero, simbolo per ruolo, nome, colore tra 12 e visibilità, sopra `scaleLayers` e `chordLayers`; note sovrapposte composte; tastiera secondaria in palissandro con overlay indipendente. Poi lotto 8 (motore esercizi condiviso), lotto 9 (fattibilità NAM).
