# Campioni audio: fonti, licenze, conversione

Registro J2 del piano (`docs/FINAL_PLAN.md`), decisione D-60. Ogni file in `public/samples/` viene da una fonte pubblica fissata a un commit, con licenza compatibile con GPL-3.0-or-later, ed è rigenerabile con `python3 tools/samples/build_samples.py` (servono ffmpeg e numpy; i download finiscono in una cache locale).

## Inclusi

| Set | Strumento | Fonte (commit) | Licenza | Autore | Contenuto convertito |
|---|---|---|---|---|---|
| `drums` | Batteria acustica (kit jazz da club, bacchette) | [sfzinstruments/virtuosity_drums](https://github.com/sfzinstruments/virtuosity_drums) `9f04cf9` | CC0 1.0 | Versilian Studios, batterista Austin McMahon | 13 voci: cassa, rullante (12 dinamiche × 3), cross-stick, rimshot, hi-hat chiuso/mezzo/aperto/pedale, ride, campana del ride, crash, tom alto e basso; da 3 a 12 velocity layer e da 3 a 4 round robin. Mix fisso dei microfoni close (cassa, rullante), overhead e room. |
| `piano` | Pianoforte a coda Steinway B | [sgossner/VCSL](https://github.com/sgossner/VCSL) `c1ea7bc` | CC0 1.0 | Versilian Studios (VCSL) | Microfoni vicini mixati in mono, senza pedale, a toni interi da A#0 a E7 (40 note), 3 velocity layer; code tagliate a 5 s nei bassi, 3,5 s nel centro, 2,5 s negli acuti. La fonte normalizza ogni layer: la dinamica la ricostruisce il sampler con una curva di velocity. L'accordatura «stirata» del piano è conservata. |
| `ebass` | Basso elettrico Squier Jazz Bass, diretto | [sfzinstruments/karoryfer.growlybass](https://github.com/sfzinstruments/karoryfer.growlybass) `4f48326` | CC0 1.0 | Karoryfer Lecolds | Per terze minori da E1 a Eb4 (13 note): sustain con 4 dinamiche (pp, p, f, ff) × 2 round robin, staccato × 3 round robin. |
| `upright` | Contrabbasso pizzicato | [sfzinstruments/karoryfer.meatbass](https://github.com/sfzinstruments/karoryfer.meatbass) `ac9e859` | CC0 1.0 | Karoryfer Lecolds | Per terze minori da A0 a C4 (14 note), 4 dinamiche × 2 round robin. |

Totale circa 11 MB in Opus (Ogg): batteria 3,6 MB, piano 3,3 MB, basso elettrico 2,3 MB, contrabbasso 1,9 MB. Decodificati per intero occuperebbero in memoria 116, 83, 53 e 54 MB (float a 32 bit, 48 kHz): per questo l'app non li carica mai per intero (vedi sotto).

CC0 non obbliga ad attribuire: gli autori sono comunque citati qui e nell'app.

## Conversione

- Ogni file viene scaricato dal commit fissato e decodificato a 48 kHz.
- La batteria mescola i microfoni di ogni colpo: per cassa e rullante close 1,0/0,9, overhead 0,45/0,6, room 0,3; per piatti e tom solo overhead e room.
- Il silenzio iniziale viene tagliato (con 2 ms di margine prima dell'attacco), poi la coda sotto −62 dB, entro una durata massima per voce, con una dissolvenza di 50 ms.
- **Un solo guadagno per strumento**, così i velocity layer conservano la dinamica registrata. Verifica: per ogni voce della batteria il livello cresce con il layer, per esempio cassa −38,6 → −10,0 dB e rullante −50,5 → −16,9 dB su 12 layer.
- **Controllo dell'intonazione** sulle note intonate, tra 0,12 e 0,42 s dopo l'attacco (più a lungo sulle note basse). La frequenza viene cercata entro mezza ottava dall'etichetta: conferma la nota e misura i cent. L'ottava di ogni libreria è stata controllata a mano su note campione: Growlybass chiama E2 il Mi basso a vuoto (MIDI 28); Meatbass e VCSL usano l'altezza reale (C4 = 60).
- Per basso elettrico e contrabbasso ogni nota riceve una correzione (`tune`, mediana delle zone sostenute) solo se le zone concordano entro 8 cent. Il pianoforte non viene corretto.
- Codifica in Opus: 96 kbps stereo per la batteria, 56 kbps mono per piano e bassi.

## Nell'app (J1)

- **Quali suoni.** Kit «Acustica» → batteria campionata; basso «Elettrico a dita» e «Elettrico col plettro» → Growlybass (col plettro con un'enfasi di presenza a 2,2 kHz); «Contrabbasso» → Meatbass; comping «Pianoforte» (prima «Tastiera») → Steinway. Kit elettronico e spazzole, synth bass, piano elettrico, organo, chitarra pulita e pad restano sintetizzati.
- **Voci della batteria.** Cassa, rullante, hi-hat chiuso e aperto, ride come nei pattern; il battito di mani diventa cross-stick (in un kit acustico la clave si suona sul cerchio); la riga dei tom va sul tom alto, gli accenti sul timpano. Un hi-hat chiuso o di pedale strozza l'aperto che sta suonando.
- **Scelta della zona** (`src/audio/samplerMap.ts`, puro e testato): radice registrata più vicina (a pari distanza la più alta, trasposta verso il basso), velocity layer, round robin che ruota senza ripetere lo stesso campione due volte di fila. La correzione `tune` è tolta dalla velocità di riproduzione. Il piano, normalizzato dalla fonte, prende il livello da una curva quadratica (−12 dB a metà velocity, minimo −33 dB); gli altri set conservano la dinamica registrata con una piccola correzione dentro il layer. Il basso elettrico suona staccato le note più brevi di 0,22 s.
- **Caricamento pigro** (`src/audio/sampler.ts`): nulla si scarica prima che parta l'audio; poi solo le zone (con tutti i loro round robin) usate dalle note della Jam e del suono scelto. Con la progressione predefinita meno della metà delle zone di ogni set (verificato in `e2e/samples.spec.ts`). Cambiare suono o progressione carica ciò che manca; le zone già decodificate restano in memoria fino alla chiusura della pagina (limite da rivedere in Q6).
- **Ripiego.** Finché una zona non è pronta, o se il file non si carica o il browser non decodifica Opus in Ogg (Safari prima della 18.4), la nota suona con la ricetta sintetica (D-32), senza errori. Un accordo è tutto campionato o tutto sintetico, mai misto.
- **Livelli.** Una correzione per set porta il livello RMS dei canali entro 3 dB sotto quello sintetico misurato sugli strumenti di misura del mixer (batteria −2,3 dB, basso −3,2 dB, piano −3,1 dB), così il bilanciamento non salta quando arrivano i campioni.
- **Polifonia.** Al massimo 64 voci: oltre, le più vecchie sfumano in 20 ms.

Stato: implementato e testato in Chromium (unità e e2e con segnale reale sui canali); non ancora ascoltato dal proprietario.

## Scartati

| Candidato | Motivo |
|---|---|
| jRhodes3 (Rhodes Mark I) | Licenza dei campioni CC BY-NC 4.0: la clausola non commerciale non è compatibile con la GPL né con la ridistribuzione libera. |
| Salamander Drumkit | CC BY-SA 3.0: utilizzabile, ma preferito il CC0 di Virtuosity, più ricco di articolazioni. |
| Salamander Grand Piano V3 | CC BY 3.0, compatibile; preferito lo Steinway VCSL in CC0, più leggero. Resta un'alternativa. |

## Ancora sintetizzati

- **Piano elettrico e organo.** Non è stato trovato un Rhodes o un Wurlitzer campionato in CC0 o CC-BY. Il piano elettrico resta sintetizzato (D-32) e la ricerca prosegue.
- **Organo.** Un organo a ruote foniche è per natura additivo (drawbar), quindi un buon modello additivo è legittimo; da migliorare nel J5.
- Il ripiego sintetico (D-32) resta per ogni strumento, anche quando un campione non si carica.

Questo registro va aggiornato a ogni nuovo file.
