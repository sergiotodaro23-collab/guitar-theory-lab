# Stato del progetto

Versione 0.1.0. Ultimo aggiornamento: 6 novembre 2026.

## Verificato

Comandi: `npm run check` e `npm run test:e2e`, entrambi verdi su Chromium headless e Node 22.

| Verifica | Come | Esito |
|----------|------|-------|
| Lint, type-check strict, build | ESLint, `tsc`, Vite | Nessun errore |
| Test unitari | Vitest, 156 casi | Tutti verdi |
| Test nel browser reale | Playwright, 15 casi sulla build di produzione | Tutti verdi |
| Audio prodotto | Livello letto dall'AnalyserNode all'uscita del grafo | Picco 0,33 |
| Click rispetto allo schedule | Attacco rilevato nei campioni contro il tempo previsto, 120 BPM | Scarto costante di 6,1 ms |
| Schermo rispetto all'audio | Tempo del cambio visivo contro il tempo schedulato | Da 8 a 20 ms, al massimo circa un fotogramma |
| Griglia | Intervalli tra movimenti a 120 BPM | 0,5 s, precisione 6 decimali |
| Correttezza musicale | Spelling, accordi e forme contro valori da manuale, su 17 toniche | Tutti verdi |
| Preset | Salvataggio, ricarica pagina, caricamento, eliminazione | Tutti verdi |

## Non verificato

- Nessuno ha ascoltato il risultato: timbro e bilanciamento sono da giudicare a orecchio.
- Latenza reale di casse e cuffie: il compenso usa `outputLatency` del browser, spesso impreciso con il Bluetooth.
- Safari e Firefox: i test girano solo su Chromium.
- GitHub Actions: il workflow è scritto ma non è mai stato eseguito.

## Blocchi

- **GitHub**: nessun account collegato alla sessione di sviluppo. Il repository remoto non esiste ancora. Procedura pronta in `docs/GITHUB_AND_RELEASES.md`.
- **Specifica originale**: non disponibile. Il progetto parte dal documento di aggiornamento, quindi eventuali funzioni richieste solo nella prima versione non sono controllate.

## Funzionalità

P0, tutto presente: motore teorico, tastiera interattiva, scale e modi, CAGED, 3NPS, intervalli dalla seconda all'ottava, sequenze personalizzate, metronomo sincronizzato, evidenziazione progressiva, accordo sovrapposto, Harmonic Context Switch con sei modalità, preset di base, test.

Jam minimale, anticipato da P1: progression builder completo, 6 progressioni predefinite, trasposizione, loop, 6 pattern di comping sintetizzato, volumi, seconda scala, target tones, risoluzioni, aiuti nascondibili.

## Limitazioni note

- Cambiare metrica ferma la riproduzione.
- Tuning solo standard, 22 tasti, nessuna vista per mancini.
- La diteggiatura è euristica: da controllare sulle forme 3NPS con estensioni ampie.
- Su telefono i controlli di trasporto scorrono via con la pagina.
- Le tabelle delle avoid notes riflettono una tradizione didattica, non una regola: ogni profilo è modificabile in `src/harmony/function.ts`.

## Prossimi passi (P1)

1. Collegare GitHub e controllare la prima esecuzione della CI.
2. Ascolto e taratura dei volumi con la chitarra in mano.
3. Chord Builder con estensioni libere e note personalizzate sulla tastiera.
4. Arpeggi e rivolti come nuovo tipo di esercizio.
5. Preset di sole progressioni, separati da quelli di studio.
