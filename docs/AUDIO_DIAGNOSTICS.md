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
