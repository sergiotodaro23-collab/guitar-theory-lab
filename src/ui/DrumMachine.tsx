/**
 * Jam Studio drum step sequencer (D-19, J3): ten kit pieces × 16 sixteenth
 * steps a bar, four patterns A–D and a fill. A press cycles a step off → on →
 * accent → ghost; arrows move between steps, up and down between kit pieces.
 * Advanced: a pattern of 1, 2 or 4 bars (16/32/64 steps), and a per-step
 * level and chance, set with the «Tocco» switch. Edits and pattern changes
 * are heard from the next bar line.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { meterOf } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import {
  DEFAULT_KIT, DRUM_STEPS, DRUM_VOICES, PATTERN_LENGTHS, PATTERN_NAMES, STEP_CHANCES, STEP_LEVELS, emptyPattern, nextDrumStep, nextValue,
  patternBars, resizePattern, sixteenthsPerBar, stepChance, stepLevel, withStepValue,
  type DrumKit, type DrumPattern, type DrumStep, type DrumVoice, type PatternLength,
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

type Touch = 'step' | 'levels' | 'chances';
const TOUCH_OPTIONS = [
  { value: 'step' as const, label: 'Passo' },
  { value: 'levels' as const, label: 'Intensità' },
  { value: 'chances' as const, label: 'Probabilità' },
];
const LENGTH_OPTIONS = PATTERN_LENGTHS.map((value) => ({ value, label: `${value} passi · ${value / DRUM_STEPS} ${value === DRUM_STEPS ? 'battuta' : 'battute'}` }));

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
  const [touch, setTouch] = useState<Touch>('step');
  const [page, setPage] = useState(0);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pattern = patternOf(s.drumKit, target);
  const pages = patternBars(pattern);
  const shown = Math.min(page, pages - 1);
  const first = shown * DRUM_STEPS;
  const barSteps = sixteenthsPerBar(meterOf(s));
  // The step light follows the grid being edited only when that grid is the one playing.
  const playingHere = target === 'fill' ? drumFill : !drumFill && target === s.drumPattern;
  const now = playingHere ? drumStep : null;

  const setStep = (voice: DrumVoice, index: number, value: DrumStep) => {
    const row = pattern[voice].slice();
    row[index] = value;
    update({ drumKit: withPattern(s.drumKit, target, { ...pattern, [voice]: row }) });
  };
  const press = (voice: DrumVoice, index: number, step: DrumStep) => {
    // Level and chance belong to a step that plays: on an empty step the press switches it on first.
    if (touch === 'step' || step === 0) {
      setStep(voice, index, nextDrumStep(step));
      return;
    }
    const cycle = touch === 'levels' ? STEP_LEVELS : STEP_CHANCES;
    const current = Math.round((touch === 'levels' ? stepLevel(pattern, voice, index) : stepChance(pattern, voice, index)) * 100);
    update({ drumKit: withPattern(s.drumKit, target, withStepValue(pattern, touch, voice, index, nextValue(cycle, current))) });
  };
  const setLength = (length: PatternLength) => {
    update({ drumKit: withPattern(s.drumKit, target, resizePattern(pattern, length)) });
    setPage(0);
  };
  const onKey = (event: KeyboardEvent, row: number, index: number) => {
    const voice = DRUM_VOICES[row]?.voice;
    if (!voice) return;
    const move = (r: number, i: number) => refs.current[`${r}-${i}`]?.focus();
    const local = index - first;
    if (event.key === 'ArrowRight') move(row, first + ((local + 1) % DRUM_STEPS));
    else if (event.key === 'ArrowLeft') move(row, first + ((local + DRUM_STEPS - 1) % DRUM_STEPS));
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
            const i = first + from + k;
            const step = pattern[voice][i] ?? 0;
            const out = from + k >= barSteps;
            const level = Math.round(stepLevel(pattern, voice, i) * 100);
            const chance = Math.round(stepChance(pattern, voice, i) * 100);
            const extra = step > 0 && (level < 100 || chance < 100) ? `, intensità ${level}%, probabilità ${chance}%` : '';
            return (
              <button
                key={i}
                ref={(el) => { refs.current[`${row}-${i}`] = el; }}
                type="button"
                role="gridcell"
                className={`drum-step step-${step} ${i % 4 === 0 ? 'is-beat' : ''} ${now === i ? 'is-now' : ''} ${step > 0 && chance < 100 ? 'is-chance' : ''}`}
                style={step > 0 && level < 100 ? { opacity: 0.35 + 0.65 * (level / 100) } : undefined}
                disabled={out}
                data-testid={`drum-${voice}-${i}`}
                data-step={step}
                data-level={level}
                data-chance={chance}
                aria-label={`${label}, passo ${i + 1}: ${out ? 'fuori dalla battuta' : STEP_NAMES[step]}${extra}`}
                onClick={() => press(voice, i, step)}
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
        <button type="button" className="btn" onClick={() => update({ drumKit: withPattern(s.drumKit, target, resizePattern(emptyPattern(), (pages * DRUM_STEPS) as PatternLength)) })}>Svuota</button>
        <button type="button" className="btn" onClick={() => update({ drumKit: withPattern(s.drumKit, target, patternOf(DEFAULT_KIT, target)) })}>Ripristina</button>
      </div>
      <div className="row drum-controls">
        {target !== 'fill' ? (
          <Field label="Lunghezza">
            <Select label="Lunghezza del pattern" testId="drum-length" value={(pages * DRUM_STEPS) as PatternLength} options={LENGTH_OPTIONS} onChange={setLength} />
          </Field>
        ) : null}
        {pages > 1 ? (
          <Field label="Battuta" group>
            <Segmented<number>
              label="Battuta del pattern da modificare"
              value={shown}
              options={Array.from({ length: pages }, (_, i) => ({ value: i, label: String(i + 1) }))}
              onChange={setPage}
            />
          </Field>
        ) : null}
        <Field label="Tocco" group>
          <Segmented<Touch> label="Che cosa cambia un tocco" value={touch} options={TOUCH_OPTIONS} onChange={setTouch} />
        </Field>
      </div>
      {barSteps > DRUM_STEPS ? (
        <p className="field-hint">La battuta ha {barSteps} sedicesimi: dopo il sedicesimo il pattern riparte dal primo passo.</p>
      ) : null}
      <div className="drum-grid" role="grid" aria-label={`Griglia del pattern ${target === 'fill' ? 'Fill' : PATTERN_NAMES[target]}`} data-testid="drum-grid">
        {half(0)}
        {half(DRUM_STEPS / 2)}
      </div>
      <p className="field-hint">
        {touch === 'step'
          ? 'Tocca un passo: acceso, poi accento, poi nota fantasma, poi spento.'
          : touch === 'levels'
            ? 'Tocca un passo acceso per abbassarne l’intensità: 100, 85, 70, 55, 40%.'
            : 'Tocca un passo acceso per farlo suonare solo a volte: 100, 75, 50, 25%. Le variazioni si ripetono ogni 8 battute.'}
        {' '}Le modifiche entrano alla battuta successiva.
      </p>
    </Panel>
  );
}
