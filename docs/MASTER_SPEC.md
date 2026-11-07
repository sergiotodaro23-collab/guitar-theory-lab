# Guitar Theory Lab — Specifica di prodotto

Fonte stabile dei requisiti. Riassume la direttiva del proprietario (Sergio Todaro, novembre 2026). Lo stato reale è in `PROJECT_STATE.md`, l'ordine di lavoro in `docs/ROADMAP.md`, le scelte in `docs/DECISIONS.md`.

Gerarchia: decisioni recenti del proprietario → questa specifica → codice e test verificati → documentazione storica → proposte non approvate. Il comportamento attuale del codice non prevale sui requisiti.

## 1. Prodotto

Laboratorio gratuito e open source per lo studio della chitarra elettrica, nel browser, senza backend. **Desktop-first** (direttiva del 7 novembre 2026): computer o laptop, chitarra elettrica, scheda audio USB, cuffie o monitor, eventualmente controller MIDI. Tablet e telefono restano supportati senza condizionare il desktop. Non è una DAW né un visualizzatore di scale. Nessun paywall; donazioni eventuali non sbloccano funzioni.

Quattro workspace: **Fretboard Lab**, **Harmony Lab**, **Arpeggios Lab**, **Jam Studio**. Lo stato musicale sopravvive al cambio di workspace.

## 2. Motore musicale (moduli puri, senza DOM)

- Note, pitch class, intervalli, enarmonia e spelling con la lettera.
- Scale: maggiore, minore naturale, armonica, melodica (classica: sale melodica e scende naturale; jazz: uguale nei due sensi), modi della maggiore, pentatoniche, blues, relative, trasposizione, scale personalizzate.
- CAGED con le cinque forme; 3NPS con sette pattern sulle scale eptatoniche. Forme teoriche, non posizioni arbitrarie.
- Accordi: triadi, settime, 9/11/13, alterazioni, sus, add, slash, rivolti, basso indipendente, personalizzati, Chord Builder.
- Distinzione rigorosa: insieme teorico delle note → arpeggio → voicing concreto sulla tastiera.
- Chord tones, guide tones, tensioni, avoid notes contestuali (profilo dichiarato, mai verità assoluta).
- Tastiera: 6 corde, tasti 0–24, standard E–A–D–G–B–E, accordature alternative e personalizzate.

## 3. Più scale e più accordi

- Fino a 5 scale: scala principale + `+ Aggiungi scala`, lista espandibile; per ognuna tonica, tipo, posizione, visibilità, colore, opacità, modifica, rimozione, riordino. Al massimo due visibili all'inizio, altre in overlay con regole di leggibilità.
- Fino a 8 accordi: accordo principale + `+ Aggiungi accordo`; visibilità e selezione indipendenti; riusabili in progressioni, esercizi e Jam.
- Niente toggle statici numerati (S1–S5, 1–8).
- Sovrapposizioni leggibili anche quando le scale condividono note: forme e contorni distinti, non solo piccoli punti colorati, senza nascondere il nome della nota.
- **Configurazione per singolo accordo della progressione** (in gran parte realizzata, D-26): ogni accordo porta le sue scale, arpeggi, layer, colori, forme, visibilità, posizioni e intervalli di tasti, target e guide tones, comportamento in riproduzione (es. ii–V–I: Dm7 solo arpeggio, G7 misolidio più un layer, Cmaj7 arpeggio e guide tones). La tastiera cambia con l'accordo attivo, in manuale e in automatico. Un solo modello dati per Harmony, Arpeggios e Jam, salvabile e riutilizzabile; per configurazione al massimo 5 scale e 8 layer, non tutti visibili per forza.

## 4. Exercise Engine

- Intervalli dalla seconda all'ottava, diatonici e cromatici, sequenze di terze…settime, intervalli personalizzati, permutazioni, salti, pattern su scale e arpeggi, più corde, cambi di posizione, CAGED e 3NPS, direzione su/giù/alternata, esercizi misti, suddivisioni, ripetizioni definite o continue, range di tasti, preset, target notes, feedback audio dove attendibile.
- **Percorsi differenziati nella stessa scala**: ogni fase ha forma, posizione e direzione proprie (es. Do maggiore, forma C in salita, forma G in discesa, ripeti). Anche: maggiore su / relativa minore giù, melodica su / naturale giù, terze con cambi di posizione, arpeggi concatenati sulla progressione.
- Esercizi come dati dichiarativi serializzabili. Pattern generati dal motore, mai inventati. Combinazioni impossibili o ambigue: mostrare il problema e un'alternativa corretta.

## 5. Editor avanzato

Pulsante `Apri editor avanzato` nel pannello Esercizio → workspace ampio sovrapposto (dialog), sfondo preservato e oscurato, margini generosi. Blocchi aggiungibili, modificabili, eliminabili, riordinabili. Tipi iniziali: scala, pattern/forma, direzione, posizione, range di tasti, sequenza intervallare, cambio scala/accordo, suddivisione, ripeti, termina. Anteprima di fasi, note, pattern, posizione, direzione, transizioni, tempo, ripetizioni. Salva, annulla, chiudi; Escape, gestione del focus, scorrimento indipendente, versione responsive a pannelli o step. Nessun linguaggio di programmazione musicale nella prima versione.

## 6. Workspace

- **Fretboard Lab**: esplorazione, scale e accordi, CAGED/3NPS, etichette, layer, esercizi, note live, preset. Tastiera con priorità visiva, pannelli comprimibili.
- **Harmony Lab**: interscambio modale e configurazione per accordo come parte centrale; progressioni modificabili, gradi e funzioni, diatonici e non, dominanti secondarie e sostituzioni, chord/guide tones, tensioni e risoluzioni, voice leading, note comuni, target notes, Harmonic Context Switch manuale o automatico, ascolto, preset. Accordo attivo sempre riconoscibile.
- **Arpeggios Lab** (livello dell'editor avanzato): triadi maggiori, minori, diminuite, aumentate; maj7, m7, 7, mMaj7, m7♭5, dim7; sus, add, seste, none, estensioni, alterati e slash supportati dal motore. Forme lungo il manico, CAGED dove pertinente, una, due o tre ottave solo se fisicamente realizzabili, cambi di posizione, salti di corda, sweep, salita e discesa con percorsi diversi, partenza da qualsiasi grado, collegamenti tra arpeggi, voice leading e target. Distinguere note teoriche, sequenza musicale, posizioni sulla tastiera e diteggiatura suggerita; editor a fasi con ripetizioni, BPM, suddivisioni, direzioni, anteprima, percorsi concatenati sulla progressione. Inoltre: arpeggi per accordo, direzioni, pattern personalizzati, rivolti, posizioni, collegamenti, passaggi di corda, guide tones, target notes, voice leading, arpeggi su progressioni, sincronizzazione, preset. Struttura teorica, pattern e diteggiatura separati.
- **Jam Studio**: progressioni, tonalità, trasposizione, BPM, metrica, swing, generi (rock, blues, jazz, funk, fusion, metal, latin, ambient), batteria, basso, strumenti armonici, tracce, mixer, mute/solo, fill, cambio pattern in riproduzione, loop, drone, preset, MIDI eventuale. Almeno quattro pattern per strumento/genere dove ha senso. Jam pronta senza arrangiare.
- **Jam Studio, evoluzione per fasi**: A) groove, swing, accenti, velocity, bilanciamento, basso e comping più musicali, Fusion credibile senza copiare registrazioni protette, sincronia nei cambi; B) più kit e timbri (acustici ed elettronici, basso più realistico, comping per genere), campioni originali o con licenza compatibile e leggeri; C) arrangiamenti: intro, strofa, ritornello, bridge, outro, variazioni A–D, fill, transizioni, dinamiche, mute, solo, preset musicali; D) backing track audio locali dell'utente, mai caricate su server senza scelta esplicita: riproduzione sincronizzata, mappa di accordi e sezioni, loop, volume, stem se presenti, scale e arpeggi sincronizzati (time-stretch, separazione degli stem e analisi armonica automatica in seguito).
- **Drum step sequencer** (solo in Jam Studio): 16 step, kick/snare/hi-hat e altri, accenti, velocity, swing, pattern A–D, fill, sync. Modalità Simple (preset, griglia essenziale) e Advanced (velocity dettagliata, ghost, probability, 32/64 step, piano roll). Solo campioni originali o con licenza compatibile.

## 7. Tempo e audio

- Un solo transport: play/pausa/stop, BPM, TAP, metrica, swing, suddivisioni, accenti, timbri del click (almeno 4), volume click. Nessun timer UI come clock musicale. Cambi BPM e metrica senza desincronizzazioni.
- **Click / Accenti**: griglia a 16 indicatori, distinta dal sequencer, tutti visibili (anche 2×8). Metrica e pattern di accenti distinti.
- Loop: ripetizione di esercizi, progressioni e pattern; niente looper audio generico (futuro).
- Catena: `Guitar Input → Direct Signal → Pitch Analysis → Optional Amp Processing → Monitoring → Output`. Gain di ingresso, monitoring, click, jam, master separati; DI per l'analisi. Permessi, dispositivi, errori. Mai monitoring automatico che possa creare feedback.
- **Live Monitor**: avvio/stop, ingresso, livello, gain, pitch, frequenza, confidenza, marker rosso con fade sull'ampiezza, target, feedback dove affidabile, calibrazione. Un segnale monofonico dà il pitch, non corda e tasto: distinguere pitch, posizioni possibili, probabile, guidata dal contesto.
- **Live Monitor 2.0** (D-25, prima della beta stabile): la forma selezionata è solo un indizio debole per la posizione; incertezza mostrata quando la stima non è affidabile; risposta a legati e passaggi veloci; sensibilità Precisa / Bilanciata / Rapida con parametri documentati; calibrazione guidata e profili per strumento (chitarra, pickup, scheda e canale, livello, rumore, sensibilità, stabilizzazione, latenza). Ascolto DI, mixer e amp modeling sono tre livelli distinti: un suono pulito non è un guasto.
- **Live Monitor avanzato**: tracciamento più stabile, meno falsi cambi, note brevi e rumore, persistenza e dissolvenza dei marker, posizione probabile presentata come stima con le altre posizioni riconoscibili. **Calibrazione** guidata ed empirica, con regolazione manuale: distinguere latenza di acquisizione, di analisi, di ascolto e la compensazione per il riscontro sugli esercizi; mai presentare come misurato ciò che il browser non espone.
- **Polifonia**: solo come studio sperimentale (DSP o ML, prototipi isolati, misure di precisione, CPU, memoria, latenza). YIN è monofonico: nessuna promessa di riconoscimento degli accordi.
- **Tuner** sulla stessa pipeline: nota, frequenza, cent, riferimento configurabile, stabilità, accordature configurate, segnale debole.
- **Amp modeling**: studio di fattibilità (NAM WASM, AudioWorklet, IR, alternative, TONE3000 come catalogo eventuale). PoC isolata, misure, licenze, sicurezza token. Niente servizi a pagamento, credenziali nel codice o pulsanti finti. Bypass e monitoring pulito sempre.

## 8. UX/UI

- **Due aspetti permanenti** (direttiva UX finale, novembre 2026), selezionabili da `Aspetto` con preferenza salvata: **Semplificata** (la console antracite con accenti arancioni, ottimizzata per smartphone) e **Studio** (banco da lavoro iperrealistico: composizione della variante A, materiali fotografici, post-it Scale/Chords/Exercise, telefono con tutor, legenda su post-it). Studio predefinita su desktop e tablet, Semplificata obbligatoria su smartphone verticale; senza scelta esplicita vale la regola del dispositivo. Stessi stato, dati e funzioni. Breakpoint per dimensione, mai per user-agent.
- Direzione: **Physical Guitar Workbench A**, skeuomorfismo realistico professionale (riferimenti: plugin audio, hardware da studio, pedali, amplificatori). Legno, metallo, plastica stampata, carta ed etichette, manopole, fader, incisioni, viti, LED, ombre coerenti. Niente cartoon, retrofuturismo, usura decorativa. Nessun asset proprietario copiato.
- Targhetta: `GUITAR THEORY LAB` / `v[versione reale] — by Sergio Todaro`, fisica, applicata o incisa.
- Navigazione a quattro modalità, compatta, senza perdita di configurazione.
- Transport superiore (play/pausa/stop, BPM, TAP, metrica, swing, click style, Click/Accenti, Tuner, Live Monitor, Amp). Mixer laterale (click, monitor, gain, livelli, mute, master, jam). Tastiera centrale in legno credibile, **celle regolari**, 24 tasti leggibili e cliccabili come i primi.
- Barra etichette (note, gradi, funzioni, dita, intervalli, nessuna) separata dai layer (scale, accordi, arpeggi, esercizio, live, target/funzioni).
- Legenda grande, in basso a destra, adattata ai layer, con forme e bordi oltre ai colori.
- Pannelli Scale, Chords, Exercise comprimibili; estetica cartacea con controlli moderni e accessibili.
- Progressive disclosure senza togliere funzioni.
- **Tutor**: dentro un iPod Touch di prima generazione credibile, lievi segni d'uso, chiudibile, minimizzabile, riposizionabile, mai stabilmente sopra la tastiera. Personaggio originale in pixel art (riferimento di linguaggio: Otaclock), chitarrista con capelli lunghi; animazioni idle, saluto, spiegazione, suggerimento, feedback positivo, errore. Modalità Silent, Contextual, Tutor; regole locali deterministiche, nessun servizio AI a pagamento. Nessun asset Konami.
- **Layout desktop** (realizzato in D-24 da 1200 × 720): barra del trasporto sempre visibile; tastiera principale sempre in vista durante lo studio; scale, accordi, esercizi e pannelli secondari scorrono per conto loro; i cambi di contenuto non spostano gli elementi principali; funziona anche con finestre desktop piccole. Gerarchia chiara tra elementi fissi e contenuti scorrevoli, non decine di pannelli fissi.
- Responsive: 1440×900, 1280×800, tablet orizzontale, viewport piccoli; modalità Studio, Workbench, Focus. Stati hover/active/pressed/selected/muted/disabled/focus, tooltip, tastiera, contrasto, touch target, reduced motion, screen reader.

### 8.1 Requisiti per il redesign definitivo (Claude Design, dopo le funzioni)

- Trasporto: play e pausa con simboli standard, stop, reset distinto da stop, stato sempre riconoscibile.
- Tempo: BPM su un display LED dedicato, senza controlli ridondanti; il display principale può mostrare informazioni di contesto.
- Tastiera: sempre leggibile e visibile, marker grandi come nella Semplificata, layer riconoscibili per colore e forma, legenda stabile, scelta delle informazioni da mostrare.
- Telefono e tutor in Studio: tutor contestuale, anteprima dell'accordo, della scala o dell'arpeggio successivo, mini-tastiera di 12–15 tasti, nascondibile, riducibile o ruotabile; l'anteprima è configurabile e non interferisce con la tastiera principale.

## 9. Qualità e open source

- Test musicali (mapping 0–24, accordature, enarmonia, trasposizioni, scale, CAGED, 3NPS, accordi, slash, voicing, arpeggi, intervalli, permutazioni, progressioni, target, sequenze, transizioni tra forme, su/giù con pattern diversi, durate, sync) e di interfaccia (Vitest, Playwright su Chromium, Firefox, WebKit nei limiti dell'ambiente). Test sintetici distinti dalle prove con hardware. Mai dichiarare superato un test non eseguito.
- LICENSE, README, CONTRIBUTING, CI, segreti, audit dipendenze, licenze di campioni e modelli. Licenza definitiva da approvare dal proprietario.
- Branch di sviluppo, commit piccoli. Niente cambi di visibilità, riscritture di storia, force push o release senza autorizzazione.

## 10. Definition of Done

Implementata; funziona nel flusso previsto; musicalmente corretta; nessun controllo decorativo; errori gestiti; test pertinenti verdi; nessuna regressione nota; documentata; accessibile nei limiti del componente; coerente con la UX prevista. Per l'audio: dispositivi e piattaforme realmente verificati. Ogni voce distingue: implementato, testato con segnali sintetici, verificato con hardware reale, parziale, mancante.
