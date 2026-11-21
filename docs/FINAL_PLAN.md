# Piano verso la versione desktop definitiva

Fonte: direttiva del proprietario del 21 novembre 2026 (topic del progetto «Final development» e messaggio nel thread di pianificazione). Sostituisce l'ordine dei lotti A–F come **ordine operativo** (D-56); i lotti A–F restano qui come attività, nessun requisito è stato tolto. Requisiti stabili in `docs/MASTER_SPEC.md`, stato corrente in `PROJECT_STATE.md`, registro storico in `docs/ROADMAP.md`.

**Criterio di completamento.** Non chiudere i lotti, ma soddisfare tutte le specifiche della versione definitiva con funzioni reali e verificate: esercizi realmente funzionanti, audio convincente, NAM operativo, interfaccia professionale, test superati. Una funzione non è completa perché esiste la sua UI.

Stati: `IMPLEMENTED | PARTIAL | BROKEN | MISSING | BLOCKED`. Per l'audio si distingue sempre: implementato, testato con segnali sintetici, verificato con hardware reale.

## 1. Punto di partenza (audit del 21 novembre 2026)

`main` a `b19e8a1`, 42 PR unite, 564 unit e 211 e2e alla PR #38. Sintesi per area:

| Area | Stato | Cosa c'è | Cosa manca rispetto alla direttiva |
|---|---|---|---|
| Motore teorico (note, scale, accordi) | IMPLEMENTED in gran parte | Spelling con lettera, 17 toniche, modi, melodica classica/jazz, pentatoniche, blues, ~40 qualità d'accordo, slash | Scale personalizzate ed esotiche, formula d'accordo libera |
| Esercizi a fasi (`routine.ts`) | PARTIAL | Fasi con scala, tonica, forma CAGED/3NPS/range, direzione, sequenza, suddivisione 1–4, ripetizioni; trasposizione uniforme in semitoni | Trasposizione relazionale con riferimento e fasi indipendenti; durate, pause, battute di separazione, count-in; corde utilizzate, string skipping; quattro livelli; condivisione |
| Trasporto e clock | IMPLEMENTED | Un clock, cambio metrica alla stanghetta, swing, accenti | Count-in, countdown |
| Fretboard Lab | PARTIAL | Scale multiple, CAGED, 3NPS, intervalli 2ª–8ª, accordature | Preset per livello su tutte le famiglie richieste, forma per scala sovrapposta, sequenze 3–5+ generative |
| Harmony Lab | PARTIAL | Context switch, interscambio modale, guide tones, voicing cercati sul manico | Drop 2/3/2&4, shell, quartali, gruppi di corde con tutti i rivolti, sostituzioni, turnaround, controllo ergonomico e note omissibili |
| Arpeggios Lab | PARTIAL | Rivolti, CAGED, 1–3 ottave, sweep, salto di corda, collegamenti, target | Quattro livelli, permutazioni, enclosure, triad pairs, upper structures, poliritmie, editing nota per nota |
| Jam Studio | PARTIAL | 8 generi, groove A–D, fill, arrangiamenti, basso generato, mixer con mute/solo | Tutti i suoni sono sintetizzati: niente multisample, velocity layer, round robin; niente pan; comping senza voice leading dal motore |
| Guitar Rig e NAM | PARTIAL | Catena reale con DSP interno, NAM WASM da file, IR, 7 pedali riordinabili, TONE3000 contro servizio simulato, scelta dispositivi | Persistenza dei modelli, calibrazione del livello, limiter di protezione, routing modificabile, modelli di partenza con licenza, prova con hardware |
| Pannello Note | PARTIAL | Legenda a forme, triangolo arpeggio (D-55), vista per accordo | Legenda geometrica completa (cerchi, triangoli, rombi, quadrati), colori personalizzabili, seconda tastiera, modo dell'accordo in esecuzione come default, input legacy ancora presente |
| UI Studio V6 | PARTIAL | Shell, rack, mixer, taccuino, preset library | Barre compatte, fader laterali, LCD contestuale, rifinitura skeuomorfica, eliminazione di scroll e controlli ridondanti |
| QA | PARTIAL | CI verde, unit ed e2e su Chromium, perf leggera | Firefox/WebKit, regressione visiva sistematica, QA audio misurato, prova con hardware reale |

## 2. Principi di esecuzione

- Le priorità del proprietario (1 motore, 2 laboratori, 3 Jam, 4 Rig, 5 Note e UI, 6 QA e rilascio) decidono il peso; le dipendenze tecniche decidono l'ordine.
- Tre binari in parallelo: **motore e laboratori** (F1 → F2), **audio** (F3 e F4, che dipendono poco dal motore), **interfaccia** (F5, che consuma il motore). Ogni attività è una PR piccola con test.
- Ogni regola musicale entra con un test su un caso da manuale. Forme e diteggiature vengono dal motore.
- Materiale non fornito dal proprietario (campioni, modelli NAM): l'agente cerca risorse con licenza compatibile con GPL-3.0-or-later e le registra; il progetto non dipende mai da materiale non ancora disponibile (ripiego sintetico sempre presente).
- Si chiede al proprietario solo: blocchi reali, cambi sostanziali al prodotto, operazioni irreversibili (release, tag, deploy, licenza, segreti).

## 3. Fasi e attività

Formato: **ID · attività** — stato · dipendenze. Accettazione.

### F1 · Motore musicale condiviso (priorità 1)

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| M1 | Trasposizione relazionale: tonalità di riferimento dell'esercizio, intervallo con la lettera (Do→Re sposta La→Si, Lab→Sib; Do→Reb e Do→Do# danno spelling diversi), fasi che seguono il riferimento o restano fisse | IMPLEMENTED (D-57, completata da M2) | — | Caso del proprietario: Do magg. rif., La min. naturale su + La min. melodica giù → Re magg.: Si naturale + Si melodica; con Lab melodica → Sib melodica. Scale mai sostituite con le relative. Unit + e2e |
| M2 | Relazioni personalizzate: fase ancorata a un'altra fase o al riferimento con un intervallo scelto; trasposizione indipendente di una fase | IMPLEMENTED (D-62) | M1 | Unit su catene di relazioni, round-trip, nessun ciclo |
| M3 | Modello ritmico: figure (intero…sedicesimo, terzine, quintine), punto, pause, legature di valore, battute di separazione tra fasi, count-in e countdown sul clock unico | PARTIAL (#45: esercizio singolo e fasi; manca Arpeggios Lab) | — | 5 note di pentatonica in crome in 4/4 attraversano la stanghetta correttamente; in 3/4 e 6/8 idem; count-in udibile senza spostare la battuta 1 |
| M4 | Vincoli sul manico: corde utilizzate (1–6, insiemi qualsiasi), intervallo di tasti, posizione, string skipping, attraversamento dell'intera tastiera | PARTIAL (#45: corde e salto di corda; manca il percorso su tutta la tastiera) | — | Ogni nota generata rispetta i vincoli; combinazioni impossibili segnalate con alternativa |
| M5 | Sequenze generative: gruppi di 3–5+ note, intervalli diatonici e cromatici, permutazioni, pattern irregolari, alternanza su/giù | PARTIAL | M3 | Casi da manuale (gruppi di 4 in Do, terze alternate, quarte) |
| M6 | Quattro livelli (principiante, intermedio, avanzato, esperto) come dato dell'esercizio; migrazione dei preset a tre livelli | IMPLEMENTED (D-61) | — | Preset esistenti migrati senza perdite; filtro per livello |
| M7 | Preset: salvataggio, export/import file, condivisione via link senza backend, versionamento e validazione | PARTIAL | M1–M6 | Round-trip file e link; preset malformati rifiutati con messaggio |
| M8 | Esercizio unico per tutti i laboratori: stesso modello di fasi per scale, accordi, arpeggi, con trasporto e cambi alla stanghetta | PARTIAL | M1–M4 | Una routine mista scala/arpeggio/accordo suona e si visualizza nei tre laboratori |
| M9 | Riconoscimento delle note suonate sull'esercizio: punteggio di altezza e tempo, latenza compensata, riepilogo | PARTIAL | M3, R3 | Test con WAV sintetici a tempo e fuori tempo; dichiarato non verificato con chitarra finché il proprietario non prova |

### F2 · Laboratori (priorità 2)

**Fretboard Lab**

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| FB1 | Scale obbligatorie verificate (maggiore, minore naturale, armonica, melodica classica/jazz, pentatoniche) e registro estensibile: modi, esotiche, scale personalizzate dall'utente | PARTIAL | — | Spelling da manuale su 17 toniche; scala personalizzata salvabile |
| FB2 | Biblioteca di preset per quattro livelli: salita/discesa, alternanza, 1–6 corde, CAGED, 3NPS, posizioni, intera tastiera, sequenze 3–5+, terze/quarte/seste, intervalli, string skipping, cambi di posizione, trasposizioni e cambi di scala durante l'esercizio | PARTIAL | M1–M6 | Ogni preset generato dal motore, suonabile, con test di generazione |
| FB3 | Forma CAGED/3NPS indipendente per scala sovrapposta (P1-06b) e sovrapposizioni leggibili (P1-06c) | PARTIAL | N2 | Unit su forme; screenshot a 4 risoluzioni |

**Harmony Lab**

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| HA1 | Armonizzazione di maggiore, minore naturale, armonica, melodica in triadi (incl. aumentate, sus) e quadriadi (Maj7, m7, 7, m7b5, dim7, mMaj7, maj7#5) | IMPLEMENTED nel motore (D-63, `harmony/harmonize.test.ts`) | — | Tabelle da manuale per le quattro scale |
| HA2 | Estesi 9/11/13, alterazioni, formula libera (P1-07b) | PARTIAL | — | Spelling da manuale |
| HA3 | Motore di voicing: shell, Drop 2, Drop 3, Drop 2&4, quartali, strutture modali; gruppi di corde (1-2-3, 2-3-4, …) con tutti i rivolti; note obbligatorie/omissibili; difficoltà ergonomica | PARTIAL (motore e test, D-63; manca l'uso nel laboratorio) | HA1 | Drop 2 di Cmaj7 sulle corde 1–4 e 2–5 da manuale; ogni voicing eseguibile (apertura, dita) |
| HA4 | Progressioni: II-V-I, turnaround, dominanti secondarie, sostituzioni (tritono, diatoniche), voice leading tra voicing (P1-11) | PARTIAL (motore e test, D-63; manca l'uso nel laboratorio) | HA3 | Voice leading minimo su ii–V–I in tutte le tonalità |
| HA5 | Preset di armonizzazione progressiva su gruppi di corde attraverso tutti i rivolti; accordi su 4–6 corde | MISSING | HA3, M8 | Preset per livello, suonabili |
| HA6 | Visualizzazione che distingue note suonate, corde e gradi armonici | PARTIAL | N2 | e2e sulla legenda |

**Arpeggios Lab**

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| AR1 | Principiante: triadi, rivolti, 1–2 ottave, posizioni semplici | IMPLEMENTED in gran parte | — | Preset dedicati |
| AR2 | Intermedio: quadriadi, CAGED, permutazioni 1-3-5-7 / 1-5-3-7 ecc., string skipping, salti d'ottava, arpeggi diatonici, collegamenti | PARTIAL | M5 | Permutazioni generate, test |
| AR3 | Avanzato: 9/11/13, enclosure, cromatismi, sweep/economy, upper structures, triad pairs, voice leading, note target | PARTIAL | AR2, HA2 | Enclosure e triad pairs da manuale |
| AR4 | Esperto: sovrapposizioni, sostituzioni, quartali, tensioni alterate, poliritmie (raggruppamenti contro la metrica), pattern irregolari, intera tastiera | MISSING | AR3, M3 | Gruppi di 3 su 4/4 con accenti corretti |
| AR5 | Percorsi continui su più ottave e posizioni, diteggiatura e rivolto diversi tra salita e discesa | PARTIAL | M4 | Già parziale (D-27): estendere a percorsi su progressione |
| AR6 | Editing nota per nota, vincoli ergonomici, ritmiche, percorsi manuali | MISSING | M3, M4 | Modifica di una nota senza rompere il resto; validazione |
| AR7 | Biblioteca di preset per i quattro livelli | PARTIAL | AR1–AR6 | Almeno 6 preset per livello |

### F3 · Jam Studio (priorità 3)

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| J1 | Motore sampler: multisample per zona, velocity layer, round robin, caricamento pigro con cache, limite di voci, ripiego sintetico | PARTIAL (zone, layer, round robin, caricamento pigro, ripiego, polifonia; manca il budget CPU di J9) | — | Test offline (OfflineAudioContext): layer e round robin scelti correttamente; CPU entro budget |
| J2 | Ricerca e registro delle librerie con licenza compatibile (CC0, CC-BY, GPL): batteria, basso, piano acustico, piano elettrico, organo/tastiere; budget di dimensioni | PARTIAL (batteria, piano, basso elettrico, contrabbasso in CC0; mancano piano elettrico e organo) | — | `docs/AUDIO_ASSETS.md` con fonte, licenza, attribuzione per ogni file |
| J3 | Batteria: articolazioni, hi-hat chiuso/aperto/pedale, ghost notes, fill, velocity; sequencer Advanced (velocity, probabilità, 32/64 passi) | PARTIAL | J1, J2 | Ascolto del proprietario; test sui pattern |
| J4 | Basso: dinamiche, articolazioni (staccato, ghost, slide), walking jazz | PARTIAL | J1 | Walking su ii–V–I con note di approccio corrette |
| J5 | Tastiere con voicing coerenti dal motore (HA3) e voice leading nel comping | PARTIAL | HA3, J1 | Comping senza salti oltre la soglia |
| J6 | Groove, stili, swing, humanization deterministica (tempo, velocity) | PARTIAL | — | Test con seme fisso |
| J7 | Mixer: volume, pan, mute, solo, meter per bus | PARTIAL | — | Pan reale misurato sui canali |
| J8 | Pattern modificabili, loop, count-in (D1), sincronizzazione armonica | PARTIAL | M3 | e2e |
| J9 | Budget di latenza e CPU della Jam | MISSING | J1 | `npm run perf` con soglie |

### F4 · Guitar Rig, DSP e NAM (priorità 4)

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| R1 | Selezione ingresso/uscita (B1) | PARTIAL | — | Fatto con dispositivi simulati; da verificare con scheda reale |
| R2 | Pannello Audio nella barra destra (B2) e via l'input legacy dal taccuino (B3) | MISSING | — | Un solo posto per ingresso, gain, meter |
| R3 | Calibrazione del livello d'ingresso per NAM, meter in dBFS, clipping protection (limiter sul master), gestione errori | PARTIAL | R2 | Test sintetici: nessun campione oltre 0 dBFS |
| R4 | Accordatore cromatico e per corde | IMPLEMENTED (sintetico) | — | Da verificare con chitarra |
| R5 | NAM: persistenza dei modelli (IndexedDB), normalizzazione del livello, misure di costo, ripiego · **sospesa fino all'onda 5 (D-58)** | PARTIAL | R3, U6 | Modello ricaricato dopo riavvio; D-4 dei criteri V6 |
| R6 | Modelli NAM e IR di partenza con licenza compatibile (ricerca), oppure catalogo TONE3000 · **sospesa fino all'onda 5 (D-58)** | MISSING | R5 | Registro licenze; nessun modello senza permesso esplicito |
| R7 | TONE3000 incorporato in modalità ufficiali (F) · **sospesa fino all'onda 5 (D-58)** | MISSING | R5 | Chiave pubblicabile da chiedere solo all'onda 5; il resto del rig non ne dipende |
| R8 | Preset clean, crunch, distortion, jazz, fuzz, ambient sulla catena reale (DSP interno; NAM opzionale quando R5 c'è); routing modificabile e bypass | PARTIAL | R3 | Ogni preset cambia il grafo misurato |
| R9 | Monitoring a bassa latenza: `latencyHint`, misura e dichiarazione dei limiti del browser | PARTIAL | — | Valori misurati in `docs/AUDIO_DIAGNOSTICS.md` |
| R10 | Prova con hardware reale (proprietario) | BLOCKED | R1–R9 | Procedura scritta; esito registrato |

### F5 · Pannello Note e interfaccia Studio (priorità 5)

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| N1 | Pannello Note solo consultazione: nessun input, gain, calibrazione o controllo ampli | PARTIAL | R2 | e2e: nessun controllo audio nel pannello |
| N2 | Legenda geometrica condivisa: cerchi, triangoli, rombi, quadrati per ruolo (scala, arpeggio, accordo, target, intervalli); A3 residuo | PARTIAL | — | Unit su `viz/legend`; screenshot |
| N3 | Colori personalizzabili | PARTIAL | N2 | Salvati e applicati ovunque |
| N4 | Seconda tastiera | PARTIAL | N2 | Segue il prossimo accordo o una scelta |
| N5 | Default: modo della scala di riferimento pertinente all'accordo in esecuzione; alternative, sovrapposizioni, scale compatibili | PARTIAL | HA1 | G7 in Do mostra Sol misolidio; alternative selezionabili |
| N6 | Ogni cambio armonico aggiorna tutte le viste rispettando le relazioni dell'esercizio (M1, M2) | PARTIAL | M1, N5 | e2e in riproduzione |
| U1 | Barre laterali compatte al primo uso, comandi nelle barre (C1) | MISSING | — | e2e a 4 risoluzioni |
| U2 | Mixer compatto predefinito (C2), fader laterali backing/chitarra (C3) | MISSING | J7 | Fader agiscono sul guadagno reale |
| U3 | LCD/LED centrale con comandi contestuali (D2) | MISSING | M3 | Mostra stato, accordo, BPM, count-in |
| U4 | Cassetti Mixer/Amp/Pedals/Settings sovrapposti all'area prevista senza deformare la tastiera | PARTIAL | — | Criterio A5 della V6 su tutti i cassetti |
| U5 | Rifinitura skeuomorfica (E): legno, metallo, manopole, fader, luce, profondità, pipeline Blender | MISSING | U1–U4 | Revisione visiva a 4 risoluzioni |
| U6 | Pulizia: sovrapposizioni, scroll inutili, controlli ridondanti; accessibilità (tastiera, contrasto, screen reader) e prestazioni | PARTIAL | U1–U5 | Audit con elenco chiuso |

### F6 · QA, ottimizzazione e rilascio (priorità 6, continuo)

| ID | Attività | Stato | Dip. | Accettazione |
|---|---|---|---|---|
| Q1 | Matrice di test per requisito (unit, integration, e2e) | PARTIAL | — | Ogni riga del piano ha la sua prova |
| Q2 | Timing: test sul clock, count-in, cambi metrica, sincronia tracce | PARTIAL | M3 | Unit e misura nel browser |
| Q3 | QA audio offline: livelli, clipping, spettro dei campioni e del rig | MISSING | J1, R3 | Report in `docs/QA_REPORT.md` |
| Q4 | Regressione visiva a 1440×900, 1366×768, 1280×800, tablet | PARTIAL | — | Screenshot confrontati in CI |
| Q5 | Firefox e WebKit in CI | BLOCKED (ambiente) | — | Progetti Playwright in CI |
| Q6 | Ottimizzazione: bundle, CPU, memoria, caricamento campioni | PARTIAL | J1 | Soglie in `docs/PERFORMANCE.md` |
| Q7 | Documentazione utente e tecnica aggiornata | PARTIAL | — | README, guida, licenze degli asset |
| Q9 | PWA installabile: manifest, icone, service worker, uso offline, cache dei campioni audio (D-58) | MISSING | J1 | Installazione e avvio offline in Chromium; aggiornamento senza perdere sessione e preset |
| Q8 | Rilascio desktop definitivo come PWA (tag, release) | MISSING | tutto | **Approvazione del proprietario** |

## 4. Ordine di esecuzione (onde)

Le onde si sovrappongono; dentro un'onda i binari lavorano in parallelo. Dal 21 novembre 2026 (D-58) lo sviluppo NAM/TONE3000 è sospeso fino all'onda 5: il codice del rig esistente resta intatto e coperto dai suoi test.

1. **Onda 1 · fondamenta**: M1, M3, M4, M6 (motore) · J1, J2 (sampler e licenze) · R2, R3 (audio).
2. **Onda 2 · generazione**: M2, M5, M7, M8 · HA1, HA2, HA3 · FB1 · J3, J4 · N2.
3. **Onda 3 · laboratori completi**: FB2, FB3, HA4–HA6, AR2–AR7 · J5–J8 · R8, R9 · N1, N3–N5.
4. **Onda 4 · integrazione e interfaccia**: M9, N6 · U1–U6 · J9 · Q9.
5. **Onda 5 · NAM e chiusura**: R5, R6, R7 (NAM e TONE3000, D-58) · Q1–Q7, prova hardware del proprietario (R10), Q8 su approvazione.

Corrispondenza con il tracker precedente: A1 → M1 (base), A2 → AR5, A3 → N2/FB3, B1 → R1, B2/B3 → R2/N1, C1 → U1, C2/C3 → U2, D1 → M3/J8, D2 → U3, E → U5, F → R7, backlog registrazione/looper → fuori dalla versione definitiva salvo nuova richiesta.

## 5. Materiale audio e modelli

- **Campioni** (J2): candidati da verificare uno per uno prima dell'inclusione, con licenza e attribuzione registrate. Solo CC0, CC-BY o licenze compatibili con GPL-3.0-or-later; niente «uso personale» o licenze non commerciali. Dimensione contenuta (caricamento pigro, formati compressi). Il ripiego sintetico attuale resta.
- **Modelli NAM e IR** (R6): solo con permesso di ridistribuzione esplicito; altrimenti l'utente carica i propri file o usa TONE3000 dal suo account.
- Nessun servizio a pagamento, nessun segreto nel codice.

## 6. Decisioni e blocchi da segnalare al proprietario

- Prova con chitarra, scheda audio e cuffie reali (R10): solo il proprietario può farla.
- Chiave pubblicabile TONE3000 e modelli NAM (R5–R7): non richiesti fino all'onda 5 (D-58).
- Rilascio e tag (Q8). Il push dei tag dall'ambiente cloud è bloccato (P0-10).
- Forma del «software desktop»: **PWA installabile, approvata dal proprietario il 21 novembre 2026 (D-58)**; stack invariato, niente Electron o Tauri salvo necessità tecniche concrete. Attività Q9 (manifest, service worker, cache dei campioni, installazione) nell'onda 4.

## 7. Avanzamento

| Data | Attività | PR | Esito |
|---|---|---|---|
| 21/11/2026 | Piano e tracker | questo branch | fatto |
| 21/11/2026 | M1 · trasposizione relazionale: intervallo con la lettera, fasi Segue/Fissa (D-57) | #44 | unit + e2e; M2 resta |
| 21/11/2026 | M3 · ritmo a cicli, articolazione, attacco sul clock unico; M4 · corde e salto di corda (D-59) | #45 | unit + e2e; Arpeggios Lab e percorso su tutta la tastiera restano |
| 21/11/2026 | J2 · quattro set CC0 convertiti e registrati; J1 · sampler con caricamento pigro e ripiego sintetico (D-60) | #46 | unit sulle zone e sui manifest, e2e con segnale sui canali in Chromium; ascolto del proprietario da fare |
| 21/11/2026 | M6 · quattro livelli come dato dello studio, «Base» → Principiante, livello scelto al salvataggio (D-61) | #47 | unit + e2e della biblioteca |
| 21/11/2026 | M2 · fasi ancorate a un'altra fase con un intervallo scritto, catene, cicli segnalati (D-62) | questo branch | unit su casi da manuale e catene, e2e nell'editor |
| 21/11/2026 | HA1, HA3, HA4 (motore) · armonizzazioni delle quattro scale, voicing su gruppi di corde con tutti i rivolti, progressioni e sostituzioni, voice leading (D-63) | questo branch | unit su forme e tabelle da manuale; il laboratorio li userà nella PR successiva |
