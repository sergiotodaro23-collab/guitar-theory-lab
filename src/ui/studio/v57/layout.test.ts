import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../app/settings';
import { parseChord } from '../../../theory';
import {
  BOARD_ASPECT, FB_CHROME, FB_MIN, NB_MIN, STORAGE_KEYS, VIZ_DEFAULTS, activeTab, clampRatio, compactLevel, fitScale, gainDb, gainToKnob,
  hzToKnob, knobToGain, knobToHz, lcdModel, loadPrefs, savePref, splitHeight, tabKeyTarget, tabsFor, type KeyValueStore,
} from './layout';

const memory = (seed: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...seed };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('device fit (handoff fitS rule)', () => {
  it('keeps full size when the notebook is roomy', () => {
    expect(fitScale(828, 432, 1300, 600, false)).toBe(1);
  });
  it('scales to the free height, minus the note line on tall notebooks', () => {
    expect(fitScale(828, 432, 1300, 400, true)).toBeCloseTo((400 - 16 - 36) / 432, 5);
    expect(fitScale(828, 432, 1300, 300, true)).toBeCloseTo((300 - 16) / 432, 5);
  });
  it('scales to the width and never below 0.45', () => {
    expect(fitScale(868, 344, 600, 700, false)).toBeCloseTo(580 / 868, 5);
    expect(fitScale(828, 432, 1300, 100, false)).toBe(0.45);
  });
  it('compact levels follow the notebook height', () => {
    expect(compactLevel(300)).toBe(2);
    expect(compactLevel(400)).toBe(1);
    expect(compactLevel(600)).toBe(0);
  });
});

describe('fretboard / notebook divider', () => {
  it('never lets the board grow past its natural height for the width', () => {
    const natural = FB_CHROME + 1200 / BOARD_ASPECT;
    expect(splitHeight(0.85, 1000, 1200)).toBe(Math.round(natural));
  });
  it('keeps the notebook its minimum and the board its minimum', () => {
    expect(splitHeight(0.85, 400, 2000)).toBe(400 - NB_MIN);
    expect(splitHeight(0.15, 400, 2000)).toBe(FB_MIN);
  });
  it('clamps stored ratios', () => {
    expect(clampRatio(2)).toBe(0.85);
    expect(clampRatio(-1)).toBe(0.15);
    expect(clampRatio(Number.NaN)).toBe(0.5);
  });
});

describe('notebook tabs', () => {
  it('Fretboard Lab has the five V5.7 pages plus the guitar input', () => {
    expect(tabsFor('fretboard').map((t) => t.label)).toEqual(['Scala', 'Accordi', 'Esercizio', 'Legenda', 'Next Fretboard', 'Ingresso']);
  });
  it('each lab opens on the page it uses most', () => {
    expect(tabsFor('harmony')[0]?.id).toBe('harmony');
    expect(tabsFor('arpeggio')[0]?.id).toBe('arpeggio');
    expect(tabsFor('jam')[0]?.id).toBe('jam');
  });
  it('keeps the picked page per lab and falls back to the first', () => {
    expect(activeTab('fretboard', { fretboard: 'legend' }).id).toBe('legend');
    expect(activeTab('jam', { jam: 'next' }).id).toBe('jam');
  });
  it('moves focus with arrows, Home and End', () => {
    expect(tabKeyTarget('ArrowRight', 4, 5)).toBe(0);
    expect(tabKeyTarget('ArrowLeft', 0, 5)).toBe(4);
    expect(tabKeyTarget('Home', 3, 5)).toBe(0);
    expect(tabKeyTarget('End', 0, 5)).toBe(4);
    expect(tabKeyTarget('a', 0, 5)).toBeNull();
  });
});

describe('LCD reading', () => {
  it('Fretboard Lab reads the studied scale and the active chord as a numeral (Cmaj7 in C major = Imaj7)', () => {
    const m = lcdModel({ ...DEFAULT_SETTINGS, mode: 'fretboard', tonic: 'C', scaleId: 'ionian' }, parseChord('Cmaj7'), null, 'Solo scala');
    expect(m.tonic).toBe('C');
    expect(m.scaleName).toBe('Maggiore (ionica)');
    expect(m.notes).toBe('C D E F G A B');
    expect(m.chord).toBe('Cmaj7');
    expect(m.numeral).toBe('Imaj7');
  });
  it('Harmony Lab reads the progression key: ii–V–I in C', () => {
    const s = { ...DEFAULT_SETTINGS, mode: 'harmony' as const, harmonyKey: 'C', harmonyMode: 'ionian' as const, tonic: 'A', scaleId: 'aeolian' as const };
    const m = lcdModel(s, parseChord('Dm7'), parseChord('G7'), '');
    expect(m.tonic).toBe('C');
    expect(m.numeral).toBe('ii7');
    expect(m.next).toBe('G7');
    expect(lcdModel(s, parseChord('G7'), null, '').numeral).toBe('V7');
  });
  it('a minor key spells its own notes (A natural minor)', () => {
    const m = lcdModel({ ...DEFAULT_SETTINGS, mode: 'jam', harmonyKey: 'A', harmonyMode: 'aeolian' }, parseChord('Dm7'), null, '');
    expect(m.notes).toBe('A B C D E F G');
    expect(m.numeral).toBe('iv7');
  });
  it('no chord: the fallback text, dimmed', () => {
    const m = lcdModel(DEFAULT_SETTINGS, null, null, 'Solo scala');
    expect(m.chord).toBe('Solo scala');
    expect(m.chordNone).toBe(true);
    expect(m.numeral).toBe('');
  });
});

describe('UI preferences', () => {
  it('defaults when storage is empty or broken', () => {
    const p = loadPrefs(memory({ [STORAGE_KEYS.viz]: '{not json', [STORAGE_KEYS.split]: '"x"' }));
    expect(p.viz).toEqual(VIZ_DEFAULTS);
    expect(p.split).toBe(0.5);
    expect(p.lcdExpanded).toBe(true);
  });
  it('round-trips and repairs values', () => {
    const store = memory();
    savePref(store, 'split', 0.62);
    savePref(store, 'viz', { ...VIZ_DEFAULTS, anim: 'glow', layerMarks: 'dots' });
    const p = loadPrefs(store);
    expect(p.split).toBe(0.62);
    expect(p.viz.anim).toBe('glow');
    expect(p.viz.layerMarks).toBe('dots');
  });
  it('a storage that throws never breaks the app', () => {
    const broken: KeyValueStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    expect(() => savePref(broken, 'railExpanded', true)).not.toThrow();
    expect(loadPrefs(broken).railExpanded).toBe(false);
  });
});

describe('device knob mappings', () => {
  it('calibration knob covers 435–445 Hz and centres on 440', () => {
    expect(hzToKnob(440)).toBe(50);
    expect(knobToHz(50)).toBe(440);
    expect(knobToHz(0)).toBe(435);
    expect(knobToHz(100)).toBe(445);
    expect(hzToKnob(415)).toBe(0);
  });
  it('input gain knob covers the production 0–4× gain and reads real dB', () => {
    expect(gainToKnob(1)).toBe(25);
    expect(knobToGain(25)).toBe(1);
    expect(knobToGain(100)).toBe(4);
    expect(gainDb(1)).toBe('+0.0 dB');
    expect(gainDb(2)).toBe('+6.0 dB');
    expect(gainDb(0.5)).toBe('−6.0 dB');
    expect(gainDb(0)).toBe('−∞ dB');
  });
});
