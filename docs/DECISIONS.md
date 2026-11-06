# Decisioni di progetto

Una riga di contesto, la scelta, il perché. Le nuove in cima.

## 2026-11-06

**D-08 · Licenza GPL-3.0-or-later (approvata dal proprietario).** Il proprietario ha scelto la GPL 3.0 al posto della MIT: le versioni derivate devono restare libere. Variante "or later", come proposto: permette di adottare versioni future della GPL. `LICENSE` contiene il testo ufficiale; il piè di pagina dell'app mostra l'avviso di licenza e il link ai sorgenti, come chiede la sezione 5(d) per i programmi interattivi. Ogni dipendenza, campione o modello aggiunto deve avere una licenza compatibile con la GPL-3.0 (MIT, BSD, Apache-2.0, LGPL e GPL lo sono).

**D-07 · Percorsi a fasi come dati dichiarativi.** Un esercizio è `Routine { name, phases[] }`; ogni fase porta scala, posizione (CAGED, 3NPS o range di tasti), ottava, tipo di sequenza, direzione, note per movimento e ripetizioni. Niente linguaggio di scripting: i "blocchi" dell'editor sono i gruppi di campi di una fase. Copre gli esempi della specifica (forma C su / G giù, melodica classica, relativa minore, 3NPS diversi) ed è serializzabile nei preset senza migrazioni, grazie a `sanitizeRoutine`.

**D-06 · Ogni fase parte sul battere.** Dopo le ripetizioni la fase si chiude con pause fino alla stanghetta. Dà alla mano il tempo di cambiare posizione e rende prevedibile l'anteprima (lunghezza in battute intere).

**D-05 · Melodica classica = percorso, non scala.** La minore melodica classica cambia note secondo la direzione: non è un insieme di note ma un comportamento. La scala `melodicMinor` resta la versione jazz (uguale nei due sensi) e la classica è un percorso predefinito a due fasi.

**D-04 · Ottava alta per fase.** Le forme CAGED e 3NPS sono calcolate nella prima posizione utile; con 24 tasti la stessa forma un'ottava sopra è spesso disponibile. L'utente la sceglie esplicitamente; se esce dal 24° tasto il motore lo segnala e propone l'ottava bassa.

**D-03 · Editor avanzato come `<dialog>` nativo.** `showModal()` dà top layer, sfondo inerte, focus intrappolato, ritorno del focus al pulsante e Escape senza dipendenze. Escape e "Annulla" scartano la bozza; solo "Applica e chiudi" modifica lo stato.

**D-02 · Celle uniformi sulla tastiera.** La specifica chiede leggibilità didattica sopra il realismo: tutti i 24 tasti hanno la stessa larghezza. La tastiera è più larga (min 1000 px) e scorre in orizzontale sui viewport stretti.

**D-01 · Versione dalla sorgente unica.** La targhetta legge `package.json` tramite `define` di Vite (`__APP_VERSION__`): nessuna versione scritta a mano nell'interfaccia.

## Decisioni ereditate (v0.1.0)

- Stack: React 18, TypeScript strict, Vite, Zustand, Vitest, Playwright. Nessun Tailwind (CSS a mano con token): la specifica storica lo citava, ma cambiare ora non porta benefici dimostrati.
- Un solo clock: `TimelineScheduler` su `AudioContext.currentTime`, worker solo come sveglia.
- CAGED escluso dalla prima posizione con corde vuote (finestra minima dal tasto 1), per avere sempre un tasto libero per le estensioni. Da rivalutare quando si aggiungeranno forme aperte.
- Avoid notes per profilo dichiarato (`AvoidProfile`), mai come regola assoluta.
