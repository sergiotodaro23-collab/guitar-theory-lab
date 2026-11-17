# Studio V6 — Consolidamento e audit del rig (13 novembre 2026)

Audit mirato dopo i lotti 1–6: routing Web Audio, pedaliera configurabile, sessioni salvate, separazione fra analisi e ascolto, dimensione del bundle. La teoria musicale non è stata riesaminata.

## Cosa è stato integrato

| Contributo | Dove | Esito |
|---|---|---|
| Pedaliera configurabile (D-49) | PR #20, `feat/studio-v6-pedal-order` | unita in `main` (`8768765`): CI verde, `npm run check` verde (502 unit), e2e 140 su 140 in locale |
| Lavoro di Antigravity (`fix/antigravity-v6-qa`, `studio_v6_qa_fixes`) | — | **non trovato**: nessun branch né PR con quei nomi sul remoto dopo `git fetch --all --prune`, nessun worktree locale oltre a quello di lavoro. Niente da revisionare né da unire; nessun contributo di Antigravity è integrato. |

Branch remoti al momento dell'audit: `main`, i branch `claude/*` dei lotti già uniti, `feat/studio-v57-integration`, `feat/studio-v6-pedal-order`. Nessuna PR aperta oltre alla #20.

## Risultati dell'audit

| Area | Cosa è stato guardato | Esito |
|---|---|---|
| Nodi e collegamenti | `GuitarRig.wire` scollega l'ingresso e l'uscita di ogni stadio prima di ricollegare: nessun collegamento doppio o residuo. Uno stadio fuori catena resta costruito ma scollegato. | corretto |
| Bypass | Ogni stadio ha un ramo secco e uno bagnato con cambio di guadagno in 20 ms: accendere, spegnere e bypassare non fa click. Un pedale fuori catena ha il ramo bagnato chiuso. | corretto |
| **Cambio di catena sotto segnale** | La riconnessione dei nodi era immediata: con il suono in corso produceva un gradino nella forma d'onda (click). | **corretto qui (D-50)**: l'uscita del rig scende a zero in 12 ms, la catena si ricollega nel silenzio, l'uscita risale. Più cambi ravvicinati finiscono in una sola riconnessione. |
| Lettura della catena attiva | Il modulo Routing leggeva il grafo subito dopo il cambio delle impostazioni. Con la riconnessione differita avrebbe mostrato l'ordine vecchio. | **corretto qui**: il rig avvisa quando il grafo cambia (`rigRevision`). |
| Latenza | La catena è fatta di nodi nativi senza buffer aggiunti: il cambio d'ordine non aggiunge latenza. Il rig non misura la latenza d'ingresso e d'uscita (resta alla calibrazione, D-31). | nessun difetto |
| Sessioni salvate | `sanitizeChain` ripara catene mancanti, sconosciute, duplicate o nella zona sbagliata; le sessioni precedenti a D-49 ripartono dalla catena di fabbrica con i pedali nuovi spenti. | corretto, coperto da unit |
| Analisi e ascolto | L'analisi dell'altezza (analyser e worklet `gtl-capture`) prende il segnale dopo il gain d'ingresso, prima del rig; il rig sta solo sul ramo d'ascolto. | corretto |
| Ascolto | Parte sempre spento a ogni avvio dell'ingresso; nessun percorso lo accende da solo. | corretto |
| Bundle | Un solo chunk: 512 kB (162 kB gzip) di JS, 189 kB (57 kB gzip) di CSS. La PR #20 aggiunge pochi kB. Vite segnala il chunk sopra 500 kB. | accettabile; il motore NAM entrerà come chunk caricato su richiesta |

## Limiti noti rimasti

- **Code di delay e riverbero di un pedale rimosso**: uno stadio fuori catena non viene più elaborato dal browser, quindi il suo buffer resta fermo. Rimettendo il pedale in catena con l'effetto acceso può sentirsi per un attimo la coda rimasta. Non corretto qui.
- **Cambio di catena**: al posto del click c'è un buco di circa 35 ms nell'ascolto (code comprese).
- `matchingRigPreset` serializza i sette suoni a ogni disegno del selettore: costo piccolo, non misurato come problema.
- Nessuna prova con chitarra e scheda audio reali: tutto il rig è **testato con segnali sintetici** (un WAV come microfono).

## Dopo la revisione automatica della PR #21

- **Corretto** (con la PR di TONE3000): un cambio di catena a contesto audio sospeso poteva essere sovrascritto da una riconnessione rimasta in attesa da quando il contesto girava. Ora il ramo senza clock annulla la riconnessione in attesa e riporta l'uscita a 1.
- **Non corretto**: `rewireGain` legge `AudioParam.value` al momento della riconnessione. In Chromium segue l'automazione; su altri browser può riportare il valore programmato. Vale come prova in Chromium, non altrove.

## Baseline

Baseline per il lavoro su NAM: `main` a `6c493be692dfe5c3b521d9339047e2e9366b5441` (PR #20 e #21 unite, CI verde).
