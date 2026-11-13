/**
 * Studio V6 rail faders: the guitar's listening level and the backing trim,
 * with their keys stacked beside the slot. Real controls on the same store
 * as the mixer: the guitar fader is the mixer's guitar channel; the backing
 * fader trims comping, bass, drums and the imported track together.
 */
import { useApp } from '../../../app/store';
import { liveInput, useLive } from '../../../audio/liveInput';

const pct = (v: number) => `${Math.round(v * 100)}%`;

interface StripProps {
  readonly id: 'guitar' | 'backing';
  readonly caption: string;
  readonly label: string;
  readonly value: number;
  readonly lit: boolean;
  readonly onChange: (v: number) => void;
  readonly keyLabel: string;
  readonly keyText: string;
  readonly keyOn: boolean;
  readonly keyDisabled?: boolean;
  readonly keyTitle: string;
  readonly keyTestId: string;
  readonly onKey: () => void;
}

function Strip(p: StripProps) {
  return (
    <div className="v6-fader" role="group" aria-label={p.label} data-strip={p.id}>
      <span className="v6-fader-cap"><i className="v6-fader-led" data-on={p.lit ? '1' : '0'} aria-hidden="true" />{p.caption}</span>
      <div className="v6-fader-body">
        <span className="v6-fader-slot" style={{ ['--v' as string]: p.value }}>
          <input type="range" min={0} max={1} step={0.01} value={p.value} aria-label={`Volume ${p.label}`} aria-orientation="vertical" aria-valuetext={pct(p.value)}
            data-testid={`rail-fader-${p.id}`} onChange={(e) => p.onChange(Number(e.target.value))} />
        </span>
        <span className="v6-fader-keys">
          <button type="button" className="v6-ms" aria-pressed={p.keyOn} aria-label={p.keyLabel} title={p.keyTitle} disabled={p.keyDisabled} data-testid={p.keyTestId} onClick={p.onKey}>{p.keyText}</button>
        </span>
      </div>
      <span className="v6-fader-val">{pct(p.value)}</span>
    </div>
  );
}

export function RailFaders() {
  const monitorVol = useApp((s) => s.settings.monitorVol);
  const volBacking = useApp((s) => s.settings.volBacking);
  const muteBacking = useApp((s) => s.settings.muteBacking);
  const update = useApp((s) => s.update);
  const inputOn = useLive((l) => l.state === 'on');
  const monitorOn = useLive((l) => l.monitorOn);
  return (
    <div className="v6-faders" data-testid="rail-faders">
      <Strip id="guitar" caption="Guitar" label="Chitarra (ascolto)" value={monitorVol} lit={monitorOn && monitorVol > 0}
        onChange={(v) => { update({ monitorVol: v }); if (monitorOn) liveInput.setMonitor(true, v); }}
        keyLabel="Ascolta la chitarra" keyText="ASC" keyOn={monitorOn} keyDisabled={!inputOn} keyTestId="rail-listen"
        keyTitle={inputOn ? 'Ascolto della chitarra (usa le cuffie)' : 'Avvia prima l’ingresso chitarra'}
        onKey={() => liveInput.setMonitor(!monitorOn, monitorVol)} />
      <Strip id="backing" caption="Backing" label="Backing (accordi, basso, batteria, traccia)" value={volBacking} lit={!muteBacking && volBacking > 0}
        onChange={(v) => update({ volBacking: v })}
        keyLabel="Muto backing" keyText="M" keyOn={muteBacking} keyTestId="rail-mute-backing" keyTitle="Muto di accordi, basso, batteria e backing track"
        onKey={() => update({ muteBacking: !muteBacking })} />
    </div>
  );
}
