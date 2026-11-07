/**
 * Click / Accenti: 16 step keys for the metronome's accents, separate from
 * the meter and from Jam Studio's drum sequencer. A press raises a step one
 * level and wraps to silent; arrows up and down set it, left and right move.
 * Steps past the end of the bar are shown but disabled.
 */
import { useRef, type KeyboardEvent } from 'react';
import { CLICK_SOUNDS } from '../audio/clickSounds';
import { meterOf } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { ACCENT_NAMES, ACCENT_STEPS, clicksPerBar, meterAccents, nextAccent, type AccentLevel } from '../timeline';
import { Select } from './controls';

export function AccentGrid() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.update);
  const state = usePlayhead((p) => p.state);
  const beat = usePlayhead((p) => p.beat);
  const sub = usePlayhead((p) => p.subdivision);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const meter = meterOf(settings);
  const count = clicksPerBar(meter, settings.subdivision);
  const levels = settings.clickAccents ?? meterAccents(meter, settings.subdivision);
  const now = state === 'stopped' ? -1 : beat * settings.subdivision + sub;

  const set = (index: number, level: AccentLevel) => {
    const next = levels.slice();
    next[index] = level;
    update({ clickAccents: next });
  };
  const onKey = (event: KeyboardEvent, index: number) => {
    const level = levels[index] ?? 0;
    if (event.key === 'ArrowUp') set(index, Math.min(3, level + 1) as AccentLevel);
    else if (event.key === 'ArrowDown') set(index, Math.max(0, level - 1) as AccentLevel);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const step = event.key === 'ArrowRight' ? 1 : -1;
      refs.current[(index + step + count) % count]?.focus();
    } else return;
    event.preventDefault();
  };

  return (
    <div className="accent-grid" role="group" aria-label="Click e accenti" data-testid="accent-grid" data-steps={count}>
      <div className="accent-head">
        <span className="accent-title">Click / Accenti</span>
        <span className="accent-source" data-testid="accent-source">{settings.clickAccents ? 'Pattern personale' : 'Dalla metrica'}</span>
        <button type="button" className="accent-reset" disabled={!settings.clickAccents} onClick={() => update({ clickAccents: null })}>
          Riporta alla metrica
        </button>
        <Select label="Timbro del click" testId="click-sound" value={settings.clickSound} options={CLICK_SOUNDS} onChange={(clickSound) => update({ clickSound })} />
      </div>
      <div className="accent-steps">
        {Array.from({ length: ACCENT_STEPS }, (_, i) => {
          const level = (levels[i] ?? 0) as AccentLevel;
          const out = i >= count;
          const beatStart = i % settings.subdivision === 0;
          return (
            <button
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              className={`accent-step level-${level} ${beatStart ? 'is-beat' : ''} ${i === now ? 'is-now' : ''}`}
              disabled={out}
              data-level={out ? undefined : level}
              data-testid={`accent-${i}`}
              aria-label={out ? `Passo ${i + 1}: fuori dalla battuta` : `Passo ${i + 1}: ${ACCENT_NAMES[level]}`}
              onClick={() => set(i, nextAccent(level))}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="accent-led" aria-hidden="true" />
              <span className="accent-num" aria-hidden="true">{beatStart && !out ? i / settings.subdivision + 1 : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
