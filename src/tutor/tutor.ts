/**
 * The tutor's words: local, deterministic rules over the current musical
 * context. No network, no randomness: the same state always gives the same
 * line. Every note it names comes from the theory engine. Pure, no DOM.
 */
import { commonTones, guideTones } from '../harmony';
import type { Chord, Scale } from '../theory';
import type { Expression } from './sprite';

/** Silent: only the character. Contextual: what is on the neck. Tutor: also what to practise. */
export type TutorMode = 'silent' | 'contextual' | 'tutor';
export const TUTOR_MODES: readonly TutorMode[] = ['silent', 'contextual', 'tutor'];

export type Workspace = 'fretboard' | 'harmony' | 'arpeggio' | 'jam';

export interface TutorInput {
  readonly workspace: Workspace;
  readonly scale: Scale;
  readonly chord: Chord | null;
  readonly nextChord: Chord | null;
  readonly playing: boolean;
  /** Problems the exercise engine reported for the current routine. */
  readonly issues: number;
}

export interface TutorLine {
  readonly expression: Expression;
  /** What is on the neck now. */
  readonly context: string;
  /** What to practise, only in Tutor mode. */
  readonly tip: string | null;
}

const names = (tones: readonly { readonly name: string }[]) => tones.map((t) => t.name).join(' ');

function describe(input: TutorInput): string {
  const { scale, chord } = input;
  const scaleText = `${scale.tonicName} ${scale.definition.name}: ${names(scale.tones)}.`;
  if (!chord) return scaleText;
  const guides = guideTones(chord);
  const guideText = guides.length > 0 ? ` Guide tones: ${names(guides)}.` : '';
  return `${chord.symbol}: ${names(chord.tones)}.${guideText}`;
}

function suggest(input: TutorInput): string {
  const { workspace, scale, chord, nextChord } = input;
  if (input.issues > 0) return "Il percorso ha un problema: apri l'editor avanzato, lo trovi segnato con l'alternativa.";
  if (chord && nextChord && nextChord.symbol !== chord.symbol && (workspace === 'harmony' || workspace === 'jam')) {
    const common = commonTones(chord, nextChord);
    if (common.length > 0) {
      const shared = common.map((c) => chord.tones.find((t) => t.pc === c.pc)?.name ?? '').join(' ');
      return `Verso ${nextChord.symbol}: tieni ${shared}, sono note comuni ai due accordi.`;
    }
    const target = guideTones(nextChord)[0] ?? nextChord.tones[0];
    return `Verso ${nextChord.symbol} nessuna nota comune: muoviti per grado fino a ${target?.name ?? nextChord.rootName}.`;
  }
  switch (workspace) {
    case 'arpeggio':
      return chord
        ? `Suona ${names(chord.tones)} nella posizione, una nota per volta, senza ripetere la diteggiatura a vuoto.`
        : 'Scegli un accordo: l’arpeggio parte dalle sue note.';
    case 'jam':
      return chord
        ? `Improvvisa in ${scale.tonicName} ${scale.definition.name} e atterra su ${names(guideTones(chord))} quando arriva ${chord.symbol}.`
        : `Improvvisa in ${scale.tonicName} ${scale.definition.name}, partendo e chiudendo sulla tonica.`;
    case 'harmony':
    case 'fretboard':
      return chord
        ? `Cerca ${names(chord.tones)} dentro la scala: sono l’arpeggio di ${chord.symbol}.`
        : `Sali dalla ${scale.tonicName} più grave alla più acuta della posizione, poi torna giù.`;
  }
}

export function tutorLine(mode: TutorMode, input: TutorInput): TutorLine | null {
  if (mode === 'silent') return null;
  const expression: Expression = input.issues > 0 ? 'oops' : input.playing ? 'talk' : mode === 'tutor' ? 'think' : 'idle';
  return { expression, context: describe(input), tip: mode === 'tutor' ? suggest(input) : null };
}
