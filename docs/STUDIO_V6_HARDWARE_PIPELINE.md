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

## 3b · Pedaliera (16 novembre 2026)

Stato: **implementata**; resa con Blender 5.3.0, verificata in Chromium headless a 1440 × 900, 1366 × 768, 1280 × 720 e 1024 × 768. Non verificata su schermi reali né su altri browser.

| | |
|---|---|
| Spec | `tools/blender/specs/pedals.json`: una geometria per tutti; per pedale vernice (il colore di `PEDAL_SPECS`), finitura e grafica |
| Corpi | 7 immagini 144 × 226 px CSS: scatola pressofusa, viti, prese jack ai lati, rondelle dei potenziometri |
| Identità | Compressor blu metallizzato con filetti; Fuzz arancio martellato con pannello nero; Overdrive verde lucido con doppia cornice; EQ crema con scale graduate; Chorus azzurro metallizzato con fascia blu; Delay alluminio spazzolato con pedana in gomma; Reverb viola metallizzato con anelli |
| Parti condivise | manopola a barilotto (31 fotogrammi), LED spento e acceso, interruttore a pedale su e giù |
| HTML sopra | nome, etichette, manopole (`RotaryKnob`), LED (`role="img"`), interruttore (`aria-pressed`), tasti di ordine e rimozione |
| Peso | corpi 80 kB, manopola 42 kB, LED e interruttore 5 kB: **127 kB** |
| Nel kit | materiali `painted` (lucido, metallizzato, martellato, opaco), `anodized`, `rubber`, `led_lens`, `srgb`, `deepen`; parti `enclosure`, `barrel_knob`, `footswitch`, `led`, `side_jack`, `decal`, `outline` |

DSP, ordine, aggiunta e rimozione non sono cambiati: `guitar-rig.spec.ts` e `pedal-chain.spec.ts` passano senza modifiche. Tolti da `src/ui/studio/v57/assets/` tredici file che nessun modulo importava più (354 kB): la cartella passa a 199 kB.

## 3c · Cabinet e scheda audio (16 novembre 2026)

Stato: **implementati**; resi con Blender 5.3.0, verificati in Chromium headless alle quattro risoluzioni. Non verificati su schermi reali né su altri browser.

| | Cabinet | Scheda audio |
|---|---|---|
| Spec | `specs/cab.json` | `specs/iface.json` |
| Dimensioni | 300 × 92 px CSS | 300 × 78 px CSS |
| Reso | tolex, bordino e angolari della testata; tela a trama aperta con due altoparlanti che si intravedono; targhetta | telaio in alluminio spazzolato, pannello anodizzato, presa combo XLR/jack, finestra fumé del misuratore, manopola in alluminio a 31 fotogrammi |
| HTML | selettore della risposta all'impulso sotto l'immagine; l'immagine si attenua a cabinet escluso | due manopole di gain (Rig e Detection, una sola striscia di fotogrammi), misuratore dentro la finestra (resta CSS: cambia a ogni frame), canali 1 e 2, letture in dB |
| Peso | 46 kB | 55 kB |
| Nel kit | `speaker`, tela `open_weave` | `combo_jack`; la manopola è `skirted_knob` con materiali d'alluminio |

Tolto `knob-alu` dalla cartella V5.7 (non più importato). Asset resi in tutto: 166 kB V5.7 + 327 kB pipeline = **493 kB** su un tetto di 700.

## 3d · Mixer: parti mobili (16 novembre 2026)

Stato: **implementato**. Resi i cappucci dei fader (canale e master), il tasto di console nei tre stati, il frontale delle strisce (canale, gruppo, master), la guida dei fader e il vassoio dei banchi, questi ultimi come nove fette su un livello dietro il contenuto: il layout non cambia. Le sigle in dB e i misuratori restano HTML e CSS (i misuratori cambiano a ogni frame). Verificato in Chromium headless alle quattro risoluzioni.

| | |
|---|---|
| Spec | `specs/mixer.json` → `mixer.generated.ts` → variabili CSS (`hardware/mixerVars.ts`): il foglio di stile non contiene misure copiate a mano |
| Cappuccio | un'immagine con la sua ombra che scorre sulla guida; la stessa, ridotta, nei fader della barra laterale |
| Tasti | resi a filo e usati come bordo a nove fette: un rendering serve tasti di qualsiasi larghezza; il testo resta HTML |
| Logica | invariata: stessi `input type="range"`, stessi `aria-pressed`, stessi livelli reali |
| Peso | 12 kB |
| Nel kit | `fader_cap`, `console_key`, materiale `key_cap`; regola: le parti a nove fette si rendono a filo, senza piano d'ombra, con viti e angoli dentro la fetta |

## 3e · Console (17 novembre 2026)

Stato: **implementata**. `specs/console.json`: piastra dei deck, cornice e vetro dell'LCD, tasto hardware rilasciato, premuto e acceso, resi a filo come nove fette con le stesse misure e le stesse fette delle immagini V5.7 che sostituiscono: il CSS cambia solo i file, layout e interazioni sono identici. Il testo dell'LCD e tutti i tasti restano HTML. Peso 7 kB (le cinque immagini V5.7 rimosse pesavano 47 kB). Le parti piatte e grandi si illuminano a potenza ridotta (`key`, `fill` di `studio_rig`): a piena potenza risultano slavate accanto ai dispositivi. Le manopole Swing e Master sono ancora quelle a CSS della base (`ui/hardware`).

Finiture dal riferimento approvato V6.7 (sezioni `transport` e `toolbar` di `Guitar_Theory_Lab_Studio_V6_7_Editable_Header.html`): filetto d'ottone lungo il bordo della piastra, labbro ambra-oro attorno al vetro dell'LCD, simboli del trasporto colorati (verde per avviare, ambra per pausa e stop). Non ripresi dal prototipo, perché cambierebbero funzioni o layout: tasto di registrazione, selettori nella barra, proporzioni dei tasti.

## 3f · Legni: tastiere e barra laterale (17 novembre 2026)

Stato: **implementato**. `specs/frame.json`: faccia della tastiera in acero laccato (tastiera principale) e in palissandro (anteprima del prossimo accordo), barra laterale in noce a nove fette con viti d'ottone. Le tastiere restano SVG: l'immagine è solo il legno sotto tasti, capotasto, segnatasti, corde e note, attraverso il gancio `boardImage` che `Fretboard` aveva già. Sul palissandro i segnatasti sono chiari. Materiale nuovo `wood` (venatura, deriva di tono, fiammatura, pori) con `maple`, `rosewood`, `walnut`. Peso 35 kB. Non resi: lo sfondo in legno della pagina (quasi tutto coperto dai pannelli, resta a gradienti CSS) e la fascia dell'intestazione, che aspetta il logo.

## 3g · Logo e intestazione (17 novembre 2026)

Stato: **implementato**. Riferimento approvato: lo SVG `#vectorHeader` di `Guitar_Theory_Lab_Studio_V6_7_Editable_Header.html`, conservato senza la sua bitmap in `docs/hardware/v6_7-vector-header.svg`. `StudioLogo.tsx` ne riusa senza modifiche la sagoma della targa, le due strisce (quattro tratti: bordo crema e colore), il tracciato del lettering «GUITAR THEORY LAB», la scritta «STUDIO · VER. 6.0» e i colori; `hardware.test.ts` confronta i due file.

Adattamenti, tutti dichiarati:

| Riferimento | Studio V6 | Perché |
|---|---|---|
| fondo della targa da bitmap (smalto consumato, vite fotografica) | gradiente `enamel` dello stesso SVG e una vite vettoriale | il logo resta tutto vettoriale e pesa 5 kB nel bundle, zero immagini |
| intestazione alta 85 px su 928 | barra alta 38 px (32 sotto gli 820 px di altezza); la targa è alta 52 px e usa il margine superiore della pagina e lo spazio sotto la barra | tastiera e taccuino non perdono un pixel |
| le strisce finiscono a 635 unità e nel bozzetto piegano in basso prima dei tasti della finestra | proseguono diritte fino al bordo destro, sopra gli strumenti | restano continue a ogni larghezza; non ci sono tasti della finestra |
| fondo scuro in tolex da bitmap | fondo scuro a CSS | nessuna immagine in più |

Non ripresi dal bozzetto: il bordo rosso attorno a tutta l'applicazione, i tasti a schermo intero, impostazioni e aiuto nell'intestazione (le funzioni esistono altrove), l'ombra sotto le lettere (non è nello SVG).

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
| 1 | **Cabinet / IR** | fatto (3c) | | | 46 kB |
| 2 | **Pedali** (7) | fatto (3b) | | | 127 kB |
| 3 | **Scheda audio / Input** | fatto (3c) | | | 55 kB |
| 4 | **Manopole e fader comuni** | fatto per il rack e per i cappucci (3d); resta `knob-black` dell'accordatore | | accordatore | — |
| 5 | **Mixer** | fatto (3d) | | | 12 kB |
| 6 | **Console** | fatto (3e); restano le manopole Swing e Master | | | 7 kB |
| 7 | **Telaio** | barra laterale fatta (3f); restano intestazione (bloccata dal logo) e sfondo della pagina | | — | — |
| 8 | **Tastiera** | legni fatti (3f); tasti e capotasto restano SVG | | tutta la tastiera SVG | 29 kB |

Bilancio al 17 novembre 2026: 104 kB V5.7 (accordatore, spirale del taccuino) + 380 kB pipeline = **484 kB** su 700.

### Rifiniture delegabili a un modello più economico

Lavori meccanici, senza scelte di progetto. Ognuno: modificare la spec o il CSS indicato, `build.py <componente>`, `npm run check`, la spec e2e del componente, screenshot con `tools/hardware/shots.mjs`.

1. File a 1× con `srcset` per i corpi (`export.py`: ridurre a metà con Lanczos e scrivere `…@1x.webp`).
2. Accordatore: sostituire `knob-black` e `footswitch` V5.7 con `barrel_knob` e `footswitch` del kit, poi togliere i due file.
3. Tasti della barra laterale (`.v6-ms`): stessi tasti a nove fette del mixer.
4. Foglio di contatto di tutti i materiali (`build.py materials --preview`), per controllare a colpo d'occhio una modifica della luce.
5. Contrasto misurato delle etichette su piastra dorata, pannello anodizzato e pedali chiari (EQ, Delay).
6. Tacche graduate rese attorno alle manopole dei pedali (`tick_ring` con `dot=0.6`).
7. LED di colore diverso per pedale: parametro `color` di `parts.led` dalla spec.
8. Rifare i tre confronti in `docs/hardware/` con la testata a 124 px.

Regole per l'estensione:

- La tastiera resta SVG: è il cuore didattico, cambia a ogni nota e deve restare nitida e accessibile. Si rende solo il fondo.
- I misuratori restano CSS: cambiano a ogni frame.
- Dopo il passo 4 gli asset V5.7 sostituiti si tolgono da `src/ui/studio/v57/assets/`, uno per PR, con il confronto visivo.
- Tetto complessivo degli asset resi: 700 kB. Oggi la cartella V5.7 pesa 552 kB e la testata 120 kB.
- Se un componente ha più di una manopola dello stesso tipo, la striscia è una sola.
- Prima di ogni PR: `npm run check`, `npm run test:e2e`, screenshot a tre risoluzioni.

Miglioramenti del kit da fare lungo la strada: file a 1× per gli schermi normali (`srcset`), testo inciso reso per i marchi fissi, un foglio di contatto di tutti i materiali, il build in CI quando ci sarà un runner con Blender (oggi la CI verifica solo la coerenza dei file).
