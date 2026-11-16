# TONE3000: scelta di un tone dal catalogo (D-52)

Stato: **implementato; testato solo contro un TONE3000 simulato**. Il flusso con il servizio reale **non è stato eseguito**: serve una chiave pubblicabile, che non è stata né richiesta né inventata. Vedi «Cosa manca per la prova reale».

Il collegamento è facoltativo. Senza chiave, senza rete o senza account TONE3000, Guitar Theory Lab funziona per intero: rig, DSP interno, modelli NAM da file.

## Cosa fa

Dalla testata dell'amplificatore, «Sfoglia TONE3000» apre il catalogo di TONE3000 in una finestra a parte. L'utente accede con il suo account e sceglie un tone **sul sito di TONE3000**; l'app riceve l'identificativo del tone, ne mostra i dettagli con il selettore dei modelli, e carica il modello scelto nel motore NAM (`docs/NAM_INTEGRATION.md`) con gli stessi tre passi di un file locale.

Fonti seguite: documentazione su tone3000.com/api, esempi ufficiali in github.com/tone-3000/api (`web/src/tone3000-client.ts`, flusso Select).

## Autenticazione

- **OAuth 2.0, authorization code con PKCE (S256)**; `state` casuale verificato per primo a ogni risposta: una risposta con uno `state` diverso viene ignorata e nessun token viene chiesto.
- Flusso ufficiale **`prompt=select_tone`**, con `format=nam`, `gears=amp_amp-cab_pedal`, `preview=true`, `menubar=true` e **`architecture` sempre indicata**: `2` (A2, predefinita) o `1` (A1), a scelta nella finestra. Il motore carica entrambe (misurato, `docs/NAM_INTEGRATION.md`).
- Solo la **chiave pubblicabile** (`t3k_pub_…`), che TONE3000 dichiara fatta per le app client. L'app non ha backend: una chiave segreta (`t3k_cs_…`) viene rifiutata se qualcuno la incolla, e non esiste nessun punto del codice che la usi.
- La chiave arriva da `VITE_TONE3000_PUBLISHABLE_KEY` al momento della build (`.env.example`) oppure la inserisce l'utente nella finestra; in quel caso resta in `localStorage` sotto `gtl.tone3000.publishableKey`, fuori da sessioni e preset.
- **Indirizzo di ritorno**: l'indirizzo dell'app stessa (origine e percorso). La finestra che torna da TONE3000 non avvia l'app: inoltra la risposta alla pagina che ha aperto il flusso (`postMessage` verso la stessa origine, e `BroadcastChannel` se il browser ha perso il legame), toglie il codice dalla barra degli indirizzi e si chiude.
- Esiti gestiti: tone scelto, catalogo chiuso prima dell'accesso, accesso fatto e catalogo chiuso, errore di TONE3000, `state` diverso, finestra chiusa a mano, popup bloccato, sessione scaduta (401), troppe richieste (429).

## Cosa resta dove

| Dato | Dove | Per quanto |
|---|---|---|
| Verificatore PKCE e `state` | memoria della pagina | un solo flusso |
| Token d'accesso | memoria della pagina | la visita; «Dimentica l'accesso» lo butta |
| Refresh token | da nessuna parte: non viene letto | — |
| Indirizzo di download del modello | usato una volta | mai conservato |
| File del modello | memoria | la visita |
| Attribuzione del modello caricato (tone, autore, pagina del tone, immagine) | memoria, con il modello | la visita |
| Chiave pubblicabile inserita a mano | `localStorage`, chiave propria | finché l'utente non la cambia |
| Impostazioni e preset | scelta del motore e interruttore del cabinet | nessun dato di TONE3000 |

Il token viaggia solo verso `https://www.tone3000.com`: gli indirizzi dei modelli che non stanno su `tone3000.com` vengono scartati.

## Condizioni di TONE3000

- **Piano gratuito, non commerciale** (Guitar Theory Lab è gratuita e GPL-3.0-or-later): sono usati solo il flusso Select, la lettura del tone scelto e dei suoi modelli, come nella demo ufficiale «Select». Nessuna ricerca, nessun catalogo proprio, nessun download di archivi interi. Rispettare le condizioni resta una responsabilità del proprietario dell'app: vanno rilette prima di pubblicare.
- **Requisiti di design**, come sono stati applicati:

| Requisito | Stato |
|---|---|
| 1 · Ingresso dal punto in cui si cambia il suono del blocco | fatto: pulsante nella testata, accanto al caricamento del file |
| 2 · Presentazione prima dell'accesso | fatta, con testo proprio: dice che l'app «si collega a TONE3000», non che esiste una partnership, perché una partnership non c'è. **Decisione del proprietario** se adottare il testo consigliato da TONE3000 |
| 3 · Accesso tramite il flusso Select | fatto |
| 4 · Viste a elenco | non applicabile: l'app non ha elenchi propri, il catalogo è quello di TONE3000 |
| 5 · Tone caricato nel blocco: marchio, titolo, tipo, formato, autore, immagine | fatto: etichetta «NAM · T3K · titolo» sulla testata e riga «Origine» con immagine (se il tone ne ha una), tipo, formato, autore e pagina del tone |
| 6 · Dettagli del tone: immagine, titolo, tipo, formato, autore, selettore dei modelli, descrizione | fatto |
| 7 · Logo: nome intero prima del marchio corto | il nome «TONE3000» compare per intero all'ingresso e nella finestra, «T3K» solo sul blocco. **Mancano i file ufficiali del logo**: sono scritti in testo. Vanno sostituiti con quelli di TONE3000 |

- Licenza dei tone: è mostrata nei dettagli così come la dichiara l'API; i tone restano dei loro autori.

## Cosa manca per la prova reale

1. Una **chiave pubblicabile** del proprietario (tone3000.com → Settings → API Keys).
2. Se sulla chiave sono registrati indirizzi di ritorno, va aggiunto quello dell'app (la finestra lo mostra). `localhost` è sempre accettato, quindi la prima prova si può fare in locale.
3. Verificare con il servizio vero ciò che la simulazione non può dire: che lo scambio del codice e le letture rispondano alle richieste del browser dall'origine dell'app (CORS), la forma esatta delle risposte, il comportamento della finestra con l'accesso reale, il download di un modello vero e il suo ascolto.

Finché questo non è fatto, lo stato resta «testato contro un servizio simulato».

## Limiti

- Un tone alla volta; nessuna libreria, nessun preferito, nessun elenco dei tone scaricati.
- Nessun rinnovo del token: alla scadenza si riapre il catalogo (la sessione web di TONE3000 di solito evita di ripetere l'accesso).
- Il modello scaricato non viene conservato: dopo un ricaricamento va scelto di nuovo.
- Solo il flusso con finestra a parte: se il browser blocca i popup l'app lo dice e non ripiega sul reindirizzamento della pagina, che farebbe perdere audio e modello in memoria.
- I tone IR e i formati diversi da NAM non sono offerti.

## Codice e test

- `src/app/tone3000.ts` (puro): chiave, PKCE, indirizzo di autorizzazione, lettura e giudizio della risposta, lettura di tone e modelli, controllo degli indirizzi.
- `src/app/tone3000Client.ts`: finestra, inoltro della risposta, scambio del codice, richieste, stato in `useTone3000`.
- `src/ui/studio/v6/Tone3000.tsx`: finestra con chiave, presentazione, dettagli del tone.
- Unit: `src/app/tone3000.test.ts` (21 prove, fra cui il vettore di RFC 7636 per PKCE e gli indirizzi contraffatti).
- E2E: `e2e/tone3000.spec.ts`, quattro prove contro un TONE3000 simulato che risponde come da documentazione: chiave (segreta rifiutata), flusso completo con verifica di PKCE e `state` e niente di sensibile in memoria permanente, `state` diverso ignorato, chiusura e rifiuto.
