# NAM — studio di fattibilità (fase futura, P4-01)

Stato: **inferenza NAM non implementata**. Nessun modello scaricato. Dal D-42 esiste il Guitar Rig con una testata DSP interna (non NAM) e la sua UI: il modello NAM andrà nello stadio `amp` già pronto.

## Punti d'ingresso già pronti

- **Stadio d'innesto**: `amp` in `src/audio/guitarRig.ts` (percorsi secco/bagnato, power e bypass già gestiti). Oggi contiene il preamp interno (`WaveShaperNode` con `softClipCurve` e tone stack di `BiquadFilterNode`). Un `AudioWorkletNode` con il modello NAM sostituirebbe il waveshaper, lasciando o no il tone stack dopo di sé.
- **Impostazioni**: `AmpModel` in `src/app/rig.ts` vale oggi solo `'internal'`; un valore `'nam'` con il nome del file del modello abiliterebbe il nuovo percorso. Il file del modello va scelto dall'utente come i file IR del cabinet (`liveInput.loadCabinet` è lo schema), tenuto in memoria.
- **Posizione nel grafo audio** (`src/audio/liveInput.ts`): `source → splitter → mono → gain → analyser / worklet gtl-capture` (analisi, sempre sul segnale secco) e `gain → rig → monitor → destinazione` (ascolto).
- **Caricamento di un worklet**: lo schema di `gtl-capture` (modulo come testo, `Blob`, `audioWorklet.addModule`) vale anche per un modulo WASM.
- **UI**: la testata del Guitar Rig mostra «DSP interno · modello NAM: fase P4-01»; l'etichetta va cambiata solo quando l'audio passa davvero dal modello.

## Domande per la fattibilità

1. **WebAssembly + AudioWorklet**: compilare il core NAM (C++) in WASM, eseguirlo in un `AudioWorkletProcessor` a blocchi di 128 campioni; memoria condivisa per i pesi; nessun lavoro sul thread principale.
2. **Modelli**: architetture supportate (WaveNet, LSTM), frequenza di campionamento del modello rispetto a quella del contesto (ricampionamento se diversa), dimensione dei file. Modelli caricati dall'utente da file locale (app local-first, nessun download). Licenza di ogni modello compatibile con GPL-3.0 (D-08) prima di qualsiasi distribuzione.
3. **Latenza**: latenza aggiunta dal processore sommata a `baseLatency` e `outputLatency`, già esposte nella diagnostica dell'ingresso.
4. **CPU**: tempo per blocco misurato nel worklet (budget 128/48000 s ≈ 2,7 ms), su macchine di riferimento; conteggio di xrun e glitch percepibili; consumo con l'ascolto spento (il processore va fermato).
5. **Misure**: estendere `npm run perf` (`tools/perf/perf.mjs`) con il costo del worklet.

## Vincoli che restano

Un solo clock (`TimelineScheduler`); nessun timer musicale nell'interfaccia; ascolto mai acceso automaticamente; `connected` vero solo quando l'audio passa davvero dal processore.
