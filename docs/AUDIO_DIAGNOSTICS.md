# Diagnostica audio: chitarra, ascolto e uscita

Procedura per quando la chitarra non si sente, non viene rilevata o arriva in ritardo. Verificata in e2e solo con un microfono simulato (file WAV): **nessuna prova con hardware reale è ancora registrata** in `docs/QA_REPORT.md`.

Nota (D-25): l'ascolto riproduce il segnale **pulito** (DI) della chitarra. Un suono senza amplificatore non è un guasto: amp modeling, cabinet ed effetti sono funzioni future (P4-01, P4-02).

## Come scorre il segnale

```
Scheda audio → browser (getUserMedia, senza cancellazione eco, soppressione rumore, gain automatico)
  → Canale della chitarra (Entrambi | Canale 1 | Canale 2) → mono
  → Gain d'ingresso ──→ Analisi (YIN): nota, accordatore, tastiera
                    └─→ Ascolto (spento a ogni avvio) → fader Chitarra → Master → uscita del sistema
Click, Note, Accordi, Basso, Batteria → i loro fader → Master → uscita del sistema
```

L'analisi lavora sempre sul segnale pulito dopo il gain: l'ascolto, il fader Chitarra e il Master non cambiano il rilevamento.

**Due gain d'ingresso (dal 17 novembre 2026).** Dopo la scelta del canale il segnale si divide in due rami, ciascuno con il suo `GainNode` (`src/audio/liveInput.ts`):

```
canale scelto (mono) ─┬─ Gain Detection (`inputGain`) ─→ analizzatore, worklet di cattura, registrazioni di calibrazione, misuratore d'ingresso
                      └─ Gain Rig (`rigGain`) ────────→ rig (pedali, amplificatore o NAM, cabinet) ─→ ascolto ─→ Master
```

- **Gain Detection** cambia solo l'ampiezza che vedono tracking, accordatore e calibrazione. La calibrazione continua a regolare questo gain (`inputGain` nei profili).
- **Gain Rig** cambia solo il livello che entra nel rig, prima del suo primo stadio.
- Nessuno dei due è il volume dell'ascolto, il Master, il gain d'ingresso del modello NAM (manopola Gain/Input della testata) o il gain fisico della scheda.
- Entrambi partono a 0 dB. Le impostazioni salvate prima della separazione avevano un solo gain: il rig eredita quel valore, così il livello di nessuno cambia.
- Predisposto per la futura barra destra (pannello Scheda audio con le due manopole, pannello Rilevazione note): i due rami sono già separati, la grafica potrà spostare le manopole senza toccare il grafo.

## Passi

1. **Uscita.** In *Ingresso → Diagnostica audio* premi *Suono di prova*. Se non senti il La, il problema è a valle dell'app: dispositivo di uscita del sistema operativo (le cuffie devono essere collegate al dispositivo che il sistema usa come uscita, spesso la scheda audio USB), volume del sistema e della scheda, fader Master.
2. **Permesso.** Se compare "Permesso al microfono negato", consentilo dalle impostazioni del sito (icona del lucchetto nella barra degli indirizzi) e riavvia l'ingresso. Serve HTTPS o `localhost`.
3. **Dispositivo.** Dopo l'avvio, scegli in *Dispositivo* la scheda audio: il browser parte spesso dal microfono del computer.
4. **Canale.** Molte schede hanno l'ingresso strumento sul canale 2 (o 1) di un flusso stereo. Se il livello resta basso o l'ascolto si sente da un lato solo, prova *Canale 1* e *Canale 2*. *Entrambi* fa la media dei due: con la chitarra su un solo canale il livello si dimezza ma resta valido. La diagnostica mostra quanti canali dichiara il dispositivo.
5. **Livello.** Suona: la barra del livello e i LED del canale Chitarra devono muoversi. Se compare "Segnale saturo", abbassa il gain della scheda o dell'app; se compare "Segnale debole", alzalo.
6. **Ascolto.** Premi *Ascolta* (mixer) o *Ascolta la chitarra* (pannello). Usa le cuffie: con le casse il microfono riprende l'uscita e fischia. Se non senti nulla, controlla i fader Chitarra e Master e ripeti il passo 1.
7. **Ascolto diretto della scheda.** Se la scheda ha il *direct monitor*, usare quello dà latenza quasi nulla; in quel caso lascia spento l'ascolto dell'app per non sentire la chitarra due volte.
8. **Audio sospeso.** Se compare "L'audio del browser è sospeso", fai clic nella pagina o premi Avvia, poi riavvia l'ingresso.
9. **Frequenza di campionamento.** Se la diagnostica segnala un ingresso ricampionato, imposta la stessa frequenza (44,1 o 48 kHz) per la scheda nel sistema operativo: riduce latenza e artefatti. Firefox può rifiutare un ingresso a frequenza diversa dal contesto audio.

## Latenze

La diagnostica riporta solo ciò che il browser dichiara: latenza di base e latenza d'uscita del contesto audio. La latenza d'ingresso non è esposta dalle API web e non viene presentata come misurata. La calibrazione empirica è pianificata in `docs/ROADMAP.md` (P3-10).

## Cosa riportare in un'issue

Sistema operativo e browser con versione, modello della scheda, dati della sezione *Diagnostica audio*, quale passo fallisce, se il suono di prova si sente.

## Sensibilità e calibrazione (Live Monitor 2.0, D-31)

- **Sensibilità**: Precisa per note tenute e accordatura, Bilanciata come compromesso, Rapida per legati e passaggi veloci (più sensibile ai rumori). Se compaiono note fantasma, passa a Bilanciata o Precisa, oppure rifai il passo "Silenzio" della calibrazione.
- **Calibrazione**: crea un profilo (chitarra, pickup, scheda, canale), poi esegui i quattro passi con l'ingresso avviato. Ogni valore indica se è misurato o impostato a mano; "Ripristina" torna ai valori di partenza.
- **Posizione stimata**: è una stima. Con una nota isolata non viene mostrata nessuna posizione piena; con alcune note di contesto segue la mano. La forma mostrata sulla tastiera è solo un indizio.

## Selezione dispositivi (B1)

Stato: **testato con dispositivi simulati; non verificato con scheda audio reale.** I test e2e (`e2e/device-selection.spec.ts`) stubbano elenco dispositivi, permesso del microfono e `setSinkId` nella pagina. Chromium headless non ha uscite reali né interfacce audio.

Cosa fa l'interfaccia, nel pannello Ingresso (un solo componente, `DeviceFields`):

- **Ingresso**: l'elenco è pronto anche prima di avviare l'ingresso (`enumerateDevices` su montaggio e su `devicechange`). Senza permesso del microfono il browser non dà i nomi: i dispositivi appaiono come «Ingresso n» con l'indicazione di avviare l'ingresso.
- **Dispositivo salvato mancante**: se il browser risponde `OverconstrainedError` (id scaduto o dispositivo scollegato), l'ingresso riparte col predefinito e mostra «Dispositivo salvato non trovato». La scelta salvata non viene sovrascritta.
- **Disconnessione durante l'uso**: quando la traccia termina, il messaggio dice che l'ingresso si è disconnesso dal sistema (non più il generico «occupato»).
- **Uscita**: se il browser ha `AudioContext.prototype.setSinkId` (Chromium), il motore instrada l'uscita sul dispositivo scelto, alla creazione del contesto e a ogni cambio. Altrimenti il selettore non compare e il pannello dice che si usa l'uscita di sistema. Il valore è `outputDeviceId`: è un id della macchina, quindi **non entra mai in un preset di studio**.
- **Permesso**: stato letto con `navigator.permissions.query({ name: 'microphone' })` dentro try/catch e aggiornato con `onchange`. Se negato, una riga spiega come riabilitarlo.
- **Latenza**: sola visualizzazione. Ingresso (`track.getSettings().latency`, se dichiarato), latenza base e di uscita del contesto, e un totale marcato «stima del browser». Se la frequenza del dispositivo è diversa da quella del contesto, un avviso dice che il browser ricampiona.

### Cosa non si può regolare (e perché non c'è un controllo)

- **Dimensione del buffer**: la Web Audio API non espone né imposta la dimensione del buffer. Si può solo chiedere un compromesso con `latencyHint` (`'interactive'`, `'balanced'`, `'playback'`), e **solo alla creazione del contesto**. Il motore usa `'interactive'`. Cambiarlo richiederebbe di ricreare il contesto, che è il clock unico del `TimelineScheduler`, e la pipeline NAM assume nessun ricampionamento: per questo non c'è un selettore.
- **Frequenza di campionamento**: il contesto usa la frequenza che il sistema gli assegna; la scelta richiederebbe anch'essa un contesto nuovo. Il pannello mostra la frequenza e avvisa del ricampionamento, senza controllarla.
- **Uscita su browser senza `setSinkId`** (Safari, Firefox secondo la versione): nessun selettore; l'uscita è quella di sistema.

### Da verificare con hardware reale (non fatto)

Nomi reali delle interfacce, comportamento alla rimozione fisica del cavo, `setSinkId` con una cuffia USB diversa dal predefinito, permesso del microfono dopo il riavvio del browser, valori di latenza riportati dal sistema.
