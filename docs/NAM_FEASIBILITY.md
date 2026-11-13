# NAM — studio di fattibilità (P4-01)

**Superato il 13 novembre 2026.** L'inferenza NAM è implementata (D-51): motore, misure, limiti e test sono in `docs/NAM_INTEGRATION.md`.

Risposte alle domande dello studio:

1. **WebAssembly + AudioWorklet**: sì, con `neural-amp-modeler-wasm` (NAM Core in WASM a un thread dentro un AudioWorklet, senza memoria condivisa).
2. **Modelli**: A1 (WaveNet, LSTM, Linear) e A2 caricati da file locale; nessun ricampionamento.
3. **Latenza**: 0 campioni aggiunti dal motore.
4. **CPU**: misurata per modello al caricamento; con l'ascolto spento il modello non riceve segnale.
5. **Misure**: `npm run perf:nam`.
