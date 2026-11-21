/** Shortcuts, licence notice and source link: shown by both looks. */
export function AppFooter() {
  return (
    <footer className="foot">
      <p>Spazio avvia e mette in pausa. N e P cambiano accordo. + e − regolano il BPM.</p>
      <p className="legal" data-testid="license-notice">
        © 2026 Sergio Todaro. Software libero sotto licenza GNU GPL 3.0 o successiva, senza alcuna garanzia.{' '}
        <a href="https://github.com/sergiotodaro23-collab/guitar-theory-lab" target="_blank" rel="noreferrer">Codice sorgente</a>
      </p>
      <p className="legal" data-testid="sample-credits">
        Campioni audio di Versilian Studios, Karoryfer Samples, MckAudio (CC0) e Wurlitzer EP200 di Greg Sullivan (CC BY 3.0), convertiti in Opus.{' '}
        <a href="https://github.com/sergiotodaro23-collab/guitar-theory-lab/blob/main/docs/AUDIO_ASSETS.md" target="_blank" rel="noreferrer">Fonti e licenze</a>
      </p>
    </footer>
  );
}
