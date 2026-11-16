# Studio V6 — Sistema grafico: da Blender a React (D-53)

Stato: **pipeline implementata; primo componente (amplificatore) implementato e integrato**. Rendering reali eseguiti con Blender 5.3.0 (Cycles, CPU). Verifica visiva su tre risoluzioni in Chromium headless. Non verificato su schermi reali, su Firefox e Safari, né a densità 1× e 3×.

Uso e regole del kit: `tools/blender/README.md`.

## 1 · Analisi di quello che c'era

| Cosa | Stato trovato | Decisione |
|---|---|---|
| `GTL-V5.7-handoff/blender/scripts/` (`gtl3d.py`, `devices.py`, `parts.py`, `mixer.py`, `panels.py`, `wood.py`) | funzionanti come idea: Cycles, camera ortografica, 1 px CSS = 0,01 unità, materiali procedurali | **riusate** le convenzioni (unità, camera, piano dell'ombra, viti, taglio booleano); riscritte come pacchetto |
| 24 scene `.blend` e 24 asset in `src/ui/studio/v57/assets/` | in uso: manopole, fader, tasti, bordi a nove fette, corpi di mixer e accordatore | **restano**; migreranno un componente alla volta |
| `amp-body` e `iface-body` (930 × 402 e 730 × 312 px CSS) | non più importati dalla V6: fatti per il cassetto, troppo grandi per il rack da 300 px | sostituiti dalla nuova testata; la scheda audio è nel piano |
| `tools/studio-assets/render.py` | renderer NumPy per carta, legno e tasti della base | resta per le superfici piane a ripetizione; non serve per i dispositivi |

Limiti della pipeline precedente, verificati leggendo il codice:

- **Geometria doppia**: le coordinate dei controlli erano scritte a mano negli script e di nuovo in React. Nessun controllo che coincidessero.
- **Due luci diverse**: `lights()` per i dispositivi (riempimento dall'alto) e `part_lights()` per le parti (riempimento laterale): riflessi non coerenti fra corpo e manopole.
- **Script non rieseguibili così com'erano**: `devices.py` cerca i font nella cartella degli script mentre stanno in quella sopra; `t.py` scrive in un percorso di un'altra macchina.
- **Dopo il rendering nulla era nel repository**: conversione in WebP, sfumatura dei bordi e manifest sono descritti nel README dell'handoff ma nessuno script li fa.
- **Manopole**: un corpo fermo più una lancetta disegnata in CSS. La luce non segue la rotazione e la lancetta non ha rilievo.
- **Testata e scheda audio della V6**: disegnate con gradienti CSS, senza materiali.
- **Metallo spazzolato**: l'anisotropia con la tangente predefinita di Blender dà un riflesso conico da metallo tornito su una piastra piana.

## 2 · Progetto del sistema

Scelta di fondo: **Blender prerenderizzato, controlli HTML/React**. L'immagine contiene solo ciò che non cambia; ciò che si muove o si accende è un'immagine a parte; testi ed etichette restano HTML.

| Elemento | Regola |
|---|---|
| Unità e camera | 1 px CSS = 0,01 unità; camera ortografica frontale: le coordinate della spec sono le coordinate sullo schermo |
| Fonte unica della geometria | `tools/blender/specs/<componente>.json` → Blender **e** `…/hardware/<componente>.generated.ts` |
| Luce | una sola (`studio_rig`): chiave calda da in alto a sinistra, riempimento freddo dall'alto, scalata sul soggetto |
| Materiali | libreria procedurale: tolex, tela, metallo spazzolato, bachelite, zigrinatura, cromo, nichel, bordino, inchiostro, smalto, vetro della spia |
| Parti | scatola con raggio CSS, cilindro, cono, vite, angolare, anello di tacche, manopola a gonna, spia |
| Altezze | `Z_CABINET` 44, `Z_PLATE` 2,5, `Z_KNOB` 12 px |
| Stati | corpo fermo; manopola come striscia di fotogrammi (31 posizioni su 270°); spia spenta e accesa |
| Formato | WebP 2×; margine d'ombra nella spec; bordi sfumati a zero |
| Controlli | gli stessi di prima: `RotaryKnob` con ruolo `slider`, tastiera, trascinamento, doppio clic. Cambia solo cosa viene disegnato |

Il telaio dello Studio, le zone e l'organizzazione approvate non cambiano: la testata occupa la stessa colonna da 300 px del rack.

### 3D interattivo: valutato, non introdotto

Nessuna dipendenza WebGL è stata aggiunta e **nessuna prova prestazionale di WebGL è stata fatta**, perché non serviva decidere a favore. Le ragioni:

- Tutte le viste sono frontali e fisse: il 3D in tempo reale non mostrerebbe nulla che un rendering non mostri già, e con una qualità di luce più bassa di Cycles.
- L'unico movimento è la rotazione delle manopole, risolta con i fotogrammi: la luce resta ferma mentre la lancetta gira, a costo di 67 kB per manopola e zero lavoro a ogni frame.
- Un motore 3D aggiungerebbe centinaia di kB al bundle (oggi 534 kB) e un contesto GPU accanto all'audio in tempo reale, su un'app che deve restare leggera.

Dove potrebbe servire davvero: una vista prospettica della chitarra o del manico che l'utente ruota. Prima di introdurlo servono una misura di tempo per frame con l'audio attivo, il peso aggiunto al bundle e un ripiego senza WebGL.

## 3 · Primo componente: la testata dell'amplificatore

| | |
|---|---|
| Dimensioni | 300 × 124 px CSS, come la testata CSS di prima (la prima versione resa era 300 × 176); immagine del corpo 324 × 148 con il margine d'ombra |
| Corpo | cabinet in tolex con angolari, tela con bordino, targhetta in ottone, piastra dorata spazzolata con quattro viti, spia a sinistra delle manopole e le tacche di ogni manopola |
| Manopola | gonna zigrinata, calotta dorata, linea smaltata in rilievo; 31 fotogrammi |
| Spia | ghiera cromata e vetro sfaccettato, spenta e accesa |
| HTML sopra l'immagine | nome del modello sulla targhetta, etichetta su nastro, sei etichette, sei manopole, spia |
| Peso | corpo 33 kB, striscia 64 kB, spie 2 kB: **100 kB** in tutto |
| Tempo di rendering | circa 55 s per tutto, 128 campioni, 4 core, CPU |

Tutti i controlli sono rimasti: sei manopole (tastiera, trascinamento, doppio clic, valori salvati), accensione, spia, bypass, nome e nastro del motore NAM. Nessuna modifica a DSP, teoria o tracking.

Confronto prima e dopo, tre stati per risoluzione: `docs/hardware/amp-before-after-1440x900.webp`, `…-1280x720.webp`, `…-1024x768.webp`.

## 4 · Verifica

| Verifica | Eseguita | Esito |
|---|---|---|
| Rendering reali con Blender 5.3.0 | sì | corpo, 31 fotogrammi, due spie; scene salvate in `tools/blender/blend/` |
| Ripetibilità | sì: ricostruzione completa in una cartella a parte | tutte e quattro le immagini identiche byte per byte a quelle nel repository |
| Spec, manifest, file e modulo generato coerenti | sì, `hardware.test.ts` (7 prove) | verde |
| Immagini caricate, dimensioni della testata | sì, e2e | verde |
| Controlli sulla piastra, etichette non sovrapposte, nessuno sbordo dal rack a 1440 × 900, 1280 × 720, 1024 × 768 | sì, e2e | verde |
| Fotogramma giusto per valore; tastiera, trascinamento, doppio clic, salvataggio | sì, e2e | verde |
| La lancetta resa punta dove dice il valore | sì, e2e sui pixel della striscia | verde |
| Accensione, spia, bypass, nome | sì, e2e | verde |
| Effetto delle manopole sul suono | sì, `guitar-rig.spec.ts` invariato | verde |
| Confronto visivo prima e dopo | sì, a occhio sugli screenshot | la resa è più realistica; la testata è 52 px più alta |
| Schermi reali, densità 1× e 3×, Firefox, Safari | **no** | — |
| Lettori di schermo | **no** (ruoli e nomi invariati, non provati) | — |
| Contrasto delle etichette sulla piastra misurato | **no** | — |

Corretti il 16 novembre 2026 (rendering e screenshot rifatti, e2e verde):

- **Fascia scura sulla piastra**: non era un riflesso. Il foro booleano della spia trasformava la faccia piana in un poligono unico, e le normali indurite dello smusso lo ombreggiavano lungo una diagonale. La spia ora ha un disco scuro appoggiato, senza taglio. Regola del kit: niente booleane su facce metalliche piane in vista.
- **Stanza per i riflessi**: il mondo ha due livelli, uno scuro che illumina e uno chiaro visto solo dai raggi speculari (`ROOM_LEVEL`), così i metalli non riflettono il nero.
- **Spia**: vetro con emissione più forte e alone CSS additivo (`plus-lighter`).
- **Altezza**: tornata a 124 px (tela 30 px, piastra 72 px).

Difetto noto: a 1× l'immagine viene ridotta dal browser, senza un file dedicato.

## 5 · Piano di estensione

Un componente per PR, nello stesso ordine in cui si vedono nel rack e poi verso il centro. Per ognuno: spec, scena, build, modulo generato, test di coerenza, prova e2e, screenshot prima e dopo.

| # | Componente | Cosa si rende | Parti e materiali nuovi nel kit | Controlli HTML che restano | Peso atteso |
|---|---|---|---|---|---|
| 1 | **Cabinet / IR** | frontale 300 × ~150: tolex, tela, cono dietro la tela | `speaker_cone`; riusa tolex, tela, bordino, angolari | selettore IR, interruttore, file | ~45 kB |
| 2 | **Pedali** (7) | un corpo per pedale 2×; manopola piccola a fotogrammi condivisa; interruttore a pedale su e giù; LED spento e acceso | `enclosure` pressofuso, materiale `painted` con colore dalla spec, `footswitch`, `led` | manopole, interruttore, tasti di ordine | ~12 kB a pedale + 40 kB condivisi |
| 3 | **Scheda audio / Input** | pannello 300 × ~110 in alluminio, presa jack, ghiera del gain | `jack`, `anodized`; manopola in alluminio a fotogrammi | gain, canali, ascolto, misuratore (resta CSS: cambia a ogni frame) | ~60 kB |
| 4 | **Manopole e fader comuni** | sostituire `knob-gold`, `knob-alu`, `knob-black` e i cappucci dei fader con strisce o stati dal kit | `fader_cap`, `slot` | tutti | ~70 kB per manopola |
| 5 | **Mixer** | fondo a tutta larghezza come nove fette (bordi resi, centro ripetuto), guide dei fader, tasti Mute e Solo nei tre stati | `nine_slice` nell'export, `key` | fader, mute, solo, misuratori | ~80 kB |
| 6 | **Console** | LCD e cornice come nove fette, tasti di trasporto nei tre stati | `lcd_glass` | tutto il trasporto | ~60 kB |
| 7 | **Telaio** | legni e piastre come nove fette dalla stessa luce; geometria e zone invariate | `wood` procedurale (da `wood.py`) | — | ~90 kB |
| 8 | **Tastiera** | solo materiali di fondo (palissandro, acero, tasti, capotasto) come strisce ripetibili; marker, note e corde restano SVG | `rosewood`, `maple`, `fret_wire` | tutta la tastiera SVG | ~50 kB |

Regole per l'estensione:

- La tastiera resta SVG: è il cuore didattico, cambia a ogni nota e deve restare nitida e accessibile. Si rende solo il fondo.
- I misuratori restano CSS: cambiano a ogni frame.
- Dopo il passo 4 gli asset V5.7 sostituiti si tolgono da `src/ui/studio/v57/assets/`, uno per PR, con il confronto visivo.
- Tetto complessivo degli asset resi: 700 kB. Oggi la cartella V5.7 pesa 552 kB e la testata 120 kB.
- Se un componente ha più di una manopola dello stesso tipo, la striscia è una sola.
- Prima di ogni PR: `npm run check`, `npm run test:e2e`, screenshot a tre risoluzioni.

Miglioramenti del kit da fare lungo la strada: file a 1× per gli schermi normali (`srcset`), testo inciso reso per i marchi fissi, un foglio di contatto di tutti i materiali, il build in CI quando ci sarà un runner con Blender (oggi la CI verifica solo la coerenza dei file).
