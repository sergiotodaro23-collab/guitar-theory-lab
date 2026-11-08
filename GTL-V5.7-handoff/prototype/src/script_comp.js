
/* ===== V5.2 additions ===== */
const CQ = {
  maj: { l: 'Maggiore', iv: [0, 4, 7], s: '' }, min: { l: 'Minore', iv: [0, 3, 7], s: 'm' }, dim: { l: 'Diminuito', iv: [0, 3, 6], s: 'dim' },
  sus2: { l: 'Sus2', iv: [0, 2, 7], s: 'sus2' }, sus4: { l: 'Sus4', iv: [0, 5, 7], s: 'sus4' },
  '7': { l: 'Settima (dominante)', iv: [0, 4, 7, 10], s: '7' }, maj7: { l: 'Maggiore 7', iv: [0, 4, 7, 11], s: 'maj7' },
  m7: { l: 'Minore 7', iv: [0, 3, 7, 10], s: 'm7' }, m7b5: { l: 'Semidiminuito', iv: [0, 3, 6, 10], s: 'm7b5' }, dim7: { l: 'Diminuito 7', iv: [0, 3, 6, 9], s: 'dim7' }
};
const DEGN = { 0: 'R', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7' };
const FUNC = ['Tonica', 'Sottodominante', 'Tonica', 'Sottodominante', 'Dominante', 'Tonica', 'Dominante'];
const SL_COL = ['#d84fa8', '#1fbfb6', '#e0c030', '#8fd14f'];
const CL_COL = ['#ff7f50', '#6f8cff', '#c9d94a', '#ff5fa2', '#3fd0e0', '#b08cff', '#f0a040'];
const VZ_DEF = { scale: true, chord: true, arp: false, overlap: 'chord', target: true, play: true, det: true, anim: 'pulse', lstyle: 'bars' };
const MAXVIS = 3;
const TAB_NAMES = ['Scale', 'Chords', 'Exercise', 'Legend', 'Next Fretboard'];
const TAB_COL = ['#7fb2e0', '#74c795', '#f0a05a', '#ae92e6', '#dcbc4e'];
const OVN = { iface: 'Guitar Input', amp: 'Amplifier / NAM', tuner: 'Chromatic Tuner', mixer: 'Analog Mixer' };
const ICON = {
  fretboard: 'M3 6h18M3 10h18M3 14h18M3 18h18M8 4v16M13 4v16M18 4v16',
  harmony: 'M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM9 18V5l11-2v13M20 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z',
  arpeggios: 'M3 19l4-6 4 3 4-9 6 5M3 19h.01M7 13h.01M11 16h.01M15 7h.01M21 12h.01',
  jam: 'M4 12h2M8 7v10M12 4v16M16 8v8M20 11v2',
  iface: 'M12 3v7M8.5 10h7v4.5a3.5 3.5 0 0 1-7 0zM12 18v3',
  amp: 'M3 6h18v12H3zM3 9.5h18M7 14h.01M11 14h.01M15 14h.01M18.5 14h.01',
  tuner: 'M9 3v8a3 3 0 0 0 6 0V3M12 14v7M8 21h8',
  mixer: 'M6 3v18M12 3v18M18 3v18M4 15h4M10 8h4M16 12h4'
};
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
/* three-notes-per-string shape starting on degree p (0-based) on the lowest string; shifted an octave each way and clipped to frets 0-24 */
function npsShape(tun, scalePcs, p) {
  const inScale = (m) => scalePcs.indexOf(m % 12) >= 0;
  let m0 = tun.midi[0]; while (m0 % 12 !== scalePcs[p]) m0++;
  const set = {}; let lo = 99, hi = -1;
  [-12, 0, 12].forEach((sh) => {
    let m = m0 + sh;
    for (let s = 0; s < 6; s++) {
      for (let k = 0; k < 3; k++) {
        const f = m - tun.midi[s];
        if (f >= 0 && f <= 24) { set[s + '-' + f] = 1; if (sh === 0) { lo = Math.min(lo, f); hi = Math.max(hi, f); } }
        do { m++; } while (!inScale(m));
      }
    }
  });
  if (hi < 0) { lo = 0; hi = 4; }
  return { set, lo, hi };
}
/* position filter: 'all' | caged letter | n1..n7 */
function posFilter(pos, rootPc, scalePcs, tun) {
  if (pos && pos.charAt(0) === 'n' && scalePcs.length === 7) {
    const p = Number(pos.slice(1)) - 1; const sh = npsShape(tun, scalePcs, p);
    return { kind: 'n3', test: (s, f) => !!sh.set[s + '-' + f], lo: sh.lo, hi: sh.hi, label: '3NPS ' + (p + 1) };
  }
  if (pos && CAGED[pos]) {
    const w = windowsFor(pos, rootPc);
    return { kind: 'caged', test: (s, f) => w.some((x) => f >= x[0] && f <= x[1]), lo: w[0][0], hi: w[0][1], label: 'CAGED ' + pos.toUpperCase(), wins: w };
  }
  return { kind: 'all', test: () => true, lo: 0, hi: 12, label: 'Tutta la tastiera' };
}
function chordFrom(rootIdx, qual) {
  const q = CQ[qual] || CQ.maj; const rn = ROOTS[rootIdx].n; const flat = rn.indexOf('b') >= 0 || rn === 'F';
  const rpc = ROOTS[rootIdx].pc; const pcs = q.iv.map((i) => mod(rpc + i, 12));
  const names = pcs.map((pc) => (flat ? FLATN[pc] : SHARPN[pc]));
  return { name: names[0] + q.s, sym: q.s, pcs, names, degs: q.iv.map((i) => (qual === 'dim7' && i === 9 ? 'bb7' : DEGN[i])), custom: true };
}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      playing: false, paused: false, step: 0, done: false, bpm: null, swing: 0, metric: '4/4', clickMode: 'beat', loop: true,
      vClick: 67, vGuitar: 83, vChords: 70, vBass: 70, vDrums: 70, vInput: 60, vMaster: 83, mClick: false, mGuitar: false, mChords: false, mBass: false, mDrums: false, mInput: false, mMaster: false,
      inGain: 62, ioCh: 1, ws: 'fretboard', tab: 0, lcdX: true, vz: Object.assign({}, VZ_DEF), overlay: null, ovOut: false, railX: false, vizOpen: false, setOpen: false, routineOpen: false,
      mode: null, tonic: 0, scale: 'major', chordMode: 'dia', chord: 0, cusRoot: 0, cusQual: 'maj7', inv: 0, pos: 'c', voicing: 'std',
      prog: [{ mode: 'dia', i: 0 }, { mode: 'dia', i: 3 }, { mode: 'dia', i: 4 }, { mode: 'dia', i: 0 }], progIdx: 0,
      scLayers: [], chLayers: [],
      exType: 'arp', exDir: 'asc', exTempo: '8', exReps: 'inf',
      dens: 'perf', tension: true, guide: true, avoid: true, external: false, tuning: 'std', preset: 'studio',
      tuner: false, calib: 440, nam: false, ampBypass: false, live: false, demo: false, dt: 0, tunerStr: 1, tunerRef: -1,
      amp: { gain: 55, bass: 50, mid: 60, treble: 58, presence: 45, out: 62 },
      toast: '', ui: 'studio', fbR: null, avail: 0, vh: 1000, nbH: 400
    };
    this._step = 0; this._timer = null; this._taps = []; this._tt = null; this._live = null; this._dti = null; this.ac = null; this.master = null;
    this.tick = this.tick.bind(this);
  }
  componentDidMount() {
    this._rs = () => { const h = window.innerHeight; if (h !== this.state.vh) this.setState({ vh: h }); this.measure(); };
    window.addEventListener('resize', this._rs);
    this._esc = (e) => {
      if (e.key !== 'Escape') return; const S = this.state;
      if (S.vizOpen) { this.setState({ vizOpen: false }); this.focusSel('.vzbtn'); }
      else if (S.setOpen) { this.setState({ setOpen: false }); }
      else if (S.overlay) { this.closeOv(); }
      else if (S.ui === 'simple') { this.setState({ ui: 'studio' }); }
    };
    window.addEventListener('keydown', this._esc);
    try {
      const r = window.localStorage.getItem('gtl.v5.fbR'); const x = window.localStorage.getItem('gtl.v5.railX');
      const o = {}; if (r != null && !isNaN(Number(r))) o.fbR = Number(r); if (x === '1') o.railX = true; const dn = window.localStorage.getItem('gtl.v5.dens'); if (dn === 'perf' || dn === 'anal') o.dens = dn; const lx = window.localStorage.getItem('gtl.v5.lcdX'); if (lx === '0') o.lcdX = false; const vzr = window.localStorage.getItem('gtl.v5.vz'); if (vzr) { try { const v = JSON.parse(vzr); const z = Object.assign({}, VZ_DEF); Object.keys(VZ_DEF).forEach((k) => { if (typeof v[k] === typeof VZ_DEF[k]) z[k] = v[k]; }); o.vz = z; } catch (x) {} }
      Object.assign(o, this.devLoad());
      if (Object.keys(o).length) this.setState(o);
    } catch (e) {}
    this._rs();
    setTimeout(() => this.measure(), 60);
  }
  componentDidUpdate() {
    this.measure(); this.devPersist();
    if (this._tsPending != null && this._tsPending === this.state.tab) {
      const pg = document.querySelector('.pg'); const y = (this._ts && this._ts[this.state.tab]) || 0; this._tsPending = null;
      if (pg) pg.scrollTop = y;
    }
    const ov = this.state.overlay;
    if (ov !== this._lastOv) {
      if (ov) { const ae = document.activeElement; if (!this._lastOv || (ae && ae.classList && ae.classList.contains('rb'))) this._ret = ae; setTimeout(() => this.focusSel('.dclose'), 40); }
      else if (this._ret && this._ret.focus) { try { this._ret.focus(); } catch (e) {} }
      this._lastOv = ov;
    }
    if (this.state.demo && !this._dti) this._dti = setInterval(() => this.setState({ dt: this.state.dt + 1 }), 650);
    if (!this.state.demo && this._dti) { clearInterval(this._dti); this._dti = null; }
  }
  componentWillUnmount() {
    if (this._rs) window.removeEventListener('resize', this._rs);
    if (this._esc) window.removeEventListener('keydown', this._esc);
    if (this._timer) clearTimeout(this._timer);
    if (this._tt) clearTimeout(this._tt);
    if (this._dti) clearInterval(this._dti);
    try { if (this.ac) this.ac.close(); } catch (e) {}
  }
  focusSel(sel) { const el = typeof document !== 'undefined' ? document.querySelector(sel) : null; if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
  save(k, v) { try { window.localStorage.setItem('gtl.v5.' + k, String(v)); } catch (e) {} }
  /* measure the work column: available height shared by fretboard panel and notebook */
  measure() {
    const w = typeof document !== 'undefined' ? document.querySelector('.work') : null; if (!w) return;
    const c = w.querySelector('.deck'), d = w.querySelector('.split'); if (!c || !d) return;
    const av = w.clientHeight - c.offsetHeight - d.offsetHeight - 18;
    const fb = this.fbNow(av);
    const nb = Math.round(av - fb); const nw = w.clientWidth;
    if (Math.abs(av - this.state.avail) > 0.5 || Math.abs(nb - this.state.nbH) > 1 || Math.abs(nw - (this.state.nbW || 0)) > 1) this.setState({ avail: av, nbH: nb, nbW: nw });
  }
  fbRange(av) { const min = 224; const max = Math.max(min, Math.min(542, Math.round(av - 200))); return [min, max]; }
  fbNow(avIn) {
    const S = this.state; const av = avIn || S.avail || (S.vh - 16 - 16 - 118 - 14 - 18);
    const def = S.vh >= 940 ? 350 : (S.vh >= 820 ? 296 : 266);
    const r = this.fbRange(av);
    let v = this._live != null ? this._live : (S.fbR != null ? S.fbR * av : def);
    return clamp(Math.round(v), r[0], r[1]);
  }
  bpmNow() { const b = this.state.bpm != null ? this.state.bpm : (this.props.bpm != null ? Number(this.props.bpm) : 100); return clamp(b, 40, 240); }
  modeNow() { return this.state.mode != null ? this.state.mode : (this.props.labelMode || 'note'); }
  flash(msg) { this.setState({ toast: msg }); if (this._tt) clearTimeout(this._tt); this._tt = setTimeout(() => this.setState({ toast: '' }), 2800); }
  goTab(n) {
    if (n === this.state.tab) return;
    try { const pg = document.querySelector('.pg'); this._ts = this._ts || {}; if (pg) this._ts[this.state.tab] = pg.scrollTop; } catch (e) {}
    this._tsPending = n; this.setState({ tab: n });
  }
  closeOv() {
    if (!this.state.overlay || this.state.ovOut) return;
    let red = false; try { red = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (red) { this.setState({ overlay: null }); return; }
    this.setState({ ovOut: true });
    setTimeout(() => this.setState({ overlay: null, ovOut: false }), 260);
  }
  devPersist() {
    try {
      const S = this.state; const d = {};
      ['vClick', 'vGuitar', 'vChords', 'vBass', 'vDrums', 'vInput', 'vMaster', 'mClick', 'mGuitar', 'mChords', 'mBass', 'mDrums', 'mInput', 'mMaster', 'inGain', 'ioCh', 'amp', 'ampBypass', 'nam', 'calib'].forEach((k) => { d[k] = S[k]; });
      const j = JSON.stringify(d);
      if (j !== this._devJ) { this._devJ = j; window.localStorage.setItem('gtl.v5.dev', j); }
    } catch (e) {}
  }
  devLoad() {
    try {
      const raw = window.localStorage.getItem('gtl.v5.dev'); if (!raw) return {};
      const d = JSON.parse(raw); const o = {};
      const num = (k) => { if (typeof d[k] === 'number' && d[k] >= 0 && d[k] <= 100) o[k] = d[k]; };
      const bool = (k) => { if (typeof d[k] === 'boolean') o[k] = d[k]; };
      ['vClick', 'vGuitar', 'vChords', 'vBass', 'vDrums', 'vInput', 'vMaster', 'inGain'].forEach(num);
      ['mClick', 'mGuitar', 'mChords', 'mBass', 'mDrums', 'mInput', 'mMaster', 'ampBypass', 'nam'].forEach(bool);
      if (d.ioCh === 1 || d.ioCh === 2) o.ioCh = d.ioCh;
      if (typeof d.calib === 'number' && d.calib >= 435 && d.calib <= 445) o.calib = d.calib;
      if (d.amp && typeof d.amp === 'object') { const a = {}; ['gain', 'bass', 'mid', 'treble', 'presence', 'out'].forEach((k) => { a[k] = (typeof d.amp[k] === 'number' && d.amp[k] >= 0 && d.amp[k] <= 100) ? d.amp[k] : this.state.amp[k]; }); o.amp = a; }
      return o;
    } catch (e) { return {}; }
  }
  /* ---------- audio ---------- */
  ensureAudio() {
    if (!this.ac) {
      try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ac = new AC(); this.master = this.ac.createGain(); this.master.connect(this.ac.destination); } catch (e) { this.ac = null; return null; }
    }
    if (this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) {} }
    return this.ac;
  }
  gainOf(v) { return v <= 1.5 ? 0 : Math.pow(10, (-30 + v * 0.36) / 20); }
  blip(f, dur, vol, type, t0) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  refTone(pc) {
    if (this.props.sound === false) return; const ac = this.ensureAudio(); if (!ac) return;
    this.master.gain.value = Math.min(1.6, this.gainOf(this.state.vMaster)) * 0.8;
    this.blip(freq(60 + pc) * (this.state.calib || 440) / 440, 1.1, 0.22, 'sine', ac.currentTime + 0.01);
  }
  sound(m, step) {
    if (this.props.sound === false) return;
    const ac = this.ensureAudio(); if (!ac) return;
    const S = this.state; if (S.mMaster) return;
    this.master.gain.value = Math.min(1.6, this.gainOf(S.vMaster)) * 0.8;
    const t0 = ac.currentTime + 0.01;
    if (S.clickMode !== 'off' && step % m.subdiv === 0 && !S.mClick) {
      const beat = Math.floor(step / m.subdiv) % m.bpb;
      if (!(S.clickMode === 'accent' && beat !== 0)) this.blip(beat === 0 ? 1500 : 1000, 0.05, 0.3 * this.gainOf(S.vClick), 'square', t0);
    }
    const n = m.seq.length ? m.seq[step % m.seq.length] : null;
    if (n && !S.mGuitar) { const d = Math.min(0.7, 60 / m.bpm / m.subdiv * 1.6); this.blip(freq(n.midi), d, 0.22 * this.gainOf(S.vGuitar) * (0.5 + 0.5 * S.inGain / 100), 'triangle', t0); }
  }
  /* ---------- transport ---------- */
  tick() {
    const S = this.state; if (!S.playing) return;
    const m = this.model(); const step = this._step;
    this.sound(m, step); this.setState({ step: step });
    const L = Math.max(1, m.seq.length);
    const reps = S.loop ? (S.exReps === 'inf' ? Infinity : Number(S.exReps)) : 1;
    const next = step + 1; this._step = next;
    const base = 60000 / m.bpm / m.subdiv; const sw = (S.swing / 100) * 0.5;
    const delay = m.subdiv >= 2 ? base * (step % 2 === 0 ? 1 + sw : 1 - sw) : base;
    if (next >= L * reps) { this._timer = setTimeout(() => this.finish(), delay); return; }
    this._timer = setTimeout(this.tick, delay);
  }
  finish() { this._timer = null; this._step = 0; this.setState({ playing: false, paused: false, done: true, step: 0 }); }
  play() { if (this.state.playing) return; this.ensureAudio(); if (!this.state.paused) this._step = 0; this.setState({ playing: true, paused: false, done: false }, () => this.tick()); }
  pause() {
    if (this.state.playing) { if (this._timer) clearTimeout(this._timer); this._timer = null; this.setState({ playing: false, paused: true }); }
    else if (this.state.paused) this.play();
  }
  stop() { if (this._timer) clearTimeout(this._timer); this._timer = null; this._step = 0; this.setState({ playing: false, paused: false, step: 0, done: false }); }
  setBpm(v) { this.setState({ bpm: clamp(Math.round(v), 40, 240) }); }
  tap() {
    const now = Date.now();
    if (this._taps.length && now - this._taps[this._taps.length - 1] > 2000) this._taps = [];
    this._taps.push(now); if (this._taps.length > 5) this._taps.shift();
    if (this._taps.length >= 2) { let sum = 0; for (let i = 1; i < this._taps.length; i++) sum += this._taps[i] - this._taps[i - 1]; this.setBpm(60000 / (sum / (this._taps.length - 1))); }
  }
  /* ---------- music model ---------- */
  model() {
    const S = this.state;
    const root = ROOTS[S.tonic], sc = SCALES[S.scale], rootPc = root.pc;
    const scalePcs = sc.iv.map((i) => mod(rootPc + i, 12));
    const scaleNames = sc.iv.map((iv, i) => spell(root, sc.lt[i], scalePcs[i]));
    const par = SCALES[sc.parent || S.scale];
    const pPcs = par.iv.map((i) => mod(rootPc + i, 12));
    const pNames = par.iv.map((iv, i) => spell(root, par.lt[i], pPcs[i]));
    const chords = [];
    for (let i = 0; i < 7; i++) {
      const idx = [i, (i + 2) % 7, (i + 4) % 7, (i + 6) % 7];
      const pcs = idx.map((k) => pPcs[k]), names = idx.map((k) => pNames[k]);
      const rel = pcs.map((pc) => mod(pc - pcs[0], 12));
      const sym = QUAL[rel.join(',')] || '?';
      const degs = ['R', rel[1] === 3 ? 'b3' : '3', rel[2] === 6 ? 'b5' : (rel[2] === 8 ? '#5' : '5'), rel[3] === 9 ? 'bb7' : (rel[3] === 10 ? 'b7' : '7')];
      chords.push({ name: names[0] + sym, sym, pcs, names, degs, roman: ROMAN[i], di: i });
    }
    const mkEntry = (en) => (en.mode === 'cus' ? chordFrom(en.root, en.qual) : Object.assign({}, chords[Math.min(en.i, 6)]));
    let ch = null;
    if (S.chordMode === 'dia') ch = Object.assign({}, chords[Math.min(S.chord, 6)]);
    else if (S.chordMode === 'cus') ch = chordFrom(S.cusRoot, S.cusQual);
    let inv = 0;
    if (ch) { inv = Math.min(S.inv, ch.pcs.length - 1); ch.inv = inv; ch.full = ch.name + (inv ? '/' + ch.names[inv] : ''); }
    const chordPcs = ch ? ch.pcs : [], chordRoot = ch ? ch.pcs[0] : -1;
    const guidePcs = ch ? ch.pcs.filter((pc, i) => ['3', 'b3', '7', 'b7', 'bb7'].indexOf(ch.degs[i]) >= 0) : [];
    const tun = TUNINGS[S.tuning];
    const posEff = (S.pos.charAt(0) === 'n' && scalePcs.length !== 7) ? 'all' : S.pos;
    const pf = posFilter(posEff, rootPc, scalePcs, tun);
    const flatKey = root.n.indexOf('b') >= 0 || root.n === 'F';
    const nameOf = (pc) => { const k = scalePcs.indexOf(pc); return k >= 0 ? scaleNames[k] : (flatKey ? FLATN[pc] : SHARPN[pc]); };
    const isAvoid = (pc) => !!ch && scalePcs.indexOf(pc) >= 0 && chordPcs.indexOf(pc) < 0 && chordPcs.indexOf(mod(pc - 1, 12)) >= 0;
    const mode = this.modeNow();
    const an = S.dens === 'anal';
    const fl = { tension: an && S.tension, guide: an && S.guide, avoid: an && S.avoid, external: an && S.external };
    const finger = (f) => { if (f === 0) return '0'; if (pf.kind === 'all') return String(((f + 3) % 4) + 1); return String(Math.min(4, Math.max(1, f - pf.lo + 1))); };
    const labelFor = (pc, f) => {
      if (mode === 'none') return '';
      if (mode === 'note') return nameOf(pc);
      if (mode === 'grade') { const k = scalePcs.indexOf(pc); return k >= 0 ? sc.deg[k] : ''; }
      if (mode === 'function') { if (!ch) return ''; const k = chordPcs.indexOf(pc); if (k >= 0) return ch.degs[k]; return EXT[mod(pc - chordRoot, 12)] || ''; }
      if (mode === 'finger') return finger(f);
      return INTV[mod(pc - rootPc, 12)];
    };
    /* layers */
    const slv = !an ? [] : S.scLayers.map((l, i) => ({ i, color: SL_COL[i], vis: l.vis, pcs: SCALES[l.scale].iv.map((iv) => mod(ROOTS[l.tonic].pc + iv, 12)) })).filter((l) => l.vis);
    const clv = !an ? [] : S.chLayers.map((l, i) => ({ i, color: CL_COL[i], vis: l.vis, pcs: chordFrom(l.root, l.qual).pcs })).filter((l) => l.vis);
    /* exercise sequence (restricted to the active position) */
    const target = S.exType === 'scale' ? scalePcs : chordPcs;
    const startPc = S.exType === 'scale' ? rootPc : chordRoot;
    const pool = []; const seen = {};
    for (let s = 0; s < 6; s++) for (let f = pf.lo; f <= pf.hi; f++) {
      const midi = tun.midi[s] + f;
      if (target.indexOf(midi % 12) >= 0 && !seen[midi] && pf.test(s, f)) { seen[midi] = 1; pool.push({ s, f, midi }); }
    }
    pool.sort((a, b) => a.midi - b.midi);
    let i0 = -1; for (let i = 0; i < pool.length; i++) { if (pool[i].midi % 12 === startPc) { i0 = i; break; } }
    const want = (S.exType === 'scale' ? scalePcs.length : chordPcs.length) + 1;
    const asc = i0 < 0 ? [] : pool.slice(i0, i0 + want);
    let seq = asc.slice();
    if (S.exDir === 'desc') seq = asc.slice().reverse(); else if (S.exDir === 'updown') seq = asc.concat(asc.slice(1, -1).reverse());
    const subdiv = S.exTempo === '16' ? 4 : (S.exTempo === '4' ? 1 : 2);
    const running = S.playing || S.paused;
    const L = seq.length;
    const cur = running && L ? seq[S.step % L] : null;
    const nxt = running && L > 1 ? seq[(S.step + 1) % L] : null;
    /* demo input (clearly simulated) */
    let det = null;
    if (S.demo) {
      const dm = cur ? cur.midi : tun.midi[S.tunerStr];
      det = { midi: dm, cents: Math.round((pseudo(S.dt * 3.7 + (cur ? S.step : 0)) - 0.5) * 36) };
    }
    /* next chord in the progression */
    let next = null;
    if (S.progIdx >= 0 && S.prog.length >= 2) next = mkEntry(S.prog[(S.progIdx + 1) % S.prog.length]);
    /* markers */
    const seqKeys = {}; seq.forEach((n) => { seqKeys[n.s + ':' + n.f] = 1; });
    const markers = []; const cats = {};
    for (let r = 0; r < 6; r++) {
      const s = 5 - r;
      for (let f = 0; f <= 24; f++) {
        if (!pf.test(s, f)) continue;
        const midi = tun.midi[s] + f, pc = midi % 12;
        const inScale = scalePcs.indexOf(pc) >= 0, inChord = chordPcs.indexOf(pc) >= 0;
        const slc = slv.filter((l) => l.pcs.indexOf(pc) >= 0).map((l) => l.color);
        const clc = clv.filter((l) => l.pcs.indexOf(pc) >= 0).map((l) => l.color);
        const isDet = !!det && det.midi === midi;
        const VZ = S.vz || VZ_DEF;
        const isPl = VZ.play && !!cur && cur.s === s && cur.f === f, isTg = VZ.target && !!nxt && nxt.s === s && nxt.f === f;
        const isSeq = VZ.arp && seqKeys[s + ':' + f] === 1;
        const showCh = VZ.chord && inChord;
        let role = null, cring = false;
        if (pc === rootPc) role = 'tonic';
        else if (showCh && VZ.overlap === 'split' && inScale) { role = 'scale'; cring = true; }
        else if (showCh) role = 'chord';
        else if (inScale && VZ.scale) role = (fl.tension && ch && VZ.chord && !isAvoid(pc)) ? 'tension' : 'scale';
        else if (inChord && !inScale && !VZ.chord && fl.external) role = 'external';
        else if (!inScale && (fl.external || slc.length || clc.length || (isDet && VZ.det))) role = 'external';
        if (!role && (isPl || isTg || isSeq || (isDet && VZ.det))) role = inScale ? 'scale' : 'external';
        if (!role) continue;
        const dtOn = isDet && VZ.det;
        const av = VZ.chord && fl.avoid && isAvoid(pc), gd = VZ.chord && fl.guide && guidePcs.indexOf(pc) >= 0, cr = VZ.chord && !!ch && pc === chordRoot, ot = an && showCh && !inScale;
        cats[role] = true; if (av) cats.avoid = true; if (gd) cats.guide = true; if (cr) cats.cr = true; if (ot) cats.out = true; if (dtOn) cats.det = true; if (cring) cats.split = true; if (isSeq) cats.seq = true;
        markers.push({
          wrap: 'left:calc(' + (f * 4 + 2) + '% - var(--mk)/2);top:calc(var(--rp)*' + (r + 0.5) + ' + 6px - var(--mk)/2)',
          role, label: labelFor(pc, f), cr, gd, av, ot, tg: isTg, pl: isPl, dt: dtOn, sl: slc.slice(0, MAXVIS).join(','), cl: clc.slice(0, MAXVIS).join(','), cring, seq: isSeq, plA: isPl ? '1' : '0', dtA: dtOn ? '1' : '0'
        });
      }
    }
    return { an, fl, root, sc, rootPc, scalePcs, scaleNames, chords, ch, chordPcs, chordRoot, guidePcs, tun, pf, posEff, seq, subdiv, bpm: this.bpmNow(), bpb: BPB[S.metric] || 4, markers, cats, nameOf, isAvoid, cur, nxt, det, next, mkEntry, slv, clv, running, flatKey };
  }
  /* ---------- helpers for the view ---------- */
  noteLabel(midi, flat) { return (flat ? FLATN : SHARPN)[midi % 12]; }
  nextView(m) {
    const S = this.state; const ws = S.ws;
    const out = { lab: WS[ws], now: '—', nowSub: '', nxt: '—', nxtSub: '', msg: '', hint: '', dots: [], ghosts: [], lo: 0, hi: 12, aria: '' };
    const GT = ['3', 'b3', '7', 'b7', 'bb7'];
    const win = (pf) => { const lo = pf.kind === 'all' ? 0 : pf.lo; let hi = pf.kind === 'all' ? 12 : Math.max(pf.hi, pf.lo + 6); hi = Math.min(24, hi, lo + 12); return [lo, hi]; };
    if (ws === 'fretboard') {
      out.now = m.pf.label; out.nowSub = m.pf.kind === 'all' ? 'tasti 0–24' : 'tasti ' + m.pf.lo + '–' + m.pf.hi;
      if (m.pf.kind === 'all') { out.msg = 'Con «Tutta la tastiera» non esiste una posizione successiva: scegli CAGED o 3NPS nel tab Scale.'; out.aria = 'Anteprima vuota: nessuna posizione successiva'; return out; }
      const np = m.pf.kind === 'caged' ? CAGED_ORDER[(CAGED_ORDER.indexOf(S.pos) + 1) % 5] : 'n' + ((Number(m.posEff.slice(1)) % 7) + 1);
      const pf2 = posFilter(np, m.rootPc, m.scalePcs, m.tun); const w = win(pf2); out.lo = w[0]; out.hi = w[1];
      out.nxt = pf2.label; out.nxtSub = 'tasti ' + pf2.lo + '–' + pf2.hi;
      for (let s2 = 0; s2 < 6; s2++) for (let f = out.lo; f <= out.hi; f++) {
        const pc = (m.tun.midi[s2] + f) % 12; if (!pf2.test(s2, f) || m.scalePcs.indexOf(pc) < 0) continue;
        out.dots.push({ s: s2, f, role: pc === m.rootPc ? 'tonic' : 'scale', label: m.nameOf(pc) });
      }
      out.hint = 'Dopo ' + m.pf.label + ' la sequenza prosegue con ' + pf2.label + '.'; out.aria = 'Anteprima della posizione ' + pf2.label;
      return out;
    }
    const cur = m.ch, nc = m.next;
    if (cur) { out.now = cur.full; out.nowSub = cur.custom ? 'accordo personalizzato' : cur.roman + ' · ' + FUNC[cur.di]; }
    else { out.now = 'Nessun accordo'; out.nowSub = 'solo scala'; }
    const w = win(m.pf); out.lo = w[0]; out.hi = w[1];
    if (!nc) { out.msg = 'Nessun accordo successivo: nel tab Chords seleziona un accordo della progressione (almeno due voci).'; out.aria = 'Anteprima vuota: nessun accordo successivo'; return out; }
    out.nxt = nc.name; out.nxtSub = nc.custom ? 'accordo personalizzato' : nc.roman + ' · ' + FUNC[nc.di];
    const gp = nc.pcs.filter((pc, i) => GT.indexOf(nc.degs[i]) >= 0);
    for (let s2 = 0; s2 < 6; s2++) for (let f = out.lo; f <= out.hi; f++) {
      if (!m.pf.test(s2, f)) continue;
      const pc = (m.tun.midi[s2] + f) % 12; const k = nc.pcs.indexOf(pc);
      if (k >= 0) {
        const isR = k === 0;
        out.dots.push({ s: s2, f, role: pc === m.rootPc ? 'tonic' : 'chord', label: nc.names[k], cr: isR, gd: ws !== 'arpeggios' && gp.indexOf(pc) >= 0, tg: ws === 'arpeggios' && isR });
      } else if (ws === 'jam' && m.scalePcs.indexOf(pc) >= 0) out.dots.push({ s: s2, f, role: 'scale', label: '' });
      else if (ws === 'harmony' && cur && cur.pcs.indexOf(pc) >= 0) out.ghosts.push({ s: s2, f });
    }
    if (ws === 'harmony' && cur) {
      const gc = cur.pcs.map((pc, i) => ({ pc, i })).filter((x) => GT.indexOf(cur.degs[x.i]) >= 0);
      const parts = gc.map((g) => {
        let best = null; nc.pcs.forEach((n, j) => { const d = ((n - g.pc + 18) % 12) - 6; if (best === null || Math.abs(d) < Math.abs(best.d)) best = { d, j }; });
        return cur.names[g.i] + ' → ' + nc.names[best.j] + ' (' + (best.d > 0 ? '+' : (best.d < 0 ? '−' : '')) + Math.abs(best.d) + ' st)';
      });
      const common = cur.pcs.filter((pc) => nc.pcs.indexOf(pc) >= 0).length;
      out.hint = 'Guide tone: ' + parts.join(' · ') + '. Note in comune: ' + common + '.';
    } else if (ws === 'arpeggios') out.hint = 'Destinazione: la fondamentale ' + nc.names[0] + ' (anello tratteggiato).';
    else if (ws === 'jam') out.hint = 'Scala in grigio-blu, note del prossimo accordo evidenziate.';
    else out.hint = 'Note: ' + nc.names.join(' · ') + '.';
    out.aria = 'Anteprima del prossimo accordo ' + nc.name;
    return out;
  }
  /* ---------- view ---------- */
  renderVals() {
    const S = this.state;
    const m = this.model();
    const bpm = m.bpm, running = m.running, ch = m.ch;
    const gf = (v) => 0.2 + 0.8 * v / 100;
    const flat = m.flatKey;

    /* geometry */
    const fbh = this.fbNow();
    const av = S.avail || (S.vh - 16 - 16 - 118 - 14 - 18);
    const fr = this.fbRange(av);
    const strings = [], gutter = [];
    const widths = [1.2, 1.7, 2.3, 3, 3.8, 4.6];
    const tints = ['linear-gradient(180deg,#f3f6f8,#aab1b8)', 'linear-gradient(180deg,#f3f6f8,#aab1b8)', 'linear-gradient(180deg,#e6e0d2,#a39c8b)', 'linear-gradient(180deg,#e6e0d2,#a39c8b)', 'linear-gradient(180deg,#e0b777,#8e6430)', 'linear-gradient(180deg,#e0b777,#8e6430)'];
    for (let r = 0; r < 6; r++) {
      const h = widths[r];
      strings.push({ style: 'top:calc(var(--rp)*' + (r + 0.5) + ' + ' + (6 - h / 2).toFixed(1) + 'px);height:' + h + 'px;background:' + (r >= 2 ? 'repeating-linear-gradient(90deg,rgba(0,0,0,.30) 0 1px,rgba(0,0,0,0) 1px 3px),' : '') + tints[r] });
      gutter.push({ top: 'calc(var(--rp)*' + (r + 0.5) + ' + 6px - min(11px,calc(var(--rp)*.39)))', label: m.tun.names[5 - r] });
    }
    const frets = []; for (let k = 1; k <= 24; k++) frets.push({ left: 'calc(' + ((k + 1) * 4) + '% - 4px)' });
    const inlays = [];
    [3, 5, 7, 9, 15, 17, 19, 21].forEach((f) => inlays.push({ style: 'left:calc(' + (f * 4 + 2) + '% - 6.5px);top:calc(var(--bh)/2 - 6.5px)' }));
    [12, 24].forEach((f) => { inlays.push({ style: 'left:calc(' + (f * 4 + 2) + '% - 6.5px);top:calc(var(--bh)/2 - var(--rp) - 6.5px)' }); inlays.push({ style: 'left:calc(' + (f * 4 + 2) + '% - 6.5px);top:calc(var(--bh)/2 + var(--rp) - 6.5px)' }); });
    const KEYF = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
    const numbers = []; for (let f = 0; f <= 24; f++) numbers.push({ n: String(f), style: KEYF.indexOf(f) >= 0 ? 'color:#ff9a5c;text-shadow:0 0 6px rgba(242,107,29,.55)' : '' });

    /* nav / popovers */
    const lab = (id) => ({ label: WS[id], d: ICON[id], on: S.ws === id ? '1' : '0', cur: S.ws === id ? 'page' : 'false', pick: () => this.setState({ ws: id }) });
    const railLabs = ['fretboard', 'harmony', 'arpeggios', 'jam'].map(lab);
    const dev = (id) => ({ label: OVN[id], d: ICON[id], on: S.overlay === id ? '1' : '0', pressed: S.overlay === id ? 'true' : 'false', pick: () => { if (S.overlay === id) this.closeOv(); else this.setState({ overlay: id, ovOut: false, vizOpen: false, setOpen: false }); } });
    const railDevs = ['iface', 'amp', 'tuner', 'mixer'].map(dev);
    const modes = MODES.map((x) => ({ label: x[1], on: this.modeNow() === x[0] ? '1' : '0', checked: this.modeNow() === x[0] ? 'true' : 'false', pick: () => this.setState({ mode: x[0] }) }));
    const tg = (key, label) => ({ label, on: S[key] ? '1' : '0', pressed: S[key] ? 'true' : 'false', pick: () => this.setState({ [key]: !this.state[key] }) });
    const VZc = S.vz || VZ_DEF;
    const setVz = (patch) => { const z = Object.assign({}, this.state.vz || VZ_DEF, patch); this.setState({ vz: z }); this.save('vz', JSON.stringify(z)); };
    const vzT = (key, label) => ({ label, on: VZc[key] ? '1' : '0', pressed: VZc[key] ? 'true' : 'false', pick: () => setVz({ [key]: !VZc[key] }) });
    const vzShow = [vzT('scale', 'Note di scala'), vzT('chord', 'Note d\'accordo'), vzT('arp', 'Sequenza esercizio'), vzT('target', 'Bersaglio'), vzT('play', 'In esecuzione'), vzT('det', 'Nota rilevata')];
    const vzSeg = (key, opts) => opts.map((o) => ({ label: o[1], on: VZc[key] === o[0] ? '1' : '0', checked: VZc[key] === o[0] ? 'true' : 'false', pick: () => setVz({ [key]: o[0] }) }));
    const vzOverlap = vzSeg('overlap', [['chord', 'Prevale l\'accordo'], ['split', 'Scala + bordo accordo']]);
    const vzLayers = vzSeg('lstyle', [['bars', 'Barrette'], ['dots', 'Puntini']]);
    const vzAnim = vzSeg('anim', [['pulse', 'Pulsazione'], ['glow', 'Alone sotto'], ['static', 'Anello fisso']]);
    const toggles = [tg('tension', '9 · 11 · 13'), tg('guide', 'Guide tone'), tg('avoid', 'Avoid'), tg('external', 'Fuori scala')].map((t) => Object.assign(t, { dis: S.dens !== 'anal' }));
    const modeLabel = MODES.filter((x) => x[0] === this.modeNow())[0][1];
    const an0 = S.dens === 'anal';
    const layersOn = an0 ? [S.tension && '9·11·13', S.guide && 'GT', S.avoid && 'AV', S.external && 'EXT'].filter(Boolean).join(' ') : '';
    const vizSummary = (an0 ? 'Analisi' : 'Performance') + ' · ' + modeLabel + (layersOn ? ' · ' + layersOn : '');
    const densOpts = [['perf', 'Performance'], ['anal', 'Analisi']].map((x) => ({ label: x[1], on: S.dens === x[0] ? '1' : '0', checked: S.dens === x[0] ? 'true' : 'false', pick: () => { this.setState({ dens: x[0] }); this.save('dens', x[0]); } }));

    /* beat lamps */
    const stepInBeat = running ? S.step % m.subdiv : 0;
    const beat = running ? Math.floor(S.step / m.subdiv) % m.bpb : -1;
    const lamps = []; for (let i = 0; i < m.bpb; i++) { const lit = i === beat; const col = i === 0 ? 'var(--led-amber,#ffb23f)' : 'var(--led-green,#7dff6a)'; lamps.push({ style: 'background:' + col + ';opacity:' + (lit ? 1 : 0.18) + ';box-shadow:' + (lit ? '0 0 6px ' + col : 'none') }); }
    const lvClick = S.playing && S.clickMode !== 'off' ? (stepInBeat === 0 ? (beat === 0 ? 0.92 : 0.74) : 0.14) * gf(S.vClick) : 0;
    const lvNotes = S.playing && m.seq.length ? (0.42 + 0.4 * pseudo(S.step + 3)) * gf(S.vGuitar) * (0.4 + 0.6 * S.inGain / 100) : 0;

    /* scale tab */
    const sd = (() => {
      const lo = m.pf.kind === 'all' ? 0 : m.pf.lo; let rows = m.pf.kind === 'all' ? 5 : Math.max(4, Math.min(6, m.pf.hi - lo + 1)); if (lo + rows - 1 > 24) rows = 24 - lo + 1;
      const top = 16, h = 80, rh = h / rows;
      const strs = []; for (let i = 0; i < 6; i++) strs.push({ left: (14 + i * 13.2).toFixed(1) });
      const lines = []; for (let k = 0; k <= rows; k++) lines.push({ top: (top + k * rh).toFixed(1) });
      const dots = [];
      for (let s = 0; s < 6; s++) for (let f = lo; f < lo + rows; f++) {
        const pc = (m.tun.midi[s] + f) % 12; if (m.scalePcs.indexOf(pc) < 0 || !m.pf.test(s, f)) continue;
        const x = 14 + s * 13.2, y = top + (f - lo + 0.5) * rh; const tonic = pc === m.rootPc;
        dots.push({ style: 'left:' + (x - 5).toFixed(1) + 'px;top:' + (y - 5).toFixed(1) + 'px;width:10px;height:10px;border-radius:50%;background:' + (tonic ? 'var(--marker-tonic,#f08a24)' : 'var(--marker-scale,#4a9fe8)') });
      }
      return { nut: lo === 0, top, h, strings: strs, lines, dots, hasLab: lo > 0, lab: String(lo), labTop: top + 2 };
    })();
    const noteChips = m.scaleNames.map((n, i) => ({ v: n, t: i === 0 ? '1' : '0' }));
    const ivChips = m.sc.deg.map((d, i) => ({ v: d, t: i === 0 ? '1' : '0' }));
    const can3 = m.scalePcs.length === 7;
    const sys = S.pos === 'all' ? 'all' : (S.pos.charAt(0) === 'n' ? 'n3' : 'caged');
    const posSys = [['all', 'Tutta'], ['caged', 'CAGED'], ['n3', '3NPS']].map((x) => ({
      label: x[1], on: sys === x[0] ? '1' : '0', checked: sys === x[0] ? 'true' : 'false', dis: x[0] === 'n3' && !can3, title: x[0] === 'n3' && !can3 ? '3NPS è disponibile per le scale a 7 note' : '',
      pick: () => this.setState({ pos: x[0] === 'all' ? 'all' : (x[0] === 'caged' ? (CAGED[S.pos] ? S.pos : 'c') : 'n1') })
    }));
    const shapeList = sys === 'caged' ? CAGED_ORDER.map((c) => [c, c.toUpperCase()]) : (sys === 'n3' ? [1, 2, 3, 4, 5, 6, 7].map((n) => ['n' + n, String(n)]) : []);
    const posShapes = shapeList.map((x) => ({ label: x[1], on: S.pos === x[0] ? '1' : '0', checked: S.pos === x[0] ? 'true' : 'false', pick: () => this.setState({ pos: x[0] }) }));
    const posNote = m.pf.kind === 'all' ? 'Tutta la tastiera (tasti 0–24).' : (m.pf.label + ' · tasti ' + m.pf.lo + '–' + m.pf.hi + (S.pos.charAt(0) === 'n' && !can3 ? ' (3NPS non disponibile per questa scala)' : ''));
    const scLayers = S.scLayers.map((l, i) => ({
      color: SL_COL[i], tonic: String(l.tonic), scale: l.scale, vis: l.vis ? 'true' : 'false',
      onTonic: (e) => this.setLayer('scLayers', i, { tonic: Number(e.target.value) }), onScale: (e) => this.setLayer('scLayers', i, { scale: e.target.value }),
      toggle: () => this.toggleLayer('scLayers', i), remove: () => this.setState({ scLayers: this.state.scLayers.filter((x, k) => k !== i) })
    }));

    /* chords tab */
    const progLabel = (en) => (en.mode === 'cus' ? chordFrom(en.root, en.qual).name : (m.chords[en.i].roman + ' ' + m.chords[en.i].name));
    const PP = [['ii–V–I', [1, 4, 0]], ['I–vi–ii–V', [0, 5, 1, 4]], ['I–IV–V–I', [0, 3, 4, 0]]];
    const progPresets = PP.map((x) => ({ label: x[0], pick: () => this.loadProg(x[1]) }));
    const progChips = S.prog.map((en, i) => ({ label: progLabel(en), on: i === S.progIdx ? '1' : '0', pick: () => this.pickProg(i) }));
    const chordOpts = [{ v: 'none', l: '— Nessun accordo —' }].concat(m.chords.map((c, i) => ({ v: 'd' + i, l: c.name + '  ·  ' + c.roman })));
    if (S.chordMode === 'cus') chordOpts.push({ v: 'cus', l: chordFrom(S.cusRoot, S.cusQual).name + '  ·  personalizzato' });
    const chordVal = S.chordMode === 'none' ? 'none' : (S.chordMode === 'cus' ? 'cus' : 'd' + S.chord);
    const invNames = ['Fond.', '1ª', '2ª', '3ª'];
    const invOpts = invNames.map((n, i) => ({ label: n, on: ch && S.inv === i ? '1' : '0', checked: ch && S.inv === i ? 'true' : 'false', dis: !ch || i >= ch.pcs.length, pick: () => this.setState({ inv: i }) }));
    const va = S.voicing === 'mid' ? 5 : (S.voicing === 'high' ? 9 : 0);
    const cd = (() => {
      const start = va === 0 ? 1 : va, top = 28, h = 80, rh = h / 5;
      const strs = []; for (let i = 0; i < 6; i++) strs.push({ left: (14 + i * 13.2).toFixed(1) });
      const lines = []; for (let k = 0; k <= 5; k++) lines.push({ top: (top + k * rh).toFixed(1) });
      const dots = [], marks = [];
      if (ch) {
        const order = [ch.pcs[ch.inv]].concat(ch.pcs.filter((x, i) => i !== ch.inv));
        const f6 = voicingFrets(order, va, m.tun);
        f6.forEach((f, s) => {
          const x = 14 + s * 13.2;
          if (f < 0) marks.push({ ch: 'x', style: 'left:' + (x - 6).toFixed(1) + 'px;top:11px' });
          else if (f === 0) marks.push({ ch: 'o', style: 'left:' + (x - 6).toFixed(1) + 'px;top:11px' });
          else { const y = top + (f - start + 0.5) * rh; const isRoot = (m.tun.midi[s] + f) % 12 === m.chordRoot; dots.push({ style: 'left:' + (x - 5.5).toFixed(1) + 'px;top:' + (y - 5.5).toFixed(1) + 'px;width:11px;height:11px;border-radius:' + (isRoot ? '50%' : '3px') + ';background:' + (isRoot ? 'var(--marker-tonic,#f08a24)' : 'var(--marker-chord,#3cc27a)') }); }
        });
      }
      return { nut: va === 0, top, h, strings: strs, lines, dots, marks, hasLab: va > 0, lab: String(start), labTop: top + 2 };
    })();
    const chNoteChips = ch ? ch.names.map((n, i) => ({ v: n, t: i === 0 ? '1' : '0' })) : [];
    const chIvChips = ch ? ch.degs.map((d, i) => ({ v: d, t: i === 0 ? '1' : '0' })) : [];
    const chLayers = S.chLayers.map((l, i) => ({
      color: CL_COL[i], root: String(l.root), qual: l.qual, vis: l.vis ? 'true' : 'false',
      onRoot: (e) => this.setLayer('chLayers', i, { root: Number(e.target.value) }), onQual: (e) => this.setLayer('chLayers', i, { qual: e.target.value }),
      toggle: () => this.toggleLayer('chLayers', i), remove: () => this.setState({ chLayers: this.state.chLayers.filter((x, k) => k !== i) })
    }));

    /* exercise */
    const exReps = S.exReps === 'inf' ? '∞' : S.exReps;
    const curI = running && m.seq.length ? S.step % m.seq.length : -1;
    const stepLabel = m.seq.length ? ((curI >= 0 ? curI + 1 : '–') + ' / ' + m.seq.length) : '– / –';
    const nextPosLabel = m.pf.kind === 'all' ? '—' : (m.pf.kind === 'caged' ? 'CAGED ' + CAGED_ORDER[(CAGED_ORDER.indexOf(S.pos) + 1) % 5].toUpperCase() : '3NPS ' + ((Number(m.posEff.slice(1)) % 7) + 1));
    const exWhat = (S.exType === 'scale' ? 'Scala' : 'Arpeggio') + ' ' + ({ asc: '↑', desc: '↓', updown: '↕' }[S.exDir]) + ' 1/' + S.exTempo;
    const routineRows = [
      { n: '1', b: exWhat, p: m.pf.label, t: String(bpm), r: exReps },
      { n: '2', b: exWhat + ' (stessa routine)', p: nextPosLabel, t: String(Math.min(240, bpm + 4)), r: exReps },
      { n: '3', b: 'Riposo / ripasso (esempio)', p: '—', t: '—', r: '1' }
    ];

    /* legend (adaptive: only what is visible now, from the same marker list) */
    const LG = [];
    const lg = (role, text, x) => LG.push(Object.assign({ role, label: '', text, cr: false, gd: false, av: false, ot: false, tg: false, pl: false, dt: false, sl: '', cl: '', cring: false, seq: false }, x || {}));
    const ct = m.cats;
    lg('tonic', 'Tonica della scala: cerchio arancione');
    if (VZc.scale) lg('scale', 'Nota della scala principale: cerchio blu');
    if (ch && VZc.chord) {
      lg('chord', 'Nota dell\'accordo ' + ch.full + ': quadrato verde');
      lg('tonic', 'Fondamentale dell\'accordo: doppio anello esterno', { cr: true });
      if (ct.guide) lg('chord', 'Guide tone (3ª e 7ª): riquadro interno', { gd: true });
      if (ct.tension) lg('tension', 'Tensione disponibile 9 · 11 · 13: rombo viola');
      if (ct.avoid) lg('scale', 'Da evitare su ' + ch.full + ' (nota di scala a semitono da una nota d\'accordo): barra rossa', { av: true });
      if (ct.out) lg('chord', 'Nota d\'accordo fuori dalla scala principale: bordo tratteggiato', { ot: true });
    } else lg('external', ch ? 'Note d\'accordo nascoste dalle preferenze di visualizzazione' : 'Nessun accordo attivo: non vengono mostrati ruoli d\'accordo');
    if (ct.external) lg('external', 'Nota fuori scala (neutra): non è automaticamente «sbagliata»');
    m.slv.forEach((l) => lg('external', 'Livello scala ' + (l.i + 2) + ': ' + ROOTS[S.scLayers[l.i].tonic].n + ' ' + SCALES[S.scLayers[l.i].scale].label.replace(/ \(.*\)/, '') + ' ' + (VZc.lstyle === 'bars' ? '(barretta sotto la nota)' : '(puntino in alto a destra)'), { sl: l.color }));
    m.clv.forEach((l) => lg('external', 'Livello accordo ' + (l.i + 2) + ': ' + chordFrom(S.chLayers[l.i].root, S.chLayers[l.i].qual).name + ' ' + (VZc.lstyle === 'bars' ? '(barretta sopra la nota)' : '(quadratino in basso a destra)'), { cl: l.color }));
    if (running && m.seq.length) { lg('scale', 'Nota in esecuzione: anello arancione', { pl: true }); if (m.nxt) lg('scale', 'Prossimo bersaglio dell\'esercizio: anello tratteggiato', { tg: true }); }
    if (ct.split) lg('scale', 'Nota di scala che è anche nota d\'accordo: bordo quadrato verde', { cring: true });
    if (ct.seq) lg('scale', 'Nota della sequenza dell\'esercizio: anello sottile chiaro', { seq: true });
    if (S.demo && VZc.det) lg('external', 'Altezza rilevata dall\'ingresso: anello azzurro su tutte le posizioni di quella nota (non indica corda né tasto). Segnale di test DEMO', { dt: true });
    const legendMode = m.an ? 'Analisi: livelli secondari attivi secondo il menu Visualizzazione.' : 'Performance: solo tonica, scala, accordo attuale, bersaglio e nota rilevata.';
    const legendRules = [
      ['1', 'Anelli temporanei: in esecuzione (arancione) e rilevata (azzurro) stanno sopra a tutto.'],
      ['2', 'Bersaglio dell\'esercizio: anello tratteggiato.'],
      ['3', 'Ruolo di base, in ordine: tonica, nota d\'accordo, tensione, scala, fuori scala.'],
      ['4', 'Modificatori indipendenti dal ruolo: fondamentale d\'accordo, guide tone, da evitare, fuori scala.'],
      ['5', 'Livelli aggiuntivi: barrette (o puntini) sopra e sotto, mai al posto del ruolo di base; al massimo ' + MAXVIS + ' visibili per tipo.']
    ].map((x) => ({ n: x[0], t: x[1] }));

    /* next fretboard (secondary board: same marker grammar, own geometry) */
    const nv = this.nextView(m);
    const nn = nv.hi - nv.lo + 1;
    const nxrp = clamp(Math.round((S.nbH - 232) / 6), 17, 34);
    const nextFrets = []; for (let k = 1; k <= nn; k++) nextFrets.push({ left: 'calc(' + (k / nn * 100).toFixed(3) + '% - 1.5px)', cls: (nv.lo === 0 && k === 1) ? 'nut' : '' });
    const nextNums = []; for (let k = 0; k < nn; k++) nextNums.push({ n: String(nv.lo + k), left: ((k + 0.5) / nn * 100).toFixed(3) + '%' });
    const nextStrings = []; for (let r = 0; r < 6; r++) nextStrings.push({ style: 'top:calc(var(--nrp)*' + (r + 0.5) + ' + 4px - ' + ((6 - r) * 0.26).toFixed(2) + 'px);height:' + (0.9 + r * 0.5).toFixed(1) + 'px', name: m.tun.names[5 - r], nameTop: 'calc(var(--nrp)*' + (r + 0.5) + ' + 4px - 8px)' });
    const nxPos = (d) => 'left:calc(' + ((d.f - nv.lo + 0.5) / nn * 100).toFixed(3) + '% - var(--nmk)/2);top:calc(var(--nrp)*' + (5 - d.s + 0.5) + ' + 4px - var(--nmk)/2)';
    const nextDots = nv.dots.map((d) => ({ wrap: nxPos(d), role: d.role, label: d.label || '', gd: !!d.gd, cr: !!d.cr, tg: !!d.tg }));
    const nextGhosts = nv.ghosts.map((d) => ({ wrap: nxPos(d) }));

    /* LCD */
    const posName = m.pf.label + (m.pf.kind === 'all' ? '' : ' · tasti ' + m.pf.lo + '–' + m.pf.hi);
    const noteName = (midi) => this.noteLabel(midi, flat) + (Math.floor(midi / 12) - 1);
    let detTxt = '—', detKey = 'DET';
    if (m.det) detTxt = noteName(m.det.midi) + ' ' + (m.det.cents >= 0 ? '+' : '−') + Math.abs(m.det.cents) + 'c';
    if (S.tuner) { detKey = 'TUNER'; if (!m.det) detTxt = 'no segnale'; }
    const lcdChord = ch ? ch.full : '—';
    const progNote = S.progIdx >= 0 && S.prog.length >= 2 ? (m.next ? m.next.name : '—') : '—';
    const lcd = {
      lcdTonic: m.root.n, lcdScale: m.sc.label.replace(/ \(.*\)/, ''), lcdNotes: m.scaleNames.join(' '),
      lcdChord, lcdChordLen: lcdChord.length > 6 ? 'long' : 's', lcdChordNone: ch ? '0' : '1',
      lcdFunc: !ch ? 'Nessun accordo selezionato' : (ch.custom ? 'Accordo personalizzato' : ch.roman + ' · ' + FUNC[ch.di]),
      lcdMetric: S.metric + ' · Swing ' + S.swing + '%', lcdMetricShort: S.metric + (S.swing ? ' · Swing ' + S.swing + '%' : ''),
      lcdPos: posName, lcdMode: (S.dens === 'anal' ? 'Analisi' : 'Perf') + ' · ' + modeLabel, lcdTuning: m.tun.names.join(' '),
      lcdState: S.playing ? 'PLAY' : (S.paused ? 'PAUSA' : (S.done ? 'FINE' : 'STOP')),
      lcdNext: progNote, lcdTarget: m.nxt ? noteName(m.nxt.midi) : (m.seq.length ? 'pronto' : (S.exType === 'arp' && !ch ? 'serve accordo' : '—')),
      lcdDet: detTxt, lcdDetKey: detKey,
      lcdAudio: (S.demo ? 'test DEMO' : 'nessun ingresso') + (S.live ? ' · mon ON' : '')
    };
    const CLK = { off: 'spento', beat: 'ogni battito', accent: 'solo accento' };
    const lcdItems = [];
    const li = (k, v) => lcdItems.push({ k, v });
    li('POS', posName);
    if (S.progIdx >= 0 && S.prog.length >= 2 && m.next) li('NEXT', m.next.name);
    if (running && m.nxt) li('TARGET', noteName(m.nxt.midi));
    else if (S.ws !== 'fretboard' && S.exType === 'arp' && !ch) li('TARGET', 'serve un accordo');
    if (S.demo || S.tuner) li(detKey, detTxt);
    if (S.demo || S.live) li('AUDIO', lcd.lcdAudio);
    if (S.tuning !== 'std') li('ACC', m.tun.names.join(' '));
    li('CLICK', (CLK[S.clickMode] || S.clickMode));
    const ledStyle = S.playing ? 'background:var(--led-green,#7dff6a);box-shadow:0 0 6px var(--led-green,#7dff6a)' : (S.paused ? 'background:var(--led-amber,#ffb23f);box-shadow:0 0 6px var(--led-amber,#ffb23f)' : 'background:var(--led-red,#ff3b2f);opacity:.55');

    /* tabs */
    const tabs = TAB_NAMES.map((n, i) => ({ id: 'gtl-tab-' + i, label: n, sel: S.tab === i ? 'true' : 'false', tab: S.tab === i ? '0' : '-1', color: TAB_COL[i], pick: () => this.goTab(i) }));
    const tabKey = (e) => {
      const i = Number(String(e.currentTarget.id).split('-').pop()); let n = i;
      if (e.key === 'ArrowRight') n = (i + 1) % 5; else if (e.key === 'ArrowLeft') n = (i + 4) % 5; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 4; else return;
      e.preventDefault(); this.goTab(n); setTimeout(() => this.focusSel('#gtl-tab-' + n), 20);
    };

    /* mixer */
    const ACC = { Click: '#4a9fe8', Notes: '#4fb2ff', Chords: '#3cc27a', Bass: '#f2b01d', Drums: '#a77bf0', Guitar: '#e0773a', Master: '#f26b1d' };
    const chn = (name, vk, mk, wired, lv, aria) => ({ name, accent: ACC[name], sep: name === 'Master', v: S[vk], m: S[mk], wired, lv, aria, set: (v) => this.setState({ [vk]: v }), mute: () => this.setState({ [mk]: !this.state[mk] }) });
    const lvMaster = Math.max(lvClick, lvNotes) * gf(S.vMaster);
    const MCX = [85, 183, 281, 379, 477, 575, 692];
    const mxDb = (v) => (v <= 1.5 ? '−∞ dB' : (() => { const d = -30 + v * 0.36; return (d > 0.05 ? '+' : (d < -0.05 ? '−' : '')) + Math.abs(d).toFixed(1) + ' dB'; })());
    const mxFromY = (e) => { const r = e.currentTarget.getBoundingClientRect(); const k = r.height / 168; const y = (e.clientY - r.top) / k + 96; return clamp(Math.round((248 - y) / 136 * 100), 0, 100); };
    const channels6 = () => channels.map((c, i) => {
      const v = clamp(Number(c.v) || 0, 0, 100); const master = c.name === 'Master';
      const lit = c.wired && !c.m && c.lv > 0.03;
      return Object.assign({}, c, {
        left: (MCX[i] - 49 + 24) + 'px', capTop: (248 - v * 1.36 - 36).toFixed(1) + 'px', isM: master ? '1' : '0', capSrc: master ? 'assets/fader-cap-master@2x.png' : 'assets/fader-cap@2x.png',
        read: mxDb(v), val: String(v), mOn: c.m ? 'true' : 'false', muteSrc: c.m ? 'assets/btn-mute-on@2x.png' : 'assets/btn-off@2x.png', mLit: c.m ? '1' : '0',
        led: lit ? '2' : (c.wired && !c.m ? '1' : '0'), ledTitle: c.wired ? (lit ? 'Segnale presente' : 'Canale collegato, nessun segnale ora') : 'Canale prototipo: nessun audio collegato',
        proto: c.wired ? '' : 'proto', tagShow: !c.wired,
        down: (e) => { this._mxd = i; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} c.set(mxFromY(e)); },
        move: (e) => { if (this._mxd === i) c.set(mxFromY(e)); },
        up: (e) => { this._mxd = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (x) {} },
        key: (e) => { const st = e.shiftKey ? 10 : 2; let n = v; if (e.key === 'ArrowUp' || e.key === 'ArrowRight') n += st; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') n -= st; else if (e.key === 'PageUp') n += 10; else if (e.key === 'PageDown') n -= 10; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 100; else return; e.preventDefault(); c.set(clamp(n, 0, 100)); }
      });
    });
    const channels = [
      chn('Click', 'vClick', 'mClick', true, lvClick, 'Livello Click'), chn('Notes', 'vGuitar', 'mGuitar', true, lvNotes, 'Livello Notes'),
      chn('Chords', 'vChords', 'mChords', false, 0, 'Livello Chords (non collegato)'), chn('Bass', 'vBass', 'mBass', false, 0, 'Livello Bass (non collegato)'),
      chn('Drums', 'vDrums', 'mDrums', false, 0, 'Livello Drums (non collegato)'), chn('Guitar', 'vInput', 'mInput', false, 0, 'Livello Guitar ingresso (non collegato)'),
      chn('Master', 'vMaster', 'mMaster', true, lvMaster, 'Livello Master')
    ];

    const mixer6 = channels6();
    const fitS = (w, h, note) => clamp(Math.min((S.nbH - 16 - (note && S.nbH >= 350 ? 36 : 0)) / h, ((S.nbW || 1200) - 20) / w), 0.45, 1);
    const ampS = fitS(868, 344, true), tunS = fitS(428, 404, true), ifS = fitS(668, 254, true);
    const devSz = { ampScale: ampS.toFixed(3), ampW: Math.round(868 * ampS) + 'px', ampH: Math.round(344 * ampS) + 'px', tunScale: tunS.toFixed(3), tunW: Math.round(428 * tunS) + 'px', tunH: Math.round(404 * tunS) + 'px', ifScale: ifS.toFixed(3), ifW: Math.round(668 * ifS) + 'px', ifH: Math.round(254 * ifS) + 'px' };
    const mxScaleV = clamp(Math.min((S.nbH - 14) / 432, ((S.nbW || 1200) - 20) / 828), 0.5, 1);
    /* amp */
    const A = S.amp;
    const ak = (key, name, def) => ({ name, v: A[key], def, read: String(Math.round(A[key] / 10)), set: (v) => this.setState({ amp: Object.assign({}, this.state.amp, { [key]: v }) }) });
    const ampKnobs = [ak('gain', 'Gain', 55), ak('bass', 'Bass', 50), ak('mid', 'Middle', 60), ak('treble', 'Treble', 58), ak('presence', 'Presence', 45), ak('out', 'Output', 62)];

    /* tuner */
    const tOn = S.tuner, hasSig = tOn && !!m.det;
    let tnNote = '—', tnOct = '', tnCents = tOn ? 'NESSUN SEGNALE' : 'ACCORDATORE SPENTO';
    const cells = []; const cN = 21;
    const cIdx = hasSig ? clamp(Math.round(m.det.cents / 5) + 10, 0, 20) : -1;
    if (hasSig) {
      tnNote = this.noteLabel(m.det.midi, flat); tnOct = String(Math.floor(m.det.midi / 12) - 1);
      const c = m.det.cents; tnCents = Math.abs(c) <= 3 ? 'IN ACCORDO' : ((c > 0 ? '+' : '−') + Math.abs(c) + ' cent ' + (c > 0 ? '(cala)' : '(sali)'));
    }
    for (let i = 0; i < cN; i++) {
      const on = i === cIdx; const col = i === 10 ? 'var(--led-green,#7dff6a)' : (Math.abs(i - 10) >= 7 ? 'var(--led-red,#ff3b2f)' : 'var(--led-amber,#ffb23f)');
      cells.push({ style: 'background:' + (on ? col : (i === 10 ? 'rgba(125,255,106,.25)' : 'rgba(79,178,255,.16)')) + ';box-shadow:' + (on ? '0 0 8px ' + col : 'none') + (i === 10 ? ';height:100%' : ';height:' + (on ? '100%' : '62%') + ';align-self:end') });
    }
    const tnRefs = SHARPN.map((n, pc) => ({ label: n, on: S.tunerRef === pc ? '1' : '0', aria: 'Tono di riferimento ' + n, pick: () => { this.setState({ tunerRef: pc }); this.refTone(pc); } }));

    /* rendered rotary knobs: shared handler (asset body static, pointer layer rotates) */
    const rk = (v, set, label, def, read) => {
      const val = clamp(Math.round(Number(v) || 0), 0, 100);
      return {
        angle: (-135 + val * 2.7).toFixed(1), val: String(val), aria: label, read: read || String(val),
        down: (e) => { this._rk = { y: e.clientY, v: val, set }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} },
        move: (e) => { const d = this._rk; if (d && d.set === set) set(clamp(Math.round(d.v + (d.y - e.clientY) * 0.6), 0, 100)); },
        up: (e) => { this._rk = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (x) {} },
        key: (e) => { const st = e.shiftKey ? 10 : 2; let n = val; if (e.key === 'ArrowUp' || e.key === 'ArrowRight') n += st; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') n -= st; else if (e.key === 'PageUp') n += 10; else if (e.key === 'PageDown') n -= 10; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 100; else return; e.preventDefault(); set(clamp(n, 0, 100)); },
        reset: () => set(def)
      };
    };
    const AX = [246, 326, 406, 486, 566, 646];
    const amp6 = ampKnobs.map((k, i) => Object.assign(rk(k.v, k.set, k.name + ' (stato di design, nessun DSP)', k.def, k.read), { name: k.name, left: (AX[i] - 36 + 24) + 'px', cx: (AX[i] + 24) + 'px' }));
    const calibK = rk((S.calib - 435) * 10, (v) => this.setState({ calib: 435 + Math.round(v / 10) }), 'Calibrazione del La (435–445 Hz)', 50, S.calib + ' Hz');
    const arc = []; for (let i = 0; i < 21; i++) { const a = (-60 + i * 6) * Math.PI / 180; arc.push({ left: (190 + 24 + 118 * Math.sin(a) - 5).toFixed(1) + 'px', top: (184 + 20 - 118 * Math.cos(a) - 7).toFixed(1) + 'px', rot: (-60 + i * 6) + 'deg', style: cells[i].style.replace(/;height:[^;]*/, '').replace(/;align-self:end/, '') }); }
    const cDev = hasSig ? m.det.cents : null;
    const tnLed = { tune: cDev !== null && Math.abs(cDev) <= 3 ? '1' : '0', sharp: cDev !== null && cDev > 3 ? '1' : '0', flat: cDev !== null && cDev < -3 ? '1' : '0' };
    /* interface */
    const lvIn = S.demo ? clamp((0.35 + 0.45 * pseudo(S.dt * 1.3)) * (0.3 + 0.7 * S.inGain / 100), 0, 1) : 0;
    const ioMeter = []; for (let i = 0; i < 14; i++) { const on = i < Math.round(lvIn * 14); const col = i >= 12 ? 'var(--led-red,#ff3b2f)' : (i >= 9 ? 'var(--led-amber,#ffb23f)' : 'var(--led-green,#7dff6a)'); ioMeter.push({ style: 'height:' + (14 + i * 2.6).toFixed(0) + 'px;background:' + col + ';opacity:' + (on ? 1 : 0.16) + ';box-shadow:' + (on ? '0 0 4px ' + col : 'none') }); }
    const gainK = rk(S.inGain, (v) => this.setState({ inGain: v }), 'Input gain', 62, '+' + Math.round(S.inGain * 0.2) + ' dB');
    const halo = !S.demo ? '0' : (lvIn > 0.82 ? '3' : '2');
    const ioChans = [1, 2].map((n) => ({ n: String(n), jack: 'Presa combo ' + n + ' (grafica)', clip: lvIn > 0.82 ? '1' : '0', label: 'Ingresso ' + n, on: S.ioCh === n ? '1' : '0', checked: S.ioCh === n ? 'true' : 'false', pick: () => this.setState({ ioCh: n }) }));
    const path = ['Ingresso ' + S.ioCh, 'Gain'].concat(S.live ? ['Monitor'] : []).concat(S.nam && !S.ampBypass ? ['Amp (design)'] : []).concat(['Master']).join(' → ');

    /* settings */
    const uiModes = [['studio', 'Studio', 'Interfaccia Studio (questo prototipo)'], ['simple', 'Semplificata ↗', 'Segnaposto di navigazione verso l\'interfaccia Semplificata esistente']].map((u) => ({ label: u[1], title: u[2], on: S.ui === u[0] ? '1' : '0', checked: S.ui === u[0] ? 'true' : 'false', pick: () => this.setState({ ui: u[0], setOpen: false }) }));

    const tab = S.tab;
    return {
      fbh, railAttr: S.railX ? '1' : '0', railAria: S.railX ? 'true' : 'false', railToggleLabel: S.railX ? 'Comprimi la barra di navigazione' : 'Espandi la barra con le etichette',
      toggleRail: () => { const v = !this.state.railX; this.setState({ railX: v }); this.save('railX', v ? '1' : '0'); },
      railLabs, railDevs, setAttr: S.setOpen ? '1' : '0', setAria: S.setOpen ? 'true' : 'false', setOpen: S.setOpen,
      toggleSet: () => this.setState({ setOpen: !this.state.setOpen, vizOpen: false }), closeSet: () => this.setState({ setOpen: false }),
      uiModes, simple: S.ui === 'simple', backToStudio: () => this.setState({ ui: 'studio' }),
      ...lcd, lamps, lcdItems, lcdX: S.lcdX, lcdXAttr: S.lcdX ? '1' : '0', lcdXIcon: S.lcdX ? 'collapse' : 'expand', lcdXLabel: S.lcdX ? 'Display compatto' : 'Display esteso', toggleLcdX: () => { const v = !this.state.lcdX; this.setState({ lcdX: v }); this.save('lcdX', v ? '1' : '0'); }, ledStyle, bpmText: String(bpm),
      playing: S.playing, paused: S.paused, loopOn: S.loop,
      playPress: () => this.play(), pausePress: () => this.pause(), stopPress: () => this.stop(), loopPress: () => this.setState({ loop: !this.state.loop }),
      bpmUp: () => this.setBpm(this.bpmNow() + 1), bpmDown: () => this.setBpm(this.bpmNow() - 1), tapPress: () => this.tap(),
      metricVal: S.metric, metricOpts: opts([['4/4', '4/4'], ['3/4', '3/4'], ['6/8', '6/8'], ['5/4', '5/4']]), onMetric: (e) => this.setState({ metric: e.target.value }),
      clickVal: S.clickMode, clickOpts: opts([['beat', 'Battito'], ['accent', 'Accento'], ['off', 'Off']]), onClickMode: (e) => this.setState({ clickMode: e.target.value }),
      /* fretboard */
      vizOpen: S.vizOpen, vizAria: S.vizOpen ? 'true' : 'false', toggleViz: () => this.setState({ vizOpen: !this.state.vizOpen, setOpen: false }), closeViz: () => this.setState({ vizOpen: false }),
      vizSummary, modes, toggles, densOpts, vzShow, vzOverlap, vzLayers, vzAnim, boardAnim: VZc.anim, mkStyle: VZc.lstyle, densNote: S.dens === 'anal' ? 'Analisi: tutti i livelli del menu qui sotto, più livelli scala e accordo.' : 'Performance: solo tonica, scala, accordo attuale, bersaglio e nota rilevata. I livelli secondari restano memorizzati.', perfNote: S.dens === 'anal' ? '' : 'In Performance i livelli aggiuntivi sono nascosti: passa ad Analisi dal menu Visualizzazione per vederli.',
      tuningVal: S.tuning, tuningOpts: Object.keys(TUNINGS).map((k) => ({ v: k, l: TUNINGS[k].label })), onTuning: (e) => this.setState({ tuning: e.target.value }),
      presetVal: S.preset, presetOpts: Object.keys(PRESETS).map((k) => ({ v: k, l: PRESETS[k].label })),
      onPreset: (e) => {
        const p = PRESETS[e.target.value]; this.stop();
        this.setState({ preset: e.target.value, tonic: p.tonic, scale: p.scale, chordMode: 'dia', chord: p.chord, inv: 0, pos: p.pos, bpm: p.bpm, exType: p.exType, exDir: p.exDir, exTempo: p.exTempo, prog: p.prog.map((i) => ({ mode: 'dia', i })), progIdx: 0 });
      },
      strings, gutter, frets, inlays, numbers, markers: m.markers,
      /* divider */
      splitMin: fr[0], splitMax: fr[1], splitNow: fbh, splitText: 'Tastiera ' + fbh + ' px, taccuino ' + Math.round(av - fbh) + ' px',
      splitDown: (e) => {
        const root = e.currentTarget.closest('.gtl'); this._drag = { y: e.clientY, fb: this.fbNow(), root };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} if (root) root.setAttribute('data-drag', '1'); e.preventDefault();
      },
      splitMove: (e) => {
        const d = this._drag; if (!d) return; const a = this.state.avail || av; const r = this.fbRange(a);
        const v = clamp(Math.round(d.fb + (e.clientY - d.y)), r[0], r[1]); this._live = v; d.root.style.setProperty('--fbh', v + 'px');
      },
      splitUp: (e) => {
        const d = this._drag; if (!d) return; this._drag = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (x) {}
        if (d.root) d.root.setAttribute('data-drag', '0');
        const a = this.state.avail || av; const v = this._live != null ? this._live : this.fbNow(); this._live = null;
        this.setState({ fbR: v / a }); this.save('fbR', (v / a).toFixed(5));
      },
      splitKey: (e) => {
        const a = this.state.avail || av; const r = this.fbRange(a); const cur = this.fbNow(); const st = e.shiftKey ? 64 : 16; let v;
        if (e.key === 'ArrowUp') v = cur - st; else if (e.key === 'ArrowDown') v = cur + st; else if (e.key === 'Home') v = r[0]; else if (e.key === 'End') v = r[1]; else return;
        e.preventDefault(); v = clamp(v, r[0], r[1]); this.setState({ fbR: v / a }); this.save('fbR', (v / a).toFixed(5));
      },
      splitReset: () => { this.setState({ fbR: null }); try { window.localStorage.removeItem('gtl.v5.fbR'); } catch (x) {} },
      /* notebook */
      tabs, tabKey, tabLabelId: 'gtl-tab-' + tab, tabColor: TAB_COL[tab], tabScale: tab === 0, tabChords: tab === 1, tabEx: tab === 2, tabLegend: tab === 3, tabNext: tab === 4,
      tonicVal: String(S.tonic), tonicOpts: ROOTS.map((r, i) => ({ v: String(i), l: r.n })), onTonic: (e) => this.setState({ tonic: Number(e.target.value) }),
      scaleVal: S.scale, scaleOpts: Object.keys(SCALES).map((k) => ({ v: k, l: SCALES[k].label })), onScale: (e) => this.setState({ scale: e.target.value }),
      noteChips, ivChips, posSys, posShapes, posNote, sd, scLayers, primaryLayerText: m.root.n + ' ' + m.sc.label.replace(/ \(.*\)/, ''),
      scAddDis: S.scLayers.length >= 4, addScaleLayer: () => { const L = this.state.scLayers; const vis = L.filter((l) => l.vis).length < MAXVIS; if (!vis) this.flash('Livello aggiunto nascosto: al massimo ' + MAXVIS + ' livelli visibili insieme'); this.setState({ scLayers: L.concat([{ tonic: (this.state.tonic + 7 + L.length * 2) % 12, scale: 'pentmin', vis }]), tab: 0 }); },
      chordVal, chordOpts, onChord: (e) => {
        const v = e.target.value;
        if (v === 'none') this.setState({ chordMode: 'none', progIdx: -1, inv: 0 });
        else if (v.charAt(0) === 'd') { const i = Number(v.slice(1)); this.setState({ chordMode: 'dia', chord: i, inv: 0, progIdx: this.state.prog.findIndex((p) => p.mode === 'dia' && p.i === i) }); }
      },
      invOpts, voicingVal: S.voicing, voicingOpts: opts([['std', 'Standard (0–4)'], ['mid', 'Media (5–9)'], ['high', 'Alta (9–13)']]), onVoicing: (e) => this.setState({ voicing: e.target.value }),
      cd, chNoteChips, chIvChips, chordNote: ch ? ('Voicing dimostrativo generato dalle note di ' + ch.full + '.') : 'Nessun accordo attivo: il diagramma è vuoto e la tastiera mostra solo la scala.',
      cusRootVal: String(S.cusRoot), onCusRoot: (e) => this.setState({ cusRoot: Number(e.target.value) }),
      cusQualVal: S.cusQual, qualOpts: Object.keys(CQ).map((k) => ({ v: k, l: CQ[k].l })), onCusQual: (e) => this.setState({ cusQual: e.target.value }),
      applyBuilder: () => this.setState({ chordMode: 'cus', inv: 0, progIdx: -1 }), clearChord: () => this.setState({ chordMode: 'none', inv: 0, progIdx: -1 }),
      progPresets, nxLoad: () => this.loadProg([1, 4, 0]), nxCanLoad: S.ws !== 'fretboard',
      progChips, progEmpty: S.prog.length ? '' : 'Progressione vuota.',
      progAdd: () => {
        const en = S.chordMode === 'dia' ? { mode: 'dia', i: S.chord } : (S.chordMode === 'cus' ? { mode: 'cus', root: S.cusRoot, qual: S.cusQual } : null);
        if (!en) { this.flash('Seleziona prima un accordo da aggiungere'); return; }
        if (this.state.prog.length >= 8) { this.flash('Progressione piena (8 accordi)'); return; }
        const np = this.state.prog.concat([en]); this.setState({ prog: np, progIdx: np.length - 1 });
      },
      progRemove: () => { const i = this.state.progIdx; if (i < 0) return; const np = this.state.prog.filter((x, k) => k !== i); this.setState({ prog: np, progIdx: np.length ? Math.min(i, np.length - 1) : -1 }); },
      activeChordText: ch ? ch.full : 'nessun accordo', chLayers, chAddDis: S.chLayers.length >= 7,
      addChordLayer: () => { const L = this.state.chLayers; const vis = L.filter((l) => l.vis).length < MAXVIS; if (!vis) this.flash('Livello aggiunto nascosto: al massimo ' + MAXVIS + ' livelli visibili insieme'); this.setState({ chLayers: L.concat([{ root: (this.state.tonic + 7 + L.length * 5) % 12, qual: '7', vis }]), tab: 1 }); },
      exTypeVal: S.exType, exTypeOpts: opts([['arp', 'Arpeggio (1 bar)'], ['scale', 'Scala (1 ottava)']]), onExType: (e) => this.setState({ exType: e.target.value }),
      exDirVal: S.exDir, exDirOpts: opts([['asc', 'Ascendente'], ['desc', 'Discendente'], ['updown', 'Su e giù']]), onExDir: (e) => this.setState({ exDir: e.target.value }),
      exTempoVal: S.exTempo, exTempoOpts: opts([['4', '1/4'], ['8', '1/8'], ['16', '1/16']]), onExTempo: (e) => this.setState({ exTempo: e.target.value }),
      exRepsVal: S.exReps, exRepsOpts: opts([['inf', '∞'], ['1', '1'], ['2', '2'], ['4', '4']]), onExReps: (e) => this.setState({ exReps: e.target.value }),
      stepLabel, saveEx: () => this.flash('Esercizio salvato nel quaderno (demo)'),
      swing: S.swing, swingRead: S.swing + '%', setSwing: (v) => this.setState({ swing: Math.min(60, v) }),
      routineOpen: S.routineOpen, routineAria: S.routineOpen ? 'true' : 'false', toggleRoutine: () => this.setState({ routineOpen: !this.state.routineOpen }), routineRows,
      legend: LG, legendMode, legendRules,
      nextLab: nv.lab, nxNow: nv.now, nxNowSub: nv.nowSub, nxNext: nv.nxt, nxNextSub: nv.nxtSub, nxMsg: nv.msg, nxHint: nv.hint, nxHasMsg: !!nv.msg, nxHasHint: !!nv.hint, nextAria: nv.aria, nextFrets, nextNums, nextStrings, nextDots, nextGhosts, nxStyle: '--nrp:' + nxrp + 'px;--nmk:' + (nxrp * 1.08).toFixed(1) + 'px;height:calc(var(--nrp)*6 + 8px)',
      /* overlays */
      closeOv: () => this.closeOv(),
      ovMixer: S.overlay === 'mixer', ovAmp: S.overlay === 'amp', ovTuner: S.overlay === 'tuner', ovIface: S.overlay === 'iface',
      channels, mixer6, mxScale: mxScaleV.toFixed(3), mxW: Math.round(828 * mxScaleV) + 'px', mxH: Math.round(432 * mxScaleV) + 'px', mxTravel: S.nbH < 350 ? 44 : (S.nbH < 440 ? 66 : 110), mxCompact: S.nbH < 350, ovAny: !!S.overlay, ovOut: S.ovOut ? '1' : '0', ovC: S.nbH < 350 ? '2' : (S.nbH < 440 ? '1' : '0'),
      ...devSz, bypassOn: S.ampBypass ? '1' : '0', amp6, calibK, arc, tnLed, gainK, halo, hzText: S.calib + ' Hz', bypassSrc: S.ampBypass ? 'assets/toggle-down@2x.png' : 'assets/toggle-up@2x.png', powerSrc: S.nam ? 'assets/rocker-on@2x.png' : 'assets/rocker-off@2x.png', tunerLit: tOn ? '1' : '0', demoLit: S.demo ? '1' : '0', liveLit: S.live ? '1' : '0',
      ampKnobs, ampBypass: S.ampBypass, namOn: S.nam, toggleBypass: () => this.setState({ ampBypass: !this.state.ampBypass }), toggleAmp: () => { const v = !this.state.nam; this.setState({ nam: v }); },
      ampLamp: S.nam ? '1' : '0', ampLampAria: S.nam ? 'Spia accesa (stato di design)' : 'Spia spenta', ampStatus: (S.nam ? 'acceso' : 'spento') + (S.ampBypass ? ', bypass' : '') + ' · design demo',
      tunerBadge: tOn ? (S.demo ? 'Attivo · segnale DEMO' : 'Attivo · nessun segnale') : 'Spento', tunerAria: hasSig ? ('Nota rilevata ' + tnNote + tnOct + ', ' + tnCents) : tnCents,
      tnNote, tnOct, tnCents, tnCells: cells, tnRefs, tnSignal: hasSig ? '1' : '0', tnSignalAria: hasSig ? 'Segnale presente' : 'Nessun segnale', tnActive: tOn ? '1' : '0', tnActiveAria: tOn ? 'Accordatore attivo' : 'Accordatore spento', tunerOn: tOn,
      toggleTuner: () => this.setState({ tuner: !this.state.tuner }),
      tunerNote: 'I tasti cromatici emettono un tono di riferimento (se l\'audio del prototipo è attivo). La nota rilevata arriva solo dal segnale di test DEMO: nel prodotto, dall\'ingresso chitarra reale.',
      inGain: S.inGain, inGainRead: '+' + Math.round(S.inGain * 0.2) + ' dB', setInGain: (v) => this.setState({ inGain: v }),
      ioChans, ioMeter, ioMeterAria: S.demo ? 'Livello del segnale di test' : 'Nessun segnale in ingresso', ioIn: S.demo ? '1' : '0', liveOn: S.live, demoOn: S.demo,
      livePress: () => this.setState({ live: !this.state.live }), toggleDemo: () => this.setState({ demo: !this.state.demo }),
      ioStatus: 'Nessun dispositivo audio collegato (prototipo)', ioPath: path, ioDetected: m.det ? noteName(m.det.midi) + ' ' + (m.det.cents >= 0 ? '+' : '−') + Math.abs(m.det.cents) + ' cent (DEMO)' : '—',
      toast: !!S.toast, toastText: S.toast
    };
  }
  toggleLayer(key, i) { const L = this.state[key]; const on = !L[i].vis; if (on && L.filter((l) => l.vis).length >= MAXVIS) { this.flash('Al massimo ' + MAXVIS + ' livelli visibili insieme: nascondine uno prima'); return; } this.setLayer(key, i, { vis: on }); }
  setLayer(key, i, patch) { const arr = this.state[key].map((l, k) => (k === i ? Object.assign({}, l, patch) : l)); this.setState({ [key]: arr }); }
  loadProg(ix) { this.setState({ prog: ix.map((i) => ({ mode: 'dia', i })), progIdx: 0, chordMode: 'dia', chord: ix[0], inv: 0 }); }
  pickProg(i) {
    const en = this.state.prog[i]; if (!en) return;
    if (en.mode === 'cus') this.setState({ chordMode: 'cus', cusRoot: en.root, cusQual: en.qual, inv: 0, progIdx: i });
    else this.setState({ chordMode: 'dia', chord: en.i, inv: 0, progIdx: i });
  }
}
