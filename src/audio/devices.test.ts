import { describe, expect, it } from 'vitest';
import { deviceOptions, permissionHint, sampleRateMismatch, sinkSelectionSupported, totalLatencyMs } from './devices';
import { pickStudy } from '../ui/panels';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../app/settings';

describe('device options', () => {
  const list = [
    { kind: 'audioinput', deviceId: 'mic-a', label: 'Scarlett 2i2' },
    { kind: 'audiooutput', deviceId: 'out-a', label: 'Cuffie' },
    { kind: 'audioinput', deviceId: 'mic-b', label: '' },
  ];

  it('keeps only the requested kind, in the browser order', () => {
    expect(deviceOptions(list, 'audioinput').map((d) => d.id)).toEqual(['mic-a', 'mic-b']);
    expect(deviceOptions(list, 'audiooutput').map((d) => d.id)).toEqual(['out-a']);
  });

  it('names an unlabelled device by its position, without permission the browser gives no labels', () => {
    expect(deviceOptions(list, 'audioinput')[1]?.label).toBe('Ingresso 2');
    expect(deviceOptions([{ kind: 'audiooutput', deviceId: 'x', label: '  ' }], 'audiooutput')[0]?.label).toBe('Uscita 1');
  });
});

describe('latency estimate', () => {
  it('adds input, base and output latency in milliseconds', () => {
    // 10 ms input + 5 ms base + 20 ms output = 35 ms
    expect(totalLatencyMs({ input: 0.01, base: 0.005, output: 0.02 })).toBe(35);
  });

  it('counts only the figures the browser gives, and gives none when it gives none', () => {
    expect(totalLatencyMs({ input: null, base: 0.005, output: null })).toBe(5);
    expect(totalLatencyMs({ input: null, base: null, output: null })).toBeNull();
  });
});

describe('sample rate', () => {
  it('warns only when the device and the context differ', () => {
    expect(sampleRateMismatch(48000, 44100)).toBe(true);
    expect(sampleRateMismatch(48000, 48000)).toBe(false);
    expect(sampleRateMismatch(48000, null)).toBe(false);
  });
});

describe('output selection support', () => {
  it('is available only where the prototype has setSinkId', () => {
    expect(sinkSelectionSupported({ setSinkId: () => Promise.resolve() })).toBe(true);
    expect(sinkSelectionSupported({})).toBe(false);
    expect(sinkSelectionSupported(undefined)).toBe(false);
  });
});

describe('permission line', () => {
  it('explains a denied microphone and is silent when granted', () => {
    expect(permissionHint('denied')).toMatch(/lucchetto/);
    expect(permissionHint('granted')).toBeNull();
  });
});

describe('output device in settings', () => {
  it('defaults to the system output and keeps a sane string', () => {
    expect(DEFAULT_SETTINGS.outputDeviceId).toBe('');
    expect(sanitizeSettings({ outputDeviceId: 'x'.repeat(300) }).outputDeviceId).toHaveLength(200);
    expect(sanitizeSettings({ outputDeviceId: 42 }).outputDeviceId).toBe('');
  });

  it('never enters a study preset: device ids belong to one machine', () => {
    const study = pickStudy({ ...DEFAULT_SETTINGS, outputDeviceId: 'out-a', inputDeviceId: 'mic-a' });
    expect(study).not.toHaveProperty('outputDeviceId');
    expect(study).not.toHaveProperty('inputDeviceId');
  });
});
