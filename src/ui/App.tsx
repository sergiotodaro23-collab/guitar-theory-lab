import { useEffect, useState } from 'react';
import { engine } from '../app/engine';
import { useApp } from '../app/store';
import { RoutineEditor } from './RoutineEditor';
import { SimpleShell } from './simple/SimpleShell';
import { StudioShell } from './studio/StudioShell';
import { effectiveAppearance, studioAvailable } from './appearance';

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

/**
 * Both looks render the same components over the same store, so switching
 * keeps playback, chords, scales and exercises exactly as they are.
 */
export function App() {
  const look = useApp((s) => s.settings.look);
  const editorOpen = useApp((s) => s.editorOpen);
  const setEditorOpen = useApp((s) => s.setEditorOpen);
  const { width, height } = useViewport();
  const allowed = studioAvailable(width, height);
  const appearance = effectiveAppearance(look, width, height);
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
