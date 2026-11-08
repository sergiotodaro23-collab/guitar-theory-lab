/**
 * Arpeggios Lab: the shape of the arpeggio on the neck (P1-12c, D-27). The
 * engine decides positions and fingers; this panel only chooses and reports,
 * and says plainly when a shape cannot be played from the chosen fret.
 */
import { arpeggioPlanOf, type ArpeggioSettings } from '../app/settings';
import { useApp } from '../app/store';
import { CAGED_FORMS, DEFAULT_FRETS } from '../fretboard';
import { ARP_SPAN, type ArpOctaves, type ArpReturn, type ArpShape, type SweepStrings } from '../exercises';
import { tryParseChord } from '../theory';
import { Field, Segmented } from './controls';

const SHAPE_OPTIONS: readonly { value: ArpShape; label: string }[] = [
  { value: 'window', label: 'Posizione' },
  { value: 'caged', label: 'CAGED' },
  { value: 'octaves', label: 'Ottave' },
  { value: 'sweep', label: 'Sweep' },
  { value: 'skip', label: 'Salto di corda' },
];

const SHAPE_HELP: Readonly<Record<ArpShape, string>> = {
  window: 'Le note dell’accordo in cinque tasti, senza spostare la mano.',
  caged: 'La forma CAGED costruita sulla fondamentale dell’accordo.',
  octaves: 'Da una a tre ottave lungo il manico: il motore sceglie corde, tasti e cambi di posizione.',
  sweep: 'Una nota per corda su corde vicine, con la girata sulla corda più acuta.',
  skip: 'Due note per corda su 6-4-2 o 5-3-1, in una posizione.',
};

const STRING_SETS: Readonly<Record<SweepStrings, string>> = { 3: '3 (Sol–Mi)', 4: '4 (Re–Mi)', 5: '5 (La–Mi)', 6: '6' };

function lowLabel(s: ArpeggioSettings): string {
  if (s.arpShape === 'window') return `Posizione: tasti ${s.arpLow}–${s.arpLow + ARP_SPAN}`;
  if (s.arpShape === 'caged') return `Zona del manico: intorno al tasto ${s.arpLow + 2}`;
  return `Parti vicino al tasto ${s.arpLow}`;
}

export function ArpShapeControls() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const progression = s.arpSource === 'progression';
  const chord = progression ? null : tryParseChord(s.arpSymbol);
  const plan = chord ? arpeggioPlanOf(chord, s) : null;
  const route = s.arpShape === 'octaves' || s.arpShape === 'sweep' || s.arpShape === 'skip';
  const bothWays = s.arpDirection === 'updown' || s.arpDirection === 'downup';
  // Which octave counts the hand can play from here, for this chord.
  const octavesOk = (o: ArpOctaves) => !chord || (arpeggioPlanOf(chord, { ...s, arpShape: 'octaves', arpOctaves: o })?.playable ?? false);
  const showLow = !(s.arpShape === 'caged' && !progression);

  return (
    <div className="arp-shape" data-testid="arp-shape-controls">
      <Field label="Forma sul manico" hint={SHAPE_HELP[s.arpShape]} group>
        <Segmented<ArpShape> label="Forma dell’arpeggio sul manico" value={s.arpShape} options={SHAPE_OPTIONS} onChange={(arpShape) => update({ arpShape })} />
      </Field>
      {s.arpShape === 'caged' && !progression ? (
        <Field label="Forma CAGED" group>
          <Segmented label="Forma CAGED dell’arpeggio" value={s.arpForm} options={CAGED_FORMS.map((f) => ({ value: f, label: f }))} onChange={(arpForm) => update({ arpForm })} />
        </Field>
      ) : null}
      {s.arpShape === 'caged' && progression ? (
        <p className="field-hint">Su ogni accordo la forma più vicina alla zona scelta: la mano resta nella stessa area del manico.</p>
      ) : null}
      {showLow ? (
        <Field label={lowLabel(s)}>
          <input
            className="range" type="range" min={0} max={DEFAULT_FRETS - ARP_SPAN} step={1} value={s.arpLow} data-testid="arp-low"
            aria-label={s.arpShape === 'window' ? 'Tasto più basso della posizione' : 'Tasto di partenza'}
            onChange={(e) => update({ arpLow: Number(e.target.value) })}
          />
        </Field>
      ) : null}
      {s.arpShape === 'octaves' ? (
        <Field label="Ottave" group>
          <Segmented<ArpOctaves>
            label="Numero di ottave"
            value={s.arpOctaves}
            options={([1, 2, 3] as const).map((o) => ({ value: o, label: String(o), disabled: !octavesOk(o) }))}
            onChange={(arpOctaves) => update({ arpOctaves })}
          />
        </Field>
      ) : null}
      {s.arpShape === 'sweep' ? (
        <Field label="Corde" group>
          <Segmented<SweepStrings> label="Corde dello sweep" value={s.arpStrings} options={([3, 4, 5, 6] as const).map((n) => ({ value: n, label: STRING_SETS[n] }))} onChange={(arpStrings) => update({ arpStrings })} />
        </Field>
      ) : null}
      {route && bothWays && s.arpShape !== 'sweep' ? (
        <Field label="Ritorno" group>
          <Segmented<ArpReturn>
            label="Percorso di ritorno"
            value={s.arpReturn}
            options={[{ value: 'same', label: 'Stessa strada' }, { value: 'other', label: 'Strada diversa' }]}
            onChange={(arpReturn) => update({ arpReturn })}
          />
        </Field>
      ) : null}
      {route && progression ? <p className="field-hint">Sulla progressione ogni accordo riparte con il suo percorso, vicino al tasto scelto.</p> : null}
      {plan && route ? (
        <p className={`field-hint arp-route ${plan.playable ? '' : 'is-warning'}`} data-testid="arp-route" role="status">
          {plan.playable
            ? `${plan.sequence.length} note · ${plan.shifts === 0 ? 'nessun cambio di posizione' : plan.shifts === 1 ? '1 cambio di posizione' : `${plan.shifts} cambi di posizione`}. Etichetta “Dito” per la diteggiatura.`
            : 'Da qui questa forma non si può suonare (esce dal manico o la mano non ci arriva). Cambia tasto di partenza, ottave o corde.'}
        </p>
      ) : null}
    </div>
  );
}
