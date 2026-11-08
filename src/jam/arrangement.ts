/**
 * Jam arrangements (P3-08, D-33): the progression played as a song — intro,
 * verses, choruses, a bridge, an outro. Each section repeats the progression
 * a number of times with its own groove (pattern A–D), dynamics, a fill into
 * the next section, and its own band (drums, bass, chords on or off). The
 * result is one set of timeline tracks on the shared clock. Pure, no DOM.
 */
import type { BassPattern } from './bass';
import { bassTrack } from './bass';
import { drumTrack, type DrumKit } from './drums';
import { chordTrack, compTrack, progressionLength, withChord, type CompPattern, type Progression } from './progression';
import { tryParseChord } from '../theory';
import { ticksPerBar, type BassPayload, type ChordChangePayload, type CompPayload, type DrumPayload, type Meter, type Track, type TrackPayload } from '../timeline';

export type SectionKind = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
export const SECTION_NAMES: Readonly<Record<SectionKind, string>> = {
  intro: 'Intro', verse: 'Strofa', chorus: 'Ritornello', bridge: 'Bridge', solo: 'Assolo', outro: 'Outro',
};
export type Dynamics = 'soft' | 'medium' | 'loud';
export const DYNAMICS: Readonly<Record<Dynamics, { readonly label: string; readonly scale: number }>> = {
  soft: { label: 'Piano', scale: 0.62 }, medium: { label: 'Medio', scale: 0.82 }, loud: { label: 'Forte', scale: 1 },
};

export interface Section {
  readonly id: string;
  readonly kind: SectionKind;
  /** Times through the progression. */
  readonly repeats: number;
  /** Drum pattern A–D (0–3). */
  readonly pattern: number;
  /** The last bar of the section plays the fill: the transition into the next one. */
  readonly fill: boolean;
  readonly dynamics: Dynamics;
  readonly drums: boolean;
  readonly bass: boolean;
  readonly comp: boolean;
  /** The section's own chords, a bar each ("Am7 D7 Gmaj7"); empty plays the shared progression. */
  readonly chords: string;
}

export const MAX_SECTIONS = 12;
export const MAX_REPEATS = 8;

let counter = 0;
export const newSectionId = (): string => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export const section = (kind: SectionKind, over: Partial<Omit<Section, 'id' | 'kind'>> = {}): Section => ({
  id: newSectionId(), kind, repeats: 1, pattern: 0, fill: true, dynamics: 'medium', drums: true, bass: true, comp: true, chords: '', ...over,
});

export interface ArrangementPreset {
  readonly id: string;
  readonly name: string;
  readonly sections: () => readonly Section[];
}

export const ARRANGEMENT_PRESETS: readonly ArrangementPreset[] = [
  {
    id: 'song', name: 'Canzone: intro, strofa, ritornello, strofa, ritornello, bridge, ritornello, outro',
    sections: () => [
      section('intro', { pattern: 2, dynamics: 'soft', bass: false }),
      section('verse', { pattern: 0, dynamics: 'medium' }),
      section('chorus', { pattern: 1, dynamics: 'loud' }),
      section('verse', { pattern: 0, dynamics: 'medium' }),
      section('chorus', { pattern: 1, dynamics: 'loud' }),
      section('bridge', { pattern: 2, dynamics: 'soft', comp: true }),
      section('chorus', { pattern: 1, dynamics: 'loud', repeats: 2 }),
      section('outro', { pattern: 2, dynamics: 'soft', fill: false }),
    ],
  },
  {
    id: 'jazz', name: 'Jazz: tema, assoli, tema',
    sections: () => [
      section('intro', { pattern: 2, dynamics: 'soft', drums: true, bass: true, comp: false }),
      section('verse', { pattern: 0, dynamics: 'medium', repeats: 2 }),
      section('solo', { pattern: 1, dynamics: 'loud', repeats: 4 }),
      section('verse', { pattern: 0, dynamics: 'medium', repeats: 2 }),
      section('outro', { pattern: 2, dynamics: 'soft', fill: false }),
    ],
  },
  {
    id: 'practice', name: 'Studio: batteria sola, poi basso, poi tutta la band',
    sections: () => [
      section('intro', { pattern: 0, dynamics: 'medium', bass: false, comp: false, fill: false }),
      section('verse', { pattern: 0, dynamics: 'medium', comp: false, fill: false }),
      section('chorus', { pattern: 1, dynamics: 'loud', repeats: 2 }),
    ],
  },
];

export interface ArrangementInput {
  readonly progression: Progression;
  readonly meter: Meter;
  readonly kit: DrumKit;
  readonly compPattern: CompPattern;
  readonly bass: BassPattern;
  readonly sections: readonly Section[];
  readonly loop: boolean;
}

export interface SectionSpan {
  readonly section: Section;
  readonly index: number;
  readonly tick: number;
  readonly lengthTicks: number;
  readonly firstBar: number;
  readonly bars: number;
}

/** The symbols of a section's own chords, when every one of them reads; null plays the shared progression. */
export function sectionSymbols(text: string): readonly string[] | null {
  const symbols = text.split(/[\s|,]+/).map((x) => x.trim()).filter(Boolean);
  return symbols.length > 0 && symbols.every((x) => tryParseChord(x)) ? symbols : null;
}

/** The progression a section plays: its own chords (a bar each) or the shared one. */
export function sectionProgression(section: Section, main: Progression): Progression {
  const symbols = sectionSymbols(section.chords);
  if (!symbols) return main;
  return { name: main.name, chords: symbols.map((symbol, i) => ({ ...withChord(symbol), id: `${section.id}:${i}` })) };
}

/**
 * Every chord the song can play, in one list: the shared progression first,
 * then each section's own chords. The chord track's indices point here.
 */
export function songChords(main: Progression, sections: readonly Section[]): { readonly chords: Progression['chords']; readonly offsets: ReadonlyMap<string, number> } {
  const chords = [...main.chords];
  const offsets = new Map<string, number>();
  for (const s of sections) {
    const own = sectionProgression(s, main);
    if (own === main) { offsets.set(s.id, 0); continue; }
    offsets.set(s.id, chords.length);
    chords.push(...own.chords);
  }
  return { chords, offsets };
}

/** Where each section starts and how long it lasts. */
export function sectionSpans(sections: readonly Section[], progression: Progression, meter: Meter): readonly SectionSpan[] {
  const bar = ticksPerBar(meter);
  let tick = 0;
  return sections.map((s, index) => {
    const length = progressionLength(sectionProgression(s, progression), meter);
    const lengthTicks = length * Math.max(1, s.repeats);
    const span = { section: s, index, tick, lengthTicks, firstBar: Math.floor(tick / bar), bars: Math.ceil(lengthTicks / bar) };
    tick += lengthTicks;
    return span;
  });
}

/** The section playing at a bar counted from the start (the arrangement loops). */
export function sectionAtBar(spans: readonly SectionSpan[], bar: number): SectionSpan | null {
  const total = spans.reduce((sum, s) => sum + s.bars, 0);
  if (total === 0) return null;
  const at = ((bar % total) + total) % total;
  return spans.find((s) => at >= s.firstBar && at < s.firstBar + s.bars) ?? null;
}

type Spec<P extends TrackPayload> = Omit<Track<P>, 'originTick'>;

/** Copy a track's events into a section, as many times as the section lasts. */
function place<P extends TrackPayload>(track: Spec<P>, start: number, length: number, map: (p: P) => P = (p) => p): { tick: number; payload: P }[] {
  const out: { tick: number; payload: P }[] = [];
  if (track.lengthTicks <= 0) return out;
  for (let offset = 0; offset < length; offset += track.lengthTicks) {
    for (const e of track.events) {
      const tick = offset + e.tick;
      if (tick < length) out.push({ tick: start + tick, payload: map(e.payload) });
    }
  }
  return out;
}

export interface ArrangementTracks {
  readonly chords: Spec<ChordChangePayload>;
  readonly comp: Spec<CompPayload>;
  readonly bass: Spec<BassPayload>;
  readonly drums: Spec<DrumPayload>;
  readonly lengthTicks: number;
  readonly spans: readonly SectionSpan[];
}

/** The whole song as four tracks. Velocities follow each section's dynamics; muted parts leave no events. */
export function arrangementTracks(a: ArrangementInput): ArrangementTracks {
  const spans = sectionSpans(a.sections, a.progression, a.meter);
  const lengthTicks = spans.reduce((sum, s) => sum + s.lengthTicks, 0);
  const bar = ticksPerBar(a.meter);
  const { offsets } = songChords(a.progression, a.sections);
  const events = { chords: [] as { tick: number; payload: ChordChangePayload }[], comp: [] as { tick: number; payload: CompPayload }[], bass: [] as { tick: number; payload: BassPayload }[], drums: [] as { tick: number; payload: DrumPayload }[] };
  for (const span of spans) {
    const s = span.section;
    const scale = DYNAMICS[s.dynamics].scale;
    const progression = sectionProgression(s, a.progression);
    const offset = offsets.get(s.id) ?? 0;
    const chords = chordTrack(progression, a.meter, true);
    const comp = compTrack(progression, a.meter, a.compPattern, true, true);
    const compNoBass = compTrack(progression, a.meter, a.compPattern, true, false);
    const bass = bassTrack(progression, a.meter, a.bass, true);
    events.chords.push(...place(chords, span.tick, span.lengthTicks, (p) => ({ ...p, chordIndex: p.chordIndex + offset })));
    if (s.comp) events.comp.push(...place(s.bass ? comp : compNoBass, span.tick, span.lengthTicks, (p) => ({ ...p, velocity: p.velocity * scale })));
    if (s.bass) events.bass.push(...place(bass, span.tick, span.lengthTicks, (p) => ({ ...p, velocity: p.velocity * scale })));
    if (s.drums) {
      // The groove for every bar, the fill on the last bar when the section asks for it.
      const groove = drumTrack(a.kit, s.pattern, a.meter, 0);
      const fillBar = drumTrack({ ...a.kit, patterns: [a.kit.fill, a.kit.fill, a.kit.fill, a.kit.fill] }, 0, a.meter, 0);
      const fillFrom = s.fill ? span.lengthTicks - bar : span.lengthTicks;
      events.drums.push(...place(groove, span.tick, fillFrom, (p) => ({ ...p, velocity: p.velocity * scale })));
      if (s.fill) events.drums.push(...place(fillBar, span.tick + fillFrom, bar, (p) => ({ ...p, velocity: p.velocity * scale })));
    }
  }
  const track = <P extends TrackPayload>(id: string, list: { tick: number; payload: P }[]): Spec<P> => ({ id, lengthTicks, loop: a.loop, events: list.sort((x, y) => x.tick - y.tick) });
  return { chords: track('chords', events.chords), comp: track('comp', events.comp), bass: track('bass', events.bass), drums: track('drums', events.drums), lengthTicks, spans };
}

const KINDS: readonly SectionKind[] = ['intro', 'verse', 'chorus', 'bridge', 'solo', 'outro'];

export function sanitizeSections(raw: unknown): readonly Section[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_SECTIONS).flatMap((item): Section[] => {
    if (typeof item !== 'object' || item === null) return [];
    const r = item as Record<string, unknown>;
    if (!KINDS.includes(r.kind as SectionKind)) return [];
    const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);
    return [{
      id: typeof r.id === 'string' ? r.id.slice(0, 40) : newSectionId(),
      kind: r.kind as SectionKind,
      repeats: int(r.repeats, 1, MAX_REPEATS, 1),
      pattern: int(r.pattern, 0, 3, 0),
      fill: r.fill !== false,
      dynamics: r.dynamics === 'soft' || r.dynamics === 'loud' ? r.dynamics : 'medium',
      drums: r.drums !== false, bass: r.bass !== false, comp: r.comp !== false,
      chords: typeof r.chords === 'string' ? r.chords.slice(0, 160) : '',
    }];
  });
}
