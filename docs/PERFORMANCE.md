# Prestazioni (P0-15)

Misure leggere e riproducibili, senza servizi esterni: `npm run build && npm run perf` (script in `tools/perf/perf.mjs`, risultati in `test-results/perf/perf.json`). I numeri dipendono dalla macchina: confronta esecuzioni sulla stessa.

## Cosa misura

1. **Analisi dell'altezza** (Node, un thread): millisecondi di YIN per frame in ogni modalità di sensibilità, e quota di un core alla cadenza della modalità.
2. **Caricamento** (Chromium headless, build di produzione): DOMContentLoaded, load, KiB trasferiti.
3. **Sotto carico** (8 s): Jam Studio con ii–V–I, Fusion, arrangiamento "canzone", viste per accordo con arpeggi sovrapposti, 160 BPM. Durata dei frame (mediana, p95, massimo, frame oltre 50 ms), tempo CPU del renderer (CDP `TaskDuration`) e degli script, heap JS, nodi DOM, ritardo fra suono programmato e aggiornamento dello schermo.

## Ultima esecuzione (ambiente cloud, container Linux, Chromium headless; 7 novembre 2026)

| Misura | Valore |
|---|---|
| YIN Precisa (4096 campioni) | 3,3 ms/frame, 25 frame/s → 8% di un core |
| YIN Bilanciata (2048) | 1,3 ms/frame, 25 frame/s → 3% |
| YIN Rapida (1536) | 0,8 ms/frame, 67 frame/s → 5% |
| Caricamento | DOMContentLoaded 52 ms, 323 KiB trasferiti |
| Frame in riproduzione | mediana 16,7 ms, p95 16,8 ms, nessun frame oltre 50 ms |
| CPU del renderer | 0,79 s su 8 s (circa 10%), script 0,30 s |
| Heap JS | 9,9 MiB; 8 420 nodi DOM |
| Schermo rispetto all'audio | mediana 8 ms, p95 18 ms |

Non misurato qui: latenza audio reale d'ingresso e uscita (dipende da scheda e driver: vedi la calibrazione, D-31), consumo su portatili a batteria, Firefox e Safari. Il numero di nodi DOM è alto per via della tastiera SVG a 24 tasti con marker ed etichette: è il primo candidato se servisse alleggerire.

## Motore NAM

`npm run build && npm run perf:nam` (`tools/perf/nam.mjs`): costo per blocco, tempo di caricamento, latenza aggiunta, continuità dell'uscita e memoria con modelli sintetici. Tabella e lettura dei numeri in `docs/NAM_INTEGRATION.md`.
