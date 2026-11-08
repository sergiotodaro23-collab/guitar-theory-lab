# QA report

## Audit del 6 novembre 2026

Ambiente: container cloud Linux, Node 22.23, npm 10.9, Chromium headless (Playwright 1.63). Firefox e WebKit non installati.

### Repository

- Branch `main` (3b3c314) e `claude/serene-hopper-ubi687`; nessuna PR; nessun tag sul remoto (il `v0.1.0` citato nei documenti non è stato pubblicato).
- CI: workflow `ci.yml` eseguito una volta su `main`, esito verde.
- Licenza: all'audit `UNLICENSED`, senza `LICENSE` né `CONTRIBUTING`. Risolto con GPL-3.0-or-later (D-08).
- Segreti: nessuno nel codice né nella CI.
- Deployment: nessuna configurazione di pubblicazione (Pages o simili). Non eseguito.

### Verifiche eseguite

| Verifica | Risultato |
|----------|-----------|
| `npm run check` (lint, types, 170 test unitari, build) | Verde |
| `npm run test:e2e` (18 casi su build di produzione, Chromium) | Verde |
| Mapping 0–24, forme entro 24 tasti, 17 toniche | Verde |
| Percorsi a fasi (C su / G giù, melodica classica, 3NPS, validazioni, JSON) | Verde |
| Editor: apertura, modelli, aggiunta, riordino, eliminazione, alternativa a un errore, Escape, applica, riproduzione con cambio di forma | Verde (e2e) |
| Editor a 820 px senza overflow orizzontale | Verde (e2e) |
| Vista per accordo (D-26): scala suggerita per 7 famiglie; ii–V–I in Do configurato dall'interfaccia in Studio e Semplificata — Dm7 solo arpeggio (D F A C), G7 Sol misolidio (7 note), Cmaj7 arpeggio con focus guide tones (Mi e Si accesi, Do e Sol attenuati); la tastiera segue l'accordo scelto a mano e quello che suona in riproduzione automatica; arpeggio sovrapposto G7 con voce in legenda; salvataggio dopo ricarica; Jam Studio legge la stessa vista; interruttore generale | Verde (unit + e2e); 331 unit, 70 e2e. Solo Chromium |
| Pannello Accenti con un font di sistema più largo (DejaVu Sans forzato, il caso del runner CI su `main` dopo PR #7 e #8): il tasto va a capo, il pannello resta dentro la finestra, il tasto non cambia larghezza quando il pattern diventa personale. Causa: sul runner CI la larghezza del testo era diversa da quella locale (i font sono inclusi, ma caricamento e rendering variano tra macchine) e il pannello era allineato al tasto; ora pende dal trasporto | Verde (e2e); 331 unit, 72 e2e. Solo Chromium |
| Arpeggios Lab avanzato (D-27): 3 ottave di Cmaj7 dal tasto 8 in entrambi gli aspetti (13 note disegnate su più di 8 tasti, dita 1–4 dal motore, le prime 13 note suonate salgono di 36 semitoni), 3 ottave di Sol dal tasto 15 rifiutate (opzione disattivata) e accettate dal tasto 3, sweep di La su 5 corde (6 note, una per corda + girata), salto di corda (tre corde alterne), ritorno su strada diversa (più posizioni disegnate), progressione con CAGED e target sulla terza a ogni cambio. Unit: altezze, posizioni, dita, null per forme impossibili, 9 qualità su due ottave | Verde (unit + e2e); 358 unit, 78 e2e. Solo Chromium. Diteggiatura verificata contro regole, non da un chitarrista |
| Jam fase A (D-28): pulsazione dei piatti, nota fantasma (`g`, velocity 0,3), kit vecchi senza ride, comping ad anticipi (G7 sull'e del quattro, nessun colpo sul battere) e a colpi brevi, anticipo del basso tenuto oltre la stanghetta, Fusion (groove lineare, fantasmi), Jazz sul ride, tutti i generi in 4/4, 3/4 e 6/8 a tempo; e2e: Fusion su ii–V–I con accordi e basso a 1680 e non a 1920, ciclo dei passi con il fantasma, Jazz con ride e fader batteria a 0,5 | Verde (unit + e2e); 370 unit, 79 e2e. Solo Chromium. Il suono non è stato giudicato all'ascolto: serve l'orecchio del proprietario |
| Vista per accordo completata (D-29): G7 sui tasti 12–15 (scala e arpeggio solo lì), intervallo ordinato e limitato a 12 tasti, viste vecchie con 5–9, arpeggio sovrapposto color rosa in legenda e sulla tastiera, esercizio che segue la vista: durante G7 solo note del Sol misolidio dai tasti 12–15, Dm7 senza vista con l'esercizio generale; interruttore spento → esercizio unico | Verde (unit + e2e); 374 unit, 80 e2e. Solo Chromium |
| Interscambio modale (D-30): numerali (ii7, V7, viiø7, iv, ♭VII7, ♭VImaj7, ♭IIImaj7, vii°7), modi sui gradi diatonici, Fm7 da Do eolio → Fa dorico, B♭7 → misolidio, A♭maj7 e D♭maj7 → lidio, A7 = V7/ii, D7 = V7/V, E7 con ♭9 ♭13, Emaj7 cromatico; in La minore E7 dalla minore armonica, F♯m7♭5 dal dorico. e2e in entrambi gli aspetti: tabella, tastiera che passa a Fa dorico su Fm7, vista per accordo che parte da Fa dorico; ♭VI e ♭VII7 diventano diatonici leggendo in Do eolio | Verde (unit + e2e); 390 unit, 83 e2e. Solo Chromium |
| Live Monitor 2.0 (D-31), **solo segnali sintetici**: sedicesimi legati a 120 BPM (16 note, due ottave): Rapida 16/16 e 0 spurie, Bilanciata 11/16, Precisa 0/16; nota tenuta con vibrato ±15 cent: Precisa una nota; ripercussione in Rapida riconosciuta come nuovo attacco; stima della mano: nessuna posizione con nota isolata, forma usata come indizio con contesto, la stima segue la mano fuori dalla forma, dimentica dopo una pausa; calibrazione: rumore, note, attacchi di un take sintetico, latenza da click, profili sanificati; e2e: procedura completa con WAV come microfono e profilo dopo ricarica, A3 ripetuto che si assesta nella forma | Verde (unit + e2e); 406 unit, 84 e2e. Non provato con chitarra e scheda reali |
| Timbri della jam (D-32): ogni kit ha un suono per ogni pezzo, ricette di basso e accordi ben formate, strumming della chitarra pulita, suoni proposti dai generi; e2e: Ambient → elettronico/synth/pad, Jazz → spazzole/contrabbasso, ognuno dei cinque suoni d'accordo produce segnale con batteria, basso e click muti | Verde (unit + e2e); 410 unit, 85 e2e. Il timbro non è stato giudicato all'ascolto |
| Arrangiamenti (D-33): sezioni in fila con ripetizioni, groove per sezione, fill sull'ultima battuta, dinamica, parti spente senza eventi, nota bassa degli accordi quando il basso tace, modelli e sanificazione; e2e in entrambi gli aspetti con il modello "studio" su ii–V–I (battute 1–4 senza basso né accordi, 5–8 senza accordi, poi la band intera) e solo nel mixer (batteria sola suona, basso solo spento = silenzio) | Verde (unit + e2e); 415 unit, 88 e2e |
| Backing track (D-34): secondi per tick in 4/4 e 6/8, punto di lettura a partire dalla battuta 3, loop di quattro battute, tap tempo, sanificazione; e2e con una traccia di click sintetica a 120 BPM e battuta 1 a 0,5 s: avvio esatto a 0,5 s, loop 0,5–8,5 s, segnale udibile con la band muta, pausa e ripresa dal punto del trasporto, file ancora disponibile dopo il ricaricamento | Verde (unit + e2e); 420 unit, 89 e2e. Non provato con musica vera |
| CI rosso sulla PR #10 (solo GitHub): a 1280×720 Semplificata, con il testo più largo del runner, intestazione e trasporto andavano a capo e i pannelli restavano 92 px. Ora da 1200 px intestazione e trasporto non vanno a capo (LCD e targhetta si stringono, tasti di modalità più stretti fra 1200 e 1399 px), in entrambi gli aspetti. e2e nuovo con DejaVu Sans forzato: Semplificata 158 px, Studio 141 px di pannelli | Verde; 420 unit, 91 e2e |
| Fasi arpeggio (D-35): Dm7 in Re dorico forma E (solo D F A C, in salita dal Re più basso), E7 in Do maggiore con avviso e G# scritto come tale, accordo illeggibile con correzione, modello ii–V–I a fasi sul battere e salvataggio; e2e: modello dall'editor, correzione "Usa Dm7", prima battuta solo D F A C | Verde; 424 unit, 92 e2e |
| Accordature e intervalli (D-36): preset e personalizzata, accordature non valide scartate, Drop D con Re a vuoto sulla sesta e forma E fatta di posizioni reali della corda riaccordata, esercizio generato; etichette intervallo su Dm7 e sulla scala; e2e in entrambi gli aspetti: Mi → Re → Do# a vuoto sulla sesta corda, etichetta 7M | Verde; 428 unit, 94 e2e |
| Latenza e MIDI (D-37): nota attesa all'istante meno la latenza, giudizio giusto/ottava/diverso, storia accorciata; messaggi MIDI (note, velocity 0, CC, Start/Continue/Stop); e2e con dispositivo MIDI simulato: A3 al Live Monitor e sulla tastiera, Start avvia, pedale mette in pausa, Stop ferma | Verde; 433 unit, 95 e2e. Nessun hardware MIDI reale |
| AudioWorklet (D-38): i test con WAV come microfono passano sul nuovo percorso (diagnostica "AudioWorklet"), calibrazione compresa | Verde; 433 unit, 95 e2e. Solo Chromium |
| Layout desktop (D-24): 1920 × 1080, 1440 × 900, 1366 × 768, 1280 × 720 in Semplificata e Studio: pagina ferma, trasporto e tastiera interamente in vista, area pannelli scorrevole ≥ 140 px, nessun controllo del trasporto fuori posto o coperto (questo controllo ha trovato il tasto Accenti coperto dal telefono a 1280, corretto), nulla si muove scorrendo, cambiando workspace o durante 1,2 s di riproduzione; Accenti sovrapposto senza spostare nulla; ridimensionamento; a 1100 × 680 la pagina scorre e il trasporto resta in alto | Verde (e2e); 314 unit, 67 e2e. Solo Chromium; non provato su schermi HiDPI reali né con zoom del browser |
| Correzioni dalla prova con chitarra reale (D-22), sintetico: con un WAV di note e silenzi, 25 campioni in 3 s senza spostamenti di tastiera, legenda, pannelli dell'ingresso, accordatore, trasporto né altezza della pagina (Studio e Semplificata); livello reale all'uscita nullo ad ascolto spento, presente acceso, nullo con Chitarra o Master a zero, ascolto spento dopo un riavvio; due scelte manuali nello stesso movimento → un solo cambio, all'ultima; N N avanza di due; in automatico la striscia spiega il blocco senza spostarsi; scheduler: una sola one-shot per id | Verde (unit + e2e); 314 unit, 56 e2e. **Da riverificare con chitarra e scheda reali**: in particolare l'ascolto |
| Ingresso chitarra (D-21), sintetico: YIN entro 3 cent da 73 a 1319 Hz, fondamentale debole, rumore, silenzio; e2e con WAV come microfono: La2 → 5ª corda intonata, A2 in 2 posizioni sulla tastiera; Sol3 +12 cent → crescente, con La = 442 circa +4; La3 → modalità cromatica e posizione probabile dalla forma mostrata; ascolto mai acceso da solo; permesso negato spiegato; in Studio e Semplificata | Verde (unit + e2e); 313 unit, 50 e2e. **Nessuna prova con chitarra e interfaccia reali**: latenza, rumore di linea, corde smorzate e accordi non verificati |
| Generi e basso (D-20): il genere imposta ritmo degli accordi, swing (67% sul controllo), groove e linee di basso; tempo suggerito applicato a richiesta; sulla ii–V–I la walking line suona 4 note nella prima battuta e chiude a un semitono dalla fondamentale successiva; basso spento senza note; 5 canali e meter dentro il mixer in entrambi gli aspetti | Verde (e2e); 294 unit, 45 e2e. Solo Chromium; basso e groove non ascoltati da un orecchio umano |
| Step sequencer Jam (D-19): pattern A sul tempo (rullante sui movimenti 2 e 4), modifica in riproduzione che entra solo alla stanghetta successiva e dopo la coda già programmata, cambio a D, spegnimento, fill solo nell'ultima battuta, ciclo dei passi, tastiera, 3/4 con 12 passi attivi, batteria assente fuori da Jam, 2×8 su telefono senza overflow; in Studio e Semplificata | Verde (e2e); 282 unit, 41 e2e. Solo Chromium; kit non ascoltato da un orecchio umano |
| Click / Accenti (D-18): 16 passi, attivi secondo metrica e suddivisione (4/4, sedicesimi, 6/8), ciclo dei livelli, tastiera, ritorno alla metrica, livelli consegnati all'audio uguali al pattern durante la riproduzione, timbro Legno; 2×8 visibili su telefono senza overflow; in Studio e Semplificata | Verde (e2e); 271 unit, 36 e2e. Solo Chromium; timbri non ascoltati da un orecchio umano |
| Direttiva UX finale (D-16, D-17): barrette dei tasti visibili in entrambi gli aspetti (24 rettangoli con larghezza e riempimento, contrasto sui pixel contro il legno, anche a 390×844); Studio predefinita a 1280×800, Semplificata obbligatoria a 390×844 con preferenza conservata, Studio disabilitata a 844×390; stato invariato al cambio in riproduzione; nessun overflow in 4 modalità × 7 formati; manopole, fader, mute e schede da tastiera; tutor (tre modalità, testo dal motore, riduzione); legenda adattiva; contrasto WCAG ≥ 4,5:1 in entrambi gli aspetti (corretto il parsing dei colori esadecimali nel test, prima inaffidabile); trasporto del telefono in basso | Verde (e2e); 262 unit, 33 e2e. Solo Chromium |
| Aspetti Semplificata/Studio: stato invariato al cambio durante la riproduzione; Semplificata forzata a 390×844, Studio disabilitato a 844×390, ripristinato a 768×1024 e 1280×800; nessun overflow in 4 modalità × 6 formati; manopole, fader e schede da tastiera; contrasto WCAG ≥ 4,5:1 in Studio; frecce della tastiera su telefono | Verde (e2e); 249 unit, 29 e2e dopo il blocco |
| Arpeggios Lab: solo note dell'accordo nella posizione, rivolto dalla terza, arpeggi collegati sulla progressione | Verde (e2e); 238 unit, 22 e2e dopo il blocco |
| Cambio di metrica in riproduzione: 4/4 → 3/4 → 6/8 a 120 BPM, click a 0,5 s esatti, nessun doppione, luci aggiornate alla stanghetta | Verde (e2e); 226 unit, 21 e2e dopo il blocco |
| Accordi multipli: builder, slash/rivolto, forma sulla tastiera, selezione, riordino, invio a Harmony Lab | Verde (e2e); 218 unit, 20 e2e dopo il blocco |
| Scale multiple: aggiunta fino a 5, confronto, visibilità, riordino, rimozione, ricarica pagina | Verde (e2e); 181 unit, 19 e2e dopo il blocco |
| Ispezione visiva a 1440×900 e 820×1000 | Controllata su screenshot |
| `npm audit --omit=dev` | 0 vulnerabilità |
| `npm audit` (dev) | 10 (8 moderate, 2 critiche) nella catena Vitest 3 (`tinypool`, `@vitest/mocker`, `minimatch`). Solo strumenti di sviluppo; la correzione richiede Vitest 4 (major). Da pianificare. |

### Problemi aperti trovati durante i test

- `Field` avvolge i controlli in un `<label>`: quando dentro ci sono più pulsanti (i gruppi `Segmented`), l'etichetta si associa solo al primo. Corretto per il selettore delle forme degli accordi; da correggere in tutto il componente.

### Non verificato

- Firefox e Safari/WebKit: browser non disponibili nell'ambiente (P0-09).
- Ascolto reale, latenza di casse e cuffie, chitarra in ingresso: nessun hardware audio.
- Lettori di schermo: solo attributi ARIA controllati nel codice, nessuna prova con NVDA/VoiceOver.

### Divergenze principali dalla specifica

1. Interfaccia in tema scuro "neon", lontana dallo skeuomorfismo realistico richiesto (P2-02). Prototipo "Workbench" disponibile come tema opzionale.
2. ~~Tre workspace su quattro: manca Arpeggios Lab.~~ Risolto (P1-12).
3. Scale e accordi multipli assenti o limitati (seconda scala solo in Jam, un accordo sovrapposto).
4. Nessun input chitarra: niente pitch detection, Live Monitor, Tuner.
5. Jam con sola traccia di comping; nessuna batteria, basso o step sequencer.
6. ~~Cambio di metrica ferma la riproduzione.~~ Risolto (P0-08).
7. Accordature solo standard.

### Problemi risolti in questo blocco

- Tastiera limitata a 22 tasti con celle decrescenti → 24 tasti, celle uniformi.
- Targhetta senza versione né autore → `GUITAR THEORY LAB / v0.1.0 — by Sergio Todaro` dalla versione reale.
- Esercizi limitati a una forma e una direzione → percorsi a fasi con editor avanzato.
- Minore melodica ambigua → "jazz" come scala, "classica" come percorso.
