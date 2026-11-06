# Contribuire a Guitar Theory Lab

Grazie per l'interesse. Guitar Theory Lab è gratuito e open source, sotto licenza GNU GPL 3.0 o successiva (`LICENSE`).

## Licenza dei contributi

Inviando una pull request accetti che il tuo contributo sia distribuito sotto la stessa licenza del progetto, GPL-3.0-or-later. Non inviare codice, campioni audio, immagini o modelli di cui non possiedi i diritti o che hanno una licenza incompatibile. Per campioni e modelli indica sempre la fonte e la licenza.

## Prima di iniziare

- Leggi `PROJECT_STATE.md` e `docs/ROADMAP.md` per sapere cosa è in corso.
- I requisiti sono in `docs/MASTER_SPEC.md`, le scelte già fatte in `docs/DECISIONS.md`.
- Per modifiche ampie apri prima una issue: evita lavoro doppio.

## Sviluppo

Serve Node.js 22.

```bash
npm ci
npm run dev
```

Prima di aprire una pull request:

```bash
npm run check      # lint, type-check, test unitari, build
npm run test:e2e   # test nel browser
```

## Regole del codice

- I motori in `src/{theory,fretboard,harmony,exercises,timeline,jam,persistence}` restano puri: niente DOM, niente React.
- Un solo orologio musicale: `TimelineScheduler` su `AudioContext.currentTime`. L'interfaccia non crea timer musicali.
- Ogni regola musicale nuova entra con un test su un caso da manuale.
- Forme e diteggiature vengono dal motore, mai scritte a mano nell'interfaccia.
- Interfaccia in italiano, codice e commenti in inglese.
- Nessun controllo decorativo: un pulsante deve fare quello che dice.

## Pull request

- Un branch per argomento, commit piccoli con messaggi descrittivi.
- Descrivi cosa cambia e come lo hai verificato. Se qualcosa non è stato testato (un browser, un dispositivo audio), dillo.
- La CI esegue lint, type-check, test, build ed e2e: deve essere verde.
