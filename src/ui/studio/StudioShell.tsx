/**
 * Studio V6 shell (D-43) over the V5.7 console (D-41): a global header
 * across the window, then the rail, the work column and the rig rack. In the work column: the transport console with
 * its pull-tab, the neck, the divider, the notebook zone and the mixer
 * handle; the mixer rises over the notebook only.
 *
 * Studio (D-41): the V5.7 console. A physical rail, the hi-fi console with
 * its amber LCD, the production neck with a draggable divider, and a tabbed
 * notebook from whose bottom edge the devices rise. A presentation of the
 * same store and engine as Semplificata: nothing musical is decided here.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MixerShown } from '../panels';
import { Console } from './v57/Console';
import { FretboardPanel } from './v57/FretboardPanel';
import { DeviceBay, Notebook } from './v57/Notebook';
import { Rail } from './v57/Rail';
import { Header } from './v6/Header';
import { MixerHandle } from './v6/MixerHandle';
import { Rack } from './v6/Rack';
import { DEFAULT_SPLIT, FB_MIN, clampRatio, splitHeight } from './v57/layout';
import { useStudioUi } from './v57/uiStore';
import './v57/fonts.css';
import './v57/v57.css';
import './v57/devices.css';
import './v6/v6.css';

const SPLIT_PX = 14;
const GAP = 6;
/** Height of the mixer handle under the notebook zone. */
const HANDLE_PX = 26;

function useBox<T extends HTMLElement>(): [(el: T | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height }); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, size];
}

export function StudioShell({ studioAllowed }: { readonly studioAllowed: boolean }) {
  const split = useStudioUi((u) => u.split);
  const setSplit = useStudioUi((u) => u.setSplit);
  const [workRef, work] = useBox<HTMLDivElement>();
  const [deckRef, deck] = useBox<HTMLDivElement>();
  const [legendHost, setLegendHost] = useState<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  // Leaving Studio closes its panels and drawer, so coming back starts clean (no exit animation on mount).
  useEffect(() => () => { useStudioUi.setState({ settingsOpen: false, vizOpen: false, metroOpen: false, device: null, launcher: null }); }, []);
  const drag = useRef<{ y: number; h: number } | null>(null);

  // Space under the console shared by the neck and the notebook.
  const available = Math.max(0, work.h - deck.h - SPLIT_PX - HANDLE_PX - GAP * 4);
  const boardWidth = Math.max(0, work.w - 28 - 20);
  const fbh = work.h > 0 ? splitHeight(split, available, boardWidth) : 300;
  const max = work.h > 0 ? splitHeight(1, available, boardWidth) : 300;
  const setHeight = useCallback((h: number) => {
    if (available <= 0) return;
    setSplit(clampRatio(Math.max(FB_MIN, Math.min(max, h)) / available));
  }, [available, max, setSplit]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: fbh };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setHeight(drag.current.h + e.clientY - drag.current.y);
  };
  const endDrag = () => { drag.current = null; setDragging(false); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowUp: -12, ArrowDown: 12, PageUp: -60, PageDown: 60 };
    if (e.key in moves) setHeight(fbh + (moves[e.key] ?? 0));
    else if (e.key === 'Home') setHeight(FB_MIN);
    else if (e.key === 'End') setHeight(max);
    else return;
    e.preventDefault();
  };

  return (
    <MixerShown.Provider value>
      <div className="v57 v6" data-testid="studio" data-drag={dragging ? '1' : '0'}>
        <Header />
        <div className="v57-desk">
          <Rail studioAllowed={studioAllowed} />
          <div className="v57-work" ref={workRef}>
            <div ref={deckRef} className="v57-deck-box"><Console /></div>
            <FretboardPanel height={fbh} legendHost={legendHost} />
            <div
              className="v57-split"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Divisore tra tastiera e taccuino: trascina o usa le frecce su e giù"
              tabIndex={0}
              aria-valuemin={FB_MIN}
              aria-valuemax={Math.round(max)}
              aria-valuenow={Math.round(fbh)}
              aria-valuetext={`Tastiera alta ${Math.round(fbh)} pixel`}
              data-testid="divider"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKey}
              onDoubleClick={() => setSplit(DEFAULT_SPLIT)}
            ><i aria-hidden="true" /></div>
            <div className="v57-nbzone" data-testid="notebook-zone">
              <Notebook onLegendHost={setLegendHost} />
              <DeviceBay />
            </div>
            <MixerHandle />
          </div>
          <Rack />
        </div>
      </div>
    </MixerShown.Provider>
  );
}
