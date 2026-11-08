/**
 * Jam Studio drum step sequencer, Simple level (D-19): six kit pieces × 16
 * sixteenth steps, four patterns A–D and a fill. A press cycles a step off →
 * on → accent; arrows move between steps, up and down between kit pieces.
 * Edits and pattern changes are heard from the next bar line.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { meterOf } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import {
  DEFAULT_KIT, DRUM_STEPS, DRUM_VOICES, PATTERN_NAMES, emptyPattern, nextDrumStep, sixteenthsPerBar,
  type DrumKit, type DrumPattern, type DrumStep, type DrumVoice,
} from '../jam';
import { Field, Panel, Segmented, Select, Toggle } from './controls';

type Target = 0 | 1 | 2 | 3 | 'fill';
const STEP_NAMES: Record<DrumStep, string> = { 0: 'spento', 1: 'acceso', 2: 'accento', 3: 'nota fantasma' };
const FILL_OPTIONS = [
  { value: 0 as const, label: 'Mai' },
  { value: 2 as const, label: 'Ogni 2 battute' },
  { value: 4 as const, label: 'Ogni 4 battute' },
  { value: 8 as const, label: 'Ogni 8 battute' },
];

const patternOf = (kit: DrumKit, target: Target): DrumPattern => (target === 'fill' ? kit.fill : kit.patterns[target]);

function withPattern(kit: DrumKit, target: Target, pattern: DrumPattern): DrumKit {
  if (target === 'fill') return { ...kit, fill: pattern };
  const patterns = [...kit.patterns] as [DrumPattern, DrumPattern, DrumPattern, DrumPattern];
  patterns[target] = pattern;
  return { ...kit, patterns };
}

export function DrumPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const drumStep = usePlayhead((p) => p.drumStep);
  const drumFill = usePlayhead((p) => p.drumFill);
  const [target, setTarget] = useState<Target>(s.drumPattern as Target);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pattern = patternOf(s.drumKit, target);
  const barSteps = sixteenthsPerBar(meterOf(s));
  // The step light follows the grid being edited only when that grid is the one playing.
  const playingHere = target === 'fill' ? drumFill : !drumFill && target === s.drumPattern;
  const now = playingHere ? drumStep : null;

  const setStep = (voice: DrumVoice, index: number, value: DrumStep) => {
    const row = pattern[voice].slice();
    row[index] = value;
    update({ drumKit: withPattern(s.drumKit, target, { ...pattern, [voice]: row }) });
  };
  const onKey = (event: KeyboardEvent, row: number, index: number) => {
    const voice = DRUM_VOICES[row]?.voice;
    if (!voice) return;
    const move = (r: number, i: number) => refs.current[`${r}-${i}`]?.focus();
    if (event.key === 'ArrowRight') move(row, (index + 1) % DRUM_STEPS);
    else if (event.key === 'ArrowLeft') move(row, (index + DRUM_STEPS - 1) % DRUM_STEPS);
    else if (event.key === 'ArrowDown') move((row + 1) % DRUM_VOICES.length, index);
    else if (event.key === 'ArrowUp') move((row + DRUM_VOICES.length - 1) % DRUM_VOICES.length, index);
    else return;
    event.preventDefault();
  };

  const half = (from: number) => (
    <div className="drum-half" role="rowgroup">
      {DRUM_VOICES.map(({ voice, label }, row) => (
        <div className="drum-row" role="row" key={voice}>
          <span className="drum-voice" role="rowheader">{label}</span>
          {Array.from({ length: DRUM_STEPS / 2 }, (_, k) => {
            const i = from + k;
            const step = pattern[voice][i] ?? 0;
            const out = i >= barSteps;
            return (
              <button
                key={i}
                ref={(el) => { refs.current[`${row}-${i}`] = el; }}
                type="button"
                role="gridcell"
                className={`drum-step step-${step} ${i % 4 === 0 ? 'is-beat' : ''} ${now === i ? 'is-now' : ''}`}
                disabled={out}
                data-testid={`drum-${voice}-${i}`}
                data-step={step}
                aria-label={`${label}, passo ${i + 1}: ${out ? 'fuori dalla battuta' : STEP_NAMES[step]}`}
                onClick={() => setStep(voice, i, nextDrumStep(step))}
                onKeyDown={(e) => onKey(e, row, i)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <Panel title="Batteria" className="panel-wide drum-panel">
      <div className="row drum-controls">
        <Toggle checked={s.drumOn} onChange={(drumOn) => update({ drumOn })}>Suona la batteria</Toggle>
        <Field label="In riproduzione" group>
          <Segmented<number>
            label="Pattern in riproduzione"
            value={s.drumPattern}
            options={PATTERN_NAMES.map((name, i) => ({ value: i, label: name }))}
            onChange={(drumPattern) => { update({ drumPattern }); setTarget(drumPattern as Target); }}
          />
        </Field>
        <Field label="Fill">
          <Select label="Fill" testId="drum-fill-every" value={s.drumFillEvery} options={FILL_OPTIONS} onChange={(drumFillEvery) => update({ drumFillEvery })} />
        </Field>
      </div>
      <div className="row drum-controls">
        <Field label="Modifica" group>
          <Segmented<Target>
            label="Pattern da modificare"
            value={target}
            options={[...PATTERN_NAMES.map((name, i) => ({ value: i as Target, label: name })), { value: 'fill' as const, label: 'Fill' }]}
            onChange={setTarget}
          />
        </Field>
        <button type="button" className="btn" onClick={() => update({ drumKit: withPattern(s.drumKit, target, emptyPattern()) })}>Svuota</button>
        <button type="button" className="btn" onClick={() => update({ drumKit: withPattern(s.drumKit, target, patternOf(DEFAULT_KIT, target)) })}>Ripristina</button>
      </div>
      {barSteps > DRUM_STEPS ? (
        <p className="field-hint">La battuta ha {barSteps} sedicesimi: dopo il sedicesimo il pattern riparte dal primo passo.</p>
      ) : null}
      <div className="drum-grid" role="grid" aria-label={`Griglia del pattern ${target === 'fill' ? 'Fill' : PATTERN_NAMES[target]}`} data-testid="drum-grid">
        {half(0)}
        {half(DRUM_STEPS / 2)}
      </div>
      <p className="field-hint">Tocca un passo: acceso, poi accento, poi spento. Le modifiche entrano alla battuta successiva.</p>
    </Panel>
  );
}
