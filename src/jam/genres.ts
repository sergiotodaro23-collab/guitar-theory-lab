/**
 * Jam genres: a ready band for each style. Choosing a genre sets the drum
 * kit (four grooves and a fill), four bass lines, the comping rhythm and the
 * swing; tempo is a suggestion the user applies. All patterns are written
 * for a 4/4 bar in sixteenths; swing turns straight eighths into a shuffle.
 */
import type { BassNote, BassPattern, BassTone } from './bass';
import { DEFAULT_KIT, pattern, type DrumKit } from './drums';
import type { CompPattern } from './progression';

export type GenreId = 'rock' | 'blues' | 'jazz' | 'funk' | 'fusion' | 'metal' | 'latin' | 'ambient';

export interface Genre {
  readonly id: GenreId;
  readonly label: string;
  /** 0 straight; 1/3 puts the off-beat eighth on the last triplet, a shuffle. */
  readonly swing: number;
  readonly bpm: number;
  readonly comp: CompPattern;
  readonly kit: DrumKit;
  readonly bass: readonly [BassPattern, BassPattern, BassPattern, BassPattern];
  /** Suggested balance (fader levels 0–1), applied when the genre is chosen: the user can move them. */
  readonly mix: { readonly drums: number; readonly bass: number; readonly comp: number };
}

const TRIPLET = 1 / 3;

/** Bass notes from a compact list: [step, length, tone]. */
const line = (name: string, notes: readonly (readonly [number, number, BassTone])[]): BassPattern => ({
  name,
  notes: notes.map(([step, length, tone]): BassNote => ({ step, length, tone })),
});
const every = (gap: number, length: number, tones: readonly BassTone[]): (readonly [number, number, BassTone])[] =>
  Array.from({ length: 16 / gap }, (_, i) => [i * gap, length, tones[i % tones.length] ?? 'root'] as const);

export const GENRES: readonly Genre[] = [
  {
    id: 'rock', label: 'Rock', swing: 0, bpm: 110, comp: 'eighths',
    mix: { drums: 0.75, bass: 0.72, comp: 0.6 },
    kit: DEFAULT_KIT,
    bass: [
      line('Ottavi sulla fondamentale', every(2, 2, ['root'])),
      line('Fondamentale, quinta, ottava', every(4, 4, ['root', 'root', 'fifth', 'octave'])),
      line('Minime', [[0, 8, 'root'], [8, 8, 'fifth']]),
      line('Ottavi con avvicinamento', [...every(2, 2, ['root']).slice(0, 7), [14, 2, 'approach']]),
    ],
  },
  {
    id: 'blues', label: 'Blues', swing: TRIPLET, bpm: 92, comp: 'charleston',
    mix: { drums: 0.62, bass: 0.72, comp: 0.66 },
    kit: {
      patterns: [
        pattern({ kick: 'X.......X.......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' }),
        pattern({ kick: 'X.....x.X.......', snare: '....X.......X...', hat: 'X.x.X.x.X.x.X.x.' }),
        pattern({ kick: 'X...x...X...x...', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' }),
        pattern({ kick: 'X.......X.x.....', snare: '....X..x....X...', open: 'x.x.x.x.x.x.x.x.' }),
      ],
      fill: pattern({ kick: 'X...........X...', snare: '....x.x.x.xxXxxx', hat: 'x.x.x...' }),
    },
    bass: [
      line('Boogie', every(2, 2, ['root', 'third', 'fifth', 'sixth', 'seventh', 'sixth', 'fifth', 'third'])),
      line('Salita a semiminime', every(4, 4, ['root', 'third', 'fifth', 'sixth'])),
      line('Fondamentale, quinta, ottava', every(4, 4, ['root', 'fifth', 'octave', 'fifth'])),
      line('Minime con avvicinamento', [[0, 8, 'root'], [8, 4, 'fifth'], [12, 4, 'approach']]),
    ],
  },
  {
    id: 'jazz', label: 'Jazz', swing: TRIPLET, bpm: 140, comp: 'charleston',
    mix: { drums: 0.5, bass: 0.78, comp: 0.58 },
    kit: {
      patterns: [
        // Spang-a-lang on the ride, hi-hat foot on 2 and 4, feathered kick.
        pattern({ ride: 'X...x.x.X...x.x.', hat: '....x.......x...', kick: 'g...g...g...g...' }),
        // Comping snare: ghosted chatter with an accent on the and of four.
        pattern({ ride: 'X...x.x.X...x.x.', hat: '....x.......x...', snare: '..g...g...g...X.' }),
        // Two feel: ride on the beat, kick on one and three.
        pattern({ ride: 'X...x...X...x...', hat: '....x.......x...', kick: 'x.......x.......' }),
        // Brushes-like: snare sixteenths ghosted, ride light.
        pattern({ snare: 'gggggggggggggggg', ride: 'x...x.x.x...x.x.', hat: '....x.......x...' }),
      ],
      fill: pattern({ snare: 'x..x..x.x..x..x.', tom: '..........x..X..', ride: 'X...' }),
    },
    bass: [
      line('Walking in salita', every(4, 4, ['root', 'third', 'fifth', 'approach'])),
      line('Walking in discesa', every(4, 4, ['root', 'seventh', 'fifth', 'approach'])),
      line('In due', [[0, 8, 'root'], [8, 8, 'fifth']]),
      line('In due con avvicinamento', [[0, 8, 'root'], [8, 4, 'fifth'], [12, 4, 'approach']]),
    ],
  },
  {
    id: 'funk', label: 'Funk', swing: 0, bpm: 100, comp: 'stabs',
    mix: { drums: 0.72, bass: 0.78, comp: 0.55 },
    kit: {
      patterns: [
        pattern({ kick: 'X.x....x..X.....', snare: '.g..X..g.g..X..g', hat: 'xxxxxxxxxxxxxxxx' }),
        pattern({ kick: 'X..x..X...X..x..', snare: '..g.X..g..g.X.x.', hat: 'x.x.x.x.x.x.x.x.', open: '......x.......x.' }),
        pattern({ kick: 'X......x.xX.....', snare: '....X..x.x..X..x', hat: 'xxxxxxxxxxxxxxxx' }),
        pattern({ kick: 'X.x...x...x..x..', snare: '....X.......X...', hat: 'x.xxx.xxx.xxx.xx', open: '..............x.' }),
      ],
      fill: pattern({ kick: 'X.x.....', snare: '....xxXxx.x.xX..', tom: '..........x...Xx' }),
    },
    bass: [
      line('Sedicesimi sincopati', [[0, 2, 'root'], [3, 1, 'octave'], [6, 2, 'root'], [10, 1, 'seventh'], [11, 1, 'octave'], [14, 2, 'root']]),
      line('Uno e quattro', [[0, 3, 'root'], [7, 1, 'root'], [8, 2, 'octave'], [13, 3, 'fifth']]),
      line('Ottave', [[0, 1, 'root'], [2, 1, 'octave'], [4, 1, 'root'], [6, 1, 'octave'], [9, 1, 'root'], [11, 1, 'octave'], [14, 2, 'seventh']]),
      line('Vamp con avvicinamento', [[0, 3, 'root'], [3, 1, 'root'], [6, 2, 'fifth'], [10, 2, 'root'], [15, 1, 'approach']]),
    ],
  },
  {
    id: 'fusion', label: 'Fusion', swing: 0, bpm: 108, comp: 'push',
    mix: { drums: 0.66, bass: 0.74, comp: 0.58 },
    kit: {
      patterns: [
        // A: sixteenth hats with accents on the beat, ghosted snare, syncopated kick.
        pattern({ kick: 'X.....x...x..x..', snare: '..g.X..g.g..X.g.', hat: 'XxxxXxxxXxxxXxxx' }),
        // B: linear groove: kick, snare and hat never land together.
        pattern({ kick: 'X..X....X..X....', snare: '....X..g....X..g', hat: '.xx..xx..xx..xx.' }),
        // C: half time on the ride, backbeat on three, ghosts around it.
        pattern({ kick: 'X.....x...x.....', snare: '...g....X..g..g.', ride: 'X.x.x.x.X.x.x.x.', hat: '....x.......x...' }),
        // D: songo-inspired: snare and toms answer the kick across the bar.
        pattern({ kick: '...x...x...x...x', snare: 'x.g..x.g.gx..x.g', tom: '......X.......X.', ride: 'x.x.x.x.x.x.x.x.' }),
      ],
      fill: pattern({ snare: 'XggxXggx', tom: '........XxxXxxXx', kick: 'X..x...X..x.....' }),
    },
    bass: [
      line('Sedicesimi con anticipo', [[0, 2, 'root'], [3, 1, 'octave'], [6, 2, 'seventh'], [8, 2, 'fifth'], [11, 1, 'octave'], [14, 4, 'anticipate']]),
      line('Ottave sincopate', [[0, 2, 'root'], [2, 1, 'octave'], [5, 1, 'root'], [7, 1, 'octave'], [10, 2, 'fifth'], [12, 2, 'seventh'], [15, 1, 'approach']]),
      line('Linea melodica', [[0, 3, 'root'], [3, 3, 'third'], [6, 2, 'fifth'], [8, 3, 'seventh'], [11, 3, 'octave'], [14, 2, 'approach']]),
      line('Pedale con anticipo', [[0, 10, 'root'], [10, 4, 'fifth'], [14, 4, 'anticipate']]),
    ],
  },
  {
    id: 'metal', label: 'Metal', swing: 0, bpm: 150, comp: 'eighths',
    mix: { drums: 0.8, bass: 0.7, comp: 0.6 },
    kit: {
      patterns: [
        pattern({ kick: 'XxxxXxxxXxxxXxxx', snare: '....X.......X...', open: 'x...x...x...x...' }),
        pattern({ kick: 'X.xxX.xxX.xxX.xx', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' }),
        pattern({ kick: 'X.x.X.x.X.x.X.x.', snare: '........X.......', open: 'x...x...x...x...' }),
        pattern({ kick: 'x.x.x.x.x.x.x.x.', snare: '.x.x.x.x.x.x.x.x', hat: 'x.x.x.x.x.x.x.x.' }),
      ],
      fill: pattern({ kick: 'xxxxxxxxxxxxxxxx', snare: 'X.x.X.x.', tom: '........X.x.XxXx' }),
    },
    bass: [
      line('Sedicesimi sulla fondamentale', every(1, 1, ['root'])),
      line('Galoppo', [[0, 2, 'root'], [2, 1, 'root'], [3, 1, 'root'], [4, 2, 'root'], [6, 1, 'root'], [7, 1, 'root'], [8, 2, 'root'], [10, 1, 'root'], [11, 1, 'root'], [12, 2, 'root'], [14, 1, 'root'], [15, 1, 'root']]),
      line('Ottavi', every(2, 2, ['root'])),
      line('Minime, fondamentale e quinta', [[0, 8, 'root'], [8, 8, 'fifth']]),
    ],
  },
  {
    id: 'latin', label: 'Latin', swing: 0, bpm: 120, comp: 'push',
    mix: { drums: 0.6, bass: 0.72, comp: 0.62 },
    kit: {
      patterns: [
        // Bossa nova: bass drum on 1 and the and of 2, cross-stick clave.
        pattern({ kick: 'X..xX..xX..xX..x', clap: 'x..x..x...x..x..', hat: 'x.x.x.x.x.x.x.x.' }),
        // Samba.
        pattern({ kick: 'X..xX..xX..xX..x', snare: 'x.xx.x.x.xx.x.x.', hat: 'xxxxxxxxxxxxxxxx' }),
        // Son clave 3-2 with tumbao toms.
        pattern({ clap: 'x..x..x...x.x...', tom: '......x.......x.', kick: '...x.......x....', hat: 'x.x.x.x.x.x.x.x.' }),
        // Cha-cha.
        pattern({ kick: 'X.......X.......', clap: '....x.......x.x.', hat: 'x...x...x...x...', tom: '............x.x.' }),
      ],
      fill: pattern({ tom: 'x.xx.x.xx.xXxXxX', kick: 'X.......' }),
    },
    bass: [
      line('Bossa nova', [[0, 6, 'root'], [6, 2, 'fifth'], [8, 6, 'root'], [14, 2, 'fifth']]),
      line('Tumbao', [[6, 4, 'fifth'], [10, 2, 'root'], [12, 4, 'root']]),
      line('Samba', [[0, 3, 'root'], [3, 1, 'fifth'], [4, 4, 'fifth'], [8, 3, 'root'], [11, 1, 'fifth'], [12, 4, 'fifth']]),
      line('Cha-cha', [[0, 4, 'root'], [4, 4, 'fifth'], [8, 2, 'root'], [10, 2, 'fifth'], [12, 4, 'approach']]),
    ],
  },
  {
    id: 'ambient', label: 'Ambient', swing: 0, bpm: 72, comp: 'sustain',
    mix: { drums: 0.42, bass: 0.6, comp: 0.74 },
    kit: {
      patterns: [
        pattern({ kick: 'X...............', open: '........x.......' }),
        pattern({ kick: 'X.......', tom: '..........x.....' }),
        pattern({ hat: '..x...x...x...x.', kick: 'X...............' }),
        pattern({ hat: 'xxxxxxxxxxxxxxxx' }),
      ],
      fill: pattern({ tom: '........x.x.x.xX', open: 'x...............' }),
    },
    bass: [
      line('Pedale', [[0, 16, 'root']]),
      line('Fondamentale e quinta', [[0, 8, 'root'], [8, 8, 'fifth']]),
      line('Pedale con ottava', [[0, 12, 'root'], [12, 4, 'octave']]),
      line('Pedale e avvicinamento', [[0, 12, 'root'], [12, 4, 'approach']]),
    ],
  },
];

export const genreOf = (id: GenreId): Genre => GENRES.find((g) => g.id === id) ?? (GENRES[0] as Genre);
