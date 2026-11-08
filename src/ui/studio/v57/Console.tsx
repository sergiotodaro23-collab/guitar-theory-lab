/**
 * The hi-fi console: transport keys and one wide amber LCD with its control
 * strip. Every figure on the display comes from the store and the playhead;
 * the keys call the engine. No timer here: the lamps follow the audio clock.
 */
import { engine } from '../../../app/engine';
import type { Settings } from '../../../app/settings';
import { useApp, usePlayhead } from '../../../app/store';
import { AccentGrid } from '../../AccentGrid';
import { Knob } from '../../hardware';
import { BeatLights, BpmInput, ClickSelect, MeterSelect, useCurrentChordText, useTap } from '../../Transport';
import { HardwareKey } from './HardwareKey';
import { useNowNext } from './hooks';
import { lcdModel } from './layout';
import { useStudioUi } from './uiStore';

const CLICK_TEXT: Record<number, string> = { 1: 'ogni battito', 2: 'ottavi', 3: 'terzine', 4: 'sedicesimi' };

function positionText(s: Settings): string {
  if (s.mode === 'arpeggio') {
    const shape: Record<Settings['arpShape'], string> = { window: `posizione dal tasto ${s.arpLow}`, caged: `CAGED ${s.arpForm}`, octaves: `${s.arpOctaves} ottave`, sweep: `sweep su ${s.arpStrings} corde`, skip: 'salto di corda' };
    return `arpeggio · ${shape[s.arpShape]}`;
  }
  if (s.positionType === 'neck') return 'tutta la tastiera';
  if (s.positionType === '3nps') return `3NPS dal grado ${s.npsStart + 1}`;
  return `CAGED ${s.cagedForm}`;
}

function Transport() {
  const state = usePlayhead((p) => p.state);
  const lcdExpanded = useStudioUi((u) => u.lcdExpanded);
  const setLcd = useStudioUi((u) => u.setLcd);
  return (
    <div className="v57-tp" role="group" aria-label="Trasporto">
      <HardwareKey label={state === 'playing' ? 'Pausa' : state === 'paused' ? 'Riprendi' : 'Avvia'} icon="play" lit={state === 'playing'} pressed={state === 'playing'}
        testId="play" hiddenText={state === 'playing' ? 'Pausa' : state === 'paused' ? 'Riprendi' : 'Avvia'} onClick={() => engine.toggle()} />
      <HardwareKey label="Pausa" icon="pause" lit={state === 'paused'} disabled={state !== 'playing'} testId="pause" onClick={() => engine.pause()} />
      <HardwareKey label="Ferma" icon="stop" disabled={state === 'stopped'} testId="stop" onClick={() => engine.stop()} />
      <span className="v57-tsep">
        <HardwareKey label={lcdExpanded ? 'Display compatto' : 'Display esteso'} icon={lcdExpanded ? 'compact' : 'expand'} pressed={lcdExpanded} testId="lcd-size" onClick={() => setLcd(!lcdExpanded)} />
      </span>
    </div>
  );
}

function StateLed() {
  const state = usePlayhead((p) => p.state);
  const bar = usePlayhead((p) => p.bar);
  const beat = usePlayhead((p) => p.beat);
  const text = state === 'playing' ? 'PLAY' : state === 'paused' ? 'PAUSA' : 'STOP';
  return (
    <span className="v57-lstate" data-state={state}>
      <i className="v57-sled" aria-hidden="true" />{text}
      <span className="v57-lcounter" aria-label="Battuta e movimento">{state === 'stopped' ? '--.-' : `${bar + 1}.${beat + 1}`}</span>
    </span>
  );
}

function Lcd() {
  const settings = useApp((s) => s.settings);
  const lcdExpanded = useStudioUi((u) => u.lcdExpanded);
  const text = useCurrentChordText();
  const { now, next } = useNowNext();
  const model = lcdModel(settings, now, next, text.current);
  const nextText = text.next ?? model.next;
  return (
    <div className="v57-lcdscreen" role="group" aria-label="Display principale: tonalità e scala, accordo, tempo" data-testid="lcd">
      <div className="v57-lmain">
        <div className="v57-lz" aria-label="Tonalità e scala">
          <div className="v57-lval"><span className="v57-lbig" data-testid="lcd-tonic">{model.tonic}</span><span className="v57-lscale">{model.scaleName}</span></div>
          <span className="v57-lsub" data-testid="lcd-notes">{model.notes}</span>
        </div>
        <div className="v57-lz" aria-label="Accordo">
          <div className="v57-lval">
            <span className="v57-lmid now-chord" data-len={text.current.length > 9 ? 'long' : 'short'} data-none={text.none ? '1' : '0'} data-testid="current-chord">{text.current}</span>
          </div>
          <span className="v57-lsub" data-testid="lcd-function">{model.numeral ? `${model.numeral} in ${model.tonic}` : text.none ? 'nessun accordo attivo' : 'fuori tonalità'}</span>
        </div>
        <div className="v57-lz" aria-label="Tempo">
          <div className="v57-lval v57-lbpm"><BpmInput /><span className="v57-lmeter">{settings.meterId}</span></div>
          <div className="v57-lsub v57-lrow2"><span>{settings.meterId} · Swing {Math.round(settings.swing * 200)}%</span><BeatLights /></div>
        </div>
      </div>
      {lcdExpanded ? (
        <div className="v57-lctx" role="status" aria-live="off" data-testid="lcd-context">
          <StateLed />
          <span className="v57-lit"><b className="v57-lkey">POS</b> {positionText(settings)}</span>
          <span className="v57-lit"><b className="v57-lkey">NEXT</b> {nextText || '—'}</span>
          <span className="v57-lit"><b className="v57-lkey">CLICK</b> {CLICK_TEXT[settings.subdivision] ?? ''}{settings.clickAccents ? ' · accenti propri' : ''}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Console() {
  const lcdExpanded = useStudioUi((u) => u.lcdExpanded);
  const swing = useApp((s) => s.settings.swing);
  const update = useApp((s) => s.update);
  const tap = useTap();
  return (
    <section className="v57-plate v57-deck" data-lcdx={lcdExpanded ? '1' : '0'} aria-label="Trasporto e display">
      <Transport />
      <div className="v57-plate v57-lcdframe">
        <Lcd />
        <div className="v57-lctl" role="group" aria-label="Tempo, metrica e click">
          <div className="v57-lcr">
            <HardwareKey label="Rallenta di 1 BPM" icon="minus" size="mini" onClick={() => engine.nudgeBpm(-1)} />
            <HardwareKey label="Accelera di 1 BPM" icon="plus" size="mini" onClick={() => engine.nudgeBpm(1)} />
            <HardwareKey label="Tap tempo" text="TAP" size="mini" onClick={tap} />
          </div>
          {lcdExpanded ? (
            <div className="v57-lcr v57-lcr-sel">
              <MeterSelect />
              <ClickSelect />
            </div>
          ) : null}
        </div>
        <div className="v57-lctl v57-lctl-knob">
          <Knob label="Swing" value={swing} min={0} max={0.5} step={0.01} format={(v) => `${Math.round(v * 200)}%`} onChange={(v) => update({ swing: v })} testId="knob-swing" className="v57-knob" />
          <AccentGrid />
        </div>
      </div>
    </section>
  );
}
