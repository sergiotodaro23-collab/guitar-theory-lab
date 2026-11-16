import { expect, test } from '@playwright/test';
import { openRack } from './studio';

/**
 * The rendered pedals (tools/blender, specs/pedals.json): pictures load, the
 * live controls sit on them and still write the rig. What the pedals do to
 * the sound is in guitar-rig.spec.ts; order, add and remove in pedal-chain.spec.ts.
 */

const PEDALS = ['comp', 'fuzz', 'drive', 'eq', 'chorus', 'delay', 'reverb'];

test('every pedal shows its own rendered body, with knobs, LED and switch on it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openRack(page);
  const sources = new Set<string>();
  for (const id of PEDALS) {
    const body = page.getByTestId(`pedal-${id}-body`);
    await body.scrollIntoViewIfNeeded();
    await expect.poll(() => body.evaluate((i) => (i as HTMLImageElement).naturalWidth), { message: id }).toBe(288);
    sources.add(await body.evaluate((i) => (i as HTMLImageElement).currentSrc));
    const pedal = await page.getByTestId(`pedal-${id}`).boundingBox();
    if (!pedal) throw new Error(`no pedal ${id}`);
    for (const part of [page.getByTestId(`pedal-${id}-led`), page.getByTestId(`pedal-${id}-switch`), ...(await page.getByTestId(`pedal-${id}`).getByRole('slider').all())]) {
      const box = await part.boundingBox();
      if (!box) throw new Error(`no part on ${id}`);
      expect(box.x, id).toBeGreaterThanOrEqual(pedal.x);
      expect(box.x + box.width, id).toBeLessThanOrEqual(pedal.x + pedal.width + 0.5);
      expect(box.y, id).toBeGreaterThanOrEqual(pedal.y);
      expect(box.y + box.height, id).toBeLessThanOrEqual(pedal.y + pedal.height + 0.5);
    }
  }
  expect(sources.size).toBe(PEDALS.length);
  expect(errors).toEqual([]);
});

test('the switch lights the LED and lowers the plunger; the knob shows the frame of its value', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  await openRack(page);
  const led = page.getByTestId('pedal-drive-led');
  const sw = page.getByTestId('pedal-drive-switch');
  const ledPicture = () => led.evaluate((e) => getComputedStyle(e).backgroundImage);
  const switchPicture = () => sw.evaluate((e) => (e.previousElementSibling as HTMLImageElement).currentSrc);
  const [ledOff, up] = [await ledPicture(), await switchPicture()];
  await sw.click();
  await expect(led).toHaveAttribute('data-on', '1');
  await expect(sw).toHaveAttribute('aria-pressed', 'true');
  expect(await ledPicture()).not.toBe(ledOff);
  expect(await switchPicture()).not.toBe(up);
  const knob = page.getByTestId('pedal-drive-tone');
  const frame = () => knob.evaluate((b) => Number((b.previousElementSibling as HTMLElement).getAttribute('data-frame')));
  await knob.focus();
  await page.keyboard.press('Home');
  expect(await frame()).toBe(0);
  await page.keyboard.press('End');
  expect(await frame()).toBe(30);
  await knob.dblclick();
  await expect(knob).toHaveAttribute('aria-valuenow', '55');
  await sw.click();
  expect(await ledPicture()).toBe(ledOff);
});
