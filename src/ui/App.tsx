import { useEffect, useState } from 'react';
import { engine } from '../app/engine';
import { useApp } from '../app/store';
import { Board } from './Board';
import { AppFooter } from './AppFooter';
import { Transport } from './Transport';
import { RoutineEditor } from './RoutineEditor';
import { StudioShell } from './studio/StudioShell';
import { effectiveAppearance, studioAvailable } from './appearance';
import { ArpeggioPanel, ExercisePanel, HarmonyPanel, JamPanels, ChordsPanel, PresetsPanel, ScalePanel } from './panels';

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

/** Window size, kept current on resize and rotation. */
function useViewport(): { width: number; height: number } {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return size;
}

/** The essential look: one column of panels under the neck. */
function SimpleShell({ studioAllowed }: { readonly studioAllowed: boolean }) {
  const mode = useApp((s) => s.settings.mode);
  return (
    <>
      <Transport studioAllowed={studioAllowed} />
      <main className="main">
        <Board />
        <div className="panels" data-mode={mode}>
          {mode === 'harmony' ? <HarmonyPanel /> : null}
          {mode === 'arpeggio' ? <ArpeggioPanel /> : null}
          {mode === 'jam' ? <JamPanels /> : null}
          <ScalePanel />
          {mode !== 'arpeggio' ? <ExercisePanel /> : null}
          {mode === 'fretboard' ? <ChordsPanel /> : null}
          <PresetsPanel />
        </div>
        <AppFooter />
      </main>
    </>
  );
}

/**
 * Both looks render the same components over the same store, so switching
 * keeps playback, chords, scales and exercises exactly as they are.
 */
export function App() {
  const preference = useApp((s) => s.settings.appearance);
  const editorOpen = useApp((s) => s.editorOpen);
  const setEditorOpen = useApp((s) => s.setEditorOpen);
  const { width, height } = useViewport();
  const allowed = studioAvailable(width, height);
  const appearance = effectiveAppearance(preference, width, height);
  useShortcuts();
  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
  }, [appearance]);
  return (
    <>
      {appearance === 'studio' ? <StudioShell studioAllowed={allowed} /> : <SimpleShell studioAllowed={allowed} />}
      <RoutineEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
