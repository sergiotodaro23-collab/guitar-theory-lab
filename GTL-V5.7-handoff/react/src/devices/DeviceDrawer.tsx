import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DeviceId } from '../types';
import { motion } from '../tokens';

/**
 * Overlay shell for the physical devices. Mount it as the LAST child of the notebook container
 * (position:relative; overflow:hidden). The notebook page underneath never moves.
 * - one device at a time (switching replaces the child without an exit animation)
 * - Escape closes, focus goes to the close control on open and back to the launcher on close
 * - prefers-reduced-motion: fade only, immediate close
 */
export interface DeviceDrawerProps {
  device: DeviceId | null;
  onClose(): void;
  label: string;
  /** element that opened the drawer; focus returns to it */
  returnFocusTo?: HTMLElement | null;
  /** 0 = roomy, 1 = compact, 2 = tight (notebook height < 350 px) */
  compactLevel?: 0 | 1 | 2;
  children: React.ReactNode;
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function DeviceDrawer({ device, onClose, label, returnFocusTo, compactLevel = 0, children }: DeviceDrawerProps) {
  const [shown, setShown] = useState<DeviceId | null>(device);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // follow the controlled `device` prop, playing the exit animation when it becomes null
  useLayoutEffect(() => {
    if (device) { window.clearTimeout(timer.current); setClosing(false); setShown(device); return; }
    if (!shown) return;
    if (prefersReducedMotion()) { setShown(null); return; }
    setClosing(true);
    timer.current = window.setTimeout(() => { setShown(null); setClosing(false); }, motion.unmountAfterMs);
  }, [device]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // focus management
  useEffect(() => {
    if (shown && !closing) { const t = window.setTimeout(() => closeRef.current?.focus(), 40); return () => window.clearTimeout(t); }
    if (!shown && returnFocusTo) returnFocusTo.focus();
    return undefined;
  }, [shown, closing, returnFocusTo]);

  const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape' && shown) { e.stopPropagation(); onClose(); } }, [shown, onClose]);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);

  if (!shown) return null;
  return (
    <div className="gtl-dvx" data-out={closing ? '1' : '0'} data-c={String(compactLevel)}>
      <button type="button" className="gtl-dvscrim" tabIndex={-1} aria-label="Chiudi il dispositivo" onClick={onClose} />
      <div className="gtl-dvl">
        <section className="gtl-dv" role="dialog" aria-label={label} key={shown}>
          <button ref={closeRef} type="button" className="gtl-dclose" aria-label={'Chiudi ' + label} onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
          {children}
        </section>
      </div>
    </div>
  );
}
