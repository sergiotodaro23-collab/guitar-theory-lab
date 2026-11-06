import { useEffect } from 'react';
import { engine } from '../app/engine';
import { useApp } from '../app/store';
import { Board } from './Board';
import { Transport } from './Transport';
import { ExercisePanel, HarmonyPanel, JamPanels, OverlayPanel, PresetsPanel, ScalePanel } from './panels';

function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, button, [role="button"]') && event.key === ' ') return;
      if (target?.closest('input, select, textarea')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          engine.toggle();
          break;
        case 'n':
        case 'N':
          engine.changeChord(1);
          break;
        case 'p':
        case 'P':
          engine.changeChord(-1);
          break;
        case '+':
        case '=':
          engine.nudgeBpm(1);
          break;
        case '-':
          engine.nudgeBpm(-1);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const mode = useApp((s) => s.settings.mode);
  useShortcuts();
  return (
    <>
      <Transport />
      <main className="main">
        <Board />
        <div className="panels" data-mode={mode}>
          {mode === 'harmony' ? <HarmonyPanel /> : null}
          {mode === 'jam' ? <JamPanels /> : null}
          <ScalePanel />
          <ExercisePanel />
          {mode === 'fretboard' ? <OverlayPanel /> : null}
          <PresetsPanel />
        </div>
        <footer className="foot">
          <p>Spazio avvia e mette in pausa. N e P cambiano accordo. + e − regolano il BPM.</p>
          <p className="legal" data-testid="license-notice">
            © 2026 Sergio Todaro. Software libero sotto licenza GNU GPL 3.0 o successiva, senza alcuna garanzia.{' '}
            <a href="https://github.com/sergiotodaro23-collab/guitar-theory-lab" target="_blank" rel="noreferrer">Codice sorgente</a>
          </p>
        </footer>
      </main>
    </>
  );
}
