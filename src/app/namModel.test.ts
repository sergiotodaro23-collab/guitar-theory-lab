import { describe, expect, it } from 'vitest';
import { A1_STANDARD_WEIGHTS, A2_WEIGHTS, linearNam, slimmableA2Nam, waveNetA1Nam } from './namFixtures';
import { NAM_MAX_BYTES, costVerdict, describeNamModel, inspectNamModel, namInputDb, sampleRateNote } from './namModel';

const summaryOf = (text: string, name = 'prova.nam') => {
  const r = inspectNamModel(text, name);
  if (!r.ok) throw new Error(r.message);
  return r.summary;
};
const rejection = (text: string) => {
  const r = inspectNamModel(text, 'x.nam');
  return r.ok ? 'ok' : r.code;
};

describe('reading a .nam file', () => {
  it('a legacy WaveNet is A1, with the standard weight count and 48 kHz by convention when the file is silent about it', () => {
    const s = summaryOf(waveNetA1Nam({ name: 'Crunch' }));
    expect(s.generation).toBe('A1');
    expect(s.architecture).toBe('WaveNet');
    expect(s.weightCount).toBe(A1_STANDARD_WEIGHTS);
    expect(s.submodels).toBe(1);
    expect(s.sampleRate).toBeNull();
    expect(s.name).toBe('Crunch');
    expect(sampleRateNote(s.sampleRate, 48000)).toBeNull();
    expect(sampleRateNote(s.sampleRate, 44100)).toContain('48 kHz per convenzione');
  });

  it('a SlimmableContainer is A2: sub-models counted, weights of the largest, sample rate from the file', () => {
    const s = summaryOf(slimmableA2Nam());
    expect(s.generation).toBe('A2');
    expect(s.submodels).toBe(2);
    expect(s.weightCount).toBe(A2_WEIGHTS[8]);
    expect(s.sampleRate).toBe(48000);
    expect(describeNamModel(s)).toContain('A2 · 2 taglie');
  });

  it('the name falls back to the file name; trainer placeholders are not shown as gear', () => {
    const raw = JSON.parse(linearNam()) as { metadata: Record<string, unknown> };
    raw.metadata = { gear_make: 'T3K-Null', gear_model: 'T3K-Null', tone_type: 'T3K-Null' };
    const s = summaryOf(JSON.stringify(raw), 'Il mio ampli.nam');
    expect(s.name).toBe('Il mio ampli');
    expect(s.gearMake).toBe('');
    expect(describeNamModel(s)).toBe('A1 · Linear · 4 pesi');
  });

  it('the cabinet hint comes from the gear type only', () => {
    expect(summaryOf(linearNam(0.5, { gearType: 'amp' })).includesCab).toBe(false);
    expect(summaryOf(linearNam(0.5, { gearType: 'amp_cab' })).includesCab).toBe(true);
    expect(summaryOf(linearNam(0.5, { gearType: 'amp_pedal_cab' })).includesCab).toBe(true);
    expect(summaryOf(linearNam(0.5, { gearType: 'pedal' })).includesCab).toBe(false);
  });

  it('loudness is read when declared and null otherwise', () => {
    expect(summaryOf(linearNam(0.5, { loudness: -12.5 })).loudness).toBe(-12.5);
    expect(summaryOf(linearNam()).loudness).toBeNull();
  });

  it('refuses what is not a model, with a reason', () => {
    expect(rejection('')).toBe('empty');
    expect(rejection('   ')).toBe('empty');
    expect(rejection('RIFF....WAVE')).toBe('not-json');
    expect(rejection('[1,2,3]')).toBe('not-nam');
    expect(rejection('{"version":"0.5.4"}')).toBe('not-nam');
    expect(rejection(JSON.stringify({ version: '0.5.4', architecture: 'Transformer', config: {}, weights: [1] }))).toBe('architecture');
    expect(rejection(JSON.stringify({ version: '0.4.0', architecture: 'Linear', config: {}, weights: [1] }))).toBe('version');
    expect(rejection(JSON.stringify({ architecture: 'Linear', config: {}, weights: [1] }))).toBe('version');
    expect(rejection(JSON.stringify({ version: '0.5.4', architecture: 'Linear', config: {}, weights: [] }))).toBe('no-weights');
    expect(rejection(JSON.stringify({ version: '0.7.0', architecture: 'SlimmableContainer', config: { submodels: [] }, weights: [] }))).toBe('not-nam');
    expect(rejection(' '.repeat(NAM_MAX_BYTES + 1) + '{}')).toBe('too-large');
  });

  it('an inherited property name is not an architecture', () => {
    expect(rejection(JSON.stringify({ version: '0.5.4', architecture: 'constructor', config: {}, weights: [1] }))).toBe('architecture');
  });
});

describe('sample rate, cost and input trim', () => {
  it('equal rates need no note; different rates say that the engine does not resample', () => {
    expect(sampleRateNote(48000, 48000)).toBeNull();
    expect(sampleRateNote(44100, 48000)).toContain('non ricampiona');
    expect(sampleRateNote(48000, 96000)).toContain('96000 Hz');
  });

  it('the verdict follows the measured share of real time', () => {
    expect(costVerdict(0.2)).toBe('ok');
    expect(costVerdict(0.5)).toBe('heavy');
    expect(costVerdict(0.84)).toBe('heavy');
    expect(costVerdict(0.85)).toBe('too-heavy');
    expect(costVerdict(Number.NaN)).toBe('too-heavy');
  });

  it('the input trim is unity at noon and ±12 dB at the ends', () => {
    expect(namInputDb(50)).toBe(0);
    expect(namInputDb(0)).toBe(-12);
    expect(namInputDb(100)).toBe(12);
    expect(namInputDb(250)).toBe(12);
  });
});
