import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { chooseLook, openTab } from './studio';

/**
 * Live Monitor and Tuner end to end: Chromium reads a WAV file as its
 * microphone, so the whole chain runs (getUserMedia → gain → analyser → YIN →
 * UI) on a known signal. Synthetic, not a guitar: hardware checks are apart.
 */

const SR = 48000;
export function wav(path: string, frequency: number, seconds = 2): string {
  // A whole number of cycles, so the loop seam of the fake device does not jump in phase.
  const n = Math.round((Math.round(frequency * seconds) * SR) / frequency);
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) {
    let v = 0;
    for (let h = 1; h <= 5; h += 1) v += Math.sin((2 * Math.PI * frequency * h * i) / SR) / h;
    data.writeInt16LE(Math.round(v * 0.25 * 32767 / 1.5), 44 + i * 2);
  }
  mkdirSync(resolve('test-results/audio'), { recursive: true });
  const file = resolve('test-results/audio', path);
  writeFileSync(file, data);
  return file;
}
export const fakeMic = (file: string) => ({
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${file}`] },
});

export const openInput = async (page: Page, look: 'Studio' | 'Semplificata') => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await chooseLook(page, look);
  await openTab(page, 'Ingresso');
  await page.getByTestId('live-toggle').click();
  await expect(page.getByTestId('live-status')).toHaveText('Ingresso attivo');
};
export const centsShown = async (page: Page) => Number(((await page.getByTestId('tuner-cents').textContent()) ?? '').replace(' cent', ''));

/** A WAV of notes and silences, e.g. [[110, 0.6], [0, 0.4], [329.63, 0.6]]: a player picking and stopping. */
export function wavSequence(path: string, parts: readonly (readonly [number, number])[]): string {
  const samples: number[] = [];
  for (const [frequency, seconds] of parts) {
    const n = Math.round(SR * seconds);
    for (let i = 0; i < n; i += 1) {
      let v = 0;
      if (frequency > 0) for (let h = 1; h <= 5; h += 1) v += Math.sin((2 * Math.PI * frequency * h * i) / SR) / h;
      // Short fades at both ends, like a pick attack and a damped string.
      const fade = Math.min(1, i / 240, (n - i) / 240);
      samples.push(v * 0.25 * fade / 1.5);
    }
  }
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + samples.length * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(v * 32767), 44 + i * 2));
  mkdirSync(resolve('test-results/audio'), { recursive: true });
  const file = resolve('test-results/audio', path);
  writeFileSync(file, data);
  return file;
}
