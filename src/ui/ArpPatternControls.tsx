/**
 * Arpeggio vocabulary (AR2–AR4): permutations, enclosures, triad pairs,
 * upper structures and irregular groups over the shape chosen above. The
 * engine builds the line; this only picks it.
 */
import { ARP_PATTERNS, ARP_PATTERN_NAMES, OVERLAYS, OVERLAY_NAMES, overlayChord, tensionsOver, type Overlay, PERMUTATIONS, UPPER_STRUCTURES, parsePermutation, triadPair, upperStructure, upperStructureTensions, type ArpPattern, type UpperStructure } from '../exercises';
import { defaultScaleFor } from '../app/chordViews';
import { useApp } from '../app/store';
import { buildScale, tryParseChord } from '../theory';
import { Field, Select } from './controls';

const HINTS: Readonly<Record<ArpPattern, string>> = {
  none: 'L’arpeggio come lo dà la forma, con direzione e grado di partenza.',
  perm: 'Gradi dell’accordo in ogni ottava: 1 5 3 7 sale alla quinta, scende alla terza, sale alla settima. 8 è la fondamentale all’ottava.',
  enclosure: 'Ogni nota dell’accordo preceduta dal grado della scala sopra e dal semitono sotto, sulla stessa corda.',
  pair: 'Due triadi della scala dell’accordo su gradi vicini, senza note comuni, tre note ciascuna sempre salendo.',
  upper: 'Una triade maggiore costruita su un grado dell’accordo: le sue note sono le tensioni.',
  quartal: 'Quarte della scala dell’accordo dalla fondamentale (Do Fa Si Mi La Re su Cmaj7), finché la posizione le offre.',
  overlay: 'L’arpeggio di un altro accordo sopra questo: la quadriade sulla sua terza, quinta o settima, o il sostituto di tritono di una dominante.',
  group: 'Gruppi di N note che ripartono da ogni nota: contro il 4/4 i gruppi attraversano i movimenti, l’accento cade sulla prima di ogni gruppo.',
};

export function ArpPatternControls() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const chord = s.arpSource === 'chord' ? tryParseChord(s.arpSymbol) : null;
  const permValid = parsePermutation(s.arpPerm) !== null;
  const scale = chord ? buildScale(chord.rootName, defaultScaleFor(chord)) : null;
  const pair = scale ? triadPair(scale) : null;
  const over = chord && scale ? overlayChord(chord, scale, s.arpOverlay) : null;
  return (
    <div className="arp-vocab" data-testid="arp-vocab">
      <div className="row">
        <Field label="Linguaggio" hint={HINTS[s.arpPattern]}>
          <Select<ArpPattern> label="Pattern dell'arpeggio" testId="arp-vocab-pattern" value={s.arpPattern} options={ARP_PATTERNS.map((p) => ({ value: p, label: ARP_PATTERN_NAMES[p] }))} onChange={(arpPattern) => update({ arpPattern })} />
        </Field>
        {s.arpPattern === 'perm' ? (
          <>
            <Field label="Permutazione">
              <Select label="Permutazioni da manuale" testId="arp-perm-preset" value={PERMUTATIONS.includes(s.arpPerm) ? s.arpPerm : ''} options={[{ value: '', label: 'Personalizzata' }, ...PERMUTATIONS.map((p) => ({ value: p, label: p }))]} onChange={(arpPerm) => { if (arpPerm) update({ arpPerm }); }} />
            </Field>
            <Field label="Gradi" hint={permValid ? undefined : 'Scrivi gradi da 1 a 13 separati da spazi, per esempio 1 5 3 7.'}>
              <input className={`text-input ${permValid ? '' : 'is-invalid'}`} data-testid="arp-perm" defaultValue={s.arpPerm} key={s.arpPerm} aria-invalid={!permValid} onBlur={(e) => { if (parsePermutation(e.target.value)) update({ arpPerm: e.target.value }); }} />
            </Field>
          </>
        ) : null}
        {s.arpPattern === 'upper' ? (
          <Field label="Triade" hint={chord ? `${upperStructure(chord, s.arpUpper).symbol} su ${chord.symbol}: ${upperStructureTensions(chord, s.arpUpper).join(' ')}` : undefined}>
            <Select<UpperStructure> label="Upper structure" testId="arp-upper" value={s.arpUpper} options={UPPER_STRUCTURES.map((u) => ({ value: u, label: u }))} onChange={(arpUpper) => update({ arpUpper })} />
          </Field>
        ) : null}
        {s.arpPattern === 'overlay' ? (
          <Field label="Sopra" hint={chord ? (over ? `${over.symbol} su ${chord.symbol}: ${tensionsOver(chord, over).join(' ')}` : `Nessun sostituto di tritono: ${chord.symbol} non è una dominante.`) : undefined}>
            <Select<Overlay> label="Sovrapposizione" testId="arp-overlay" value={s.arpOverlay} options={OVERLAYS.map((o) => ({ value: o, label: OVERLAY_NAMES[o] }))} onChange={(arpOverlay) => update({ arpOverlay })} />
          </Field>
        ) : null}
        {s.arpPattern === 'group' ? (
          <Field label="Note per gruppo">
            <Select<number> label="Note per gruppo" testId="arp-group" value={s.arpGroup} options={[3, 4, 5, 7].map((n) => ({ value: n, label: String(n) }))} onChange={(n) => update({ arpGroup: n as 3 | 4 | 5 | 7 })} />
          </Field>
        ) : null}
      </div>
      {s.arpPattern === 'pair' && pair ? <p className="field-hint" data-testid="arp-pair">Triadi: {pair[0].symbol} e {pair[1].symbol}</p> : null}
    </div>
  );
}
