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
        <footer className="foot">Spazio avvia e mette in pausa. N e P cambiano accordo. + e − regolano il BPM.</footer>
      </main>
    </>
  );
}
