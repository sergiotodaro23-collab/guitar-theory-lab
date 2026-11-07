/**
 * Visualization model: what to draw on the fretboard. Pure, so the rules that
 * decide what a guitarist sees are tested without a browser.
 */
import { allFretNotes, fingerPosition, DEFAULT_FRETS, type FingeredNote, type FretNote, type FretPosition } from '../fretboard';
import { classifyTone, commonTones, guideTones, resolveTone, targetingPath, type AvoidProfile, type ToneFunction, type ToneRole } from '../harmony';
import { chromaticName, mod, type Chord, type Scale } from '../theory';

export type LabelMode = 'note' | 'degree' | 'function' | 'finger' | 'none';
export type Focus = 'all' | 'guide' | 'common' | 'resolution' | 'targeting';
/** 'other-scale': in an overlaid scale only, not in the main one. */
export type MarkerRole = 'root' | 'scale' | 'other-scale' | ToneRole;

export interface Marker extends FretNote {
  readonly label: string;
  readonly role: MarkerRole;
  readonly isGuide: boolean;
  readonly dim: boolean;
  readonly pinned: boolean;
  readonly target: 'now' | 'next' | null;
  /** List positions of the overlaid scales this note belongs to. */
  readonly layers: readonly number[];
  /** Part of the chord shape being studied. */
  readonly inVoicing: boolean;
  readonly fn: ToneFunction | null;
}

export interface FretArrow {
  readonly from: FretPosition;
  readonly to: FretPosition;
  readonly kind: 'guide' | 'tension';
}

export interface OverlayScale {
  readonly scale: Scale;
  /** Position in the user's list, so a note keeps its pip place when others hide. */
  readonly index: number;
  /** Draw across the neck rather than only around the main position. */
  readonly wholeNeck: boolean;
}

export interface MarkerInput {
  readonly notes: readonly FretNote[];
  readonly scale: Scale;
  readonly chord: Chord | null;
  readonly nextChord: Chord | null;
  readonly chords: readonly Chord[];
  readonly chordIndex: number;
  readonly focus: Focus;
  readonly profile: AvoidProfile;
  readonly labelMode: LabelMode;
  readonly pinnedPc: number | null;
  readonly overlays: readonly OverlayScale[];
  /** A chord shape to outline on the neck; its notes are drawn even outside the position. */
  readonly voicing?: readonly FretPosition[] | null;
  readonly wholeNeck: boolean;
  /** Draw only `notes` (plus overlays): an arpeggio route, not every chord tone in its frets. */
  readonly exact?: boolean;
  /** Fingers decided by the engine for these notes (a route that shifts position). */
  readonly fingers?: readonly FingeredNote[] | null;
}

export interface MarkerLayer {
  readonly markers: readonly Marker[];
  readonly arrows: readonly FretArrow[];
}

const key = (p: FretPosition) => `${p.string}:${p.fret}`;

function nearestPosition(from: FretNote, midi: number, candidates: readonly FretNote[], low: number, high: number): FretPosition | null {
  let best: FretNote | null = null;
  let bestCost = Infinity;
  for (const candidate of candidates) {
    if (candidate.midi !== midi) continue;
    const strings = Math.abs(candidate.string - from.string);
    const frets = Math.abs(candidate.fret - from.fret);
    if (strings > 1 || frets > 4) continue;
    // Stay inside the shape the player is using when the note exists there.
    const cost = strings * 2 + frets + (candidate.fret < low || candidate.fret > high ? 3 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
}

export function buildMarkerLayer(input: MarkerInput): MarkerLayer {
  const { notes, scale, chord, nextChord, focus, profile, labelMode, pinnedPc, overlays } = input;
  const scalePcs = new Set(scale.tones.map((t) => t.pc));
  const overlayPcs = overlays.map((o) => new Set(o.scale.tones.map((t) => t.pc)));
  const rootPc = scale.tones[0]?.pc;

  const frets = notes.map((n) => n.fret);
  const low = input.wholeNeck || frets.length === 0 ? 0 : Math.min(...frets);
  const high = input.wholeNeck || frets.length === 0 ? DEFAULT_FRETS : Math.max(...frets);
  const neck = allFretNotes(DEFAULT_FRETS);
  const inRegion = neck.filter((n) => n.fret >= low && n.fret <= high);

  // Chord tones outside the scale and notes of overlaid scales join what is drawn.
  const chordPcs = new Set(chord?.tones.map((t) => t.pc) ?? []);
  const drawn = new Map<string, FretNote>(notes.map((n) => [key(n), n]));
  for (const note of input.exact ? [] : inRegion) {
    if (chordPcs.has(note.pc) && !drawn.has(key(note))) drawn.set(key(note), note);
  }
  overlays.forEach((overlay, i) => {
    for (const note of overlay.wholeNeck ? neck : inRegion) {
      if (overlayPcs[i]?.has(note.pc) && !drawn.has(key(note))) drawn.set(key(note), note);
    }
  });
  const voicingKeys = new Set((input.voicing ?? []).map(key));
  for (const note of neck) {
    if (voicingKeys.has(key(note)) && !drawn.has(key(note))) drawn.set(key(note), note);
  }
  const layersAt = (note: FretNote): readonly number[] =>
    overlays.flatMap((o, i) => {
      if (!overlayPcs[i]?.has(note.pc)) return [];
      if (!o.wholeNeck && (note.fret < low || note.fret > high)) return [];
      return [o.index];
    });
  const fingers = new Map((input.fingers ?? fingerPosition(notes)).map((n) => [key(n), n.finger]));

  const guidePcs = new Set(chord ? guideTones(chord).map((t) => t.pc) : []);
  const common = chord && nextChord ? commonTones(chord, nextChord) : [];
  const commonPcs = new Map(common.map((c) => [c.pc, c]));
  const path = focus === 'targeting' && input.chords.length > 0
    ? targetingPath(input.chords, [...drawn.values()].map((n) => n.midi))
    : [];
  const targetNow = path[input.chordIndex] ?? null;
  const targetNext = path.length > 0 ? path[(input.chordIndex + 1) % path.length] ?? null : null;

  const markers: Marker[] = [...drawn.values()].map((note) => {
    const fn = chord ? classifyTone(note.pc, chord, { profile, scalePcs }) : null;
    const scaleTone = scale.tones.find((t) => t.pc === note.pc);
    const inPrimary = scalePcs.has(note.pc);
    const layers = layersAt(note);
    const owner = overlays.find((o) => o.index === layers[0]);
    const ownerTone = owner?.scale.tones.find((t) => t.pc === note.pc);

    let role: MarkerRole;
    if (fn) role = fn.role;
    else if (note.pc === rootPc) role = 'root';
    else if (inPrimary) role = 'scale';
    else role = 'other-scale';

    const commonInfo = focus === 'common' ? commonPcs.get(note.pc) : undefined;
    let dim = false;
    if (chord) {
      if (focus === 'guide') dim = !guidePcs.has(note.pc);
      if (focus === 'common') dim = !commonInfo;
      if (focus === 'resolution') dim = !(fn?.isGuideTone || fn?.role === 'tension' || fn?.role === 'avoid');
      if (focus === 'targeting') dim = note.midi !== targetNow && note.midi !== targetNext;
    }

    const name = fn?.name ?? scaleTone?.name ?? ownerTone?.name ?? chromaticName(note.pc);
    let label = '';
    switch (labelMode) {
      case 'note': label = name; break;
      case 'degree': label = scaleTone?.degree ?? fn?.degree ?? ownerTone?.degree ?? name; break;
      case 'function': label = fn?.degree ?? scaleTone?.degree ?? ownerTone?.degree ?? name; break;
      case 'finger': label = String(fingers.get(key(note)) ?? ''); break;
      case 'none': label = ''; break;
    }
    // Common tones exist to show both functions at once, whatever the label mode.
    if (commonInfo && labelMode !== 'none') label = `${commonInfo.from}›${commonInfo.to}`;

    return {
      ...note,
      label,
      role,
      isGuide: fn?.isGuideTone ?? false,
      dim,
      pinned: pinnedPc !== null && mod(pinnedPc, 12) === note.pc,
      target: note.midi === targetNow ? 'now' : note.midi === targetNext ? 'next' : null,
      layers,
      inVoicing: voicingKeys.has(key(note)),
      fn,
    };
  });

  const arrows: FretArrow[] = [];
  if (chord && nextChord && (focus === 'resolution' || focus === 'guide')) {
    for (const marker of markers) {
      if (marker.dim) continue;
      const resolution = resolveTone(marker.pc, chord, nextChord, { profile, scalePcs });
      if (!resolution) continue;
      const to = nearestPosition(marker, marker.midi + resolution.motion, neck, low, high);
      if (to) arrows.push({ from: marker, to, kind: marker.isGuide ? 'guide' : 'tension' });
    }
  }

  return { markers, arrows };
}
