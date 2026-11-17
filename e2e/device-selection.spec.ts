import { expect, test, type Page } from '@playwright/test';
import { fakeMic, wav } from './liveHelpers';
import { openTab } from './studio';

/**
 * Device selection (B1), SIMULATED: the device list, the permission state and
 * setSinkId are stubbed in the page. Headless Chromium has no real sinks, no
 * audio interface and no permission prompt; nothing here proves a real card.
 */

test.use(fakeMic(wav('device-selection.wav', 110)));

const fakeDevices = [
  { kind: 'audioinput', deviceId: 'mic-a', label: 'Interfaccia simulata', groupId: 'g1' },
  { kind: 'audioinput', deviceId: 'mic-b', label: '', groupId: 'g2' },
  { kind: 'audiooutput', deviceId: 'out-a', label: 'Cuffie simulate', groupId: 'g3' },
];

async function stub(page: Page, opts: { permission: 'granted' | 'denied' | 'prompt'; sink: boolean }) {
  await page.addInitScript(({ devices, permission, sink }) => {
    let list = devices;
    const md = navigator.mediaDevices;
    Object.defineProperty(md, 'enumerateDevices', { configurable: true, value: async () => list.map((d) => ({ ...d, toJSON() { return this; } })) });
    (window as unknown as { __setDevices: (l: typeof devices) => void }).__setDevices = (next) => { list = next; md.dispatchEvent(new Event('devicechange')); };
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: permission, onchange: null }) } });
    (window as unknown as { __sinks: string[] }).__sinks = [];
    if (sink) {
      Object.defineProperty(AudioContext.prototype, 'setSinkId', {
        configurable: true,
        value(id: string) { (window as unknown as { __sinks: string[] }).__sinks.push(id); return Promise.resolve(); },
      });
    } else {
      // Chromium has setSinkId natively: remove it to simulate a browser without it.
      delete (AudioContext.prototype as { setSinkId?: unknown }).setSinkId;
    }
  }, { devices: fakeDevices, permission: opts.permission, sink: opts.sink });
}

test('simulated: lists inputs and outputs before the input starts, names unlabelled devices, shows a denied permission', async ({ page }) => {
  await stub(page, { permission: 'denied', sink: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openTab(page, 'Ingresso');
  const input = page.getByTestId('live-device');
  await expect(input.locator('option')).toHaveText(['Interfaccia simulata', 'Ingresso 2']);
  await expect(page.getByTestId('output-device').locator('option')).toHaveText(['Uscita di sistema', 'Cuffie simulate']);
  await expect(page.getByTestId('mic-permission')).toContainText('lucchetto');
});

test('simulated: choosing an output calls setSinkId with that id, and the default is the system output', async ({ page }) => {
  await stub(page, { permission: 'granted', sink: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openTab(page, 'Ingresso');
  await expect(page.getByTestId('output-device')).toHaveValue('');
  await page.getByTestId('output-device').selectOption('out-a');
  await expect(page.getByTestId('output-device')).toHaveValue('out-a');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sinks: string[] }).__sinks.at(-1))).toBe('out-a');
});

test('simulated: without setSinkId the output select is replaced by a line saying the system output is used', async ({ page }) => {
  await stub(page, { permission: 'granted', sink: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openTab(page, 'Ingresso');
  await expect(page.getByTestId('output-device')).toHaveCount(0);
  await expect(page.getByTestId('output-unsupported')).toContainText('uscita audio di sistema');
});

test('simulated: a device that disappears from the system is dropped from the list on devicechange', async ({ page }) => {
  await stub(page, { permission: 'granted', sink: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openTab(page, 'Ingresso');
  await expect(page.getByTestId('live-device').locator('option')).toHaveCount(2);
  await page.evaluate(() => (window as unknown as { __setDevices: (l: unknown[]) => void }).__setDevices([
    { kind: 'audioinput', deviceId: 'mic-b', label: '', groupId: 'g2' },
  ]));
  await expect(page.getByTestId('live-device').locator('option')).toHaveText(['Ingresso 1']);
});

test('simulated: a saved input that the browser does not have falls back to the default and says so', async ({ page }) => {
  await stub(page, { permission: 'granted', sink: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openTab(page, 'Ingresso');
  // 'mic-b' is listed but does not exist for the fake device: exact-id capture is refused.
  await page.getByTestId('live-device').selectOption('mic-b');
  await expect(page.getByTestId('device-notice')).toContainText('uso quello predefinito');
  await expect(page.getByTestId('live-status')).toHaveText('Ingresso attivo');
});
