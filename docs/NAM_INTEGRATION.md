# Neural Amp Modeler nel Guitar Rig (D-51)

Stato: **implementato, testato con segnali sintetici e modelli sintetici**. Non verificato con chitarra, scheda audio e capture reali.

Il Guitar Rig esegue modelli NAM veri nello stadio amplificatore: l'inferenza la fa NAM Core compilato in WebAssembly dentro un AudioWorklet. Non è una simulazione visiva. Il DSP interno resta e fa da ripiego.

## Motore

| | |
|---|---|
| Pacchetto | `neural-amp-modeler-wasm` 3.0.7 (TONE3000), versione fissata in `package.json` |
| Cosa si usa | solo il motore senza interfaccia, `neural-amp-modeler-wasm/engine` (`NamEngine`, `NamNode`). Il lettore React del pacchetto non è usato: la testata resta quella di Guitar Theory Lab |
| Dentro | NeuralAmpModelerCore v0.5.4 (Steven Atkinson), non modificato, in WebAssembly a un solo thread; niente `SharedArrayBuffer`, niente intestazioni COOP/COEP |
| Licenze | `neural-amp-modeler-wasm`: MIT. NeuralAmpModelerCore: MIT (porta con sé Eigen, MPL-2.0, e nlohmann/json, MIT). Compatibili con GPL-3.0-or-later (D-08) |
| Dipendenze portate | `lucide-react`, `react-knob-headless` (servono al lettore React; non entrano nel bundle perché il lettore non è importato). Peer: React 18, già presente |
| Vite | il motore trova worklet e wasm con `new URL(..., import.meta.url)`: Vite li pubblica come asset. In sviluppo il pacchetto è escluso dal pre-bundling (`optimizeDeps.exclude`) |
| Peso | bundle principale +18 kB (530 kB, 168 kB gzip). Su richiesta, solo quando si carica un modello: modulo del motore 2,3 kB, worklet 18,7 kB, wasm 415 kB (159 kB gzip) |

## Cosa fa il motore: misurato, non letto

Prove in Chromium headless sul motore 3.0.7 (13 novembre 2026).

| Domanda | Risultato |
|---|---|
| Formati A1 (un'architettura per file) | caricati ed eseguiti: WaveNet (un capture A1 pubblico e un file sintetico della taglia «standard»), LSTM, Linear. ConvNet è registrato nel motore ma **non è stato provato** |
| Formato A2 (`SlimmableContainer`) | caricato ed eseguito (un capture A2 pubblico e un file sintetico a due taglie) |
| Altri formati | rifiutati dal motore con un messaggio: architettura sconosciuta, versione del file sotto 0.5, pesi che non corrispondono all'architettura, testo non JSON |
| Ricampionamento | **nessuno**: un modello a 48 kHz in un contesto a 96 kHz o 44,1 kHz produce gli stessi campioni. Il modello gira alla frequenza dell'audio; se è diversa da quella d'addestramento il timbro cambia. L'app lo dice |
| Latenza aggiunta | **0 campioni** (impulso attraverso un modello a una presa: esce allo stesso campione) |
| Livello | se il file dichiara `loudness` il motore lo porta a −18 dB, entro ±12 dB; altrimenti nessuna normalizzazione |
| Cambio di modello | il motore analizza il file sul thread audio: l'audio si ferma per la durata (decine di millisecondi) e rientra con una dissolvenza di 1024 campioni |

I due capture pubblici (A1 e A2, dal repository del motore) sono serviti solo per queste prove locali: non sono nel repository, perché la licenza dei singoli file non è dichiarata.

## Dove sta nel grafo

```
gain d'ingresso ─┬─▶ analisi dell'altezza (segnale secco: analyser e worklet gtl-capture)
                 └─▶ rig ─▶ fader d'ascolto ─▶ uscita

rig:  PRE (comp, fuzz, overdrive, nell'ordine scelto)
      ─▶ AMPLI:  ingresso ─┬─▶ preamp DSP ───────────────▶ gate ─┐
                           └─▶ trim ─▶ modello NAM ─▶ guardia ─▶ gate ─┴─▶ toni ─▶ Output
      ─▶ CABINET (saltato se il capture lo include già)
      ─▶ POST (EQ, chorus, delay, reverb, nell'ordine scelto)
```

- Gli effetti PRE restano prima dell'amplificatore, i POST dopo il cabinet: l'ordine della catena (D-49) non cambia.
- I due motori dell'ampli si scambiano con una dissolvenza incrociata di 20 ms; non suonano mai insieme.
- **Gain** in modalità NAM è il trim d'ingresso del modello (±12 dB, zero a metà corsa). Bass, Middle, Treble e Presence lavorano dopo il modello. **Output** è il livello.
- La **guardia** è un waveshaper a curva unitaria: limita a ±1 quello che esce dal modello, così un modello rotto non manda un picco enorme in cuffia.
- **Cabinet**: l'interruttore «Il capture include il cabinet» toglie il cabinet del rig mentre il modello suona, per non simulare due casse. Al caricamento segue l'indicazione del file (`gear_type` con «cab»); poi resta all'utente, perché i metadati spesso mancano.
- **Ascolto spento**: il modello non riceve segnale (un worklet senza ingresso scrive silenzio e non costa). L'analisi continua sul segnale secco.
- Bypass e accensione dell'ampli funzionano come prima. Caricare un modello non accende mai l'ascolto.

## Quando un modello è «caricato»

`src/audio/namHost.ts`, tre passi; la testata dice «caricato» solo dopo il terzo e «attivo» solo quando il grafo lo conferma.

1. **Ispezione** (`src/app/namModel.ts`, puro): JSON valido, architettura nota, versione ≥ 0.5, pesi presenti, dimensione sotto 32 MB (guardia, non limite misurato).
2. **Prova fuori linea**: il modello viene caricato in un contesto offline e ci passa mezzo secondo di segnale. Il motore deve accettarlo e produrre campioni finiti e non muti. Il tempo di rendering misura il costo su quella macchina: sopra l'85% del tempo disponibile il modello è rifiutato come troppo pesante, sopra il 50% è caricato con un avviso. L'audio in corso non viene toccato.
3. **Caricamento nel nodo vero**: il gate si chiude, il motore carica il modello e risponde; solo allora il nodo arriva al rig.

Un file rifiutato ai passi 1 o 2 lascia in funzione il modello precedente. `rigState().ampEngine` vale `'nam'` solo con le impostazioni su NAM **e** un modello confermato nel nodo; altrimenti suona il DSP interno e l'interfaccia lo scrive.

## Persistenza

- Nelle impostazioni si salvano solo la scelta del motore (`amp.model`) e l'interruttore del cabinet (`amp.namCab`).
- Il file del modello resta in memoria per la visita. Dopo un ricaricamento la scelta NAM torna, il modello no: suona il DSP interno e la testata dice «NAM senza modello».
- I sette suoni di partenza sono impostazioni del DSP interno: sceglierne uno riporta al DSP.

## Misure (`npm run build && npm run perf:nam`)

Script: `tools/perf/nam.mjs`, risultati in `test-results/perf/nam.json`. Ambiente: container cloud Linux, Chromium 153 headless, dispositivo audio finto, 13 novembre 2026. Modelli sintetici (`src/app/namFixtures.ts`): stesse architetture e taglie dei capture reali, pesi pseudo-casuali. I numeri valgono per questa macchina.

| Misura | Linear (1 presa) | A1 WaveNet standard (13 802 pesi) | A2 (12 146 pesi) |
|---|---|---|---|
| Costo per blocco di 128 campioni, rendering offline a 48 kHz (disponibili 2 667 µs) | 5 µs | 619 µs (23%) | 355 µs (13%) |
| Analisi del modello nel motore (nodo vero) | 1 ms | 39 ms | 39 ms |
| Dal file al modello attivo, prova fuori linea compresa | 114 ms | 291 ms | 236 ms |
| Uscita dal vivo per 5 s (contesto a 44,1 kHz): eventi di underrun | 0 | 0 | 1 (10 ms) |
| Bypass e ritorno sotto segnale (3 s): underrun | 0 | 0 | 0 |
| Crescita della memoria residente del renderer al caricamento | 12 MiB | 6 MiB | 11 MiB |

| Altre misure | Valore |
|---|---|
| Latenza aggiunta dal motore | 0 campioni |
| Solo DSP interno, 5 s dal vivo | 0 underrun |
| Scambio A2 → A1 sotto segnale | 288 ms in tutto, 36 ms di analisi nel motore; 3 underrun, 30 ms |
| Modello scelto, ascolto spento, 4 s | modello non alimentato, 0 underrun |

Come leggerle: il costo per blocco viene dal rendering offline, che esegue lo stesso codice del worklet ma non sul thread audio in tempo reale: è una stima. La continuità viene da `AudioContext.playbackStats` di Chrome su un dispositivo finto; l'underrun isolato con il modello A2 non è stato attribuito (in questo ambiente non c'è una scheda audio). La memoria è la RSS dei processi renderer letta da `/proc`: grossolana, comprende i buffer delle prove; l'heap del wasm non è esposto dal motore.

## Limiti

- **Nessuna prova con chitarra, scheda audio e capture reali.** I modelli dei test non sono capture di amplificatori.
- Nessun ricampionamento: per il timbro corretto l'audio deve girare alla frequenza del modello (48 kHz quasi sempre). L'app avvisa ma non può cambiare la frequenza del dispositivo.
- Lo scambio di modello interrompe l'audio per qualche decina di millisecondi (analisi sul thread audio, scelta del motore).
- Un solo modello alla volta; taglia piena dei modelli A2 (la riduzione `slimSize` del motore non è esposta).
- ConvNet non provato. Nessuna calibrazione del livello d'ingresso in dBu.
- Il modello non viene conservato tra una visita e l'altra.
- La copia a file unico (`npm run build:single`) non contiene il motore: lì il caricamento di un modello fallisce con un messaggio e resta il DSP interno.
- Firefox e Safari non provati.

## Test

- Unit: `src/app/namModel.test.ts` (lettura dei file, rifiuti, frequenze, costo, trim), `src/app/rig.test.ts` (impostazioni, sessioni precedenti, niente file nelle impostazioni).
- E2E: `e2e/nam.spec.ts`, sette prove sul build di produzione con il motore vero: nessun download del motore prima del primo modello; A1 caricato, attivo, misurato, ritorno al DSP; linearità (metà guadagno, metà livello); A2 e cabinet incluso; file sbagliati rifiutati con motivo e modello precedente conservato; ascolto spento, bypass, accensione, rimozione; scelta salvata e modello no.
