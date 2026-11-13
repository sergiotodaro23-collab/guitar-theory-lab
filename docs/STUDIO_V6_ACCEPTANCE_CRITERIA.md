# Studio V6 — Criteri di accettazione

Un criterio è soddisfatto solo con un test eseguito (unit o e2e) o con una verifica dichiarata nel registro. «Si vede bene» non basta.

## Shell

- A1. L'header attraversa tutta la finestra e non contiene trasporto.
- A2. La console sta tra le barre laterali, non sopra né sotto di esse.
- A3. La console si comprime con la linguetta; compressa mostra stato, accordo, BPM e metrica, e Avvia/Ferma funzionano. Lo stato si conserva al ricaricamento.
- A4. BPM: rotella, trascinamento verticale, tastiera e campo numerico, sempre dentro i limiti del motore. Swing e Master: manopole con tastiera, trascinamento e rotella.
- A5. Aprire o chiudere un pannello (mixer, metronomo, rack) non sposta né ridimensiona la tastiera.
- A6. Il layout non si muove quando l'ingresso audio parte o si ferma.

## Barre laterali

- B1. Rail compatta: icone dei laboratori e fader della chitarra. Espansa: nomi, fader chitarra e backing, muto, impostazioni. Nessun testo sopra le icone.
- B2. Il fader del backing cambia davvero il livello di accordi, basso, batteria e backing track; il muto li azzera senza muovere i fader del mixer.
- B3. Cambiare stato della rail non cambia laboratorio né selezioni musicali.
- B4. Rack destro: espanso, compatto, nascosto; ogni modulo si comprime e ha il suo acceso/spento reale.

## Tastiera e taccuino

- C1. 6 corde, tasti 0–24, segnatasti; il divisore rispetta altezza minima e massima e viene salvato.
- C2. Un clic sulla tastiera non altera il modello musicale.
- C3. Schede per laboratorio nell'ordine della specifica, più Tastiera secondaria, Legenda e visualizzazione, Dettagli in tutti.
- C4. Nascondere un overlay nella legenda non cambia le selezioni musicali.

## Mixer e rig

- D1. Il cassetto del mixer copre solo il taccuino, a tutta larghezza.
- D2. Ogni fader, muto e solo agisce sul guadagno reale del canale.
- D3. Le manopole dell'amplificatore, il cabinet e i pedali modificano il segnale (test sul grafo audio con segnale sintetico).
- D4. Un modello NAM non compare mai come caricato o attivo se l'audio non lo attraversa.

## Qualità

- E1. `npm run check` e `npm run test:e2e` verdi a ogni unione.
- E2. Verifica a 1440 × 900, 1366 × 768, 1280 × 800, tablet orizzontale; la Semplificata resta invariata su smartphone.
- E3. Ogni regola musicale nuova ha un test su un caso da manuale.
