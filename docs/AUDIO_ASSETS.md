# Campioni audio: fonti, licenze, conversione

Registro J2 del piano (`docs/FINAL_PLAN.md`), decisioni D-60 e D-65. Ogni file in `public/samples/` viene da una fonte pubblica fissata a un commit, con licenza compatibile con GPL-3.0-or-later (CC0, oppure CC BY 3.0 con attribuzione), ed è rigenerabile con `python3 tools/samples/build_samples.py` (servono ffmpeg e numpy; i download finiscono in una cache locale).

## Inclusi

| Set | Strumento | Fonte (commit) | Licenza | Autore | Contenuto convertito |
|---|---|---|---|---|---|
| `drums` | Batteria acustica (kit jazz da club, bacchette) | [sfzinstruments/virtuosity_drums](https://github.com/sfzinstruments/virtuosity_drums) `9f04cf9` | CC0 1.0 | Versilian Studios, batterista Austin McMahon | 13 voci: cassa, rullante (12 dinamiche × 3), cross-stick, rimshot, hi-hat chiuso/mezzo/aperto/pedale, ride, campana del ride, crash, tom alto e basso; da 3 a 12 velocity layer e da 3 a 4 round robin. Mix fisso dei microfoni close (cassa, rullante), overhead e room. |
| `piano` | Pianoforte a coda Steinway B | [sgossner/VCSL](https://github.com/sgossner/VCSL) `c1ea7bc` | CC0 1.0 | Versilian Studios (VCSL) | Microfoni vicini mixati in mono, senza pedale, a toni interi da A#0 a E7 (40 note), 3 velocity layer; code tagliate a 5 s nei bassi, 3,5 s nel centro, 2,5 s negli acuti. La fonte normalizza ogni layer: la dinamica la ricostruisce il sampler con una curva di velocity. L'accordatura «stirata» del piano è conservata. |
| `ebass` | Basso elettrico Squier Jazz Bass, diretto | [sfzinstruments/karoryfer.growlybass](https://github.com/sfzinstruments/karoryfer.growlybass) `4f48326` | CC0 1.0 | Karoryfer Lecolds | Per terze minori da E1 a Eb4 (13 note): sustain con 4 dinamiche (pp, p, f, ff) × 2 round robin, staccato × 3 round robin. |
| `brushes` | Batteria con spazzole (kit vintage) | [sfzinstruments/karoryfer.big-rusty-drums](https://github.com/sfzinstruments/karoryfer.big-rusty-drums) `f07ce00` | CC0 1.0 | Karoryfer Samples | 11 voci: rullante a spazzola (8 dinamiche × 4 round robin), cross-stick (col manico della spazzola), hi-hat a spazzola chiuso, mezzo aperto e aperto, pedale dell'hi-hat, ride e crash a spazzola, tom 14" e 18" a spazzola, cassa da 24" col battente (14 dinamiche); da 4 a 14 velocity layer, sempre 4 round robin. Mix fisso di microfoni vicini e overhead. |
| `electronic` | Drum machine (voci 808, ride 909) | [MckAudio/MckSamplePacks](https://github.com/MckAudio/MckSamplePacks) `5db40e8` | CC0 1.0 | MckAudio, registrazioni della sua Roland TR-8 | 10 colpi singoli: cassa, rullante, hi-hat chiuso e aperto, battimani, rimshot, tom medio e basso, crash 808; ride 909. Una drum machine ha un suono per voce: niente layer né round robin. |
| `epiano` | Piano elettrico Wurlitzer EP200 | [sfzinstruments/GregSullivan.E-Pianos](https://github.com/sfzinstruments/GregSullivan.E-Pianos) `8c3e581` | **CC BY 3.0** | Greg Sullivan (mappatura sfz di kinwie) | Da A1 a G#6, 4 velocity layer (pp, mp, f, ff) campionati su tasti diversi in ogni layer (da 7 a 13 radici), come nella mappatura originale: sopra C#5 il layer pp usa le prese mp, sopra G5 il layer ff quelle f. Code tagliate a 4 s sotto il Do centrale, 3 s sopra. |
| `upright` | Contrabbasso pizzicato | [sfzinstruments/karoryfer.meatbass](https://github.com/sfzinstruments/karoryfer.meatbass) `ac9e859` | CC0 1.0 | Karoryfer Lecolds | Per terze minori da A0 a C4 (14 note), 4 dinamiche × 2 round robin. |

Totale circa 15 MB in Opus (Ogg): batteria 3,6 MB, spazzole 3,3 MB, piano 3,3 MB, basso elettrico 2,3 MB, contrabbasso 1,9 MB, Wurlitzer 0,9 MB, drum machine 0,1 MB. Decodificati per intero i set grandi occuperebbero in memoria da 50 a 120 MB ciascuno (float a 32 bit, 48 kHz): per questo l'app non li carica mai per intero (vedi sotto).

**Attribuzione.** CC0 non obbliga ad attribuire: gli autori sono comunque citati qui, in `public/samples/CREDITS.txt` (servito con i campioni) e nel piè di pagina dell'app. Il Wurlitzer è CC BY 3.0, che **obbliga**: titolo, autore, licenza con link e modifiche apportate sono in `CREDITS.txt`, e il piè di pagina dell'app («Campioni audio … Fonti e licenze») rimanda a questo registro. Chi ridistribuisce l'app deve conservarli.

## Conversione

- Ogni file viene scaricato dal commit fissato e decodificato a 48 kHz.
- La batteria mescola i microfoni di ogni colpo: per cassa e rullante close 1,0/0,9, overhead 0,45/0,6, room 0,3; per piatti e tom solo overhead e room.
- Il silenzio iniziale viene tagliato (con 2 ms di margine prima dell'attacco), poi la coda sotto −62 dB, entro una durata massima per voce, con una dissolvenza di 50 ms.
- **Un solo guadagno per strumento**, così i velocity layer conservano la dinamica registrata. Eccezione: le spazzole hanno un guadagno **per voce** (il layer più forte di ogni voce a un picco fissato: cassa −4, rullante −3, ride −7, hi-hat chiuso −10 dBFS…), perché nel set Big Rusty i microfoni vicini mettono la cassa 25 dB sopra il ride a spazzola; dentro la voce la dinamica resta quella registrata (rullante −27 → −3 dB su 8 layer). Verifica: per ogni voce della batteria il livello cresce con il layer, per esempio cassa −38,6 → −10,0 dB e rullante −50,5 → −16,9 dB su 12 layer.
- **Controllo dell'intonazione** sulle note intonate, tra 0,12 e 0,42 s dopo l'attacco (più a lungo sulle note basse). La frequenza viene cercata entro mezza ottava dall'etichetta: conferma la nota e misura i cent. L'ottava di ogni libreria è stata controllata a mano su note campione: Growlybass chiama E2 il Mi basso a vuoto (MIDI 28); Meatbass e VCSL usano l'altezza reale (C4 = 60).
- Per basso elettrico e contrabbasso ogni nota riceve una correzione (`tune`, mediana delle zone sostenute) solo se le zone concordano entro 8 cent. Il pianoforte non viene corretto.
- Wurlitzer e drum machine sono normalizzati alla fonte (ogni presa ha il picco a circa −1 dB): come per il piano, il livello lo dà la curva di velocity del sampler. Le intonazioni del Wurlitzer sono misurate e corrette per nota (da −2,5 a +11 cent, in accordo con le correzioni della mappatura sfz originale).
- Codifica in Opus: 96 kbps stereo per la batteria, 80 kbps stereo per le spazzole, 64 kbps mono per la drum machine, 56 kbps mono per piano, Wurlitzer e bassi.

## Nell'app (J1)

- **Quali suoni.** Kit «Acustica» → Virtuosity; kit «Spazzole» → Big Rusty a spazzola; kit «Elettronica» → TR-8; basso «Elettrico a dita» e «Elettrico col plettro» → Growlybass (col plettro con un'enfasi di presenza a 2,2 kHz); «Contrabbasso» → Meatbass; comping «Pianoforte» (prima «Tastiera») → Steinway; «Piano elettrico» → Wurlitzer EP200 (smorzatori in 0,15 s). Synth bass, organo, chitarra pulita e pad restano sintetizzati.
- **Voci della batteria.** Cassa, rullante, hi-hat chiuso e aperto, ride come nei pattern; il battito di mani diventa cross-stick nei kit acustici (la clave si suona sul cerchio) e resta battimani sulla drum machine, che non ha cross-stick né pedale dell'hi-hat: lì suonano il rim shot e l'hi-hat chiuso; la riga dei tom va sul tom alto, gli accenti sul timpano. Un hi-hat chiuso o di pedale strozza l'aperto che sta suonando.
- **Scelta della zona** (`src/audio/samplerMap.ts`, puro e testato): radice registrata più vicina (a pari distanza la più alta, trasposta verso il basso), velocity layer, round robin; per il Wurlitzer, campionato su tasti diversi in ogni layer, prima il layer e poi la radice più vicina dentro quel layer (`layerFirst`), così una nota piano non suona una presa forte solo perché la radice è vicina che ruota senza ripetere lo stesso campione due volte di fila. La correzione `tune` è tolta dalla velocità di riproduzione. Il piano, normalizzato dalla fonte, prende il livello da una curva quadratica (−12 dB a metà velocity, minimo −33 dB); gli altri set conservano la dinamica registrata con una piccola correzione dentro il layer. Il basso elettrico suona staccato le note più brevi di 0,22 s.
- **Caricamento pigro** (`src/audio/sampler.ts`): nulla si scarica prima che parta l'audio; poi solo le zone (con tutti i loro round robin) usate dalle note della Jam e del suono scelto. Con la progressione predefinita meno della metà delle zone di ogni set (verificato in `e2e/samples.spec.ts`). Cambiare suono o progressione carica ciò che manca; le zone già decodificate restano in memoria fino alla chiusura della pagina (limite da rivedere in Q6).
- **Ripiego.** Finché una zona non è pronta, o se il file non si carica o il browser non decodifica Opus in Ogg (Safari prima della 18.4), la nota suona con la ricetta sintetica (D-32), senza errori. Un accordo è tutto campionato o tutto sintetico, mai misto.
- **Livelli.** Una correzione per set porta il livello RMS dei canali entro 3 dB sotto quello sintetico misurato sugli strumenti di misura del mixer (batteria −2,3 dB, basso −3,2 dB, piano −3,1 dB), così il bilanciamento non salta quando arrivano i campioni. Misure del 21/11/2026 in Chromium, progressione predefinita, 6,4 s di riproduzione per caso: batteria −1,7 dB, spazzole −1,3 dB, drum machine −0,9 dB, Wurlitzer −1,8 dB (con una correzione di −15 dB: senza, normalizzato com'è, suonava 13 dB sopra il sintetico).
- **Polifonia.** Al massimo 64 voci: oltre, le più vecchie sfumano in 20 ms.

Stato: implementato e testato in Chromium (unità e e2e con segnale reale sui canali, anche per spazzole, drum machine e Wurlitzer); non ancora ascoltato dal proprietario.

## Scartati

| Candidato | Motivo |
|---|---|
| jRhodes3 (Rhodes Mark I) | Licenza dei campioni CC BY-NC 4.0: la clausola non commerciale non è compatibile con la GPL né con la ridistribuzione libera. Una versione ridotta (un layer) compare come CC0 nel Discord SFZ GM Bank, ma contraddice la licenza del repository dell'autore: scartata finché l'autore non la chiarisce. |
| Midnight Wurli, MaskinTrommer, Voltage Controlled Cassette Organ (Dehli Musikk) | Repository GPL-3.0 ma senza audio: i campioni sono un prodotto a pagamento. |
| Tic Tok Men RetroDrums e Moogdrums | Licenza dichiarata solo come «free use», senza testo: non verificabile. |
| 808TK (Wave Alchemy 808 Tape) | I campioni sono di Wave Alchemy con licenza propria; GPL solo lo strumento DecentSampler. |
| Greg Sullivan CP80 e Pianet T | Stessa fonte e licenza del Wurlitzer, compatibili; non serve un secondo piano elettrico ora. Restano un'alternativa. |
| VCSL TX81Z FM Piano (CC0) | Piano elettrico FM anni '80: compatibile, ma il suono a lamelle del Wurlitzer è più adatto ai generi della Jam. Resta un'alternativa. |
| zynthian-b3-sfz | Forme d'onda generate da uno script, non campioni di un organo: equivale al modello additivo che c'è già. |
| Salamander Drumkit | CC BY-SA 3.0: utilizzabile, ma preferito il CC0 di Virtuosity, più ricco di articolazioni. |
| Salamander Grand Piano V3 | CC BY 3.0, compatibile; preferito lo Steinway VCSL in CC0, più leggero. Resta un'alternativa. |

## Ancora sintetizzati

- **Rhodes.** Il «Piano elettrico» è ora un Wurlitzer; un Rhodes campionato con licenza compatibile non è stato trovato (vedi jRhodes sopra).
- **Organo.** Cercati su GitHub (sfzinstruments, FreePats, VCSL, ricerche per Hammond, tonewheel, drawbar, organ): solo organi a canne (VCSL), set a pagamento o forme d'onda generate. Un organo a ruote foniche è per natura additivo (drawbar), quindi un buon modello additivo è legittimo; da migliorare nel J5 (percussione, key click, chorus/vibrato e Leslie). Molti siti di campioni (freesound, archive.org, FreePats.zenvoid.org) non erano raggiungibili dall'ambiente di sviluppo: una ricerca lì resta da fare.
- Il ripiego sintetico (D-32) resta per ogni strumento, anche quando un campione non si carica.

Questo registro va aggiornato a ogni nuovo file.
