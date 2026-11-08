/**
 * Overlay shell for the physical devices (handoff DeviceDrawer, D-42
 * geometry). It covers the whole notebook zone, right of the rail and under
 * the divider, with an opaque rack panel that rises from the bottom edge; the
 * neck and the notebook underneath never move. One device at a time;
 * switching replaces it with no exit animation. Escape and the close key
 * close it; focus goes to the close key on open and back to the launcher on
 * close; reduced motion fades only.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { DeviceId } from './uiStore';

/** Exit animation length plus a margin (handoff `motion.unmountAfterMs`). */
const UNMOUNT_AFTER_MS = 260;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface DeviceDrawerProps {
  readonly device: DeviceId | null;
  readonly label: string;
  readonly onClose: () => void;
  readonly returnFocusTo: HTMLElement | null;
  readonly compactLevel: 0 | 1 | 2;
  readonly children: ReactNode;
}

export function DeviceDrawer({ device, label, onClose, returnFocusTo, compactLevel, children }: DeviceDrawerProps) {
  const [shown, setShown] = useState<DeviceId | null>(device);
  const [closing, setClosing] = useState(false);
  const [content, setContent] = useState<{ label: string; children: ReactNode }>({ label, children });
  const closeRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // While open the content follows the props; while closing, the last device stays drawn as it slides out.
  useLayoutEffect(() => {
    if (device) setContent({ label, children });
  }, [device, label, children]);

  useLayoutEffect(() => {
    if (device) {
      window.clearTimeout(timer.current);
      setClosing(false);
      setShown(device);
      return;
    }
    if (!shown) return;
    if (prefersReducedMotion()) {
      setShown(null);
      return;
    }
    setClosing(true);
    timer.current = window.setTimeout(() => { setShown(null); setClosing(false); }, UNMOUNT_AFTER_MS);
  }, [device]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Focus: the close key once open (without scrolling the notebook), the launcher once gone.
  const wasShown = useRef(false);
  useEffect(() => {
    if (shown && !closing) {
      wasShown.current = true;
      const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 40);
      return () => window.clearTimeout(t);
    }
    if (!shown && wasShown.current) {
      wasShown.current = false;
      returnFocusTo?.focus({ preventScroll: true });
    }
    return undefined;
  }, [shown, closing, returnFocusTo]);

  useEffect(() => {
    if (!shown || closing) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // A select or the routine editor handles its own Escape.
      if ((e.target as HTMLElement | null)?.closest('dialog[open]')) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, closing, onClose]);

  if (!shown) return null;
  return (
    <div className="v57-dvx" data-out={closing ? '1' : '0'} data-c={String(compactLevel)} data-testid="device-drawer" data-device={shown}>
      <div className="v57-dvl">
        <section className="v57-dv" role="dialog" aria-label={content.label} key={shown}>
          <button ref={closeRef} type="button" className="v57-dclose" aria-label={`Chiudi ${content.label}`} data-testid="device-close" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
          {content.children}
        </section>
      </div>
    </div>
  );
}
