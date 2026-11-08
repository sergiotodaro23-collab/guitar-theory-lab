import { expect, test } from '@playwright/test';
import { chooseLook } from './studio';

/**
 * P4-06: a MIDI device, simulated in the page (Chromium headless has no MIDI
 * hardware): notes reach the Live Monitor exactly, Start/Stop and the sustain
 * pedal drive the transport.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const input = { name: 'Chitarra MIDI di prova', onmidimessage: null as null | ((e: { data: Uint8Array }) => void) };
    const access = { inputs: new Map([['in', input]]), onstatechange: null };
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: () => Promise.resolve(access) });
    (window as unknown as { sendMidi: (bytes: number[]) => void }).sendMidi = (bytes) => input.onmidimessage?.({ data: new Uint8Array(bytes) });
  });
});

const send = (page: import('@playwright/test').Page, bytes: number[]) => page.evaluate((b) => (window as unknown as { sendMidi: (x: number[]) => void }).sendMidi(b), bytes);

test('MIDI notes show on the Live Monitor and the neck; Start, Stop and the pedal drive the transport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await chooseLook(page, 'Studio');
  await page.getByTestId('midi-toggle').click();
  await expect(page.getByTestId('midi-status')).toContainText('Chitarra MIDI di prova');

  // A3 (57) pressed: exact note, every place on the neck shown.
  await send(page, [0x90, 57, 100]);
  await expect(page.getByTestId('midi-note')).toHaveText('Nota MIDI A3');
  await expect(page.getByTestId('live-note')).toHaveText('A3');
  await expect(page.getByTestId('live-layer')).toBeVisible();
  await send(page, [0x80, 57, 0]);
  await expect(page.getByTestId('live-note')).toHaveText('—');

  // Transport: MIDI Start plays, the pedal pauses, Stop stops.
  await send(page, [0xfa]);
  await expect(page.getByTestId('play')).toHaveAttribute('aria-pressed', 'true');
  await send(page, [0xb0, 64, 127]);
  await send(page, [0xb0, 64, 0]);
  await expect(page.getByTestId('play')).toHaveAttribute('aria-pressed', 'false');
  await send(page, [0xfa]);
  await send(page, [0xfc]);
  await expect(page.getByTestId('play')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
