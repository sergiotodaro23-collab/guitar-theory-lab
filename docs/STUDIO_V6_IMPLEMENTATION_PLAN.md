# Studio V6 — Piano di implementazione

Regole: quelle di `CLAUDE.md` (motori puri, un solo clock, forme dal motore, mai dichiarare verificato ciò che non è stato eseguito). Un lotto per PR, piccolo; ogni lotto lascia `main` verde. Riferimenti: prototipo HTML V6 (comportamento) e immagine approvata (aspetto), entrambi forniti dal proprietario.

## Principi

- La V6 riorganizza la shell Studio; store, motori e audio restano quelli esistenti. La Semplificata non cambia.
- Ogni controllo nuovo comanda qualcosa di reale. Ciò che non esiste ancora non viene disegnato come se esistesse.
- Gli asset restano quelli resi con Blender del progetto (D-40) o CSS; nessun marchio o grafica di terzi.

## Lotti

| Lotto | Contenuto | Dipende da |
|---|---|---|
| 1 · Shell (fatto, #14) | Header globale; console con linguetta, striscia compatta, Master, rotella/trascinamento sul tempo; rail con fader chitarra e backing; maniglia del mixer; trim di gruppo del backing nel motore | — |
| 2 · Rack destro (fatto, #15) | Colonna «Audio & Rig» espansa, compatta, nascosta; moduli Ingresso, Amplificatore, Cabinet IR, Pedaliera, Routing con i controlli reali di D-42; i cassetti di rig e ingresso vanno in pensione | 1 |
| 3 · Taccuino (fatto in parte, #16) | Ordine delle schede V6 per laboratorio; schede condivise Tastiera secondaria, Legenda e visualizzazione (doppia pagina), Dettagli | 1 |
| 4 · Mixer (fatto, #17) | Fader lunghi a tutta larghezza, misuratori per canale, Solo del backing | 1 |
| 5 · Libreria preset (fatto, #18) | Finestra con ricerca e filtri (laboratorio, difficoltà, tonalità, tipo); salvataggio, modifica, cancellazione | 3 |
| 6 · Rig | Fuzz ed EQ, riordino dei pedali, preset di suono, quinto timbro del metronomo | 2 |
| 7 · Legenda | Simboli per ruolo (cerchio, quadrato, triangolo, rombo), 12 colori, note sovrapposte composte | 3 |
| 8 · Esercizi | Motore condiviso tra i laboratori, valutazione con il tracking dove misurabile | 5 |
| 9 · Audio avanzato | Fattibilità NAM (WASM + AudioWorklet) con misure; calibrazione; MIDI | 6 |
| 10 · Rifinitura | Fedeltà all'immagine, risoluzioni, accessibilità, regressioni, documenti | tutti |

## Rischi

| Rischio | Contromisura |
|---|---|
| Spazio verticale a 1366 × 768 e 1280 × 720 con header e maniglia in più | console comprimibile; header più basso sotto 820 px; misure negli e2e |
| LCD stretto con il rack destro aperto | rack compatto in automatico sotto 1250 px |
| e2e legati alla shell V5.7 | gli identificatori di test restano; cambia solo dove vive il controllo |
| NAM non fattibile nel browser entro i limiti di CPU | punto d'innesto pulito e blocco documentato, nessuna UI che finge |
