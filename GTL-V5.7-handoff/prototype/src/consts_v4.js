const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = [0, 2, 4, 5, 7, 9, 11];
const ROOTS = [
  { n: 'C', l: 0, pc: 0 }, { n: 'Db', l: 1, pc: 1 }, { n: 'D', l: 1, pc: 2 }, { n: 'Eb', l: 2, pc: 3 },
  { n: 'E', l: 2, pc: 4 }, { n: 'F', l: 3, pc: 5 }, { n: 'F#', l: 3, pc: 6 }, { n: 'G', l: 4, pc: 7 },
  { n: 'Ab', l: 5, pc: 8 }, { n: 'A', l: 5, pc: 9 }, { n: 'Bb', l: 6, pc: 10 }, { n: 'B', l: 6, pc: 11 }
];
const SCALES = {
  major: { label: 'Maggiore (ionica)', en: 'Major', iv: [0, 2, 4, 5, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6], deg: ['1', '2', '3', '4', '5', '6', '7'] },
  minor: { label: 'Minore (eolia)', en: 'Minor', iv: [0, 2, 3, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6], deg: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  dorian: { label: 'Dorica', en: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6], deg: ['1', '2', 'b3', '4', '5', '6', 'b7'] },
  phrygian: { label: 'Frigia', en: 'Phrygian', iv: [0, 1, 3, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6], deg: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'] },
  lydian: { label: 'Lidia', en: 'Lydian', iv: [0, 2, 4, 6, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6], deg: ['1', '2', '3', '#4', '5', '6', '7'] },
  mixolydian: { label: 'Misolidia', en: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6], deg: ['1', '2', '3', '4', '5', '6', 'b7'] },
  pentmin: { label: 'Pentatonica min.', en: 'Minor Pent.', parent: 'minor', iv: [0, 3, 5, 7, 10], lt: [0, 2, 3, 4, 6], deg: ['1', 'b3', '4', '5', 'b7'] },
  pentmaj: { label: 'Pentatonica magg.', en: 'Major Pent.', parent: 'major', iv: [0, 2, 4, 7, 9], lt: [0, 1, 2, 4, 5], deg: ['1', '2', '3', '5', '6'] }
};
const QUAL = { '0,4,7,11': 'maj7', '0,4,7,10': '7', '0,3,7,10': 'm7', '0,3,6,10': 'm7b5', '0,3,7,11': 'm(maj7)', '0,4,8,11': 'maj7#5', '0,3,6,9': 'dim7', '0,4,6,10': '7b5' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const TUNINGS = {
  std: { label: 'E A D G B E', names: ['E', 'A', 'D', 'G', 'B', 'E'], midi: [40, 45, 50, 55, 59, 64] },
  dropd: { label: 'D A D G B E · Drop D', names: ['D', 'A', 'D', 'G', 'B', 'E'], midi: [38, 45, 50, 55, 59, 64] },
  half: { label: 'Eb Ab Db Gb Bb Eb · ½ tono sotto', names: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'], midi: [39, 44, 49, 54, 58, 63] },
  dadgad: { label: 'D A D G A D · DADGAD', names: ['D', 'A', 'D', 'G', 'A', 'D'], midi: [38, 45, 50, 55, 57, 62] }
};
const CAGED = { c: [0, 4], a: [2, 6], g: [4, 9], e: [7, 11], d: [9, 14] };
const POSITIONS = [['all', 'Tutta la tastiera'], ['c', 'CAGED (C)'], ['a', 'CAGED (A)'], ['g', 'CAGED (G)'], ['e', 'CAGED (E)'], ['d', 'CAGED (D)']];
const PRESETS = {
  studio: { label: 'Studio', tonic: 0, scale: 'major', chord: 0, pos: 'c', bpm: 100, exType: 'arp', exDir: 'asc', exTempo: '8', prog: [0, 3, 4, 0] },
  blues: { label: 'Blues in A', tonic: 9, scale: 'pentmin', chord: 0, pos: 'e', bpm: 84, exType: 'scale', exDir: 'updown', exTempo: '8', prog: [0, 3, 4] },
  jazz: { label: 'Jazz in D dorico', tonic: 2, scale: 'dorian', chord: 0, pos: 'n3', bpm: 120, exType: 'arp', exDir: 'updown', exTempo: '4', prog: [0, 3, 4, 0] },
  iivi: { label: 'ii–V–I in C (guide tone)', tonic: 0, scale: 'major', chord: 1, pos: 'c', bpm: 110, exType: 'arp', exDir: 'asc', exTempo: '8', prog: [1, 4, 0] },
  ballad: { label: 'Ballad in E minor', tonic: 4, scale: 'minor', chord: 0, pos: 'c', bpm: 72, exType: 'arp', exDir: 'asc', exTempo: '4', prog: [0, 5, 2, 6] }
};
const FLATN = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARPN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const EXT = { 1: 'b9', 2: '9', 3: '#9', 5: '11', 6: '#11', 8: 'b13', 9: '13' };
const INTV = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'b5', 'P5', 'm6', 'M6', 'm7', 'M7'];
const WS = { fretboard: 'Fretboard Lab', harmony: 'Harmony Lab', arpeggios: 'Arpeggios Lab', jam: 'Jam Studio' };
const CAGED_ORDER = ['c', 'a', 'g', 'e', 'd'];
const MODES = [['note', 'Note'], ['grade', 'Gradi'], ['function', 'Funzione'], ['finger', 'Dito'], ['interval', 'Intervalli'], ['none', 'Nessuna']];
const BPB = { '4/4': 4, '3/4': 3, '6/8': 6, '5/4': 5 };
const SPRITE = [
  '........................',
  '.......kkkkkkkkkk.......',
  '.......kHHhhhhhhk.......',
  '.....khhhhHhhHhhhhk.....',
  '.....khHhhhhhhhhhhk.....',
  '....khhhhhHhhHhhhhhk....',
  '....khhhhhhsshhhhhhk....',
  '....khHhsssssssshhhk....',
  '....khhhkkksskkkhHhk....',
  '....khhhklkssklkhhhk....',
  '....khHhsssSSssshhhk....',
  '....khhhssuuuusshhhk.kk.',
  '....khhkssSSSSsskHhk.WW.',
  '....khkkkkkkkkkkkkhk.WM.',
  '....khkooooooooookhkkkk.',
  '....kooOoyooooooOkkkwW..',
  '....kooOooyoooooOsssW...',
  '....kooOoooyooooOkkk....',
  '....kooOooooyoookwW.....',
  '....kokkkkkkkkokwW......',
  '....kokrrrrrRkkwWk......',
  '....ksssrmmrRkwWOk......',
  '.....sssrrrrRwWoOk......',
  '......krrmmrRWooOk......',
  '......krMMMMRkjJk.......',
  '......krrrrrRkjJk.......',
  '......kRRRRRRkjJk.......',
  '......kkkkkkkkjJk.......',
  '.......kJjjJkjjJk.......',
  '.......kbbkkkkbbk.......',
  '.......kkkk..kkkk.......',
  '........................'
];
const SPAL = { k: '#14110e', h: '#4a2c1a', H: '#6e4426', s: '#e8b98f', S: '#c48f68', l: '#cfe8ff', o: '#f26b1d', O: '#b8480f', j: '#3d5a8c', J: '#29406a', b: '#2b2d31', r: '#b3261e', R: '#6e1510', w: '#d9b878', W: '#a67c3d', m: '#d6dbe0', M: '#8c939b', y: '#ffd23f', u: '#8a3b2e', B: '#4fb2ff' };
const OVERLAY = {
  warning: [[21, 1, 'y'], [22, 1, 'y'], [21, 2, 'y'], [22, 2, 'y'], [21, 3, 'y'], [22, 3, 'y'], [21, 4, 'y'], [22, 4, 'y'], [21, 6, 'y'], [22, 6, 'y']],
  celebrating: [[2, 3, 'y'], [1, 4, 'y'], [2, 4, 'y'], [3, 4, 'y'], [2, 5, 'y'], [21, 2, 'y'], [20, 3, 'y'], [21, 3, 'y'], [22, 3, 'y'], [21, 4, 'y'], [9, 10, 'u'], [14, 10, 'u'], [9, 11, 'u'], [14, 11, 'u']],
  encouraging: [[22, 1, 'B'], [22, 2, 'B'], [22, 3, 'B'], [22, 4, 'B'], [21, 5, 'B'], [22, 5, 'B'], [23, 1, 'B'], [23, 2, 'B']],
  explaining: []
};
const TSTATE = { explaining: 'SPIEGA', encouraging: 'INCORAGGIA', warning: 'ATTENZIONE', celebrating: 'BRAVO!' };

function mod(n, m) { return ((n % m) + m) % m; }
function spell(root, lt, pc) {
  const li = (root.l + lt) % 7;
  const d = mod(pc - NAT[li], 12);
  const acc = d > 6 ? d - 12 : d;
  return LETTERS[li] + (acc === 0 ? '' : acc === 1 ? '#' : acc === -1 ? 'b' : acc === 2 ? 'x' : 'bb');
}
function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function pseudo(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
function opts(list) { return list.map((o) => ({ v: o[0], l: o[1] })); }
function windowsFor(pos, rootPc) {
  if (pos === 'all') return [[0, 24]];
  const b = CAGED[pos] || CAGED.c;
  const out = [];
  [-12, 0, 12].forEach((k) => {
    const lo = b[0] + rootPc + k, hi = b[1] + rootPc + k;
    if (hi < 0 || lo > 24) return;
    out.push([Math.max(0, lo), Math.min(24, hi)]);
  });
  out.sort((a, c) => a[0] - c[0]);
  return out;
}
function voicingFrets(chordPcs, a, tun) {
  const lo = a, hi = a + 4, rootC = chordPcs[0];
  let bass = -1, bf = -1;
  for (let s = 0; s < 6 && bass < 0; s++) {
    for (let f = lo; f <= hi; f++) { if ((tun.midi[s] + f) % 12 === rootC) { bass = s; bf = f; break; } }
  }
  const out = [];
  for (let s = 0; s < 6; s++) {
    if (bass < 0 || s < bass) { out.push(-1); continue; }
    if (s === bass) { out.push(bf); continue; }
    let fr = -1;
    for (let f = lo; f <= hi; f++) { if (chordPcs.indexOf((tun.midi[s] + f) % 12) >= 0) { fr = f; break; } }
    out.push(fr);
  }
  return out;
}

