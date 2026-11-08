# NAM — studio di fattibilità (fase futura, P4-01)

Stato: **non implementato**. Nessun codice NAM, nessun modello scaricato, nessuna modifica alla catena audio. L'amplificatore della Studio V5.7 è un dispositivo visivo e lo dichiara («Solo visivo · nessun DSP · NAM futuro»).

## Punti d'ingresso già pronti

- **Contratto UI ↔ processore**: `src/audio/ampProcessor.ts` definisce `AmpProcessor` (`setKnob`, `setPower`, `setBypass`) e `AmpProcessorStatus` (`connected`, `model`, `latencyMs`). Oggi esiste solo `NO_AMP_PROCESSOR` (no-op, `connected: false`). Il dispositivo Amplificatore (`src/ui/studio/v57/devices.tsx`) inoltra già manopole, power e bypass al contratto e mostra l'etichetta d'onestà finché `connected` è falso.
- **Posizione nel grafo audio** (`src/audio/liveInput.ts`): `source → splitter → mono → gain → analyser / worklet gtl-capture` (analisi dell'altezza, sempre sul segnale secco) e `gain → monitor → destinazione` (ascolto). Il processore va inserito solo sul ramo d'ascolto, tra `gain` e `monitor`.
- **Caricamento di un worklet**: lo schema di `gtl-capture` (modulo come testo, `Blob`, `audioWorklet.addModule`) vale anche per un modulo WASM.

## Domande per la fattibilità

1. **WebAssembly + AudioWorklet**: compilare il core NAM (C++) in WASM, eseguirlo in un `AudioWorkletProcessor` a blocchi di 128 campioni; memoria condivisa per i pesi; nessun lavoro sul thread principale.
2. **Modelli**: architetture supportate (WaveNet, LSTM), frequenza di campionamento del modello rispetto a quella del contesto (ricampionamento se diversa), dimensione dei file. Modelli caricati dall'utente da file locale (app local-first, nessun download). Licenza di ogni modello compatibile con GPL-3.0 (D-08) prima di qualsiasi distribuzione.
3. **Latenza**: latenza aggiunta dal processore sommata a `baseLatency` e `outputLatency`, già esposte nella diagnostica dell'ingresso.
4. **CPU**: tempo per blocco misurato nel worklet (budget 128/48000 s ≈ 2,7 ms), su macchine di riferimento; conteggio di xrun e glitch percepibili; consumo con l'ascolto spento (il processore va fermato).
5. **Misure**: estendere `npm run perf` (`tools/perf/perf.mjs`) con il costo del worklet.

## Vincoli che restano

Un solo clock (`TimelineScheduler`); nessun timer musicale nell'interfaccia; ascolto mai acceso automaticamente; `connected` vero solo quando l'audio passa davvero dal processore.
