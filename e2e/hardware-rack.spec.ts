import { expect, test } from '@playwright/test';
import { openRack } from './studio';

/**
 * Rendered audio interface and cabinet (tools/blender, specs/iface.json and
 * cab.json): the pictures load, the live controls sit where the pictures
 * leave room for them, and nothing makes the rack scroll sideways.
 */

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: interface and cabinet pictures load; controls lie on the panel`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    await openRack(page);
    for (const [id, w] of [['iface-body', 640], ['cab-body', 648]] as const) {
      await expect.poll(() => page.getByTestId(id).evaluate((i) => (i as HTMLImageElement).naturalWidth), { message: id }).toBe(w);
    }
    const panel = await page.getByTestId('iface-panel').boundingBox();
    if (!panel) throw new Error('no interface panel');
    expect(panel.width).toBe(300);
    const parts = [page.getByTestId('iface-gain'), page.getByRole('meter', { name: 'Livello d’ingresso' }), page.getByRole('radio', { name: /Ingresso 1/ }), page.getByRole('radio', { name: /Ingresso 2/ })];
    const boxes = [];
    for (const part of parts) {
      const box = await part.boundingBox();
      if (!box) throw new Error('missing control');
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
      expect(box.y).toBeGreaterThanOrEqual(panel.y);
      expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
      boxes.push(box);
    }
    // The knob does not cover the meter or the channel keys.
    const [knob, ...others] = boxes;
    if (!knob) throw new Error('no knob');
    for (const other of others) expect(knob.x + knob.width).toBeLessThanOrEqual(other.x);
    expect(await page.locator('.v6-rack-body').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('the gain knob shows the frame of its value and still sets the input gain', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openRack(page);
  const knob = page.getByTestId('iface-gain');
  const frame = () => knob.evaluate((b) => Number((b.previousElementSibling as HTMLElement).getAttribute('data-frame')));
  await knob.focus();
  await page.keyboard.press('Home');
  expect(await frame()).toBe(0);
  const low = await knob.getAttribute('aria-valuetext');
  await page.keyboard.press('End');
  expect(await frame()).toBe(30);
  expect(await knob.getAttribute('aria-valuetext')).not.toBe(low);
});

test('the cabinet picture dims when the cabinet is switched off', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  await openRack(page);
  const body = page.getByTestId('cab-body');
  await body.scrollIntoViewIfNeeded();
  const filter = () => body.evaluate((e) => getComputedStyle(e).filter);
  expect(await filter()).toBe('none');
  await page.getByTestId('rig-cab-switch').click();
  expect(await filter()).not.toBe('none');
});

test('mixer: rendered caps follow the faders and rendered keys show mute and solo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByTestId('device-mixer').click();
  const mixer = page.getByTestId('v57-mixer');
  await expect(mixer).toBeVisible();
  const fader = page.getByTestId('fader-bass');
  const cap = () => fader.evaluate((input) => {
    const style = getComputedStyle(input.parentElement as HTMLElement, '::after');
    return { top: parseFloat(style.top), picture: style.backgroundImage, width: parseFloat(style.width) };
  });
  await fader.fill('1');
  const high = await cap();
  await fader.fill('0');
  const low = await cap();
  // Small pictures are inlined by the build: a WebP either way.
  expect(high.picture).toContain('webp');
  expect(high.width).toBe(40);
  // Up is louder: the cap at full volume is nearer the top of the slot.
  expect(high.top).toBeLessThan(low.top - 40);
  const mute = page.getByTestId('mute-bass');
  const picture = (key: typeof mute) => key.evaluate((e) => getComputedStyle(e).borderImageSource);
  const off = await picture(mute);
  expect(off).toContain('webp');
  await mute.click();
  const muted = await picture(mute);
  expect(muted).not.toBe(off);
  await mute.click();
  const solo = page.getByTestId('solo-bass');
  await solo.click();
  const soloed = await picture(solo);
  expect(soloed).not.toBe(off);
  expect(soloed).not.toBe(muted);
  await solo.click();
  expect(await picture(solo)).toBe(off);
});
